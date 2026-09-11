/** Keyboard + virtual (touch) input — arrows/WASD + Space/Z attack, Enter start */
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
 * Wire #touch-controls buttons into the same action map as the keyboard.
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

  root.querySelectorAll('[data-action]').forEach(bindVirtualButton);

  // Stop page scroll / zoom while touching the game chrome
  const blockScroll = (e) => {
    if (!document.body.classList.contains('touch-ui')) return;
    e.preventDefault();
  };
  const target = wrap || root;
  target.addEventListener('touchstart', blockScroll, { passive: false });
  target.addEventListener('touchmove', blockScroll, { passive: false });
  target.addEventListener('gesturestart', (e) => e.preventDefault());
}
