import { GRAVITY, MAX_FALL, FRICTION } from './constants.js';
import { drawBrigand, drawWolf, drawBoss, drawScout, drawThug } from './sprites.js';
import { aabb } from './player.js';

/**
 * Enemy factory.
 * types: brigand | wolf | scout | thug | boss
 * opts.bossKind: ringleader | sentinel | captain | warden | overseer
 */
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
    patrolMin: opts.patrolMin ?? x - 40,
    patrolMax: opts.patrolMax ?? x + 40,
    speed: 0.55,
    damage: 1,
    score: 100,
    w: 16,
    h: 32,
    onGround: false,
    attackCd: 0,
    aiPhase: 0,
    aiTimer: 0,
    bossKind: opts.bossKind || 'ringleader',
    title: opts.title || '',
  };

  if (type === 'wolf') {
    base.hp = base.maxHp = 1;
    base.speed = 0.9;
    base.h = 24;
    base.score = 150;
  }
  if (type === 'scout') {
    // Grove scout — quicker, lighter
    base.hp = base.maxHp = 2;
    base.speed = 0.75;
    base.score = 120;
  }
  if (type === 'thug') {
    // Village thug — tankier, slower
    base.hp = base.maxHp = 3;
    base.speed = 0.48;
    base.score = 140;
    base.damage = 1;
  }
  if (type === 'boss') {
    const kind = base.bossKind;
    base.w = 32;
    base.h = 48;
    base.patrolMin = opts.patrolMin ?? x - 80;
    base.patrolMax = opts.patrolMax ?? x + 80;
    if (kind === 'ringleader') {
      base.hp = base.maxHp = 12;
      base.speed = 0.7;
      base.damage = 2;
      base.score = 1000;
    } else if (kind === 'sentinel') {
      base.hp = base.maxHp = 14;
      base.speed = 0.72;
      base.damage = 2;
      base.score = 1200;
    } else if (kind === 'captain') {
      base.hp = base.maxHp = 15;
      base.speed = 0.78;
      base.damage = 2;
      base.score = 1400;
    } else if (kind === 'warden') {
      base.hp = base.maxHp = 16;
      base.speed = 0.8;
      base.damage = 2;
      base.score = 1600;
    } else if (kind === 'overseer') {
      // Final boss — hardest
      base.hp = base.maxHp = 20;
      base.speed = 0.85;
      base.damage = 2;
      base.score = 2500;
    }
  }
  return base;
}

export function enemyHitbox(e) {
  if (e.type === 'boss') return { x: e.x + 4, y: e.y + 4, w: e.w - 8, h: e.h - 4 };
  if (e.type === 'wolf') return { x: e.x + 2, y: e.y + 10, w: e.w - 2, h: 20 };
  return { x: e.x + 2, y: e.y + 2, w: e.w - 4, h: e.h - 2 };
}

export function updateEnemy(e, solids, player, dt) {
  if (!e.alive) return;

  if (e.hurtFlash > 0) e.hurtFlash -= dt;
  if (e.attackCd > 0) e.attackCd -= dt;

  if (e.type === 'boss') {
    updateBossAI(e, player, dt);
  } else {
    const dx = player.x - e.x;
    const near = Math.abs(dx) < 100 && Math.abs(player.y - e.y) < 48;
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

  e.vy += GRAVITY;
  if (e.vy > MAX_FALL) e.vy = MAX_FALL;

  e.x += e.vx;
  resolveEnemy(e, solids, true);
  e.y += e.vy;
  e.onGround = false;
  resolveEnemy(e, solids, false);

  e.animT += dt;
  if (e.animT > 10) {
    e.animT = 0;
    e.anim = (e.anim + 1) % 2;
  }

  if (e.y > 320) {
    e.alive = false;
  }
}

function updateBossAI(e, player, dt) {
  e.aiTimer += dt;
  const dx = player.x - e.x;

  const enraged = e.hp <= e.maxHp / 2;
  let spd = e.speed * (enraged ? 1.6 : 1);
  // Overseer enrages harder
  if (e.bossKind === 'overseer' && enraged) spd = e.speed * 1.85;

  const chaseT = e.bossKind === 'overseer' ? 70 : 90;
  const leapT = e.bossKind === 'warden' || e.bossKind === 'overseer' ? 45 : 50;
  const pauseT = e.bossKind === 'captain' ? 32 : 40;
  const leapVy = e.bossKind === 'sentinel' ? -5.8 : e.bossKind === 'overseer' ? -6.0 : -5.5;

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
      if (e.vx > 0) e.x = s.x - e.w + (e.type === 'boss' ? 4 : 2);
      else if (e.vx < 0) e.x = s.x + s.w - (e.type === 'boss' ? 4 : 2);
      e.vx = 0;
      e.facing *= -1;
      box.x = enemyHitbox(e).x;
    } else {
      if (e.vy > 0) {
        e.y = s.y - e.h;
        e.vy = 0;
        e.onGround = true;
      } else if (e.vy < 0) {
        e.y = s.y + s.h - 4;
        e.vy = 0;
      }
    }
  }
}

export function hurtEnemy(e, dmg = 1) {
  if (!e.alive) return false;
  e.hp -= dmg;
  e.hurtFlash = 10;
  e.vx = 0;
  if (e.hp <= 0) {
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
  else if (e.type === 'boss') drawBoss(ctx, dx, e.y, e.facing, e.anim, flash, e.bossKind);
}
