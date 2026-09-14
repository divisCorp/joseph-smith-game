import { GRAVITY, MAX_FALL, FRICTION, SCALE, H } from './constants.js';
import {
  drawBrigand,
  drawWolf,
  drawBoss,
  drawScout,
  drawThug,
  drawWisp,
  drawCloudBoss,
} from './sprites.js';
import { aabb } from './player.js';
import { createKnife, KNIFE_W } from './projectiles.js';

export function createEnemy(type, x, y, opts = {}) {
  const base = {
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    facing: -1,
    alive: true,
    hp: 2,
    maxHp: 2,
    anim: 0,
    animT: 0,
    hurtFlash: 0,
    patrolMin: opts.patrolMin ?? x - 40 * SCALE,
    patrolMax: opts.patrolMax ?? x + 40 * SCALE,
    speed: 0.55 * SCALE,
    damage: 1,
    score: 100,
    w: 28 * SCALE,
    h: 56 * SCALE,
    onGround: false,
    attackCd: 0,
    aiPhase: 0,
    aiTimer: 0,
    bossKind: opts.bossKind || 'ringleader',
    title: opts.title || '',
    knives: [],
    immuneToPlates: false,
    noGravity: false,
  };

  if (type === 'wolf') {
    base.hp = base.maxHp = 1;
    base.speed = 0.9 * SCALE;
    base.w = 42 * SCALE;
    base.h = 26 * SCALE;
    base.score = 150;
  }
  if (type === 'scout') {
    base.hp = base.maxHp = 2;
    base.speed = 0.75 * SCALE;
    base.score = 120;
  }
  if (type === 'thug') {
    base.hp = base.maxHp = 3;
    base.speed = 0.48 * SCALE;
    base.score = 140;
    base.damage = 1;
  }
  if (type === 'wisp') {
    base.hp = base.maxHp = 1;
    base.speed = 0.35 * SCALE;
    base.w = 14 * SCALE;
    base.h = 14 * SCALE;
    base.score = 80;
    base.damage = 1;
    base.noGravity = true;
  }
  if (type === 'cloud') {
    base.hp = base.maxHp = 100; // faith meter (drained by praying nearby)
    base.speed = 0.28 * SCALE;
    base.w = 64 * SCALE;
    base.h = 40 * SCALE;
    base.score = 2000;
    base.damage = 1;
    base.noGravity = true;
    base.immuneToPlates = true;
    base.patrolMin = opts.patrolMin ?? x - 60 * SCALE;
    base.patrolMax = opts.patrolMax ?? x + 60 * SCALE;
  }
  if (type === 'boss') {
    const kind = base.bossKind;
    base.w = 28 * SCALE;
    base.h = 56 * SCALE;
    base.patrolMin = opts.patrolMin ?? x - 80 * SCALE;
    base.patrolMax = opts.patrolMax ?? x + 80 * SCALE;
    if (kind === 'ringleader') {
      base.hp = base.maxHp = 12;
      base.speed = 0.7 * SCALE;
      base.damage = 2;
      base.score = 1000;
    } else if (kind === 'sentinel') {
      base.hp = base.maxHp = 14;
      base.speed = 0.72 * SCALE;
      base.damage = 2;
      base.score = 1200;
    } else if (kind === 'captain') {
      base.hp = base.maxHp = 15;
      base.speed = 0.78 * SCALE;
      base.damage = 2;
      base.score = 1400;
    } else if (kind === 'warden') {
      base.hp = base.maxHp = 16;
      base.speed = 0.8 * SCALE;
      base.damage = 2;
      base.score = 1600;
    } else if (kind === 'overseer') {
      base.hp = base.maxHp = 20;
      base.speed = 0.85 * SCALE;
      base.damage = 2;
      base.score = 2500;
    }
  }
  return base;
}

export function enemyHitbox(e) {
  if (e.type === 'boss') {
    return { x: e.x + 4 * SCALE, y: e.y + 4 * SCALE, w: e.w - 8 * SCALE, h: e.h - 4 * SCALE };
  }
  if (e.type === 'wolf') {
    return { x: e.x + 2 * SCALE, y: e.y + 4 * SCALE, w: e.w - 4 * SCALE, h: e.h - 4 * SCALE };
  }
  if (e.type === 'wisp') {
    return { x: e.x + 2 * SCALE, y: e.y + 2 * SCALE, w: e.w - 4 * SCALE, h: e.h - 4 * SCALE };
  }
  if (e.type === 'cloud') {
    return { x: e.x + 6 * SCALE, y: e.y + 4 * SCALE, w: e.w - 12 * SCALE, h: e.h - 8 * SCALE };
  }
  return { x: e.x + 2 * SCALE, y: e.y + 2 * SCALE, w: e.w - 4 * SCALE, h: e.h - 2 * SCALE };
}

export function updateEnemy(e, solids, player, dt) {
  if (!e.alive) return;

  if (e.hurtFlash > 0) e.hurtFlash -= dt;
  if (e.attackCd > 0) e.attackCd -= dt;

  if (e.type === 'boss') {
    updateBossAI(e, player, dt);
  } else if (e.type === 'cloud') {
    updateCloudAI(e, player, dt);
  } else if (e.type === 'wisp') {
    updateWispAI(e, player, dt);
  } else {
    const dx = player.x - e.x;
    const near = Math.abs(dx) < 100 * SCALE && Math.abs(player.y - e.y) < 48 * SCALE;
    const chaseMul = e.type === 'wolf' ? 1.3 : e.type === 'scout' ? 1.25 : 1.1;
    if (near && player.alive) {
      e.facing = dx > 0 ? 1 : -1;
      e.vx = e.facing * e.speed * chaseMul;
    } else {
      if (e.x < e.patrolMin) e.facing = 1;
      if (e.x > e.patrolMax) e.facing = -1;
      e.vx = e.facing * e.speed;
    }
  }

  if (!e.noGravity) {
    e.vy += GRAVITY;
    if (e.vy > MAX_FALL) e.vy = MAX_FALL;
  }

  e.x += e.vx;
  if (!e.noGravity) resolveEnemy(e, solids, true);
  e.y += e.vy;
  e.onGround = false;
  if (!e.noGravity) resolveEnemy(e, solids, false);


  // Humanoids / bosses throw knives when Joseph is in sight (not wisp/cloud/npc)
  const canThrow = e.type !== 'wolf' && e.type !== 'wisp' && e.type !== 'cloud' && e.type !== 'npc';
  if (canThrow && player.alive && e.attackCd <= 0) {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const range = e.type === 'boss' ? 170 * SCALE : 130 * SCALE;
    if (Math.abs(dx) < range && Math.abs(dy) < 50 * SCALE) {
      e.facing = dx > 0 ? 1 : -1;
      const kx = e.facing > 0 ? e.x + e.w - 2 : e.x - KNIFE_W;
      const ky = e.y + e.h * 0.35;
      const dmg = e.type === 'boss' ? 2 : 1;
      e.knives.push(createKnife(kx, ky, e.facing, dmg));
      e.attackCd = e.type === 'boss' ? 70 : e.type === 'scout' ? 75 : 100;
    }
  }

  // Cloud occasional dark bolts (reuse knives with dark tint via damage flag)
  if (e.type === 'cloud' && player.alive && e.attackCd <= 0) {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    if (Math.abs(dx) < 140 * SCALE && Math.abs(dy) < 80 * SCALE) {
      e.facing = dx > 0 ? 1 : -1;
      const kx = e.facing > 0 ? e.x + e.w - 4 : e.x - KNIFE_W;
      const ky = e.y + e.h * 0.55;
      const k = createKnife(kx, ky, e.facing, 1);
      k.dark = true;
      e.knives.push(k);
      e.attackCd = 95;
    }
  }

  e.animT += dt;
  if (e.animT > 7) {
    e.animT = 0;
    e.anim = (e.anim + 1) % 8;
  }

  if (e.y > H + 80 * SCALE && !e.noGravity) {
    e.alive = false;
  }
}

function updateWispAI(e, player, dt) {
  e.aiTimer += dt;
  const dx = player.x - e.x;
  const dy = (player.y + player.h * 0.3) - (e.y + e.h * 0.5);
  if (player.alive) {
    e.facing = dx > 0 ? 1 : -1;
    const dist = Math.hypot(dx, dy) || 1;
    e.vx = (dx / dist) * e.speed;
    e.vy = (dy / dist) * e.speed * 0.7 + Math.sin(e.aiTimer * 0.08) * 0.15 * SCALE;
  } else {
    e.vx = e.facing * e.speed * 0.5;
    e.vy = Math.sin(e.aiTimer * 0.1) * 0.2 * SCALE;
  }
  // Soft float band
  if (e.y < 4 * TILE_SAFE()) e.vy = Math.abs(e.vy);
  if (e.y > 12 * TILE_SAFE()) e.vy = -Math.abs(e.vy);
}

function TILE_SAFE() {
  return 16 * SCALE;
}

function updateCloudAI(e, player, dt) {
  e.aiTimer += dt;
  const dx = player.x - e.x;
  if (player.alive) {
    e.facing = dx > 0 ? 1 : -1;
    e.vx = Math.sign(dx) * e.speed;
  } else {
    e.vx = 0;
  }
  // Hover / drift vertically a bit
  const hoverY = 9 * TILE_SAFE();
  e.vy = (hoverY - e.y) * 0.02 + Math.sin(e.aiTimer * 0.05) * 0.2 * SCALE;
  if (e.x < e.patrolMin) { e.x = e.patrolMin; e.vx = Math.abs(e.vx); }
  if (e.x > e.patrolMax) { e.x = e.patrolMax; e.vx = -Math.abs(e.vx); }
}

function updateBossAI(e, player, dt) {
  e.aiTimer += dt;
  const dx = player.x - e.x;

  const enraged = e.hp <= e.maxHp / 2;
  let spd = e.speed * (enraged ? 1.6 : 1);
  if (e.bossKind === 'overseer' && enraged) spd = e.speed * 1.85;

  const chaseT = e.bossKind === 'overseer' ? 70 : 90;
  const leapT = e.bossKind === 'warden' || e.bossKind === 'overseer' ? 45 : 50;
  const pauseT = e.bossKind === 'captain' ? 32 : 40;
  const leapVy = (e.bossKind === 'sentinel' ? -5.8 : e.bossKind === 'overseer' ? -6.0 : -5.5) * SCALE;

  if (e.aiPhase === 0) {
    e.facing = dx > 0 ? 1 : -1;
    e.vx = e.facing * spd;
    if (e.aiTimer > chaseT) {
      e.aiTimer = 0;
      e.aiPhase = 1;
    }
  } else if (e.aiPhase === 1) {
    if (e.onGround && e.aiTimer < 5) {
      e.vy = leapVy;
      e.vx = e.facing * spd * 1.8;
    }
    e.facing = dx > 0 ? 1 : -1;
    if (e.aiTimer > leapT) {
      e.aiTimer = 0;
      e.aiPhase = 2;
    }
  } else {
    e.vx *= FRICTION;
    if (e.aiTimer > pauseT) {
      e.aiTimer = 0;
      e.aiPhase = 0;
    }
  }

  if (e.x < e.patrolMin) { e.x = e.patrolMin; e.facing = 1; }
  if (e.x > e.patrolMax) { e.x = e.patrolMax; e.facing = -1; }
}

function resolveEnemy(e, solids, horizontal) {
  const box = enemyHitbox(e);
  for (const s of solids) {
    if (!aabb(box, s)) continue;
    if (horizontal) {
      if (e.vx > 0) e.x = s.x - e.w + (e.type === 'boss' ? 4 * SCALE : 2 * SCALE);
      else if (e.vx < 0) e.x = s.x + s.w - (e.type === 'boss' ? 4 * SCALE : 2 * SCALE);
      e.vx = 0;
      e.facing *= -1;
      box.x = enemyHitbox(e).x;
    } else {
      if (e.vy > 0) {
        e.y = s.y - e.h;
        e.vy = 0;
        e.onGround = true;
      } else if (e.vy < 0) {
        e.y = s.y + s.h - 4 * SCALE;
        e.vy = 0;
      }
    }
  }
}

export function hurtEnemy(e, dmg = 1, opts = {}) {
  if (!e.alive) return false;
  if (e.immuneToPlates && !opts.faith) return false;
  e.hp -= dmg;
  e.hurtFlash = 10;
  if (!e.noGravity) e.vx = 0;
  if (e.hp <= 0) {
    e.hp = 0;
    e.alive = false;
    return true;
  }
  return false;
}

export function drawEnemy(ctx, e, camX) {
  if (!e.alive) return;
  const flash = e.hurtFlash > 0;
  const dx = e.x - camX;
  if (e.type === 'brigand') drawBrigand(ctx, dx, e.y, e.facing, e.anim, flash);
  else if (e.type === 'scout') drawScout(ctx, dx, e.y, e.facing, e.anim, flash);
  else if (e.type === 'thug') drawThug(ctx, dx, e.y, e.facing, e.anim, flash);
  else if (e.type === 'wolf') drawWolf(ctx, dx, e.y, e.facing, e.anim, flash);
  else if (e.type === 'wisp') drawWisp(ctx, dx, e.y, e.anim, flash);
  else if (e.type === 'cloud') drawCloudBoss(ctx, dx, e.y, e.anim, flash, e.hp / e.maxHp);
  else if (e.type === 'boss') drawBoss(ctx, dx, e.y, e.facing, e.anim, flash, e.bossKind);
}
