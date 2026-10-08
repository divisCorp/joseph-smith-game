/**
 * Palmyra Quest — painted cut-out skeletal rig (proof of concept).
 *
 * The original idle painting of Joseph is cut into parts (tools/rig/cut_joseph.py)
 * and animated here on a small bone hierarchy: every part keeps its painted pixels
 * and proportions; only bones move. Legs use 2-bone IK so planted feet stay locked
 * to the ground line while the hips travel.
 *
 * Model space = the 64×128 source cell (x right, y down), ground line y = 126.
 */

const D2R = Math.PI / 180;
export const RIG_GROUND = 126;
const THIGH = 24;
const SHIN = 20;
const ANKLE_Y = 119.5; // ankle height when the boot is flat on the ground line
const HIP_N = [30.5, 76];
const HIP_F = [38, 76];
const IDLE_N = [26.5, ANKLE_Y];
const FAR_ARM_REST = -11; // far arm hangs slightly forward so its hand peeks past the far thigh
const IDLE_F = [38, ANKLE_Y];
// boot geometry in art space (for heel-strike / toe-roll pivots)
const ANKLE_ART = [38, 119.5];
const HEEL_ART = [34.5, 126];
const TOE_ART = [48.5, 126];

// ------------------------------------------------------------------ loading
export function loadRig(base = 'assets/rig/', v = '') {
  const q = v ? `?v=${v}` : '';
  return Promise.all([
    fetch(`${base}joseph-rig.json${q}`).then((r) => r.json()),
    new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = `${base}joseph-rig.png${q}`;
    }),
  ]).then(([meta, img]) => ({ meta, img }));
}

// ------------------------------------------------------------------ math
const rot = (x, y, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
};
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);
const wrap = (v) => ((v % 1) + 1) % 1;

/** Catmull-Rom track through [t, value] keys; `loop` wraps t into [0,1). */
function track(keys, loop = false) {
  const n = keys.length;
  const get = (k) => {
    if (!loop) return keys[clamp(k, 0, n - 1)];
    const m = ((k % n) + n) % n;
    return [keys[m][0] + Math.floor(k / n), keys[m][1]];
  };
  return (t) => {
    if (loop) t = wrap(t);
    else {
      if (t <= keys[0][0]) return keys[0][1];
      if (t >= keys[n - 1][0]) return keys[n - 1][1];
    }
    let i = 0;
    while (i < n - 1 && keys[i + 1][0] <= t) i++;
    const [t0, p0] = get(i - 1), [t1, p1] = get(i), [t2, p2] = get(i + 1), [t3, p3] = get(i + 2);
    const span = Math.max(1e-6, t2 - t1);
    const u = (t - t1) / span;
    const m1 = ((p2 - p0) / Math.max(1e-6, t2 - t0)) * span;
    const m2 = ((p3 - p1) / Math.max(1e-6, t3 - t1)) * span;
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2;
  };
}

// ------------------------------------------------------------------ poses
/** A neutral pose: every value is an offset from the painted idle frame. */
export function basePose() {
  return {
    rootX: 0, rootY: 0, // whole-body offset (airborne height etc.)
    pelvisDx: 0, pelvisDy: 0, pelvisRot: 0,
    torsoRot: 0, torsoDy: 0,
    headRot: 0, headDy: 0,
    nArm: 0, nFore: 0, fArm: 0, fFore: 0,
    skirt: 0, tail: 0, coatFar: 0,
    // ankle targets (model space, before rootX/rootY) and world foot angle (deg, + = toe down)
    nFoot: [...IDLE_N], nFootRot: 0,
    fFoot: [...IDLE_F], fFootRot: 0,
  };
}

/** Idle: breathing, a slight lagging head bob, coat-tail sway. t in seconds. */
export function poseIdle(t) {
  const p = basePose();
  const w = (Math.PI * 2) / 3.4;
  const b = Math.sin(w * t); // breath
  p.torsoDy = -0.45 * (b + 1);
  p.torsoRot = 0.5 * b;
  p.headDy = -0.25 * (Math.sin(w * t - 0.7) + 1);
  p.headRot = 0.9 * Math.sin(w * t - 0.9);
  p.nArm = 1.4 * Math.sin(w * t - 0.5);
  p.nFore = -1.5 - 1.2 * Math.sin(w * t - 0.9);
  p.fArm = -1.0 * Math.sin(w * t - 0.4);
  p.fFore = -1.0 - 0.8 * Math.sin(w * t - 0.8);
  p.tail = 1.6 * Math.sin(w * 0.8 * t - 1.2) + 0.6 * Math.sin(w * 2.3 * t);
  p.skirt = 0.35 * Math.sin(w * t - 1.0);
  p.coatFar = 0.6 * Math.sin(w * t - 1.1);
  return p;
}

/**
 * Locomotion cycle. phase in [0,1): 0 = near-foot contact, 0.5 = far-foot contact.
 * Keys per half cycle: contact → down → passing → up. Feet are procedural so the
 * stance foot moves backwards exactly one cycle-length per cycle: when the body
 * travels `cycle` model px per phase-unit the planted foot never slides.
 *   cycle — stride length (model px per full cycle)
 *   duty  — fraction of the cycle a foot is planted (>0.5 walk, <0.5 run)
 */
export const WALK = { cycle: 62, duty: 0.58, lift: 6, lean: 3, arm: 16, bob: 1.0, fwd: 0 };
export const JOG = { cycle: 96, duty: 0.42, lift: 12, lean: 7, arm: 28, bob: 1.8, fwd: 3 };

const walkPelvis = track([[0, 2.2], [0.1, 3.2], [0.25, 1.2], [0.38, 0.4], [0.5, 2.2], [0.6, 3.2], [0.75, 1.2], [0.88, 0.4]], true);
const walkTorso = track([[0, 0.4], [0.1, 1.0], [0.25, 0], [0.38, -0.6], [0.5, 0.4], [0.6, 1.0], [0.75, 0], [0.88, -0.6]], true);
const walkTail = track([[0, 1], [0.15, -1.2], [0.3, -0.4], [0.42, 1.4], [0.5, 1], [0.65, -1.2], [0.8, -0.4], [0.92, 1.4]], true);

function footAt(u, P, hipX, out) {
  // returns [ankleX, ankleY, footRot] for a leg at its own phase u (0 = contact)
  const D = P.duty;
  const S = P.cycle * D; // distance the stance foot travels back
  const front = hipX + S / 2 + P.fwd;
  const stanceAnkle = (s) => {
    const x = front - s * S; // flat-foot ankle x, locked to the ground
    let r = 0;
    if (s < 0.14) r = -14 * (1 - smooth(s / 0.14)); // heel strike, toe comes down
    else if (s > 0.64) r = 24 * smooth((s - 0.64) / 0.36); // heel lifts, rolls over toe
    return planted(x, r);
  };
  if (u < D) {
    const [x, y, r] = stanceAnkle(u / D);
    out[0] = x; out[1] = y; out[2] = r;
    return out;
  }
  const s = (u - D) / (1 - D);
  const [x0, y0] = stanceAnkle(1);
  const [x1, y1] = planted(front, -14);
  const e = s < 0.5 ? 2 * s * s : 1 - 2 * (1 - s) * (1 - s); // ease in-out
  const lift = P.lift * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), 1.1);
  out[0] = lerp(x0, x1, e);
  out[1] = lerp(y0, y1, e) - lift;
  out[2] = s < 0.35 ? lerp(24, 6, smooth(s / 0.35)) : lerp(6, -14, smooth((s - 0.35) / 0.65));
  return out;
}

/** Flat-foot ankle position x on the ground, rotated `r` degrees about heel (r<0) or toe (r>0). */
function planted(ankleX, r) {
  if (!r) return [ankleX, ANKLE_Y, 0];
  const piv = r < 0 ? HEEL_ART : TOE_ART;
  const pw = [ankleX + piv[0] - ANKLE_ART[0], RIG_GROUND];
  const d = rot(ANKLE_ART[0] - piv[0], ANKLE_ART[1] - piv[1], r * D2R);
  return [pw[0] + d[0], pw[1] + d[1], r];
}

export function poseWalk(phase, P = WALK) {
  const p = basePose();
  const ph = wrap(phase);
  const n = footAt(wrap(ph), P, HIP_N[0], [0, 0, 0]);
  const f = footAt(wrap(ph - 0.5), P, HIP_F[0], [0, 0, 0]);
  p.nFoot = [n[0], n[1]]; p.nFootRot = n[2];
  p.fFoot = [f[0], f[1]]; p.fFootRot = f[2];
  p.pelvisDy = 1.2 + walkPelvis(ph) * P.bob;
  p.torsoRot = P.lean + walkTorso(ph) * (P.lean / 3.5);
  p.headRot = -0.7 * (p.torsoRot - P.lean) - P.lean * 0.55; // head stays level-ish
  const sw = Math.cos(Math.PI * 2 * (ph - 0.05));
  p.nArm = 3 + P.arm * sw; // near arm back while near leg is forward
  p.fArm = 1 - P.arm * 0.8 * sw;
  p.nFore = -6 - 16 * Math.max(0, -sw) - 3 * Math.max(0, sw);
  p.fFore = -6 - 16 * Math.max(0, sw) - 3 * Math.max(0, -sw);
  p.tail = 3 + (P.lean - 3.5) * 0.6 + walkTail(ph) * 2.2;
  p.skirt = 0.9 * Math.sin(Math.PI * 4 * (ph - 0.1));
  p.coatFar = -1.5 * sw;
  // keep both planted feet reachable: lower the hips only as much as needed
  const reach = THIGH + SHIN - 0.6;
  for (const [hip, foot, planted] of [[HIP_N, n, wrap(ph) < P.duty], [HIP_F, f, wrap(ph - 0.5) < P.duty]]) {
    if (!planted) continue;
    const dx = foot[0] - hip[0];
    const maxHipY = foot[1] - Math.sqrt(Math.max(0, reach * reach - dx * dx));
    const hipY = hip[1] + p.pelvisDy;
    if (hipY < maxHipY) p.pelvisDy += maxHipY - hipY;
  }
  return p;
}

/** Blend walk → jog parameters by speed (0..1). */
export function gaitParams(k) {
  const o = {};
  for (const key in WALK) o[key] = lerp(WALK[key], JOG[key], clamp(k, 0, 1));
  return o;
}

/**
 * Jump timeline (seconds, 1.3 s total). Ground keys keep the feet planted on the
 * ground line; airborne keys place the feet relative to the body.
 */
export const JUMP_T = { anticip: 0.15, leave: 0.2, apex: 0.495, touch: 0.79, squash: 0.87, end: 1.2 };
const JK = [
  // t,    pDy, torso, head, nArm, nFore, fArm, fFore, tail, skirt, nFx, nFy, nFr, fFx, fFy, fFr
  [0.0, 0, 0, 0, 0, -1.5, 0, -1, 0, 0, 26.5, 119.5, 0, 38, 119.5, 0],
  [0.15, 9, 11, -8, 40, -14, 30, -12, -3, 1, 26.5, 119.5, 0, 38, 119.5, 0], // anticipation crouch, arms back
  [0.22, -3, 2, -3, -74, -24, 18, -10, 10, -1.5, 27.5, 117, 34, 39, 117.5, 32], // takeoff stretch on toes, lead arm drives up
  [0.36, 0, 6, 1, -86, -8, 30, -18, 14, -2, 25, 103, 18, 41, 108, 10], // rising tuck
  [0.495, 0.5, 4, 2, -80, -12, 26, -16, 6, -1, 25.5, 101, 16, 41.5, 106, 8], // apex
  [0.66, -1, -2, -1, -60, -16, -24, -20, -8, 1.5, 36, 116, -6, 25, 118, 10], // falling, legs reach, arms open for balance
  [0.79, 1, 3, -1, -40, -16, -22, -16, -10, 1.5, 34, 119.5, -10, 25.5, 119.5, 0], // touchdown (heel)
  [0.87, 10, 12, -7, -18, -34, -12, -30, -2, -1.5, 34, 119.5, 0, 25.5, 119.5, 0], // landing squash
  [1.0, -0.8, -1, 1, 6, -4, 4, -3, 4, 0.5, 34, 119.5, 0, 25.5, 119.5, 0], // recovery overshoot
  [1.2, 0, 0, 0, 0, -1.5, 0, -1, 0, 0, 34, 119.5, 0, 25.5, 119.5, 0],
];
const JTRACKS = Array.from({ length: 15 }, (_, c) => track(JK.map((k) => [k[0], k[c + 1]])));

/** Game jump physics in model px: JUMP_V −6.2·SCALE, gravity 0.35·SCALE per frame @60fps. */
export const JUMP_PHYS = { vy0: (-6.2 * 2) / 0.875, g: (0.35 * 2) / 0.875 };
export const JUMP_AIR = (2 * -JUMP_PHYS.vy0) / JUMP_PHYS.g / 60; // ≈0.59 s

export function jumpHeight(t) {
  const a = JUMP_T.leave;
  if (t <= a) return 0;
  const f = (t - a) * 60;
  const y = JUMP_PHYS.vy0 * f + 0.5 * JUMP_PHYS.g * f * f;
  return Math.min(0, y);
}

/** Jump pose at time t (s). `air` overrides the airborne offset (in-game physics). */
export function poseJump(t, air = null) {
  const p = basePose();
  const v = JTRACKS.map((f) => f(t));
  [p.pelvisDy, p.torsoRot, p.headRot, p.nArm, p.nFore, p.fArm, p.fFore, p.tail, p.skirt] = v;
  p.nFoot = [v[9], v[10]]; p.nFootRot = v[11];
  p.fFoot = [v[12], v[13]]; p.fFootRot = v[14];
  p.rootY = air == null ? jumpHeight(t) : air;
  p.coatFar = -0.4 * p.tail;
  // grounded keys: never let a planted foot be pulled off the ground by the hips
  if (t < JUMP_T.leave || t >= JUMP_T.touch) {
    const reach = THIGH + SHIN - 0.4;
    for (const [hip, foot] of [[HIP_N, p.nFoot], [HIP_F, p.fFoot]]) {
      const dx = foot[0] - hip[0];
      const maxHipY = foot[1] - Math.sqrt(Math.max(0, reach * reach - dx * dx));
      if (hip[1] + p.pelvisDy < maxHipY) p.pelvisDy = maxHipY - hip[1];
    }
  }
  return p;
}

/** Kneel in prayer: near knee on the ground, far foot planted ahead, hands together, head bowed. */
export function poseKneel(t = 0) {
  const p = basePose();
  p.pelvisDx = -6;
  p.pelvisDy = 21;
  p.torsoRot = -3;
  p.torsoDy = -0.35 * (Math.sin(t * 1.7) + 1); // slow, calm breathing
  p.headRot = 14 + 0.8 * Math.sin(t * 1.7 - 0.8);
  p.nArm = -24; p.nFore = -106;
  p.fArm = -2; p.fFore = -124;
  p.nHand = [41, 54]; p.fHand = [42.5, 52]; // palms together in front of the chest
  p.tail = 20; p.skirt = -5; p.coatFar = -8;
  p.nFoot = [8, 117.5]; p.nFootRot = 64;
  p.fFoot = [47, ANKLE_Y]; p.fFootRot = 0;
  return p;
}

/** Blend from any standing pose into the kneel; the feet lift as they step so nothing slides. */
export function kneelFrom(from, k, t = 0) {
  const o = blendPose(from, poseKneel(t), k);
  o.handK = smooth(clamp((k - 0.25) / 0.75, 0, 1));
  const lift = Math.sin(Math.PI * clamp(k, 0, 1));
  o.nFoot[1] -= 5 * lift;
  o.fFoot[1] -= 7 * lift;
  return o;
}

export function blendPose(a, b, k) {
  const o = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    let va = a[key], vb = b[key];
    if (key === 'nHand' || key === 'fHand') {
      // blend hand IK in via handK so arms ease from FK into the target
      o[key] = vb || va;
      continue;
    }
    if (va === undefined) va = vb;
    if (vb === undefined) vb = va;
    o[key] = Array.isArray(va) ? [lerp(va[0], vb[0], k), lerp(va[1], vb[1], k)] : lerp(va, vb, k);
  }
  return o;
}

// ------------------------------------------------------------------ solve
const UPPER_ARM = 13;
const FOREARM = 17; // elbow → middle of the hand
/** Generic 2-bone solve; side = -1 bends the joint forward (knees), +1 keeps it low/back (elbows). */
function twoBone(root, target, l1, l2, side) {
  const dx = target[0] - root[0], dy = target[1] - root[1];
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.001);
  const base = Math.atan2(-dx, dy);
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const b = Math.acos(clamp((l2 * l2 + d * d - l1 * l1) / (2 * l2 * d), -1, 1));
  return { a: base + side * a, b: base - side * b };
}
function ik(hip, target) {
  const dx = target[0] - hip[0], dy = target[1] - hip[1];
  let d = Math.hypot(dx, dy);
  const dMax = THIGH + SHIN - 0.001, dMin = Math.abs(THIGH - SHIN) + 0.5;
  d = clamp(d, dMin, dMax);
  const base = Math.atan2(-dx, dy); // angle from straight down (+ = clockwise)
  const a = Math.acos(clamp((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d), -1, 1));
  const b = Math.acos(clamp((SHIN * SHIN + d * d - THIGH * THIGH) / (2 * SHIN * d), -1, 1));
  const thigh = base - a; // knee bends forward (+x)
  const shin = base + b;
  const knee = [hip[0] - Math.sin(thigh) * THIGH, hip[1] + Math.cos(thigh) * THIGH];
  const ankle = [knee[0] - Math.sin(shin) * SHIN, knee[1] + Math.cos(shin) * SHIN];
  return { thigh, shin, knee, ankle };
}

const DRAW_ORDER = [
  'coatFar', 'fShin', 'fFoot', 'fThigh', 'fUpper', 'fFore', 'pelvis',
  'nShin', 'nFoot', 'nThigh', 'torso', 'skirt', 'tail', 'head', 'nUpper', 'nFore',
];

/** Resolve a pose into world transforms (model space) for every part + joints. */
export function solve(meta, pose) {
  const J = meta.joints;
  const B = {};
  const at = (parent, pivot, lx, ly, r) => {
    const P = B[parent];
    const pp = P.pivot;
    const [ox, oy] = rot(pivot[0] - pp[0] + lx, pivot[1] - pp[1] + ly, P.rot);
    return { pos: [P.pos[0] + ox, P.pos[1] + oy], rot: P.rot + r, pivot };
  };
  const ox = pose.rootX, oy = pose.rootY;
  B.pelvis = { pos: [J.pelvis[0] + pose.pelvisDx + ox, J.pelvis[1] + pose.pelvisDy + oy], rot: pose.pelvisRot * D2R, pivot: J.pelvis };
  B.torso = at('pelvis', J.pelvis, 0, pose.torsoDy, pose.torsoRot * D2R);
  B.head = at('torso', J.neck, 0, pose.headDy, pose.headRot * D2R);
  for (const [s, sh, el, rest] of [['n', J.nShoulder, J.nElbow, 0], ['f', J.fShoulder, J.fElbow, FAR_ARM_REST]]) {
    let up = (pose[s + 'Arm'] + rest) * D2R, fo = pose[s + 'Fore'] * D2R;
    const tgt = pose[s + 'Hand'];
    if (tgt) {
      // optional hand target in torso rest space → 2-bone arm IK, elbow kept low
      const T = B.torso;
      const [tx, ty] = rot(tgt[0] - T.pivot[0], tgt[1] - T.pivot[1], T.rot);
      const [sx, sy] = rot(sh[0] - T.pivot[0], sh[1] - T.pivot[1], T.rot);
      const S = [T.pos[0] + sx, T.pos[1] + sy], H = [T.pos[0] + tx, T.pos[1] + ty];
      const sol = twoBone(S, H, UPPER_ARM, FOREARM, 1);
      up = sol.a - T.rot;
      fo = sol.b - sol.a;
      const k = pose.handK ?? 1;
      up = lerp((pose[s + 'Arm'] + rest) * D2R, up, k);
      fo = lerp(pose[s + 'Fore'] * D2R, fo, k);
    }
    B[s + 'Upper'] = at('torso', sh, 0, 0, up);
    B[s + 'Fore'] = at(s + 'Upper', el, 0, 0, fo);
  }
  B.skirt = at('pelvis', J.skirt, 0, 0, pose.skirt * D2R);
  B.tail = at('skirt', J.tail, 0, 0, pose.tail * D2R);
  B.coatFar = at('pelvis', J.coatFar, 0, 0, pose.coatFar * D2R);
  const legs = {};
  for (const [s, hipRest, foot, fr] of [['n', HIP_N, pose.nFoot, pose.nFootRot], ['f', HIP_F, pose.fFoot, pose.fFootRot]]) {
    const hp = at('pelvis', hipRest, 0, 0, 0).pos;
    const L = ik(hp, [foot[0] + ox, foot[1] + oy]);
    legs[s] = { hip: hp, ...L, footRot: fr * D2R };
    B[s + 'Thigh'] = { pos: hp, rot: L.thigh, pivot: J.hipArt };
    B[s + 'Shin'] = { pos: L.knee, rot: L.shin, pivot: J.kneeArt };
    B[s + 'Foot'] = { pos: L.ankle, rot: fr * D2R, pivot: J.ankleArt };
  }
  return { B, legs };
}

/**
 * Draw the rig. opts: x, y = screen position of the model origin (cell top-left),
 * scale (screen px per model px), flip (face left), bones (debug overlay).
 */
export function drawRig(ctx, rig, pose, opts = {}) {
  const { meta, img } = rig;
  const s = opts.scale ?? 1;
  const up = meta.scale;
  const { B, legs } = solve(meta, pose);
  ctx.save();
  ctx.translate(opts.x ?? 0, opts.y ?? 0);
  if (opts.flip) {
    ctx.translate(meta.cell[0] * s, 0);
    ctx.scale(-1, 1);
  }
  ctx.scale(s, s);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  for (const name of DRAW_ORDER) {
    const part = meta.parts[name];
    const b = B[name];
    if (!part || !b) continue;
    ctx.save();
    ctx.translate(b.pos[0], b.pos[1]);
    if (b.rot) ctx.rotate(b.rot);
    ctx.translate(-part.pivot[0], -part.pivot[1]);
    ctx.drawImage(img, part.x, part.y, part.w, part.h, part.ox, part.oy, part.w / up, part.h / up);
    ctx.restore();
  }
  if (opts.bones) drawBones(ctx, B, legs, s);
  ctx.restore();
  return { B, legs };
}

function drawBones(ctx, B, legs, s) {
  const lw = 1.6 / s;
  const seg = (a, b, col) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw * 1.6;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  };
  const dot = (p, col, r = 2.2) => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(p[0], p[1], r / s * 1.6, 0, Math.PI * 2); ctx.fill();
  };
  const end = (name, lx, ly) => {
    const b = B[name];
    const [x, y] = rot(lx, ly, b.rot);
    return [b.pos[0] + x, b.pos[1] + y];
  };
  ctx.save();
  ctx.globalAlpha = 0.9;
  const spine = '#ffd34d', armC = '#5ad1ff', legC = '#7dff8a';
  seg(B.pelvis.pos, B.head.pos, spine);
  seg(B.head.pos, end('head', 0, -22), spine);
  for (const s2 of ['n', 'f']) {
    const up = B[s2 + 'Upper'], fo = B[s2 + 'Fore'];
    seg(up.pos, fo.pos, armC);
    seg(fo.pos, end(s2 + 'Fore', s2 === 'n' ? 0.5 : 2, 14), armC);
    const L = legs[s2];
    seg(L.hip, L.knee, legC); seg(L.knee, L.ankle, legC);
    seg(L.ankle, end(s2 + 'Foot', 10, 5.5), legC);
    dot(L.knee, '#fff'); dot(L.ankle, '#fff'); dot(L.hip, legC);
    dot(up.pos, armC); dot(fo.pos, '#fff');
  }
  seg(B.tail.pos, end('tail', -3, 20), '#ff9a3d');
  dot(B.pelvis.pos, '#ff5a5a', 3); dot(B.head.pos, spine);
  ctx.restore();
}

/** Ground contact points of each sole (model space) — used by QA to measure foot slide. */
export function soleContacts(meta, pose) {
  const { B } = solve(meta, pose);
  const out = {};
  for (const s of ['n', 'f']) {
    const b = B[s + 'Foot'];
    const pts = [HEEL_ART, TOE_ART].map(([x, y]) => {
      const [dx, dy] = rot(x - b.pivot[0], y - b.pivot[1], b.rot);
      return [b.pos[0] + dx, b.pos[1] + dy];
    });
    out[s] = { heel: pts[0], toe: pts[1] };
  }
  return out;
}
