// NutriBite – zero-dependency Node server.
// Serves the static site from /public and proxies food analysis to OpenRouter,
// so the API key never reaches the browser.
const http = require("http");
const fs = require("fs");
const path = require("path");

// --- Load .env (no dotenv dependency) ---
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODELS = (process.env.OPENROUTER_MODELS || "google/gemini-3.6-flash,openai/gpt-4o")
  .split(",").map((s) => s.trim()).filter(Boolean);
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

const PROMPT = `You are an expert nutritionist with computer vision skills.
Analyze the food in this image and estimate its nutrition for the portion visible.
Respond ONLY with valid minified JSON (no markdown, no code fences) in exactly this shape:
{"isFood":true,"foodName":"string","description":"short one-sentence description","servingSize":"e.g. 1 bowl (~250g)","confidence":0-100,
"calories":number,
"macros":{"protein":grams,"carbs":grams,"fat":grams,"fiber":grams,"sugar":grams},
"micros":[{"name":"Sodium","amount":number,"unit":"mg"},{"name":"Potassium","amount":number,"unit":"mg"},{"name":"Calcium","amount":number,"unit":"mg"},{"name":"Iron","amount":number,"unit":"mg"},{"name":"Vitamin C","amount":number,"unit":"mg"},{"name":"Vitamin A","amount":number,"unit":"µg"},{"name":"Cholesterol","amount":number,"unit":"mg"}],
"items":[{"name":"string","calories":number}],
"healthScore":1-10,
"pros":["3-4 short health advantages of eating this food"],
"cons":["3-4 short health disadvantages or things to watch out for"],
"tips":["short healthy tip","another tip"]}
If the image contains no food, respond with {"isFood":false,"message":"short explanation"}.`;

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, limit = 15 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("Image too large (max ~10MB)")); req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function extractJson(text) {
  if (!text) throw new Error("Empty AI response");
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI did not return JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function analyze(imageDataUrl) {
  let lastErr;
  for (const model of MODELS) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": `http://localhost:${PORT}`,
          "X-Title": "NutriBite",
        },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          }],
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error?.message || `OpenRouter error ${r.status}`);
      const result = extractJson(data?.choices?.[0]?.message?.content);
      result.model = model;
      return result;
    } catch (e) {
      console.warn(`[NutriBite] model ${model} failed: ${e.message}`);
      lastErr = e;
    }
  }
  throw lastErr || new Error("All models failed");
}

// --- Simple per-IP rate limit so a public link can't drain your OpenRouter credits ---
const RATE_LIMIT = Number(process.env.RATE_LIMIT) || 40; // scans per hour per IP
const hits = new Map();
function rateLimited(req) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 3600000)) hits.delete(k);
  return recent.length > RATE_LIMIT;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/healthz" || req.url === "/api/health" || req.url === "/health") return send(res, 200, { status: "ok" });

    if (req.method === "POST" && req.url === "/api/analyze") {
      if (!API_KEY) return send(res, 500, { error: "OPENROUTER_API_KEY is not set on the server." });
      if (rateLimited(req)) return send(res, 429, { error: "Too many scans. Please try again in a while." });
      let image;
      try {
        ({ image } = JSON.parse(await readBody(req)));
      } catch (e) {
        const tooBig = /too large/i.test(e.message);
        return send(res, tooBig ? 413 : 400, { error: tooBig ? e.message : "Invalid request." });
      }
      if (!image || !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(image)) {
        return send(res, 400, { error: "Please provide a valid image." });
      }
      try {
        return send(res, 200, await analyze(image));
      } catch (e) {
        return send(res, 502, { error: `AI analysis failed: ${e.message}` });
      }
    }

    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "Method not allowed" });

    // Static files
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
    if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, "Forbidden", "text/plain");
    fs.readFile(filePath, (err, buf) => {
      if (err) return send(res, 404, "Not found", "text/plain");
      if (req.method === "HEAD") {
        res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
        return res.end();
      }
      send(res, 200, buf, MIME[path.extname(filePath)] || "application/octet-stream");
    });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: e.message || "Server error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🍽️  NutriBite running at http://localhost:${PORT}\n`);
});
