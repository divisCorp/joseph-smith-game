/**
 * HTML overlay menus — sharp system fonts over the pixel canvas.
 * Show/hide synced from game state; Start buttons feed the same input map.
 */
import { STATES, LEVEL_META, MAX_LEVEL } from './constants.js?v=78';
import { setAction, getBindings, keyName, bindText, ACTIONS, ACTION_LABELS, onBindingsChange } from './input.js?v=78';
import { unlockAudio, syncMuteButton } from './audio.js?v=78';
import { unlockedChapter, bestScore, isEasy, reduceFlash, chapterRecord, journalUnlocked } from './save.js?v=78';
import { JOURNAL } from './journal.js?v=78';
import { toggleFullscreen, initFullscreen } from './fullscreen.js?v=78';
import { titleOptions, titleTapBegins, titleSettingsOpen, PAUSE_OPTIONS } from './game.js?v=78';

const SCREENS = {
  [STATES.TITLE]: 'ui-title',
  [STATES.CHAPTERS]: 'ui-chapters',
  [STATES.INTRO]: 'ui-intro',
  [STATES.PAUSED]: 'ui-pause',
  [STATES.CLEAR]: 'ui-clear',
  [STATES.WIN]: 'ui-win',
  [STATES.LOSE]: 'ui-lose',
  [STATES.JOURNAL]: 'ui-journal',
  [STATES.CONTROLS]: 'ui-controls',
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
      // keyboard and pad menus are driven by the game's own selection: drop DOM focus so
      // a later Enter / Space cannot also "click" whichever button the mouse last touched
      if (e.detail > 0) el.blur();
      if (el.dataset.uiCmd === 'fullscreen') {
        // must run inside the tap itself (user activation) for the Fullscreen API
        const r = toggleFullscreen();
        if (r === 'help' && gameRef?.state === STATES.PLAYING) sendCmd('pause');
        return;
      }
      sendCmd(el.dataset.uiCmd);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });
}

export function initOverlays(game) {
  gameRef = game;
  bindCmdButtons();
  // tap on the dimmed backdrop (outside the panel) closes the popup
  [['ui-journal', 'journal-close'], ['ui-pause', 'resume'], ['ui-controls', 'controls-back'], ['ui-chapters', 'back']].forEach(([id, cmd]) => {
    const root = document.getElementById(id);
    if (!root) return;
    let down = false;
    root.addEventListener('pointerdown', (e) => { down = e.target === root; });
    // pointerup, not click: the touch blocker cancels touchstart here, which drops the click
    root.addEventListener('pointerup', (e) => {
      if (e.target !== root || !down) return;
      down = false;
      if (id === 'ui-controls' && gameRef?.ctlListen) return; // waiting for a key: ignore
      e.preventDefault();
      e.stopPropagation();
      sendCmd(cmd);
    });
  });
  document.querySelectorAll('[data-ui-bind]').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      unlockAudio();
    });
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.blur();
      sendCmd(`bind:${el.dataset.uiBind}`);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  syncKeyHints();
  onBindingsChange(syncKeyHints);
  initFullscreen();
  game.onFullscreen = () => {
    const r = toggleFullscreen();
    if (r === 'help' && game.state === STATES.PLAYING) sendCmd('pause');
  };
  // Title: tapping the scene starts only when there is a single choice (no save yet)
  document.getElementById('ui-title')?.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    if (e.target?.closest?.('button, a')) return;
    unlockAudio();
    if (titleTapBegins()) sendCmd('begin');
  });
  document.querySelector('[data-pqt-settings]')?.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (e.target === e.currentTarget) sendCmd('settings-close');
  });
  document.getElementById('ui-intro')?.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    unlockAudio();
    sendCmd('skip');
  });
  document.querySelectorAll('[data-ui-start]').forEach(bindStartTarget);
  // Whole-screen dismiss for win/clear (START keys + touch START still work via input map)
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
    document.body.dataset.state = state; // CSS hides the touch pad outside of play
    if (state !== STATES.INTRO) introSig = '';
    if (state !== STATES.TITLE) titleSig = '';
    // the full title intro plays once; coming back from a menu uses a quick fade
    const tEl = document.getElementById('ui-title');
    if (tEl && state !== STATES.TITLE && tEl.dataset.seen) tEl.classList.add('pqt-quick');
    if (tEl && state === STATES.TITLE) tEl.dataset.seen = '1';
    if (state === STATES.WIN) {
      // Restart the credits roll from the bottom
      const roll = document.querySelector('[data-ui-credits-roll]');
      if (roll) {
        roll.classList.remove('is-rolling');
        sizeCreditsRoll(roll);
        void roll.offsetWidth;
        roll.classList.add('is-rolling');
      }
    }
    if (state === STATES.PLAYING || state === STATES.PAUSED) releaseStart();
  }

  syncOptionLabels();
  if (state === STATES.TITLE) syncTitle(game);
  if (state === STATES.CHAPTERS) syncChapters(game);
  if (state === STATES.INTRO) syncIntro(game);
  if (state === STATES.PAUSED) syncPause(game);
  if (state === STATES.JOURNAL) syncJournal(game);
  if (state === STATES.CONTROLS) syncControls(game);

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
    syncResults(root, game);
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
      root?.querySelectorAll('[data-ui-best-final]').forEach((n) => {
        n.textContent = `Best: ${bestScore()}`;
      });
      root?.querySelectorAll('[data-ui-final-stars]').forEach((n) => {
        const r = game.result;
        n.textContent = r ? `Carthage ${starText(r.stars)} · Pages ${r.pages}/3` : '';
      });
    }
    if (state === STATES.LOSE) {
      root?.querySelectorAll('[data-ui-retry-label]').forEach((n) => {
        const cp = game.checkpointIdx >= 0;
        n.textContent = cp ? 'Retry from Checkpoint' : 'Retry Chapter';
        n.setAttribute('aria-label', cp ? 'Retry from the last checkpoint' : 'Retry this chapter');
      });
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
      const prev = Number(hearts.dataset.hp ?? hp);
      hearts.dataset.sig = `${n}:${hp}`;
      hearts.dataset.hp = String(hp);
      hearts.innerHTML = html;
      // pop the heart that just changed (lost or restored)
      const idx = hp < prev ? hp : hp > prev ? hp - 1 : -1;
      const el = idx >= 0 ? hearts.children[idx] : null;
      if (el && !reduceFlash()) el.classList.add(hp < prev ? 'is-lost' : 'is-gained');
    }
  }
  const chap = hud.querySelector('[data-hud-chapter]');
  const chapText = `${game.levelNum}/${MAX_LEVEL}`;
  if (chap && chap.textContent !== chapText) chap.textContent = chapText; // no per-frame DOM write
  const score = hud.querySelector('[data-hud-score]');
  if (score) {
    // tick the shown score up toward the real one (instant on Reduce flashing)
    const target = game.score || 0;
    let shown = hudScoreShown;
    if (shown > target || reduceFlash()) shown = target;
    else if (shown < target) shown = Math.min(target, shown + Math.max(1, Math.ceil((target - shown) * 0.18)));
    if (shown !== hudScoreShown || score.dataset.v !== String(shown)) {
      score.textContent = String(shown).padStart(6, '0');
      score.dataset.v = String(shown);
      score.classList.toggle('is-ticking', shown < target);
    }
    hudScoreShown = shown;
  }
}
let hudScoreShown = 0;

let titleSig = '';
function syncTitle(game) {
  const opts = titleOptions();
  const n = unlockedChapter();
  const best = bestScore();
  const open = titleSettingsOpen();
  const sig = `${opts.join(',')}:${n}:${best}:${game.titleSel}:${open}`;
  if (sig === titleSig) return;
  titleSig = sig;
  const root = document.getElementById('ui-title');
  const hasSave = n > 1;
  root?.classList.toggle('has-save', hasSave);
  const sheet = root?.querySelector('[data-pqt-settings]');
  if (sheet && sheet.hidden === open) {
    sheet.hidden = !open;
    root.classList.toggle('settings-open', open);
  }
  const cont = document.querySelector('[data-ui-cmd="continue"]');
  if (cont) {
    cont.hidden = !hasSave;
    const name = LEVEL_META[n]?.name || '';
    cont.innerHTML = `Continue <small>Chapter ${n}${name ? ` · ${name}` : ''}</small>`;
    cont.setAttribute('aria-label', `Continue from chapter ${n}`);
  }
  const sel = opts[game.titleSel] || opts[0];
  // keyboard / gamepad highlight: only the menu (or the open Settings sheet), and only
  // after the player has actually used the keys (mouse and touch users get hover / press)
  const scope = open ? '#ui-title .pqt-sheet [data-ui-cmd]' : '#ui-title .pqt-menu [data-ui-cmd]';
  document.querySelectorAll('#ui-title [data-ui-cmd]').forEach((el) => el.classList.remove('is-selected'));
  document.querySelectorAll(scope).forEach((el) => {
    if (el.dataset.uiCmd !== sel) return;
    if (el.dataset.uiCmd === 'begin' && el.classList.contains('pqt-new') !== hasSave) return;
    el.classList.add('is-selected');
  });
  const bestEl = document.querySelector('[data-ui-best]');
  if (bestEl) {
    bestEl.hidden = best <= 0;
    bestEl.innerHTML = `<span>Best</span> ${best.toLocaleString('en-US')}`;
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

const PAD_TEXT = { jump: 'A', attack: 'B or X', left: 'D-pad ◀ / stick', right: 'D-pad ▶ / stick', up: 'D-pad ▲', down: 'D-pad ▼', pause: 'Start' };
const TOUCH_TEXT = { jump: 'A button', attack: 'B button', left: 'Stick ◀', right: 'Stick ▶', up: 'Stick ▲', down: 'Stick ▼', pause: 'II button' };
let ctlSig = '';
function syncControls(game) {
  const b = getBindings();
  const sig = JSON.stringify([b, game.ctlSel, game.ctlListen, game.ctlMsg, game.ctlFlashT > 0 ? game.ctlFlash : '']);
  if (sig === ctlSig) return;
  ctlSig = sig;
  const root = document.getElementById('ui-controls');
  if (!root) return;
  ACTIONS.forEach((a, r) => {
    const row = root.querySelector(`[data-ui-ctl-row="${a}"]`);
    if (!row) return;
    row.querySelector('[data-ui-ctl-name]').textContent = ACTION_LABELS[a];
    row.querySelector('[data-ui-ctl-pad]').textContent = PAD_TEXT[a];
    row.querySelector('[data-ui-ctl-touch]').textContent = TOUCH_TEXT[a];
    for (let i = 0; i < 2; i++) {
      const btn = row.querySelector(`[data-ui-bind="${a}:${i}"]`);
      const code = b[a][i];
      const listening = game.ctlListen === `${a}:${i}`;
      btn.textContent = listening ? 'Press a key…' : code ? keyName(code) : '+ add';
      btn.classList.toggle('is-empty', !code && !listening);
      btn.classList.toggle('is-arrow', !listening && /^Arrow/.test(code || ''));
      btn.classList.toggle('is-listening', listening);
      btn.classList.toggle('is-selected', game.ctlSel === r * 2 + i);
      btn.classList.toggle('is-flash', game.ctlFlashT > 0 && game.ctlFlash === `${a}:${i}`);
      btn.setAttribute('aria-label', `${ACTION_LABELS[a]} ${i ? 'alternate' : 'main'} key: ${code ? keyName(code) : 'none'}. Activate to change.`);
    }
  });
  const n = ACTIONS.length * 2;
  root.querySelector('.ui-ctl-reset')?.classList.toggle('is-selected', game.ctlSel === n);
  root.querySelector('.ui-ctl-back')?.classList.toggle('is-selected', game.ctlSel === n + 1);
  const msg = root.querySelector('[data-ui-ctl-msg]');
  if (msg) msg.textContent = game.ctlMsg || 'Click a key to change it · Enter confirms menus · M mutes';
}

/** Key hints elsewhere follow the current bindings. */
function syncKeyHints() {
  const hint = document.querySelector('[data-ui-key-hint]');
  if (hint) {
    hint.textContent = `Move ${bindText('left')} · ${bindText('right')} · Jump ${bindText('jump')} · Attack ${bindText('attack')} · Kneel ${bindText('down')} · Look up ${bindText('up')} · Pause ${bindText('pause')} · Mute M · Gamepad: A jump, B / X attack`;
  }
  const ph = document.querySelector('[data-ui-pause-hint]');
  if (ph) ph.textContent = `${bindText('pause')} to resume · ↑ ↓ + Enter to choose`;
  ctlSig = '';
}

let journalSig = '';
function syncJournal(game) {
  const n = game.journalN || game.levelNum || 1;
  const sig = `${n}:${game.journalFrom}`;
  if (sig === journalSig && game.stateT > 2) return;
  journalSig = sig;
  const e = JOURNAL[n];
  const root = document.getElementById('ui-journal');
  if (!root || !e) return;
  root.querySelector('[data-ui-journal-kicker]').textContent = `Journal · Chapter ${n}`;
  root.querySelector('[data-ui-journal-title]').textContent = e.title;
  root.querySelector('[data-ui-journal-place]').textContent = e.place || '';
  root.querySelector('[data-ui-journal-body]').textContent = e.body;
  const tip = root.querySelector('[data-ui-journal-tip]');
  tip.hidden = !e.tip;
  tip.textContent = e.tip || '';
  const btn = root.querySelector('[data-ui-cmd="journal-close"]');
  if (btn) btn.textContent = game.journalFrom === 'chapters' ? 'Back to Chapters' : 'Continue';
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

// ── Round 3: options, chapter select, results card ─────────
function starText(n) {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));
}

function fmtTime(frames) {
  const sec = Math.max(0, Math.round(frames / 60));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

let optSig = '';
function syncOptionLabels() {
  const sig = `${isEasy()}:${reduceFlash()}`;
  if (sig === optSig) return;
  optSig = sig;
  document.querySelectorAll('[data-ui-diff-label]').forEach((n) => {
    if (n.classList.contains('pqt-row')) n.innerHTML = `<span>Difficulty</span><b>${isEasy() ? 'Easy' : 'Normal'}</b>`;
    else n.textContent = `Difficulty: ${isEasy() ? 'Easy' : 'Normal'}`;
    n.setAttribute('aria-label', `Difficulty ${isEasy() ? 'Easy' : 'Normal'}, tap to change`);
    n.classList.toggle('is-on', isEasy());
  });
  document.querySelectorAll('[data-ui-flash-label]').forEach((n) => {
    if (n.classList.contains('pqt-row')) n.innerHTML = `<span>Reduce flashing</span><b>${reduceFlash() ? 'On' : 'Off'}</b>`;
    else n.textContent = `Reduce flashing: ${reduceFlash() ? 'On' : 'Off'}`;
    n.setAttribute('aria-pressed', reduceFlash() ? 'true' : 'false');
    n.classList.toggle('is-on', reduceFlash());
  });
}

let chapSig = '';
function syncChapters(game) {
  const n = unlockedChapter();
  const recs = [];
  for (let i = 1; i <= MAX_LEVEL; i++) recs.push(chapterRecord(i));
  const sig = `${n}:${game.chapterSel}:${JSON.stringify(recs)}`;
  if (sig === chapSig) return;
  chapSig = sig;
  let totalStars = 0;
  let totalPages = 0;
  document.querySelectorAll('[data-ui-chapter]').forEach((el) => {
    const i = Number(el.dataset.uiChapter);
    const rec = recs[i - 1];
    const locked = i > n;
    const pages = [0, 1, 2].filter((k) => rec.pages & (1 << k)).length;
    totalStars += rec.stars;
    totalPages += pages;
    el.disabled = locked;
    el.classList.toggle('is-locked', locked);
    el.classList.toggle('is-selected', !locked && game.chapterSel === i - 1);
    el.querySelector('[data-ui-chapter-name]').textContent = locked ? 'Locked' : LEVEL_META[i]?.name || '';
    el.querySelector('[data-ui-chapter-stars]').textContent = locked ? '' : starText(rec.stars);
    el.querySelector('[data-ui-chapter-pages]').textContent = locked ? '' : `Pages ${pages}/3${rec.time ? ` · ${fmtTime(rec.time)}` : ''}`;
    el.setAttribute('aria-label', locked ? `Chapter ${i} locked` : `Chapter ${i} ${LEVEL_META[i]?.name}, best ${rec.stars} of 3 stars, ${pages} of 3 pages`);
  });
  let anyJournal = false;
  document.querySelectorAll('[data-ui-journal-btn]').forEach((el) => {
    const i = Number(el.dataset.uiJournalBtn);
    const open = journalUnlocked(i);
    anyJournal = anyJournal || open;
    el.disabled = !open;
    el.title = open ? `${JOURNAL[i]?.title || ''}` : 'Find all 3 journal pages in this chapter';
    el.setAttribute('aria-label', open ? `Read journal entry ${i}: ${JOURNAL[i]?.title || ''}` : `Journal entry ${i} locked`);
  });
  const hint = document.querySelector('[data-ui-journal-hint]');
  if (hint) hint.hidden = anyJournal;
  const sum = document.querySelector('[data-ui-chapters-sum]');
  if (sum) sum.textContent = `${totalStars} / ${MAX_LEVEL * 3} stars · ${totalPages} / ${MAX_LEVEL * 3} journal pages`;
}

function syncResults(root, game) {
  const r = game.result;
  if (!root || !r) return;
  const stars = root.querySelectorAll('.ui-star');
  stars.forEach((el, i) => {
    el.classList.toggle('is-lit', i < r.shown);
  });
  const sig = `${r.chapter}:${r.time}:${r.pages}:${r.heartsLost}:${r.shown}`;
  if (root.dataset.resSig === sig) return;
  root.dataset.resSig = sig;
  const ok = (b) => (b ? '✓' : '·');
  const set = (k, text, good) => {
    const li = root.querySelector(`[data-ui-res="${k}"]`);
    if (!li) return;
    li.textContent = `${ok(good)} ${text}`;
    li.classList.toggle('is-met', !!good);
  };
  set('time', `Time ${fmtTime(r.time)} (par ${fmtTime(r.par * 60)})`, r.timeOk);
  set('hearts', `Hearts lost ${r.heartsLost} (1 or fewer)`, r.heartsOk);
  set('pages', `Journal pages ${r.pages}/3`, r.pagesOk);
  const best = root.querySelector('[data-ui-res-best]');
  if (best) best.textContent = r.improved ? '· New best stars!' : `· Best ${starText(r.bestStars)}`;
  const st = root.querySelector('[data-ui-stars]');
  if (st) st.setAttribute('aria-label', `${r.stars} of 3 stars${r.easy ? ' on Easy' : ''}`);
}

/**
 * The roll starts below the view and stops with its last lines ("Thank you
 * for playing") resting just above the middle, so nothing ends up hidden
 * behind the score/Share footer on short screens. Speed stays ~34 px/s.
 */
function sizeCreditsRoll(roll) {
  const view = roll.parentElement;
  if (!view) return;
  const vh = view.clientHeight || 240;
  const rh = roll.scrollHeight || 800;
  const from = Math.round(vh * 0.92);
  const end = Math.round(Math.min(0, vh * 0.5 - rh));
  const dur = Math.max(12, Math.min(60, (from - end) / 34));
  roll.style.setProperty('--pq-roll-from', `${from}px`);
  roll.style.setProperty('--pq-roll-end', `${end}px`);
  roll.style.setProperty('--pq-roll-dur', `${dur.toFixed(1)}s`);
}
