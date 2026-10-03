/**
 * Keyboard + virtual (touch) input.
 * Default keys follow the standard platformer layout: Space / Z jump, X / J attack,
 * arrows or WASD move (W / ↑ look up, S / ↓ kneel), Esc / P pause, Enter confirm, M mute.
 * Players can rebind every action on the Controls screen; bindings live in localStorage.
 */
const keys = Object.create(null);

export const ACTIONS = ['jump', 'attack', 'left', 'right', 'up', 'down', 'pause'];
export const ACTION_LABELS = {
  jump: 'Jump',
  attack: 'Attack / throw',
  left: 'Move left',
  right: 'Move right',
  up: 'Look up',
  down: 'Kneel / pray',
  pause: 'Pause',
};
export const DEFAULT_BINDS = {
  jump: ['Space', 'KeyZ'],
  attack: ['KeyX', 'KeyJ'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  pause: ['Escape', 'KeyP'],
};
/** Always-on keys that are not rebindable (confirm + mute). */
const FIXED = { Enter: 'start', NumpadEnter: 'start', KeyM: 'mute' };
/** Keys that can't be bound (they drive the browser / menus). */
const RESERVED = new Set(['Enter', 'NumpadEnter', 'Tab', 'MetaLeft', 'MetaRight', 'F5', 'F11', 'F12']);
const BIND_KEY = 'palmyraQuest.keys.v1';

let binds = loadBinds();
let map = buildMap();

function cloneDefaults() {
  const o = {};
  for (const a of ACTIONS) o[a] = DEFAULT_BINDS[a].slice();
  return o;
}

function loadBinds() {
  const o = cloneDefaults();
  try {
    const raw = JSON.parse(localStorage.getItem(BIND_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      const seen = new Set();
      for (const a of ACTIONS) {
        const list = Array.isArray(raw[a]) ? raw[a] : null;
        if (!list) continue;
        const clean = list
          .filter((c) => typeof c === 'string' && /^[A-Za-z0-9]{1,24}$/.test(c) && !RESERVED.has(c) && !seen.has(c))
          .slice(0, 2);
        clean.forEach((c) => seen.add(c));
        if (clean.length) o[a] = clean;
      }
    }
  } catch (_) {
    /* defaults */
  }
  return o;
}

function saveBinds() {
  try {
    localStorage.setItem(BIND_KEY, JSON.stringify(binds));
  } catch (_) {
    /* private mode: keep for this session */
  }
}

function buildMap() {
  const m = Object.create(null);
  for (const [code, a] of Object.entries(FIXED)) m[code] = a;
  for (const a of ACTIONS) for (const c of binds[a]) m[c] = a;
  return m;
}

const bindListeners = new Set();
export function onBindingsChange(fn) {
  bindListeners.add(fn);
}
function changed() {
  map = buildMap();
  saveBinds();
  clearAll();
  for (const fn of bindListeners) fn();
}

export function getBindings() {
  const o = {};
  for (const a of ACTIONS) o[a] = binds[a].slice();
  return o;
}

/**
 * Bind `code` to action slot (0 or 1). If another action already uses the key it is
 * moved here; an action left with no key gets this slot's old key (a swap), so every
 * action always keeps at least one key. Returns a short message for the UI.
 */
export function setBinding(action, slot, code) {
  if (!ACTIONS.includes(action) || !code) return { ok: false, msg: '' };
  if (RESERVED.has(code)) return { ok: false, msg: `${keyName(code)} is reserved` };
  const old = binds[action][slot] || null;
  let msg = `${ACTION_LABELS[action]}: ${keyName(code)}`;
  for (const a of ACTIONS) {
    const i = binds[a].indexOf(code);
    if (i < 0 || (a === action && i === slot)) continue;
    binds[a].splice(i, 1);
    if (a !== action) {
      if (!binds[a].length && old && old !== code) {
        binds[a].push(old);
        msg = `${keyName(code)} swapped: ${ACTION_LABELS[a]} is now ${keyName(old)}`;
      } else if (!binds[a].length) {
        binds[a] = DEFAULT_BINDS[a].filter((c) => !Object.values(binds).some((l) => l.includes(c)) && c !== code).slice(0, 1);
        msg = `${keyName(code)} moved from ${ACTION_LABELS[a]}`;
      } else {
        msg = `${keyName(code)} moved from ${ACTION_LABELS[a]}`;
      }
    }
  }
  const list = binds[action];
  if (slot >= list.length) list.push(code);
  else list[slot] = code;
  binds[action] = [...new Set(list)].slice(0, 2);
  changed();
  return { ok: true, msg };
}

/** Remove the second key of an action (the first can't be cleared). */
export function clearBinding(action, slot) {
  if (slot === 0 || !binds[action] || binds[action].length < 2) return;
  binds[action].splice(slot, 1);
  changed();
}

export function resetBindings() {
  binds = cloneDefaults();
  changed();
}

const NAMES = {
  Space: 'Space',
  Escape: 'Esc',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ShiftLeft: 'L-Shift',
  ShiftRight: 'R-Shift',
  ControlLeft: 'L-Ctrl',
  ControlRight: 'R-Ctrl',
  AltLeft: 'L-Alt',
  AltRight: 'R-Alt',
  Backspace: 'Backspace',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
  CapsLock: 'Caps',
};
export function keyName(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return 'Num ' + code.slice(6);
  return code;
}

/** "Space / Z" style text for tips and hints. */
export function bindText(action, sep = ' / ') {
  return (binds[action] || []).map(keyName).join(sep) || '—';
}

// ── Rebind capture: the next key press is handed to the Controls screen ──
let capture = null;
export function captureNextKey(fn) {
  capture = fn;
  clearAll();
}
export function cancelCapture() {
  capture = null;
}
export function isCapturing() {
  return !!capture;
}

/** Presses that happened between frames (a tap shorter than one frame still counts). */
const tapped = Object.create(null);

window.addEventListener('keydown', (e) => {
  if (capture) {
    if (e.repeat) return;
    e.preventDefault();
    e.stopPropagation();
    const fn = capture;
    capture = null;
    fn(e.code === 'Escape' ? null : e.code);
    return;
  }
  const a = map[e.code];
  if (!a) return;
  e.preventDefault();
  if (!keys[a] && !e.repeat) tapped[a] = true;
  keys[a] = true;
});

window.addEventListener('keyup', (e) => {
  const a = map[e.code];
  if (!a) return;
  e.preventDefault();
  keys[a] = false;
});

export function isDown(action) {
  return !!keys[action];
}

/** One-shot press: true once until released */
const pressed = Object.create(null);
export function justPressed(action) {
  if (tapped[action]) {
    tapped[action] = false;
    pressed[action] = !!keys[action];
    return true;
  }
  if (keys[action] && !pressed[action]) {
    pressed[action] = true;
    return true;
  }
  if (!keys[action]) pressed[action] = false;
  return false;
}

export function clearAll() {
  for (const k of Object.keys(keys)) keys[k] = false;
  for (const k of Object.keys(pressed)) pressed[k] = false;
  for (const k of Object.keys(tapped)) tapped[k] = false;
}

/** Shared path for keyboard and virtual controls */
export function setAction(action, down) {
  if (down && !keys[action]) tapped[action] = true;
  keys[action] = !!down;
  if (!down) pressed[action] = false;
}

function prefersTouchUi() {
  // iPhone Safari "Request Desktop Website" reports a wide viewport + fine pointer,
  // so coarse/hover/max-width media queries alone miss real touch hardware.
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
  if (typeof window !== 'undefined' && 'ontouchstart' in window) return true;
  if (window.matchMedia('(pointer: coarse)').matches) return true;
  if (window.matchMedia('(hover: none)').matches) return true;
  if (window.matchMedia('(max-width: 900px)').matches) return true;
  return false;
}

function bindVirtualButton(el) {
  const action = el.dataset.action;
  if (!action) return;

  const down = (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      el.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    setAction(action, true);
    el.classList.add('is-active');
  };

  const up = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setAction(action, false);
    el.classList.remove('is-active');
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', () => {
    setAction(action, false);
    el.classList.remove('is-active');
  });

  // Avoid long-press context menu / text selection on controls
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

/**
 * Circular virtual stick (left thumb zone).
 * Continuous pointer drag maps to left/right/up/down via axis thresholds
 * (8-way capable: diagonals hold two actions). Release clears all directions.
 * Stick UP = look up, Stick DOWN = crouch. A = jump.
 */
function bindVirtualStick(root) {
  const stick = root.querySelector('#touch-stick');
  const knob = root.querySelector('#touch-stick-knob');
  if (!stick || !knob) return;

  const DIRS = ['left', 'right', 'up', 'down'];
  /** Fraction of stick radius before a direction engages */
  const DEAD = 0.28;
  /** Knob travel as fraction of base radius */
  const MAX_TRAVEL = 0.42;

  let activePointer = null;

  const clearDirs = () => {
    for (const d of DIRS) setAction(d, false);
    stick.classList.remove('is-active', 'dir-left', 'dir-right', 'dir-up', 'dir-down');
    knob.style.transform = 'translate(-50%, -50%)';
  };

  const applyVector = (dx, dy, radius) => {
    const dist = Math.hypot(dx, dy);
    const maxPx = radius * MAX_TRAVEL;
    let nx = 0;
    let ny = 0;
    if (dist > 0.001) {
      const clamped = Math.min(dist, maxPx);
      nx = (dx / dist) * clamped;
      ny = (dy / dist) * clamped;
    }
    knob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;

    const deadPx = radius * DEAD;
    const left = dx < -deadPx;
    const right = dx > deadPx;
    const up = dy < -deadPx;
    const down = dy > deadPx;

    setAction('left', left);
    setAction('right', right);
    setAction('up', up);
    setAction('down', down);

    stick.classList.toggle('is-active', left || right || up || down);
    stick.classList.toggle('dir-left', left);
    stick.classList.toggle('dir-right', right);
    stick.classList.toggle('dir-up', up);
    stick.classList.toggle('dir-down', down);
  };

  const centerAndRadius = () => {
    const rect = stick.getBoundingClientRect();
    return {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      radius: Math.min(rect.width, rect.height) / 2,
    };
  };

  const onDown = (e) => {
    if (activePointer != null) return;
    e.preventDefault();
    e.stopPropagation();
    activePointer = e.pointerId;
    try {
      stick.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    const { cx, cy, radius } = centerAndRadius();
    applyVector(e.clientX - cx, e.clientY - cy, radius);
  };

  const onMove = (e) => {
    if (e.pointerId !== activePointer) return;
    e.preventDefault();
    e.stopPropagation();
    const { cx, cy, radius } = centerAndRadius();
    applyVector(e.clientX - cx, e.clientY - cy, radius);
  };

  const onUp = (e) => {
    if (e.pointerId !== activePointer) return;
    e.preventDefault();
    e.stopPropagation();
    activePointer = null;
    clearDirs();
  };

  stick.addEventListener('pointerdown', onDown);
  stick.addEventListener('pointermove', onMove);
  stick.addEventListener('pointerup', onUp);
  stick.addEventListener('pointercancel', onUp);
  stick.addEventListener('lostpointercapture', () => {
    if (activePointer == null) return;
    activePointer = null;
    clearDirs();
  });
  stick.addEventListener('contextmenu', (e) => e.preventDefault());
}

/**
 * Wire #touch-controls buttons + virtual stick into the same action map as the keyboard.
 * Shows overlay when touch / coarse pointer / narrow viewport is likely.
 */
export function initVirtualControls() {
  const root = document.getElementById('touch-controls');
  const wrap = document.getElementById('game-wrap');
  if (!root) return;

  const syncVisibility = () => {
    const show = prefersTouchUi();
    document.body.classList.toggle('touch-ui', show);
    root.hidden = !show;
    root.setAttribute('aria-hidden', show ? 'false' : 'true');
  };

  syncVisibility();
  window.addEventListener('resize', syncVisibility);
  window.matchMedia('(pointer: coarse)').addEventListener('change', syncVisibility);
  window.matchMedia('(hover: none)').addEventListener('change', syncVisibility);
  window.matchMedia('(max-width: 900px)').addEventListener('change', syncVisibility);

  bindVirtualStick(root);
  root.querySelectorAll('[data-action]').forEach(bindVirtualButton);

  // Stop page scroll / zoom while touching the game chrome
  const blockScroll = (e) => {
    if (!document.body.classList.contains('touch-ui') && !document.documentElement.classList.contains('touch-ui')) return;
    const t = e.target;
    if (t && t.closest && t.closest('a, button, [data-ui-share], [data-ui-start], [data-ui-mute], .ui-share-btn, .ui-start-btn, .ui-panel, #mute-btn')) {
      // Allow real clicks on overlay controls (Share on X, etc.)
      return;
    }
    e.preventDefault();
  };
  const target = wrap || root;
  target.addEventListener('touchstart', blockScroll, { passive: false });
  target.addEventListener('touchmove', blockScroll, { passive: false });
  target.addEventListener('gesturestart', (e) => e.preventDefault());
}

// ── Gamepad (standard mapping) ─────────────────────────────
// D-pad or left stick moves · A jumps · B or X attacks · Start pauses / confirms.
// Pad presses go through setAction, so menus, latches and keyboard all agree.
const PAD_DEAD = 0.45;
const padHeld = Object.create(null);
let padCount = 0;
let padListener = null;

export function onGamepadChange(fn) {
  padListener = fn;
}

if (typeof window !== 'undefined') {
  window.addEventListener('gamepadconnected', (e) => {
    padCount++;
    padListener?.('connected', e.gamepad?.id || 'Gamepad');
  });
  window.addEventListener('gamepaddisconnected', () => {
    padCount = Math.max(0, padCount - 1);
    for (const a of Object.keys(padHeld)) if (padHeld[a]) setPad(a, false);
    padListener?.('disconnected', '');
  });
}

function setPad(action, down) {
  if (!!padHeld[action] === !!down) return;
  padHeld[action] = !!down;
  setAction(action, !!down);
}

function btn(gp, i) {
  const b = gp.buttons[i];
  return !!b && (b.pressed || b.value > 0.5);
}

export function gamepadActive() {
  return padCount > 0;
}

/** Read every connected pad once per frame and fold them into one action set. */
export function pollGamepads() {
  if (!padCount || typeof navigator === 'undefined' || !navigator.getGamepads) return;
  let pads;
  try {
    pads = navigator.getGamepads();
  } catch (_) {
    return;
  }
  const want = { left: false, right: false, up: false, down: false, jump: false, attack: false, start: false, pause: false };
  for (const gp of pads) {
    if (!gp || !gp.connected) continue;
    const ax = gp.axes[0] || 0;
    const ay = gp.axes[1] || 0;
    want.left ||= btn(gp, 14) || ax < -PAD_DEAD;
    want.right ||= btn(gp, 15) || ax > PAD_DEAD;
    want.up ||= btn(gp, 12) || ay < -PAD_DEAD - 0.15;
    want.down ||= btn(gp, 13) || ay > PAD_DEAD + 0.15;
    want.jump ||= btn(gp, 0);
    want.attack ||= btn(gp, 1) || btn(gp, 2);
    const start = btn(gp, 9);
    want.start ||= start;
    want.pause ||= start;
  }
  for (const a of Object.keys(want)) setPad(a, want[a]);
}
