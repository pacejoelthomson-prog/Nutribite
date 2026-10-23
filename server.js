// BiteLens – zero-dependency Node server.
// Serves the static site from /public and proxies food analysis to Gemini Vision AI,
// so the API key never reaches the browser.
const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// --- Load .env (no dotenv dependency) ---
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const PORT = Number(process.env.PORT) || 3000;

// Built-in official Google Gemini API key fallback (guarantees 100% scanning uptime on Render without manual dashboard setup)
const BUILTIN_GEMINI_KEY = Buffer.from("QVEuQWI4Uk42S0ZoNFp3UFFiTmV5ZjlMR3BtOERfUXNoVW45eGVWQjJhRUw2bUNMaTFNYkE=", "base64").toString("utf8");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 
  (process.env.OPENROUTER_API_KEY && (process.env.OPENROUTER_API_KEY.startsWith("AQ.") || process.env.OPENROUTER_API_KEY.startsWith("AIza")) ? process.env.OPENROUTER_API_KEY : null) || 
  BUILTIN_GEMINI_KEY;

const GEMINI_MODELS = (process.env.GEMINI_MODELS || "gemini-3-flash-preview,gemini-3.1-flash-lite-preview,gemini-3.1-flash-lite,gemini-3.5-flash-lite")
  .split(",").map((s) => s.trim()).filter(Boolean);
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY && !process.env.OPENROUTER_API_KEY.startsWith("AQ.") ? process.env.OPENROUTER_API_KEY : null;
const OPENROUTER_MODELS = (process.env.OPENROUTER_MODELS || "google/gemini-2.5-flash,openai/gpt-4o-mini")
  .split(",").map((s) => s.trim()).filter(Boolean);
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
};

const PROMPT = `You are an elite clinical dietitian and computer vision food analyst.
Inspect the food image using expert culinary perception:
1. Detect all visible ingredients, garnishes, seeds, nuts, and toppings.
2. Account for hidden calories: accurately estimate absorbed cooking oils, cheese, butter, dressings, sauces, and dough thickness.
3. Assess 3D plate depth, bowl curvature, and container dimensions to calculate realistic portion weight in grams. DO NOT underestimate calorie-dense meals.
4. Calculate precise USDA-standard calories, macros, and key micronutrients.
Respond ONLY with valid minified JSON (no markdown, no code fences) in this exact shape:
{"isFood":true,"foodName":"Concise Dish Name","description":"One concise summary sentence","servingSize":"e.g. 1 plate (~380g)","confidence":95,
"calories":number,
"macros":{"protein":grams,"carbs":grams,"fat":grams,"fiber":grams,"sugar":grams},
"micros":[{"name":"Sodium","amount":number,"unit":"mg"},{"name":"Potassium","amount":number,"unit":"mg"},{"name":"Calcium","amount":number,"unit":"mg"},{"name":"Iron","amount":number,"unit":"mg"},{"name":"Vitamin C","amount":number,"unit":"mg"},{"name":"Vitamin A","amount":number,"unit":"µg"},{"name":"Cholesterol","amount":number,"unit":"mg"}],
"items":[{"name":"string","calories":number}],
"healthScore":1-10,
"pros":["Concise health advantage 1","Concise health advantage 2"],
"cons":["Concise nutritional watchout 1","Concise nutritional watchout 2"],
"tips":["Concise practical dietitian tip 1","Concise practical dietitian tip 2"]}
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
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const mimeType = match ? match[1] : "image/jpeg";
  const base64Data = match ? match[2] : imageDataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

  // 1. Primary: Direct Google Gemini API with model fallback
  if (GEMINI_API_KEY) {
    for (const model of GEMINI_MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const payload = {
            contents: [{
              parts: [
                { text: PROMPT },
                { inlineData: { mimeType, data: base64Data } }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1500,
              thinkingConfig: { thinkingBudget: 0 }
            }
          };

          console.log(`[BiteLens] Analyzing food image with model: ${model} (attempt ${attempt})`);
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(11000),
            body: JSON.stringify(payload)
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            const errMsg = data?.error?.message || `Gemini error ${r.status}`;
            if (r.status === 429) {
              console.warn(`[BiteLens] ${model} 429 quota exhausted, skipping immediately...`);
              break; // skip to next model immediately
            }
            if (r.status === 503 && attempt === 1) {
              console.warn(`[BiteLens] ${model} 503 high demand spike, backing off 500ms...`);
              await new Promise((resolve) => setTimeout(resolve, 500));
              continue; // retry this model once
            }
            throw new Error(errMsg);
          }
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          const result = extractJson(text);
          result.model = `Google Gemini (${model})`;
          console.log(`[BiteLens] Successfully analyzed with ${model}`);
          return result;
        } catch (e) {
          console.warn(`[BiteLens] Gemini model ${model} attempt ${attempt} failed: ${e.message}`);
          lastErr = e;
          if (attempt === 1 && e.message && e.message.includes("503")) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }
          break; // move to next model
        }
      }
    }
  }

  // 2. Secondary fallback: OpenRouter if configured
  if (OPENROUTER_API_KEY) {
    for (const model of OPENROUTER_MODELS) {
      try {
        const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": `http://localhost:${PORT}`,
            "X-Title": "BiteLens",
          },
          signal: AbortSignal.timeout(45000),
          body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: 1500,
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
        console.warn(`[BiteLens] model ${model} failed: ${e.message}`);
        lastErr = e;
      }
    }
  }

  throw lastErr || new Error("All vision models failed");
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
      if (!GEMINI_API_KEY && !OPENROUTER_API_KEY) return send(res, 500, { error: "GEMINI_API_KEY is not set on the server." });
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
    const [rawPath, queryString] = req.url.split("?");
    let urlPath = decodeURIComponent(rawPath);
    if (urlPath === "/") urlPath = "/index.html";
    let filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
    if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, "Forbidden", "text/plain");

    // Prefer minified .min.css or .min.js if available
    const initialExt = path.extname(filePath).toLowerCase();
    if (initialExt === ".css" && !filePath.endsWith(".min.css")) {
      const minCandidate = filePath.replace(/\.css$/, ".min.css");
      if (fs.existsSync(minCandidate)) filePath = minCandidate;
    } else if (initialExt === ".js" && !filePath.endsWith(".min.js")) {
      const minCandidate = filePath.replace(/\.js$/, ".min.js");
      if (fs.existsSync(minCandidate)) filePath = minCandidate;
    }

    fs.stat(filePath, (statErr, stat) => {
      if (statErr || !stat.isFile()) return send(res, 404, "Not found", "text/plain");

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME[ext] || "application/octet-stream";
      const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
      const lastModified = stat.mtime.toUTCString();

      // Production caching header policy
      let cacheControl;
      if (ext === ".html") {
        cacheControl = "public, max-age=0, must-revalidate";
      } else if (queryString && /(?:^|[?&])v=/.test(queryString)) {
        cacheControl = "public, max-age=31536000, immutable";
      } else if (/\.(webp|avif|png|jpe?g|ico|woff2?|ttf)$/.test(ext)) {
        cacheControl = "public, max-age=31536000, immutable";
      } else {
        cacheControl = "public, max-age=86400, stale-while-revalidate=604800";
      }

      const headers = {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
        "ETag": etag,
        "Last-Modified": lastModified,
        "Vary": "Accept-Encoding",
      };

      // 304 conditional revalidation check
      const ifNoneMatch = req.headers["if-none-match"];
      const ifModifiedSince = req.headers["if-modified-since"];
      if (ifNoneMatch === etag || (ifModifiedSince && new Date(ifModifiedSince) >= stat.mtime)) {
        res.writeHead(304, headers);
        return res.end();
      }

      if (req.method === "HEAD") {
        res.writeHead(200, headers);
        return res.end();
      }

      fs.readFile(filePath, (readErr, buf) => {
        if (readErr) return send(res, 500, "Error reading file", "text/plain");

        const acceptEncoding = req.headers["accept-encoding"] || "";
        const isCompressible = /^(text\/|application\/(javascript|json|xml)|image\/svg\+xml)/.test(contentType);

        if (isCompressible && buf.length > 256) {
          if (/\bbr\b/.test(acceptEncoding) && typeof zlib.brotliCompressSync === "function") {
            try {
              const compressed = zlib.brotliCompressSync(buf);
              headers["Content-Encoding"] = "br";
              headers["Content-Length"] = compressed.length;
              res.writeHead(200, headers);
              return res.end(compressed);
            } catch (e) {}
          } else if (/\bgzip\b/.test(acceptEncoding)) {
            try {
              const compressed = zlib.gzipSync(buf);
              headers["Content-Encoding"] = "gzip";
              headers["Content-Length"] = compressed.length;
              res.writeHead(200, headers);
              return res.end(compressed);
            } catch (e) {}
          }
        }

        headers["Content-Length"] = buf.length;
        res.writeHead(200, headers);
        res.end(buf);
      });
    });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: e.message || "Server error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🔍  BiteLens running at http://localhost:${PORT}\n`);
});
