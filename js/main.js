/**
 * Joseph Smith — Palmyra Quest
 * HD illustrated 1080×480 canvas, scaled via CSS.
 * Title / pause / win / lose use HTML overlays for sharp phone text.
 */
import { STATES } from './constants.js?v=68';
import { createGame, updateGame, drawGame, titleTapBegins } from './game.js?v=68';
import { initVirtualControls, setAction } from './input.js?v=68';
import { initOverlays, syncOverlays } from './ui.js?v=68';
import { preloadSprites } from './sprites.js?v=68';
import { unlockAudio, toggleMute, bindMuteButton } from './audio.js?v=68';
import { justPressed, pollGamepads, onGamepadChange } from './input.js?v=68';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;

initVirtualControls();
bindMuteButton();

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    !!window.navigator.standalone
  );
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

async function enterArcade() {
  if (isStandalone()) return;
  const root = document.documentElement;
  try {
    if (!document.fullscreenElement && root.requestFullscreen) {
      await root.requestFullscreen({ navigationUI: 'hide' });
    } else if (!document.fullscreenElement) {
      const req = root.webkitRequestFullscreen;
      if (req) await req.call(root);
    }
  } catch (_) {
    /* iOS Safari blocks this; Home Screen is the no-toolbar path */
  }
  try {
    if (screen.orientation?.lock) await screen.orientation.lock('landscape');
  } catch (_) {
    /* lock only works after fullscreen on some browsers */
  }
}

if (isIos() && !isStandalone()) {
  document.documentElement.classList.add('needs-install');
}

function armAudio() {
  unlockAudio();
  enterArcade();
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
  acc += now - last;
  last = now;
  // catch-up capped
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    updateGame(game, 1); // dt in frames @ 60fps
    acc -= STEP;
    steps++;
  }
  drawGame(ctx, game);
  syncOverlays(game);
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
