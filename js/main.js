/**
 * Joseph Smith — Palmyra Quest
 * NES-like fixed 256×240 canvas, scaled via CSS.
 */
import { W, H } from './constants.js';
import { createGame, updateGame, drawGame } from './game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const game = createGame();

let last = performance.now();
const STEP = 1000 / 60; // fixed-ish timestep ms
let acc = 0;

function frame(now) {
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
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// prevent space scroll
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
});
