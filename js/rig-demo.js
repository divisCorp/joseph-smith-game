/**
 * Shared old-vs-new timelines for rig-preview.html and the QA strip renderer.
 * Units: model px (64×128 source cell). Game draws the cell at 56×112 (×0.875).
 */
import {
  poseIdle, poseWalk, poseJump, kneelFrom, drawRig, soleContacts, applyThrow,
  WALK, RUN, JUMP_T, jumpHeight, JUMP_PHYS, RIG_GROUND,
} from './rig.js?v=79';

export const GAME_K = 56 / 64; // model px → in-game px
const OLD_WALK = [2, 3, 4, 5, 6, 7, 8, 9];
export const WALK_PERIOD = 1.0; // s per walk cycle in the preview (a calm walk)
export const WALK_SPEED = WALK.cycle / WALK_PERIOD; // model px / s
export const RUN_SPEED = (1.55 * 2 * 60) / GAME_K; // in-game run speed, model px / s

export const ANIMS = {
  idle: { label: 'Idle', dur: 6.8, speed: 0 },
  walk: { label: 'Walk', dur: WALK_PERIOD * 2, speed: WALK_SPEED },
  run: { label: 'Run (game speed)', dur: (RUN.cycle / RUN_SPEED) * 4, speed: RUN_SPEED },
  jump: { label: 'Jump', dur: 1.6, speed: 0 },
  kneel: { label: 'Kneel & pray', dur: 4.0, speed: 0 },
  throw: { label: 'Plate throw', dur: 1.2, speed: 0 },
};
export const THROW_AT = 0.3, THROW_LEN = 0.34; // s; the game shows the throw for 10 frames, the rig follows through

/** Old sprite-sheet state at time t: { frame, sx, sy, rot, dy } (mirrors player.js/sprites.js). */
export function oldState(anim, t) {
  const o = { frame: 0, sx: 1, sy: 1, rot: 0, dy: 0, air: 0 };
  if (anim === 'walk' || anim === 'run') {
    const dist = t * ANIMS[anim].speed * GAME_K; // game px travelled
    o.frame = OLD_WALK[Math.floor(dist / 6) % 8];
  } else if (anim === 'jump') {
    // game has no anticipation: takeoff happens the instant jump is pressed
    const leave = JUMP_T.leave;
    if (t > leave) {
      const f = (t - leave) * 60;
      const vy = (JUMP_PHYS.vy0 + JUMP_PHYS.g * f) * GAME_K; // game px/frame
      const y = jumpHeight(t);
      if (y < 0) {
        o.air = y;
        const jumpT = f;
        o.dy = -6 / GAME_K;
        if (jumpT < 5 && vy < 0) { o.frame = 10; const k = 1 - jumpT / 5; o.sx = 1 + 0.1 * k; o.sy = 1 - 0.12 * k; }
        else if (vy < -3.2) { o.frame = 10; const k = Math.min(1, -vy / 10); o.sx = 1 - 0.06 * k; o.sy = 1 + 0.08 * k; }
        else if (vy < 2.6) { o.frame = 12; o.rot = 0.05; }
        else { o.frame = 13; const k = Math.min(1, vy / 12); o.sx = 1 - 0.04 * k; o.sy = 1 + 0.05 * k; o.rot = -0.04; }
      } else {
        const lt = (t - JUMP_T.touch) * 60; // landing squash, 9 frames
        if (lt >= 0 && lt < 9) {
          const k = Math.sin((1 - lt / 9) * Math.PI * 0.5);
          o.sx = 1 + 0.15 * k; o.sy = 1 - 0.15 * k;
        }
      }
    }
  } else if (anim === 'kneel') {
    const k = kneelK(t);
    o.frame = k > 0.5 ? 11 : 0;
  } else if (anim === 'throw') {
    const f = (t - THROW_AT) * 60; // attackTimer runs 10 frames
    if (f >= 0 && f < 10) o.frame = f < 5 ? 12 : 13;
  }
  return o;
}

function kneelK(t) {
  if (t < 0.5) return 0;
  if (t < 1.0) return (t - 0.5) / 0.5;
  if (t < 3.2) return 1;
  if (t < 3.7) return 1 - (t - 3.2) / 0.5;
  return 0;
}
const ease = (k) => k * k * (3 - 2 * k);

/** New rig pose at time t. Returns { pose, dist } (dist = model px travelled). */
export function newState(anim, t) {
  if (anim === 'walk') {
    const dist = t * WALK_SPEED;
    return { pose: poseWalk(dist / WALK.cycle, WALK), dist };
  }
  if (anim === 'run') {
    const dist = t * RUN_SPEED;
    return { pose: poseWalk(dist / RUN.cycle, RUN), dist };
  }
  if (anim === 'throw') {
    const u = (t - THROW_AT) / THROW_LEN;
    const p = poseIdle(t);
    return { pose: u > 0 && u < 1 ? applyThrow(p, u) : p, dist: 0 };
  }
  if (anim === 'jump') return { pose: poseJump(t), dist: 0 };
  if (anim === 'kneel') {
    const k = ease(kneelK(t));
    return { pose: kneelFrom(poseIdle(t), k, t), dist: 0 };
  }
  return { pose: poseIdle(t), dist: 0 };
}

/** Draw an old sprite-sheet frame, feet on the model ground like the game does. */
export function drawOld(ctx, sheet, st, x, y, scale, flip = false) {
  const dw = 64 * scale, dh = 128 * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const fx = x + dw / 2, fy = y + 128 * scale;
  ctx.translate(fx, fy + (st.air + st.dy) * scale);
  if (st.rot) ctx.rotate(st.rot);
  ctx.scale(st.sx * (flip ? -1 : 1), st.sy);
  ctx.drawImage(sheet, st.frame * 64, 0, 64, 128, -dw / 2, -dh, dw, dh);
  ctx.restore();
}

/** Draw the rig; the model ground (y=126) is shifted to the cell bottom (128) like the old art. */
export function drawNew(ctx, rig, pose, x, y, scale, opts = {}) {
  return drawRig(ctx, rig, pose, { x, y: y + (128 - RIG_GROUND) * scale, scale, ...opts });
}

export { soleContacts };
