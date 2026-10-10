/**
 * Round 8 production-value layer: lighting, colour grading, ambient life,
 * feedback particles, foreground detail and screen transitions.
 * Everything here is cosmetic: no gameplay rule reads from it.
 *
 * Performance rules (iPhone 60 fps):
 *  - one pooled particle array, hard caps (LOW caps when "Reduce flashing & effects" is on
 *    or when the adaptive monitor sees slow frames)
 *  - darkness/light layer rendered at half resolution, light sprites pre-rendered once
 *  - gradients / vignettes / beams cached per chapter, never rebuilt per frame
 */
import { W, H, TILE, SCALE } from './constants.js?v=78';
import { reduceFlash } from './save.js?v=78';
import { timed, NO_FX } from './perfstat.js?v=78';

const S = SCALE;
const GROUND_Y = 13 * TILE;

// ── per-chapter look ────────────────────────────────────────
// dark: darkness layer alpha (0 = none); tint: darkness colour; grade: top/bottom wash;
// vig: vignette strength; amb: ambient particle kinds; rays: light shafts
export const LOOK = {
  1: { dark: 0, grade: ['rgba(255,226,170,0.10)', 'rgba(60,90,30,0.10)'], vig: 0.32, amb: ['leaf', 'mote', 'bird'], rays: 'sun', fg: 'leaves', warm: 0.18 },
  2: { dark: 0.62, tint: [10, 16, 44], grade: ['rgba(40,60,140,0.16)', 'rgba(10,20,30,0.18)'], vig: 0.5, amb: ['firefly', 'mote'], rays: null, fg: 'pines', warm: 0.3 },
  3: { dark: 0.34, tint: [18, 18, 40], grade: ['rgba(70,70,120,0.16)', 'rgba(30,26,30,0.16)'], vig: 0.48, amb: ['rain', 'leaf'], rays: null, fg: 'leaves', warm: 0.22 },
  4: { dark: 0.5, tint: [12, 14, 40], grade: ['rgba(60,70,150,0.14)', 'rgba(40,20,10,0.16)'], vig: 0.5, amb: ['ember', 'firefly'], rays: null, fg: null, warm: 0.28 },
  5: { dark: 0, grade: ['rgba(200,215,255,0.16)', 'rgba(150,170,200,0.12)'], vig: 0.4, amb: ['mote'], rays: null, fg: null, warm: 0.16 },
  6: { dark: 0, grade: ['rgba(255,214,150,0.14)', 'rgba(110,80,50,0.10)'], vig: 0.34, amb: ['mote', 'bird'], rays: 'sun', fg: null, warm: 0.16 },
  7: { dark: 0.38, tint: [24, 14, 8], grade: ['rgba(255,190,110,0.12)', 'rgba(30,16,8,0.22)'], vig: 0.56, amb: ['mote'], rays: 'window', fg: 'beams', warm: 0.3 },
};

// ── quality ─────────────────────────────────────────────────
// Tiers: 'high' (full effects) and 'lite' (fewer particles / shafts). Decided from measured
// main-thread work per rendered frame (update + draw), plus the frame interval as a backstop.
// iPhone / iPad Safari start in lite and are promoted only after a sustained light load.
export const IS_IOS = typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (/Mac/.test(navigator.platform || '') && navigator.maxTouchPoints > 1));
const perf = { avg: 16.7, work: 4, low: IS_IOS, n: 0, good: 0, bad: 0 };
export function fxLow() {
  return reduceFlash() || perf.low;
}
/** Call once per rendered frame: ms = interval since the last rendered frame, work = ms of update+draw. */
export function fxFrameTime(ms, work) {
  if (!(ms > 0) || ms > 250) return;
  perf.avg = perf.avg * 0.95 + ms * 0.05;
  if (work >= 0) perf.work = perf.work * 0.95 + work * 0.05;
  perf.n++;
  if (perf.n < 90) return;
  const heavy = perf.work > 9 || perf.avg > 21; // > ~half a 60 Hz frame of JS, or < ~48 fps
  const light = perf.work < 4.5 && perf.avg < 17.6;
  perf.bad = heavy ? perf.bad + 1 : 0;
  perf.good = light ? perf.good + 1 : 0;
  if (!perf.low && perf.bad > 45) { perf.low = true; perf.bad = 0; }
  if (perf.low && perf.good > (IS_IOS ? 600 : 240)) { perf.low = false; perf.good = 0; }
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('pq-lite', perf.low);
}
export function fxPerf() {
  return { avg: +perf.avg.toFixed(2), work: +perf.work.toFixed(2), low: perf.low, tier: perf.low ? 'lite' : 'high', particles: pool.length };
}
if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('pq-ios', IS_IOS);
  document.documentElement.classList.toggle('pq-lite', perf.low);
}

// ── cached sprites ──────────────────────────────────────────
function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
const cache = new Map();
function cached(key, build) {
  let c = cache.get(key);
  if (!c) {
    c = build();
    cache.set(key, c);
  }
  return c;
}
/** soft round light, white or tinted, 128px */
function lightSprite(rgb = '255,255,255') {
  return cached('L' + rgb, () => {
    const c = mk(128, 128);
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `rgba(${rgb},1)`);
    gr.addColorStop(0.35, `rgba(${rgb},0.55)`);
    gr.addColorStop(0.7, `rgba(${rgb},0.16)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    return c;
  });
}
function vignette(strength) {
  return cached('V' + strength, () => {
    const c = mk(W / 2, H / 2);
    const g = c.getContext('2d');
    g.save();
    g.scale((W / H), 1); // elliptical, not a spotlight column
    const cx = (W / 4) / (W / H);
    const gr = g.createRadialGradient(cx, H / 4 * 0.92, H * 0.1, cx, H / 4, H * 0.36);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(0.6, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `rgba(6,3,0,${strength})`);
    g.fillStyle = gr;
    g.fillRect(-W, -H, W * 3, H * 3);
    g.restore();
    return c;
  });
}
function grade(n) {
  const L = LOOK[n];
  return cached('G' + n, () => {
    const c = mk(4, 128);
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, L.grade[0]);
    gr.addColorStop(0.55, 'rgba(0,0,0,0)');
    gr.addColorStop(1, L.grade[1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 128);
    return c;
  });
}
function beam(kind) {
  return cached('B' + kind, () => {
    const c = mk(260, H);
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H);
    const col = kind === 'window' ? '255,214,150' : kind === 'moon' ? '200,215,255' : '255,246,214';
    gr.addColorStop(0, `rgba(${col},0.55)`);
    gr.addColorStop(0.6, `rgba(${col},0.18)`);
    gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(150, 0);
    g.lineTo(230, 0);
    g.lineTo(110, H);
    g.lineTo(0, H);
    g.closePath();
    g.fill();
    return c;
  });
}
function tuftSprite(theme, v) {
  return cached(`T${theme}${v}`, () => {
    const c = mk(24, 16);
    const g = c.getContext('2d');
    const pal = {
      green: ['#244a1c', '#3a6a2a', '#5a8e3a'],
      night: ['#0e2014', '#183424', '#24402c'],
      snow: ['#9aa6b4', '#c8d2de', '#eef3f8'],
      dry: ['#5a4a26', '#7a6634', '#9a8444'],
    }[theme];
    const blades = 5 + v;
    for (let i = 0; i < blades; i++) {
      const x = 3 + (i * 18) / blades + ((i * 7 + v * 3) % 3);
      const h = 7 + ((i * 5 + v) % 7);
      g.strokeStyle = pal[i % 3];
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x, 16);
      g.quadraticCurveTo(x + (i % 2 ? 2 : -2), 16 - h * 0.6, x + (i % 2 ? 3 : -3), 16 - h);
      g.stroke();
    }
    if (theme === 'green' && v === 2) {
      // a few wildflowers
      g.fillStyle = '#f4e27a';
      g.fillRect(8, 5, 2, 2);
      g.fillStyle = '#e8eef8';
      g.fillRect(15, 7, 2, 2);
    }
    return c;
  });
}

// ── state ───────────────────────────────────────────────────
const pool = []; // particles (world or screen space)
let ambient = [];
let lastCam = 0;
let levelRef = null;
let tufts = [];
let lightCanvas = null;
let lightCtx = null;
let stepAcc = 0;
let wasOnGround = true;

export function fxReset(level) {
  pool.length = 0;
  ambient = [];
  levelRef = level;
  lastCam = 0;
  stepAcc = 0;
  tufts = [];
  if (!level) return;
  // foreground grass tufts on walkable ground tops (deterministic)
  const theme = level.num === 5 ? 'snow' : level.num === 2 || level.num === 4 ? 'night' : level.num === 7 ? null : level.num === 6 ? 'dry' : 'green';
  if (theme) {
    const t = level.tiles;
    let seed = level.num * 977;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let c = 0; c < level.cols; c++) {
      for (let r = 1; r < level.rows; r++) {
        if (level.indoor && c * TILE >= level.indoor[0] && c * TILE < level.indoor[1]) break;
        if (t[r][c] === 1 && t[r - 1][c] === 0 && r >= 12) {
          const n = rnd() < 0.55 ? 1 : 2;
          for (let k = 0; k < n; k++) tufts.push({ x: c * TILE + rnd() * (TILE - 20), y: r * TILE + 2, v: Math.floor(rnd() * 3), ph: rnd() * 6.28, theme });
          break;
        }
      }
    }
    tufts.sort((a, b) => a.x - b.x);
  }
}

function cap() {
  return fxLow() ? 40 : 150;
}
function add(p) {
  if (pool.length >= cap()) pool.shift();
  pool.push(p);
}

/** Feedback bursts in world coordinates. */
export function fxBurst(kind, x, y, o = {}) {
  const low = fxLow();
  if (kind === 'dust' || kind === 'step') {
    const n = kind === 'step' ? 1 : low ? 2 : 5;
    for (let i = 0; i < n; i++) {
      const side = o.dir || (i % 2 ? 1 : -1);
      add({ k: 'dust', x: x + side * (3 + Math.random() * 6), y: y - 2, vx: -side * (0.3 + Math.random() * 0.8) * S * (kind === 'step' ? 0.6 : 1), vy: -(0.15 + Math.random() * 0.35) * S, r: kind === 'step' ? 2.5 : 3 + Math.random() * 3, life: 22, max: 22, col: o.col || '214,196,160' });
    }
  } else if (kind === 'sparkle') {
    const n = low ? 6 : 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const sp = (1 + Math.random() * 2.2) * S;
      add({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6 * S, life: 30 + Math.random() * 14, max: 44, col: o.col || '255,232,150' });
    }
    add({ k: 'ring', x, y, life: 22, max: 22, r0: 6, r1: 40, col: o.col || '255,232,150' });
  } else if (kind === 'puff') {
    // foe driven off: soft dust cloud + a few stars (no gore)
    const n = low ? 4 : 10;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      add({ k: 'dust', x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 8, vx: Math.cos(a) * 0.9 * S, vy: Math.sin(a) * 0.6 * S - 0.3 * S, r: 5 + Math.random() * 5, life: 30, max: 30, col: o.col || '220,210,190' });
    }
    for (let i = 0; i < (low ? 2 : 4); i++) add({ k: 'spark', x, y: y - 10, vx: (Math.random() - 0.5) * 3 * S, vy: -(1 + Math.random()) * S, life: 26, max: 26, col: '255,240,170' });
  } else if (kind === 'flare') {
    add({ k: 'ring', x, y, life: 34, max: 34, r0: 4, r1: 90, col: '255,214,120' });
    add({ k: 'glow', x, y, life: 46, max: 46, r: 110, col: '255,220,140' });
    for (let i = 0; i < (low ? 5 : 14); i++) add({ k: 'ember', x: x + (Math.random() - 0.5) * 10, y, vx: (Math.random() - 0.5) * 1.6 * S, vy: -(0.8 + Math.random() * 1.8) * S, life: 40 + Math.random() * 20, max: 60, col: '255,200,110' });
  } else if (kind === 'hit') {
    add({ k: 'star', x, y, life: 12, max: 12, col: '255,250,220' });
    for (let i = 0; i < (low ? 2 : 5); i++) {
      const a = Math.random() * Math.PI * 2;
      add({ k: 'spark', x, y, vx: Math.cos(a) * 2.4 * S, vy: Math.sin(a) * 2.4 * S, life: 14, max: 14, col: '255,240,200' });
    }
  } else if (kind === 'glint') {
    add({ k: 'star', x, y, life: 10, max: 10, col: '255,240,170' });
  }
}

/** Per-frame update: ambient spawners, particles, footsteps. */
export function fxUpdate(game, dt) {
  const level = game.level;
  if (!level) return;
  if (level !== levelRef) fxReset(level);
  const L = LOOK[level.num] || LOOK[1];
  const camD = game.camX - lastCam;
  lastCam = game.camX;
  const low = fxLow();
  // ambient (screen space with depth z; camera motion scrolls them)
  const want = low ? 10 : 34;
  if (ambient.length < want && Math.random() < 0.5) {
    const kind = L.amb[Math.floor(Math.random() * L.amb.length)];
    ambient.push(spawnAmbient(kind, game, ambient.length < want / 2));
  }
  for (let i = ambient.length - 1; i >= 0; i--) {
    const a = ambient[i];
    a.t += dt;
    a.x += (a.vx - camD * a.z) * dt;
    a.y += a.vy * dt;
    if (a.k === 'leaf') {
      a.vx += Math.sin(a.t * 0.05 + a.ph) * 0.02;
      a.rot += 0.05 * dt;
    } else if (a.k === 'firefly' || a.k === 'mote') {
      a.vx = Math.sin(a.t * 0.02 + a.ph) * 0.25 * a.z;
      a.vy = Math.cos(a.t * 0.017 + a.ph) * 0.18;
    } else if (a.k === 'bird') {
      a.y += Math.sin(a.t * 0.03 + a.ph) * 0.15;
    }
    if (a.x < -60 || a.x > W + 60 || a.y > H + 20 || a.y < -40 || a.t > a.life) ambient.splice(i, 1);
  }
  for (let i = pool.length - 1; i >= 0; i--) {
    const p = pool[i];
    p.life -= dt;
    if (p.vx != null) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.k === 'spark') p.vy += 0.08 * S * dt;
      if (p.k === 'dust') {
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.r += 0.06 * dt;
      }
      if (p.k === 'ember') p.vx += (Math.random() - 0.5) * 0.08;
    }
    if (p.life <= 0) pool.splice(i, 1);
  }
  // footstep dust + landing cue handled here so player.js stays untouched
  const pl = game.player;
  if (pl && pl.alive) {
    if (pl.onGround && Math.abs(pl.vx) > 1.6 * S && level.num !== 7) {
      stepAcc += Math.abs(pl.vx) * dt;
      if (stepAcc > 34 * S) {
        stepAcc = 0;
        fxBurst('step', pl.x + pl.w / 2 - Math.sign(pl.vx) * 8, pl.y + pl.h, { dir: Math.sign(pl.vx), col: level.num === 5 ? '235,240,250' : undefined });
      }
    }
    wasOnGround = pl.onGround;
  }
}

function spawnAmbient(kind, game, anywhere) {
  const z = 0.6 + Math.random() * 0.6;
  const base = { k: kind, t: 0, z, ph: Math.random() * 6.28, rot: Math.random() * 6, life: 900 };
  const fromEdge = () => (Math.random() < 0.5 ? -20 : W + 20);
  if (kind === 'leaf') return { ...base, x: anywhere ? Math.random() * W : W + 20, y: anywhere ? Math.random() * H * 0.7 : Math.random() * H * 0.5, vx: -(0.4 + Math.random() * 0.6), vy: 0.35 + Math.random() * 0.35, col: ['#c8902a', '#9aa83a', '#b85a24', '#d8b040'][Math.floor(Math.random() * 4)] };
  if (kind === 'mote') return { ...base, x: Math.random() * W, y: 60 + Math.random() * (H - 140), vx: 0, vy: 0, life: 400 + Math.random() * 300 };
  if (kind === 'firefly') return { ...base, x: Math.random() * W, y: GROUND_Y - 30 - Math.random() * 150, vx: 0, vy: 0, life: 500 + Math.random() * 400 };
  if (kind === 'ember') return { ...base, x: Math.random() * W, y: H * 0.5 + Math.random() * H * 0.4, vx: (Math.random() - 0.5) * 0.3, vy: -(0.3 + Math.random() * 0.5), life: 200 + Math.random() * 160 };
  if (kind === 'rain') return { ...base, x: Math.random() * (W + 200), y: anywhere ? Math.random() * H : -20, vx: -2.2, vy: 9 + Math.random() * 3, life: 90, z: 0.2 };
  if (kind === 'bird') {
    const left = Math.random() < 0.5;
    return { ...base, x: left ? -30 : W + 30, y: 40 + Math.random() * 90, vx: (left ? 1 : -1) * (0.8 + Math.random() * 0.6), vy: 0, z: 0.08, life: 2000, s: 0.7 + Math.random() * 0.5 };
  }
  return { ...base, x: fromEdge(), y: 0, vx: 0, vy: 0 };
}

// ── drawing ─────────────────────────────────────────────────
/** Behind the tiles: distant birds and sun shafts. */
export const drawFxBack = timed('fx', drawFxBackImpl);
function drawFxBackImpl(ctx, game) {
  if (NO_FX) return;
  const level = game.level;
  if (!level) return;
  const L = LOOK[level.num] || LOOK[1];
  ctx.save();
  for (const a of ambient) {
    if (a.k !== 'bird') continue;
    const flap = Math.sin(a.t * 0.25 + a.ph) * 4 * a.s;
    ctx.strokeStyle = level.num === 6 ? 'rgba(60,50,40,0.6)' : 'rgba(30,40,30,0.6)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(a.x - 7 * a.s, a.y - flap);
    ctx.quadraticCurveTo(a.x - 3 * a.s, a.y - 2, a.x, a.y);
    ctx.quadraticCurveTo(a.x + 3 * a.s, a.y - 2, a.x + 7 * a.s, a.y - flap);
    ctx.stroke();
  }
  if (L.rays === 'sun') {
    const b = beam('sun');
    ctx.globalCompositeOperation = 'lighter';
    const n = fxLow() ? 2 : 4;
    for (let k = 0; k < n; k++) {
      const x = ((k * 330 + 120 - game.camX * 0.25) % (W + 400) + W + 400) % (W + 400) - 260;
      ctx.globalAlpha = (level.num === 6 ? 0.1 : 0.14) * (0.7 + 0.3 * Math.sin(game.tick * 0.01 + k * 1.9));
      ctx.drawImage(b, x, -10, 260, H);
    }
  }
  ctx.restore();
}

/** In-world particles (after entities). */
export function drawFxWorld(ctx, game) {
  const camX = game.camX;
  ctx.save();
  for (const p of pool) {
    const a = Math.max(0, p.life / p.max);
    const x = p.x - camX;
    if (x < -120 || x > W + 120) continue;
    if (p.k === 'dust') {
      ctx.fillStyle = `rgba(${p.col},${0.5 * a})`;
      ctx.beginPath();
      ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.k === 'spark' || p.k === 'ember') {
      ctx.fillStyle = `rgba(${p.col},${a})`;
      const s = p.k === 'ember' ? 2 : 2.5;
      ctx.fillRect(x - s / 2, p.y - s / 2, s, s);
    } else if (p.k === 'ring') {
      const k = 1 - a;
      ctx.strokeStyle = `rgba(${p.col},${0.8 * a})`;
      ctx.lineWidth = 2.5 * a + 0.5;
      ctx.beginPath();
      ctx.arc(x, p.y, p.r0 + (p.r1 - p.r0) * k, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.k === 'glow') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 * a;
      const r = p.r * (1.2 - a * 0.4);
      ctx.drawImage(lightSprite(p.col), x - r, p.y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    } else if (p.k === 'star') {
      const r = 10 * (0.6 + 0.4 * a);
      ctx.fillStyle = `rgba(${p.col},${a})`;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const rr = i % 2 ? r * 0.3 : r;
        ctx.lineTo(x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Grass tufts in front of the feet (short; never hide gameplay). */
/**
 * Sway is pre-baked: each tuft sprite has SWAY_N skewed copies, so every tuft is a plain
 * axis-aligned drawImage (skewed drawImage calls were the single most expensive thing on
 * slow GPUs / software canvas). Tufts are sorted by x, so only the visible run is touched.
 */
const SWAY_N = 9;
const SWAY_MAX = 0.48;
function tuftSway(theme, v, k) {
  return cached(`TS${theme}${v}:${k}`, () => {
    const c = mk(40, 16);
    const g = c.getContext('2d');
    const sk = -SWAY_MAX + (2 * SWAY_MAX * k) / (SWAY_N - 1);
    g.setTransform(1, 0, -sk, 1, 20, 16);
    g.drawImage(tuftSprite(theme, v), -12, -16, 24, 16);
    return c;
  });
}
function firstVisibleTuft(x0) {
  let lo = 0;
  let hi = tufts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tufts[mid].x < x0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export const drawFxForegroundGrass = timed('fx', drawFxGrassImpl);
function drawFxGrassImpl(ctx, game) {
  if (NO_FX) return;
  if (!tufts.length) return;
  const camX = game.camX;
  const t = game.tick;
  const pl = game.player;
  const px = pl ? pl.x + pl.w / 2 : -1e9;
  const grounded = !!pl?.onGround;
  for (let i = firstVisibleTuft(camX - 40); i < tufts.length; i++) {
    const q = tufts[i];
    const x = q.x - camX;
    if (x > W + 10) break;
    // sway, and part around Joseph's feet as he walks through
    const near = grounded && Math.abs(q.x + 12 - px) < 22 ? Math.sign(q.x + 12 - px) * 0.35 : 0;
    const sk = Math.max(-SWAY_MAX, Math.min(SWAY_MAX, Math.sin(t * 0.04 + q.ph) * 0.12 + near));
    const k = Math.round(((sk + SWAY_MAX) / (2 * SWAY_MAX)) * (SWAY_N - 1));
    ctx.drawImage(tuftSway(q.theme, q.v, k), Math.round(x - 8), Math.round(q.y - 16));
  }
}

/** Collect light sources for this frame (screen coords, pre-zoom camera space). */
function gatherLights(game) {
  const out = [];
  const { level, camX, tick } = game;
  const flick = (k) => (reduceFlash() ? 1 : 0.9 + 0.1 * Math.sin(tick * 0.31 + k) + 0.04 * Math.sin(tick * 1.7 + k * 3));
  for (const d of level.decor) {
    const x = d.x - camX;
    if (x < -260 || x > W + 260) continue;
    if (d.type === 'lamp') out.push({ x: x + 8 * S, y: d.y + 6 * S, r: 170 * flick(d.x), c: '255,170,80', a: 0.85 });
    if (d.type === 'window') out.push({ x: x + 10, y: d.y + 10, r: 70, c: '255,200,120', a: 0.6 });
    if (d.type === 'building' && level.num === 4) {
      const v = d.variant || 0;
      const sc = 1.75 + v * 0.12;
      out.push({ x: x + 37 * sc, y: d.y + 112 + v * 16 - 16 * sc, r: 110, c: '255,190,100', a: 0.7 });
    }
  }
  for (const cp of level.checkpoints || []) {
    const x = cp.x - camX + 15 * S;
    if (x < -200 || x > W + 200) continue;
    out.push({ x, y: cp.y - 32 * S, r: (cp.lit ? 190 : 60) * flick(cp.x), c: cp.lit ? '255,214,130' : '160,170,200', a: cp.lit ? 0.95 : 0.25 });
  }
  if (level.moroni) {
    const x = level.moroni.x - camX;
    if (x > -400 && x < W + 400) {
      const pl = game.player;
      const near = pl ? Math.max(0, 1 - Math.abs(pl.x - level.moroni.x) / (14 * TILE)) : 0;
      out.push({ x, y: level.moroni.footY - 60, r: 220 + 260 * near, c: '255,248,226', a: 1 });
    }
  }
  for (const e of level.enemies) {
    if (!e.alive || !e.torch) continue;
    const x = e.x - camX + e.w / 2 + e.facing * 16;
    if (x < -200 || x > W + 200) continue;
    out.push({ x, y: e.y + e.h * 0.5 - 28, r: 150 * flick(e.x), c: '255,150,60', a: 0.9 });
  }
  for (const h of level.hazards || []) {
    if (!h.alive || (h.kind !== 'torch' && h.kind !== 'fire')) continue;
    out.push({ x: h.x - camX + 8, y: h.y + 8, r: 90, c: '255,150,60', a: 0.7 });
  }
  if (level.finale) {
    const f = level.finale;
    out.push({ x: (f.zoneX0 + f.zoneX1) / 2 - camX, y: GROUND_Y - 60, r: 260, c: '255,210,130', a: 0.9 });
  }
  const pl = game.player;
  if (pl && pl.alive) {
    // Joseph's own soft presence keeps him readable in the dark
    const calm = pl.crouching ? 1 : 0.55;
    out.push({ x: pl.x - camX + pl.w / 2, y: pl.y + pl.h * 0.45, r: 120 + 50 * calm, c: '255,236,200', a: 0.55 + 0.2 * calm });
  }
  for (const a of ambient) if (a.k === 'firefly') out.push({ x: a.x, y: a.y, r: 22, c: '210,255,140', a: 0.35 * fireflyBlink(a) });
  return out;
}
function fireflyBlink(a) {
  return 0.35 + 0.65 * Math.max(0, Math.sin(a.t * 0.06 + a.ph));
}

/** Darkness + lights + ambient front particles + grading + vignette + foreground framing. */
export const drawFxFront = timed('fx', drawFxFrontImpl);
function drawFxFrontImpl(ctx, game) {
  if (NO_FX) return;
  const level = game.level;
  if (!level) return;
  const L = LOOK[level.num] || LOOK[1];
  const low = fxLow();
  const lights = gatherLights(game);
  // 1) darkness + warm light glows, painted once at half res (one blit, not one per light)
  {
    if (!lightCanvas) {
      lightCanvas = mk(W / 2, H / 2);
      lightCtx = lightCanvas.getContext('2d');
    }
    const g = lightCtx;
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, W / 2, H / 2);
    if (L.dark > 0) {
      g.fillStyle = `rgba(${L.tint.join(',')},${L.dark})`;
      g.fillRect(0, 0, W / 2, H / 2);
      g.globalCompositeOperation = 'destination-out';
      const sp = lightSprite();
      for (const l of lights) {
        g.globalAlpha = Math.min(1, l.a);
        const r = l.r / 2;
        g.drawImage(sp, l.x / 2 - r, l.y / 2 - r, r * 2, r * 2);
      }
      g.globalCompositeOperation = 'source-over';
    }
    const glowK = L.dark > 0 ? 0.32 : 0.12;
    for (const l of lights) {
      if (l.r < 30) {
        g.globalAlpha = Math.min(1, l.a * 2);
        g.drawImage(lightSprite(l.c), l.x / 2 - 5, l.y / 2 - 5, 10, 10);
      } else {
        g.globalAlpha = Math.min(1, glowK * l.a);
        const r = (l.r * 0.7) / 2;
        g.drawImage(lightSprite(l.c), l.x / 2 - r, l.y / 2 - r, r * 2, r * 2);
      }
    }
    g.globalAlpha = 1;
    // colour grade + vignette ride along in the same half-res layer → one full-screen blit per frame
    g.drawImage(grade(level.num), 0, 0, W / 2, H / 2);
    g.drawImage(vignette(L.vig), -W * 0.025, -H * 0.025, W * 0.55, H * 0.55);
    ctx.drawImage(lightCanvas, 0, 0, W, H);
  }
  // window shafts (rare; a couple of blits)
  if (L.rays === 'window') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const b = beam('window');
    const low = fxLow();
    for (let k = 0; k < (low ? 1 : 3); k++) {
      const x = ((k * 420 + 200 - game.camX * 0.9) % (W + 520) + W + 520) % (W + 520) - 300;
      ctx.globalAlpha = 0.16 * (0.75 + 0.25 * Math.sin(game.tick * 0.012 + k));
      ctx.drawImage(b, x, 40, 260, H - 40);
    }
    ctx.restore();
  }
    // 3) front ambient particles
  ctx.save();
  for (const a of ambient) {
    if (a.k === 'leaf') {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      ctx.scale(1, Math.abs(Math.sin(a.rot * 1.3)) * 0.8 + 0.2);
      ctx.fillStyle = a.col;
      ctx.beginPath();
      ctx.ellipse(0, 0, 4 * a.z, 2.2 * a.z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (a.k === 'mote') {
      ctx.fillStyle = `rgba(255,244,214,${0.35 * Math.min(1, a.t / 60) * Math.min(1, (a.life - a.t) / 60)})`;
      ctx.fillRect(a.x, a.y, 2 * a.z, 2 * a.z);
    } else if (a.k === 'firefly') {
      ctx.fillStyle = `rgba(230,255,160,${0.9 * fireflyBlink(a)})`;
      ctx.fillRect(a.x - 1, a.y - 1, 2.5, 2.5);
    } else if (a.k === 'ember') {
      ctx.fillStyle = `rgba(255,${150 + Math.floor(60 * Math.sin(a.t * 0.2))},70,${0.8 * Math.min(1, (a.life - a.t) / 50)})`;
      ctx.fillRect(a.x, a.y, 2, 2);
    } else if (a.k === 'rain') {
      ctx.strokeStyle = 'rgba(190,200,230,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + a.vx * 2.2, a.y + a.vy * 2.2);
      ctx.stroke();
    }
  }
  ctx.restore();
  // 4) foreground framing silhouettes (top edge only; never over gameplay)
  if (L.fg && !low) drawFrame(ctx, game, L.fg);
}

function frameSprite(kind) {
  return cached('F' + kind, () => {
    const c = mk(520, 90);
    const g = c.getContext('2d');
    if (kind === 'beams') {
      g.fillStyle = '#140c06';
      g.fillRect(0, 0, 520, 18);
      g.fillRect(40, 0, 26, 60);
      g.fillStyle = '#24160c';
      g.fillRect(0, 14, 520, 4);
      g.fillRect(44, 0, 4, 60);
      return c;
    }
    const col = kind === 'pines' ? '#05090a' : '#0c160a';
    g.fillStyle = col;
    // hanging bough with leaf clusters
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(520, 0);
    g.lineTo(520, 6);
    g.quadraticCurveTo(300, 30, 0, 18);
    g.closePath();
    g.fill();
    let seed = kind.length * 31;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 46; i++) {
      const x = rnd() * 520;
      const y = 8 + rnd() * (kind === 'pines' ? 40 : 52) * (1 - Math.abs(x - 200) / 520);
      g.beginPath();
      if (kind === 'pines') {
        g.moveTo(x, y - 14);
        g.lineTo(x + 7, y + 6);
        g.lineTo(x - 7, y + 6);
      } else {
        g.ellipse(x, y, 7 + rnd() * 6, 4 + rnd() * 3, rnd() * 3, 0, Math.PI * 2);
      }
      g.fill();
    }
    return c;
  });
}
function drawFrame(ctx, game, kind) {
  const spr = frameSprite(kind);
  const span = 1500;
  const off = ((game.camX * 1.25) % span + span) % span;
  ctx.save();
  ctx.globalAlpha = kind === 'beams' ? 0.95 : 0.88;
  for (let x = -off; x < W + 20; x += span) {
    ctx.drawImage(spr, x - 20, -6, 520, 90);
    if (kind === 'beams') ctx.drawImage(spr, x + 700, -6, 520, 90);
  }
  ctx.restore();
}

// ── screen transitions ──────────────────────────────────────
let iris = null;
/** Iris opens from (sx, sy) in canvas pixels over `dur` frames. */
export function fxIris(sx, sy, dur = 34) {
  iris = { x: sx, y: sy, t: 0, dur };
}
export function fxIrisActive() {
  return !!iris;
}
export function drawFxScreen(ctx, dt = 1) {
  if (!iris) return;
  iris.t += dt;
  const k = Math.min(1, iris.t / iris.dur);
  const e = k * k * (3 - 2 * k);
  const R = Math.hypot(W, H) * e + 1;
  ctx.save();
  ctx.fillStyle = '#060402';
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(iris.x, iris.y, R, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  // warm rim on the opening edge
  if (!reduceFlash() && k < 1) {
    ctx.strokeStyle = `rgba(255,214,140,${0.5 * (1 - k)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(iris.x, iris.y, R, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  if (k >= 1) iris = null;
}
