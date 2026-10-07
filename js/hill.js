/**
 * Hill Cumorah (chapter 3): a large, natural, walkable hill instead of a platform.
 * The hill is a smooth height field (no tiles), so walking up it never snags:
 * player and foes snap to its surface (see `slopeFloor`). Art is painted once to
 * an offscreen canvas: earthy body, strata, buried rocks, grass cap and tufts,
 * a few trees, and the great stone near the top where the plates rest.
 */
import { TILE, W, SCALE } from './constants.js?v=72';

export function makeHill({ x0, xp, x1, base, top }) {
  const hill = { x0, xp, x1, base, top };
  hill.surf = (x) => {
    if (x <= x0 || x >= x1) return base;
    if (x >= xp) {
      // gentle crown, then a short shoulder down at the far end
      const k = (x - xp) / (x1 - xp);
      return top + Math.max(0, k - 0.82) * 40 + Math.sin(k * Math.PI * 3) * 2;
    }
    const t = (x - x0) / (xp - x0);
    // smoothstep with small natural undulations (never steeper than ~0.55)
    const s = t * t * (3 - 2 * t);
    const wob = Math.sin(t * Math.PI * 4) * 4 * Math.sin(t * Math.PI);
    return Math.round(base - (base - top) * s + wob);
  };
  return hill;
}

/** Floor height from hill height fields at x, or null when not over a hill. */
export function slopeFloor(slopes, x) {
  if (!slopes) return null;
  for (const sl of slopes) if (x > sl.x0 && x < sl.x1) return sl.surf(x);
  return null;
}

/**
 * Snap a falling/walking body onto any hill under its centre.
 * body: { x, y, w, h, vy, onGround } — `stick` keeps walkers glued when going downhill.
 */
export function landOnSlopes(body, slopes, stick) {
  if (!slopes) return;
  const cx = body.x + body.w / 2;
  const sy = slopeFloor(slopes, cx);
  if (sy == null) return;
  const feet = body.y + body.h;
  const below = feet - sy; // > 0 means inside the hill (it is solid all the way down)
  if (body.vy < 0 && below < 0) return;
  if (below >= 0 || (stick && -below <= 12)) {
    body.y = sy - body.h;
    body.vy = 0;
    body.onGround = true;
  }
}

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const PADT = 220; // canvas headroom above the summit (trees)
let cacheKey = '';
let cacheCv = null;

function renderHill(hill, drawTree) {
  const w = Math.ceil(hill.x1 - hill.x0);
  const h = Math.ceil(hill.base - hill.top) + PADT + 12; // bottom edge sits on the ground's dirt band
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  const oy = hill.top - PADT; // world y of canvas row 0
  const S = (x) => hill.surf(hill.x0 + x) - oy; // surface in canvas coords
  const R = (x, y, ww, hh, c) => {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), ww, hh);
  };

  // trees standing on the slope (drawn first: trunks are buried by the hill)
  const trees = [
    { x: 0.2, v: 1 },
    { x: 0.42, v: 2 },
    { x: 0.6, v: 0 },
  ];
  for (const t of trees) {
    const tx = t.x * w;
    drawTree(g, tx - 27, S(tx + 27) - 96, t.v, false);
  }
  // the great tree near the summit
  {
    const tx = w * 0.86;
    g.save();
    g.translate(tx, S(tx));
    g.scale(1.25, 1.25);
    drawTree(g, -27, -118, 0, true);
    g.restore();
  }

  // earthy body
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0; x <= w; x += 2) g.lineTo(x, S(x));
  g.lineTo(w, h);
  g.closePath();
  const grad = g.createLinearGradient(0, PADT, 0, h);
  grad.addColorStop(0, '#5e4c38');
  grad.addColorStop(0.55, '#54432f');
  grad.addColorStop(1, '#4a3a2a');
  g.fillStyle = grad;
  g.fill();
  g.save();
  g.clip();
  // strata following the surface
  for (const [d, c] of [
    [34, 'rgba(40,28,18,0.35)'],
    [70, 'rgba(110,90,60,0.18)'],
    [108, 'rgba(40,28,18,0.30)'],
    [150, 'rgba(110,90,60,0.14)'],
  ]) {
    for (let x = 0; x < w; x += 2) {
      const wob = Math.sin(x * 0.03 + d) * 4;
      R(x, S(x) + d + wob, 2, 3, c);
    }
  }
  // dirt specks and pebbles
  for (let i = 0; i < w * 0.5; i++) {
    const x = hash(i, 3) * w;
    const y = S(x) + 14 + hash(i, 5) * (h - S(x));
    const c = hash(i, 7) > 0.5 ? '#3e3022' : '#6e5a40';
    R(x, y, 2 + Math.floor(hash(i, 9) * 3) * 2, 2, c);
  }
  // roots near the surface
  for (let i = 0; i < 14; i++) {
    const x = hash(i, 11) * w;
    let y = S(x) + 12;
    for (let k = 0; k < 10; k++) R(x + k * 2, y + Math.sin(k * 0.7 + i) * 2 + k, 2, 2, 'rgba(70,50,30,0.8)');
    y++;
  }
  // buried rocks
  const rock = (cx, cy, rw, rh, seed) => {
    g.fillStyle = '#4a4a4c';
    g.beginPath();
    g.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#6a6a6a';
    g.beginPath();
    g.ellipse(cx - rw * 0.15, cy - rh * 0.2, rw * 0.8, rh * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#82807a';
    g.beginPath();
    g.ellipse(cx - rw * 0.3, cy - rh * 0.4, rw * 0.4, rh * 0.3, 0, 0, Math.PI * 2);
    g.fill();
    R(cx + rw * 0.2, cy - 2, 4, 2, '#3a3a3c');
    if (seed % 2) R(cx - rw * 0.5, cy + rh * 0.2, 6, 2, '#3a3a3c');
  };
  for (let i = 0; i < 16; i++) {
    const x = 20 + hash(i, 13) * (w - 40);
    const depth = 30 + hash(i, 17) * (h - S(x) - 40);
    const rw = 6 + Math.floor(hash(i, 19) * 5) * 2;
    rock(x, S(x) + depth, rw, rw * 0.6, i);
  }
  g.restore();

  // rocks breaking the surface (partly buried, drawn over the grass later)
  const surfRocks = [0.12, 0.33, 0.51, 0.7].map((k, i) => ({ x: k * w, rw: 10 + i * 2 }));

  // grass cap following the slope
  for (let x = 0; x < w; x += 2) {
    const y = S(x);
    R(x, y - 1, 2, 11, '#4a5a48');
    R(x, y - 1, 2, 3, '#5d7056');
    R(x, y + 9, 2, 3, '#33402f');
    if (hash(x, 23) > 0.55) R(x, y + 10, 2, 2 + Math.floor(hash(x, 29) * 3) * 2, '#3a4a36');
  }
  // tufts and wild grasses
  for (let i = 0; i < w / 9; i++) {
    const x = Math.round((hash(i, 31) * w) / 2) * 2;
    const y = S(x);
    const tall = 3 + Math.floor(hash(i, 37) * 4) * 2;
    R(x, y - tall, 2, tall, '#5a6e50');
    R(x + 2, y - tall + 3, 2, tall - 3, '#4a5e44');
    if (hash(i, 41) > 0.5) R(x - 2, y - tall + 4, 2, tall - 4, '#6a805c');
  }
  // a few pale wildflowers
  for (let i = 0; i < 18; i++) {
    const x = hash(i, 43) * w;
    const y = S(x);
    R(x, y - 6, 2, 5, '#4a5e44');
    R(x - 1, y - 8, 4, 3, hash(i, 47) > 0.5 ? '#d8d0b0' : '#b8a8d0');
  }
  for (const r of surfRocks) {
    rock(r.x, S(r.x) + 4, r.rw, r.rw * 0.55, 1);
    R(r.x - r.rw, S(r.x) - 2, 4, 4, '#5a6e50');
    R(r.x + r.rw - 2, S(r.x) - 3, 2, 5, '#4a5e44');
  }
  return cv;
}

/** The great stone near the summit: the plates rest at its foot. */
function drawGreatStone(ctx, x, y) {
  const R = (xx, yy, ww, hh, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(xx), Math.round(yy), ww, hh);
  };
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + 40, y + 2, 46, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4c4b4e';
  ctx.beginPath();
  ctx.moveTo(x - 4, y + 4);
  ctx.lineTo(x + 2, y - 30);
  ctx.quadraticCurveTo(x + 10, y - 50, x + 38, y - 52);
  ctx.quadraticCurveTo(x + 70, y - 50, x + 80, y - 30);
  ctx.lineTo(x + 86, y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#69686a';
  ctx.beginPath();
  ctx.moveTo(x + 4, y - 4);
  ctx.lineTo(x + 8, y - 30);
  ctx.quadraticCurveTo(x + 16, y - 46, x + 38, y - 47);
  ctx.quadraticCurveTo(x + 62, y - 46, x + 70, y - 32);
  ctx.lineTo(x + 66, y - 6);
  ctx.closePath();
  ctx.fill();
  R(x + 16, y - 42, 30, 4, '#8a8884');
  R(x + 12, y - 36, 10, 3, '#8a8884');
  R(x + 50, y - 24, 14, 2, '#3e3d40');
  R(x + 26, y - 16, 2, 10, '#3e3d40');
  R(x + 28, y - 8, 8, 2, '#3e3d40');
  // moss and grass at the foot
  R(x + 20, y - 47, 12, 3, '#56684c');
  R(x + 44, y - 46, 8, 2, '#4a5e44');
  for (let i = 0; i < 12; i++) R(x - 4 + i * 8, y - 3 - (i % 3) * 2, 2, 4 + (i % 3) * 2, i % 2 ? '#5a6e50' : '#4a5e44');
}

export function drawHill(ctx, level, camX, drawTree) {
  const hill = level.hill;
  if (!hill) return;
  const key = `${level.num}:${hill.x0}:${hill.x1}`;
  if (key !== cacheKey) {
    cacheCv = renderHill(hill, drawTree);
    cacheKey = key;
  }
  const sx = hill.x0 - camX;
  if (sx > W + 20 || sx + cacheCv.width < -20) return;
  ctx.drawImage(cacheCv, Math.round(sx), hill.top - PADT);
  if (hill.stoneX != null) drawGreatStone(ctx, hill.stoneX - camX, hill.surf(hill.stoneX + 40));
}

/** Distant drumlin silhouette that slowly comes into view near the end of chapter 3. */
export function drawHillDistant(ctx, camX, level) {
  const hill = level.hill;
  if (!hill) return;
  const camEnd = level.widthPx - W;
  const cx = W * 0.62 + (camEnd - camX) * 0.32;
  if (cx - 420 > W) return;
  const baseY = 342;
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    // drumlin: steep north (left) end, long gentle tail to the south (right)
    const prof = t < 0.3 ? Math.sin((t / 0.3) * Math.PI * 0.5) : Math.cos(((t - 0.3) / 0.7) * Math.PI * 0.5) ** 0.8;
    pts.push([cx - 360 + t * 720, baseY - prof * 118]);
  }
  ctx.fillStyle = '#3a4447';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], baseY + 4);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(pts[pts.length - 1][0], baseY + 4);
  ctx.closePath();
  ctx.fill();
  // tree line on the crown
  ctx.fillStyle = '#323c3e';
  for (let i = 4; i < 56; i += 3) {
    const [x, y] = pts[i];
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 9, 7 + (i % 4), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // faint rim light from the storm sky
  ctx.fillStyle = 'rgba(150,170,190,0.12)';
  for (let i = 1; i < 30; i++) ctx.fillRect(Math.round(pts[i][0]), Math.round(pts[i][1]) - 1, 12, 2);
}

export const HILL_SCALE = SCALE;
