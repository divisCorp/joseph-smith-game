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
  };
}

export function plateHitbox(p) {
  return { x: p.x, y: p.y, w: p.w, h: p.h };
}

export function updatePlates(plates, dt, camX, levelWidthPx) {
  for (const p of plates) {
    if (!p.alive) continue;
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
    drawKnife(ctx, k.x - camX, k.y, k.facing);
  }
}
