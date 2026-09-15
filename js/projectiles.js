/**
 * Gold-plate projectiles — engraved metallic sheets.
 */
import { W, SCALE } from './constants.js';
import { drawGoldPlate, drawKnife } from './sprites.js';

export const PLATE_SPEED = 3.8 * SCALE;
export const PLATE_MAX_TRAVEL = 130 * SCALE;
export const PLATE_W = 10 * SCALE;
export const PLATE_H = 7 * SCALE;
export const PLATE_COOLDOWN = 20;
export const THROW_POSE = 10;

export function createPlate(x, y, facing) {
  return {
    x,
    y,
    vx: facing * PLATE_SPEED,
    facing,
    w: PLATE_W,
    h: PLATE_H,
    alive: true,
    traveled: 0,
    damage: 1,
    trail: [],
  };
}

export function plateHitbox(p) {
  return { x: p.x, y: p.y, w: p.w, h: p.h };
}

export function updatePlates(plates, dt, camX, levelWidthPx) {
  for (const p of plates) {
    if (!p.alive) continue;
    if (p.trail) {
      p.trail.push({ x: p.x, y: p.y, life: 1 });
      if (p.trail.length > 7) p.trail.shift();
      for (const t of p.trail) t.life -= 0.14 * dt;
      p.trail = p.trail.filter((t) => t.life > 0);
    }
    const dx = p.vx * dt;
    p.x += dx;
    p.traveled += Math.abs(dx);
    if (p.traveled >= PLATE_MAX_TRAVEL) {
      p.alive = false;
      continue;
    }
    if (p.x + p.w < camX - 16 * SCALE || p.x > camX + W + 16 * SCALE) {
      p.alive = false;
      continue;
    }
    if (p.x < -32 * SCALE || p.x > levelWidthPx + 32 * SCALE) {
      p.alive = false;
    }
  }
  if (plates.length > 12) {
    for (let i = plates.length - 1; i >= 0; i--) {
      if (!plates[i].alive) plates.splice(i, 1);
    }
  }
}

export function drawPlates(ctx, plates, camX) {
  for (const p of plates) {
    if (!p.alive) continue;
    if (p.trail && p.trail.length) {
      for (let i = 0; i < p.trail.length; i++) {
        const t = p.trail[i];
        const a = Math.max(0, Math.min(0.55, t.life * 0.5));
        ctx.save();
        ctx.globalAlpha = a;
        drawGoldPlate(ctx, t.x - camX, t.y, p.facing);
        ctx.restore();
      }
    }
    drawGoldPlate(ctx, p.x - camX, p.y, p.facing);
  }
}

export const KNIFE_SPEED = 2.6 * SCALE;
export const KNIFE_MAX_TRAVEL = 150 * SCALE;
export const KNIFE_W = 8 * SCALE;
export const KNIFE_H = 4 * SCALE;

export function createKnife(x, y, facing, damage = 1) {
  return {
    x, y,
    vx: facing * KNIFE_SPEED,
    facing,
    w: KNIFE_W,
    h: KNIFE_H,
    alive: true,
    traveled: 0,
    damage,
  };
}

export function knifeHitbox(k) {
  return { x: k.x, y: k.y, w: k.w, h: k.h };
}

export function updateKnives(knives, dt, camX, levelWidthPx) {
  updatePlates(knives, dt, camX, levelWidthPx);
}

export function drawKnives(ctx, knives, camX) {
  for (const k of knives) {
    if (!k.alive) continue;
    if (k.dark) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.filter = 'hue-rotate(240deg) saturate(1.6) brightness(0.7)';
      drawKnife(ctx, k.x - camX, k.y, k.facing);
      ctx.restore();
    } else {
      drawKnife(ctx, k.x - camX, k.y, k.facing);
    }
  }
}
