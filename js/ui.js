/**
 * HTML overlay menus — sharp system fonts over the pixel canvas.
 * Show/hide synced from game state; Start buttons feed the same input map.
 */
import { STATES, LEVEL_META, MAX_LEVEL } from './constants.js';
import { setAction } from './input.js';
import { unlockAudio, syncMuteButton } from './audio.js';
import { unlockedChapter, bestScore } from './save.js';
import { titleOptions, PAUSE_OPTIONS } from './game.js';

const SCREENS = {
  [STATES.TITLE]: 'ui-title',
  [STATES.INTRO]: 'ui-intro',
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

let gameRef = null;

function sendCmd(cmd) {
  if (gameRef) gameRef.cmd = cmd;
}

/** Buttons with data-ui-cmd run one game command per tap / click. */
function bindCmdButtons() {
  document.querySelectorAll('[data-ui-cmd]').forEach((el) => {
    // Keep the press from reaching whole-screen "tap to start" handlers
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      unlockAudio();
      el.classList.add('is-active');
    });
    const off = () => el.classList.remove('is-active');
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      sendCmd(el.dataset.uiCmd);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });
}

export function initOverlays(game) {
  gameRef = game;
  bindCmdButtons();
  // Title: tapping the scene starts only when there is a single choice (no save yet)
  document.getElementById('ui-title')?.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    if (e.target?.closest?.('button, a')) return;
    unlockAudio();
    if (titleOptions().length === 1) sendCmd('begin');
  });
  document.getElementById('ui-intro')?.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    unlockAudio();
    sendCmd('skip');
  });
  document.querySelectorAll('[data-ui-start]').forEach(bindStartTarget);
  // Whole-screen dismiss for win/clear (START keys + touch START still work via input map)
  bindStartTarget(document.getElementById('ui-win'));
  bindStartTarget(document.getElementById('ui-clear'));
  bindShareLinks();
  // Leaving the tab / app mid-chapter pauses instead of letting enemies act
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) sendCmd('autopause');
  });
  window.addEventListener('blur', () => sendCmd('autopause'));
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
    if (state !== STATES.INTRO) introSig = '';
    if (state !== STATES.TITLE) titleSig = '';
    if (state === STATES.PLAYING || state === STATES.PAUSED) releaseStart();
  }

  if (state === STATES.TITLE) syncTitle(game);
  if (state === STATES.INTRO) syncIntro(game);
  if (state === STATES.PAUSED) syncPause(game);

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
      n.textContent = `Score: ${game.score}${game.newBest ? ' · New best!' : ''}`;
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

  syncHud(game);
  syncTip(game);

  const blink = Math.floor(game.titleBlink / 30) % 2 === 0;
  const activeId = SCREENS[state];
  if (activeId) {
    document.getElementById(activeId)?.querySelectorAll('[data-ui-blink]').forEach((n) => {
      n.classList.toggle('is-dim', !blink);
    });
  }
}

function syncHud(game) {
  const hud = document.getElementById('hud');
  if (!hud) return;
  const play = game.state === STATES.PLAYING || game.state === STATES.PAUSED;
  hud.classList.toggle('is-paused', game.state === STATES.PAUSED);
  hud.hidden = !play || !game.player;
  if (!play || !game.player) return;
  const hearts = hud.querySelector('[data-hud-hearts]');
  if (hearts) {
    const n = game.player.maxHp;
    const hp = game.player.hp;
    let html = '';
    for (let i = 0; i < n; i++) {
      html += `<span class="hud-heart${i < hp ? '' : ' is-empty'}" aria-hidden="true">♥</span>`;
    }
    if (hearts.dataset.sig !== `${n}:${hp}`) {
      hearts.dataset.sig = `${n}:${hp}`;
      hearts.innerHTML = html;
    }
  }
  const chap = hud.querySelector('[data-hud-chapter]');
  if (chap) chap.textContent = `${game.levelNum}/${MAX_LEVEL}`;
  const score = hud.querySelector('[data-hud-score]');
  if (score) score.textContent = String(game.score).padStart(6, '0');
}

let titleSig = '';
function syncTitle(game) {
  const opts = titleOptions();
  const n = unlockedChapter();
  const best = bestScore();
  const sig = `${opts.join(',')}:${n}:${best}:${game.titleSel}`;
  if (sig === titleSig) return;
  titleSig = sig;
  const cont = document.querySelector('[data-ui-cmd="continue"]');
  if (cont) {
    cont.hidden = opts.length < 2;
    const name = LEVEL_META[n]?.name || '';
    cont.innerHTML = `Continue <small>Chapter ${n}${name ? ` · ${name}` : ''}</small>`;
    cont.setAttribute('aria-label', `Continue from chapter ${n}`);
  }
  const sel = opts[game.titleSel] || opts[0];
  document.querySelectorAll('#ui-title [data-ui-cmd]').forEach((el) => {
    el.classList.toggle('is-selected', el.dataset.uiCmd === sel && opts.length > 1);
  });
  const bestEl = document.querySelector('[data-ui-best]');
  if (bestEl) {
    bestEl.hidden = best <= 0;
    bestEl.textContent = `Best score ${best}`;
  }
}

let introSig = '';
function syncIntro(game) {
  const n = game.levelNum;
  if (introSig === `${n}`) return;
  introSig = `${n}`;
  const meta = LEVEL_META[n] || {};
  const root = document.getElementById('ui-intro');
  if (!root) return;
  root.querySelector('[data-ui-intro-num]').textContent = `Chapter ${n} of ${MAX_LEVEL}`;
  root.querySelector('[data-ui-intro-title]').textContent = meta.name || '';
  root.querySelector('[data-ui-intro-story]').textContent = meta.story || meta.blurb || '';
  root.querySelector('[data-ui-intro-year]').textContent = [meta.place, meta.year].filter(Boolean).join(' · ');
  // Restart the CSS fade each time a card appears
  root.classList.remove('is-anim');
  void root.offsetWidth;
  root.classList.add('is-anim');
}

function syncPause(game) {
  const sel = PAUSE_OPTIONS[game.pauseSel] || PAUSE_OPTIONS[0];
  document.querySelectorAll('#ui-pause [data-ui-cmd]').forEach((el) => {
    el.classList.toggle('is-selected', el.dataset.uiCmd === sel);
  });
  const ch = document.querySelector('[data-ui-pause-chapter]');
  if (ch) ch.textContent = `Chapter ${game.levelNum} · ${LEVEL_META[game.levelNum]?.name || ''}`;
  syncMuteButton();
}

let tipSig = '';
function syncTip(game) {
  const el = document.getElementById('ui-tip');
  if (!el) return;
  const tip = game.state === STATES.PLAYING ? game.tip : null;
  const sig = tip ? tip.id : '';
  if (sig !== tipSig) {
    tipSig = sig;
    if (tip) el.textContent = tip.text;
  }
  const show = !!tip && tip.t < 290;
  el.classList.toggle('is-shown', show);
}
