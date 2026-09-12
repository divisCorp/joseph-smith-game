import { GRAVITY, FRICTION, MAX_FALL, SCALE, H } from './constants.js';
import { drawJoseph, drawPitchfork } from './sprites.js';
import { isDown, justPressed } from './input.js';
import { sfx } from './audio.js';
import {
  createPlate,
  PLATE_COOLDOWN,
  THROW_POSE,
  PLATE_H,
  PLATE_W,
} from './projectiles.js';

export const STAND_H = 36 * SCALE; // 72px — mid-size (~half of prior 64×128 draw)
export const CROUCH_H = 14 * SCALE; // low enough to slip under a 1-tile platform gap
const YOUNG_SCALE = 0.72;
const STAND_SPEED = 1.55 * SCALE;
const CROUCH_SPEED = 0.55 * SCALE;
const JUMP_V = -6.2 * SCALE;

export function createPlayer(spawnX, spawnY, opts = {}) {
  const young = !!opts.young;
  const bodyScale = young ? YOUNG_SCALE : 1;
  const standH = Math.round(STAND_H * bodyScale);
  const crouchH = Math.round(CROUCH_H * bodyScale);
  return {
    x: spawnX,
    y: spawnY,
    vx: 0,
    vy: 0,
    w: Math.round(18 * SCALE * bodyScale),
    h: standH,
    standH,
    crouchH,
    bodyScale,
    young,
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
    walking: false,
    lookingUp: false,
    prayT: 0,
    wasOnGround: true,
    plates: [],
    canThrow: !!opts.canThrow,
    forkHits: new Set(),
  };
}

export function playerHitbox(p) {
  if (p.crouching) {
    return { x: p.x + 2 * SCALE, y: p.y + 2 * SCALE, w: p.w - 4 * SCALE, h: p.h - 2 * SCALE };
  }
  return { x: p.x + 2 * SCALE, y: p.y + 2 * SCALE, w: p.w - 4 * SCALE, h: p.h - 2 * SCALE };
}

const FORK_POSE = 14;
const FORK_COOLDOWN = 22;

export function playerAttackBox(p) {
  if (!p || p.canThrow || p.attackTimer <= 0) return null;
  const reach = 22 * SCALE;
  const boxW = 20 * SCALE;
  const boxH = 16 * SCALE;
  const x = p.facing > 0 ? p.x + p.w - 2 * SCALE : p.x - boxW + 2 * SCALE;
  const y = p.y + (p.crouching ? 1 : 8) * SCALE * (p.bodyScale || 1);
  return { x, y, w: boxW, h: boxH, reach };
}

function tryStand(p, solids) {
  if (!p.crouching) return;
  const standH = p.standH || STAND_H;
  const crouchH = p.crouchH || CROUCH_H;
  const rise = standH - crouchH;
  const probe = {
    x: p.x + 2 * SCALE,
    y: p.y - rise + 2 * SCALE,
    w: p.w - 4 * SCALE,
    h: standH - 2 * SCALE,
  };
  for (const s of solids) {
    if (aabb(probe, s)) return;
  }
  p.y -= rise;
  p.h = standH;
  p.crouching = false;
}

export function updatePlayer(p, solids, dt) {
  if (!p.alive) return;

  const standH = p.standH || STAND_H;
  const crouchH = p.crouchH || CROUCH_H;
  const wantCrouch = isDown('down') && p.onGround;

  if (wantCrouch && !p.crouching) {
    const drop = standH - crouchH;
    p.y += drop;
    p.h = crouchH;
    p.crouching = true;
  } else if (!wantCrouch && p.crouching) {
    tryStand(p, solids);
  }

  if (!p.onGround && p.crouching) {
    p.y -= standH - crouchH;
    p.h = standH;
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
    if (Math.abs(p.vx) < 0.05 * SCALE) p.vx = 0;
  }

  if (justPressed('jump') && p.onGround && !p.crouching) {
    p.vy = JUMP_V;
    p.onGround = false;
    sfx('jump');
  }
  p.lookingUp = isDown('up') && p.onGround && !p.crouching && !isDown('left') && !isDown('right');

  if (p.attackCooldown > 0) p.attackCooldown -= dt;
  if (p.attackTimer > 0) p.attackTimer -= dt;

  if (justPressed('attack') && p.attackCooldown <= 0) {
    if (p.canThrow) {
      p.attackTimer = THROW_POSE;
      p.attackCooldown = PLATE_COOLDOWN;
      sfx('throw');
      const px = p.facing > 0 ? p.x + p.w - 2 * SCALE : p.x - PLATE_W;
      const chest = (p.crouching ? 10 : 18) * SCALE * (p.bodyScale || 1);
      const py = p.y + chest - Math.floor(PLATE_H / 2);
      p.plates.push(createPlate(px, py, p.facing));
    } else {
      p.attackTimer = FORK_POSE;
      p.attackCooldown = FORK_COOLDOWN;
      p.forkHits = new Set();
      sfx('swing');
    }
  }

  p.vy += GRAVITY;
  if (p.vy > MAX_FALL) p.vy = MAX_FALL;

  p.x += p.vx;
  if (p.x < 8) {
    p.x = 8;
    if (p.vx < 0) p.vx = 0;
  }
  resolve(p, solids, true);

  p.y += p.vy;
  p.onGround = false;
  resolve(p, solids, false);
  if (p.onGround && !p.wasOnGround) sfx('land');
  p.wasOnGround = p.onGround;


  // Kneel / pray in place to regenerate hearts
  if (p.crouching && p.onGround && Math.abs(p.vx) < 0.12 * SCALE && p.hp < p.maxHp) {
    p.prayT += dt;
    if (p.prayT > 90) {
      p.prayT = 0;
      p.hp = Math.min(p.maxHp, p.hp + 1);
      sfx('heal');
    }
  } else if (!(p.crouching && p.onGround && Math.abs(p.vx) < 0.12 * SCALE)) {
    p.prayT = 0;
  } else {
    // Praying at full HP — still accumulate prayT for faith meter / cloud
    p.prayT += dt;
  }

  if (p.invuln > 0) p.invuln -= dt;

  const holdingDir = (isDown('left') || isDown('right')) && !p.crouching;
  p.walking = holdingDir;
  if (p.walking) {
    p.animT += dt;
    if (p.animT > 6) {
      p.animT = 0;
      p.anim = (p.anim + 1) % 4;
    }
  }

  if (p.y > H + 80 * SCALE) {
    p.hp = 0;
    p.alive = false;
  }
}

function resolve(p, solids, horizontal) {
  const box = playerHitbox(p);
  for (const s of solids) {
    if (s.kind === 'plat') {
      if (horizontal) {
        const head = p.y + 2 * SCALE;
        if (p.crouching || head >= s.y + s.h - 1) continue;
      } else if (p.vy < 0) {
        continue;
      }
    }
    if (horizontal) {
      // Floor underfoot is not a wall
      if (Math.abs(p.y + p.h - s.y) <= 4) continue;
      if (!aabb(box, s)) continue;
      if (p.vx > 0) p.x = s.x - (p.w - 2 * SCALE);
      else if (p.vx < 0) p.x = s.x + s.w - 2 * SCALE;
      p.vx = 0;
      box.x = p.x + 2 * SCALE;
    } else {
      const overlapX = box.x < s.x + s.w && box.x + box.w > s.x;
      if (!overlapX) continue;
      const feet = p.y + p.h;
      const slop = Math.max(8, p.vy + 2);
      if (p.vy >= 0 && feet >= s.y && feet <= s.y + slop && p.y < s.y) {
        p.y = s.y - p.h;
        p.vy = 0;
        p.onGround = true;
      } else if (p.vy < 0 && s.kind !== 'plat' && aabb(box, s)) {
        p.y = s.y + s.h - 2 * SCALE;
        p.vy = 0;
      }
      box.y = p.y + 2 * SCALE;
      box.h = p.h - 2 * SCALE;
    }
  }
}

export function hurtPlayer(p, dmg = 1) {
  if (p.invuln > 0 || !p.alive) return false;
  p.hp -= dmg;
  p.invuln = 60;
  sfx('hurt');
  p.vy = -3 * SCALE;
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
  }
  return true;
}

export function drawPlayer(ctx, p, camX) {
  if (!p.alive) return;
  if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) return;
  const standH = p.standH || STAND_H;
  const crouchH = p.crouchH || CROUCH_H;
  const drawY = p.crouching ? p.y - (standH - crouchH) : p.y;
  const moving = Math.abs(p.vx) > 0.12 * SCALE || !!p.walking;
  const walkFrame = Math.floor(Math.abs(p.x) / (6 * SCALE)) % 4;
  drawJoseph(
    ctx,
    p.x - camX,
    drawY,
    p.facing,
    moving ? walkFrame : p.anim,
    p.attackTimer > 0,
    !p.onGround && p.vy < -1.2 * SCALE,
    p.crouching,
    moving,
    !!p.lookingUp,
    !!p.young
  );
  if (!p.canThrow) {
    drawPitchfork(ctx, p.x - camX, drawY, p.facing, p.attackTimer > 0, !!p.young, !!p.crouching);
  }
}

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export { aabb };
