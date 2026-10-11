/**
 * Joseph Smith — Palmyra Quest
 * HD illustrated 1080×480 canvas, scaled via CSS.
 * Title / pause / win / lose use HTML overlays for sharp phone text.
 */
import { STATES } from './constants.js?v=81';
import { createGame, updateGame, drawGame, titleTapBegins, setFullscreenOffered } from './game.js?v=81';
import { isStandalone } from './fullscreen.js?v=81';
import { initVirtualControls, setAction } from './input.js?v=81';
import { initOverlays, syncOverlays } from './ui.js?v=81';
import { preloadSprites } from './sprites.js?v=81';
import { fxFrameTime, fxPerf } from './fx.js?v=81';
import { psAdd, psTake, PERF_ON, NO_READBACK, RES, NO_HUD } from './perfstat.js?v=81';
import { bakeBytes, bakeStats } from './rig.js?v=81';
import { animalBakeBytes, animalBakeStats, animalBakeFrame } from './rig-animals.js?v=81';
import { unlockAudio, toggleMute, bindMuteButton } from './audio.js?v=81';
import { justPressed, pollGamepads, onGamepadChange } from './input.js?v=81';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;

initVirtualControls();
bindMuteButton();

// Full screen is an explicit choice now (title, pause menu and HUD buttons): see fullscreen.js
setFullscreenOffered(!isStandalone());

function armAudio() {
  unlockAudio();
}
window.addEventListener('pointerdown', armAudio, { once: false });
window.addEventListener('keydown', armAudio, { once: false });

const game = createGame();
initOverlays(game);
// QA hook for automated tests: needs BOTH ?debug in the URL and a local opt-in flag,
// so a shared link alone never exposes game internals.
try {
  if (new URLSearchParams(location.search).has('debug') && localStorage.getItem('palmyraQuest.debug') === '1') {
    window.__pq = game;
  }
} catch (_) {
  /* storage blocked: no debug hook */
}

/** Tap/click canvas to start / return to title when menus are up (phones + desktop). */
let canvasStartHeld = false;
function releaseCanvasStart() {
  if (!canvasStartHeld) return;
  canvasStartHeld = false;
  setAction('start', false);
}
canvas.addEventListener('pointerdown', (e) => {
  if (e.button != null && e.button !== 0) return;
  if (game.state === STATES.INTRO) {
    game.cmd = 'skip';
    return;
  }
  if (game.state === STATES.TITLE) {
    if (titleTapBegins()) game.cmd = 'begin';
    return;
  }
  if (game.state !== STATES.WIN && game.state !== STATES.CLEAR) {
    return;
  }
  canvasStartHeld = true;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (_) {
    /* ignore */
  }
  setAction('start', true);
});
canvas.addEventListener('pointerup', releaseCanvasStart);
canvas.addEventListener('pointercancel', releaseCanvasStart);
canvas.addEventListener('lostpointercapture', releaseCanvasStart);

let last = performance.now();
const STEP = 1000 / 60; // fixed-ish timestep ms
let acc = 0;
let lastDraw = performance.now();

// Gamepad: a short toast confirms the pad and its buttons
let toastTimer = 0;
function showToast(text) {
  const el = document.getElementById('ui-toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-shown'), 3200);
}
onGamepadChange((kind) => {
  if (kind === 'connected') {
    unlockAudio();
    showToast('Gamepad ready · A jump · B / X attack · Start pause');
  } else showToast('Gamepad disconnected');
});

function frame(now) {
  pollGamepads();
  if (justPressed('mute')) toggleMute();
  const interval = now - last;
  acc += interval;
  last = now;
  const t0 = performance.now();
  // catch-up capped
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    const tu = PERF_ON ? performance.now() : 0;
    updateGame(game, 1); // dt in frames @ 60fps
    if (PERF_ON) psAdd('update', performance.now() - tu);
    acc -= STEP;
    steps++;
  }
  // 120Hz (ProMotion): the sim runs at 60 steps/s, so skip redraws when nothing advanced
  if (steps === 0) {
    requestAnimationFrame(frame);
    return;
  }
  animalBakeFrame();
  const td = PERF_ON ? performance.now() : 0;
  if (RES !== 1) ctx.setTransform(RES, 0, 0, RES, 0, 0);
  drawGame(ctx, game);
  if (PERF_ON) psAdd('draw', performance.now() - td);
  const to = PERF_ON ? performance.now() : 0;
  syncOverlays(game);
  if (PERF_ON) psAdd('dom', performance.now() - to);
  // work time per frame (update + draw + overlays), read by the perf QA
  const work = performance.now() - t0;
  game.workMs = game.workMs == null ? work : game.workMs * 0.95 + work * 0.05;
  fxFrameTime(now - lastDraw, work);
  lastDraw = now;
  if (perfHud) perfHud(now, work);
  requestAnimationFrame(frame);
}

// Load painterly PNG sheets, then start loop (procedural fallback if missing)
preloadSprites().finally(() => {
  requestAnimationFrame(frame);
});

// prevent space / arrow scroll on desktop
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
});

// iOS Safari can keep a stale dvh/innerHeight after rotation: pin layout height to the
// visual viewport, re-measure after the rotation settles, and undo any leftover scroll.
function syncAppHeight() {
  const h = Math.round(window.visualViewport?.height || window.innerHeight);
  document.documentElement.style.setProperty('--app-h', h + 'px');
  if (window.scrollY || window.scrollX) window.scrollTo(0, 0);
}
function onRotate() {
  syncAppHeight();
  [100, 300, 700].forEach((ms) => setTimeout(syncAppHeight, ms));
}
syncAppHeight();
window.addEventListener('resize', onRotate);
window.addEventListener('orientationchange', onRotate);
window.visualViewport?.addEventListener('resize', onRotate);

// Rotate gate: "Play anyway" dismisses it for this session
document.querySelector('[data-gate-dismiss]')?.addEventListener('click', () => {
  document.documentElement.classList.add('gate-dismissed');
});

// ?perf=1: small read-out of fps, ms of work per frame, quality tier and frame-cache size
let perfHud = null;
function breakdown(n) {
  const { t, n: c } = psTake();
  const f = (k) => ((t[k] || 0) / n).toFixed(1);
  const level = Math.max(0, (t.draw || 0) - (t.rig || 0) - (t.animals || 0) - (t.fx || 0) - (t.title || 0)) / n;
  const q = (k) => ((c[k] || 0) / n).toFixed(2);
  const flags = [...new URLSearchParams(location.search).entries()].filter(([k]) => k !== 'perf').map(([k, v]) => k + '=' + v).join(' ');
  return `ms/f: update ${f('update')} rig ${f('rig')} animals ${f('animals')} fx ${f('fx')} level ${level.toFixed(1)} title ${f('title')} dom ${f('dom')}\n` +
    `/f: rigMiss ${q('rigMiss')} animalMiss ${q('animalMiss')} readback ${q('readback')} newCanvas ${q('newCanvas')}` +
    `${NO_READBACK ? '  [readback OFF]' : ''}${flags ? '\nflags: ' + flags : ''}`;
}
if (new URLSearchParams(location.search).get('perf') === '1') {
  const el = document.createElement('pre');
  el.style.cssText = 'position:fixed;right:max(8px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));z-index:2147483646;margin:0;padding:6px 8px;font:11px/1.35 ui-monospace,Menlo,monospace;color:#cfe;background:rgba(0,0,0,.72);border-radius:6px;pointer-events:none;white-space:pre';
  document.body.appendChild(el);
  let n = 0, t0 = performance.now(), wsum = 0, wmax = 0, h0 = 0, m0 = 0;
  perfHud = (now, work) => {
    n++; wsum += work; wmax = Math.max(wmax, work);
    if (now - t0 < 1000) return;
    const p = fxPerf();
    const hits = bakeStats.hit + animalBakeStats.hit, miss = bakeStats.miss + animalBakeStats.miss;
    const mb = (bakeBytes() + animalBakeBytes()) / 1048576;
    const c = document.getElementById('game');
    el.textContent =
      `fps ${(n * 1000 / (now - t0)).toFixed(0)}  work ${(wsum / n).toFixed(1)}ms (max ${wmax.toFixed(1)})\n` +
      `tier ${p.tier}${document.documentElement.classList.contains('pq-ios') ? ' (iOS)' : ''}  particles ${p.particles}\n` +
      `cache ${mb.toFixed(1)}MB  miss ${((miss - m0) / n).toFixed(2)}/f  hit ${hits - h0 + miss - m0 ? Math.round(100 * (hits - h0) / (hits - h0 + miss - m0)) : 100}%\n` +
      `canvas ${c.width}x${c.height}  dpr ${devicePixelRatio}  ${innerWidth}x${innerHeight}\n` + breakdown(n);
    n = 0; wsum = 0; wmax = 0; t0 = now; h0 = hits; m0 = miss;
  };
}

// A/B toggles for device testing
if (RES !== 1) {
  canvas.width = Math.round(canvas.width * RES);
  canvas.height = Math.round(canvas.height * RES);
}
if (NO_HUD) {
  const st = document.createElement('style');
  st.textContent = '#hud,#nl-badge-frame{display:none!important}';
  document.head.appendChild(st);
}
