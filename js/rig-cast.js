/**
 * The rigged cast: which painted rig each character uses, its in-game size, its
 * actions, and the props it carries. Shared by the game (?rig=1) and rig-preview.html.
 *
 * Historical notes kept from the sprite game: the militia guard only carries his
 * musket at shoulder arms / shoves with it — it is never fired; the torch-bearer and
 * club ruffian carry period tools (pine torch, hickory club).
 */
import {
  loadCast, skelOf, basePose, poseIdle, poseWalk, WALK, strideLen, applyThrow, applyWind, applyStrike,
  applySpeak, applyGreet, applyHold, drawRig, solve, handPoint, partPoint,
} from './rig.js?v=73';
import { drawTorchProp, drawClubProp, drawMusketProp } from './critters.js?v=73';

const FOE_OLD = (row) => ({ src: 'tools/rig/src/foesFixed.png', fw: 64, fh: 128, row, frames: [0, 1, 2, 3, 4, 5, 6, 7] });
const BOSS_OLD = (row) => ({ src: 'tools/rig/src/bosses.png', fw: 80, fh: 160, row, frames: [0, 1, 2, 3, 4, 5] });

/**
 * gameK: model px → in-game px (the live game draws every humanoid cell at 56×112).
 * arm: the hand that strikes / holds the prop. style: melee pose family.
 */
export const CAST = {
  joseph: { label: 'Joseph', rig: 'joseph', gameK: 56 / 64, yOff: 2, anims: ['idle', 'walk', 'run', 'jump', 'kneel', 'throw'],
    old: { src: 'assets/joseph.png', fw: 64, fh: 128, row: 0, frames: [2, 3, 4, 5, 6, 7, 8, 9] }, note: 'Young Joseph (ch. 1–2) uses this same painting and rig.' },
  brigand: { label: 'Treasure seeker (brigand)', rig: 'brigand', gameK: 0.875, arm: 'f', style: 'punch', seed: 1, anims: ['idle', 'walk', 'attack', 'throw'], old: FOE_OLD(0) },
  scout: { label: 'Treasure seeker (scout)', rig: 'scout', gameK: 0.875, arm: 'f', style: 'punch', seed: 2, anims: ['idle', 'walk', 'attack', 'throw'], old: FOE_OLD(1) },
  thug: { label: 'Treasure seeker (thug)', rig: 'thug', gameK: 0.875, arm: 'f', style: 'punch', seed: 3, anims: ['idle', 'walk', 'attack', 'throw'], old: FOE_OLD(2) },
  torch: { label: 'Torch-bearer', rig: 'brigand', gameK: 0.875, arm: 'f', style: 'punch', prop: 'torch', seed: 4, anims: ['idle', 'walk', 'attack'], old: FOE_OLD(0) },
  club: { label: 'Club ruffian', rig: 'brigand', gameK: 0.875, arm: 'f', style: 'club', prop: 'club', seed: 5, anims: ['idle', 'walk', 'attack'], old: FOE_OLD(0) },
  guard: { label: 'Militia guard (musket never fired)', rig: 'thug', gameK: 0.875, arm: 'f', style: 'shove', prop: 'musket', seed: 6, anims: ['idle', 'walk', 'attack'], old: FOE_OLD(2),
    note: 'Carries the musket at shoulder arms and shoves at port arms. It never points at anyone and is never fired.' },
  methodist: { label: 'Methodist preacher', rig: 'methodist', gameK: 0.7, arm: 'f', seed: 7, anims: ['idle', 'speak', 'walk'],
    old: { src: 'tools/rig/src/preacher_methodist.png', fw: 80, fh: 160, row: 0, frames: [0, 1] } },
  presbyterian: { label: 'Presbyterian preacher', rig: 'presbyterian', gameK: 0.875, yOff: 2, arm: 'f', seed: 8, anims: ['idle', 'speak', 'walk'],
    old: { src: 'tools/rig/src/preacher_presbyterian.png', fw: 64, fh: 128, row: 0, frames: [0, 1] } },
  baptist: { label: 'Baptist preacher', rig: 'baptist', gameK: 0.7, arm: 'f', seed: 9, anims: ['idle', 'speak', 'walk'],
    old: { src: 'tools/rig/src/preacher_baptist.png', fw: 80, fh: 160, row: 0, frames: [0, 1] } },
  moroni: { label: 'Moroni', rig: 'moroni', gameK: 0.875, arm: 'f', seed: 10, anims: ['idle', 'greet', 'walk'],
    old: { src: 'tools/rig/src/moroni.png', fw: 64, fh: 128, row: 0, frames: [0, 1, 2, 1], greet: 3 } },
  captain: { label: 'Captain (ch. 4 boss)', rig: 'captain', gameK: 0.7, arm: 'f', style: 'punch', seed: 11, anims: ['idle', 'walk', 'tell'], old: BOSS_OLD(2),
    note: 'His long coat hides most of the legs, so the thighs are short. The coat side under the sleeve is repainted as plain cloth.' },
  warden: { label: 'Warden (ch. 5 boss)', rig: 'warden', gameK: 0.7, arm: 'f', style: 'club', prop: 'mace', seed: 12, anims: ['idle', 'walk', 'tell'], old: BOSS_OLD(3),
    note: 'Body cut from his painted frame 0; the mace is cut from his painted frame 1 (shaft under the fist painted in). Coif and mace are the existing live art, unchanged.' },
  overseer: { label: 'Overseer (ch. 6 boss)', rig: 'overseer', gameK: 0.7, arm: 'f', style: 'punch', seed: 13, anims: ['idle', 'walk', 'tell'], old: BOSS_OLD(4) },
};

export const ANIM_LABEL = {
  idle: 'Idle', walk: 'Walk', run: 'Run (game speed)', jump: 'Jump', kneel: 'Kneel & pray', throw: 'Throw',
  attack: 'Attack', speak: 'Preach', greet: 'Greet', tell: 'Wind-up & charge',
};
export const ANIM_DUR = { idle: 6.8, walk: 2, attack: 1.8, throw: 1.2, speak: 6, greet: 3.6, tell: 2.4 };

let CAST_RIGS = null;
let castLoading = null;
/** Painted props cut from the same frames as their owners (grip = hand point, art px). */
const IMG_PROPS = { mace: { file: 'warden-mace', img: null, meta: null } };
function loadImgProp(base, v, p) {
  return Promise.all([
    fetch(`${base}${p.file}.json?v=${v}`).then((r) => r.json()),
    new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = `${base}${p.file}.png?v=${v}`; }),
  ]).then(([meta, img]) => { p.meta = meta; p.img = img; }).catch(() => {});
}
export function loadCastRigs(base = 'assets/rig/', v = '73') {
  if (!castLoading) {
    castLoading = Promise.all([loadCast(base, v), ...Object.values(IMG_PROPS).map((p) => loadImgProp(base, v, p))])
      .then(([r]) => { CAST_RIGS = r; return r; });
  }
  return castLoading;
}
export function castRigs() {
  return CAST_RIGS;
}
export function rigFor(key) {
  const d = CAST[key];
  return d && CAST_RIGS ? CAST_RIGS[d.rig] || null : null;
}

const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Prop-carrying arm poses layered over locomotion. */
function withProp(def, pose, t) {
  if (def.prop === 'torch') return applyHold(pose, 'f', -54, -58);
  if (def.prop === 'club') return applyHold(pose, 'f', -10, -48);
  if (def.prop === 'mace') return applyHold(pose, 'f', -14, -58); // mace carried upright, as painted
  if (def.prop === 'musket') {
    // shoulder arms: near hand at the stock; the far arm swings free
    return { ...pose, nArm: -6 + pose.nArm * 0.2, nFore: -100 };
  }
  return pose;
}

/**
 * Pose for a character's named animation at time t (s).
 * Returns { pose, dist } where dist = model px travelled (preview ground scroll).
 */
export function castPose(key, rig, anim, t) {
  const def = CAST[key];
  const sk = skelOf(rig.meta);
  const seed = def.seed || 0;
  if (anim === 'walk') {
    const L = strideLen(sk, WALK);
    const dist = t * L; // one cycle per second: a calm walk
    return { pose: withProp(def, poseWalk(dist / L, WALK, sk), t), dist };
  }
  if (anim === 'attack') {
    // wait → wind-up (telegraph) → lunge → recover, matching the game's melee beats
    const T = t % ANIM_DUR.attack;
    let p = withProp(def, poseIdle(t, sk, seed), t);
    let dist = 0;
    const style = def.style || 'punch';
    if (T > 0.3 && T < 0.75) p = applyWind(p, (T - 0.3) / 0.4, def.arm, style);
    else if (T >= 0.75 && T < 1.05) {
      const k = (T - 0.75) / 0.23;
      p = applyStrike(applyWind(p, 1, def.arm, style), k, def.arm, style);
      dist = 14 * smooth(clamp(k, 0, 1));
    } else if (T >= 1.05) {
      const k = clamp((T - 1.05) / 0.5, 0, 1);
      const s = applyStrike(applyWind(p, 1, def.arm, style), 1, def.arm, style);
      p = blend(s, p, smooth(k));
      dist = 14;
    }
    return { pose: p, dist };
  }
  if (anim === 'throw') {
    const T = t % ANIM_DUR.throw;
    let p = poseIdle(t, sk, seed);
    if (T > 0.3 && T < 0.62) p = applyThrow(p, (T - 0.3) / 0.32);
    return { pose: p, dist: 0 };
  }
  if (anim === 'speak') return { pose: applySpeak(poseIdle(t, sk, seed), t, def.arm), dist: 0 };
  if (anim === 'greet') {
    const T = t % ANIM_DUR.greet;
    const k = T < 0.4 ? 0 : T < 1.0 ? (T - 0.4) / 0.6 : T < 2.8 ? 1 : T < 3.3 ? 1 - (T - 2.8) / 0.5 : 0;
    return { pose: applyGreet(poseIdle(t, sk, seed), k, def.arm), dist: 0 };
  }
  if (anim === 'tell') {
    const T = t % ANIM_DUR.tell;
    const style = def.style || 'punch';
    let p = withProp(def, poseIdle(t, sk, seed), t);
    let dist = 0;
    if (T > 0.3 && T < 1.3) {
      p = applyWind(p, (T - 0.3) / 0.5, def.arm, style);
      if (T > 0.8) p.rootX = Math.sin(T * 60) * 0.5; // trembling, gathering
    } else if (T >= 1.3 && T < 1.8) {
      const k = (T - 1.3) / 0.5;
      const w = withProp(def, poseWalk(k * 2, { ...WALK, cycle: 90, lean: 9, arm: 26, duty: 0.4, lift: 12, fly: 2 }, sk), t);
      p = applyStrike(applyWind(w, 1, def.arm, style), 1, def.arm, style);
      dist = 2 * strideLen(sk, { cycle: 90 }) * k;
    } else if (T >= 1.8) {
      const k = clamp((T - 1.8) / 0.4, 0, 1);
      p = blend(applyStrike(applyWind(withProp(def, poseIdle(t, sk, seed), t), 1, def.arm, style), 1, def.arm, style), p, smooth(k));
      dist = 2 * strideLen(sk, { cycle: 90 });
    }
    return { pose: p, dist };
  }
  return { pose: withProp(def, poseIdle(t, sk, seed), t), dist: 0 };
}

/** Which old sprite frame the live game would show (for before/after comparisons). */
export function castOldFrame(key, anim, t, dist) {
  const o = CAST[key].old;
  if (anim === 'walk') return o.frames[Math.floor((dist * 0.875) / 6) % o.frames.length];
  if (anim === 'speak') return o.frames[Math.floor((t * 60) / 22) % o.frames.length];
  if (anim === 'greet' && o.greet != null) return o.greet;
  if (key === 'moroni') return o.frames[Math.floor((t * 60) / 18) % o.frames.length];
  if (anim === 'attack' || anim === 'tell') return o.frames[Math.floor((t * 60) / 7) % o.frames.length]; // the sheet keeps walking
  return o.frames[0];
}

function blend(a, b, k) {
  const o = {};
  for (const key of Object.keys(a)) {
    const va = a[key], vb = b[key] ?? va;
    if (Array.isArray(va)) o[key] = [va[0] + (vb[0] - va[0]) * k, va[1] + (vb[1] - va[1]) * k];
    else if (typeof va === 'number') o[key] = va + (vb - va) * k;
    else o[key] = k < 0.5 ? va : vb;
  }
  return o;
}

/** Draw a cast member's prop at its hand (screen space). `under` = before the body. */
function drawProp(ctx, def, rig, B, toScreen, gs, flip, t, state) {
  if (!def.prop) return;
  const meta = rig.meta;
  const side = def.prop === 'musket' ? 'n' : 'f';
  const h = handPoint(meta, B, side);
  if (!h) return;
  const fo = B[side + 'Fore'];
  const sk = skelOf(meta);
  const phiF = (side === 'n' ? sk.phi.nFo : sk.phi.fFo) * Math.PI / 180;
  const foreAng = fo.rot + phiF; // forearm direction from straight down (world)
  const [sx, sy] = toScreen(h);
  ctx.save();
  ctx.translate(sx, sy);
  if (flip) ctx.scale(-1, 1);
  ctx.scale(gs, gs);
  if (def.prop === 'torch') {
    ctx.rotate(foreAng + 1.75);
    drawTorchProp(ctx, 0, 0, 1, (t || 0) * 60);
  } else if (def.prop === 'club') {
    // wrist snaps the club forward and down as the arm comes through the strike
    if (rig._clubRef === undefined) {
      const { B: B0 } = solve(meta, withProp(def, basePose(sk), 0));
      rig._clubRef = B0.fUpper.rot - B0.torso.rot;
    }
    const up = -10 + ((B.fUpper.rot - B.torso.rot) - rig._clubRef) * 180 / Math.PI; // ≈ pose angle
    const flex = clamp((-40 - up) / 30, 0, 1) * 108 * Math.PI / 180;
    ctx.rotate(foreAng + 1.25 - flex);
    drawClubProp(ctx, 0, 0, 1, false);
  } else if (def.prop === 'musket') {
    // shoulder arms at rest (as the old sprite carried it); swung to port arms (diagonal
    // across the chest, muzzle up and back) for the shove. It never points at anyone and
    // is never fired.
    if (rig._muskRef === undefined) {
      const { B: B0 } = solve(meta, withProp(def, basePose(sk), 0));
      rig._muskRef = B0.nUpper.rot - B0.torso.rot;
    }
    const lift = clamp((rig._muskRef - (B.nUpper.rot - B.torso.rot)) / (72 * Math.PI / 180), 0, 1);
    ctx.rotate(B.torso.rot - lift * 0.95);
    drawMusketProp(ctx, 0, 0, 1);
  } else if (IMG_PROPS[def.prop] && IMG_PROPS[def.prop].img) {
    // painted prop: upright as painted when the arm is in its carry pose, then turns with the forearm
    const P = IMG_PROPS[def.prop];
    if (rig._propRef === undefined) {
      const { B: B0 } = solve(meta, withProp(def, basePose(sk), 0));
      rig._propRef = B0[side + 'Fore'].rot + phiF;
    }
    ctx.scale(1 / gs * state, 1 / gs * state); // state = body scale (model px → screen)
    ctx.rotate(foreAng - rig._propRef);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(P.img, -P.meta.grip[0], -P.meta.grip[1]);
  }
  ctx.restore();
}

/**
 * Draw a cast member. x,y = screen top-left of its sprite cell (same as the old blit),
 * scale = screen px per model px. opts: flip, bones, flash, t (s), crisp.
 */
export function drawCast(ctx, key, pose, x, y, scale, opts = {}) {
  const def = CAST[key];
  const rig = rigFor(key);
  if (!def || !rig) return null;
  const meta = rig.meta;
  const flip = !!opts.flip;
  const y0 = y + (def.yOff || 0) * scale;
  const cw = meta.cell[0];
  const toScreen = (p) => [x + (flip ? cw - p[0] : p[0]) * scale, y0 + p[1] * scale];
  const gs = scale / 0.875 * (opts.propK ?? 1); // props are authored in game px for a 0.875 cell
  const { B } = solve(meta, pose);
  const side = def.prop === 'musket' ? 'n' : 'f';
  if (def.prop && side === 'f' && def.prop !== 'torch') drawProp(ctx, def, rig, B, toScreen, gs, flip, opts.t, scale);
  const r = drawRig(ctx, rig, pose, {
    x, y: y0, scale, flip, bones: opts.bones, crisp: opts.crisp,
    filter: opts.flash ? 'brightness(2.1) sepia(0.7) hue-rotate(-35deg) saturate(2.8) contrast(1.15)' : undefined,
  });
  if (def.prop && (side === 'n' || def.prop === 'torch')) drawProp(ctx, def, rig, B, toScreen, gs, flip, opts.t, scale);
  return r;
}

// ------------------------------------------------------------------ in-game (?rig=1)
export const RIG_MODE = typeof location !== 'undefined' && new URLSearchParams(location.search).get('rig') === '1';
if (RIG_MODE) loadCastRigs().catch(() => {});

const VARIANT_KEY = { torch: 'torch', club: 'club', musket: 'guard' };
const THROW_LEN = 0.34;

/** Rig key for an enemy, or null if it stays a sprite (wisps, ringleader/sentinel bosses, critters). */
export function enemyRigKey(e) {
  if (!RIG_MODE || !CAST_RIGS || e.critter) return null;
  let key = null;
  if (e.type === 'brigand' || e.type === 'scout' || e.type === 'thug') key = VARIANT_KEY[e.variant] || e.type;
  else if (e.type === 'boss' && CAST[e.bossKind]) key = e.bossKind;
  return key && rigFor(key) ? key : null;
}

/** Pose an enemy from its game state: feet locked to distance walked, melee beats, knife throws. */
function enemyPose(e, key, rig) {
  const def = CAST[key];
  const sk = skelOf(rig.meta);
  const dt = 1 / 60;
  const r = e.rig || (e.rig = { t: Math.random() * 5, phase: 0, lastX: e.x, cd: e.attackCd || 0, throwT: 9, moveK: 0 });
  const dx = Math.abs(e.x - r.lastX) / def.gameK;
  r.lastX = e.x;
  r.t += dt;
  if ((e.attackCd || 0) > r.cd + 5) r.throwT = 0; // a knife just left the hand
  r.cd = e.attackCd || 0;
  const moving = dx > 0.05 && e.onGround !== false;
  r.moveK = Math.max(0, Math.min(1, r.moveK + (moving ? dt / 0.15 : -dt / 0.2)));
  const L = strideLen(sk, WALK);
  if (moving) r.phase += dx / L;
  const idle = withProp(def, poseIdle(r.t, sk, def.seed || 0), r.t);
  let p = idle;
  if (r.moveK > 0) {
    const w = withProp(def, poseWalk(r.phase, WALK, sk), r.t);
    p = r.moveK >= 1 ? w : blend(idle, w, smooth(r.moveK));
  }
  const style = def.style || 'punch';
  if (e.alive && e.melee === 'wind') {
    const k = 1 - (e.meleeT || 0) / (e.meleeWind || 18);
    p = applyWind(p, k, def.arm, style);
  } else if (e.alive && e.melee === 'lunge') {
    p = applyStrike(applyWind(p, 1, def.arm, style), 1, def.arm, style);
  } else if (e.alive && e.melee === 'recover') {
    const k = Math.min(1, (e.meleeT || 0) / 36);
    p = blend(p, applyStrike(applyWind(p, 1, def.arm, style), 1, def.arm, style), smooth(k));
  } else if (e.telling) {
    p = applyWind(p, 1, def.arm, def.style || 'punch');
    p.rootX = Math.sin(r.t * 60) * 0.4;
  }
  if (r.throwT < THROW_LEN) {
    p = applyThrow(p, r.throwT / THROW_LEN);
    r.throwT += dt;
  }
  return p;
}

/** Draw a rigged enemy in place of its sprite. Returns false to fall back to the sprite. */
export function drawEnemyRig(ctx, e, dx, flash) {
  const key = enemyRigKey(e);
  if (!key) return false;
  const rig = rigFor(key);
  const def = CAST[key];
  const pose = enemyPose(e, key, rig);
  drawCast(ctx, key, pose, Math.floor(dx), Math.floor(e.y), def.gameK, {
    flip: e.facing < 0, flash, t: (e.clock || 0) / 60,
  });
  return true;
}

/** Preacher NPCs (grove). Returns false to fall back to the sprite. */
export function drawPreacherRig(ctx, x, y, facing, kind, tick, speaking) {
  if (!RIG_MODE || !CAST[kind] || !rigFor(kind)) return false;
  const def = CAST[kind];
  const rig = rigFor(kind);
  const sk = skelOf(rig.meta);
  const t = tick / 60;
  let pose = poseIdle(t, sk, def.seed || 0);
  if (speaking) pose = applySpeak(pose, t, def.arm);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(Math.floor(x) + 28, Math.floor(y) + 112 - 3, 56 * 0.3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawCast(ctx, kind, pose, Math.floor(x), Math.floor(y), def.gameK, { flip: facing < 0, t });
  return true;
}

/**
 * Moroni body (the glory/aura stays from the sprite code). L0 = moroniLayout() for
 * frame 0, so the rig stands exactly where the painting stood and keeps his height.
 */
export function drawMoroniRig(ctx, L0, tick, faceLeft, greet, bob) {
  if (!RIG_MODE || !rigFor('moroni')) return false;
  const rig = rigFor('moroni');
  const sk = skelOf(rig.meta);
  const t = tick / 60;
  const st = rig._greet || (rig._greet = { k: 0 });
  st.k = Math.max(0, Math.min(1, st.k + (greet ? 1 / 30 : -1 / 30)));
  let pose = poseIdle(t, sk, 10);
  if (st.k > 0) pose = applyGreet(pose, st.k, 'f');
  drawCast(ctx, 'moroni', pose, L0.dx, L0.dy + (L0.bob - bob), L0.scale, { flip: faceLeft, t });
  return true;
}
