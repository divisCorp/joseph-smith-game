/**
 * Wildlife foes for rural New York, 1820s (chapters 1–3), painted procedurally:
 * timber rattlesnake, bobcat, American black bear, American crow and great horned owl.
 * Each has its own silhouette, idle/move cycle, a readable wind-up pose and an attack pose.
 * They are driven off (run away), never hurt on screen.
 */
import { SCALE } from './constants.js?v=76';

const S = SCALE;
const OUT = 'rgba(20,12,6,0.85)';

function ell(g, x, y, rx, ry, col, rot = 0) {
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  g.fill();
}
function shadow(g, cx, by, rx) {
  ell(g, cx, by - 1, rx, 3.5, 'rgba(0,0,0,0.28)');
}
function flashOn(g, flash) {
  if (flash) g.filter = 'brightness(1.9) saturate(0.6)';
}

/** Leg with a thigh, shin and paw, swinging by phase (real limbs, no sliding). */
function leg(g, hx, hy, len, ph, col, paw, w) {
  const a = Math.sin(ph) * 0.55;
  const kx = hx + Math.sin(a) * len * 0.5;
  const ky = hy + Math.cos(a) * len * 0.5;
  const fx = kx + Math.sin(a - Math.max(0, Math.sin(ph + 1.2)) * 0.6) * len * 0.5;
  const fy = Math.min(hy + len, ky + len * 0.5);
  g.strokeStyle = col;
  g.lineCap = 'round';
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(hx, hy);
  g.lineTo(kx, ky);
  g.lineTo(fx, fy);
  g.stroke();
  ell(g, fx + 1.5, fy, w * 0.7, w * 0.45, paw);
}

// ── Timber rattlesnake ──────────────────────────────────────
export function drawSnake(g, x, y, w, h, facing, t, state, k, flash) {
  g.save();
  flashOn(g, flash);
  const base = y + h;
  shadow(g, x + w / 2, base, w * 0.48);
  g.translate(x + w / 2, base);
  g.scale(facing, 1);
  const pts = [];
  const N = 18;
  if (state === 'wind' || state === 'lunge') {
    // coiled S with the head raised; strike extends the neck forward
    const ext = state === 'lunge' ? 1 : 0;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const ang = u * Math.PI * 3.2;
      const r = (1 - u) * 11 * S + 3 * S;
      pts.push([-6 * S + Math.cos(ang) * r * 0.9, -4 * S - Math.abs(Math.sin(ang)) * r * 0.35]);
    }
    const hx = -2 * S + (ext ? 24 * S * Math.min(1, k * 1.6) : 4 * S);
    const hy = -14 * S + (ext ? 6 * S : -Math.sin(t * 0.9) * 1.5 * S);
    pts.push([hx * 0.5, hy * 0.9], [hx, hy]);
  } else {
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      pts.push([(-w / 2 + 4 * S) + u * (w - 10 * S), -4 * S + Math.sin(u * Math.PI * 2.4 - t * 0.35) * 3 * S]);
    }
    pts.push([w / 2 - 2 * S, -6 * S]);
  }
  // body: outline pass, then banded fill pass
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < pts.length; i++) {
      const u = i / pts.length;
      const lw = (pass ? 6.2 : 8) * S * (0.45 + 0.55 * Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.85 + 0.25));
      g.strokeStyle = pass ? (Math.floor(i / 2) % 2 ? '#c8a25a' : '#3a2a18') : OUT;
      g.lineCap = 'round';
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(pts[i - 1][0], pts[i - 1][1]);
      g.lineTo(pts[i][0], pts[i][1]);
      g.stroke();
    }
  }
  // belly highlight
  g.strokeStyle = 'rgba(255,230,170,0.35)';
  g.lineWidth = 1.2;
  g.beginPath();
  pts.slice(2, -2).forEach(([px, py], i) => (i ? g.lineTo(px, py - 1.5 * S) : g.moveTo(px, py - 1.5 * S)));
  g.stroke();
  // black tail + rattle (shakes during the wind-up)
  // rattle sits at the tail tip: first point when crawling, the coil's outer end when coiled
  const tail = pts[0];
  const dir = state === 'wind' || state === 'lunge' ? -1 : -1;
  const shake = state === 'wind' ? Math.sin(t * 2.4) * 2 * S : 0;
  const tx = tail[0] + (state === 'wind' || state === 'lunge' ? -2 * S : -2 * S);
  const ty = tail[1] + shake;
  ell(g, tx, ty, 2.2 * S, 1.6 * S, '#d8c08a');
  ell(g, tx - 2.2 * S, ty - 0.6 * S, 1.6 * S, 1.2 * S, '#c4a878');
  ell(g, tx - 4 * S, ty - 1.2 * S, 1.2 * S, 0.9 * S, '#1a120a');
  // head: broad, triangular, with heat-pit eye and flicking tongue
  const [hx, hy] = pts[pts.length - 1];
  g.fillStyle = OUT;
  g.beginPath();
  g.moveTo(hx - 3 * S, hy - 3.6 * S);
  g.quadraticCurveTo(hx + 6 * S, hy - 3.4 * S, hx + 7 * S, hy);
  g.quadraticCurveTo(hx + 6 * S, hy + 3.4 * S, hx - 3 * S, hy + 3.6 * S);
  g.closePath();
  g.fill();
  g.fillStyle = '#8a6a3a';
  g.beginPath();
  g.moveTo(hx - 2 * S, hy - 2.6 * S);
  g.quadraticCurveTo(hx + 5 * S, hy - 2.6 * S, hx + 6 * S, hy);
  g.quadraticCurveTo(hx + 5 * S, hy + 2.4 * S, hx - 2 * S, hy + 2.6 * S);
  g.closePath();
  g.fill();
  g.fillStyle = '#3a2a18';
  g.fillRect(hx - 1 * S, hy - 2.4 * S, 5 * S, 1 * S);
  ell(g, hx + 2.6 * S, hy - 1.2 * S, 1 * S, 0.9 * S, state === 'wind' ? '#ffe08a' : '#e8c060');
  ell(g, hx + 2.8 * S, hy - 1.2 * S, 0.35 * S, 0.8 * S, '#1a0e06');
  if (Math.floor(t / 10) % 3 === 0 || state === 'wind') {
    g.strokeStyle = '#c03838';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(hx + 7 * S, hy + 0.5);
    g.lineTo(hx + 10 * S, hy + 0.5);
    g.lineTo(hx + 11.5 * S, hy - 1);
    g.moveTo(hx + 10 * S, hy + 0.5);
    g.lineTo(hx + 11.5 * S, hy + 2);
    g.stroke();
  }
  g.restore();
}

// ── Bobcat ─────────────────────────────────────────────────
export function drawBobcat(g, x, y, w, h, facing, t, state, k, flash, moving, air) {
  g.save();
  flashOn(g, flash);
  const base = y + h;
  if (!air) shadow(g, x + w / 2, base, w * 0.42);
  g.translate(x + w / 2, base);
  g.scale(facing, 1);
  const crouch = state === 'wind' ? 4 * S * Math.min(1, k * 1.5) : 0;
  const stretch = state === 'lunge' ? 1 : 0;
  const ph = moving ? t * 0.45 : 0;
  const bodyY = -15 * S + crouch;
  const coat = '#b98a52';
  const dark = '#8a6034';
  // far legs
  if (stretch) {
    leg(g, -10 * S, bodyY + 2 * S, 12 * S, -1.4, dark, '#6a4626', 3.4 * S);
    leg(g, 9 * S, bodyY + 2 * S, 12 * S, 1.6, dark, '#6a4626', 3.4 * S);
  } else {
    leg(g, -9 * S, bodyY + 3 * S, 13 * S - crouch, ph + Math.PI, dark, '#6a4626', 3.4 * S);
    leg(g, 9 * S, bodyY + 3 * S, 13 * S - crouch, ph, dark, '#6a4626', 3.4 * S);
  }
  // body
  ell(g, 0, bodyY, (14 + stretch * 3) * S, 6.6 * S, OUT);
  ell(g, 0, bodyY, (13 + stretch * 3) * S, 5.8 * S, coat);
  ell(g, -1 * S, bodyY + 2.6 * S, 10 * S, 2.6 * S, '#e8d2a8'); // pale belly
  for (let i = 0; i < 9; i++) ell(g, -10 * S + i * 2.6 * S, bodyY - 2 * S + ((i * 7) % 5) * 0.9 * S, 0.9 * S, 0.7 * S, '#5a3a1c');
  // bobbed tail, black-tipped
  ell(g, -14 * S, bodyY - 3 * S - (state === 'wind' ? Math.sin(t * 1.3) * 1.5 * S : 0), 3 * S, 2 * S, coat, -0.6);
  ell(g, -16 * S, bodyY - 4.2 * S, 1.3 * S, 1.3 * S, '#1a120a');
  // near legs
  if (stretch) {
    leg(g, -8 * S, bodyY + 3 * S, 12 * S, -1.2, coat, '#7a5430', 3.8 * S);
    leg(g, 11 * S, bodyY + 3 * S, 12 * S, 1.4, coat, '#7a5430', 3.8 * S);
  } else {
    leg(g, -7 * S, bodyY + 3.5 * S, 13 * S - crouch, ph, coat, '#7a5430', 3.8 * S);
    leg(g, 11 * S, bodyY + 3.5 * S, 13 * S - crouch, ph + Math.PI, coat, '#7a5430', 3.8 * S);
  }
  // head with ruff, tufted ears
  const hx = 14 * S + stretch * 4 * S;
  const hy = bodyY - 4 * S + crouch * 0.4;
  ell(g, hx, hy, 6.4 * S, 5.6 * S, OUT);
  ell(g, hx, hy, 5.7 * S, 5 * S, coat);
  ell(g, hx - 3 * S, hy + 2.5 * S, 3 * S, 3 * S, '#e8d8b8'); // ruff
  ell(g, hx + 3.6 * S, hy + 1.4 * S, 2.6 * S, 2 * S, '#f0e0c4'); // muzzle
  ell(g, hx + 5.6 * S, hy + 0.6 * S, 0.9 * S, 0.7 * S, '#2a1a10'); // nose
  for (const ex of [-2.2, 1.4]) {
    g.fillStyle = OUT;
    g.beginPath();
    g.moveTo(hx + ex * S - 1.8 * S, hy - 3.6 * S);
    g.lineTo(hx + ex * S + 0.4 * S, hy - 9 * S);
    g.lineTo(hx + ex * S + 2.2 * S, hy - 3.6 * S);
    g.closePath();
    g.fill();
    g.fillStyle = '#1a120a';
    g.fillRect(hx + ex * S, hy - 10.5 * S, 0.8 * S, 2 * S); // tuft
  }
  ell(g, hx + 2.2 * S, hy - 1 * S, 1.2 * S, (state === 'wind' ? 0.9 : 1.1) * S, state === 'wind' ? '#ffe070' : '#d8c050');
  ell(g, hx + 2.4 * S, hy - 1 * S, 0.4 * S, 0.9 * S, '#120a04');
  g.restore();
}

// ── American black bear ─────────────────────────────────────
export function drawBear(g, x, y, w, h, facing, t, state, k, flash, moving) {
  g.save();
  flashOn(g, flash);
  const base = y + h;
  shadow(g, x + w / 2, base, w * 0.46);
  g.translate(x + w / 2, base);
  g.scale(facing, 1);
  const rear = state === 'wind' ? Math.min(1, k * 1.4) : 0;
  const ph = moving || state === 'lunge' ? t * (state === 'lunge' ? 0.5 : 0.28) : 0;
  const fur = '#2a221e';
  const furHi = '#4a3e36';
  const bodyY = -22 * S - rear * 4 * S;
  // far legs
  leg(g, -14 * S, bodyY + 6 * S, 17 * S, ph + Math.PI, '#1a1410', '#120e0a', 6.5 * S);
  leg(g, 12 * S, bodyY + 6 * S + rear * 2 * S, 17 * S + rear * 2 * S, ph, '#1a1410', '#120e0a', 6.5 * S);
  // body: big rounded hump
  g.save();
  g.rotate(-rear * 0.18);
  ell(g, 0, bodyY, 23 * S, 13 * S, OUT);
  ell(g, 0, bodyY, 22 * S, 12 * S, fur);
  ell(g, -4 * S, bodyY - 6 * S, 14 * S, 5 * S, furHi); // shoulder light
  ell(g, 6 * S, bodyY - 8 * S, 8 * S, 4 * S, furHi);
  g.restore();
  // near legs
  leg(g, -12 * S, bodyY + 7 * S, 17 * S, ph, fur, '#16110c', 7 * S);
  leg(g, 14 * S, bodyY + 7 * S + rear * 2 * S, 17 * S + rear * 2 * S, ph + Math.PI, fur, '#16110c', 7 * S);
  // head with tan muzzle and round ears
  const hx = 22 * S + rear * 2 * S;
  const hy = bodyY - 2 * S - rear * 6 * S + (state === 'lunge' ? 4 * S : 0);
  ell(g, hx, hy, 9 * S, 8 * S, OUT);
  ell(g, hx, hy, 8.2 * S, 7.2 * S, fur);
  ell(g, hx - 4 * S, hy - 7 * S, 3 * S, 3 * S, fur);
  ell(g, hx + 2 * S, hy - 7.4 * S, 3 * S, 3 * S, fur);
  ell(g, hx + 6 * S, hy + 2 * S, 5 * S, 3.8 * S, '#a07a52'); // muzzle
  ell(g, hx + 10 * S, hy + 1 * S, 1.6 * S, 1.3 * S, '#0e0a08');
  if (state === 'wind') {
    // huff: mouth opens a little (no teeth detail; family friendly)
    ell(g, hx + 7 * S, hy + 4.6 * S, 2.6 * S, 1.2 * S * (0.5 + 0.5 * Math.sin(t * 0.5)), '#5a2a22');
  }
  ell(g, hx + 2 * S, hy - 2 * S, 1.2 * S, 1.2 * S, '#d8c0a0');
  ell(g, hx + 2.2 * S, hy - 2 * S, 0.6 * S, 0.7 * S, '#0a0604');
  g.restore();
}

// ── Crow (day) / great horned owl (night) ───────────────────
export function drawBird(g, x, y, w, h, facing, t, state, k, flash, owl) {
  g.save();
  flashOn(g, flash);
  g.translate(x + w / 2, y + h / 2);
  g.scale(facing, 1);
  const swoop = state === 'lunge';
  if (swoop) g.rotate(0.45);
  const flapRate = state === 'wind' ? 0.9 : 0.35;
  const f = swoop ? -0.2 : Math.sin(t * flapRate);
  const body = owl ? '#6a5236' : '#16161c';
  const wing = owl ? '#5a4228' : '#0e0e14';
  const hi = owl ? '#a08460' : '#3a3a4a';
  // far wing
  g.fillStyle = wing;
  g.beginPath();
  g.moveTo(-2 * S, -1 * S);
  g.quadraticCurveTo(-10 * S, (-8 - f * 8) * S, -18 * S, (-4 - f * 10) * S);
  g.quadraticCurveTo(-10 * S, (-1 - f * 2) * S, -2 * S, 2 * S);
  g.fill();
  // body + tail
  ell(g, 0, 0, (owl ? 8 : 9) * S, (owl ? 6.5 : 4.6) * S, OUT);
  ell(g, 0, 0, (owl ? 7.3 : 8.3) * S, (owl ? 5.8 : 3.9) * S, body);
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(-7 * S, -1 * S);
  g.lineTo(-14 * S, owl ? 1 * S : -2 * S);
  g.lineTo(-13 * S, owl ? 4 * S : 3 * S);
  g.lineTo(-6 * S, 2 * S);
  g.closePath();
  g.fill();
  if (owl) for (let i = 0; i < 5; i++) ell(g, -3 * S + i * 1.6 * S, 1.5 * S + (i % 2) * S, 1.1 * S, 0.5 * S, '#d8c4a0');
  // head
  const hx = (owl ? 5 : 8) * S;
  const hy = (owl ? -4 : -2) * S;
  ell(g, hx, hy, (owl ? 5.4 : 4) * S, (owl ? 5 : 3.6) * S, OUT);
  ell(g, hx, hy, (owl ? 4.8 : 3.4) * S, (owl ? 4.4 : 3) * S, body);
  if (owl) {
    // ear tufts + facial disc + big eyes
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(hx - 3 * S, hy - 3 * S);
    g.lineTo(hx - 4 * S, hy - 8 * S);
    g.lineTo(hx - 0.5 * S, hy - 4 * S);
    g.moveTo(hx + 1.5 * S, hy - 4 * S);
    g.lineTo(hx + 2.5 * S, hy - 8.4 * S);
    g.lineTo(hx + 4 * S, hy - 3 * S);
    g.fill();
    ell(g, hx + 1 * S, hy + 0.5 * S, 3.8 * S, 3.2 * S, '#b89870');
    for (const ex of [-0.8, 2.6]) {
      ell(g, hx + ex * S, hy, 1.4 * S, 1.4 * S, state === 'wind' ? '#ffd040' : '#e8b030');
      ell(g, hx + ex * S + 0.2 * S, hy, 0.6 * S, 0.7 * S, '#120a04');
    }
    ell(g, hx + 1 * S, hy + 1.8 * S, 0.7 * S, 1 * S, '#3a2a1a');
  } else {
    g.fillStyle = '#2a2a30';
    g.beginPath();
    g.moveTo(hx + 2.6 * S, hy - 1 * S);
    g.lineTo(hx + 7.4 * S, hy + 0.4 * S);
    g.lineTo(hx + 2.6 * S, hy + 1.4 * S);
    g.closePath();
    g.fill();
    ell(g, hx + 1.4 * S, hy - 0.8 * S, 0.8 * S, 0.8 * S, state === 'wind' ? '#ffe080' : '#d8d8e0');
  }
  // near wing with feather highlights
  g.fillStyle = wing;
  g.beginPath();
  g.moveTo(-1 * S, 0);
  g.quadraticCurveTo(-7 * S, (-6 - f * 10) * S, (-16 + f * 2) * S, (-2 - f * 13) * S);
  g.quadraticCurveTo(-8 * S, (1 - f * 3) * S, 1 * S, 3 * S);
  g.fill();
  g.strokeStyle = hi;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-3 * S, (-1 - f * 3) * S);
  g.lineTo((-12 + f * 2) * S, (-2 - f * 10) * S);
  g.stroke();
  if (swoop) {
    // talons forward
    g.strokeStyle = owl ? '#c8a050' : '#3a3a40';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(2 * S, 4 * S);
    g.lineTo(5 * S, 8 * S);
    g.moveTo(-1 * S, 4 * S);
    g.lineTo(2 * S, 8.4 * S);
    g.stroke();
  }
  g.restore();
}

/** Period props for human mob variants (drawn over the existing painted foes). */
export function drawTorchProp(g, hx, hy, facing, t) {
  g.save();
  g.translate(hx, hy);
  g.scale(facing, 1);
  g.strokeStyle = '#4a2e14';
  g.lineWidth = 3.4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, 6);
  g.lineTo(6, -18);
  g.stroke();
  g.fillStyle = '#2a1a0a';
  g.fillRect(3.5, -22, 6, 5);
  const fl = Math.sin(t * 0.5) * 1.5;
  ell(g, 7, -29 + fl * 0.3, 6 + fl * 0.3, 9, 'rgba(255,140,40,0.85)');
  ell(g, 7, -27, 3.8, 6, 'rgba(255,214,110,0.95)');
  ell(g, 7, -25, 2, 3, '#fff6d0');
  g.restore();
}
export function drawClubProp(g, hx, hy, facing, raised) {
  g.save();
  g.translate(hx, hy);
  g.scale(facing, 1);
  g.rotate(raised ? -2.1 : -0.35);
  g.strokeStyle = OUT;
  g.lineCap = 'round';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, -26);
  g.stroke();
  g.strokeStyle = '#7a5430';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, -26);
  g.stroke();
  g.strokeStyle = '#9a7048';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(-1.2, -4);
  g.lineTo(-1.2, -24);
  g.stroke();
  g.restore();
}
export function drawMusketProp(g, hx, hy, facing) {
  // carried at shoulder arms (Missouri militia guard); never fired in the game
  g.save();
  g.translate(hx, hy);
  g.scale(facing, 1);
  g.rotate(-1.25);
  g.fillStyle = '#5a3a1e';
  g.fillRect(-2, -4, 18, 5);
  g.fillStyle = '#4a4a50';
  g.fillRect(14, -3, 30, 2.4);
  g.fillStyle = '#2a2a2e';
  g.fillRect(6, -5, 4, 2);
  g.restore();
}
