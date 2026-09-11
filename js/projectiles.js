/**
 * Gold-plate projectiles — Joseph flings engraved sheets of the plates.
 * Straight-line ranged attack; tasteful NES arcade read (not parody).
 */
import { W } from './constants.js';
import { drawGoldPlate } from './sprites.js';

export const PLATE_SPEED = 3.8;
export const PLATE_MAX_TRAVEL = 130;
export const PLATE_W = 10;
export const PLATE_H = 7;
/** Frames between throws — keeps phone B-button fire fair */
export const PLATE_COOLDOWN = 20;
/** Throw pose duration (frames) */
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

/**
 * Move plates; despawn after travel distance or far off camera / world.
 * Mutates array in place (compacts dead entries periodically).
 */
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
    // Off-screen (with margin) or past level bounds
    if (p.x + p.w < camX - 16 || p.x > camX + W + 16) {
      p.alive = false;
      continue;
    }
    if (p.x < -32 || p.x > levelWidthPx + 32) {
      p.alive = false;
    }
  }
  // Compact occasionally to avoid unbounded growth
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
