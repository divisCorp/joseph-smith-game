import { landOnSlopes } from './hill.js?v=74';
import { GRAVITY, FRICTION, MAX_FALL, SCALE, H, TILE } from './constants.js?v=74';
import { drawJoseph, drawPitchfork } from './sprites.js?v=74';
import { isDown, justPressed } from './input.js?v=74';
import { sfx } from './audio.js?v=74';
import { isEasy, reduceFlash } from './save.js?v=74';
import {
  createPlate,
  PLATE_COOLDOWN,
  THROW_POSE,
  PLATE_H,
  PLATE_W,
} from './projectiles.js?v=74';

export const STAND_H = 56 * SCALE; // 112px — matches JOSEPH_DH
export const CROUCH_H = 18 * SCALE;
const YOUNG_SCALE = 1;
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
    w: Math.round(28 * SCALE * bodyScale),
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
    kbT: 0,
    coyote: 0,
    jumpBuf: 0,
    jumpHeld: false,
    attackTimer: 0,
    attackCooldown: 0,
    alive: true,
    anim: 0,
    animT: 0,
    walking: false,
    lookingUp: false,
    prayT: 0,
    wasOnGround: true,
    jumpT: 99,
    landT: 0,
    landK: 0,
    dust: [],
    plates: [],
    canThrow: !!opts.canThrow,
    forkHits: new Set(),
  };
}

/** I-frames after a hit (frames @ 60fps ≈ 1.2 s). */
export const HURT_IFRAMES = 72;
const COYOTE = 6; // ≈100 ms: jump still allowed just after running off a ledge
const JUMP_BUFFER = 7; // ≈120 ms: a jump pressed just before landing still fires
const JUMP_CUT = 0.45; // releasing jump early caps upward speed → short hops

/**
 * Forgiving hurtbox for enemy / hazard / projectile hits: narrower than the sprite
 * (hair, coat tails and the pitchfork don't count) so near-misses feel fair.
 */
export function playerHurtbox(p) {
  const insetX = 6 * SCALE;
  const top = (p.crouching ? 2 : 7) * SCALE;
  return { x: p.x + insetX, y: p.y + top, w: p.w - insetX * 2, h: p.h - top - 2 * SCALE };
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

  // Responsive run: full speed in ~3 frames, quick stop on the ground, a little
  // drift in the air. During a knockback the hit decides the direction briefly.
  if (p.kbT > 0) {
    p.kbT -= dt;
    p.vx *= 0.9;
  } else {
    const dir = isDown('left') ? -1 : isDown('right') ? 1 : 0;
    const accel = speed * (p.onGround ? 0.4 : 0.22);
    if (dir) {
      p.facing = dir;
      const turning = Math.sign(p.vx) === -dir;
      p.vx += dir * accel * (turning && p.onGround ? 1.6 : 1);
      if (Math.abs(p.vx) > speed) p.vx = dir * speed;
    } else {
      p.vx *= p.onGround ? FRICTION * 0.8 : 0.9;
      if (Math.abs(p.vx) < 0.05 * SCALE) p.vx = 0;
    }
  }

  // Coyote time + jump buffer
  if (p.onGround) p.coyote = COYOTE;
  else if (p.coyote > 0) p.coyote -= dt;
  if (justPressed('jump')) p.jumpBuf = JUMP_BUFFER;
  else if (p.jumpBuf > 0) p.jumpBuf -= dt;
  if (p.jumpBuf > 0 && (p.onGround || p.coyote > 0) && !p.crouching && p.vy >= -0.5) {
    p.vy = JUMP_V;
    p.onGround = false;
    p.coyote = 0;
    p.jumpBuf = 0;
    p.jumpHeld = true;
    p.jumpT = 0;
    p.landT = 0;
    puff(p, 3, 0.6);
    sfx('jump');
  }
  // Variable height: let go early and the rise is cut short
  if (p.jumpHeld && !isDown('jump')) {
    p.jumpHeld = false;
    if (p.vy < JUMP_V * JUMP_CUT) p.vy = JUMP_V * JUMP_CUT;
  }
  if (p.vy >= 0) p.jumpHeld = false;
  if (p.jumpT < 99) p.jumpT += dt;
  p.lookingUp = isDown('up') && p.onGround && !p.crouching && !isDown('left') && !isDown('right');

  if (p.attackCooldown > 0) p.attackCooldown -= dt;
  if (p.attackTimer > 0) p.attackTimer -= dt;

  if (justPressed('attack') && p.attackCooldown <= 0 && !p.noAttack) {
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

  p.x += p.vx + (p.extVx || 0);
  if (p.x < 8) {
    p.x = 8;
    if (p.vx < 0) p.vx = 0;
  }
  resolve(p, solids, true);

  const vyBefore = p.vy;
  p.y += p.vy;
  p.onGround = false;
  resolve(p, solids, false);
  if (solids.slopes) landOnSlopes(p, solids.slopes, p.wasOnGround);
  if (p.onGround && !p.wasOnGround) {
    sfx('land');
    // landing squash + a small dust puff, scaled by how hard we came down
    p.landK = Math.max(0.35, Math.min(1, vyBefore / (7 * SCALE)));
    p.landT = LAND_T;
    p.jumpT = 99;
    if (vyBefore > 3) puff(p, p.landK > 0.6 ? 7 : 4, p.landK);
  }
  p.wasOnGround = p.onGround;
  if (p.landT > 0) p.landT = Math.max(0, p.landT - dt);
  for (const d of p.dust) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vx *= 0.9;
    d.vy *= 0.9;
    d.r += 0.25 * dt;
    d.life -= dt;
  }
  if (p.dust.length) p.dust = p.dust.filter((d) => d.life > 0);


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
    // Praying at full HP — keeps counting (used by the grove ending)
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
    // Game decides: respawn at last footing (costs a heart) or fall for good
    p.fellOut = true;
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
      const mv = p.vx + (p.extVx || 0);
      if (mv > 0) p.x = s.x - (p.w - 2 * SCALE);
      else if (mv < 0) p.x = s.x + s.w - 2 * SCALE;
      p.vx = 0;
      box.x = p.x + 2 * SCALE;
    } else {
      const overlapX = box.x < s.x + s.w && box.x + box.w > s.x;
      if (!overlapX) continue;
      const feet = p.y + p.h;
      const slop = Math.max(TILE, p.vy + 4);
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

/**
 * One hit = one heart (two for heavy boss blows on Normal), then HURT_IFRAMES of
 * invulnerability, so overlapping foes / hazards can never drain several hearts.
 * `fromX` (attacker centre) knocks Joseph a short way back from the attacker.
 */
export function hurtPlayer(p, dmg = 1, fromX = null) {
  if (p.invuln > 0 || !p.alive) return false;
  p.hp -= isEasy() ? Math.min(1, dmg) : dmg;
  p.invuln = HURT_IFRAMES;
  sfx('hurt');
  p.vy = -3 * SCALE;
  if (fromX != null) {
    const away = p.x + p.w / 2 < fromX ? -1 : 1;
    p.vx = away * 2.6 * SCALE;
    p.kbT = 12;
  }
  p.jumpHeld = false;
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
  }
  return true;
}

const LAND_T = 9;

function puff(p, n, k) {
  const fx = p.x + p.w / 2;
  const fy = p.y + p.h;
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    p.dust.push({
      x: fx + side * (4 + Math.random() * 8),
      y: fy - 2 - Math.random() * 3,
      vx: side * (0.8 + Math.random() * 1.6) * k * SCALE,
      vy: -(0.2 + Math.random() * 0.5) * SCALE,
      r: 3 + Math.random() * 3,
      life: 18 + Math.random() * 10,
      max: 28,
    });
  }
}

function drawDust(ctx, p, camX) {
  for (const d of p.dust) {
    const a = Math.max(0, Math.min(1, d.life / 20)) * 0.55;
    ctx.fillStyle = `rgba(214,196,160,${a})`;
    ctx.beginPath();
    ctx.arc(d.x - camX, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,244,220,${a * 0.6})`;
    ctx.beginPath();
    ctx.arc(d.x - camX - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Jump pose + squash/stretch: takeoff squash → rising stretch (frame 10) →
 * tucked apex (frame 12) → falling (frame 13) → landing squash.
 */
export function jumpPose(p) {
  let frame = null;
  let sx = 1;
  let sy = 1;
  let rot = 0;
  if (!p.onGround && !p.crouching && p.attackTimer <= 0) {
    const vy = p.vy;
    if (p.jumpT < 5 && vy < 0) {
      frame = 10;
      const k = 1 - p.jumpT / 5;
      sx = 1 + 0.1 * k;
      sy = 1 - 0.12 * k;
    } else if (vy < -3.2) {
      frame = 10;
      const k = Math.min(1, -vy / 10);
      sx = 1 - 0.06 * k;
      sy = 1 + 0.08 * k;
    } else if (vy < 2.6) {
      frame = 12;
      rot = 0.05 * p.facing;
    } else {
      frame = 13;
      const k = Math.min(1, vy / 12);
      sx = 1 - 0.04 * k;
      sy = 1 + 0.05 * k;
      rot = -0.04 * p.facing;
    }
  } else if (p.landT > 0 && !p.crouching) {
    const t = p.landT / LAND_T; // 1 → 0
    const k = Math.sin(t * Math.PI * 0.5) * p.landK;
    sx = 1 + 0.15 * k;
    sy = 1 - 0.15 * k;
  }
  return { frame, sx, sy, rot };
}

export function drawPlayer(ctx, p, camX) {
  if (!p.alive) return;
  if (p.dust?.length) drawDust(ctx, p, camX);
  const blinkOff = p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0;
  if (blinkOff && !reduceFlash()) return;
  ctx.save();
  if (p.invuln > 0 && reduceFlash()) ctx.globalAlpha = 0.6; // steady see-through instead of blinking
  drawPlayerBody(ctx, p, camX);
  ctx.restore();
}

function drawPlayerBody(ctx, p, camX) {
  const standH = p.standH || STAND_H;
  const crouchH = p.crouchH || CROUCH_H;
  const drawY = p.crouching ? p.y - (standH - crouchH) : p.y;
  const moving = (Math.abs(p.vx) > 0.12 * SCALE || !!p.walking) && p.onGround;
  const walkFrame = Math.floor(Math.abs(p.x) / (3 * SCALE)) % 8;
  const pose = jumpPose(p);
  const bx = p.x - camX;
  // calm moments (standing still, kneeling in prayer) gather a soft warm rim of light
  const calmNow = p.onGround && !moving && !(p.attackTimer > 0) && p.alive !== false;
  p.calmT = Math.max(0, Math.min(60, (p.calmT || 0) + (calmNow ? 1 : -4)));
  const rim = (p.calmT / 60) * (p.crouching ? 1 : 0.55);
  if (rim > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cx = bx + p.w / 2;
    const cy = drawY + standH * 0.5;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 70);
    g.addColorStop(0, `rgba(255,226,160,${(0.16 * rim).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,226,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 70, cy - 70, 140, 140);
    ctx.restore();
  }
  ctx.save();
  if (pose.sx !== 1 || pose.sy !== 1 || pose.rot) {
    // squash/stretch anchored at the feet so he never sinks into the ground
    const fx = bx + p.w / 2;
    const fy = drawY + standH;
    ctx.translate(fx, fy);
    if (pose.rot) ctx.rotate(pose.rot);
    ctx.scale(pose.sx, pose.sy);
    ctx.translate(-fx, -fy);
  }
  if (!p.canThrow && !p.forkAway) {
    drawPitchfork(ctx, bx, drawY, p.facing, p.attackTimer > 0, !!p.young, !!p.crouching);
  }
  drawJoseph(
    ctx,
    bx,
    drawY,
    p.facing,
    moving ? walkFrame : p.anim,
    p.attackTimer > 0,
    !p.onGround && p.vy < -1.2 * SCALE,
    p.crouching,
    moving,
    !!p.lookingUp,
    !!p.young,
    pose.frame,
    rim
  );
  ctx.restore();
}

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export { aabb };
