import { landOnSlopes } from './hill.js?v=75';
import { GRAVITY, MAX_FALL, FRICTION, SCALE, H, W } from './constants.js?v=75';
import {
  drawBrigand,
  drawBoss,
  drawScout,
  drawThug,
  drawWisp,
} from './sprites.js?v=75';
import { aabb } from './player.js?v=75';
import { createKnife, KNIFE_W } from './projectiles.js?v=75';
import { createHazard, groundTopBelow, drawAlert } from './hazards.js?v=75';
import { sfx } from './audio.js?v=75';
import { isEasy, reduceFlash } from './save.js?v=75';
import {
  drawSnake,
  drawBobcat,
  drawBear,
  drawBird,
  drawTorchProp,
  drawClubProp,
  drawMusketProp,
} from './critters.js?v=75';
import { drawEnemyRig } from './rig-cast.js?v=75';
import { drawAnimalRig } from './rig-animals.js?v=75';

/**
 * Wildlife of 1820s western New York (chapters 1–3). Sizes are hitbox sizes in art px;
 * `draw` scales the painting so a bobcat reads smaller than a man and a bear bigger than a bobcat.
 */
const CRITTERS = {
  snake: { hp: 1, speed: 0.3, w: 40, h: 14, score: 120, draw: 1 },
  bobcat: { hp: 1, speed: 0.8, w: 32, h: 24, score: 150, draw: 0.8 },
  bear: { hp: 3, speed: 0.42, w: 46, h: 36, score: 250, draw: 0.85 },
  crow: { hp: 1, speed: 0.7, w: 24, h: 16, score: 100, draw: 1, fly: true },
  owl: { hp: 1, speed: 0.55, w: 26, h: 20, score: 120, draw: 1, fly: true },
};
export const CRITTER_TYPES = Object.keys(CRITTERS);

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
    hitCd: 0, // per-foe cooldown after it lands a hit on Joseph
    melee: 'none', // none → wind (telegraph) → lunge (only this phase hurts)
    meleeT: 0,
    aiPhase: 0,
    aiTimer: 0,
    bossKind: opts.bossKind || 'ringleader',
    title: opts.title || '',
    knives: [],
    immuneToPlates: false,
    noGravity: false,
  };

  const cr = CRITTERS[type];
  if (cr) {
    base.critter = true;
    base.hp = base.maxHp = cr.hp;
    base.speed = cr.speed * SCALE;
    base.w = cr.w * SCALE;
    base.h = cr.h * SCALE;
    base.score = cr.score;
    base.drawScale = cr.draw;
    base.fly = !!cr.fly;
    base.noGravity = !!cr.fly;
    base.noThrow = true;
  }
  // Human mob variants: same painted men, with a period prop and their own habits
  base.variant = opts.variant || '';
  if (base.variant === 'torch') {
    base.torch = true; // also a light source in the night chapters
    base.noThrow = true;
  } else if (base.variant === 'club') {
    base.noThrow = true;
    base.hp = base.maxHp = 3;
  } else if (base.variant === 'musket') {
    base.noThrow = true; // a guard who shoves; the musket is never fired
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
      base.damage = 1;
      base.score = 1400;
    } else if (kind === 'warden') {
      base.hp = base.maxHp = 16;
      base.speed = 0.8 * SCALE;
      base.damage = 1;
      base.score = 1600;
    } else if (kind === 'overseer') {
      base.hp = base.maxHp = 20;
      base.speed = 0.85 * SCALE;
      base.damage = 1;
      base.score = 2500;
    }
  }
  return base;
}

export function enemyHitbox(e) {
  if (e.type === 'boss') {
    return { x: e.x + 4 * SCALE, y: e.y + 4 * SCALE, w: e.w - 8 * SCALE, h: e.h - 4 * SCALE };
  }
  if (e.critter) {
    const b = { x: e.x + 2 * SCALE, y: e.y + 2 * SCALE, w: e.w - 4 * SCALE, h: e.h - 2 * SCALE };
    if (e.type === 'snake' && e.melee === 'lunge') {
      // the strike reaches past the coiled body
      b.w += 18 * SCALE;
      if (e.facing < 0) b.x -= 18 * SCALE;
      b.y -= 10 * SCALE;
      b.h += 10 * SCALE;
    }
    return b;
  }
  if (e.type === 'wisp') {
    return { x: e.x + 2 * SCALE, y: e.y + 2 * SCALE, w: e.w - 4 * SCALE, h: e.h - 4 * SCALE };
  }
  return { x: e.x + 2 * SCALE, y: e.y + 2 * SCALE, w: e.w - 4 * SCALE, h: e.h - 2 * SCALE };
}

// Melee timing (frames @ 60fps; Easy runs foes at 75% so everything is slower there)
export const MELEE_WIND = 18; // ≈0.3 s readable wind-up before a lunge
const MELEE_LUNGE = 14;
const MELEE_RECOVER = 36; // pause after a lunge, hit or miss
export const FOE_HIT_CD = 90; // the same foe can't hurt Joseph again for 1.5 s

/**
 * Close-range attack for walking foes: stop and wind up (lean back + gold "!"),
 * then lunge. Contact only hurts during the lunge (see `foeCanHurt`), so brushing
 * past an idle foe is safe and every melee hit is telegraphed.
 * Returns true while the melee routine owns the foe's movement.
 */
const MELEE_DEF = {
  default: { reach: 18, wind: MELEE_WIND, lunge: MELEE_LUNGE, recover: MELEE_RECOVER },
  // timber rattlesnake: coils and rattles a long time, strikes a short way, never chases
  snake: { reach: 20, wind: 34, lunge: 12, recover: 56, sp: 0.5, sound: 'rattle' },
  // bobcat: crouches, then pounces in an arc
  bobcat: { reach: 52, wind: 24, lunge: 40, recover: 44, sp: 3.0, hop: 3.4 },
  // black bear: rears and huffs, then a short bluff charge
  bear: { reach: 26, wind: 36, lunge: 26, recover: 64, sp: 2.7, sound: 'huff' },
  club: { reach: 20, wind: 24, lunge: 14, recover: 40 },
};
function meleeDef(e) {
  return MELEE_DEF[e.type] || MELEE_DEF[e.variant] || MELEE_DEF.default;
}
function lungeSpeed(e, d) {
  return d.sp != null ? d.sp * SCALE : Math.max(e.speed * 3, 2.2 * SCALE);
}

function updateMelee(e, player, dt) {
  const ex = e.x + e.w / 2;
  const px = player.x + player.w / 2;
  const d = meleeDef(e);
  if (e.melee === 'wind') {
    e.vx = 0;
    e.facing = px > ex ? 1 : -1;
    e.meleeT -= dt;
    if (e.meleeT <= 0) {
      e.melee = 'lunge';
      e.meleeT = d.lunge;
      e.vx = e.facing * lungeSpeed(e, d);
      if (d.hop) {
        e.vy = -d.hop * SCALE;
        e.onGround = false;
      }
    }
    return true;
  }
  if (e.melee === 'lunge') {
    e.meleeT -= dt;
    e.vx = e.facing * lungeSpeed(e, d);
    const landed = d.hop && e.onGround && e.meleeT < d.lunge - 6;
    if (e.meleeT <= 0 || landed) {
      e.melee = 'recover';
      e.meleeT = d.recover;
      if (d.hop) e.vx = 0;
    }
    return true;
  }
  if (e.melee === 'recover') {
    e.meleeT -= dt;
    e.vx = -e.facing * e.speed * 0.6; // step back
    if (e.meleeT <= 0) e.melee = 'none';
    return true;
  }
  if (e.hitCd > 0) {
    // just landed a hit: back off and keep distance until the cooldown ends
    e.facing = px > ex ? 1 : -1;
    e.vx = e.hitCd > FOE_HIT_CD - 40 ? -e.facing * e.speed : 0;
    return true;
  }
  const reach = e.w / 2 + player.w / 2 + d.reach * SCALE;
  const level = Math.abs(player.y + player.h - (e.y + e.h)) < 30 * SCALE;
  if (player.alive && e.damage > 0 && level && Math.abs(px - ex) < reach && e.onGround) {
    e.melee = 'wind';
    e.meleeT = d.wind;
    e.meleeWind = d.wind;
    if (d.sound) sfx(d.sound);
    e.vx = 0;
    e.facing = px > ex ? 1 : -1;
    return true;
  }
  return false;
}

/** Can this foe hurt Joseph by touch right now? */
export function foeCanHurt(e) {
  if (!e.alive || !(e.damage > 0) || e.hitCd > 0) return false;
  if (e.type === 'boss' || e.type === 'wisp') return true; // bosses telegraph their own attacks
  return e.melee === 'lunge';
}

/** Called when a foe's touch landed: start its personal cooldown. */
export function foeLandedHit(e) {
  e.hitCd = FOE_HIT_CD;
  e.melee = 'none';
  e.meleeT = 0;
}

export function updateEnemy(e, solids, player, dt, world = null) {
  if (!e.alive) return;
  // Easy: everything about foes runs at 75% (movement, timers, tells)
  const pace = isEasy() ? 0.75 : 1;
  dt *= pace;

  if (e.hurtFlash > 0) e.hurtFlash -= dt;
  if (e.attackCd > 0) e.attackCd -= dt;
  if (e.hitCd > 0) e.hitCd -= dt;

  e.clock = (e.clock || 0) + dt;
  if (e.type === 'boss') {
    updateBossAI(e, player, dt, world || {});
  } else if (e.fly) {
    updateBirdAI(e, player, dt, world || {});
  } else if (e.type === 'wisp') {
    updateWispAI(e, player, dt);
  } else if (updateMelee(e, player, dt)) {
    // winding up / lunging / backing off after a hit
  } else {
    const dx = player.x - e.x;
    const near = Math.abs(dx) < 100 * SCALE && Math.abs(player.y - e.y) < 48 * SCALE;
    const chaseMul = e.type === 'bobcat' ? 1.3 : e.type === 'scout' ? 1.25 : e.type === 'bear' ? 1.15 : 1.1;
    // snakes keep to their patch of ground and only strike when stepped near
    if (near && player.alive && e.type !== 'snake') {
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

  if (e.fly) {
    // birds fly over everything; no tile collision
    e.x += e.vx * pace;
    e.y += e.vy * pace;
    if (!e.telling) e.animT += dt;
    if (e.animT > 7) {
      e.animT = 0;
      e.anim = (e.anim + 1) % 8;
    }
    return;
  }
  e.x += e.vx * pace;
  if (!e.noGravity) resolveEnemy(e, solids, true);
  e.y += e.vy;
  const wasOn = e.onGround;
  e.onGround = false;
  if (!e.noGravity) resolveEnemy(e, solids, false);
  if (!e.noGravity && solids.slopes) landOnSlopes(e, solids.slopes, wasOn);


  // Humanoids / bosses throw knives when Joseph is in sight (not wisp/npc)
  const canThrow = !e.noThrow && e.type !== 'wisp' && e.type !== 'npc' && e.type !== 'boss';
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

  if (!e.telling) e.animT += dt;
  if (e.animT > 7) {
    e.animT = 0;
    e.anim = (e.anim + 1) % 8;
  }

  if (e.y > H + 80 * SCALE && !e.noGravity) {
    e.alive = false;
  }
}

/**
 * Crow (day) / great horned owl (night): patrol the air above a stretch of ground, hover with
 * fast wingbeats as a tell, then swoop at where Joseph stood and climb back. Only the swoop hurts.
 */
function updateBirdAI(e, player, dt, world) {
  e.aiTimer += dt;
  if (e.homeY === undefined) {
    const top = world.solids ? groundTopBelow(world.solids, e.x + e.w / 2, e.y - 200 * SCALE, true) : null;
    e.homeY = (top ?? 13 * 32) - 62 * SCALE;
  }
  const ex = e.x + e.w / 2;
  const ey = e.y + e.h / 2;
  const px = player.x + player.w / 2;
  const py = player.y + player.h * 0.4;
  if (e.melee === 'wind') {
    e.vx *= 0.85;
    e.vy = Math.sin(e.aiTimer * 0.5) * 0.3 * SCALE;
    e.facing = px > ex ? 1 : -1;
    e.meleeT -= dt;
    if (e.meleeT <= 0) {
      e.melee = 'lunge';
      e.meleeT = 48;
      const dd = Math.hypot(px - ex, py - ey) || 1;
      const sp = 3 * SCALE;
      e.vx = ((px - ex) / dd) * sp;
      e.vy = Math.max(0.6 * SCALE, ((py - ey) / dd) * sp);
      e.facing = e.vx > 0 ? 1 : -1;
      sfx(e.type === 'owl' ? 'hoot' : 'caw');
    }
    return;
  }
  if (e.melee === 'lunge') {
    e.meleeT -= dt;
    if (e.meleeT <= 0 || e.y + e.h > player.y + player.h + 4 * SCALE) {
      e.melee = 'recover';
      e.meleeT = 70;
    }
    return;
  }
  if (e.melee === 'recover') {
    e.meleeT -= dt;
    e.vy = -1.3 * SCALE;
    e.vx = e.facing * e.speed * 1.2;
    if (e.y <= e.homeY || e.meleeT <= 0) {
      e.melee = 'none';
      e.attackCd = 90;
    }
    return;
  }
  // patrol back and forth, easing back to cruising height
  if (e.x < e.patrolMin) e.facing = 1;
  if (e.x > e.patrolMax) e.facing = -1;
  e.vx = e.facing * e.speed;
  e.vy = (e.homeY + Math.sin(e.aiTimer * 0.05) * 6 * SCALE - e.y) * 0.05;
  const dx = px - ex;
  if (
    player.alive &&
    e.attackCd <= 0 &&
    e.hitCd <= 0 &&
    Math.abs(dx) < 110 * SCALE &&
    Math.abs(dx) > 24 * SCALE &&
    py > ey &&
    Math.abs(e.y - e.homeY) < 12 * SCALE
  ) {
    e.melee = 'wind';
    e.meleeT = 26;
    e.meleeWind = 26;
  }
}

/** After defeat a foe is driven off: wildlife bolts away, people stagger (dazed) then leave. */
export function tickDefeat(e, dt, player) {
  if (e.type === 'boss' || e.defeatDone) return;
  if (e.defeatT === undefined) {
    e.defeatT = 0;
    const pcx = player ? player.x + player.w / 2 : e.x;
    e.fleeDir = pcx > e.x + e.w / 2 ? -1 : 1;
    if (e.critter) e.facing = e.fleeDir;
    e.melee = 'none';
  }
  e.defeatT += dt;
  e.clock = (e.clock || 0) + dt;
  const T = e.critter ? 50 : 64;
  if (e.critter) {
    e.x += e.fleeDir * 3.2 * SCALE * dt;
    if (e.fly) e.y -= 1.6 * SCALE * dt;
  } else if (e.defeatT > 30) {
    e.facing = e.fleeDir;
    e.x += e.fleeDir * 1.8 * SCALE * dt;
  }
  e.animT += dt;
  if (e.animT > 5) {
    e.animT = 0;
    e.anim = (e.anim + 1) % 8;
  }
  if (e.defeatT >= T) e.defeatDone = true;
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

// ── Bosses: walk → tell (wind-up) → attack → recover, phase change at half health ──
const BOSS_DEF = {
  captain: {
    p1: ['charge', 'torches'],
    p2: ['charge2', 'torches', 'charge'],
    tell: [44, 30],
    walk: [80, 54],
  },
  warden: {
    p1: ['slam', 'keys'],
    p2: ['slam2', 'keys2', 'slam'],
    tell: [46, 32],
    walk: [80, 54],
  },
  overseer: {
    p1: ['fan', 'summon', 'fan'],
    p2: ['dash', 'fan5', 'summon', 'fan5'],
    tell: [42, 30],
    walk: [74, 50],
  },
};
BOSS_DEF.ringleader = BOSS_DEF.overseer;
BOSS_DEF.sentinel = BOSS_DEF.warden;

function bossState(e) {
  if (!e.bs) e.bs = { mode: 'walk', t: 0, phase: 1, idx: 0, attack: null, sub: 0, tellT: 40, clock: 0, did: 0 };
  return e.bs;
}

function floorUnder(e, world) {
  const top = world.solids ? groundTopBelow(world.solids, e.x + e.w / 2, e.y, true) : null;
  return top ?? e.y + e.h;
}

function beginTell(e, def) {
  const bs = e.bs;
  const list = bs.phase === 2 ? def.p2 : def.p1;
  bs.attack = list[bs.idx % list.length];
  bs.idx++;
  bs.mode = 'tell';
  bs.t = 0;
  bs.tellT = def.tell[bs.phase - 1] * (isEasy() ? 1.25 : 1);
  sfx('tell');
}

function checkPhase(e, world) {
  const bs = e.bs;
  if (bs.phase === 1 && e.hp <= e.maxHp / 2) {
    bs.phase = 2;
    bs.mode = 'roar';
    bs.t = 0;
    bs.idx = 0;
    e.invuln = true;
    e.ghost = false;
    e.vx = 0;
    sfx('roar');
    world.onPhase?.(e);
    return true;
  }
  return false;
}

function endAttack(e) {
  e.bs.mode = 'recover';
  e.bs.t = 0;
  e.bs.sub = 0;
  e.ghost = false;
}

function updateBossAI(e, player, dt, world) {
  const bs = bossState(e);
  bs.t += dt;
  bs.clock += dt;
  e.aiTimer += dt;
  const def = BOSS_DEF[e.bossKind] || BOSS_DEF.overseer;
  const p2 = bs.phase === 2;
  const spd = e.speed * (p2 ? 1.35 : 1);
  const dx = player.x + player.w / 2 - (e.x + e.w / 2);
  const face = () => { e.facing = dx > 0 ? 1 : -1; };
  checkPhase(e, world);
  e.telling = bs.mode === 'tell' || bs.mode === 'roar' || (bs.mode === 'attack' && bs.mini > 0);

  switch (bs.mode) {
    case 'roar':
      e.vx *= FRICTION;
      face();
      if (bs.t > 60) {
        e.invuln = false;
        bs.mode = 'walk';
        bs.t = 0;
      }
      break;
    case 'walk': {
      face();
      const far = Math.abs(dx) > 90 * SCALE;
      const close = Math.abs(dx) < 36 * SCALE;
      e.vx = far ? e.facing * spd : close ? -e.facing * spd * 0.6 : e.facing * spd * 0.35;
      if (bs.t > def.walk[bs.phase - 1] && player.alive && world.active !== false) beginTell(e, def);
      break;
    }
    case 'tell':
      e.vx *= FRICTION;
      face();
      if (bs.t > bs.tellT) {
        bs.mode = 'attack';
        bs.t = 0;
        bs.sub = 0;
        bs.mini = 0;
        bs.landed = false;
      }
      break;
    case 'attack':
      runBossAttack(e, player, dt, world, dx, face, p2);
      break;
    default:
      e.vx *= FRICTION;
      if (bs.t > (p2 ? 26 : 40)) {
        bs.mode = 'walk';
        bs.t = 0;
      }
      break;
  }
  if (e.x < e.patrolMin) { e.x = e.patrolMin; if (e.vx < 0) e.vx = 0; }
  if (e.x > e.patrolMax) { e.x = e.patrolMax; if (e.vx > 0) e.vx = 0; }
}

function runBossAttack(e, player, dt, world, dx, face, p2) {
  const bs = e.bs;
  const a = bs.attack;
  const floorY = floorUnder(e, world);
  // Short re-tell between repeated moves (e.g. second charge / second slam)
  if (bs.mini > 0) {
    bs.mini -= dt;
    e.vx *= FRICTION;
    face();
    if (bs.mini <= 0) {
      bs.t = 0;
      bs.landed = false;
    }
    return;
  }
  if (a === 'charge' || a === 'charge2') {
    if (bs.t <= dt) {
      face();
      sfx('dash');
    }
    e.vx = e.facing * (p2 ? 6 : 5.2) * SCALE;
    const atEdge = (e.facing > 0 && e.x >= e.patrolMax - 2) || (e.facing < 0 && e.x <= e.patrolMin + 2);
    if (bs.t > 60 || atEdge) {
      e.vx = 0;
      bs.sub++;
      if (a === 'charge2' && bs.sub < 2) {
        bs.mini = 22;
        sfx('tell');
      } else endAttack(e);
    }
  } else if (a === 'torches') {
    if (bs.sub === 0) {
      face();
      const n = p2 ? 3 : 2;
      const px = player.x + player.w / 2;
      for (let i = 0; i < n; i++) {
        const target = px + (i - (n - 1) / 2) * 44 * SCALE;
        const vy0 = -6 * SCALE;
        const T = (2 * Math.abs(vy0)) / (0.8 * 0.35 * SCALE) + 8;
        const sx = e.x + e.w / 2;
        world.hazards?.push(createHazard('torch', sx, e.y + 10 * SCALE, { vx: (target - sx) / T, vy: vy0 - i * 0.3 * SCALE }));
      }
      sfx('throw');
      bs.sub = 1;
    }
    if (bs.t > 34) endAttack(e);
  } else if (a === 'slam' || a === 'slam2') {
    if (bs.t <= dt) {
      face();
      e.vy = -6.6 * SCALE;
      e.vx = Math.max(-3.2 * SCALE, Math.min(3.2 * SCALE, dx / 48));
      bs.landed = false;
      sfx('jump');
    }
    if (!bs.landed && bs.t > 10 && e.onGround) {
      bs.landed = true;
      e.vx = 0;
      const cx = e.x + e.w / 2;
      const sp = (p2 ? 3.6 : 3) * SCALE;
      world.hazards?.push(createHazard('shock', cx - 20 * SCALE, floorY - 14 * SCALE, { vx: -sp }));
      world.hazards?.push(createHazard('shock', cx + 2 * SCALE, floorY - 14 * SCALE, { vx: sp }));
      world.onSlam?.(e);
      sfx('slam');
      bs.sub++;
    }
    if (bs.landed && bs.t > 30) {
      if (a === 'slam2' && bs.sub < 2) {
        bs.mini = 20;
        sfx('tell');
      } else endAttack(e);
    }
  } else if (a === 'keys' || a === 'keys2') {
    const throwRing = (low) => {
      face();
      const y = low ? floorY - 14 * SCALE : e.y + e.h * 0.3;
      const x = e.facing > 0 ? e.x + e.w : e.x - 16 * SCALE;
      world.hazards?.push(createHazard('keys', x, y, { vx: e.facing * 5.2 * SCALE, owner: e }));
      sfx('throw');
    };
    if (bs.sub === 0) {
      throwRing(false);
      bs.sub = 1;
    }
    if (a === 'keys2' && bs.sub === 1 && bs.t > 34) {
      throwRing(true);
      bs.sub = 2;
    }
    e.vx *= FRICTION;
    if (bs.t > (a === 'keys2' ? 80 : 56)) endAttack(e);
  } else if (a === 'fan' || a === 'fan5') {
    if (bs.sub === 0) {
      face();
      const n = a === 'fan5' ? 5 : 3;
      const kx = e.facing > 0 ? e.x + e.w : e.x - 8 * SCALE;
      const ky = e.y + e.h * 0.38;
      for (let i = 0; i < n; i++) {
        const spread = (i - (n - 1) / 2) * 0.55 * SCALE;
        world.hazards?.push(createHazard('knife', kx, ky, { vx: e.facing * 3.2 * SCALE, vy: spread }));
      }
      sfx('throw');
      bs.sub = 1;
    }
    e.vx *= FRICTION;
    if (bs.t > 36) endAttack(e);
  } else if (a === 'summon') {
    if (bs.sub === 0) {
      const allies = (world.enemies || []).filter((x) => x.alive && x.summoned).length;
      const want = Math.max(0, 2 - allies);
      for (let i = 0; i < want; i++) {
        const side = i % 2 ? e.patrolMax : e.patrolMin;
        const ally = createEnemy(i % 2 ? 'thug' : 'brigand', side, e.y - 40 * SCALE, {
          patrolMin: e.patrolMin,
          patrolMax: e.patrolMax,
        });
        ally.summoned = true;
        ally.score = 50;
        ally.hp = ally.maxHp = 1;
        world.enemies?.push(ally);
      }
      sfx('whistle');
      bs.sub = 1;
    }
    e.vx *= FRICTION;
    if (bs.t > 40) endAttack(e);
  } else if (a === 'dash') {
    // Slip into the crowd and reappear on Joseph's other side
    e.vx = 0;
    if (bs.t < 22) {
      e.ghost = true;
      e.ghostA = 1 - bs.t / 22;
    } else if (bs.sub === 0) {
      const side = player.facing > 0 ? -1 : 1;
      e.x = Math.max(e.patrolMin, Math.min(e.patrolMax, player.x + side * 70 * SCALE));
      bs.sub = 1;
      sfx('dash');
    } else {
      e.ghostA = Math.min(1, (bs.t - 22) / 16);
      face();
      if (bs.t > 40) {
        e.ghost = false;
        endAttack(e);
      }
    }
  } else {
    endAttack(e);
  }
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
  if (e.invuln) return false;
  e.hp -= dmg;
  e.hurtFlash = 16;
  if (e.melee === 'wind' || e.melee === 'lunge') {
    // a hit during the wind-up staggers the foe (rewarding reading the tell)
    e.melee = 'recover';
    e.meleeT = e.fly ? 70 : meleeDef(e).recover;
  }
  if (!e.noGravity) e.vx = 0;
  if (e.hp <= 0) {
    e.hp = 0;
    e.alive = false;
    return true;
  }
  return false;
}

export function drawEnemy(ctx, e, camX) {
  // off-screen foes are not drawn (the painted rigs composite per frame; a wide margin
  // covers props, swipes and the boss tells)
  const sx = e.x - camX;
  if (sx + e.w + 160 * SCALE < 0 || sx - 160 * SCALE > W) return;
  let fade = 1;
  if (!e.alive) {
    if (e.type === 'boss' || e.defeatT === undefined || e.defeatDone) return;
    fade = Math.max(0, 1 - e.defeatT / (e.critter ? 50 : 64));
    if (fade <= 0) return;
  }
  ctx.save();
  if (fade < 1) ctx.globalAlpha = fade;
  drawEnemyBody(ctx, e, camX);
  if (!e.alive && !e.critter && e.defeatT < 40) drawDazed(ctx, e.x - camX + e.w / 2, e.y + 4 * SCALE, e.defeatT);
  ctx.restore();
}

function drawDazed(ctx, cx, cy, t) {
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const a = t * 0.18 + (i * Math.PI * 2) / 3;
    const x = cx + Math.cos(a) * 12;
    const y = cy - 6 + Math.sin(a) * 4;
    ctx.fillStyle = '#ffe9a0';
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const r = k % 2 ? 1.6 : 4;
      const aa = (k / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(x + Math.cos(aa) * r, y + Math.sin(aa) * r);
      const r2 = 1.6;
      const a2 = aa + Math.PI / 5;
      ctx.lineTo(x + Math.cos(a2) * r2, y + Math.sin(a2) * r2);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawCritter(ctx, e, dx, flash, k) {
  // default (not ?rig=0): painted wildlife rigs (falls back to the procedural drawing below)
  if (drawAnimalRig(ctx, e, dx, flash)) return;
  const sc = e.drawScale || 1;
  const t = e.clock || 0;
  const state = e.alive ? e.melee : 'none';
  const moving = Math.abs(e.vx) > 0.05 || !e.alive;
  ctx.save();
  const ax = dx + e.w / 2;
  const ay = e.fly ? e.y + e.h / 2 : e.y + e.h;
  ctx.translate(ax, ay);
  ctx.scale(sc, sc);
  ctx.translate(-ax, -ay);
  if (e.type === 'snake') drawSnake(ctx, dx, e.y, e.w, e.h, e.facing, t, state, k, flash);
  else if (e.type === 'bobcat') drawBobcat(ctx, dx, e.y, e.w, e.h, e.facing, t, state, k, flash, moving, !e.onGround && e.alive);
  else if (e.type === 'bear') drawBear(ctx, dx, e.y, e.w, e.h, e.facing, t, state, k, flash, moving);
  else drawBird(ctx, dx, e.y, e.w, e.h, e.facing, t, state, k, flash, e.type === 'owl');
  ctx.restore();
}

function drawEnemyBody(ctx, e, camX) {
  const flash = e.hurtFlash > 0;
  let dx = e.x - camX;
  const winding = e.alive && e.melee === 'wind';
  const windT = e.meleeWind || MELEE_WIND;
  const k = winding ? 1 - e.meleeT / windT : e.melee === 'lunge' ? 1 : 0;
  if (winding) {
    // telegraph: gold glow, lean back, "!" over the head

    ctx.save();
    ctx.globalAlpha = 0.25 + 0.3 * k;
    ctx.fillStyle = '#ffd060';
    ctx.beginPath();
    ctx.ellipse(dx + e.w / 2, e.y + e.h * 0.55, e.w * 0.75, e.h * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (!e.critter) dx -= e.facing * 3 * SCALE * k;
  }
  // default (not ?rig=0): painted cut-out rigs replace the sprite sheets (props ride in the hands)
  const rigged = e.type !== 'boss' && drawEnemyRig(ctx, e, dx, flash);
  if (rigged) { /* drawn */ }
  else if (e.critter) drawCritter(ctx, e, dx, flash, k);
  else if (e.type === 'brigand') drawBrigand(ctx, dx, e.y, e.facing, e.anim, flash);
  else if (e.type === 'scout') drawScout(ctx, dx, e.y, e.facing, e.anim, flash);
  else if (e.type === 'thug') drawThug(ctx, dx, e.y, e.facing, e.anim, flash);
  if (e.variant && !e.critter && !rigged) drawVariantProp(ctx, e, dx);
  if (e.type === 'wisp') drawWisp(ctx, dx, e.y, e.anim, flash);
  else if (e.type === 'boss') {
    drawBossAura(ctx, e, dx, tickNow(e));
    ctx.save();
    if (e.ghost) ctx.globalAlpha = Math.max(0.12, e.ghostA ?? 0.3);
    const late = e.telling && e.bs?.mode === 'tell' && e.bs.t > e.bs.tellT - 12;
    // Reduce flashing: the last beat of the tell is a steady highlight instead of a strobe
    const strobe = reduceFlash() ? late : late && Math.floor(e.bs.t / 3) % 2 === 0;
    if (!drawEnemyRig(ctx, e, dx, flash || strobe)) drawBoss(ctx, dx, e.y, e.facing, e.telling ? 0 : e.anim, flash || strobe, e.bossKind);
    ctx.restore();
    if (e.telling && e.bs?.mode === 'tell') drawAlert(ctx, dx + e.w / 2, e.y, e.bs.t);
  }
  if (winding) {
    const ay = e.critter ? e.y - (e.fly ? 6 : 14) * SCALE : e.y;
    drawAlert(ctx, dx + e.w / 2 + e.facing * 3 * SCALE, ay, windT - e.meleeT);
  }
}

/** Torch, club or shouldered musket held in the foe's forward hand. */
function drawVariantProp(ctx, e, dx) {
  const hx = dx + e.w / 2 + e.facing * 9 * SCALE;
  const hy = e.y + e.h * 0.52;
  if (e.variant === 'torch') drawTorchProp(ctx, hx, hy, e.facing, e.clock || 0);
  else if (e.variant === 'club') drawClubProp(ctx, hx, hy, e.facing, e.melee === 'wind');
  else if (e.variant === 'musket') drawMusketProp(ctx, dx + e.w / 2 - e.facing * 2 * SCALE, e.y + e.h * 0.42, e.facing);
}

function tickNow(e) {
  return e.bs ? e.bs.clock : 0;
}

/** Wind-up glow (gold) and phase-2 aura (red) drawn behind a boss. */
function drawBossAura(ctx, e, dx, t) {
  const bs = e.bs;
  if (!bs) return;
  const cx = dx + e.w / 2;
  const cy = e.y + e.h * 0.55;
  const rx = e.w * 0.9;
  const ry = e.h * 0.6;
  ctx.save();
  if (bs.phase === 2) {
    ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 0.2);
    ctx.fillStyle = '#e04020';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.1, ry * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (e.telling) {
    const k = bs.mode === 'roar' ? 1 : Math.min(1, bs.t / Math.max(1, bs.tellT || 40));
    ctx.globalAlpha = 0.25 + 0.35 * k * (0.6 + 0.4 * Math.sin(bs.t * 0.6));
    ctx.fillStyle = bs.mode === 'roar' ? '#ff6040' : '#ffd060';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * (0.9 + 0.2 * k), ry * (0.9 + 0.15 * k), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
