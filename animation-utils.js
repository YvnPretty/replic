/* Global animation helpers: easing curves, frame coalescing, prefers-reduced-motion. */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const easings = {
    linear:        t => t,
    easeOutCubic:  t => 1 - Math.pow(1 - t, 3),
    easeInOutCubic:t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    easeOutQuint:  t => 1 - Math.pow(1 - t, 5),
    easeOutBack:   t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    easeOutElastic:t => { if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1; }
  };

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

  /* RAF coalescer: many subscribers share a single shared frame. */
  const subs = new Set();
  let rafHandle = null;
  const frame = (now) => {
    subs.forEach(fn => { try { fn(now); } catch (e) { console.warn('[animation-utils]', e); } });
    rafHandle = subs.size ? requestAnimationFrame(frame) : null;
  };
  const subscribe = (fn) => {
    subs.add(fn);
    if (rafHandle == null) rafHandle = requestAnimationFrame(frame);
    return () => subs.delete(fn);
  };

  function animate(from, to, duration, onUpdate, easing = 'easeOutCubic') {
    if (reduceMotion) { onUpdate(to); return () => {}; }
    const ease = easings[easing] || easings.easeOutCubic;
    let start = null;
    let cancelled = false;
    const unsub = subscribe(now => {
      if (cancelled) return;
      if (start == null) start = now;
      const t = clamp((now - start) / duration, 0, 1);
      onUpdate(lerp(from, to, ease(t)));
      if (t >= 1) unsub();
    });
    return () => { cancelled = true; unsub(); };
  }

  function repeat(mapper, onUpdate, easing = 'easeInOutCubic') {
    if (reduceMotion) { onUpdate(mapper(0)); return () => {}; }
    const ease = easings[easing] || easings.easeInOutCubic;
    const start = performance.now();
    let cancelled = false;
    const unsub = subscribe(now => {
      if (cancelled) return;
      const phase = ((now - start) / 1000) % 1;
      onUpdate(mapper(ease(phase)));
    });
    return () => { cancelled = true; unsub(); };
  }

  function pulse(now, periodMs, dutyCycle = .5) {
    const phase = ((now / periodMs) % 1 + 1) % 1;
    return clamp(phase < dutyCycle ? smoothstep(0, dutyCycle * .35, phase) - smoothstep(dutyCycle * .65, dutyCycle, phase) : 0, 0, 1);
  }

  window.replicAnimation = { easings, lerp, clamp, smoothstep, subscribe, animate, repeat, pulse, reduceMotion };
})();
