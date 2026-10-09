/**
 * Grounded climbing stacks — logs, rocks, stumps, hay bales, crates and barrels.
 * Level layouts still author "platform" runs (tile 2); convertStacks() turns each
 * run into a solid pile (tile 5) that rests on the ground (or the riverbed), adding
 * a lower step pile beside any stack taller than a comfortable jump. Nothing floats.
 */
import { TILE } from './constants.js?v=74';

export const STACK = 5;
const MAX_RISE = 3; // tiles a jump can climb (jump apex ≈ 3.4 tiles)

function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Which kind of pile suits this chapter / spot. */
export function stackKindFor(num, c0, w, h, overWater, idx) {
  if (overWater) return num === 6 ? 'crates' : 'rocks';
  switch (num) {
    case 1:
      if (c0 < 30) return 'hay'; // the Smith farm fields
      if (h <= 2 && w <= 4 && idx % 3 === 2) return 'stump';
      return idx % 2 ? 'rocks' : 'logs';
    case 2:
      if (h <= 2 && w <= 4 && idx % 3 === 1) return 'stump';
      return idx % 2 ? 'logs' : 'rocks';
    case 3:
      if (c0 < 30) return 'hay';
      return idx % 3 === 1 ? 'logs' : 'rocks';
    case 5:
      return idx % 2 ? 'logs' : 'crates';
    case 4:
    case 6:
    case 7:
    default:
      return 'crates';
  }
}

/**
 * Convert platform runs to grounded stacks. Returns stack records
 * { c0, c1, r0, r1, kind, water } (r1 inclusive bottom row).
 */
export function convertStacks(tiles, num, groundR = 13) {
  const rows = tiles.length;
  const cols = tiles[0].length;
  const runs = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (tiles[r][c] === 2) {
        const c0 = c;
        while (c < cols && tiles[r][c] === 2) c++;
        runs.push({ r, c0, c1: c - 1 });
      } else c++;
    }
  }
  // top row of solid stack per column (groundR = none yet)
  const top = new Array(cols).fill(groundR);
  const stacks = [];
  const baseOk = (c) => c >= 0 && c < cols && (tiles[groundR][c] === 1 || tiles[groundR][c] === 4);
  const fillCol = (c, r0) => {
    if (r0 >= top[c]) return false;
    for (let r = r0; r < top[c]; r++) tiles[r][c] = STACK;
    return true;
  };
  runs.sort((a, b) => a.r - b.r);
  let idx = 0;
  for (const run of runs) {
    for (let c = run.c0; c <= run.c1; c++) tiles[run.r][c] = 0;
    const cs = [];
    for (let c = run.c0; c <= run.c1; c++) if (baseOk(c)) cs.push(c);
    if (!cs.length) continue;
    const h = groundR - run.r;
    const water = cs.some((c) => tiles[groundR][c] === 4);
    const kind = stackKindFor(num, run.c0, cs.length, h, water, idx++);
    addRect(cs, run.r, kind, water);
    // Lower steps on the approach side so every top is within one jump
    let need = h;
    let edge = run.c0;
    let side = -1;
    if (!baseOk(edge - 1) || !baseOk(edge - 2)) {
      side = 1;
      edge = run.c1;
    }
    while (need > MAX_RISE) {
      need -= 2;
      const sc = side < 0 ? [edge - 2, edge - 1] : [edge + 1, edge + 2];
      const ok = sc.filter((c) => baseOk(c));
      if (!ok.length) break;
      addRect(ok, groundR - need, kind, ok.some((c) => tiles[groundR][c] === 4));
      edge = side < 0 ? edge - 2 : edge + 2;
    }
  }

  function addRect(cs, r0, kind, water) {
    // group into runs of consecutive columns sharing the same current top
    let i = 0;
    while (i < cs.length) {
      const c0 = cs[i];
      const base = top[c0];
      let j = i;
      while (j + 1 < cs.length && cs[j + 1] === cs[j] + 1 && top[cs[j + 1]] === base) j++;
      if (r0 < base) {
        for (let k = i; k <= j; k++) fillCol(cs[k], r0);
        for (let k = i; k <= j; k++) top[cs[k]] = r0;
        stacks.push({ c0, c1: cs[j], r0, r1: base - 1, kind, water: water && base === groundR });
      }
      i = j + 1;
    }
  }
  return stacks;
}

// ── Art ─────────────────────────────────────────────────────────────────────

const cache = new Map();

export function drawStacks(ctx, level, camX) {
  if (!level.stacks) return;
  const W = ctx.canvas.width;
  for (let i = 0; i < level.stacks.length; i++) {
    const s = level.stacks[i];
    const x = s.c0 * TILE - camX;
    const w = (s.c1 - s.c0 + 1) * TILE;
    if (x + w < -40 || x > W + 40) continue;
    const key = `${level.num}:${i}:${s.c0}:${s.r0}:${s.kind}`;
    let cv = cache.get(key);
    if (!cv) {
      cv = renderStack(s, level.num * 1000 + i);
      cache.set(key, cv);
    }
    ctx.drawImage(cv, Math.round(x) - PAD, s.r0 * TILE - PAD);
  }
}

const PAD = 8;

function renderStack(s, seed) {
  const w = (s.c1 - s.c0 + 1) * TILE;
  const h = (s.r1 - s.r0 + 1) * TILE + (s.water ? 22 : 4);
  const cv = document.createElement('canvas');
  cv.width = w + PAD * 2;
  cv.height = h + PAD * 2;
  const g = cv.getContext('2d');
  g.translate(PAD, PAD);
  const rnd = (() => {
    let n = 0;
    return () => hash(seed, n++, 7);
  })();
  const hh = (s.r1 - s.r0 + 1) * TILE;
  // contact shadow on the ground
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath();
  g.ellipse(w / 2, hh + 2, w / 2 + 4, 5, 0, 0, Math.PI * 2);
  g.fill();
  if (s.kind === 'logs') drawLogs(g, w, hh, rnd);
  else if (s.kind === 'rocks') drawRocks(g, w, hh, rnd, s.water);
  else if (s.kind === 'stump') drawStump(g, w, hh, rnd);
  else if (s.kind === 'hay') drawHay(g, w, hh, rnd);
  else drawCrates(g, w, hh, rnd, s.water);
  if (s.water) {
    // the pile stands in the river: wet base and a ring of foam
    g.fillStyle = 'rgba(30,60,90,0.55)';
    g.fillRect(-2, hh, w + 4, 22);
    g.fillStyle = 'rgba(220,240,250,0.75)';
    for (let x = -2; x < w + 2; x += 6) g.fillRect(x, hh + 1 + ((x / 6) % 2), 4, 2);
  }
  return cv;
}

function px(g, x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Split lumber/hay rows into pieces of roughly `unit` tiles. */
function pieces(total, unit, rnd, offset = 0, spread = 0.5) {
  const out = [];
  let x = -offset;
  while (x < total) {
    const len = unit * (1.05 - spread / 2 + rnd() * spread);
    out.push([Math.max(0, x), Math.min(total, x + len)]);
    x += len;
  }
  const last = out[out.length - 1];
  if (out.length > 1 && last[1] - last[0] < unit * 0.45) {
    out.pop();
    out[out.length - 1][1] = total;
  }
  return out;
}

function drawLogs(g, w, h, rnd) {
  const rows = Math.round(h / TILE);
  for (let r = rows - 1; r >= 0; r--) {
    const y = r * TILE;
    const inset = r === 0 ? 0 : 0;
    const segs = w > 3 * TILE ? pieces(w, 2.6 * TILE, rnd, (r % 2) * 18) : [[0, w]];
    for (const [a, b] of segs) {
      const x0 = a + inset;
      const x1 = b - inset;
      // bark body: rounded log, lit from upper left
      px(g, x0, y + 1, x1 - x0, TILE - 2, '#2a1a0e');
      px(g, x0 + 1, y + 2, x1 - x0 - 2, TILE - 4, '#5a3a20');
      px(g, x0 + 1, y + 4, x1 - x0 - 2, 6, '#7a5230');
      px(g, x0 + 1, y + 5, x1 - x0 - 2, 2, '#946a40');
      px(g, x0 + 1, y + TILE - 9, x1 - x0 - 2, 6, '#40281a');
      // bark furrows
      for (let k = x0 + 6; k < x1 - 8; k += 5 + Math.floor(rnd() * 6)) {
        px(g, k, y + 8 + rnd() * 6, 6 + rnd() * 8, 1, '#3a2414');
        if (rnd() < 0.3) px(g, k + 2, y + 14 + rnd() * 6, 4, 1, '#8a6038');
        if (rnd() < 0.18) px(g, k, y + 3, 3, 2, '#4f7a30'); // moss
      }
      // cut end (right side) with growth rings
      const ex = x1 - 9;
      const cy = y + TILE / 2;
      g.fillStyle = '#2a1a0e';
      g.beginPath();
      g.ellipse(ex + 2, cy, 8, 15, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#c89a60';
      g.beginPath();
      g.ellipse(ex + 2, cy, 6.5, 13.5, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#9a7040';
      g.lineWidth = 1;
      for (const rr of [9.5, 6, 3]) {
        g.beginPath();
        g.ellipse(ex + 2, cy, rr * 0.48, rr, 0, 0, Math.PI * 2);
        g.stroke();
      }
      px(g, ex + 1, cy - 1, 2, 2, '#6a4422');
      px(g, ex - 2, cy - 11, 3, 4, '#e0b880');
    }
  }
  // top highlight so the standing surface reads
  px(g, 2, 1, w - 4, 2, 'rgba(255,220,160,0.35)');
}

function drawRocks(g, w, h, rnd, water) {
  const rows = Math.round(h / TILE);
  const moss = !water;
  for (let r = rows - 1; r >= 0; r--) {
    const y = r * TILE;
    const segs = pieces(w, r === 0 ? 2 * TILE : 1.4 * TILE, rnd, (r % 2) * 14 + rnd() * 10, 0.9);
    for (const [a, b] of segs) {
      const bw = b - a;
      const top = r === 0 ? y : y - 3;
      const bh = TILE + (r === 0 ? 1 : 3);
      // irregular boulder outline
      const rad = 11 + rnd() * 6;
      g.fillStyle = '#26262a';
      roundedBlob(g, a, top, bw, bh, rad, rnd, 2.5);
      g.fill();
      const tone = 84 + Math.floor(rnd() * 34);
      const warm = Math.floor(rnd() * 10) - 3;
      const grad = g.createLinearGradient(a, top, a + bw * 0.6, top + bh);
      grad.addColorStop(0, `rgb(${tone + 22 + warm},${tone + 20},${tone + 12 - warm})`);
      grad.addColorStop(1, `rgb(${tone - 18 + warm},${tone - 20},${tone - 22 - warm})`);
      g.fillStyle = grad;
      roundedBlob(g, a + 1.5, top + 1.5, bw - 3, bh - 3, rad - 1.5, rnd, 0);
      g.fill();
      // light from upper left, shade lower right
      g.fillStyle = `rgba(255,250,235,0.2)`;
      g.fillRect(a + rad * 0.6, top + 3, bw * 0.45, 3);
      // cracks and speckles
      px(g, a + bw * (0.3 + rnd() * 0.4), top + 8, 1, 10, 'rgba(30,28,32,0.6)');
      for (let k = 0; k < 4; k++) px(g, a + 4 + rnd() * (bw - 8), top + 6 + rnd() * (bh - 12), 2, 1, 'rgba(240,235,220,0.25)');
      if (moss && r === 0) {
        px(g, a + 3, top, bw - 6, 3, '#4a7a34');
        for (let k = a + 5; k < b - 5; k += 4 + rnd() * 5) px(g, k, top + 2, 3, 2 + rnd() * 3, '#3a6a2a');
      }
    }
  }
  // flat-ish standing surface
  px(g, 3, 0, w - 6, 2, moss ? '#5a8a40' : 'rgba(230,225,210,0.35)');
}

function roundedBlob(g, x, y, w, h, rad, rnd, jitter = 1.5) {
  const j = () => (rnd() - 0.5) * 2 * jitter;
  const r = Math.min(rad, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y + j());
  g.lineTo(x + w - r, y + j());
  g.quadraticCurveTo(x + w + j(), y, x + w, y + r);
  g.lineTo(x + w + j(), y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x + j(), y + h - r);
  g.lineTo(x + j(), y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

function drawStump(g, w, h, rnd) {
  // a broad cut stump with flared roots
  const x0 = 3;
  const x1 = w - 3;
  px(g, x0 - 1, 6, x1 - x0 + 2, h - 6, '#24160c');
  px(g, x0, 7, x1 - x0, h - 8, '#5a3a22');
  px(g, x0 + 3, 7, 6, h - 8, '#7a5232');
  px(g, x1 - 9, 7, 6, h - 8, '#3e2616');
  for (let k = x0 + 10; k < x1 - 10; k += 6 + rnd() * 5) px(g, k, 12 + rnd() * 8, 2, h - 26, '#3a2414');
  // roots
  g.fillStyle = '#4a2e1a';
  for (const [rx, dir] of [[x0, -1], [x1, 1]]) {
    g.beginPath();
    g.moveTo(rx, h - 18);
    g.quadraticCurveTo(rx + dir * 8, h - 4, rx + dir * 12, h);
    g.lineTo(rx - dir * 6, h);
    g.closePath();
    g.fill();
  }
  // cut top with rings (the standing surface)
  g.fillStyle = '#24160c';
  g.beginPath();
  g.ellipse(w / 2, 7, w / 2 - 1, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#c99a62';
  g.beginPath();
  g.ellipse(w / 2, 7, w / 2 - 3, 5.5, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#9a7040';
  for (const k of [0.75, 0.5, 0.25]) {
    g.beginPath();
    g.ellipse(w / 2, 7, (w / 2 - 3) * k, 5.5 * k, 0, 0, Math.PI * 2);
    g.stroke();
  }
  px(g, w / 2 - 1, 6, 2, 2, '#6a4422');
  px(g, w * 0.3, 2, w * 0.25, 1, 'rgba(255,230,180,0.6)');
}

function drawHay(g, w, h, rnd) {
  const rows = Math.round(h / TILE);
  for (let r = rows - 1; r >= 0; r--) {
    const y = r * TILE;
    const segs = pieces(w, 2 * TILE, rnd, (r % 2) * TILE);
    for (const [a, b] of segs) {
      const bw = b - a;
      px(g, a, y, bw, TILE, '#5a4210');
      px(g, a + 1, y + 1, bw - 2, TILE - 2, '#c89a38');
      px(g, a + 1, y + 1, bw - 2, 4, '#e2b850');
      px(g, a + 1, y + TILE - 6, bw - 2, 5, '#a07a28');
      px(g, a + bw - 5, y + 2, 4, TILE - 4, '#9a7224');
      // straw strokes
      for (let k = 0; k < bw / 3; k++) {
        const sx = a + 2 + rnd() * (bw - 6);
        const sy = y + 4 + rnd() * (TILE - 10);
        px(g, sx, sy, 4 + rnd() * 6, 1, rnd() < 0.5 ? '#f0d070' : '#8a6420');
      }
      // twine bands
      for (const t of [0.3, 0.7]) {
        const tx = a + bw * t;
        px(g, tx, y + 1, 2, TILE - 2, '#6a4a1a');
        px(g, tx - 1, y + 1, 1, TILE - 2, 'rgba(255,240,180,0.25)');
      }
      // loose straw on top
      if (r === 0) {
        for (let k = a + 2; k < b - 2; k += 3 + rnd() * 4) px(g, k, y - 2 - rnd() * 2, 1, 3 + rnd() * 2, '#e8c45a');
      }
    }
  }
}

function drawCrates(g, w, h, rnd, wet) {
  const rows = Math.round(h / TILE);
  const cols = Math.round(w / TILE);
  const used = new Set();
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      if (used.has(`${c},${r}`)) continue;
      const x = c * TILE;
      const y = r * TILE;
      // occasional big shipping crate (2×2) low in the pile
      const big = !wet && r >= 1 && c + 1 < cols && !used.has(`${c + 1},${r}`) && r > 0 && rnd() < 0.3;
      if (big) {
        for (const k of [`${c},${r}`, `${c + 1},${r}`, `${c},${r - 1}`, `${c + 1},${r - 1}`]) used.add(k);
        drawCrate(g, x, y - TILE, rnd, wet, 2 * TILE);
        continue;
      }
      used.add(`${c},${r}`);
      const barrel = !wet && r === rows - 1 && rows > 1 && rnd() < 0.35;
      if (barrel) drawBarrel(g, x, y, rnd);
      else drawCrate(g, x, y, rnd, wet);
    }
  }
}

function drawCrate(g, x, y, rnd, wet, S = TILE) {
  const tones = wet ? ['#5a4630', '#6a5238', '#4a3a28'] : ['#8a6034', '#9a6c3a', '#7a5430', '#94704a'];
  const base = tones[Math.floor(rnd() * tones.length)];
  const f = S > TILE ? 5 : 3;
  px(g, x, y, S, S, '#2a1a0c');
  px(g, x + 1, y + 1, S - 2, S - 2, base);
  // planks
  const n = S > TILE ? 6 : 3;
  for (let k = 1; k < n; k++) px(g, x + 1, y + (k * S) / n, S - 2, 1, 'rgba(40,24,10,0.55)');
  for (let k = 0; k < n * 2; k++) px(g, x + 4 + rnd() * (S - 10), y + 3 + rnd() * (S - 8), 3, 1, 'rgba(255,220,170,0.18)');
  // frame
  px(g, x + 1, y + 1, S - 2, f, '#b08048');
  px(g, x + 1, y + S - f - 1, S - 2, f, '#5a3a1c');
  px(g, x + 1, y + 1, f, S - 2, '#a07440');
  px(g, x + S - f - 1, y + 1, f, S - 2, '#5a3a1c');
  // diagonal brace (some crates are slatted instead)
  if (S > TILE || rnd() < 0.6) {
    g.strokeStyle = '#5a3a1c';
    g.lineWidth = S > TILE ? 5 : 3;
    g.beginPath();
    g.moveTo(x + f + 2, y + S - f - 2);
    g.lineTo(x + S - f - 2, y + f + 2);
    g.stroke();
    g.strokeStyle = 'rgba(220,170,110,0.45)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x + f + 2, y + S - f - 4);
    g.lineTo(x + S - f - 4, y + f + 2);
    g.stroke();
  } else {
    px(g, x + 1, y + S / 2 - 1, S - 2, 3, '#6a4422');
  }
  if (S > TILE) {
    // stencilled shipping mark
    g.fillStyle = 'rgba(40,24,12,0.55)';
    g.font = 'bold 11px serif';
    g.fillText(rnd() < 0.5 ? 'N.Y.' : 'FLOUR', x + S * 0.28, y + S * 0.62);
  }
  // nails
  for (const [nx, ny] of [[3, 3], [S - 5, 3], [3, S - 5], [S - 5, S - 5]]) px(g, x + nx, y + ny, 2, 2, '#2a2420');
  if (wet) px(g, x + 1, y + S - 10, S - 2, 6, 'rgba(20,40,40,0.35)');
}

function drawBarrel(g, x, y, rnd) {
  px(g, x + 3, y, TILE - 6, TILE, '#24160c');
  px(g, x + 2, y + 4, TILE - 4, TILE - 8, '#24160c');
  px(g, x + 4, y + 1, TILE - 8, TILE - 2, '#7a4e2a');
  px(g, x + 3, y + 5, TILE - 6, TILE - 10, '#7a4e2a');
  px(g, x + 7, y + 2, 4, TILE - 4, '#a06c3a');
  px(g, x + TILE - 10, y + 2, 4, TILE - 4, '#5a3818');
  for (const sx of [12, 17, 22]) px(g, x + sx, y + 2, 1, TILE - 4, 'rgba(30,18,8,0.5)');
  for (const hy of [5, TILE - 8]) {
    px(g, x + 2, y + hy, TILE - 4, 3, '#3a3a3e');
    px(g, x + 3, y + hy, TILE - 6, 1, '#7a7a80');
  }
  px(g, x + 6, y + 1, TILE - 12, 2, '#b08050');
}
