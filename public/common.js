// Shared helpers for NutriBite: daily tracking (unlimited days), rings, toasts, nav
const NB = (() => {
  const LOG_KEY = "nb_log";
  const START_KEY = "nb_start";
  const GOAL_KEY = "nb_goal";
  const RESULT_KEY = "nb_last_result";
  const DAY_MS = 86400000;

  const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

  // Day 1 = the day of your very first scan; Day 2, 3, 4 … follow by calendar date, forever.
  const getStart = () => Number(localStorage.getItem(START_KEY)) || startOfDay();
  const dayOf = (t = Date.now()) => Math.round((startOfDay(t) - getStart()) / DAY_MS) + 1;
  const currentDay = () => dayOf();
  const dateOfDay = (day) => new Date(getStart() + (day - 1) * DAY_MS);
  const fmtDate = (d) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const fmtTime = (t) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const getLog = () => { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch { return []; } };
  const saveLog = (log) => localStorage.setItem(LOG_KEY, JSON.stringify(log));

  function addEntry(result) {
    if (!localStorage.getItem(START_KEY)) localStorage.setItem(START_KEY, startOfDay());
    const log = getLog();
    const entry = {
      id: Date.now(), ts: Date.now(), day: currentDay(),
      name: result.foodName || "Food",
      calories: Math.round(+result.calories || 0),
      protein: Math.round(+result.macros?.protein || 0),
      carbs: Math.round(+result.macros?.carbs || 0),
      fat: Math.round(+result.macros?.fat || 0),
    };
    log.push(entry);
    saveLog(log);
    return entry;
  }
  const deleteEntry = (id) => saveLog(getLog().filter((e) => e.id !== id));
  function clearAll() { localStorage.removeItem(LOG_KEY); localStorage.removeItem(START_KEY); }

  function dayTotals(day) {
    const items = getLog().filter((e) => e.day === day);
    return items.reduce((t, e) => ({
      calories: t.calories + e.calories, protein: t.protein + e.protein,
      carbs: t.carbs + e.carbs, fat: t.fat + e.fat, items,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, items });
  }
  /** Day numbers that have entries, plus today */
  function activeDays() {
    const set = new Set(getLog().map((e) => e.day));
    set.add(currentDay());
    return [...set].sort((a, b) => a - b);
  }

  const getGoal = () => Number(localStorage.getItem(GOAL_KEY)) || 2000;
  const setGoal = (g) => localStorage.setItem(GOAL_KEY, g);

  function saveResult(data) {
    const json = JSON.stringify(data);
    try { sessionStorage.setItem(RESULT_KEY, json); } catch { localStorage.setItem(RESULT_KEY, json); }
  }
  function loadResult() {
    const raw = sessionStorage.getItem(RESULT_KEY) || localStorage.getItem(RESULT_KEY);
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  let ringCount = 0;
  function ring({ size = 170, stroke = 14, id = "", over = false } = {}) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, g = `g${++ringCount}`;
    const [a, b] = over ? ["#f87171", "#ef4444"] : ["#16a34a", "#4ade80"];
    return `<svg viewBox="0 0 ${size} ${size}"><defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/></linearGradient></defs>
      <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
      <circle class="ring-fg" ${id ? `id="${id}"` : ""} cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="url(#${g})" stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-c="${c}"/></svg>`;
  }
  function setRing(el, pct) {
    if (!el) return;
    const c = +el.dataset.c, p = Math.max(0, Math.min(1, pct));
    requestAnimationFrame(() => setTimeout(() => { el.style.strokeDashoffset = c * (1 - p); }, 60));
  }
  function countUp(el, to, dur = 1100) {
    if (!el) return;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  let toastTimer;
  function toast(msg, type = "") {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); document.body.appendChild(t); }
    t.textContent = msg; t.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3600);
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const RATIO_KEY = "nb_aspect_ratio";
  const RATIO_MIN_KEY = "nb_ratio_min";

  // Early ratio mode setup to prevent layout flash
  try {
    const initialRatio = localStorage.getItem(RATIO_KEY);
    if (initialRatio === "9-16") document.documentElement.classList.add("mode-9-16");
    else if (initialRatio === "16-9") document.documentElement.classList.add("mode-16-9");
  } catch {}

  function applyRatioMode(ratio) {
    document.documentElement.classList.remove("mode-9-16", "mode-16-9");
    if (ratio === "9-16") document.documentElement.classList.add("mode-9-16");
    else if (ratio === "16-9") document.documentElement.classList.add("mode-16-9");

    document.querySelectorAll(".ratio-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.ratio === ratio);
    });
  }

  function initRatioSwitcher() {
    let existing = document.getElementById("ratioSwitch");
    if (existing) existing.remove();

    const cur = localStorage.getItem(RATIO_KEY) || "auto";
    const isMin = localStorage.getItem(RATIO_MIN_KEY) === "1";

    const wrap = document.createElement("div");
    wrap.id = "ratioSwitch";
    wrap.className = `ratio-switch ${isMin ? "minimized" : ""}`;
    wrap.innerHTML = `
      <div class="ratio-switch-inner" role="toolbar" aria-label="Aspect Ratio Switcher">
        <span class="ratio-label">Ratio:</span>
        <button class="ratio-btn ${cur === "9-16" ? "active" : ""}" data-ratio="9-16" title="Switch to 9:16 Vertical Mobile View">📱 9:16 Mobile</button>
        <button class="ratio-btn ${cur === "16-9" ? "active" : ""}" data-ratio="16-9" title="Switch to 16:9 Widescreen Desktop View">💻 16:9 Desktop</button>
        <button class="ratio-btn ${cur === "auto" ? "active" : ""}" data-ratio="auto" title="Auto Responsive based on screen">🔄 Auto</button>
        <button class="ratio-toggle-btn" id="ratioToggleBtn" title="Minimize ratio switcher" aria-label="Minimize ratio switcher">✕</button>
      </div>
      <button class="ratio-mini-btn" id="ratioMiniBtn" title="Switch Aspect Ratio (9:16 / 16:9)" aria-label="Open ratio switcher">📐</button>
    `;
    document.body.appendChild(wrap);

    applyRatioMode(cur);

    wrap.querySelectorAll(".ratio-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.ratio;
        localStorage.setItem(RATIO_KEY, val);
        applyRatioMode(val);
      });
    });

    const toggleBtn = wrap.querySelector("#ratioToggleBtn");
    const miniBtn = wrap.querySelector("#ratioMiniBtn");
    toggleBtn?.addEventListener("click", () => {
      wrap.classList.add("minimized");
      localStorage.setItem(RATIO_MIN_KEY, "1");
    });
    miniBtn?.addEventListener("click", () => {
      wrap.classList.remove("minimized");
      localStorage.setItem(RATIO_MIN_KEY, "0");
    });
  }

  /** Shared glass menu bar + powered-by banner, injected on every page */
  function mountChrome(active) {
    const host = document.getElementById("chrome");
    if (!host) return;
    const link = (href, key, icon, label) =>
      `<a href="${href}" class="nav-item ${active === key ? "active" : ""}" data-nav="${key}">
        <span class="nav-icon" aria-hidden="true">${icon}</span>
        <span class="nav-text">${label}</span>
      </a>`;
    host.innerHTML = `
      <div class="powered-bar">⚡ <b>Powered by the most efficient AI</b> to detect the calories &amp; nutrients of the food in your hands</div>
      <div class="nav-wrap"><nav class="nav" id="nav">
        <a href="index.html" class="logo"><span class="logo-mark">🥗</span>NutriBite</a>
        <div class="nav-links" id="navLinks">
          <span class="nav-glider" id="navGlider" aria-hidden="true"></span>
          ${link("index.html", "home", "🏠", "Home")}
          ${link("scan.html", "scan", "📷", "Scan Food")}
          ${link("progress.html", "progress", "📊", "My Progress")}
        </div>
        <a href="scan.html" class="btn btn-dark btn-sm nav-cta">📷 Scan Food</a>
        <button class="menu-btn" id="menuBtn" aria-label="Menu">☰</button>
      </nav></div>`;

    const links = document.getElementById("navLinks");
    const glider = document.getElementById("navGlider");
    const items = links.querySelectorAll(".nav-item");
    const activeItem = links.querySelector(".nav-item.active");

    function setGliderPos(target) {
      if (!glider || !target || window.innerWidth <= 860) return;
      glider.style.width = target.offsetWidth + "px";
      glider.style.transform = `translateX(${target.offsetLeft}px)`;
      glider.style.opacity = "1";
    }

    function resetGlider() {
      if (window.innerWidth <= 860) {
        if (glider) glider.style.opacity = "0";
        return;
      }
      if (activeItem) {
        setGliderPos(activeItem);
      } else if (glider) {
        glider.style.opacity = "0";
      }
    }

    items.forEach((item) => {
      item.addEventListener("mouseenter", () => setGliderPos(item));
      item.addEventListener("focus", () => setGliderPos(item));
    });

    links.addEventListener("mouseleave", resetGlider);
    setTimeout(resetGlider, 100);
    window.addEventListener("resize", resetGlider);

    const menuBtn = document.getElementById("menuBtn");
    menuBtn?.addEventListener("click", () => links.classList.toggle("open"));
    links?.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => links.classList.remove("open")));
    const nav = document.getElementById("nav");
    const onScroll = () => nav.classList.toggle("scrolled", scrollY > 20);
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
    document.addEventListener("click", (e) => {
      if (nav && !nav.contains(e.target)) links.classList.remove("open");
    });
    initRatioSwitcher();
  }

  document.documentElement.classList.add('js');
  document.addEventListener("DOMContentLoaded", () => {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    document.querySelectorAll(".reveal, .reveal-card").forEach((el) => io.observe(el));
  });

  return { currentDay, dayOf, dateOfDay, fmtDate, fmtTime, getLog, addEntry, deleteEntry, clearAll, dayTotals, activeDays, getGoal, setGoal, saveResult, loadResult, ring, setRing, countUp, toast, esc, mountChrome, applyRatioMode };
})();
