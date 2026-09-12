/**
 * Joseph Smith — Palmyra Quest
 * HD illustrated 512×480 canvas, scaled via CSS.
 * Title / pause / win / lose use HTML overlays for sharp phone text.
 */
import { STATES } from './constants.js';
import { createGame, updateGame, drawGame } from './game.js';
import { initVirtualControls, setAction } from './input.js';
import { initOverlays, syncOverlays } from './ui.js';
import { preloadSprites } from './sprites.js';
import { unlockAudio, toggleMute } from './audio.js';
import { justPressed } from './input.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;

initVirtualControls();
initOverlays();

function armAudio() {
  unlockAudio();
}
window.addEventListener('pointerdown', armAudio, { once: false });
window.addEventListener('keydown', armAudio, { once: false });

const game = createGame();

/** Tap/click canvas to start / return to title when menus are up (phones + desktop). */
let canvasStartHeld = false;
function releaseCanvasStart() {
  if (!canvasStartHeld) return;
  canvasStartHeld = false;
  setAction('start', false);
}
canvas.addEventListener('pointerdown', (e) => {
  if (e.button != null && e.button !== 0) return;
  if (
    game.state !== STATES.TITLE &&
    game.state !== STATES.WIN &&
    game.state !== STATES.LOSE &&
    game.state !== STATES.CLEAR
  ) {
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

function frame(now) {
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
