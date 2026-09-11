import { GRAVITY, FRICTION, MAX_FALL } from './constants.js';
import { drawJoseph } from './sprites.js';
import { isDown, justPressed } from './input.js';

export function createPlayer(spawnX, spawnY) {
  return {
    x: spawnX,
    y: spawnY,
    vx: 0,
    vy: 0,
    w: 16,
    h: 32,
    facing: 1,
    onGround: false,
    hp: 5,
    maxHp: 5,
    invuln: 0,
    attackTimer: 0,
    attackCooldown: 0,
    attackHit: false,
    alive: true,
    anim: 0,
    animT: 0,
  };
}

export function playerHitbox(p) {
  return { x: p.x + 2, y: p.y + 2, w: p.w - 4, h: p.h - 2 };
}

export function playerAttackBox(p) {
  if (p.attackTimer <= 0) return null;
  const reach = 14;
  return {
    x: p.facing > 0 ? p.x + p.w - 2 : p.x - reach + 2,
    y: p.y + 10,
    w: reach,
    h: 10,
  };
}

export function updatePlayer(p, solids, dt) {
  if (!p.alive) return;

  const speed = 1.55;
  const jump = -6.2;

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

  if (isDown('up') && p.onGround) {
    p.vy = jump;
    p.onGround = false;
  }

  if (p.attackCooldown > 0) p.attackCooldown -= dt;
  if (p.attackTimer > 0) p.attackTimer -= dt;
  else p.attackHit = false;

  if (justPressed('attack') && p.attackCooldown <= 0) {
    p.attackTimer = 12;
    p.attackCooldown = 18;
    p.attackHit = false;
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
  drawJoseph(ctx, p.x - camX, p.y, p.facing, p.anim, p.attackTimer > 0, !p.onGround);
}

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export { aabb };
