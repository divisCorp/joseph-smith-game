/**
 * HTML overlay menus — sharp system fonts over the pixel canvas.
 * Show/hide synced from game state; Start buttons feed the same input map.
 */
import { STATES } from './constants.js';
import { setAction } from './input.js';

const SCREENS = {
  [STATES.TITLE]: 'ui-title',
  [STATES.PAUSED]: 'ui-pause',
  [STATES.WIN]: 'ui-win',
  [STATES.LOSE]: 'ui-lose',
};

let lastState = null;
let startHeld = false;

function releaseStart() {
  if (!startHeld) return;
  startHeld = false;
  setAction('start', false);
}

function holdStart() {
  startHeld = true;
  setAction('start', true);
}

function bindStartTarget(el) {
  if (!el) return;
  const down = (e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      el.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    holdStart();
    el.classList?.add('is-active');
  };
  const up = (e) => {
    e.preventDefault();
    e.stopPropagation();
    releaseStart();
    el.classList?.remove('is-active');
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', () => {
    releaseStart();
    el.classList?.remove('is-active');
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function initOverlays() {
  // Title: tap anywhere on the overlay (or the Start button) to begin
  bindStartTarget(document.getElementById('ui-title'));
  document.querySelectorAll('[data-ui-start]').forEach(bindStartTarget);

  // Win/lose panels: tap empty dim area or Continue / Try Again
  bindStartTarget(document.getElementById('ui-win'));
  bindStartTarget(document.getElementById('ui-lose'));
}

function setVisible(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  if (show) el.removeAttribute('hidden');
  else el.setAttribute('hidden', '');
}

export function syncOverlays(game) {
  const state = game.state;

  if (state !== lastState) {
    for (const id of Object.values(SCREENS)) setVisible(id, false);
    const showId = SCREENS[state];
    if (showId) setVisible(showId, true);
    lastState = state;
    // Drop any held start when leaving a menu that used it
    if (state === STATES.PLAYING || state === STATES.PAUSED) releaseStart();
  }

  // Score on win/lose
  if (state === STATES.WIN || state === STATES.LOSE) {
    const root = document.getElementById(SCREENS[state]);
    root?.querySelectorAll('[data-ui-score]').forEach((n) => {
      n.textContent = `Score: ${game.score}`;
    });
  }

  // Soft blink on prompts (HTML opacity — still crisp)
  const blink = Math.floor(game.titleBlink / 30) % 2 === 0;
  const activeId = SCREENS[state];
  if (activeId) {
    document.getElementById(activeId)?.querySelectorAll('[data-ui-blink]').forEach((n) => {
      n.classList.toggle('is-dim', !blink);
    });
  }
}
