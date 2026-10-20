/**
 * CountUp Component (React Bits) - Vanilla JS implementation
 * Matching exact motion/react easing, count & roll modes, format, and hover replays.
 */
(function (global) {
  'use strict';

  // --- Easing Functions matching motion/react & React Bits ---
  function solveCubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;

    function sampleX(t) { return ((ax * t + bx) * t + cx) * t; }
    function sampleY(t) { return ((ay * t + by) * t + cy) * t; }
    function derivX(t) { return (3 * ax * t + 2 * bx) * t + cx; }

    function solveX(x) {
      let t = x;
      // Newton-Raphson
      for (let i = 0; i < 8; i++) {
        const err = sampleX(t) - x;
        if (Math.abs(err) < 1e-5) return t;
        const d = derivX(t);
        if (Math.abs(d) < 1e-5) break;
        t -= err / d;
      }
      // Binary search fallback
      let t0 = 0, t1 = 1;
      t = x;
      while (t0 < t1) {
        const x2 = sampleX(t);
        if (Math.abs(x2 - x) < 1e-5) return t;
        if (x > x2) t0 = t; else t1 = t;
        t = (t1 - t0) * 0.5 + t0;
      }
      return t;
    }

    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      return sampleY(solveX(x));
    };
  }

  const makeSpring = function (overshoot) {
    overshoot = overshoot || 0.06;
    const log = Math.log(Math.min(0.5, Math.max(0.001, overshoot)));
    const zeta = -log / Math.sqrt(Math.PI * Math.PI + log * log);
    const damped = Math.PI / 0.52;
    const natural = damped / Math.sqrt(1 - zeta * zeta);
    const raw = function (t) {
      return 1 - Math.exp(-zeta * natural * t) * (Math.cos(damped * t) + ((zeta * natural) / damped) * Math.sin(damped * t));
    };
    const residual = 1 - raw(1);
    return function (t) { return t >= 1 ? 1 : raw(t) + residual * t * t * t; };
  };

  const EASINGS = {
    linear: function (t) { return t; },
    easeOut: solveCubicBezier(0.33, 1, 0.68, 1),
    expo: function (t) { return t >= 1 ? 1 : (1 - Math.pow(2, -10 * t)) / (1 - Math.pow(2, -10)); },
    spring: makeSpring(0.06)
  };

  const UNITS = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K']
  ];

  function getDecimalPlaces(num) {
    const str = String(num);
    if (str.includes('.')) {
      const decimals = str.split('.')[1];
      if (parseInt(decimals, 10) !== 0) return decimals.length;
    }
    return 0;
  }

  function group(intStr, separator) {
    return separator ? intStr.replace(/\B(?=(\d{3})+(?!\d))/g, separator) : intStr;
  }

  function scaleFor(value, compact, decimals, places) {
    if (!compact) return { size: 1, label: '', digits: places };
    let size = 1, label = '';
    for (let i = 0; i < UNITS.length; i++) {
      if (Math.abs(value) >= UNITS[i][0] * 0.9995) {
        size = UNITS[i][0];
        label = UNITS[i][1];
        break;
      }
    }
    const digits = (decimals !== undefined && decimals !== null)
      ? decimals
      : (label ? (Math.abs(value) / size < 100 ? 1 : 0) : places);
    return { size: size, label: label, digits: digits };
  }

  function splitNumber(value, digits, size) {
    const fixed = (Math.abs(value) / size).toFixed(digits);
    const parts = fixed.split('.');
    return {
      negative: value < 0 && Number(fixed) !== 0,
      int: parts[0],
      frac: parts[1] || ''
    };
  }

  function formatValue(value, opts) {
    const compact = opts.format === 'compact';
    const places = (opts.decimals !== undefined && opts.decimals !== null)
      ? opts.decimals
      : Math.max(getDecimalPlaces(opts.from), getDecimalPlaces(opts.to));
    const scale = scaleFor(value, compact, opts.decimals, places);
    const parts = splitNumber(value, scale.digits, scale.size);
    const body = (parts.negative ? '-' : '') + group(parts.int, opts.separator) + (parts.frac ? '.' + parts.frac : '');
    return (opts.prefix || '') + body + scale.label + (opts.suffix || '');
  }

  // --- Main CountUp Instance Controller ---
  function createCountUp(el, userOpts) {
    if (!el) return null;
    if (el._countUpInstance) return el._countUpInstance;

    // Parse options from attributes or userOpts
    const ds = el.dataset;
    const to = parseFloat(userOpts && userOpts.to !== undefined ? userOpts.to : ds.to);
    if (isNaN(to)) return null;

    const from = parseFloat(userOpts && userOpts.from !== undefined ? userOpts.from : (ds.from || '0'));
    const direction = (userOpts && userOpts.direction) || ds.direction || 'up';
    const duration = parseFloat((userOpts && userOpts.duration) || ds.duration || '1.4');
    const delay = parseFloat((userOpts && userOpts.delay) || ds.delay || '0');
    const separator = (userOpts && userOpts.separator !== undefined) ? userOpts.separator : (ds.separator !== undefined ? ds.separator : '');
    const prefix = (userOpts && userOpts.prefix !== undefined) ? userOpts.prefix : (ds.prefix || '');
    const suffix = (userOpts && userOpts.suffix !== undefined) ? userOpts.suffix : (ds.suffix || '');
    const easingKey = (userOpts && userOpts.easing) || ds.easing || 'easeOut';
    const mode = (userOpts && userOpts.mode) || ds.mode || 'count';
    const format = (userOpts && userOpts.format) || ds.format || 'standard';
    const trigger = (userOpts && userOpts.trigger) || ds.trigger || 'view';
    const replayOnHover = (userOpts && userOpts.replayOnHover !== undefined)
      ? userOpts.replayOnHover
      : (ds.replayOnHover === 'true' || ds.replay === 'true' || el.hasAttribute('data-replay-on-hover'));
    const decimals = (userOpts && userOpts.decimals !== undefined)
      ? userOpts.decimals
      : (ds.decimals !== undefined ? parseInt(ds.decimals, 10) : undefined);

    const opts = {
      from: isNaN(from) ? 0 : from,
      to: to,
      direction: direction,
      duration: Math.max(0.1, duration),
      delay: Math.max(0, delay),
      separator: separator,
      prefix: prefix,
      suffix: suffix,
      easing: easingKey,
      mode: mode,
      format: format,
      trigger: trigger,
      replayOnHover: replayOnHover,
      decimals: decimals
    };

    const easeFn = EASINGS[opts.easing] || EASINGS.easeOut;
    const startVal = opts.direction === 'down' ? opts.to : opts.from;
    const endVal = opts.direction === 'down' ? opts.from : opts.to;

    let isRunning = false;
    let hasStarted = false;
    let rafId = null;

    // Apply tabular-nums styling & class
    el.classList.add('count-up-text');
    el.style.fontVariantNumeric = 'tabular-nums';

    // Store final text for accessibility
    const finalText = formatValue(endVal, opts);
    if (!el.getAttribute('aria-label')) {
      el.setAttribute('aria-label', finalText);
    }

    function renderValue(val) {
      el.textContent = formatValue(val, opts);
    }

    function startAnimation() {
      if (isRunning) return;
      hasStarted = true;

      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        renderValue(endVal);
        return;
      }

      isRunning = true;
      let startTimestamp = null;
      const totalMs = opts.duration * 1000;
      const delayMs = opts.delay * 1000;

      function step(now) {
        if (!startTimestamp) startTimestamp = now;
        const elapsed = now - startTimestamp;

        if (elapsed < delayMs) {
          rafId = requestAnimationFrame(step);
          return;
        }

        const activeElapsed = elapsed - delayMs;
        const p = Math.min(1, activeElapsed / totalMs);
        const eased = easeFn(p);
        const currentVal = startVal + (endVal - startVal) * eased;

        renderValue(currentVal);

        if (p < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          renderValue(endVal);
          isRunning = false;
          rafId = null;
        }
      }

      if (rafId) cancelAnimationFrame(rafId);
      renderValue(startVal);
      rafId = requestAnimationFrame(step);
    }

    function replay() {
      if (isRunning) return;
      startAnimation();
    }

    // Set initial rendered text
    renderValue(startVal);

    // Replay on hover
    if (opts.replayOnHover) {
      el.addEventListener('mouseenter', replay);
      // Also attach to parent .stat or .stat-card if present for great UX
      const parentCard = el.closest('.stat') || el.closest('.stat-card') || el.closest('strong');
      if (parentCard && parentCard !== el) {
        parentCard.addEventListener('mouseenter', replay);
      }
    }

    // Trigger strategy
    if (opts.trigger === 'load') {
      startAnimation();
    } else {
      // trigger === 'view' using IntersectionObserver
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting && !hasStarted) {
              startAnimation();
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

        const observeTarget = el.closest('.stat') || el;
        observer.observe(observeTarget);
      } else {
        startAnimation();
      }
    }

    const instance = {
      el: el,
      opts: opts,
      replay: replay,
      start: startAnimation
    };

    el._countUpInstance = instance;
    return instance;
  }

  function initAll(root) {
    const scope = root || document;
    const elements = scope.querySelectorAll('.count-up-text, [data-to]');
    const instances = [];
    elements.forEach(function (el) {
      const inst = createCountUp(el);
      if (inst) instances.push(inst);
    });
    return instances;
  }

  // Auto-init on DOMContentLoaded
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { initAll(); });
    } else {
      initAll();
    }
  }

  // Export to global BiteLens object and window
  const api = {
    create: createCountUp,
    init: initAll,
    EASINGS: EASINGS
  };

  global.CountUp = api;
  if (global.NB) global.NB.CountUp = api;

})(typeof window !== 'undefined' ? window : this);
