/** Keyboard + virtual (touch) input — arrows/WASD + ↓/S crouch, Space/Z attack, Enter start */
const keys = Object.create(null);

const map = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'up',
  KeyS: 'down',
  Space: 'attack',
  KeyZ: 'attack',
  Enter: 'start',
  KeyP: 'pause',
};

window.addEventListener('keydown', (e) => {
  const a = map[e.code];
  if (!a) return;
  e.preventDefault();
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
}

/** Shared path for keyboard and virtual controls */
export function setAction(action, down) {
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
 * Stick UP = jump, Stick DOWN = crouch. A remains a secondary jump button.
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
    if (t && t.closest && t.closest('a, button, [data-ui-share], [data-ui-start], .ui-share-btn, .ui-start-btn, .ui-panel')) {
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
