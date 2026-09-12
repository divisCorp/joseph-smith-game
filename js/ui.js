/**
 * HTML overlay menus — sharp system fonts over the pixel canvas.
 * Show/hide synced from game state; Start buttons feed the same input map.
 */
import { STATES, LEVEL_META } from './constants.js';
import { setAction } from './input.js';
import { unlockAudio } from './audio.js';

const SCREENS = {
  [STATES.TITLE]: 'ui-title',
  [STATES.PAUSED]: 'ui-pause',
  [STATES.CLEAR]: 'ui-clear',
  [STATES.WIN]: 'ui-win',
  [STATES.LOSE]: 'ui-lose',
};

const PLAY_URL = 'https://palmyra-quest.netlify.app';

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
  unlockAudio();
}

function bindStartTarget(el) {
  if (!el) return;
  const down = (e) => {
    if (e.button != null && e.button !== 0) return;
    // Share (and other non-dismiss controls) must not trigger start/dismiss
    if (e.target?.closest?.('[data-ui-share]')) return;
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
    if (e.target?.closest?.('[data-ui-share]')) return;
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

function buildShareText(game) {
  const score = game.score ?? 0;
  const levelNum = game.levelNum ?? 1;
  const levelName = LEVEL_META[levelNum]?.name;
  const levelBit = levelName
    ? ` Reached Level ${levelNum} (${levelName}).`
    : ` Reached level ${levelNum}.`;
  return `I scored ${score} in Joseph Smith — Palmyra Quest!${levelBit} Play free: ${PLAY_URL}`;
}

function shareIntentUrl(game) {
  const text = buildShareText(game);
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

function openShare(el, game) {
  let href = el?.getAttribute?.('href') || '';
  if (!href || href === '#') {
    href = game ? shareIntentUrl(game) : '';
  }
  if (!href || href === '#') return false;
  el?.setAttribute?.('href', href);
  const win = window.open(href, '_blank', 'noopener,noreferrer');
  if (win) {
    try { win.opener = null; } catch (_) {}
    return true;
  }
  // Popup blocked (some in-app browsers): same-tab fallback
  window.location.href = href;
  return true;
}

let shareGame = null;
let shareLockUntil = 0;

function bindShareLinks() {
  document.querySelectorAll('[data-ui-share]').forEach((el) => {
    const blockDismiss = (e) => {
      e.stopPropagation();
    };
    el.addEventListener('pointerdown', blockDismiss, true);
    el.addEventListener('touchstart', (e) => {
      e.stopPropagation();
    }, { capture: true, passive: true });

    const go = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now < shareLockUntil) return; // debounce pointerup+click double fire
      shareLockUntil = now + 800;
      openShare(el, shareGame);
    };
    el.addEventListener('click', go);
    el.addEventListener('pointerup', (e) => {
      if (e.button != null && e.button !== 0) return;
      go(e);
    });
  });
}

export function initOverlays() {
  bindStartTarget(document.getElementById('ui-title'));
  document.querySelectorAll('[data-ui-start]').forEach(bindStartTarget);
  // Whole-screen dismiss for win/lose/clear (START keys + touch START still work via input map)
  bindStartTarget(document.getElementById('ui-win'));
  bindStartTarget(document.getElementById('ui-lose'));
  bindStartTarget(document.getElementById('ui-clear'));
  bindShareLinks();
}

function setVisible(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  if (show) el.removeAttribute('hidden');
  else el.setAttribute('hidden', '');
}

export function syncOverlays(game) {
  shareGame = game;
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
      levelLine.textContent = `7 Levels · The Prophet's Path`;
    }
    const card = title?.querySelector('.ui-card');
    if (card) {
      card.innerHTML = `
        <p>From a boy in the grove to Carthage.</p>
        <p>Pray in the grove. Find the plates later.</p>
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
      n.textContent = meta?.clearTitle
        ? `${meta.clearTitle}!`
        : meta
          ? `${meta.name} Cleared!`
          : 'Path Cleared!';
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
    const intent = shareIntentUrl(game);
    root?.querySelectorAll('[data-ui-share]').forEach((n) => {
      n.setAttribute('href', intent);
    });
    if (state === STATES.WIN) {
      const heading = root?.querySelector('.ui-heading');
      if (heading) heading.textContent = 'He sealed his testimony.';
      const bodies = root?.querySelectorAll('.ui-body');
      if (bodies?.[0]) bodies[0].textContent = 'Joseph stood firm through every trial.';
      const muted = root?.querySelector('.ui-muted');
      if (muted) muted.textContent = 'Carthage, 1844.';
    }
  }

  const blink = Math.floor(game.titleBlink / 30) % 2 === 0;
  const activeId = SCREENS[state];
  if (activeId) {
    document.getElementById(activeId)?.querySelectorAll('[data-ui-blink]').forEach((n) => {
      n.classList.toggle('is-dim', !blink);
    });
  }
}
