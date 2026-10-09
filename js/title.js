/**
 * Title backdrop: a full-bleed, painted "golden hour at the Smith farm" scene drawn on
 * its own canvas (#title-bg) so it fills any screen shape (no letterbox bars).
 * Layers, back to front: chapter-1 parallax + farm, warm grade, sun bloom and light
 * shafts, the rigged Joseph, painted grove trees framing the edges (parallax), drifting
 * motes, ambient leaves, vignette. A gentle camera drift plus pointer parallax gives depth.
 */
import { W, H, STATES } from './constants.js?v=75';
import { createLevel, drawLevelBackground, drawLevelTiles } from './level.js?v=75';
import { createPlayer, drawPlayer } from './player.js?v=75';
import { fxUpdate, drawFxBack, drawFxFront, drawFxForegroundGrass } from './fx.js?v=75';
import { reduceFlash } from './save.js?v=75';

let cv = null;
let ctx = null;
let level = null;
let joe = null;
let fxg = null;
let frameL = null;
let frameR = null;
let motes = null;
let rays = null;
let vig = null;
let frames = null;
let mote = null;
// the graded farm (parallax + tiles + grade + sun bloom) is re-painted only when the
// camera has moved a little or ~110 ms passed: its motion is slow, the grade is costly
const bg = { c: null, n: 0, cam: -1e9, q: 1 };
let shown = false;
let t0 = 0;
const ptr = { x: 0, y: 0, sx: 0, sy: 0 };

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** One painted grove cluster (trunks, canopy, undergrowth) lit from the inner side. */
function paintCluster(side, seed) {
  const HH = 960; // painted at 2× of the 480 design height
  const WW = Math.round(HH * 0.62);
  const c = document.createElement('canvas');
  c.width = WW;
  c.height = HH;
  const g = c.getContext('2d');
  const R = rng(seed);
  if (side < 0) {
    g.translate(WW, 0);
    g.scale(-1, 1);
  }
  // everything below is painted as the LEFT cluster (light comes from the right)
  const trunk = (x0, w0, w1, lean, col, blur, rim) => {
    g.save();
    if (blur) g.filter = `blur(${blur}px)`;
    const path = () => {
      g.beginPath();
      g.moveTo(x0 - w0 * 0.9, HH * 1.01);
      g.quadraticCurveTo(x0 - w0 / 2, HH * 0.97, x0 - w0 / 2, HH * 0.86);
      g.bezierCurveTo(x0 - w0 / 2 + lean * 0.3, HH * 0.55, x0 - w1 / 2 + lean * 0.8, HH * 0.25, x0 - w1 / 2 + lean, -10);
      g.lineTo(x0 + w1 / 2 + lean, -10);
      g.bezierCurveTo(x0 + w1 / 2 + lean * 0.8, HH * 0.25, x0 + w0 / 2 + lean * 0.3, HH * 0.55, x0 + w0 / 2, HH * 0.86);
      g.quadraticCurveTo(x0 + w0 / 2, HH * 0.97, x0 + w0 * 0.9, HH * 1.01);
      g.closePath();
    };
    path();
    g.fillStyle = col;
    g.fill();
    if (rim) {
      g.clip();
      g.filter = 'none';
      // bark: soft vertical furrows
      for (let i = 0; i < 40; i++) {
        const y = R() * HH, h = 30 + R() * 90, u = (R() - 0.5) * w1 * 0.9 + lean * (1 - y / HH);
        g.strokeStyle = R() < 0.7 ? 'rgba(0,0,0,0.30)' : 'rgba(150,170,150,0.07)';
        g.lineWidth = 1.5 + R() * 2.5;
        g.beginPath();
        g.moveTo(x0 + u, y);
        g.quadraticCurveTo(x0 + u + 4, y + h / 2, x0 + u, y + h);
        g.stroke();
      }
      const cg = g.createLinearGradient(x0 - w0 / 2, 0, x0 + w0 / 2, 0);
      cg.addColorStop(0, 'rgba(90,120,130,0.20)');
      cg.addColorStop(0.3, 'rgba(0,0,0,0)');
      g.fillStyle = cg;
      g.fillRect(0, 0, WW, HH);
      // warm rim on the edge that faces the clearing
      const edge = () => {
        g.beginPath();
        g.moveTo(x0 + w0 * 0.9, HH * 1.01);
        g.quadraticCurveTo(x0 + w0 / 2, HH * 0.97, x0 + w0 / 2, HH * 0.86);
        g.bezierCurveTo(x0 + w0 / 2 + lean * 0.3, HH * 0.55, x0 + w1 / 2 + lean * 0.8, HH * 0.25, x0 + w1 / 2 + lean, -10);
      };
      g.globalCompositeOperation = 'lighter';
      g.filter = 'blur(14px)';
      edge();
      g.strokeStyle = `rgba(220,140,60,${rim * 0.32})`;
      g.lineWidth = w0 * 0.42;
      g.stroke();
      g.filter = 'blur(2px)';
      edge();
      g.strokeStyle = `rgba(255,214,150,${rim})`;
      g.lineWidth = Math.max(3, w0 * 0.07);
      g.stroke();
    }
    g.restore();
  };
  // hazy trunk set back in the trees
  trunk(WW * 0.52, 58, 38, -46, '#101c17', 1.5, 0.5);
  // the big near trunk
  trunk(WW * 0.2, 150, 96, 70, '#0c1612', 0, 0.85);
  // canopy: soft dark masses with a fringe of small leaves, kindled where the light hits
  const mass = (cx, cy, rx, ry, col, blur) => {
    g.save();
    g.filter = `blur(${blur}px)`;
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  const leaves = (cx, cy, rx, ry, n) => {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2;
      const d = 0.72 + R() * 0.34;
      const x = cx + Math.cos(a) * rx * d;
      const y = cy + Math.sin(a) * ry * d;
      const rr = 5 + R() * 9;
      const lit = Math.cos(a) > 0.1 && Math.sin(a) > -0.2 && R() < 0.35;
      g.fillStyle = lit
        ? `rgba(${180 + R() * 60},${170 + R() * 45},${90 + R() * 40},${0.45 + R() * 0.3})`
        : `rgb(${8 + R() * 10},${22 + R() * 18},${16 + R() * 12})`;
      g.beginPath();
      g.ellipse(x, y, rr * 1.7, rr * 0.75, R() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  };
  for (const [cx, cy, rx, ry, n] of [
    [WW * 0.25, HH * 0.04, WW * 0.62, HH * 0.17, 900],
    [WW * 0.66, HH * 0.0, WW * 0.34, HH * 0.11, 420],
    [WW * 0.08, HH * 0.24, WW * 0.22, HH * 0.1, 300],
  ]) {
    mass(cx, cy, rx, ry, 'rgba(8,20,15,0.97)', 5);
    leaves(cx, cy, rx, ry, n);
    mass(cx, cy, rx * 0.82, ry * 0.8, 'rgb(8,19,14)', 2);
  }
  // undergrowth: ferns and grass catching the light
  for (let i = 0; i < 260; i++) {
    const x = R() * WW * 0.95;
    const base = HH * (0.95 + R() * 0.06);
    const h = 30 + R() * 90 * (1 - x / WW);
    const lit = R() < 0.25 * (x / WW + 0.2);
    g.strokeStyle = lit ? `rgba(${170 + R() * 60},${160 + R() * 40},${80 + R() * 30},0.55)` : `rgba(8,${20 + R() * 14},12,0.96)`;
    g.lineWidth = 2 + R() * 2.5;
    g.beginPath();
    g.moveTo(x, base);
    g.quadraticCurveTo(x + (R() - 0.3) * 30, base - h * 0.6, x + (R() - 0.2) * 50, base - h);
    g.stroke();
  }
  return c;
}

/** Soft fan of light from the sun, painted once (blurred) and faded in and out live. */
function paintRays() {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 600;
  const g = c.getContext('2d');
  const sx = 540;
  const sy = 40;
  g.filter = 'blur(10px)';
  g.globalCompositeOperation = 'lighter';
  const R = rng(5);
  for (let k = 0; k < 11; k++) {
    const a = Math.PI / 2 + (k / 10 - 0.5) * 2.3 + (R() - 0.5) * 0.08;
    const len = 720;
    const wdt = 0.025 + R() * 0.035;
    const al = 0.1 + R() * 0.09;
    const rg = g.createLinearGradient(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
    rg.addColorStop(0, `rgba(255,228,170,${al})`);
    rg.addColorStop(0.6, `rgba(255,210,140,${al * 0.4})`);
    rg.addColorStop(1, 'rgba(255,200,130,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx + Math.cos(a - wdt) * len, sy + Math.sin(a - wdt) * len);
    g.lineTo(sx + Math.cos(a + wdt) * len, sy + Math.sin(a + wdt) * len);
    g.closePath();
    g.fill();
  }
  return c;
}

function makeMotes() {
  const R = rng(99);
  const out = [];
  for (let i = 0; i < 48; i++) {
    out.push({ x: R(), y: R(), z: 0.4 + R() * 0.9, r: 0.6 + R() * 1.8, ph: R() * 6.28, sp: 0.00006 + R() * 0.00012 });
  }
  return out;
}

function ensure() {
  if (!cv) {
    cv = document.getElementById('title-bg');
    if (!cv) return false;
    ctx = cv.getContext('2d');
    window.addEventListener('pointermove', (e) => {
      ptr.x = (e.clientX / Math.max(1, innerWidth)) * 2 - 1;
      ptr.y = (e.clientY / Math.max(1, innerHeight)) * 2 - 1;
    }, { passive: true });
  }
  if (!level) {
    try {
      level = createLevel(1);
    } catch (_) {
      level = null;
    }
  }
  if (level && !joe) {
    joe = createPlayer(level.spawn.x, level.spawn.y);
    joe.onGround = true;
    joe.forkAway = true; // no pitchfork on the title: calm, standing in the evening light
    joe.facing = 1;
  }
  if (!frameL) {
    frameL = paintCluster(1, 11);
    frameR = paintCluster(-1, 23);
    motes = makeMotes();
    rays = paintRays();
    mote = moteSprite();
  }
  return true;
}

function resize() {
  // The painting is soft by nature: render it near the game's own 480-line resolution
  // (up to 540 lines) and let CSS scale it, like the game canvas. Type and buttons are HTML.
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const k = Math.min(dpr, 540 / Math.max(1, r.height));
  const w = Math.max(1, Math.round(r.width * k));
  const h = Math.max(1, Math.round(r.height * k));
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
    vig = null;
    frames = null;
    bg.n = 0;
  }
}

/** The two grove clusters pre-scaled to the current canvas, so each frame is a plain blit. */
function scaledFrames(cw, ch) {
  if (frames) return frames;
  const fh = Math.round(ch * 1.04);
  const fw = Math.round(fh * (frameL.width / frameL.height));
  const mk = (src) => {
    const c = document.createElement('canvas');
    c.width = fw;
    c.height = fh;
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, fw, fh);
    return c;
  };
  frames = { l: mk(frameL), r: mk(frameR), fw, fh };
  return frames;
}

/** Vignette + menu floor, painted once per size. */
function vignette(cw, ch) {
  if (vig && vig.width === cw && vig.height === ch) return vig;
  vig = document.createElement('canvas');
  vig.width = cw;
  vig.height = ch;
  const x = vig.getContext('2d');
  let g = x.createRadialGradient(cw * 0.5, ch * 0.42, Math.min(cw, ch) * 0.25, cw * 0.5, ch * 0.5, Math.max(cw, ch) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(6,4,8,0.62)');
  x.fillStyle = g;
  x.fillRect(0, 0, cw, ch);
  g = x.createLinearGradient(0, ch * 0.55, 0, ch);
  g.addColorStop(0, 'rgba(8,6,4,0)');
  g.addColorStop(1, 'rgba(8,6,4,0.72)');
  x.fillStyle = g;
  x.fillRect(0, ch * 0.55, cw, ch * 0.45);
  g = x.createLinearGradient(0, 0, 0, ch * 0.22);
  g.addColorStop(0, 'rgba(8,6,10,0.45)');
  g.addColorStop(1, 'rgba(8,6,10,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, cw, ch * 0.22);
  return vig;
}

function moteSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,244,210,1)');
  g.addColorStop(0.35, 'rgba(255,230,180,0.55)');
  g.addColorStop(1, 'rgba(255,214,150,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 32, 32);
  return c;
}

/** Show or hide the backdrop (title, chapters, and screens opened from the title). */
export function setTitleBackdrop(on) {
  if (on === shown) return;
  shown = on;
  document.getElementById('stage')?.classList.toggle('show-title-bg', on);
  if (on) t0 = performance.now();
}

export function titleBackdropShown() {
  return shown;
}

export function drawTitleBackdrop(game) {
  if (!ensure() || !level) return;
  resize();
  const cw = cv.width;
  const ch = cv.height;
  const s = Math.max(cw / W, ch / H); // cover
  const vw = cw / s; // visible width in design units
  const vx0 = (W - vw) / 2;
  const now = performance.now();
  const T = now - t0;
  const calm = reduceFlash();
  ptr.sx += (ptr.x - ptr.sx) * 0.04;
  ptr.sy += (ptr.y - ptr.sy) * 0.04;
  // Joseph stands about a seventh of the way in from the left edge of what is visible
  const joeScreen = vx0 + vw * 0.15;
  const drift = (calm ? 0 : Math.sin(now * 0.00022) * 14) + ptr.sx * 12;
  const cam = Math.max(0, level.spawn.x - joeScreen + 20) + drift;
  const oy = ptr.sy * -3;
  const sx = W * 0.5 + ptr.sx * -10;
  const sy = H * 0.1;

  fxg = fxg || { level, camX: cam, tick: 0, player: null };
  fxg.camX = cam;
  fxg.tick = Math.floor(T / 16.7);
  fxUpdate(fxg, 1);

  // 1) the graded farm, cached
  // small camera moves just slide the cached painting; it is re-painted for the clouds
  // every 20 frames, or when the camera has moved far enough to need the margin
  bg.n--;
  if (bg.n <= 0 || Math.abs(cam - bg.cam) > 6) {
    paintFarm(vx0, vw, s, cam, sx, sy, calm);
    bg.n = 20;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  const k = s / bg.q;
  ctx.drawImage(bg.c, (cw - W * s) / 2 + (vx0 - 8 + bg.cam - cam) * s, (ch - H * s) / 2 + oy * s, bg.c.width * k, bg.c.height * k);

  // 2) live layers in design space
  ctx.setTransform(s, 0, 0, s, (cw - W * s) / 2, (ch - H * s) / 2 + oy * s);

  if (joe) {
    joe.x = level.spawn.x;
    joe.y = level.spawn.y;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const jx = joe.x - cam + joe.w / 2;
    const jy = joe.y + joe.h * 0.45;
    const g = ctx.createRadialGradient(jx + 6, jy, 2, jx + 6, jy, 70);
    g.addColorStop(0, 'rgba(255,214,150,0.16)');
    g.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(jx - 70, jy - 70, 140, 140);
    ctx.restore();
    drawPlayer(ctx, joe, cam);
  }
  drawFxForegroundGrass(ctx, fxg);

  // motes of pollen and dust drifting up through the light
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const m of motes) {
    const y = ((m.y - T * m.sp * m.z) % 1 + 1) % 1;
    const x = m.x + Math.sin(T * 0.0004 * m.z + m.ph) * 0.012 - ptr.sx * 0.01 * m.z;
    const px = vx0 + (((x % 1) + 1) % 1) * vw;
    const py = y * H;
    const tw = calm ? 0.6 : 0.45 + 0.55 * Math.sin(T * 0.002 + m.ph);
    const r = m.r * m.z * 3;
    const near = Math.max(0, 1 - Math.hypot(px - sx, (py - sy) * 0.6) / (H * 0.9));
    const a = Math.max(0, tw) * (0.25 + near * 0.75);
    if (a < 0.02) continue;
    ctx.globalAlpha = a;
    ctx.drawImage(mote, px - r, py - r, r * 2, r * 2);
  }
  ctx.restore();
  drawFxFront(ctx, fxg);

  // 3) grove trees framing the edges, closer than the farm (stronger parallax)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const F = scaledFrames(cw, ch);
  const par = drift * 1.6 * s;
  const sway = calm ? 0 : Math.sin(now * 0.0006) * ch * 0.003;
  ctx.drawImage(F.l, Math.round(-F.fw * 0.16 - par), Math.round(-ch * 0.02 + sway));
  ctx.drawImage(F.r, Math.round(cw - F.fw * 0.84 - par), Math.round(-ch * 0.02 - sway));

  // 4) vignette and menu floor; fade up from black when the title first appears
  const fade = 1 - Math.min(1, T / 1100);
  if (fade > 0) {
    ctx.fillStyle = `rgba(4,3,2,${fade * fade})`;
    ctx.fillRect(0, 0, cw, ch);
  }
}

/** Parallax farm + tiles, golden-hour grade and sun bloom into the cache canvas. */
function paintFarm(vx0, vw, s, cam, sx, sy, calm) {
  const q = s; // the cache matches the canvas scale: a 1:1 blit
  const w = Math.ceil((vw + 16) * q);
  const h = Math.ceil(H * q);
  if (!bg.c) bg.c = document.createElement('canvas');
  if (bg.c.width !== w || bg.c.height !== h) {
    bg.c.width = w;
    bg.c.height = h;
  }
  bg.q = q;
  bg.cam = cam;
  const c = bg.c.getContext('2d');
  c.setTransform(q, 0, 0, q, -(vx0 - 8) * q, 0);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.imageSmoothingEnabled = true;
  c.fillStyle = '#0a0d10';
  c.fillRect(vx0 - 8, 0, vw + 16, H);
  drawLevelBackground(c, cam, level);
  drawLevelTiles(c, cam, level, { noStacks: true });
  drawFxBack(c, fxg);
  const X0 = vx0 - 8;
  const VW = vw + 16;
  // shift the daylight palette toward late-afternoon gold (keeps the painting's values)
  c.globalCompositeOperation = 'color';
  let g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,160,80,0.5)');
  g.addColorStop(0.5, 'rgba(255,190,110,0.3)');
  g.addColorStop(0.68, 'rgba(255,190,110,0.12)');
  g.addColorStop(1, 'rgba(200,140,80,0.04)');
  c.fillStyle = g;
  c.fillRect(X0, 0, VW, H);
  c.globalCompositeOperation = 'soft-light';
  g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,150,60,0.75)');
  g.addColorStop(0.5, 'rgba(255,196,120,0.45)');
  g.addColorStop(1, 'rgba(40,18,6,0.85)');
  c.fillStyle = g;
  c.fillRect(X0, 0, VW, H);
  c.globalCompositeOperation = 'multiply';
  g = c.createLinearGradient(0, H * 0.55, 0, H);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(150,120,100,1)');
  c.fillStyle = g;
  c.fillRect(X0, H * 0.55, VW, H * 0.45);
  // sun bloom behind the title
  c.globalCompositeOperation = 'screen';
  g = c.createRadialGradient(sx, sy, 0, sx, sy, H * 0.85);
  g.addColorStop(0, 'rgba(255,238,196,0.55)');
  g.addColorStop(0.22, 'rgba(255,200,120,0.24)');
  g.addColorStop(0.6, 'rgba(240,150,80,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(X0, 0, VW, H);
  // the slow fan of light (baked here; it changes too slowly to need every frame)
  const now = performance.now();
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = calm ? 0.7 : 0.8 + 0.2 * Math.sin(now * 0.0005);
  c.translate(sx, sy);
  c.rotate(calm ? 0 : Math.sin(now * 0.00008) * 0.025);
  c.drawImage(rays, -540, -40);
  c.restore();
  c.globalCompositeOperation = 'source-over';
  // vignette and the darker floor under the menu, in screen space of the cache
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(vignette(c.canvas.width, c.canvas.height), 0, 0);
}

/** Which states show the painted backdrop (the title and screens reached from it). */
export function wantsTitleBackdrop(game) {
  const st = game.state;
  if (st === STATES.TITLE || st === STATES.CHAPTERS) return true;
  if (st === STATES.CONTROLS && game.controlsFrom === STATES.TITLE) return true;
  if (st === STATES.JOURNAL && game.journalFrom === 'chapters') return true;
  return false;
}
