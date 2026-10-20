/**
 * CountUp Component (React Bits) - JavaScript + CSS implementation
 * Supporting both "count" and "roll" (odometer) modes, exact motion/react easeOut curves,
 * view triggers, and interactive hover / tap replays.
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
      for (let i = 0; i < 8; i++) {
        const err = sampleX(t) - x;
        if (Math.abs(err) < 1e-5) return t;
        const d = derivX(t);
        if (Math.abs(d) < 1e-5) break;
        t -= err / d;
      }
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

  const mod10 = function (v) { return ((v % 10) + 10) % 10; };

  // --- Main CountUp Instance Controller ---
  function createCountUp(el, userOpts) {
    if (!el) return null;
    if (el._countUpInstance) return el._countUpInstance;

    const ds = el.dataset;
    const to = parseFloat(userOpts && userOpts.to !== undefined ? userOpts.to : ds.to);
    if (isNaN(to)) return null;

    const from = parseFloat(userOpts && userOpts.from !== undefined ? userOpts.from : (ds.from || '0'));
    const direction = (userOpts && userOpts.direction) || ds.direction || 'up';
    const duration = parseFloat((userOpts && userOpts.duration) || ds.duration || '1.6');
    const delay = parseFloat((userOpts && userOpts.delay) || ds.delay || '0.35');
    const separator = (userOpts && userOpts.separator !== undefined) ? userOpts.separator : (ds.separator !== undefined ? ds.separator : '');
    const prefix = (userOpts && userOpts.prefix !== undefined) ? userOpts.prefix : (ds.prefix || '');
    const suffix = (userOpts && userOpts.suffix !== undefined) ? userOpts.suffix : (ds.suffix || '');
    const easingKey = (userOpts && userOpts.easing) || ds.easing || 'easeOut';
    const mode = (userOpts && userOpts.mode) || ds.mode || 'roll';
    const format = (userOpts && userOpts.format) || ds.format || 'standard';
    const trigger = (userOpts && userOpts.trigger) || ds.trigger || 'view';
    const replayOnHover = (userOpts && userOpts.replayOnHover !== undefined)
      ? userOpts.replayOnHover
      : (ds.replayOnHover === 'true' || ds.replay === 'true' || el.hasAttribute('data-replay-on-hover') || true);
    const decimals = (userOpts && userOpts.decimals !== undefined)
      ? userOpts.decimals
      : (ds.decimals !== undefined ? parseInt(ds.decimals, 10) : undefined);

    const opts = {
      from: isNaN(from) ? 0 : from,
      to: to,
      direction: direction,
      duration: Math.max(0.2, duration),
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

    el.classList.add('count-up-text');
    el.style.fontVariantNumeric = 'tabular-nums';

    const finalText = formatValue(endVal, opts);
    el.setAttribute('aria-label', finalText);

    // --- ROLL MODE (Odometer Columns) ---
    const CELL_EM = 1.18;
    let rollColumns = [];

    function setupRollDOM() {
      const sa = String(Math.abs(Math.round(startVal)));
      const sb = String(Math.abs(Math.round(endVal)));
      const len = Math.max(sa.length, sb.length);
      const padA = sa.padStart(len, '0');
      const padB = sb.padStart(len, '0');

      rollColumns = [];
      el.innerHTML = '';

      const wrap = document.createElement('span');
      wrap.className = 'countup-roll-wrap';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.style.cssText = 'display:inline-flex;align-items:baseline;white-space:pre;user-select:none;font-variant-numeric:tabular-nums;';

      if (opts.prefix) {
        const pre = document.createElement('span');
        pre.className = 'countup-prefix';
        pre.textContent = opts.prefix;
        wrap.appendChild(pre);
      }

      for (let i = 0; i < len; i++) {
        const fromDigit = parseInt(padA[i], 10);
        const toDigit = parseInt(padB[i], 10);
        const rank = len - 1 - i;
        const baseTurns = Math.max(1, 2 - rank);
        const diff = mod10(toDigit - fromDigit);
        const totalSteps = diff + baseTurns * 10;

        const slot = document.createElement('span');
        slot.className = 'countup-slot';
        slot.style.cssText = 'display:inline-block;height:' + CELL_EM + 'em;line-height:' + CELL_EM + 'em;overflow:hidden;vertical-align:baseline;position:relative;';

        const strip = document.createElement('span');
        strip.className = 'countup-strip';
        strip.style.cssText = 'display:flex;flex-direction:column;transform:translateY(0em);will-change:transform;';

        for (let s = 0; s <= totalSteps; s++) {
          const digit = document.createElement('span');
          digit.style.cssText = 'display:block;height:' + CELL_EM + 'em;line-height:' + CELL_EM + 'em;text-align:center;';
          digit.textContent = String(mod10(fromDigit + s));
          strip.appendChild(digit);
        }

        slot.appendChild(strip);
        wrap.appendChild(slot);

        rollColumns.push({
          slot: slot,
          strip: strip,
          fromDigit: fromDigit,
          toDigit: toDigit,
          totalSteps: totalSteps,
          index: i
        });

        if (opts.separator && (len - 1 - i) > 0 && (len - 1 - i) % 3 === 0) {
          const sep = document.createElement('span');
          sep.className = 'countup-separator';
          sep.textContent = opts.separator;
          wrap.appendChild(sep);
        }
      }

      if (opts.suffix) {
        const suf = document.createElement('span');
        suf.className = 'countup-suffix';
        suf.textContent = opts.suffix;
        wrap.appendChild(suf);
      }

      el.appendChild(wrap);
    }

    function renderCount(val) {
      el.textContent = formatValue(val, opts);
    }

    function startAnimation() {
      if (isRunning) return;
      hasStarted = true;

      // Handle reduced motion preference
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        if (opts.mode === 'roll') {
          setupRollDOM();
          rollColumns.forEach(function (col) {
            col.strip.style.transform = 'translateY(' + (-col.totalSteps * CELL_EM) + 'em)';
          });
        } else {
          renderCount(endVal);
        }
        return;
      }

      isRunning = true;
      let startTimestamp = null;
      const totalMs = opts.duration * 1000;
      const delayMs = opts.delay * 1000;

      if (opts.mode === 'roll') {
        setupRollDOM();

        const STAGGER = 0.08;
        const totalSpan = Math.max(0.001, totalMs);

        function rollStep(now) {
          if (!startTimestamp) startTimestamp = now;
          const elapsed = now - startTimestamp;

          if (elapsed < delayMs) {
            rafId = requestAnimationFrame(rollStep);
            return;
          }

          const activeElapsed = elapsed - delayMs;
          const overallProgress = Math.min(1, activeElapsed / totalSpan);

          rollColumns.forEach(function (col) {
            const staggerDelay = col.index * STAGGER * totalSpan;
            const colTime = Math.max(0, activeElapsed - staggerDelay);
            const colDuration = Math.max(0.001, totalSpan - (rollColumns.length - 1) * STAGGER * totalSpan);
            const u = Math.min(1, colTime / colDuration);
            const eased = easeFn(u);
            const currentStep = col.totalSteps * eased;
            col.strip.style.transform = 'translateY(' + (-currentStep * CELL_EM).toFixed(4) + 'em)';
          });

          if (overallProgress < 1) {
            rafId = requestAnimationFrame(rollStep);
          } else {
            rollColumns.forEach(function (col) {
              col.strip.style.transform = 'translateY(' + (-col.totalSteps * CELL_EM).toFixed(4) + 'em)';
            });
            isRunning = false;
            rafId = null;
          }
        }

        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(rollStep);

      } else {
        // Plain count mode
        function countStep(now) {
          if (!startTimestamp) startTimestamp = now;
          const elapsed = now - startTimestamp;

          if (elapsed < delayMs) {
            rafId = requestAnimationFrame(countStep);
            return;
          }

          const activeElapsed = elapsed - delayMs;
          const p = Math.min(1, activeElapsed / totalMs);
          const eased = easeFn(p);
          const currentVal = startVal + (endVal - startVal) * eased;

          renderCount(currentVal);

          if (p < 1) {
            rafId = requestAnimationFrame(countStep);
          } else {
            renderCount(endVal);
            isRunning = false;
            rafId = null;
          }
        }

        if (rafId) cancelAnimationFrame(rafId);
        renderCount(startVal);
        rafId = requestAnimationFrame(countStep);
      }
    }

    function replay() {
      if (isRunning) return;
      el.classList.add('countup-pulse');
      setTimeout(function () { el.classList.remove('countup-pulse'); }, 600);
      startAnimation();
    }

    // Initial setup
    if (opts.mode === 'roll') {
      setupRollDOM();
    } else {
      renderCount(startVal);
    }

    // Replay on hover and click/tap
    if (opts.replayOnHover) {
      el.addEventListener('mouseenter', replay);
      el.addEventListener('click', replay);

      const parentCard = el.closest('.stat') || el.closest('.stat-card') || el.closest('strong');
      if (parentCard && parentCard !== el) {
        parentCard.addEventListener('mouseenter', replay);
        parentCard.addEventListener('click', replay);
      }
    }

    // View trigger with IntersectionObserver
    if (opts.trigger === 'load') {
      startAnimation();
    } else {
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              startAnimation();
            }
          });
        }, { threshold: 0.25, rootMargin: '0px 0px -50px 0px' });

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

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { initAll(); });
    } else {
      initAll();
    }
  }

  const api = {
    create: createCountUp,
    init: initAll,
    EASINGS: EASINGS
  };

  global.CountUp = api;
  if (global.NB) global.NB.CountUp = api;

})(typeof window !== 'undefined' ? window : this);
