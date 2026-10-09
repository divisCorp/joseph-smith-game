// Per-subsystem timing for the ?perf=1 overlay (ms and counts accumulated per second).
export const PERF_ON = typeof location !== 'undefined' && new URLSearchParams(location.search).get('perf') === '1';
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
/** ?readback=0 skips the runtime hard-alpha pixel read-back on cache misses (A/B on device). */
export const NO_READBACK = Q.get('readback') === '0';
/** On-device A/B: ?res=0.75|0.5 (internal render scale), ?nofx=1 (no lighting/particles), ?nohud=1 */
export const RES = Math.min(1, Math.max(0.25, parseFloat(Q.get('res')) || 1));
export const NO_FX = Q.get('nofx') === '1';
export const NO_HUD = Q.get('nohud') === '1';
export const PS = { t: {}, n: {} };
export function psAdd(name, ms) { PS.t[name] = (PS.t[name] || 0) + ms; }
export function psCount(name, k = 1) { PS.n[name] = (PS.n[name] || 0) + k; }
export function psTake() { const r = { t: PS.t, n: PS.n }; PS.t = {}; PS.n = {}; return r; }
/** Wrap fn so its time lands in bucket `name` (no-op wrapper unless ?perf=1). */
export function timed(name, fn) {
  if (!PERF_ON) return fn;
  return function (...a) { const t = performance.now(); try { return fn.apply(this, a); } finally { psAdd(name, performance.now() - t); } };
}
