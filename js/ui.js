/**
 * HTML overlay menus — sharp system fonts over the pixel canvas.
 * Show/hide synced from game state; Start buttons feed the same input map.
 */
import { STATES, LEVEL_META, MAX_LEVEL } from './constants.js';
import { setAction } from './input.js';

const SCREENS = {
  [STATES.TITLE]: 'ui-title',
  [STATES.PAUSED]: 'ui-pause',
  [STATES.CLEAR]: 'ui-clear',
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
  bindStartTarget(document.getElementById('ui-title'));
  document.querySelectorAll('[data-ui-start]').forEach(bindStartTarget);
  bindStartTarget(document.getElementById('ui-win'));
  bindStartTarget(document.getElementById('ui-lose'));
  bindStartTarget(document.getElementById('ui-clear'));
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
    if (state === STATES.PLAYING || state === STATES.PAUSED) releaseStart();
  }

  // Title: campaign blurb
  if (state === STATES.TITLE) {
    const title = document.getElementById('ui-title');
    const levelLine = title?.querySelector('.ui-level');
    if (levelLine) {
      levelLine.textContent = `5 Levels · Palmyra Quest`;
    }
    const card = title?.querySelector('.ui-card');
    if (card) {
      card.innerHTML = `
        <p>A frontier adventure near Palmyra.</p>
        <p>Clear each path. Face every trial.</p>
        <p class="ui-muted">Family-friendly arcade campaign.</p>
      `;
    }
  }

  // Level-clear intermission
  if (state === STATES.CLEAR) {
    const root = document.getElementById('ui-clear');
    const meta = LEVEL_META[game.levelNum];
    const next = LEVEL_META[game.levelNum + 1];
    root?.querySelectorAll('[data-ui-clear-title]').forEach((n) => {
      n.textContent = meta ? `${meta.name} Cleared!` : 'Path Cleared!';
    });
    root?.querySelectorAll('[data-ui-clear-next]').forEach((n) => {
      n.textContent = meta?.clearNext || (next ? `Next: ${next.name}` : '');
    });
    root?.querySelectorAll('[data-ui-score]').forEach((n) => {
      n.textContent = `Score: ${game.score}`;
    });
  }

  if (state === STATES.WIN || state === STATES.LOSE) {
    const root = document.getElementById(SCREENS[state]);
    root?.querySelectorAll('[data-ui-score]').forEach((n) => {
      n.textContent = `Score: ${game.score}`;
    });
  }

  const blink = Math.floor(game.titleBlink / 30) % 2 === 0;
  const activeId = SCREENS[state];
  if (activeId) {
    document.getElementById(activeId)?.querySelectorAll('[data-ui-blink]').forEach((n) => {
      n.classList.toggle('is-dim', !blink);
    });
  }
}
