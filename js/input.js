/** Keyboard input — arrows/WASD + Space/Z attack, Enter start */
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
