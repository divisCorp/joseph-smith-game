/**
 * HD illustrated / painterly 16-bit sprites (procedural canvas).
 * Respectful stylized characters — not photoreal likenesses.
 * Drawn at 2× NES scale for phone-friendly crisp detail.
 */
import { COLORS, W, SCALE } from './constants.js?v=73';

export function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
}

/** Compact pixel map (used for hearts / small UI). Transparent = ' ' or '.' */
export function drawPixels(ctx, ox, oy, rows, palette, flipX = false, pxScale = 1) {
  const h = rows.length;
  const w = rows[0].length;
  ox = Math.floor(ox);
  oy = Math.floor(oy);
  const s = pxScale;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === ' ' || ch === '.') continue;
      const c = palette[ch];
      if (!c) continue;
      const px = flipX ? ox + (w - 1 - x) * s : ox + x * s;
      ctx.fillStyle = c;
      ctx.fillRect(px, oy + y * s, s, s);
    }
  }
}

function ellipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  ctx.fill();
}

function strokeRound(ctx, x, y, w, h, r, color, line = 1.5) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = line;
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  ctx.stroke();
}

function strokeEllipse(ctx, cx, cy, rx, ry, color, line = 1.5) {
  ctx.strokeStyle = color;
  ctx.lineWidth = line;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function withFlip(ctx, ox, oy, w, flip, fn) {
  ctx.save();
  if (flip) {
    ctx.translate(Math.floor(ox + w), Math.floor(oy));
    ctx.scale(-1, 1);
    fn(0, 0);
  } else {
    fn(Math.floor(ox), Math.floor(oy));
  }
  ctx.restore();
}

// ── Sprite sheets (painterly 16-bit PNGs in assets/) ──
const SHEETS = {
  joseph: null,
  foes: null,
  wolf: null,
  bosses: null,
  portraits: null,
  moroni: null,
};
let sheetsReady = false;
let sheetsLoading = false;

/** v61 sheet: idle 0-1, walk 2-9 (8 even), jump 10, crouch 11, throw 12-13, hurt 14 */
const JOSEPH_FW = 64;
const JOSEPH_FH = 128;
const JOSEPH_IDLE = [0, 1];
const JOSEPH_WALK = [2, 3, 4, 5, 6, 7, 8, 9];
const JOSEPH_JUMP = 10;
const JOSEPH_CROUCH = 11;
const JOSEPH_THROW = [12, 13];
const FOE_ROWS = { brigand: 0, scout: 1, thug: 2 };
const BOSS_ROWS = { ringleader: 0, sentinel: 1, captain: 2, warden: 3, overseer: 4 };

function assetUrl(name) {
  // Relative to page — works on GH Pages + Netlify
  try {
    return new URL(`../assets/${name}`, import.meta.url).href;
  } catch {
    return `assets/${name}`;
  }
}

export function preloadSprites() {
  if (sheetsReady || sheetsLoading) return sheetsReady ? Promise.resolve(true) : sheetsLoading;
  sheetsLoading = Promise.all(
    Object.keys(SHEETS).map(
      (key) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            SHEETS[key] = img;
            resolve(true);
          };
          img.onerror = () => {
            SHEETS[key] = null;
            resolve(false);
          };
          const file = {
            joseph: 'joseph.png',
            foes: 'foes.png',
            wolf: 'wolf.png',
            bosses: 'bosses.png',
            portraits: 'portraits.png',
            moroni: 'moroni.png',
          }[key];
          img.src = assetUrl(file);
        })
    )
  ).then(() => {
    try {
      SHEETS.foesFixed = SHEETS.foes ? reproportionFoes(SHEETS.foes) : null;
    } catch (_) {
      SHEETS.foesFixed = null; // e.g. tainted canvas: fall back to the raw sheet
    }
    try {
      buildPreacherSheets();
    } catch (_) {
      /* preachers fall back to procedural drawing */
    }
    try {
      SHEETS.moroni = SHEETS.moroni ? reproportionMoroni(SHEETS.moroni) : null;
    } catch (_) {
      /* keep the original sheet */
    }
    moroniMetrics = computeMoroniMetrics(); // measured once the sheets are in
    sheetsReady = !!(SHEETS.joseph || SHEETS.foes);
    sheetsLoading = false;
    return sheetsReady;
  });
  return sheetsLoading;
}

export function sheetImage(key) {
  return SHEETS[key] || null;
}

export function spritesReady() {
  return sheetsReady;
}

function blitSheet(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, flip, flash) {
  if (!img) return false;
  ctx.save();
  if (flash) ctx.globalAlpha = 0.85;
  if (flip) {
    ctx.translate(Math.floor(dx + dw), Math.floor(dy));
    ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  } else {
    ctx.drawImage(img, sx, sy, sw, sh, Math.floor(dx), Math.floor(dy), dw, dh);
  }
  if (flash) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255,80,80,0.45)';
    // flash overlay on destination — redraw with multiply-ish via second pass
  }
  ctx.restore();
  if (flash) {
    ctx.save();
    if (flip) {
      ctx.translate(Math.floor(dx + dw), Math.floor(dy));
      ctx.scale(-1, 1);
      ctx.globalCompositeOperation = 'source-atop';
      // simpler: draw tinted by using filter
    }
    ctx.restore();
    // Use filter for hurt flash (widely supported on modern mobile)
    ctx.save();
    ctx.filter = 'brightness(2.0) sepia(0.65) hue-rotate(-30deg) saturate(2.6) contrast(1.1)';
    if (flip) {
      ctx.translate(Math.floor(dx + dw), Math.floor(dy));
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    } else {
      ctx.drawImage(img, sx, sy, sw, sh, Math.floor(dx), Math.floor(dy), dw, dh);
    }
    ctx.restore();
  }
  return true;
}

function blitSimple(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, flip, flash) {
  if (!img) return false;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (flash) ctx.filter = 'brightness(2.1) sepia(0.7) hue-rotate(-35deg) saturate(2.8) contrast(1.15)';
  if (flip) {
    ctx.translate(Math.floor(dx + dw), Math.floor(dy));
    ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  } else {
    ctx.drawImage(img, sx, sy, sw, sh, Math.floor(dx), Math.floor(dy), dw, dh);
  }
  ctx.restore();
  return true;
}

// Shared humanoid draw size — Joseph, foes, bosses
const JOSEPH_DW = 56;
const JOSEPH_DH = 112;

/** Farm pitchfork — held at the side, swung forward. */
export function drawPitchfork(ctx, x, y, facing, swinging = false, young = false, crouching = false) {
  const sc = 1;
  const dw = Math.round(JOSEPH_DW * sc);
  const dh = Math.round(JOSEPH_DH * sc);
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const flip = facing < 0;
  const hx = ox + dw * (flip ? 0.22 : 0.78);
  const hy = oy + dh * (crouching ? 0.70 : swinging ? 0.48 : 0.62);
  const angle = swinging
    ? (flip ? Math.PI + 0.05 : -0.05)
    : (flip ? Math.PI - 1.05 : 1.05);
  const len = (swinging ? 36 : 28) * sc;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(angle);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // shaft
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 4.2 * sc;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.strokeStyle = '#8a5a28';
  ctx.lineWidth = 2.4 * sc;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len - 1, 0);
  ctx.stroke();
  ctx.strokeStyle = '#c48a48';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(1, -0.8 * sc);
  ctx.lineTo(len * 0.7, -0.8 * sc);
  ctx.stroke();
  // collar
  ctx.fillStyle = '#6a4a20';
  ctx.fillRect(len - 5 * sc, -2.4 * sc, 4 * sc, 4.8 * sc);
  // three tines
  const tine = 9 * sc;
  for (const oyT of [-4.2 * sc, 0, 4.2 * sc]) {
    ctx.strokeStyle = '#8a9098';
    ctx.lineWidth = 1.8 * sc;
    ctx.beginPath();
    ctx.moveTo(len - 2 * sc, oyT);
    ctx.lineTo(len + tine, oyT);
    ctx.stroke();
    ctx.strokeStyle = '#e8eef4';
    ctx.lineWidth = 0.9 * sc;
    ctx.beginPath();
    ctx.moveTo(len - 1 * sc, oyT - 0.4 * sc);
    ctx.lineTo(len + tine - 0.5 * sc, oyT - 0.4 * sc);
    ctx.stroke();
    ctx.fillStyle = '#d0d6de';
    ctx.beginPath();
    ctx.moveTo(len + tine - 1, oyT - 1.2 * sc);
    ctx.lineTo(len + tine + 2.2 * sc, oyT);
    ctx.lineTo(len + tine - 1, oyT + 1.2 * sc);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}


/** Warm gold silhouette of the Joseph sheet, for a soft rim of light in calm moments. */
function josephRimSheet() {
  if (SHEETS.josephRim !== undefined) return SHEETS.josephRim;
  const img = SHEETS.joseph;
  if (!img) return null;
  try {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ffe2a0';
    g.fillRect(0, 0, c.width, c.height);
    SHEETS.josephRim = c;
  } catch (_) {
    SHEETS.josephRim = null;
  }
  return SHEETS.josephRim;
}

export function drawJoseph(ctx, x, y, facing, frame, attacking, jumping = false, crouching = false, moving = false, lookingUp = false, young = false, airFrame = null, rim = 0) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const flip = facing < 0;
  const sc = 1;
  const dw = Math.round(JOSEPH_DW * sc);
  const dh = Math.round(JOSEPH_DH * sc);
  let pose = 'idle';
  if (attacking) pose = 'throw';
  else if (crouching) pose = 'crouch';
  else if (moving) pose = 'walk';
  else if (lookingUp) pose = 'lookup';
  else if (jumping) pose = 'jump';

  const img = SHEETS.joseph;
  if (img) {
    let fi = JOSEPH_IDLE[((frame % JOSEPH_IDLE.length) + JOSEPH_IDLE.length) % JOSEPH_IDLE.length];
    let dy = oy;
    if (pose === 'crouch') {
      fi = JOSEPH_CROUCH;
    } else if (pose === 'jump') {
      fi = JOSEPH_JUMP;
      dy = oy - Math.round(6 * sc);
    } else if (pose === 'throw') {
      fi = JOSEPH_THROW[frame % 2 === 1 ? 1 : 0];
    } else if (pose === 'walk') {
      fi = JOSEPH_WALK[((frame % JOSEPH_WALK.length) + JOSEPH_WALK.length) % JOSEPH_WALK.length];
    } else if (pose === 'lookup') {
      fi = JOSEPH_IDLE[0];
    }
    // Airborne poses: 10 push-off, 12 tucked apex, 13 falling (painted frames)
    const air = airFrame != null && !attacking && !crouching;
    if (air) {
      fi = airFrame;
      dy = oy - Math.round(6 * sc);
    } else {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(ox + dw / 2, oy + dh - 3, dw * 0.28, 4 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (rim > 0.02) {
      // spiritual presence: a thin warm rim of light around the painted figure (art untouched)
      const rs = josephRimSheet();
      if (rs) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, rim) * 0.45;
        for (const [ax, ay] of [[-1.5, 0], [1.5, 0], [0, -1.5]]) {
          blitSimple(ctx, rs, fi * JOSEPH_FW, 0, JOSEPH_FW, JOSEPH_FH, ox + ax, dy + ay, dw, dh, flip, false);
        }
        ctx.restore();
      }
    }
    blitSimple(ctx, img, fi * JOSEPH_FW, 0, JOSEPH_FW, JOSEPH_FH, ox, dy, dw, dh, flip, false);
    return;
  }
  if (young) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(sc, sc);
    drawJosephProcedural(ctx, 0, 0, flip, pose);
    ctx.restore();
    return;
  }
  drawJosephProcedural(ctx, ox, oy, flip, pose);
}


/** Outstretched arm for throw pose (composited onto full-body walk). */
function drawJosephThrowArm(ctx, ox, oy, flip) {
  withFlip(ctx, ox, oy, JOSEPH_DW, flip, (bx, by) => {
    const coat = '#1a3a5c';
    const coatD = '#0e2848';
    const skin = '#e0b890';
    // Arm out at mid-torso, matching mid-size Joseph proportions
    roundRect(ctx, bx + 22, by + 22, 14, 5, 2, coat);
    roundRect(ctx, bx + 24, by + 23, 10, 3, 1, coatD);
    roundRect(ctx, bx + 34, by + 20, 6, 7, 2, skin);
  });
}

/** Portrait icon (title / UI). index 0-3 from sheet. */
export function drawPortrait(ctx, x, y, index = 0, size = 48) {
  const img = SHEETS.portraits;
  if (!img) return false;
  const col = ((index % 4) + 4) % 4;
  blitSimple(ctx, img, col * 48, 0, 48, 48, Math.floor(x), Math.floor(y), size, size, false, false);
  return true;
}

function drawJosephProcedural(ctx, ox, oy, flip, pose) {
  ellipse(ctx, ox + 16, oy + 62, 10, 3, COLORS.shadow);
  withFlip(ctx, ox, oy, 32, flip, (bx, by) => {
    const crouch = pose === 'crouch';
    const jump = pose === 'jump';
    const walk = pose === 'walk';
    const throwP = pose === 'throw';
    const yOff = crouch ? 14 : 0;
    const legA = walk ? -3 : jump ? -2 : 0;
    const legB = walk ? 3 : jump ? 2 : 0;
    const pant = '#6a4a30';
    const pantDark = '#4a3220';
    const boot = '#3a2818';
    const bootHi = '#5a4030';
    const skin = '#e0b890';
    const skinHi = '#f0d0a8';

    roundRect(ctx, bx + 9 + legA, by + 36 + yOff, 7, 18, 2, pant);
    roundRect(ctx, bx + 16 + legB, by + 36 + yOff, 7, 18, 2, pantDark);
    roundRect(ctx, bx + 8 + legA, by + 50, 9, 11, 2, boot);
    roundRect(ctx, bx + 15 + legB, by + 50, 9, 11, 2, boot);
    drawRect(ctx, bx + 9 + legA, by + 52, 7, 2, bootHi);
    drawRect(ctx, bx + 16 + legB, by + 52, 7, 2, bootHi);
    drawRect(ctx, bx + 8 + legA, by + 58, 9, 3, '#241808');
    drawRect(ctx, bx + 15 + legB, by + 58, 9, 3, '#241808');

    const coatY = by + 14 + yOff;
    const coatH = crouch ? 26 : 26;
    roundRect(ctx, bx + 5, coatY, 22, coatH, 3, '#0e2848');
    roundRect(ctx, bx + 6, coatY + 1, 20, coatH - 3, 3, '#1a3a5c');
    strokeRound(ctx, bx + 5, coatY, 22, coatH, 3, '#081828', 1.2);
    drawRect(ctx, bx + 7, coatY + 2, 6, 2, 'rgba(80,120,180,0.35)');
    drawRect(ctx, bx + 13, coatY + 4, 5, crouch ? 14 : 16, '#e8dcc8');
    drawRect(ctx, bx + 14, coatY + 5, 3, crouch ? 12 : 14, '#f0e8d8');
    drawRect(ctx, bx + 6, coatY + 2, 5, 8, '#163450');
    drawRect(ctx, bx + 19, coatY + 2, 5, 8, '#163450');
    ellipse(ctx, bx + 15.5, coatY + 9, 1.5, 1.5, '#d4a84b');
    ellipse(ctx, bx + 15.5, coatY + 14, 1.5, 1.5, '#d4a84b');
    if (!crouch) ellipse(ctx, bx + 15.5, coatY + 19, 1.5, 1.5, '#c4983a');
    drawRect(ctx, bx + 6, coatY + coatH - 4, 20, 2, 'rgba(0,0,0,0.22)');

    if (throwP) {
      roundRect(ctx, bx + 22, coatY + 5, 14, 6, 2, '#1a3a5c');
      roundRect(ctx, bx + 34, coatY + 4, 6, 8, 2, skin);
      roundRect(ctx, bx + 38, coatY + 3, 10, 8, 1, '#d4a84b');
      drawRect(ctx, bx + 39, coatY + 4, 8, 1, '#f0d878');
      roundRect(ctx, bx + 3, coatY + 7, 5, 12, 2, '#0e2848');
      ellipse(ctx, bx + 5, coatY + 19, 3, 3, skin);
    } else if (jump) {
      roundRect(ctx, bx + 1, coatY + 2, 5, 14, 2, '#0e2848');
      roundRect(ctx, bx + 25, coatY + 2, 5, 14, 2, '#1a3a5c');
      ellipse(ctx, bx + 3, coatY + 16, 3, 3, skin);
      ellipse(ctx, bx + 28, coatY + 16, 3, 3, skinHi);
    } else {
      roundRect(ctx, bx + 2, coatY + 5, 5, 14, 2, '#0e2848');
      roundRect(ctx, bx + 24, coatY + 5, 5, 14, 2, '#1a3a5c');
      ellipse(ctx, bx + 4, coatY + 19, 3, 3, skin);
      ellipse(ctx, bx + 27, coatY + 19, 3, 3, skinHi);
    }

    const hx = bx + 16;
    const hy = by + 8 + yOff;
    ellipse(ctx, hx, hy - 2, 8, 6, '#2a1810');
    ellipse(ctx, hx - 1, hy - 3, 6, 4, '#3a2418');
    ellipse(ctx, hx, hy + 2, 6.5, 7, skin);
    ellipse(ctx, hx - 1, hy + 1, 3.5, 3.5, skinHi);
    ellipse(ctx, hx - 2.5, hy + 1, 1.1, 1.3, '#2a1a10');
    ellipse(ctx, hx + 2.5, hy + 1, 1.1, 1.3, '#2a1a10');
    drawRect(ctx, hx - 4, hy - 1, 3, 1, '#2a1810');
    drawRect(ctx, hx + 1, hy - 1, 3, 1, '#2a1810');
    drawRect(ctx, hx - 0.5, hy + 3, 2, 2, '#d4a080');
    drawRect(ctx, hx - 2, hy + 6, 4, 1, '#c07050');
    drawRect(ctx, bx + 11, hy + 9, 10, 3, '#f0e8d8');
  });
}

// ── Gold plate projectile ──
export function drawGoldPlate(ctx, x, y, facing = 1) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const w = 20;
  const h = 14;
  ctx.save();
  if (facing < 0) {
    ctx.translate(ox + w, oy);
    ctx.scale(-1, 1);
    ctx.translate(-ox, -oy);
  }
  roundRect(ctx, ox, oy, w, h, 2, '#5a4010');
  roundRect(ctx, ox + 1, oy + 1, w - 2, h - 2, 2, '#d4a84b');
  drawRect(ctx, ox + 2, oy + 2, w - 4, 2, '#f0d878');
  drawRect(ctx, ox + 2, oy + 5, w - 4, 1, '#8b6914');
  drawRect(ctx, ox + 2, oy + 7, w - 4, 1, '#c4983a');
  drawRect(ctx, ox + 2, oy + 9, w - 4, 1, '#8b6914');
  drawRect(ctx, ox + 2, oy + 11, w - 4, 1, '#e8c860');
  drawRect(ctx, ox + 4, oy + 4, 2, 2, '#8b6914');
  drawRect(ctx, ox + 8, oy + 4, 3, 2, '#8b6914');
  drawRect(ctx, ox + 13, oy + 4, 2, 2, '#8b6914');
  drawRect(ctx, ox + w - 3, oy + 3, 1, 8, 'rgba(255,245,200,0.65)');
  ctx.restore();
}

export function drawKnife(ctx, x, y, facing = 1) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  ctx.save();
  if (facing < 0) {
    ctx.translate(ox + 14, oy + 4);
    ctx.scale(-1, 1);
    ctx.translate(-ox, -oy);
  }
  // A field stone: the mobs throw rocks, not blades (hitbox unchanged)
  ctx.fillStyle = '#6a6258';
  ctx.beginPath();
  ctx.ellipse(ox + 7, oy + 3.5, 7, 3.4, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9a9286';
  ctx.beginPath();
  ctx.ellipse(ox + 5, oy + 2.4, 4, 1.8, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a443c';
  ctx.beginPath();
  ctx.ellipse(ox + 9.5, oy + 4.4, 2.6, 1.4, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The foe sheet is drawn chibi-style (head ≈ 35% of height) while Joseph and
 * the bosses are ≈ 25%, so foes read as "huge head". The PNG is untouched:
 * at load we slice each frame at its neck (narrowest row between head and
 * shoulders), draw the head at 70% around the neck centre and stretch the
 * body 15% taller, so the feet stay put and overall height is unchanged.
 */
const FOE_HEAD_K = 0.7;
const FOE_BODY_K = 1.15;
function reproportionFoes(img) {
  const W0 = img.width;
  const H0 = img.height;
  const src = document.createElement('canvas');
  src.width = W0;
  src.height = H0;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);
  const data = sctx.getImageData(0, 0, W0, H0).data;
  const out = document.createElement('canvas');
  out.width = W0;
  out.height = H0;
  const o = out.getContext('2d');
  o.imageSmoothingEnabled = true;
  o.imageSmoothingQuality = 'high';
  const FW = 64;
  const FH = 128;
  for (let row = 0; row < Math.floor(H0 / FH); row++) {
    for (let col = 0; col < Math.floor(W0 / FW); col++) {
      const fx = col * FW;
      const fy = row * FH;
      // neck = narrowest opaque row in the 44..68 band
      let ny = 58;
      let best = 1e9;
      let nx = FW / 2;
      for (let y = 44; y <= 68; y++) {
        let n = 0;
        let sx = 0;
        for (let x = 0; x < FW; x++) {
          if (data[((fy + y) * W0 + fx + x) * 4 + 3] > 40) {
            n++;
            sx += x;
          }
        }
        if (n > 4 && n < best) {
          best = n;
          ny = y;
          nx = sx / n;
        }
      }
      const bodyH = FH - ny;
      const bodyDH = Math.round(bodyH * FOE_BODY_K);
      const bodyTop = FH - bodyDH;
      o.drawImage(img, fx, fy + ny, FW, bodyH, fx, fy + bodyTop, FW, bodyDH);
      const headDW = FW * FOE_HEAD_K;
      const headDH = ny * FOE_HEAD_K;
      const hx = fx + nx - nx * FOE_HEAD_K;
      const hy = fy + bodyTop + 2 - headDH;
      o.drawImage(img, fx, fy, FW, ny, hx, hy, headDW, headDH);
    }
  }
  return out;
}

// ── Preachers (Sacred Grove NPCs) ─────────────────────────
/*
 * Respectful period clergy built at load from existing painted frames (PNG
 * files untouched): re-proportioned at the neck like the foes, then recoloured
 * into sober dress. No weapons, no villain colours.
 *  methodist   — circuit rider: tall hat, black frock coat (from the top-hat frames)
 *  presbyterian — older minister: grey hair, black coat, white preaching bands (from Joseph)
 *  baptist     — country preacher: low wide-brim hat, brown cloak, pewter trim
 */
const PREACHER_DEFS = {
  methodist: { sheet: 'bosses', fw: 80, fh: 160, row: 0, frames: [0, 1], headK: 0.74, bodyK: 1.1 },
  presbyterian: { sheet: 'joseph', fw: 64, fh: 128, row: 0, frames: [0, 1], headK: 1, bodyK: 1 },
  baptist: { sheet: 'bosses', fw: 80, fh: 160, row: 4, frames: [0, 5], headK: 0.74, bodyK: 1.1 },
};

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, sat, l];
}

function hslToRgb(h, sat, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (sat === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

function recolorPreacher(kind, data, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 20) continue;
      const [hh, ss, ll] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      let out = null;
      const yf = y / h;
      if (kind === 'methodist') {
        if ((hh < 14 || hh > 330) && ss > 0.3) out = hslToRgb(24, 0.14, Math.min(0.32, ll * 0.42 + 0.04)); // red coat → black-brown
        else if (hh > 225 && hh <= 330 && ss > 0.12) out = hslToRgb(30, 0.08, ll * 0.36 + 0.03); // purple hat → black felt
        else if (hh >= 14 && hh <= 62 && ss > 0.24 && yf > 0.4 && ll > 0.22) out = hslToRgb(28, 0.1, ll * 0.42); // gold trim / orange waistcoat → plain dark
      } else if (kind === 'baptist') {
        if (hh > 225 && hh <= 330 && ss > 0.18 && yf < 0.3) out = hslToRgb(28, 0.2, ll * 0.42 + 0.03); // hat → dark brown
        else if (hh > 225 && hh <= 330 && ss > 0.18) out = hslToRgb(26, 0.3, ll * 0.62 + 0.05); // cloak → brown wool
        else if (hh >= 36 && hh <= 58 && ss > 0.4) out = hslToRgb(40, 0.1, ll * 0.8); // gold → pewter
        else if (hh > 200 && hh <= 260 && ll < 0.4) out = hslToRgb(25, 0.12, ll * 0.8); // navy coat → dark brown-grey
      } else if (kind === 'presbyterian') {
        if (hh > 185 && hh <= 260 && ss > 0.15) out = hslToRgb(220, 0.06, ll * 0.42 + 0.02); // blue coat → black
        else if (hh >= 30 && hh <= 62 && ss > 0.22 && yf > 0.3 && ll > 0.25) out = hslToRgb(220, 0.04, ll * 0.4); // trim → black
        else if (yf < 0.33 && hh >= 8 && hh <= 40 && ll < 0.5 && ss > 0.2) out = hslToRgb(30, 0.04, 0.42 + ll * 0.75); // brown hair → grey
        else if (yf > 0.33 && yf < 0.8 && hh >= 10 && hh <= 40 && ll < 0.42) out = hslToRgb(30, 0.06, ll * 0.55); // waistcoat/trousers → charcoal
      }
      if (out) {
        data[i] = out[0];
        data[i + 1] = out[1];
        data[i + 2] = out[2];
      }
    }
  }
}

function reproportionFrame(img, sx, sy, fw, fh, headK, bodyK, out, dx, dy) {
  const o = out.getContext('2d', { willReadFrequently: true });
  o.imageSmoothingEnabled = true;
  o.imageSmoothingQuality = 'high';
  if (headK === 1 && bodyK === 1) {
    o.drawImage(img, sx, sy, fw, fh, dx, dy, fw, fh);
    return;
  }
  const tmp = document.createElement('canvas');
  tmp.width = fw;
  tmp.height = fh;
  const t = tmp.getContext('2d', { willReadFrequently: true });
  t.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);
  const d = t.getImageData(0, 0, fw, fh).data;
  let ny = Math.round(fh * 0.45);
  let nx = fw / 2;
  let best = 1e9;
  for (let y = Math.round(fh * 0.36); y <= Math.round(fh * 0.55); y++) {
    let n = 0;
    let sxs = 0;
    for (let x = 0; x < fw; x++) {
      if (d[(y * fw + x) * 4 + 3] > 40) {
        n++;
        sxs += x;
      }
    }
    if (n > 4 && n < best) {
      best = n;
      ny = y;
      nx = sxs / n;
    }
  }
  const bodyH = fh - ny;
  const bodyDH = Math.round(bodyH * bodyK);
  const bodyTop = fh - bodyDH;
  o.drawImage(tmp, 0, ny, fw, bodyH, dx, dy + bodyTop, fw, bodyDH);
  o.drawImage(tmp, 0, 0, fw, ny, dx + nx - nx * headK, dy + bodyTop + 2 - ny * headK, fw * headK, ny * headK);
}

function buildPreacherSheets() {
  for (const [kind, def] of Object.entries(PREACHER_DEFS)) {
    const img = SHEETS[def.sheet];
    if (!img) continue;
    const c = document.createElement('canvas');
    c.width = def.fw * def.frames.length;
    c.height = def.fh;
    def.frames.forEach((f, k) => {
      reproportionFrame(img, f * def.fw, def.row * def.fh, def.fw, def.fh, def.headK, def.bodyK, c, k * def.fw, 0);
    });
    const g = c.getContext('2d', { willReadFrequently: true });
    const id = g.getImageData(0, 0, c.width, c.height);
    for (let k = 0; k < def.frames.length; k++) {
      // recolour per frame so y-fractions are frame-relative
      const sub = g.getImageData(k * def.fw, 0, def.fw, def.fh);
      recolorPreacher(kind, sub.data, def.fw, def.fh);
      g.putImageData(sub, k * def.fw, 0);
    }
    void id;
    if (kind === 'presbyterian') {
      // white Geneva preaching bands at the collar
      for (let k = 0; k < def.frames.length; k++) {
        g.fillStyle = '#f4f0e6';
        g.fillRect(k * def.fw + 34, 42, 2, 7);
        g.fillRect(k * def.fw + 37, 42, 2, 7);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(k * def.fw + 34, 48, 5, 1);
      }
    }
    SHEETS['preacher_' + kind] = c;
  }
}

/** Preacher NPC at the shared 56×112 humanoid size; gentle two-frame "speaking" sway. */
export function drawPreacher(ctx, x, y, facing, kind, t = 0, speaking = false) {
  const def = PREACHER_DEFS[kind];
  const img = SHEETS['preacher_' + kind];
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(ox + JOSEPH_DW / 2, oy + JOSEPH_DH - 3, JOSEPH_DW * 0.3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (!img || !def) {
    drawRect(ctx, ox + 18, oy + 30, 20, 70, '#2a2420');
    ellipse(ctx, ox + 28, oy + 22, 9, 10, '#e2bc98');
    return;
  }
  const k = speaking ? Math.floor(t / 22) % def.frames.length : 0;
  blitSimple(ctx, img, k * def.fw, 0, def.fw, def.fh, ox, oy, JOSEPH_DW, JOSEPH_DH, facing < 0, false);
}

export function foeSheetsForQa() {
  return { raw: SHEETS.foes, fixed: SHEETS.foesFixed };
}

function drawFoeFromSheet(ctx, x, y, facing, frame, flash, kind) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const img = SHEETS.foesFixed || SHEETS.foes;
  if (img) {
    const row = FOE_ROWS[kind] ?? 0;
    const dw = JOSEPH_DW;
    const dh = JOSEPH_DH;
    const col = frame % 8;
    return blitSimple(ctx, img, col * 64, row * 128, 64, 128, ox, oy, dw, dh, facing < 0, flash);
  }
  return false;
}

function drawHumanoidFoe(ctx, x, y, facing, frame, flash, pal) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const flip = facing < 0;
  const walk = frame % 2 === 1;
  ellipse(ctx, ox + 16, oy + 62, 10, 3, COLORS.shadow);

  withFlip(ctx, ox, oy, 32, flip, (bx, by) => {
    const shift = walk ? 3 : 0;
    const coat = flash ? pal.flashCoat : pal.coat;
    const coatD = flash ? pal.flashDark : pal.coatDark;
    const band = flash ? '#ff6060' : pal.bandana;
    const pant = pal.pants;
    const boot = pal.boots;
    const skin = '#c4a080';
    const skinHi = '#d4b090';

    roundRect(ctx, bx + 8 - shift, by + 36, 7, 18, 2, pant);
    roundRect(ctx, bx + 17 + shift, by + 36, 7, 18, 2, '#2a1a10');
    roundRect(ctx, bx + 7 - shift, by + 50, 9, 11, 2, boot);
    roundRect(ctx, bx + 16 + shift, by + 50, 9, 11, 2, boot);
    drawRect(ctx, bx + 7 - shift, by + 58, 9, 3, '#1a1008');
    drawRect(ctx, bx + 16 + shift, by + 58, 9, 3, '#1a1008');

    roundRect(ctx, bx + 5, by + 15, 22, 26, 3, coatD);
    roundRect(ctx, bx + 6, by + 16, 20, 24, 3, coat);
    drawRect(ctx, bx + 13, by + 19, 5, 14, pal.shirt);
    if (pal.sash) drawRect(ctx, bx + 6, by + 32, 20, 4, flash ? '#ff8080' : pal.sash);
    roundRect(ctx, bx + 18, by + 28, 6, 6, 1, '#6a5030');
    drawRect(ctx, bx + 7, by + 18, 5, 2, 'rgba(255,255,255,0.12)');

    roundRect(ctx, bx + 2, by + 18, 5, 13, 2, coatD);
    roundRect(ctx, bx + 24, by + 18, 5, 13, 2, coat);
    ellipse(ctx, bx + 4, by + 31, 3, 3, skin);
    ellipse(ctx, bx + 27, by + 31, 3, 3, skinHi);
    drawRect(ctx, bx + 26, by + 33, 3, 8, '#8a8a9a');
    drawRect(ctx, bx + 25, by + 32, 5, 2, '#c0a060');

    ellipse(ctx, bx + 16, by + 9, 8, 6, '#1a1a1a');
    roundRect(ctx, bx + 7, by + 7, 18, 5, 2, band);
    ellipse(ctx, bx + 16, by + 12, 7, 7, skin);
    ellipse(ctx, bx + 13, by + 11, 1.3, 1.5, '#8b0000');
    ellipse(ctx, bx + 19, by + 11, 1.3, 1.5, '#8b0000');
    drawRect(ctx, bx + 14, by + 16, 4, 1, '#8a5040');
  });
}

export function drawBrigand(ctx, x, y, facing, frame, flash = false) {
  if (drawFoeFromSheet(ctx, x, y, facing, frame, flash, 'brigand')) return;
  drawHumanoidFoe(ctx, x, y, facing, frame, flash, {
    coat: '#5a3020',
    coatDark: '#3a2010',
    flashCoat: '#a05040',
    flashDark: '#802830',
    bandana: '#8b2020',
    pants: '#3a2a1a',
    boots: '#2a1a10',
    shirt: '#8a7060',
  });
}

export function drawScout(ctx, x, y, facing, frame, flash = false) {
  if (drawFoeFromSheet(ctx, x, y, facing, frame, flash, 'scout')) return;
  drawHumanoidFoe(ctx, x, y, facing, frame, flash, {
    coat: '#3a4a28',
    coatDark: '#2a3818',
    flashCoat: '#a07040',
    flashDark: '#806028',
    bandana: '#2a5a28',
    pants: '#2a3a1a',
    boots: '#1a2010',
    shirt: '#6a7a58',
  });
}

export function drawThug(ctx, x, y, facing, frame, flash = false) {
  if (drawFoeFromSheet(ctx, x, y, facing, frame, flash, 'thug')) return;
  drawHumanoidFoe(ctx, x, y, facing, frame, flash, {
    coat: '#2a2030',
    coatDark: '#1a1020',
    flashCoat: '#a04050',
    flashDark: '#802030',
    bandana: '#8b2028',
    pants: '#1a1a22',
    boots: '#100810',
    shirt: '#5a4858',
    sash: '#a02828',
  });
}

export function drawWolf(ctx, x, y, facing, frame, flash = false) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const img = SHEETS.wolf;
  if (img) {
    const col = frame % 8;
    const dw = 84;
    const dh = 52;
    blitSimple(ctx, img, col * 96, 0, 96, 64, ox, oy, dw, dh, facing < 0, flash);
    return;
  }
  const bob = frame % 2;
  const flip = facing < 0;
  ellipse(ctx, ox + 16, oy + 48 + bob, 12, 3, COLORS.shadow);
  withFlip(ctx, ox, oy + 20 + bob, 32, flip, (bx, by) => {
    const fur = flash ? '#8a6060' : '#5a5a5a';
    const furL = flash ? '#aa8080' : '#7a7a7a';
    const furD = flash ? '#5a3030' : '#3a3a3a';
    ellipse(ctx, bx + 14, by + 14, 12, 8, furD);
    ellipse(ctx, bx + 14, by + 13, 11, 7, fur);
    ellipse(ctx, bx + 10, by + 11, 5, 4, furL);
    ellipse(ctx, bx + 24, by + 12, 7, 6, fur);
    ellipse(ctx, bx + 28, by + 13, 5, 3.5, '#e8e8e8');
    ellipse(ctx, bx + 30, by + 13, 2, 1.5, '#2a2a2a');
    ellipse(ctx, bx + 20, by + 5, 3, 4, furD);
    ellipse(ctx, bx + 24, by + 5, 3, 4, furD);
    ellipse(ctx, bx + 24, by + 11, 1.5, 1.5, '#ffcc00');
    const spread = bob ? 4 : 2;
    roundRect(ctx, bx + 6, by + 18, 4, 10, 1, furD);
    roundRect(ctx, bx + 12, by + 18, 4, 10, 1, fur);
    roundRect(ctx, bx + 18, by + 18, 4, 10 - spread / 2, 1, furD);
    roundRect(ctx, bx + 22, by + 18, 4, 10 + spread / 2, 1, fur);
    ellipse(ctx, bx + 2, by + 12, 5, 3, furL);
  });
}

const BOSS_COLORS = {
  ringleader: { coat: '#2a1a40', coatD: '#1a1028', cape: '#482037', capeL: '#69304e', accent: '#d4a84b', hat: '#1a0a08' },
  sentinel: { coat: '#1a3020', coatD: '#0e2014', cape: '#143e28', capeL: '#285f3e', accent: '#6a8b4b', hat: '#0a1810' },
  captain: { coat: '#3a2030', coatD: '#281018', cape: '#5a2034', capeL: '#82374e', accent: '#c07040', hat: '#1a1018' },
  warden: { coat: '#1a2840', coatD: '#101828', cape: '#183452', capeL: '#305a80', accent: '#6a90b0', hat: '#081018' },
  overseer: { coat: '#2e1a5a', coatD: '#1a0e30', cape: '#241244', capeL: '#3c2469', accent: '#d4a84b', hat: '#0a0810' },
};

export function drawBoss(ctx, x, y, facing, frame, flash, bossKind = 'ringleader') {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const img = SHEETS.bosses;
  if (img) {
    const row = BOSS_ROWS[bossKind] ?? 0;
    const col = frame % 6;
    const dw = JOSEPH_DW;
    const dh = JOSEPH_DH;
    blitSimple(ctx, img, col * 80, row * 160, 80, 160, ox, oy, dw, dh, facing < 0, flash);
    return;
  }
  const flip = facing < 0;
  const walk = frame % 2 === 1;
  const c = BOSS_COLORS[bossKind] || BOSS_COLORS.ringleader;
  const coat = flash ? '#c04040' : c.coat;
  const coatD = flash ? '#a02828' : c.coatD;
  const cape = flash ? '#801020' : c.cape;
  const capeL = flash ? '#a01830' : c.capeL;
  const accent = flash ? '#fff0a0' : c.accent;

  ellipse(ctx, ox + 32, oy + 94, 18, 4, COLORS.shadow);
  withFlip(ctx, ox, oy, 64, flip, (bx, by) => {
    const shift = walk ? 5 : 0;
    // Connected flowing cape (single shape behind body, attached at shoulders)
    ctx.fillStyle = cape;
    ctx.beginPath();
    ctx.moveTo(bx + 18, by + 26);
    ctx.quadraticCurveTo(bx + 2, by + 48, bx + 10, by + 78);
    ctx.quadraticCurveTo(bx + 32, by + 70, bx + 54, by + 78);
    ctx.quadraticCurveTo(bx + 62, by + 48, bx + 46, by + 26);
    ctx.lineTo(bx + 32, by + 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = capeL;
    ctx.beginPath();
    ctx.moveTo(bx + 34, by + 26);
    ctx.quadraticCurveTo(bx + 56, by + 42, bx + 52, by + 68);
    ctx.quadraticCurveTo(bx + 40, by + 58, bx + 36, by + 40);
    ctx.closePath();
    ctx.fill();
    roundRect(ctx, bx + 18 - shift, by + 58, 10, 28, 2, '#1a1a2a');
    roundRect(ctx, bx + 36 + shift, by + 58, 10, 28, 2, '#12121c');
    roundRect(ctx, bx + 16 - shift, by + 82, 14, 12, 2, '#0a0a12');
    roundRect(ctx, bx + 34 + shift, by + 82, 14, 12, 2, '#0a0a12');
    roundRect(ctx, bx + 14, by + 26, 36, 36, 4, coatD);
    roundRect(ctx, bx + 16, by + 28, 32, 32, 4, coat);
    drawRect(ctx, bx + 28, by + 32, 8, 20, '#e8dcc8');
    roundRect(ctx, bx + 26, by + 50, 12, 6, 1, accent);
    roundRect(ctx, bx + 6, by + 30, 10, 22, 3, coatD);
    roundRect(ctx, bx + 48, by + 30, 10, 22, 3, coat);
    ellipse(ctx, bx + 10, by + 52, 5, 5, '#d4a880');
    ellipse(ctx, bx + 54, by + 52, 5, 5, '#e8c4a0');
    ellipse(ctx, bx + 32, by + 18, 12, 11, '#d4a880');
    ellipse(ctx, bx + 27, by + 16, 2, 2.2, '#200808');
    ellipse(ctx, bx + 37, by + 16, 2, 2.2, '#200808');
    drawRect(ctx, bx + 28, by + 22, 8, 2, '#c04040');
    ellipse(ctx, bx + 32, by + 8, 16, 5, c.hat);
    roundRect(ctx, bx + 22, by + 2, 20, 8, 2, c.hat);
    drawRect(ctx, bx + 24, by + 4, 16, 2, accent);
  });
}

// ── UI hearts (2× pixel maps) ──
const P_HEART = {
  R: '#e04040',
  D: '#a02020',
  L: '#f08080',
  K: '#401010',
  E: '#602020',
  M: '#301818',
};

const HEART_FULL = [
  '.RR.RR.',
  'RLRLRLR',
  'RLRRRLR',
  'DRRRRRD',
  '.DRRRD.',
  '..DRD..',
  '...D...',
];

const HEART_EMPTY = [
  '.EE.EE.',
  'EMEMEME',
  'EMEEEME',
  'MEMMMEM',
  '.MEMEM.',
  '..MEM..',
  '...M...',
];


/** Small floating dark wisp orb */
export function drawWisp(ctx, x, y, frame = 0, flash = false) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const pulse = 1 + Math.sin(frame * 2) * 0.08;
  const r = 10 * pulse;
  ctx.save();
  ctx.globalAlpha = flash ? 0.9 : 0.85;
  ellipse(ctx, ox + 14, oy + 14, r + 6, r + 6, 'rgba(40,0,60,0.35)');
  ellipse(ctx, ox + 14, oy + 14, r + 2, r + 2, '#1a0828');
  ellipse(ctx, ox + 14, oy + 14, r * 0.75, r * 0.75, '#2a1040');
  ellipse(ctx, ox + 12, oy + 11, r * 0.35, r * 0.3, flash ? '#c080ff' : '#6a30a0');
  if (frame % 2 === 0) {
    ellipse(ctx, ox + 18, oy + 8, 3, 2, 'rgba(120,60,180,0.5)');
  }
  ctx.restore();
}

/**
 * The painted Moroni sheet reads as a youth (large head, short body). At load time it is rebuilt,
 * PNG untouched: the head is drawn at 86% about the neck and the body stretched to fill the cell,
 * and the robe is lifted toward the "exceeding whiteness" Joseph described (JS—History 1:31).
 * The feet stay on the last row, so the Round-7 height and facing logic still measures correctly.
 */
const MORONI_HEAD_K = 0.86;
function reproportionMoroni(img) {
  const W0 = img.width;
  const H0 = img.height;
  const src = document.createElement('canvas');
  src.width = W0;
  src.height = H0;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);
  const data = sctx.getImageData(0, 0, W0, H0).data;
  const out = document.createElement('canvas');
  out.width = W0;
  out.height = H0;
  const o = out.getContext('2d');
  o.imageSmoothingEnabled = false; // keep the painted pixels crisp
  const FW = MORONI_FW;
  const FH = MORONI_FH;
  for (let col = 0; col < Math.floor(W0 / FW); col++) {
    const fx = col * FW;
    // neck = narrowest opaque row below the head
    let ny = 56;
    let best = 1e9;
    let nx = FW / 2;
    for (let y = 42; y <= 64; y++) {
      let n = 0;
      let sx = 0;
      for (let x = 0; x < FW; x++) {
        if (data[(y * W0 + fx + x) * 4 + 3] > 40) {
          n++;
          sx += x;
        }
      }
      if (n > 4 && n < best) {
        best = n;
        ny = y;
        nx = sx / n;
      }
    }
    const bodyH = FH - ny;
    const headDH = Math.round(ny * MORONI_HEAD_K);
    const bodyTop = headDH - 2;
    o.drawImage(img, fx, ny, FW, bodyH, fx, bodyTop, FW, FH - bodyTop);
    const headDW = FW * MORONI_HEAD_K;
    o.drawImage(img, fx, 0, FW, ny, fx + nx - nx * MORONI_HEAD_K, bodyTop + 2 - headDH, headDW, headDH);
  }
  // robe toward exceeding whiteness: brighten, desaturate, keep the warm gold trim
  const im = o.getImageData(0, 0, W0, H0);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 16) continue;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const warm = r - b;
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    if (l < 150) continue; // hair, eyes, outline and shading keep their colour
    if (warm > 70) continue; // skin and gold trim stay warm
    const nl = Math.min(255, l * 1.18 + 28);
    d[i] = Math.round(r * 0.35 + nl * 0.65);
    d[i + 1] = Math.round(g * 0.35 + nl * 0.65);
    d[i + 2] = Math.round(b * 0.35 + Math.min(255, nl * 1.02) * 0.65);
  }
  o.putImageData(im, 0, 0);
  return out;
}

// ── Moroni: drawn at Joseph's height, measured from the painted pixels ──
// Each sheet cell is 64×128, but the visible figures differ: Joseph's idle frame is
// ~114 px head-to-feet, Moroni's frames ~92–100 px plus a 2–3 px light glow rim.
// Matching cell sizes made Moroni look short, so each frame is scaled so his
// head-to-feet (dark-ish body pixels, glow rim excluded) equals Joseph's.
const MORONI_FW = 64;
const MORONI_FH = 128;
const MORONI_IDLE = [0, 1, 2, 1];
const MORONI_GREET = 3; // raised-hand frame, used when Joseph is close
const BODY_LUM = 150; // pixels darker than this are body/outline, lighter opaque ones are glow/robe highlights
// Fallbacks (from the PNGs) if the sheet can't be read back (tainted canvas)
const MORONI_FALLBACK = {
  joseph: { top: 14, bottom: 127, left: 13, right: 48, opTop: 13, opBottom: 127 },
  frames: [
    { top: 26, bottom: 125, left: 7, right: 56, opTop: 23, opBottom: 127 },
    { top: 29, bottom: 125, left: 13, right: 59, opTop: 26, opBottom: 127 },
    { top: 29, bottom: 125, left: 10, right: 59, opTop: 26, opBottom: 127 },
    { top: 34, bottom: 125, left: 4, right: 59, opTop: 31, opBottom: 127 },
  ],
};
let moroniMetrics = null;

/** Body + opaque bounds of one sheet cell. A row counts as body when ≥2 pixels are opaque and darker than BODY_LUM. */
function cellBounds(data, w, sx, sy, sw, sh) {
  let top = -1, bottom = -1, left = sw, right = -1, opTop = -1, opBottom = -1;
  for (let y = 0; y < sh; y++) {
    let dark = 0;
    let opaque = false;
    for (let x = 0; x < sw; x++) {
      const i = ((sy + y) * w + sx + x) * 4;
      if (data[i + 3] <= 128) continue;
      opaque = true;
      const lum = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
      if (lum < BODY_LUM) {
        dark++;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
    if (opaque) {
      if (opTop < 0) opTop = y;
      opBottom = y;
    }
    if (dark >= 2) {
      if (top < 0) top = y;
      bottom = y;
    }
  }
  return { top, bottom, left, right, opTop, opBottom };
}

function computeMoroniMetrics() {
  const jo = SHEETS.joseph;
  const mo = SHEETS.moroni;
  let m = null;
  try {
    if (jo && mo) {
      const read = (img) => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, img.width, img.height).data;
      };
      const jd = read(jo);
      const md = read(mo);
      const joseph = cellBounds(jd, jo.width, JOSEPH_IDLE[0] * JOSEPH_FW, 0, JOSEPH_FW, JOSEPH_FH);
      const frames = [];
      const n = Math.max(1, Math.floor(mo.width / MORONI_FW));
      for (let k = 0; k < n; k++) frames.push(cellBounds(md, mo.width, k * MORONI_FW, 0, MORONI_FW, MORONI_FH));
      if (joseph.top >= 0 && frames.every((f) => f.top >= 0)) m = { joseph, frames, measured: true };
    }
  } catch (_) {
    m = null;
  }
  if (!m) m = { ...MORONI_FALLBACK, measured: false };
  // Joseph's on-screen head-to-feet height (his cell is drawn 128 → JOSEPH_DH)
  m.targetH = ((m.joseph.bottom - m.joseph.top + 1) * JOSEPH_DH) / JOSEPH_FH;
  return m;
}

function getMoroniMetrics() {
  if (!moroniMetrics) moroniMetrics = computeMoroniMetrics();
  return moroniMetrics;
}

export function moroniFrameAt(t = 0, greet = false) {
  return greet ? MORONI_GREET : MORONI_IDLE[Math.floor(t / 18) % MORONI_IDLE.length];
}

/** Where a Moroni frame lands on screen (used by drawMoroni and the QA suite). */
export function moroniLayout(cx, footY, t = 0, faceLeft = false, greet = false) {
  const m = getMoroniMetrics();
  let fi = moroniFrameAt(t, greet);
  if (!m.frames[fi]) fi = 0;
  const f = m.frames[fi];
  const bodyH = f.bottom - f.top + 1;
  const dh = Math.round((MORONI_FH * m.targetH) / bodyH);
  const s = dh / MORONI_FH;
  const dw = Math.round(MORONI_FW * s);
  const bob = Math.round((Math.sin(t * 0.05) + 1) * 1); // 0–2 px float, feet never below the baseline
  const dy = Math.round(footY - bob - (f.bottom + 1) * s);
  const vc = (f.left + f.right + 1) / 2;
  const dx = Math.round(faceLeft ? cx - (MORONI_FW - vc) * s : cx - vc * s);
  return {
    frame: fi, dx, dy, dw, dh, scale: s, bob, faceLeft,
    headY: dy + f.top * s,
    feetY: dy + (f.bottom + 1) * s,
    bodyH: bodyH * s,
    opaqueH: (f.opBottom - f.opTop + 1) * s,
    josephBodyH: m.targetH,
    josephOpaqueH: ((m.joseph.opBottom - m.joseph.opTop + 1) * JOSEPH_DH) / JOSEPH_FH,
    measured: m.measured,
  };
}

/**
 * Moroni, feet on `footY` (Joseph's baseline) and centred on `cx`.
 * `faceLeft` flips the sheet (it is painted facing right) so he always faces Joseph.
 */
export function drawMoroni(ctx, cx, footY, t = 0, faceLeft = false, greet = false) {
  const img = SHEETS.moroni;
  const pulse = 0.5 + Math.sin(t * 0.06) * 0.15;
  ctx.save();
  // Soft light pooled on the ground under him
  ellipse(ctx, Math.round(cx), Math.round(footY - 1), 26, 5, `rgba(255,226,150,${(pulse * 0.45).toFixed(3)})`);
  ctx.restore();
  if (img) {
    const L = moroniLayout(cx, footY, t, faceLeft, greet);
    // soft glory behind him: a warm-white aura and a few broad, faint light shafts
    const gx = cx;
    const gy = footY - L.bodyH * 0.55;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const aura = ctx.createRadialGradient(gx, gy, 6, gx, gy, L.bodyH * 0.9);
    aura.addColorStop(0, 'rgba(255,248,228,0.42)');
    aura.addColorStop(0.5, 'rgba(255,240,200,0.14)');
    aura.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = aura;
    ctx.fillRect(gx - L.bodyH, gy - L.bodyH, L.bodyH * 2, L.bodyH * 2);
    ctx.translate(gx, gy);
    ctx.rotate(Math.sin(t * 0.01) * 0.08);
    const ray = ctx.createLinearGradient(0, 0, 0, -L.bodyH * 1.1);
    ray.addColorStop(0, 'rgba(255,246,220,0.16)');
    ray.addColorStop(1, 'rgba(255,246,220,0)');
    ctx.fillStyle = ray;
    for (let i = 0; i < 7; i++) {
      ctx.save();
      ctx.rotate(-1.2 + i * 0.4);
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.lineTo(16, -L.bodyH * 1.1);
      ctx.lineTo(-16, -L.bodyH * 1.1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    blitSimple(ctx, img, L.frame * MORONI_FW, 0, MORONI_FW, MORONI_FH, L.dx, L.dy, L.dw, L.dh, faceLeft, false);
    return L;
  }
  const ox = Math.floor(cx - 20);
  const oy = Math.floor(footY - 100);
  ctx.save();
  if (faceLeft) {
    ctx.translate(ox * 2 + 40, 0);
    ctx.scale(-1, 1);
  }
  ellipse(ctx, ox + 20, oy + 44, 36, 56, `rgba(255,230,160,${pulse * 0.35})`);
  ellipse(ctx, ox + 20, oy + 44, 24, 44, `rgba(255,240,200,${pulse * 0.25})`);
  roundRect(ctx, ox + 8, oy + 30, 24, 68, 8, '#f5ecd0');
  roundRect(ctx, ox + 10, oy + 32, 20, 64, 6, '#fff8e0');
  roundRect(ctx, ox + 10, oy + 56, 20, 4, 1, '#d4a84b');
  ellipse(ctx, ox + 20, oy + 16, 10, 13, '#fffaf0');
  ellipse(ctx, ox + 20, oy + 14, 7, 8, '#ffe8b0');
  roundRect(ctx, ox + 28, oy + 38, 14, 5, 2, '#f0e6d0');
  ctx.restore();
  return null;
}

/** Gold plates chest pickup */
export function drawPlateChest(ctx, x, y, taken = false) {
  if (taken) return;
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  ctx.save();
  // Soft gold glow
  ellipse(ctx, ox + 22, oy + 18, 28, 18, 'rgba(212,168,75,0.3)');
  // Chest body
  roundRect(ctx, ox + 4, oy + 12, 36, 22, 3, '#6a4a20');
  roundRect(ctx, ox + 6, oy + 14, 32, 18, 2, '#8a6a30');
  // Lid
  roundRect(ctx, ox + 2, oy + 4, 40, 12, 3, '#a07828');
  roundRect(ctx, ox + 4, oy + 6, 36, 8, 2, '#d4a84b');
  // Gold plates peeking
  drawRect(ctx, ox + 10, oy + 8, 24, 3, '#f0d070');
  drawRect(ctx, ox + 12, oy + 10, 20, 2, '#e8c050');
  // Latch
  roundRect(ctx, ox + 18, oy + 14, 8, 8, 1, '#c4983a');
  drawRect(ctx, ox + 20, oy + 16, 4, 4, '#fff0a0');
  ctx.restore();
}

export function drawHeart(ctx, x, y, filled) {
  drawPixels(ctx, Math.floor(x), Math.floor(y), filled ? HEART_FULL : HEART_EMPTY, P_HEART, false, SCALE);
}

export function drawPanel(ctx, x, y, w, h, fill = 'rgba(12,8,6,0.92)') {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox, oy, w, h, fill);
  drawRect(ctx, ox, oy, w, 2, COLORS.uiGold);
  drawRect(ctx, ox, oy + h - 2, w, 2, COLORS.uiGold);
  drawRect(ctx, ox, oy, 2, h, COLORS.uiGold);
  drawRect(ctx, ox + w - 2, oy, 2, h, COLORS.uiGold);
  drawRect(ctx, ox + 4, oy + 4, w - 8, 2, '#c4983a');
  drawRect(ctx, ox + 4, oy + h - 6, w - 8, 2, '#5a4010');
}

// ── Bitmap font (scaled) ──
const FONT_W = 5;
const FONT_H = 7;
const FONT_GAP = 1;

const FONT = {
  " ": [0, 0, 0, 0, 0, 0, 0],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "'": [4, 4, 8, 0, 0, 0, 0],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "+": [0, 4, 4, 31, 4, 4, 0],
  ",": [0, 0, 0, 0, 4, 4, 8],
  "-": [0, 0, 0, 31, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 4, 4],
  "/": [1, 2, 2, 4, 8, 8, 16],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 2, 4, 8, 31],
  "3": [30, 1, 1, 14, 1, 1, 30],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [14, 16, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 1, 14],
  ":": [0, 4, 4, 0, 4, 4, 0],
  "?": [14, 17, 1, 2, 4, 0, 4],
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 14],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 17, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 17, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  a: [0, 0, 14, 1, 15, 17, 15],
  b: [16, 16, 30, 17, 17, 17, 30],
  c: [0, 0, 14, 16, 16, 16, 14],
  d: [1, 1, 15, 17, 17, 17, 15],
  e: [0, 0, 14, 17, 31, 16, 14],
  f: [6, 8, 8, 28, 8, 8, 8],
  g: [0, 0, 15, 17, 15, 1, 14],
  h: [16, 16, 30, 17, 17, 17, 17],
  i: [4, 0, 12, 4, 4, 4, 14],
  j: [2, 0, 6, 2, 2, 18, 12],
  k: [16, 16, 18, 20, 24, 20, 18],
  l: [12, 4, 4, 4, 4, 4, 14],
  m: [0, 0, 26, 21, 21, 17, 17],
  n: [0, 0, 30, 17, 17, 17, 17],
  o: [0, 0, 14, 17, 17, 17, 14],
  p: [0, 0, 30, 17, 30, 16, 16],
  q: [0, 0, 15, 17, 15, 1, 1],
  r: [0, 0, 22, 25, 16, 16, 16],
  s: [0, 0, 15, 16, 14, 1, 30],
  t: [8, 8, 28, 8, 8, 8, 6],
  u: [0, 0, 17, 17, 17, 17, 15],
  v: [0, 0, 17, 17, 17, 10, 4],
  w: [0, 0, 17, 17, 21, 21, 10],
  x: [0, 0, 17, 10, 4, 10, 17],
  y: [0, 0, 17, 17, 15, 1, 14],
  z: [0, 0, 31, 2, 4, 8, 31],
  "·": [0, 0, 0, 4, 0, 0, 0],
  "–": [0, 0, 0, 31, 0, 0, 0],
  "—": [0, 0, 0, 31, 0, 0, 0],
  "%": [24, 25, 2, 4, 8, 19, 3],
  "…": [0, 0, 0, 0, 0, 0, 21],
  "↓": [4, 4, 4, 4, 21, 14, 4],
  "▼": [0, 31, 31, 14, 14, 4, 0],
  "~": [0, 0, 8, 21, 2, 0, 0],
  "«": [0, 5, 10, 20, 10, 5, 0],
  "»": [0, 20, 10, 5, 10, 20, 0],
  "→": [0, 4, 2, 31, 2, 4, 0],
  "←": [0, 4, 8, 31, 8, 4, 0],
  "▶": [8, 12, 14, 15, 14, 12, 8],
  "◀": [2, 6, 14, 30, 14, 6, 2],
  "★": [4, 4, 31, 14, 14, 27, 17],
};

export function textScale(size = 8) {
  // At 2× canvas: size 8 → 2px glyphs, ≥12 → 3, ≥16 → 4
  if (size >= 16) return 4;
  if (size >= 12) return 3;
  return SCALE; // 2
}

export function measureText(text, size = 8) {
  const scale = textScale(size);
  const s = String(text);
  if (!s.length) return 0;
  return s.length * (FONT_W + FONT_GAP) * scale - FONT_GAP * scale;
}

function glyphFor(ch) {
  return FONT[ch] || FONT['?'] || FONT[' '];
}

function paintGlyph(ctx, glyph, x, y, scale, color) {
  ctx.fillStyle = color;
  for (let row = 0; row < FONT_H; row++) {
    const bits = glyph[row];
    for (let col = 0; col < FONT_W; col++) {
      if (bits & (0x10 >> col)) {
        ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
      }
    }
  }
}

export function drawText(ctx, text, x, y, color = COLORS.uiCream, size = 8, outline = true) {
  const scale = textScale(size);
  const px = Math.floor(x);
  const py = Math.floor(y);
  const s = String(text);
  const outlineColor = '#050302';
  const ring = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];

  if (outline) {
    for (let i = 0; i < s.length; i++) {
      const g = glyphFor(s[i]);
      const gx = px + i * (FONT_W + FONT_GAP) * scale;
      for (const [dx, dy] of ring) {
        paintGlyph(ctx, g, gx + dx, py + dy, scale, outlineColor);
      }
    }
  }

  for (let i = 0; i < s.length; i++) {
    const g = glyphFor(s[i]);
    const gx = px + i * (FONT_W + FONT_GAP) * scale;
    paintGlyph(ctx, g, gx, py, scale, color);
  }
}

export function drawCentered(ctx, text, y, color = COLORS.uiCream, size = 8, outline = true) {
  const w = measureText(text, size);
  drawText(ctx, text, Math.floor((W - w) / 2), y, color, size, outline);
}

export function drawTitleFlourish(ctx, cx, y) {
  const gold = COLORS.uiGold;
  const dim = '#8b6914';
  cx = Math.floor(cx);
  y = Math.floor(y);
  drawRect(ctx, cx - 2, y, 4, 2, gold);
  drawRect(ctx, cx - 4, y + 2, 8, 2, gold);
  drawRect(ctx, cx - 6, y + 4, 12, 2, gold);
  drawRect(ctx, cx - 4, y + 6, 8, 2, gold);
  drawRect(ctx, cx - 2, y + 8, 4, 2, gold);
  drawRect(ctx, cx - 2, y + 4, 4, 2, '#fff0c0');
  for (const dir of [-1, 1]) {
    drawRect(ctx, cx + dir * 12, y + 4, 24, 2, dim);
    drawRect(ctx, cx + dir * 36, y + 2, 4, 6, gold);
    drawRect(ctx, cx + dir * 42, y + 4, 20, 2, dim);
    drawRect(ctx, cx + dir * 62, y + 2, 6, 2, '#3d7a3a');
    drawRect(ctx, cx + dir * 64, y + 4, 6, 2, '#4a8a40');
    drawRect(ctx, cx + dir * 62, y + 6, 6, 2, '#3d7a3a');
  }
}

export function drawTitleUnderline(ctx, cx, y, halfW = 140) {
  cx = Math.floor(cx);
  y = Math.floor(y);
  drawRect(ctx, cx - halfW, y, halfW * 2, 2, COLORS.uiGold);
  drawRect(ctx, cx - halfW + 8, y + 4, halfW * 2 - 16, 2, '#8b6914');
  drawRect(ctx, cx - 4, y - 2, 8, 2, '#fff0c0');
}
