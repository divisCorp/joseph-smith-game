/**
 * HD illustrated / painterly 16-bit sprites (procedural canvas).
 * Respectful stylized characters — not photoreal likenesses.
 * Drawn at 2× NES scale for phone-friendly crisp detail.
 */
import { COLORS, W, SCALE } from './constants.js';

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
};
let sheetsReady = false;
let sheetsLoading = false;

/** User sheet slices: idle 0-2, walk 3-6, jump 7, crouch/pray 8, throw/speak 9-10 */
const JOSEPH_FW = 64;
const JOSEPH_FH = 128;
const JOSEPH_IDLE = [0, 1, 2];
const JOSEPH_WALK = [3, 4, 5, 6];
const JOSEPH_JUMP = 7;
const JOSEPH_CROUCH = 8;
const JOSEPH_THROW = [9, 10];
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
          const file =
            key === 'joseph'
              ? 'joseph.png'
              : key === 'foes'
                ? 'foes.png'
                : key === 'wolf'
                  ? 'wolf.png'
                  : key === 'portraits'
                    ? 'portraits.png'
                    : 'bosses.png';
          img.src = assetUrl(file);
        })
    )
  ).then(() => {
    sheetsReady = !!(SHEETS.joseph || SHEETS.foes);
    sheetsLoading = false;
    return sheetsReady;
  });
  return sheetsLoading;
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
    ctx.filter = 'brightness(1.35) sepia(0.4) hue-rotate(-20deg) saturate(2)';
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
  if (flash) ctx.filter = 'brightness(1.4) sepia(0.5) hue-rotate(-25deg) saturate(2.2)';
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

// ── Joseph Smith (36×72 draw/hitbox; sheet cells 64×128 — never blit speak/preach busts for jump/throw) ──
const JOSEPH_DW = 36;
const JOSEPH_DH = 72;

export function drawJoseph(ctx, x, y, facing, frame, attacking, jumping = false, crouching = false, moving = false, lookingUp = false) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const flip = facing < 0;
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
      // Jump sheet cell is a speak/preach bust (no legs). Use walk-cycle full body + slight lift.
      fi = JOSEPH_WALK[((frame % JOSEPH_WALK.length) + JOSEPH_WALK.length) % JOSEPH_WALK.length];
      dy = oy - 5;
    } else if (pose === 'throw') {
      fi = JOSEPH_THROW[((frame % JOSEPH_THROW.length) + JOSEPH_THROW.length) % JOSEPH_THROW.length];
    } else if (pose === 'walk') {
      fi = JOSEPH_WALK[((frame % JOSEPH_WALK.length) + JOSEPH_WALK.length) % JOSEPH_WALK.length];
    } else if (pose === 'lookup') {
      fi = JOSEPH_IDLE[0];
    }
    // Feet at bottom of scaled cell → ground at oy + JOSEPH_DH (matches STAND_H). Art width matches hitbox.
    blitSimple(ctx, img, fi * JOSEPH_FW, 0, JOSEPH_FW, JOSEPH_FH, ox, dy, JOSEPH_DW, JOSEPH_DH, flip, false);
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
  ctx.fillStyle = '#8a9098';
  ctx.beginPath();
  ctx.moveTo(ox, oy + 3);
  ctx.lineTo(ox + 12, oy + 1);
  ctx.lineTo(ox + 14, oy + 3);
  ctx.lineTo(ox + 12, oy + 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d8dee6';
  ctx.fillRect(ox + 2, oy + 2, 9, 2);
  ctx.fillStyle = '#5a3a20';
  ctx.fillRect(ox - 3, oy + 2, 4, 3);
  ctx.fillStyle = '#c4a060';
  ctx.fillRect(ox, oy + 1, 2, 5);
  ctx.restore();
}

function drawFoeFromSheet(ctx, x, y, facing, frame, flash, kind) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const img = SHEETS.foes;
  if (img) {
    const row = FOE_ROWS[kind] ?? 0;
    const col = frame % 2;
    // Same family as Joseph: sheet cells 64×128, draw 36×72 (no squash/stretch)
    const dw = JOSEPH_DW;
    const dh = JOSEPH_DH;
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
    const col = frame % 2;
    // Painted wolf sheet 96×64 cells; draw ~56×40 so it sits next to Joseph (36×72)
    const dw = 56;
    const dh = 40;
    blitSimple(ctx, img, col * 96, 0, 96, 64, ox - 4, oy + 4, dw, dh, facing < 0, flash);
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
    const col = frame % 2;
    // Same 1:2 aspect as Joseph (64×128 → 36×72); bosses larger at 48×96 from 80×160 cells
    const dw = 48;
    const dh = 96;
    blitSimple(ctx, img, col * 80, row * 160, 80, 160, ox - 6, oy, dw, dh, facing < 0, flash);
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
