/**
 * Round 8 painted parallax backdrops + ground tiles, one look per chapter.
 * Each far layer is painted ONCE into an offscreen canvas (tileable width) and then
 * just blitted with a scroll offset, so the per-frame cost is a handful of drawImage calls.
 * Period details: 1820s New York farms and split-rail fences, Missouri log cabins (1838),
 * winter road and Liberty Jail (1838–39), Nauvoo red-brick homes and the temple rising on
 * the bluff with scaffolding (it was still under construction in June 1844), Carthage Jail's
 * upper room (plastered walls, plank floor, sash windows).
 */
import { W, H, TILE } from './constants.js?v=77';

const LW = 1620; // layer width (tileable)
const GY = 13 * TILE; // ground top
const layers = new Map();

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
/** seamless ridge: sum of sines with whole periods over LW */
function ridge(x, seed, amp, k = [2, 5, 9]) {
  let y = 0;
  k.forEach((f, i) => {
    y += Math.sin(((x / LW) * f + seed * (i + 1) * 0.37) * Math.PI * 2) * amp / (i + 1.2);
  });
  return y;
}
function hillLayer(g, base, amp, seed, top, bottom, k) {
  const gr = g.createLinearGradient(0, base - amp * 1.8, 0, H);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bottom);
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= LW; x += 6) g.lineTo(x, base + ridge(x, seed, amp, k));
  g.lineTo(LW, H);
  g.closePath();
  g.fill();
}
/** draw fn at x and its wrapped twins so features cross the seam cleanly */
function wrapDraw(x, w, fn) {
  fn(x);
  if (x < w) fn(x + LW);
  if (x > LW - w) fn(x - LW);
}
function deciduous(g, x, base, s, cols, r) {
  g.fillStyle = cols[3] || '#2a1a10';
  g.fillRect(x - 2 * s, base - 22 * s, 4 * s, 22 * s);
  const blobs = [[0, -40, 20], [-13, -30, 15], [13, -31, 16], [-6, -50, 13], [8, -48, 13]];
  for (const [bx, by, br] of blobs) {
    g.fillStyle = cols[0];
    g.beginPath();
    g.ellipse(x + bx * s, base + by * s, br * s * (0.9 + r() * 0.2), br * s * 0.85, 0, 0, Math.PI * 2);
    g.fill();
  }
  // light from upper left
  g.fillStyle = cols[1];
  for (const [bx, by, br] of blobs.slice(0, 4)) {
    g.beginPath();
    g.ellipse(x + (bx - br * 0.3) * s, base + (by - br * 0.3) * s, br * s * 0.5, br * s * 0.4, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (cols[2]) {
    g.fillStyle = cols[2];
    g.beginPath();
    g.ellipse(x - 8 * s, base - 54 * s, 5 * s, 3.5 * s, 0, 0, Math.PI * 2);
    g.fill();
  }
}
function pine(g, x, base, s, col, hi) {
  g.fillStyle = col;
  for (let i = 0; i < 4; i++) {
    const w = (26 - i * 5) * s;
    const y = base - (18 + i * 16) * s;
    g.beginPath();
    g.moveTo(x, y - 22 * s);
    g.lineTo(x + w, y + 6 * s);
    g.lineTo(x - w, y + 6 * s);
    g.closePath();
    g.fill();
    if (hi) {
      g.fillStyle = hi;
      g.beginPath();
      g.moveTo(x, y - 22 * s);
      g.lineTo(x - w * 0.15, y + 4 * s);
      g.lineTo(x - w, y + 6 * s);
      g.closePath();
      g.fill();
      g.fillStyle = col;
    }
  }
  g.fillRect(x - 2 * s, base - 18 * s, 4 * s, 18 * s);
}
function bareTree(g, x, base, s, col, r) {
  g.strokeStyle = col;
  g.lineCap = 'round';
  const branch = (bx, by, ang, len, w, d) => {
    const ex = bx + Math.cos(ang) * len;
    const ey = by + Math.sin(ang) * len;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(ex, ey);
    g.stroke();
    if (d > 0) {
      branch(ex, ey, ang - 0.45 - r() * 0.2, len * 0.72, w * 0.65, d - 1);
      branch(ex, ey, ang + 0.4 + r() * 0.2, len * 0.7, w * 0.65, d - 1);
    }
  };
  branch(x, base, -Math.PI / 2, 26 * s, 5 * s, 4);
}
function railFence(g, x0, x1, base, col, hi) {
  for (let x = x0; x < x1; x += 34) {
    g.fillStyle = col;
    g.fillRect(x, base - 16, 3, 16);
    // zig-zag "worm" rails, the common 1820s farm fence
    g.save();
    g.translate(x, base - 12);
    g.rotate(-0.12);
    g.fillRect(0, 0, 36, 2.5);
    g.fillRect(0, 6, 36, 2.5);
    g.restore();
    if (hi) {
      g.fillStyle = hi;
      g.fillRect(x, base - 16, 1, 16);
    }
  }
}
function logCabin(g, x, base, s, lit, snow) {
  const w = 58 * s;
  const h = 30 * s;
  g.fillStyle = '#4a3220';
  g.fillRect(x, base - h, w, h);
  g.fillStyle = '#5e4028';
  for (let y = base - h + 3 * s; y < base; y += 6 * s) g.fillRect(x, y, w, 2.4 * s);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = base - h + 5.4 * s; y < base; y += 6 * s) g.fillRect(x, y, w, 0.9 * s);
  // roof
  g.fillStyle = snow ? '#e8eef6' : '#3a2a1c';
  g.beginPath();
  g.moveTo(x - 5 * s, base - h);
  g.lineTo(x + w / 2, base - h - 18 * s);
  g.lineTo(x + w + 5 * s, base - h);
  g.closePath();
  g.fill();
  if (snow) {
    g.fillStyle = '#c4ccd8';
    g.fillRect(x - 5 * s, base - h - 1, w + 10 * s, 2 * s);
  }
  // stick-and-clay chimney
  g.fillStyle = '#6a5040';
  g.fillRect(x + w - 12 * s, base - h - 20 * s, 7 * s, 22 * s);
  // door + window
  g.fillStyle = '#2a1a0e';
  g.fillRect(x + 10 * s, base - 18 * s, 9 * s, 18 * s);
  g.fillStyle = lit ? '#ffcc70' : '#1e1a16';
  g.fillRect(x + 32 * s, base - 20 * s, 10 * s, 8 * s);
  if (lit) {
    g.fillStyle = 'rgba(255,190,90,0.25)';
    g.beginPath();
    g.ellipse(x + 37 * s, base - 16 * s, 16 * s, 12 * s, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#3a2a1c';
  g.fillRect(x + 36.5 * s, base - 20 * s, 1 * s, 8 * s);
}
function brickHouse(g, x, base, s, r, lit) {
  const w = (46 + Math.floor(r() * 3) * 8) * s;
  const h = (40 + Math.floor(r() * 2) * 12) * s;
  g.fillStyle = '#8a4a34';
  g.fillRect(x, base - h, w, h);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = base - h + 3; y < base; y += 4 * s) g.fillRect(x, y, w, 1);
  // gable end with chimneys (Federal style, common in Nauvoo)
  g.fillStyle = '#5a3426';
  g.beginPath();
  g.moveTo(x - 2 * s, base - h);
  g.lineTo(x + w / 2, base - h - 16 * s);
  g.lineTo(x + w + 2 * s, base - h);
  g.closePath();
  g.fill();
  g.fillStyle = '#7a4030';
  g.fillRect(x + 2 * s, base - h - 10 * s, 6 * s, 12 * s);
  g.fillRect(x + w - 8 * s, base - h - 10 * s, 6 * s, 12 * s);
  // sash windows, white trim
  for (let wy = base - h + 8 * s; wy < base - 14 * s; wy += 16 * s) {
    for (let wx = x + 7 * s; wx < x + w - 10 * s; wx += 14 * s) {
      g.fillStyle = '#e8e0d0';
      g.fillRect(wx - 1, wy - 1, 8 * s + 2, 10 * s + 2);
      g.fillStyle = lit && r() < 0.5 ? '#ffd890' : '#3a4450';
      g.fillRect(wx, wy, 8 * s, 10 * s);
      g.fillStyle = '#e8e0d0';
      g.fillRect(wx, wy + 5 * s, 8 * s, 1);
    }
  }
  g.fillStyle = '#3a2418';
  g.fillRect(x + w / 2 - 4 * s, base - 14 * s, 8 * s, 14 * s);
  return w;
}
function nauvooTemple(g, x, base, s) {
  // limestone walls about two storeys up, with scaffolding and a crane pole (June 1844)
  const w = 150 * s;
  const h = 62 * s;
  g.fillStyle = '#d8d2c0';
  g.fillRect(x, base - h, w, h);
  // uneven top course (walls still rising)
  g.fillStyle = '#d8d2c0';
  for (let i = 0; i < 10; i++) g.fillRect(x + i * 15 * s, base - h - (i % 3) * 3 * s, 15 * s, 4 * s);
  g.fillStyle = 'rgba(120,110,90,0.25)';
  for (let y = base - h + 6 * s; y < base; y += 6 * s) g.fillRect(x, y, w, 1);
  // pilasters
  g.fillStyle = '#c4bca6';
  for (let i = 0; i <= 9; i++) g.fillRect(x + i * (w / 9) - 2 * s, base - h, 4 * s, h);
  // round-arched windows
  g.fillStyle = '#5a6070';
  for (let i = 0; i < 9; i++) {
    const wx = x + i * (w / 9) + 5 * s;
    g.fillRect(wx, base - h + 14 * s, 7 * s, 16 * s);
    g.beginPath();
    g.arc(wx + 3.5 * s, base - h + 14 * s, 3.5 * s, Math.PI, 0);
    g.fill();
    g.fillRect(wx, base - h + 40 * s, 7 * s, 12 * s);
  }
  // scaffolding
  g.strokeStyle = '#6a4a28';
  g.lineWidth = 1.5;
  for (let i = 0; i <= 6; i++) {
    const px = x - 6 * s + i * (w + 12 * s) / 6;
    g.beginPath();
    g.moveTo(px, base);
    g.lineTo(px, base - h - 14 * s);
    g.stroke();
  }
  for (let y = base - 12 * s; y > base - h - 14 * s; y -= 14 * s) {
    g.beginPath();
    g.moveTo(x - 6 * s, y);
    g.lineTo(x + w + 6 * s, y);
    g.stroke();
  }
  // crane mast + boom
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x + w * 0.7, base - h);
  g.lineTo(x + w * 0.7, base - h - 50 * s);
  g.lineTo(x + w * 0.95, base - h - 36 * s);
  g.stroke();
}
function libertyJail(g, x, base, s) {
  g.fillStyle = '#7a7a76';
  g.fillRect(x, base - 34 * s, 46 * s, 34 * s);
  g.fillStyle = 'rgba(0,0,0,0.15)';
  for (let y = base - 30 * s; y < base; y += 5 * s) g.fillRect(x, y, 46 * s, 1);
  g.fillStyle = '#e4eaf2';
  g.beginPath();
  g.moveTo(x - 3 * s, base - 34 * s);
  g.lineTo(x + 23 * s, base - 46 * s);
  g.lineTo(x + 49 * s, base - 34 * s);
  g.closePath();
  g.fill();
  g.fillStyle = '#2a2a2a';
  g.fillRect(x + 10 * s, base - 26 * s, 5 * s, 3 * s);
  g.fillRect(x + 30 * s, base - 26 * s, 5 * s, 3 * s);
}
function smoke(g, x, y, s, col) {
  for (let i = 0; i < 6; i++) {
    g.fillStyle = col.replace('A', (0.22 - i * 0.03).toFixed(2));
    g.beginPath();
    g.ellipse(x + i * 5 * s, y - i * 8 * s, (4 + i * 2) * s, (3 + i * 1.5) * s, 0, 0, Math.PI * 2);
    g.fill();
  }
}
function cloudPuffs(g, x, y, s, light, shade) {
  const puffs = [[0, 0, 30], [-26, 6, 20], [26, 4, 24], [8, -12, 20], [-10, -8, 16], [46, 8, 14]];
  g.fillStyle = shade;
  for (const [px, py, r] of puffs) {
    g.beginPath();
    g.ellipse(x + px * s, y + (py + 4) * s, r * s, r * 0.7 * s, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = light;
  for (const [px, py, r] of puffs) {
    g.beginPath();
    g.ellipse(x + px * s, y + py * s, r * s * 0.94, r * 0.62 * s, 0, 0, Math.PI * 2);
    g.fill();
  }
}

// ── chapter recipes: [{ speed, y, paint(g, r) }] painted into LW×H canvases ──
const SKIES = {
  1: [[0, '#4a86c4'], [0.45, '#8cbce0'], [0.75, '#d8e4d0'], [1, '#e8dcb0']],
  2: [[0, '#03060f'], [0.4, '#0a1328'], [0.75, '#16243a'], [1, '#1c2c34']],
  3: [[0, '#14142a'], [0.35, '#2a2a48'], [0.7, '#4a4a60'], [1, '#5a5a62']],
  4: [[0, '#05081a'], [0.45, '#121a3a'], [0.8, '#2a2a44'], [1, '#3a3036']],
  5: [[0, '#8894a8'], [0.5, '#b4bccb'], [0.85, '#d6dae2'], [1, '#e2e4ea']],
  6: [[0, '#5a8ec4'], [0.45, '#9cc0dc'], [0.78, '#f0dcb4'], [1, '#f4c890']],
  7: [[0, '#2a1c12'], [0.5, '#3a2818'], [1, '#2a1c10']],
};

const RECIPES = {
  1: [
    { speed: 0.03, paint: (g, r) => { for (let i = 0; i < 6; i++) cloudPuffs(g, i * 270 + r() * 80, 50 + r() * 60, 0.9 + r() * 0.5, 'rgba(255,255,255,0.82)', 'rgba(170,190,215,0.55)'); } },
    { speed: 0.07, paint: (g) => hillLayer(g, 300, 22, 1, '#8aa8b8', '#9ab4b8') },
    { speed: 0.12, paint: (g, r) => {
      hillLayer(g, 330, 18, 2, '#6a9060', '#5a8050');
      // patchwork fields + a distant log farmhouse with chimney smoke
      for (let i = 0; i < 9; i++) { g.fillStyle = ['rgba(200,180,90,0.35)', 'rgba(120,150,70,0.35)', 'rgba(150,120,70,0.3)'][i % 3]; g.fillRect(i * 180 + r() * 40, 330 + ridge(i * 180, 2, 18) + 6, 120 + r() * 50, 10); }
      wrapDraw(560, 80, (x) => { logCabin(g, x, 338 + ridge(560, 2, 18), 0.55, false, false); smoke(g, x + 26, 312 + ridge(560, 2, 18), 0.6, 'rgba(230,230,235,A)'); });
      railFence(g, 0, LW, 352, '#5a4a34', null);
    } },
    { speed: 0.22, paint: (g, r) => { for (let x = -20; x < LW; x += 46 + r() * 22) wrapDraw(x, 60, (xx) => deciduous(g, xx, 372, 0.9 + r() * 0.35, ['#2e5a2a', '#4a7c3a', '#7aa858', '#3a2618'], r)); } },
  ],
  2: [
    { speed: 0.02, paint: (g, r) => { for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(220,230,255,${0.3 + r() * 0.6})`; const s = r() < 0.1 ? 2 : 1; g.fillRect(r() * LW, r() * 250, s, s); } } },
    { speed: 0.06, paint: (g) => hillLayer(g, 312, 24, 3, '#12203a', '#101a28') },
    { speed: 0.12, paint: (g, r) => { hillLayer(g, 340, 16, 4, '#0c1a20', '#0a141a'); for (let x = 0; x < LW; x += 30 + r() * 30) wrapDraw(x, 40, (xx) => (r() < 0.5 ? pine(g, xx, 346, 0.7 + r() * 0.3, '#08121a', 'rgba(120,150,190,0.12)') : deciduous(g, xx, 346, 0.7 + r() * 0.3, ['#0a161c', 'rgba(110,140,180,0.10)', null, '#060c0e'], r))); } },
    { speed: 0.2, paint: (g, r) => { g.fillStyle = 'rgba(120,150,180,0.10)'; g.fillRect(0, 336, LW, 30); for (let x = 0; x < LW; x += 40 + r() * 40) wrapDraw(x, 40, (xx) => pine(g, xx, 380, 1 + r() * 0.3, '#050b0e', 'rgba(150,180,220,0.10)')); } },
  ],
  3: [
    { speed: 0.03, paint: (g, r) => { for (let i = 0; i < 7; i++) cloudPuffs(g, i * 240 + r() * 60, 40 + r() * 70, 1.2 + r() * 0.6, 'rgba(70,70,100,0.9)', 'rgba(30,30,50,0.8)'); } },
    { speed: 0.08, paint: (g) => hillLayer(g, 318, 26, 5, '#3c4258', '#363c4c', [1, 3, 4]) },
    { speed: 0.15, paint: (g, r) => { hillLayer(g, 344, 22, 6, '#2c3436', '#262c2c', [2, 3, 6]); for (let x = 0; x < LW; x += 60 + r() * 50) wrapDraw(x, 40, (xx) => deciduous(g, xx, 352 + ridge(xx, 6, 22) * 0.2, 0.7, ['#1e2a24', '#2e3c32', null, '#141a16'], r)); } },
  ],
  4: [
    { speed: 0.02, paint: (g, r) => { for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(220,230,255,${0.25 + r() * 0.5})`; g.fillRect(r() * LW, r() * 220, 1.5, 1.5); } } },
    { speed: 0.06, paint: (g) => hillLayer(g, 296, 14, 7, '#1a2240', '#161c30', [1, 2, 3]) },
    { speed: 0.13, paint: (g, r) => {
      hillLayer(g, 318, 8, 8, '#14182a', '#121624', [1, 3, 5]);
      // Missouri settlement: log cabins with lit windows and chimney smoke
      for (let x = 30; x < LW; x += 150 + r() * 80) wrapDraw(x, 70, (xx) => { logCabin(g, xx, 322, 0.7, true, false); smoke(g, xx + 36, 284, 0.6, 'rgba(150,150,170,A)'); });
      railFence(g, 0, LW, 330, '#2a2420', null);
    } },
    { speed: 0.24, paint: (g, r) => { for (let x = 0; x < LW; x += 120 + r() * 120) wrapDraw(x, 50, (xx) => deciduous(g, xx, 360, 1, ['#0c1218', '#141c26', null, '#080a0c'], r)); } },
  ],
  5: [
    { speed: 0.03, paint: (g, r) => { for (let i = 0; i < 6; i++) cloudPuffs(g, i * 280 + r() * 60, 50 + r() * 40, 1.4, 'rgba(230,234,242,0.7)', 'rgba(160,168,186,0.55)'); } },
    { speed: 0.07, paint: (g) => hillLayer(g, 300, 20, 9, '#c8d0dc', '#b8c2d0') },
    { speed: 0.13, paint: (g, r) => {
      hillLayer(g, 326, 14, 10, '#e4e9f0', '#ccd4de');
      for (let x = 60; x < LW; x += 360) wrapDraw(x, 70, (xx) => { logCabin(g, xx, 334, 0.6, true, true); smoke(g, xx + 30, 300, 0.6, 'rgba(120,124,140,A)'); });
      wrapDraw(1300, 60, (xx) => libertyJail(g, xx, 334, 0.9));
      for (let x = 0; x < LW; x += 50 + r() * 40) wrapDraw(x, 40, (xx) => bareTree(g, xx, 336, 0.6 + r() * 0.3, '#5a5450', r));
    } },
    { speed: 0.22, paint: (g, r) => {
      // frozen river with ice sheets
      const gr = g.createLinearGradient(0, 352, 0, 392);
      gr.addColorStop(0, '#9ab0c4');
      gr.addColorStop(1, '#7a92a8');
      g.fillStyle = gr;
      g.fillRect(0, 352, LW, 40);
      for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(240,246,252,0.6)'; g.fillRect(r() * LW, 356 + r() * 30, 30 + r() * 60, 2); }
      g.fillStyle = '#eef2f6';
      g.fillRect(0, 348, LW, 6);
      for (let x = 0; x < LW; x += 70 + r() * 60) wrapDraw(x, 40, (xx) => bareTree(g, xx, 352, 0.9 + r() * 0.3, '#3e3836', r));
    } },
  ],
  6: [
    { speed: 0.03, paint: (g, r) => { for (let i = 0; i < 5; i++) cloudPuffs(g, i * 320 + r() * 80, 50 + r() * 50, 1, 'rgba(255,250,240,0.8)', 'rgba(220,180,150,0.5)'); } },
    { speed: 0.06, paint: (g) => { hillLayer(g, 280, 10, 11, '#8ea4ae', '#90a4a8', [1, 2, 4]); /* Iowa bluffs across the river */ } },
    { speed: 0.1, paint: (g, r) => {
      // the Mississippi: wide, with light on the water
      const gr = g.createLinearGradient(0, 288, 0, 330);
      gr.addColorStop(0, '#9ab8c8');
      gr.addColorStop(1, '#5a849c');
      g.fillStyle = gr;
      g.fillRect(0, 288, LW, 42);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,240,210,${0.25 + r() * 0.3})`; g.fillRect(r() * LW, 292 + r() * 34, 14 + r() * 26, 1.5); }
      // the bluff with the temple rising (scaffolded, unfinished in 1844)
      hillLayer(g, 316, 6, 12, '#7a8a5a', '#6a7a4a', [1, 2, 3]);
      g.fillStyle = '#6a7a4a';
      g.beginPath();
      g.moveTo(1040, 330); g.quadraticCurveTo(1150, 262, 1300, 262); g.quadraticCurveTo(1440, 262, 1540, 330); g.closePath(); g.fill();
      nauvooTemple(g, 1222, 266, 0.85);
    } },
    { speed: 0.2, paint: (g, r) => {
      let x = 10;
      while (x < LW - 60) { const w = brickHouse(g, x, 360, 0.95, r, false); x += w + 40 + r() * 60; if (r() < 0.5) { deciduous(g, x - 22, 362, 0.8, ['#4a6a2a', '#6a8a3a', null, '#3a2618'], r); } }
    } },
  ],
  7: [
    { speed: 0.12, paint: (g, r) => {
      // Carthage Jail, upper room: plastered wall, chair rail, sash windows (summer evening outside)
      g.fillStyle = '#b8a888';
      g.fillRect(0, 60, LW, 340);
      g.fillStyle = 'rgba(90,70,40,0.12)';
      for (let i = 0; i < 60; i++) g.fillRect(r() * LW, 60 + r() * 300, 20 + r() * 60, 2);
      g.fillStyle = '#6a4a2a';
      g.fillRect(0, 300, LW, 8);
      g.fillStyle = '#8a6a44';
      g.fillRect(0, 308, LW, 100);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let x = 0; x < LW; x += 54) g.fillRect(x, 308, 2, 100);
      g.fillStyle = '#4a3018';
      g.fillRect(0, 60, LW, 10);
      for (let x = 120; x < LW; x += 540) {
        // window frame + evening sky + treetops
        g.fillStyle = '#e6dcc4';
        g.fillRect(x - 6, 120, 92, 140);
        const sky = g.createLinearGradient(0, 126, 0, 254);
        sky.addColorStop(0, '#f0c890');
        sky.addColorStop(1, '#c88a58');
        g.fillStyle = sky;
        g.fillRect(x, 126, 80, 128);
        g.fillStyle = '#4a5a34';
        for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(x + 8 + i * 17, 236, 14, 16, 0, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#e6dcc4';
        g.fillRect(x + 38, 126, 4, 128);
        g.fillRect(x, 188, 80, 4);
        g.fillRect(x, 156, 80, 2);
        g.fillRect(x, 220, 80, 2);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x - 6, 260, 92, 6);
      }
      // a door frame and a bed against the wall (the jailer's bedroom upstairs)
      g.fillStyle = '#5a3a1e';
      g.fillRect(400, 160, 70, 148);
      g.fillStyle = '#3a2410';
      g.fillRect(408, 168, 54, 140);
      g.fillStyle = '#6a4a2a';
      g.fillRect(880, 270, 130, 30);
      g.fillStyle = '#e8e0cc';
      g.fillRect(884, 262, 122, 12);
    } },
  ],
};

function skyCanvas(n) {
  return layerFor('sky' + n, () => {
    const c = mk(4, H);
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H);
    for (const [t, col] of SKIES[n] || SKIES[1]) gr.addColorStop(t, col);
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, H);
    return c;
  });
}
function layerFor(key, build) {
  let c = layers.get(key);
  if (!c) {
    c = build();
    layers.set(key, c);
  }
  return c;
}

export function hasParallax(level) {
  return !!RECIPES[level.num];
}

/** Draw the painted backdrop for a chapter. Returns false if there is no recipe. */
/**
 * Everything that does not move with the camera (sky, sun/moon) is flattened once into a
 * screen-sized canvas, so a frame's backdrop is one blit plus the scrolling layers.
 */
function sunSprite() {
  return layerFor('sun', () => {
    const c = mk(440, 300);
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(220, 70, 4, 220, 70, 220);
    gr.addColorStop(0, 'rgba(255,250,225,0.9)');
    gr.addColorStop(0.12, 'rgba(255,240,200,0.45)');
    gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 440, 300);
    return c;
  });
}
function moonSprite() {
  return layerFor('moon', () => {
    const c = mk(260, 220);
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(130, 80, 10, 130, 80, 120);
    gr.addColorStop(0, 'rgba(230,236,255,0.35)');
    gr.addColorStop(1, 'rgba(230,236,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 260, 220);
    g.fillStyle = '#eef0e2';
    g.beginPath();
    g.arc(130, 80, 20, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(180,184,170,0.5)';
    g.beginPath();
    g.arc(124, 76, 5, 0, Math.PI * 2);
    g.arc(137, 86, 3.5, 0, Math.PI * 2);
    g.fill();
    return c;
  });
}
/** Trim a painted layer to the rows that hold pixels (transparent sky rows cost fill-rate). */
function trimLayer(cv) {
  let y0 = 0;
  let y1 = cv.height;
  try {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const rowHas = (y) => {
      for (let x = 0; x < cv.width; x += 3) if (d[(y * cv.width + x) * 4 + 3] > 2) return true;
      return false;
    };
    while (y0 < cv.height && !rowHas(y0)) y0++;
    y1 = Math.min(cv.height, GY + 8); // everything below the ground line is hidden by tiles
    while (y1 > y0 && !rowHas(y1 - 1)) y1--;
  } catch (_) {
    return { cv, y0: 0 };
  }
  if (y1 <= y0) return { cv: mk(1, 1), y0: 0, empty: true };
  const out = mk(cv.width, y1 - y0);
  out.getContext('2d').drawImage(cv, 0, -y0);
  return { cv: out, y0 };
}

function staticBackdrop(n) {
  return layerFor('static' + n, () => {
    const c = mk(W, H);
    const g = c.getContext('2d');
    g.drawImage(skyCanvas(n), 0, 0, W, H);
    if (n === 1 || n === 6) g.drawImage(sunSprite(), (n === 1 ? 180 : 860) - 220, 0);
    else if (n === 2 || n === 4) g.drawImage(moonSprite(), (n === 2 ? 760 : 300) - 130, 0);
    return c;
  });
}
function paintedLayer(n, i, L) {
  return layerFor(`L${n}-${i}`, () => {
    const cv = mk(LW, H);
    L.paint(cv.getContext('2d'), rng(n * 1000 + i * 77 + 13));
    return trimLayer(cv);
  });
}
function blitLayer(ctx, t, off) {
  if (t.empty) return;
  ctx.drawImage(t.cv, -off, t.y0);
  if (LW - off < W) ctx.drawImage(t.cv, LW - off, t.y0);
}
const FAR_SPEED = 0.09; // layers this slow move ≤1 px per ~30 px of camera
/**
 * Sky + sun/moon + the slowest layer(s) flattened into one screen canvas, re-painted only
 * when the far layer has actually moved a whole pixel: most frames the backdrop is one blit.
 */
const backdrops = new Map();
function backdrop(n, rec, camX) {
  const far = rec.map((L, i) => [L, i]).filter(([L]) => L.speed <= FAR_SPEED);
  const offs = far.map(([L]) => Math.round((((camX * L.speed) % LW) + LW) % LW));
  const key = offs.join(',');
  let b = backdrops.get(n);
  if (!b) {
    b = { c: mk(W, H), key: null };
    backdrops.set(n, b);
  }
  if (b.key !== key) {
    const g = b.c.getContext('2d');
    g.drawImage(staticBackdrop(n), 0, 0);
    far.forEach(([L, i], k) => blitLayer(g, paintedLayer(n, i, L), offs[k]));
    b.key = key;
  }
  return b.c;
}

export function drawParallax(ctx, camX, level, tick = 0) {
  const n = level.num;
  const rec = RECIPES[n];
  if (!rec) return false;
  ctx.drawImage(backdrop(n, rec, camX), 0, 0);
  rec.forEach((L, i) => {
    if (L.speed <= FAR_SPEED) return; // already in the backdrop
    blitLayer(ctx, paintedLayer(n, i, L), Math.round((((camX * L.speed) % LW) + LW) % LW));
  });
  // ch6 river shimmer + ch3 lightning (cheap, live)
  if (n === 6) {
    ctx.fillStyle = 'rgba(255,246,220,0.35)';
    for (let i = 0; i < 14; i++) {
      const x = ((i * 97 + tick * 0.4 - camX * 0.1) % W + W) % W;
      ctx.fillRect(x, 294 + ((i * 13) % 32), 10 + (i % 3) * 8, 1.5);
    }
  }
  return true;
}

// ── ground tiles (cached per chapter) ───────────────────────
const TILE_LOOK = {
  1: { top: ['#3d7a32', '#5a9a40', '#86c060'], soil: ['#7a4e2a', '#5e3a1e', '#9a6a3a'] },
  2: { top: ['#1e4428', '#2c5a34', '#3e7048'], soil: ['#3a2a18', '#2a1e10', '#4a3824'] },
  3: { top: ['#3e5040', '#4e6450', '#6a7c62'], soil: ['#4a3a2a', '#382a1e', '#5e4a36'] },
  4: { top: ['#5a4a38', '#6e5c44', '#857056'], soil: ['#4a3a2a', '#382a1e', '#5a4834'] },
  5: { top: ['#dfe6ee', '#f2f6fa', '#ffffff'], soil: ['#5a4a3a', '#46382a', '#6e5c48'], snow: true },
  6: { top: ['#9a7e58', '#b0946a', '#c8ac80'], soil: ['#7a5a3a', '#624628', '#8e6c48'] },
  7: { floor: true },
};
export function groundTile(n, isTop, variant) {
  const L = TILE_LOOK[n];
  if (!L) return null;
  return layerFor(`T${n}${isTop ? 't' : 'b'}${variant}`, () => {
    const c = mk(TILE, TILE + 6);
    const g = c.getContext('2d');
    const r = rng(n * 131 + variant * 17 + (isTop ? 7 : 3));
    if (L.floor) {
      // plank floor (Carthage Jail upper room)
      g.fillStyle = isTop ? '#7a5634' : '#4a3220';
      g.fillRect(0, 6, TILE, TILE);
      if (isTop) {
        g.fillStyle = '#9a7246';
        g.fillRect(0, 6, TILE, 3);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(0, 6 + 10, TILE, 1);
        g.fillRect(0, 6 + 21, TILE, 1);
        g.fillRect((variant * 11) % TILE, 6, 1, TILE);
      }
      return c;
    }
    g.fillStyle = L.soil[0];
    g.fillRect(0, 6, TILE, TILE);
    // strata + pebbles + roots
    for (let i = 0; i < 6; i++) {
      g.fillStyle = r() < 0.5 ? L.soil[1] : L.soil[2];
      g.fillRect(Math.floor(r() * (TILE - 4)), 6 + Math.floor(r() * TILE), 2 + Math.floor(r() * 4), 2);
    }
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, 6 + TILE - 3, TILE, 3);
    if (isTop) {
      const T = L.top;
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, 6 + 9, TILE, 3);
      g.fillStyle = T[0];
      g.fillRect(0, 6, TILE, 10);
      g.fillStyle = T[1];
      g.fillRect(0, 6, TILE, 4);
      // ragged top edge (grass blades / snow lumps) poking above the tile
      for (let x = 0; x < TILE; x += 2) {
        const h = L.snow ? 1 + Math.floor(r() * 2) : Math.floor(r() * 5);
        g.fillStyle = r() < 0.3 ? T[2] : T[1];
        g.fillRect(x, 6 - h, 2, h + 2);
      }
      g.fillStyle = T[2];
      g.fillRect(Math.floor(r() * 20), 7, 6, 1);
    }
    return c;
  });
}

/** Street buildings (decor) per chapter: Missouri log homes (ch4), Nauvoo red brick (ch6). */
export function buildingSprite(n, variant) {
  if (n !== 4 && n !== 6) return null;
  return layerFor(`BLD${n}-${variant}`, () => {
    const c = mk(150, 150);
    const g = c.getContext('2d');
    const r = rng(n * 53 + variant * 7 + 1);
    if (n === 4) {
      logCabin(g, 10, 146, 1.75 + variant * 0.12, true, false);
    } else {
      brickHouse(g, 12, 146, 1.6 + variant * 0.1, r, false);
    }
    return c;
  });
}
