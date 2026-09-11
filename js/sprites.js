/**
 * Pixel-ish drawing helpers (colored rect sprites).
 * Respectful arcade look for Joseph Smith and frontier foes.
 */
import { COLORS } from './constants.js';

export function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
}

/** Joseph Smith — simple pixel hero (coat, trousers, boots) */
export function drawJoseph(ctx, x, y, facing, frame, attacking) {
  const f = facing >= 0 ? 1 : -1;
  const ox = Math.floor(x);
  const oy = Math.floor(y);

  // shadow
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(ox + 2, oy + 30, 12, 3);

  // legs (walk cycle)
  const legOff = frame % 2 === 0 ? 0 : 1;
  drawRect(ctx, ox + 4, oy + 22, 4, 8, '#2a2a4a'); // left trouser
  drawRect(ctx, ox + 9, oy + 22 + legOff, 4, 8 - legOff, '#2a2a4a');
  drawRect(ctx, ox + 4, oy + 28, 4, 3, '#3a2818'); // boots
  drawRect(ctx, ox + 9, oy + 28 + legOff, 4, 3, '#3a2818');

  // body / coat
  drawRect(ctx, ox + 3, oy + 10, 11, 13, '#1a3a5c'); // navy coat
  drawRect(ctx, ox + 5, oy + 12, 7, 8, '#e8dcc8'); // shirt
  drawRect(ctx, ox + 7, oy + 12, 2, 8, '#1a3a5c'); // coat lapel

  // head
  drawRect(ctx, ox + 5, oy + 2, 7, 8, '#e8c4a0'); // face
  drawRect(ctx, ox + 4, oy + 1, 9, 3, '#2a1a10'); // hair
  drawRect(ctx, ox + (f > 0 ? 9 : 5), oy + 5, 2, 2, '#1a1a1a'); // eye

  // arm / melee
  if (attacking) {
    const ax = f > 0 ? ox + 14 : ox - 6;
    drawRect(ctx, ax, oy + 12, 8, 3, '#e8c4a0'); // arm
    drawRect(ctx, ax + (f > 0 ? 6 : -2), oy + 10, 4, 6, '#8b6914'); // staff tip
  } else {
    drawRect(ctx, f > 0 ? ox + 12 : ox + 1, oy + 12, 3, 8, '#e8c4a0');
  }
}

/** Brigand foe */
export function drawBrigand(ctx, x, y, facing, frame) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const leg = frame % 2;
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(ox + 2, oy + 30, 12, 3);
  drawRect(ctx, ox + 4, oy + 22, 4, 8, '#3a2a1a');
  drawRect(ctx, ox + 9, oy + 22 + leg, 4, 8 - leg, '#3a2a1a');
  drawRect(ctx, ox + 3, oy + 10, 11, 13, '#5a3020'); // brown coat
  drawRect(ctx, ox + 5, oy + 2, 7, 8, '#c4a080');
  drawRect(ctx, ox + 4, oy + 1, 9, 3, '#1a1a1a');
  drawRect(ctx, ox + (facing > 0 ? 9 : 5), oy + 5, 2, 2, '#8b0000');
  // bandana
  drawRect(ctx, ox + 4, oy + 3, 9, 2, '#8b2020');
}

/** Wild wolf / animal foe */
export function drawWolf(ctx, x, y, facing, frame) {
  const ox = Math.floor(x);
  const oy = Math.floor(y) + 8;
  const bob = frame % 2;
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(ox + 2, oy + 20, 14, 3);
  drawRect(ctx, ox + 2, oy + 8 + bob, 14, 10, '#5a5a5a'); // body
  drawRect(ctx, facing > 0 ? ox + 12 : ox - 2, oy + 4 + bob, 8, 8, '#6a6a6a'); // head
  drawRect(ctx, facing > 0 ? ox + 16 : ox - 2, oy + 8 + bob, 3, 2, '#e8e8e8'); // snout
  drawRect(ctx, facing > 0 ? ox + 14 : ox, oy + 6 + bob, 2, 2, '#ffcc00'); // eye
  drawRect(ctx, facing > 0 ? ox : ox + 14, oy + 6 + bob, 4, 4, '#4a4a4a'); // tail
  drawRect(ctx, ox + 4, oy + 16 + bob, 3, 5, '#4a4a4a');
  drawRect(ctx, ox + 11, oy + 16 + bob, 3, 5, '#4a4a4a');
}

/** Boss: Frontier Ringleader */
export function drawBoss(ctx, x, y, facing, frame, flash) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const leg = frame % 2;
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(ox + 4, oy + 46, 24, 4);
  const coat = flash ? '#c04040' : '#2a1a40';
  drawRect(ctx, ox + 6, oy + 30, 8, 16, '#1a1a2a');
  drawRect(ctx, ox + 18, oy + 30 + leg, 8, 16 - leg, '#1a1a2a');
  drawRect(ctx, ox + 4, oy + 12, 24, 20, coat);
  drawRect(ctx, ox + 8, oy + 14, 16, 12, '#e8dcc8');
  drawRect(ctx, ox + 10, oy + 2, 12, 12, '#d4a880');
  drawRect(ctx, ox + 8, oy + 0, 16, 5, '#1a0a08'); // hat brim
  drawRect(ctx, ox + 12, oy + -4, 8, 6, '#1a0a08'); // hat top
  drawRect(ctx, ox + (facing > 0 ? 16 : 10), oy + 6, 3, 3, '#200');
  // cape
  drawRect(ctx, ox + 2, oy + 14, 4, 18, '#4a1020');
  drawRect(ctx, ox + 26, oy + 14, 4, 18, '#4a1020');
}

export function drawHeart(ctx, x, y, filled) {
  const c = filled ? '#e04040' : '#402020';
  drawRect(ctx, x + 1, y, 3, 3, c);
  drawRect(ctx, x + 5, y, 3, 3, c);
  drawRect(ctx, x, y + 2, 9, 4, c);
  drawRect(ctx, x + 1, y + 5, 7, 2, c);
  drawRect(ctx, x + 3, y + 7, 3, 2, c);
}

export function drawText(ctx, text, x, y, color = COLORS.uiCream, size = 8) {
  ctx.fillStyle = color;
  ctx.font = `${size}px "Courier New", monospace`;
  ctx.textBaseline = 'top';
  ctx.fillText(text, Math.floor(x), Math.floor(y));
}

export function drawCentered(ctx, text, y, color = COLORS.uiCream, size = 8) {
  ctx.font = `${size}px "Courier New", monospace`;
  const w = ctx.measureText(text).width;
  drawText(ctx, text, (256 - w) / 2, y, color, size);
}
