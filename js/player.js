import { GRAVITY, FRICTION, MAX_FALL } from './constants.js';
import { drawJoseph } from './sprites.js';
import { isDown, justPressed } from './input.js';
import {
  createPlate,
  PLATE_COOLDOWN,
  THROW_POSE,
  PLATE_H,
} from './projectiles.js';

export const STAND_H = 32;
export const CROUCH_H = 20;
const STAND_SPEED = 1.55;
const CROUCH_SPEED = 0.55;
const JUMP_V = -6.2;

export function createPlayer(spawnX, spawnY) {
  return {
    x: spawnX,
    y: spawnY,
    vx: 0,
    vy: 0,
    w: 16,
    h: STAND_H,
    facing: 1,
    onGround: false,
    crouching: false,
    hp: 5,
    maxHp: 5,
    invuln: 0,
    attackTimer: 0,
    attackCooldown: 0,
    alive: true,
    anim: 0,
    animT: 0,
    /** Gold-plate projectiles currently in flight */
    plates: [],
  };
}

export function playerHitbox(p) {
  // Shorter hurtbox while crouched (duck under low hazards)
  if (p.crouching) {
    return { x: p.x + 2, y: p.y + 2, w: p.w - 4, h: p.h - 2 };
  }
  return { x: p.x + 2, y: p.y + 2, w: p.w - 4, h: p.h - 2 };
}

/**
 * Legacy melee staff box — retained as null so plates are the sole attack.
 * (Call sites may still import this; always inactive.)
 */
export function playerAttackBox(_p) {
  return null;
}

function tryStand(p, solids) {
  if (!p.crouching) return;
  const rise = STAND_H - CROUCH_H;
  const probe = {
    x: p.x + 2,
    y: p.y - rise + 2,
    w: p.w - 4,
    h: STAND_H - 2,
  };
  for (const s of solids) {
    if (aabb(probe, s)) return; // blocked — stay crouched
  }
  p.y -= rise;
  p.h = STAND_H;
  p.crouching = false;
}

export function updatePlayer(p, solids, dt) {
  if (!p.alive) return;

  const wantCrouch = isDown('down') && p.onGround;

  if (wantCrouch && !p.crouching) {
    const drop = STAND_H - CROUCH_H;
    p.y += drop;
    p.h = CROUCH_H;
    p.crouching = true;
  } else if (!wantCrouch && p.crouching) {
    tryStand(p, solids);
  }

  // Airborne always stands (crouch is ground-only); expand upward
  if (!p.onGround && p.crouching) {
    p.y -= STAND_H - CROUCH_H;
    p.h = STAND_H;
    p.crouching = false;
  }

  const speed = p.crouching ? CROUCH_SPEED : STAND_SPEED;

  if (isDown('left')) {
    p.vx = -speed;
    p.facing = -1;
  } else if (isDown('right')) {
    p.vx = speed;
    p.facing = 1;
  } else {
    p.vx *= FRICTION;
    if (Math.abs(p.vx) < 0.05) p.vx = 0;
  }

  // Prefer clear feel: release crouch to jump (no jump while crouched)
  if (isDown('up') && p.onGround && !p.crouching) {
    p.vy = JUMP_V;
    p.onGround = false;
  }

  if (p.attackCooldown > 0) p.attackCooldown -= dt;
  if (p.attackTimer > 0) p.attackTimer -= dt;

  if (justPressed('attack') && p.attackCooldown <= 0) {
    p.attackTimer = THROW_POSE;
    p.attackCooldown = PLATE_COOLDOWN;
    // Spawn engraved gold plate slightly ahead at chest height
    const px = p.facing > 0 ? p.x + p.w - 2 : p.x - 10;
    const chest = p.crouching ? 8 : 12;
    const py = p.y + chest - Math.floor(PLATE_H / 2);
    p.plates.push(createPlate(px, py, p.facing));
  }

  p.vy += GRAVITY;
  if (p.vy > MAX_FALL) p.vy = MAX_FALL;

  p.x += p.vx;
  resolve(p, solids, true);

  p.y += p.vy;
  p.onGround = false;
  resolve(p, solids, false);

  if (p.invuln > 0) p.invuln -= dt;

  if (Math.abs(p.vx) > 0.2 && p.onGround) {
    p.animT += dt;
    if (p.animT > 8) {
      p.animT = 0;
      p.anim = (p.anim + 1) % 2;
    }
  }

  if (p.y > 320) {
    p.hp = 0;
    p.alive = false;
  }
}

function resolve(p, solids, horizontal) {
  const box = playerHitbox(p);
  for (const s of solids) {
    if (!aabb(box, s)) continue;
    if (horizontal) {
      if (p.vx > 0) p.x = s.x - (p.w - 2);
      else if (p.vx < 0) p.x = s.x + s.w - 2;
      p.vx = 0;
      box.x = p.x + 2;
    } else {
      if (p.vy > 0) {
        p.y = s.y - p.h;
        p.vy = 0;
        p.onGround = true;
      } else if (p.vy < 0) {
        p.y = s.y + s.h - 2;
        p.vy = 0;
      }
      box.y = p.y + 2;
      box.h = p.h - 2;
    }
  }
}

export function hurtPlayer(p, dmg = 1) {
  if (p.invuln > 0 || !p.alive) return false;
  p.hp -= dmg;
  p.invuln = 60;
  p.vy = -3;
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
  }
  return true;
}

export function drawPlayer(ctx, p, camX) {
  if (!p.alive) return;
  if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) return;
  // Draw crouched sprite bottom-aligned in the standing slot
  const drawY = p.crouching ? p.y - (STAND_H - CROUCH_H) : p.y;
  drawJoseph(
    ctx,
    p.x - camX,
    drawY,
    p.facing,
    p.anim,
    p.attackTimer > 0,
    !p.onGround,
    p.crouching
  );
}

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export { aabb };
