// Shared helpers for BiteLens: daily tracking (unlimited days), rings, toasts, nav
const NB = (() => {
  const LOG_KEY = "bitelens_log";
  const START_KEY = "bitelens_start";
  const GOAL_KEY = "bitelens_goal";
  const RESULT_KEY = "bitelens_last_result";
  const DAY_MS = 86400000;

  // Backwards compatibility helper for legacy storage keys
  const getStored = (key, fallbackKey) => {
    try {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
      if (fallbackKey) {
        const oldVal = localStorage.getItem(fallbackKey);
        if (oldVal !== null) {
          localStorage.setItem(key, oldVal);
          localStorage.removeItem(fallbackKey);
          return oldVal;
        }
      }
    } catch (e) {}
    return null;
  };

  const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

  // Day 1 = the day of your very first scan; Day 2, 3, 4 … follow by calendar date, forever.
  const getStart = () => Number(getStored(START_KEY, "nb_start")) || startOfDay();
  const dayOf = (t = Date.now()) => Math.round((startOfDay(t) - getStart()) / DAY_MS) + 1;
  const currentDay = () => dayOf();
  const dateOfDay = (day) => new Date(getStart() + (day - 1) * DAY_MS);
  const fmtDate = (d) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const fmtTime = (t) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const getLog = () => { try { return JSON.parse(getStored(LOG_KEY, "nb_log")) || []; } catch { return []; } };
  const saveLog = (log) => localStorage.setItem(LOG_KEY, JSON.stringify(log));

  function addEntry(result) {
    if (!getStored(START_KEY, "nb_start")) localStorage.setItem(START_KEY, startOfDay());
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
  function countUp(el, to) {
    if (!el) return;
    el.textContent = Math.round(+to || 0).toLocaleString();
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

  const RATIO_KEY = "bitelens_aspect_ratio";
  const RATIO_MIN_KEY = "bitelens_ratio_min";

  // Early ratio mode setup to prevent layout flash
  try {
    const initialRatio = getStored(RATIO_KEY, "nb_aspect_ratio");
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

    const cur = getStored(RATIO_KEY, "nb_aspect_ratio") || "auto";
    const isMin = getStored(RATIO_MIN_KEY, "nb_ratio_min") === "1";

    const wrap = document.createElement("div");
    wrap.id = "ratioSwitch";
    wrap.className = `ratio-switch ${isMin ? "minimized" : ""}`;
    wrap.innerHTML = `
      <div class="ratio-switch-inner" role="toolbar" aria-label="Aspect Ratio Switcher">
        <span class="ratio-label">Ratio:</span>
        <button class="ratio-btn ${cur === "9-16" ? "active" : ""}" data-ratio="9-16" title="Switch to 9:16 Vertical Mobile View"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:4px"><rect x="5" y="2" width="14" height="20" rx="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>9:16 Mobile</button>
        <button class="ratio-btn ${cur === "16-9" ? "active" : ""}" data-ratio="16-9" title="Switch to 16:9 Widescreen Desktop View"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:4px"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>16:9 Desktop</button>
        <button class="ratio-btn ${cur === "auto" ? "active" : ""}" data-ratio="auto" title="Auto Responsive based on screen"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:4px"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>Auto</button>
        <button class="ratio-toggle-btn" id="ratioToggleBtn" title="Minimize ratio switcher" aria-label="Minimize ratio switcher"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
      <button class="ratio-mini-btn" id="ratioMiniBtn" title="Switch Aspect Ratio (9:16 / 16:9)" aria-label="Open ratio switcher"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg></button>
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

  const THEME_KEY = "bitelens_theme";
  function getTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") return saved;
      return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    } catch (e) {
      return "light";
    }
  }

  function applyTheme(theme) {
    const isDark = theme === "dark";
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}

    document.querySelectorAll(".theme-btn").forEach((btn) => {
      btn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
      btn.setAttribute("title", isDark ? "Switch to light mode" : "Switch to dark mode");
    });
    document.querySelectorAll(".theme-inline-text").forEach((el) => {
      el.textContent = isDark ? "Light mode" : "Dark mode";
    });
  }

  function toggleTheme() {
    const cur = document.documentElement.classList.contains("dark") ? "dark" : "light";
    applyTheme(cur === "dark" ? "light" : "dark");
  }

  // Initialize theme early
  try {
    applyTheme(getTheme());
  } catch (e) {}

  /** Shared glass menu bar + powered-by banner, injected on every page */
  function mountChrome(active) {
    const host = document.getElementById("chrome");
    if (!host) return;
    const link = (href, key, iconSvg, label) =>
      `<a href="${href}" class="nav-item ${active === key ? "active" : ""}" data-nav="${key}">
        <span class="nav-icon" aria-hidden="true">${iconSvg}</span>
        <span class="nav-text">${label}</span>
      </a>`;

    const iconHome = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
    const iconCamera = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`;
    const iconChart = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`;

    const isDark = document.documentElement.classList.contains("dark");

    host.innerHTML = `
      <div class="powered-bar"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px;margin-right:5px;display:inline-block"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg><b>Powered by AI</b> to detect the calories &amp; nutrients of the food in your hands</div>
      <div class="nav-wrap"><nav class="nav" id="nav">
        <a href="index.html" class="logo"><img src="logo.png" class="logo-mark-img" alt="BiteLens Logo" width="30" height="30" /><span>BiteLens</span></a>
        <div class="nav-links" id="navLinks">
          <span class="nav-glider" id="navGlider" aria-hidden="true"></span>
          ${link("index.html", "home", iconHome, "Home")}
          ${link("scan.html", "scan", iconCamera, "Scan Food")}
          ${link("progress.html", "progress", iconChart, "My Progress")}
          <button class="nav-theme-toggle" id="navThemeToggle" type="button" aria-label="Toggle theme">
            <span class="nav-icon" aria-hidden="true">
              <svg class="nav-sun-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              <svg class="nav-moon-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            </span>
            <span class="theme-inline-text">${isDark ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
        <div class="nav-actions">
          <button class="theme-btn" id="themeBtn" aria-label="${isDark ? "Switch to light mode" : "Switch to dark mode"}" title="${isDark ? "Switch to light mode" : "Switch to dark mode"}">
            <span class="theme-icon theme-sun" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg></span>
            <span class="theme-icon theme-moon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg></span>
          </button>
          <a href="scan.html" class="btn btn-dark btn-sm nav-cta">${iconCamera} Scan Food</a>
          <button class="menu-btn" id="menuBtn" aria-label="Menu"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button>
        </div>
      </nav></div>`;

    document.getElementById("themeBtn")?.addEventListener("click", toggleTheme);
    document.getElementById("navThemeToggle")?.addEventListener("click", toggleTheme);

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

  function initKword() {
    const el = document.querySelector(".kword");
    if (!el || el._kwordInit) return;
    el._kwordInit = true;
    const inner = el.querySelector(".kword__inner");

    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.classList.add("is-in");
        setTimeout(() => el.classList.add("is-live"), 1400);
        obs.disconnect();
      }
    }, { threshold: 0.15 });
    obs.observe(el);

    let lastY = window.scrollY, vel = 0, isObserving = false;
    const tick = () => {
      if (!isObserving) return;
      const curY = window.scrollY;
      vel += (curY - lastY - vel) * 0.14;
      lastY = curY;
      const skew = Math.max(-8, Math.min(8, -vel * 0.32));
      if (inner) inner.style.transform = `skewX(${skew.toFixed(2)}deg)`;
      requestAnimationFrame(tick);
    };

    const skewObs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !isObserving) {
        isObserving = true;
        lastY = window.scrollY;
        requestAnimationFrame(tick);
      } else if (!entry.isIntersecting) {
        isObserving = false;
      }
    });
    skewObs.observe(el);
  }

  document.documentElement.classList.add('js');
  document.addEventListener("DOMContentLoaded", () => {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    document.querySelectorAll(".reveal, .reveal-card").forEach((el) => io.observe(el));
    initKword();
  });

  return { currentDay, dayOf, dateOfDay, fmtDate, fmtTime, getLog, addEntry, deleteEntry, clearAll, dayTotals, activeDays, getGoal, setGoal, saveResult, loadResult, ring, setRing, countUp, toast, esc, mountChrome, applyRatioMode, getTheme, setTheme: applyTheme, toggleTheme, initKword };
})();

if (typeof window !== "undefined") {
  window.BiteLens = NB;
  window.BL = NB;
  window.NB = NB;
}
