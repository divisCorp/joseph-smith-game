/**
 * Palmyra Quest — painted cut-out skeletal rigs (no Spine: our own JSON format).
 *
 * Each character's ORIGINAL painting is cut into parts (tools/rig/cut_*.py) and
 * animated here on one shared humanoid bone hierarchy. Parts keep their painted
 * pixels and proportions; only bones move. Legs use 2-bone IK so planted feet stay
 * locked to the ground line while the hips travel.
 *
 * Model space = the character's source cell (Joseph: 64×128, x right, y down).
 * Poses are authored once against Joseph's skeleton; every value that is a length
 * is re-targeted per character through its `skel` (leg/arm length ratios, rest
 * ankles, foot geometry), so the same walk/jump keeps feet planted on everyone.
 */

const D2R = Math.PI / 180;
export const RIG_GROUND = 126;

// Joseph's skeleton (the reference every pose is authored against).
const JOS = {
  ground: 126,
  thigh: 24, shin: 20,
  hipN: [30.5, 76], hipF: [38, 76],
  restN: [26.5, 119.5], restF: [38, 119.5],
  ankleArt: [38, 119.5], heelArt: [34.5, 126], toeArt: [48.5, 126],
  hipArt: [37.5, 76], kneeArt: [37.5, 100],
  upperArm: 13, forearm: 17,
  nShoulder: [21, 50], fShoulder: [39.5, 52],
  farArmRest: -11, // far arm hangs slightly forward so its hand peeks past the far thigh
  phi: { thigh: 0, shin: 0, foot: 0, nUp: 0, nFo: 0, fUp: 0, fFo: 0 },
};
const JREST = { n: JOS.restN, f: JOS.restF };

// ------------------------------------------------------------------ loading
export function loadRig(base = 'assets/rig/', v = '', name = 'joseph') {
  const q = v ? `?v=${v}` : '';
  return Promise.all([
    fetch(`${base}${name}-rig.json${q}`).then((r) => r.json()),
    new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = `${base}${name}-rig.png${q}`;
    }),
  ]).then(([meta, img]) => ({ meta, img, name }));
}

/** Load the cast manifest + every rig in it. Resolves to { name: rig }. */
export function loadCast(base = 'assets/rig/', v = '') {
  const q = v ? `?v=${v}` : '';
  return fetch(`${base}cast.json${q}`)
    .then((r) => r.json())
    .then((cast) => Promise.all(cast.rigs.map((n) => loadRig(base, v, n).catch(() => null))))
    .then((list) => {
      const out = {};
      for (const r of list) if (r) out[r.name] = r;
      return out;
    });
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
const angDown = (a, b) => Math.atan2(-(b[0] - a[0]), b[1] - a[1]); // angle of a→b from straight down (+ = clockwise)

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

// ------------------------------------------------------------------ skeleton
/**
 * Derived skeleton for a rig (cached on meta). `legK`/`armK` scale Joseph-authored
 * lengths; `phi` are the painted angles of each limb segment (so a bent painted arm
 * still hangs straight at pose angle 0); heel/toe are expressed flat-footed.
 */
export function skelOf(meta) {
  if (!meta) return skelOf.jos || (skelOf.jos = derive({ joints: {}, skel: {} }));
  return meta._sk || (meta._sk = derive(meta));
}
function derive(meta) {
  const s = { ...JOS, ...(meta.skel || {}) };
  s.phi = { ...JOS.phi, ...((meta.skel || {}).phi || {}) };
  s.legK = (s.thigh + s.shin) / (JOS.thigh + JOS.shin);
  s.armK = (s.upperArm + s.forearm) / (JOS.upperArm + JOS.forearm);
  const pf = s.phi.foot * D2R;
  s.heelFlat = rot(s.heelArt[0] - s.ankleArt[0], s.heelArt[1] - s.ankleArt[1], -pf);
  s.toeFlat = rot(s.toeArt[0] - s.ankleArt[0], s.toeArt[1] - s.ankleArt[1], -pf);
  s.ankleY = s.ground - (s.heelFlat[1] + s.toeFlat[1]) / 2;
  s.restN = [s.restN[0], s.ankleY];
  s.restF = [s.restF[0], s.ankleY];
  return s;
}
/** Joseph-space ankle target → this skeleton (relative to each leg's rest ankle, scaled by leg length). */
function foot(sk, side, x, y) {
  const J = JREST[side], R = side === 'n' ? sk.restN : sk.restF;
  return [R[0] + (x - J[0]) * sk.legK, R[1] + (y - J[1]) * sk.legK];
}
/** Joseph-space hand target (torso rest space) → this skeleton (relative to the shoulder). */
function hand(sk, side, x, y) {
  const J = side === 'n' ? JOS.nShoulder : JOS.fShoulder;
  const S = side === 'n' ? sk.nShoulder : sk.fShoulder;
  return [S[0] + (x - J[0]) * sk.armK, S[1] + (y - J[1]) * sk.armK];
}
/** Model px travelled per walk cycle for this skeleton (move the body this far per phase unit). */
export function strideLen(sk, P) {
  return P.cycle * sk.legK;
}

// ------------------------------------------------------------------ poses
/** A neutral pose: every value is an offset from the painted idle frame. */
export function basePose(sk = skelOf()) {
  return {
    rootX: 0, rootY: 0, // whole-body offset (airborne height etc.)
    pelvisDx: 0, pelvisDy: 0, pelvisRot: 0,
    torsoRot: 0, torsoDy: 0,
    headRot: 0, headDy: 0,
    nArm: 0, nFore: 0, fArm: 0, fFore: 0,
    skirt: 0, tail: 0, coatFar: 0,
    skirtBend: 0, tailBend: 0, // slice-deform (secondary motion) of cloth parts, degrees at the hem
    // ankle targets (model space, before rootX/rootY) and world foot angle (deg, + = toe down)
    nFoot: [...sk.restN], nFootRot: 0,
    fFoot: [...sk.restF], fFootRot: 0,
  };
}

/** Idle: breathing, a slight lagging head bob, coat-tail sway. t in seconds. */
export function poseIdle(t, sk = skelOf(), seed = 0) {
  const p = basePose(sk);
  const w = (Math.PI * 2) / (3.4 + seed * 0.37);
  t += seed * 1.7;
  const b = Math.sin(w * t); // breath
  p.torsoDy = -0.45 * (b + 1);
  p.torsoRot = 0.5 * b;
  p.headDy = -0.25 * (Math.sin(w * t - 0.7) + 1);
  p.headRot = 0.9 * Math.sin(w * t - 0.9);
  p.nArm = 1.4 * Math.sin(w * t - 0.5);
  p.nFore = -1.5 - 1.2 * Math.sin(w * t - 0.9);
  p.fArm = -1.0 * Math.sin(w * t - 0.4);
  p.fFore = -1.0 - 0.8 * Math.sin(w * t - 0.8);
  p.tail = 1.2 * Math.sin(w * 0.8 * t - 1.2) + 0.4 * Math.sin(w * 2.3 * t);
  p.tailBend = 1.6 * Math.sin(w * 0.8 * t - 1.9);
  p.skirt = 0.35 * Math.sin(w * t - 1.0);
  p.skirtBend = 1.0 * Math.sin(w * 0.8 * t - 1.6);
  p.coatFar = 0.6 * Math.sin(w * t - 1.1);
  return p;
}

/**
 * Locomotion cycle. phase in [0,1): 0 = near-foot contact, 0.5 = far-foot contact.
 * Feet are procedural so the stance foot moves backwards exactly one stride per
 * cycle: when the body travels strideLen() per phase-unit the planted foot never slides.
 *   cycle — stride length (Joseph model px per full cycle)
 *   duty  — fraction of the cycle a foot is planted (>0.5 walk, <0.5 run: flight phase)
 *   fly   — hip rise during the flight phase (run only)
 */
export const WALK = { cycle: 62, duty: 0.58, lift: 6, lean: 3, arm: 16, bob: 1.0, fwd: 0, fly: 0, knee: 0 };
// Run tuned against the in-game top speed (≈212 model px/s): 140 px stride → ≈3.0 steps/s
export const RUN = { cycle: 140, duty: 0.34, lift: 15, lean: 8, arm: 34, bob: 1.2, fwd: 4, fly: 3.2, knee: 3 };
export const JOG = RUN; // legacy name

const walkPelvis = track([[0, 2.2], [0.1, 3.2], [0.25, 1.2], [0.38, 0.4], [0.5, 2.2], [0.6, 3.2], [0.75, 1.2], [0.88, 0.4]], true);
const walkTorso = track([[0, 0.4], [0.1, 1.0], [0.25, 0], [0.38, -0.6], [0.5, 0.4], [0.6, 1.0], [0.75, 0], [0.88, -0.6]], true);
const walkTail = track([[0, 1], [0.15, -1.2], [0.3, -0.4], [0.42, 1.4], [0.5, 1], [0.65, -1.2], [0.8, -0.4], [0.92, 1.4]], true);

function footAt(sk, u, P, hipX, out) {
  // returns [ankleX, ankleY, footRot] for a leg at its own phase u (0 = contact)
  const k = sk.legK;
  const D = P.duty;
  const S = P.cycle * k * D; // distance the stance foot travels back
  const front = hipX + S / 2 + P.fwd * k;
  const stanceAnkle = (s) => {
    const x = front - s * S; // flat-foot ankle x, locked to the ground
    let r = 0;
    if (s < 0.14) r = -14 * (1 - smooth(s / 0.14)); // heel strike, toe comes down
    else if (s > 0.64) r = 24 * smooth((s - 0.64) / 0.36); // heel lifts, rolls over toe
    return planted(sk, x, r);
  };
  if (u < D) {
    const [x, y, r] = stanceAnkle(u / D);
    out[0] = x; out[1] = y; out[2] = r;
    return out;
  }
  const s = (u - D) / (1 - D);
  const [x0, y0] = stanceAnkle(1);
  const [x1, y1] = planted(sk, front, -14);
  const e = s < 0.5 ? 2 * s * s : 1 - 2 * (1 - s) * (1 - s); // ease in-out
  const lift = P.lift * k * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), 1.1);
  out[0] = lerp(x0, x1, e);
  out[1] = lerp(y0, y1, e) - lift;
  out[2] = s < 0.35 ? lerp(24, 6, smooth(s / 0.35)) : lerp(6, -14, smooth((s - 0.35) / 0.65));
  return out;
}

/** Flat-foot ankle position x on the ground, rotated `r` degrees about heel (r<0) or toe (r>0). */
function planted(sk, ankleX, r) {
  if (!r) return [ankleX, sk.ankleY, 0];
  const piv = r < 0 ? sk.heelFlat : sk.toeFlat;
  const pw = [ankleX + piv[0], sk.ground];
  const d = rot(-piv[0], -piv[1], r * D2R);
  return [pw[0] + d[0], pw[1] + d[1], r];
}

/** Lower the hips only as much as needed so planted feet stay reachable. */
function keepReach(sk, p, legs, slack = 0.6) {
  const reach = sk.thigh + sk.shin - slack;
  for (const [hip, ft] of legs) {
    const dx = ft[0] - (hip[0] + p.pelvisDx);
    const maxHipY = ft[1] - Math.sqrt(Math.max(0, reach * reach - dx * dx));
    if (hip[1] + p.pelvisDy < maxHipY) p.pelvisDy = maxHipY - hip[1];
  }
}

export function poseWalk(phase, P = WALK, sk = skelOf()) {
  const p = basePose(sk);
  const k = sk.legK;
  const ph = wrap(phase);
  const n = footAt(sk, wrap(ph), P, sk.hipN[0], [0, 0, 0]);
  const f = footAt(sk, wrap(ph - 0.5), P, sk.hipF[0], [0, 0, 0]);
  p.nFoot = [n[0], n[1]]; p.nFootRot = n[2];
  p.fFoot = [f[0], f[1]]; p.fFootRot = f[2];
  p.pelvisDy = (1.2 + walkPelvis(ph) * P.bob + (P.knee || 0)) * k;
  if (P.fly) {
    // flight: both feet are up, the hips float
    const fl = (u) => (u >= P.duty && u < 0.5 ? Math.sin((Math.PI * (u - P.duty)) / (0.5 - P.duty)) : 0);
    p.pelvisDy -= P.fly * k * (fl(ph) + fl(wrap(ph - 0.5)));
  }
  p.torsoRot = P.lean + walkTorso(ph) * (P.lean / 3.5);
  p.headRot = -0.7 * (p.torsoRot - P.lean) - P.lean * 0.55; // head stays level-ish
  const sw = Math.cos(Math.PI * 2 * (ph - 0.05));
  p.nArm = 3 + P.arm * sw; // near arm back while near leg is forward
  p.fArm = 1 - P.arm * 0.8 * sw;
  const bend = 16 + Math.max(0, P.arm - 16) * 1.4;
  p.nFore = -6 - bend * Math.max(0, -sw) - 3 * Math.max(0, sw) - (P.arm > 20 ? 18 : 0);
  p.fFore = -6 - bend * Math.max(0, sw) - 3 * Math.max(0, -sw) - (P.arm > 20 ? 18 : 0);
  p.tail = 3 + (P.lean - 3.5) * 0.6 + walkTail(ph) * 2.2;
  // cloth secondary motion: hem lags the legs by ~1/8 cycle
  p.tailBend = 4 + P.lean * 0.6 + 4.5 * Math.sin(Math.PI * 4 * (ph - 0.16));
  p.skirt = 0.9 * Math.sin(Math.PI * 4 * (ph - 0.1));
  p.skirtBend = 2.5 * Math.sin(Math.PI * 4 * (ph - 0.2)) + P.lean * 0.3;
  p.coatFar = -1.5 * sw;
  keepReach(sk, p, [[sk.hipN, n, wrap(ph) < P.duty], [sk.hipF, f, wrap(ph - 0.5) < P.duty]].filter((l) => l[2]));
  return p;
}

/** Blend walk → run parameters by speed (0..1). */
export function gaitParams(k) {
  const o = {};
  const t = clamp(k, 0, 1);
  for (const key in WALK) o[key] = lerp(WALK[key], RUN[key], t);
  return o;
}

/**
 * Jump timeline (seconds, 1.2 s total). Ground keys keep the feet planted on the
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
export function poseJump(t, air = null, sk = skelOf()) {
  const p = basePose(sk);
  const v = JTRACKS.map((f) => f(t));
  [p.pelvisDy, p.torsoRot, p.headRot, p.nArm, p.nFore, p.fArm, p.fFore, p.tail, p.skirt] = v;
  p.pelvisDy *= sk.legK;
  p.nFoot = foot(sk, 'n', v[9], v[10]); p.nFootRot = v[11];
  p.fFoot = foot(sk, 'f', v[12], v[13]); p.fFootRot = v[14];
  p.rootY = air == null ? jumpHeight(t) : air;
  p.coatFar = -0.4 * p.tail;
  p.tailBend = 1.2 * p.tail;
  p.skirtBend = -2 * p.skirt;
  // grounded keys: never let a planted foot be pulled off the ground by the hips
  if (t < JUMP_T.leave || t >= JUMP_T.touch) keepReach(sk, p, [[sk.hipN, p.nFoot], [sk.hipF, p.fFoot]], 0.4);
  return p;
}

/** Kneel in prayer: near knee on the ground, far foot planted ahead, palms together, head bowed. */
export function poseKneel(t = 0, sk = skelOf()) {
  const p = basePose(sk);
  p.pelvisDx = -6 * sk.legK;
  p.pelvisDy = 21 * sk.legK;
  p.torsoRot = -3;
  p.torsoDy = -0.35 * (Math.sin(t * 1.7) + 1); // slow, calm breathing
  p.headRot = 14 + 0.8 * Math.sin(t * 1.7 - 0.8);
  p.nArm = -24; p.nFore = -106;
  p.fArm = -2; p.fFore = -124;
  p.nHand = hand(sk, 'n', 41.5, 56); p.fHand = hand(sk, 'f', 42.5, 55.5); // wrists together in front of the chest
  p.pray = 1; // open, flat praying hands replace the fists
  p.tail = 20; p.skirt = -5; p.coatFar = -8;
  p.tailBend = 10; p.skirtBend = 6; // coat folds over the heel
  p.nFoot = foot(sk, 'n', 8, 117.5); p.nFootRot = 64;
  p.fFoot = foot(sk, 'f', 47, 119.5); p.fFootRot = 0;
  p.kneelOrder = 1;
  return p;
}

/** Blend from any standing pose into the kneel; the feet lift as they step so nothing slides. */
export function kneelFrom(from, k, t = 0, sk = skelOf()) {
  const o = blendPose(from, poseKneel(t, sk), k);
  o.handK = smooth(clamp((k - 0.25) / 0.75, 0, 1));
  o.pray = o.handK > 0.7 ? 1 : 0;
  const lift = Math.sin(Math.PI * clamp(k, 0, 1));
  o.nFoot[1] -= 5 * lift * sk.legK;
  o.fFoot[1] -= 7 * lift * sk.legK;
  return o;
}

// ---- upper-body actions layered over any base pose (u = 0..1 progress) ----
const throwArm = track([[0, -40], [0.12, -96], [0.32, -104], [0.62, -70], [1, -8]]);
const throwFore = track([[0, -70], [0.12, -8], [0.32, 0], [0.62, -14], [1, -6]]);
const throwLean = track([[0, -2], [0.14, 8], [0.4, 7], [1, 1]]);
/** Plate throw (near arm): whip forward at chest height, release, follow through. */
export function applyThrow(base, u) {
  const p = { ...base, nHand: undefined, fHand: undefined, pray: 0 };
  const k = Math.min(1, u / 0.08, (1 - u) / 0.3); // fade into/out of the base pose
  const w = clamp(k, 0, 1);
  p.nArm = lerp(base.nArm, throwArm(u), w);
  p.nFore = lerp(base.nFore, throwFore(u), w);
  p.fArm = lerp(base.fArm, 22, w * 0.8);
  p.fFore = lerp(base.fFore, -24, w * 0.8);
  p.torsoRot = base.torsoRot + throwLean(u) * w;
  p.headRot = base.headRot - throwLean(u) * 0.5 * w;
  p.tailBend = (base.tailBend || 0) + 4 * w;
  return p;
}
/** Pitchfork thrust (far arm drives the fork forward, body leans in). */
export function applyThrust(base, u = 1) {
  return { ...base, fArm: -80, fFore: -6, nArm: 16, nFore: -10, torsoRot: base.torsoRot + 5, fHand: undefined, nHand: undefined, pray: 0 };
}
/** Melee wind-up (k 0..1): lean back, striking arm cocked. arm 'n' or 'f'. */
export function applyWind(base, k, arm = 'f', style = 'punch') {
  const p = { ...base };
  const a = smooth(clamp(k, 0, 1));
  p.torsoRot = base.torsoRot - 7 * a;
  p.headRot = base.headRot + 3 * a;
  if (style === 'club') {
    p[arm + 'Arm'] = lerp(base[arm + 'Arm'], 165, a); // club raised high over the head
    p[arm + 'Fore'] = lerp(base[arm + 'Fore'], -95, a);
  } else if (style === 'shove') {
    p.nArm = lerp(base.nArm, -38, a); p.nFore = lerp(base.nFore, -52, a);
    p.fArm = lerp(base.fArm, -28, a); p.fFore = lerp(base.fFore, -60, a);
  } else {
    p[arm + 'Arm'] = lerp(base[arm + 'Arm'], 46, a);
    p[arm + 'Fore'] = lerp(base[arm + 'Fore'], -96, a);
  }
  const o = arm === 'f' ? 'n' : 'f';
  if (style !== 'shove') { p[o + 'Arm'] = lerp(base[o + 'Arm'], -26, a); p[o + 'Fore'] = lerp(base[o + 'Fore'], -30, a); }
  p.tailBend = (base.tailBend || 0) - 3 * a;
  return p;
}
/** Melee strike (k 0..1 of the lunge): body drives forward, arm extends / club swings down. */
export function applyStrike(base, k, arm = 'f', style = 'punch') {
  const p = { ...base };
  const a = smooth(clamp(k, 0, 1));
  p.torsoRot = base.torsoRot + 9;
  p.headRot = base.headRot - 4;
  if (style === 'club') {
    p[arm + 'Arm'] = lerp(165, -70, a);
    p[arm + 'Fore'] = lerp(-95, -6, a);
  } else if (style === 'shove') {
    // musket held level in both hands, butt pushed forward (it is never fired)
    p.nArm = -78; p.nFore = -20; p.fArm = -70; p.fFore = -24;
  } else {
    p[arm + 'Arm'] = -84; p[arm + 'Fore'] = -6;
  }
  const o = arm === 'f' ? 'n' : 'f';
  if (style !== 'shove') { p[o + 'Arm'] = 30; p[o + 'Fore'] = -24; }
  p.tailBend = (base.tailBend || 0) + 5;
  return p;
}
/** Preacher's speaking gesture: open palm lifted and turned, chin up, weight shifts. */
export function applySpeak(base, t, arm = 'f') {
  const p = { ...base };
  const w = Math.sin(t * 2.1), w2 = Math.sin(t * 1.05 + 0.6);
  p[arm + 'Arm'] = -58 + 14 * w2;
  p[arm + 'Fore'] = -62 + 18 * w;
  p.headRot = base.headRot - 3 - 2 * w2;
  p.torsoRot = base.torsoRot + 1.5 * w2;
  return p;
}
/** Hand raised in greeting (angel Moroni). */
export function applyGreet(base, k, arm = 'f') {
  const p = { ...base };
  const a = smooth(clamp(k, 0, 1));
  p[arm + 'Arm'] = lerp(base[arm + 'Arm'], -36, a);
  p[arm + 'Fore'] = lerp(base[arm + 'Fore'], -118, a);
  p.headRot = base.headRot - 2 * a;
  return p;
}
/**
 * Bracing a door (Carthage): weight forward over a staggered stance, both palms
 * pressed forward at chest height. k eases in; push (0..1) adds rhythmic heaves.
 */
export function applyBrace(base, k, push = 0, t = 0, sk = null) {
  const p = { ...base };
  const a = smooth(clamp(k, 0, 1));
  const heave = push * (0.5 + 0.5 * Math.sin(t * 7.5));
  p.torsoRot = base.torsoRot + (13 + 4 * heave) * a;
  p.headRot = base.headRot - (7 + 2 * heave) * a;
  p.pelvisDx = (base.pelvisDx || 0) + (3 + 1.5 * heave) * a;
  p.pelvisDy = (base.pelvisDy || 0) + 2.2 * a;
  p.fArm = lerp(base.fArm, -74 - 6 * heave, a);
  p.fFore = lerp(base.fFore, -34 + 10 * heave, a);
  p.nArm = lerp(base.nArm, -66 - 6 * heave, a);
  p.nFore = lerp(base.nFore, -40 + 10 * heave, a);
  if (sk) {
    // front (far) foot a little forward, back (near) foot pushed back, heel lifted
    p.fFoot = [lerp(base.fFoot[0], sk.restF[0] + 5, a), base.fFoot[1]];
    p.nFoot = [lerp(base.nFoot[0], sk.restN[0] - 13, a), lerp(base.nFoot[1], sk.restN[1] - 1.5, a)];
    p.nFootRot = lerp(base.nFootRot || 0, 22, a);
  }
  p.tailBend = (base.tailBend || 0) - 4 * a;
  p.tail = (base.tail || 0) - 3 * a;
  return p;
}
/** Torch held up and forward in the far hand. */
export function applyHold(base, arm = 'f', up = -62, fore = -50) {
  return { ...base, [arm + 'Arm']: up + base[arm + 'Arm'] * 0.15, [arm + 'Fore']: fore };
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
    if (key === 'pray') { o[key] = k < 0.5 ? va || 0 : vb || 0; continue; }
    if (va === undefined) va = vb;
    if (vb === undefined) vb = va;
    o[key] = Array.isArray(va) ? [lerp(va[0], vb[0], k), lerp(va[1], vb[1], k)] : lerp(va, vb, k);
  }
  return o;
}

// ------------------------------------------------------------------ solve
/** Generic 2-bone solve; side = -1 bends the joint forward (knees), +1 keeps it low/back (elbows). */
function twoBone(root, target, l1, l2, side) {
  const dx = target[0] - root[0], dy = target[1] - root[1];
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.001);
  const base = Math.atan2(-dx, dy);
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const b = Math.acos(clamp((l2 * l2 + d * d - l1 * l1) / (2 * l2 * d), -1, 1));
  return { a: base + side * a, b: base - side * b };
}
function ik(sk, hip, target) {
  const T = sk.thigh, S = sk.shin;
  const dx = target[0] - hip[0], dy = target[1] - hip[1];
  let d = Math.hypot(dx, dy);
  d = clamp(d, Math.abs(T - S) + 0.5, T + S - 0.001);
  const base = Math.atan2(-dx, dy); // angle from straight down (+ = clockwise)
  const a = Math.acos(clamp((T * T + d * d - S * S) / (2 * T * d), -1, 1));
  const b = Math.acos(clamp((S * S + d * d - T * T) / (2 * S * d), -1, 1));
  const thigh = base - a; // knee bends forward (+x)
  const shin = base + b;
  const knee = [hip[0] - Math.sin(thigh) * T, hip[1] + Math.cos(thigh) * T];
  const ankle = [knee[0] - Math.sin(shin) * S, knee[1] + Math.cos(shin) * S];
  return { thigh, shin, knee, ankle };
}

export const DRAW_ORDER = [
  'coatFar', 'fShin', 'fFoot', 'fThigh', 'fUpper', 'fFore', 'fProp', 'pelvis',
  'nShin', 'nFoot', 'nThigh', 'torso', 'skirt', 'tail', 'head', 'nUpper', 'nFore', 'prayHands', 'nProp',
];

/** Resolve a pose into world transforms (model space) for every part + joints. B[x].rot = art rotation. */
export function solve(meta, pose) {
  const sk = skelOf(meta);
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
  const ph = sk.phi;
  for (const s of ['n', 'f']) {
    const sh = J[s + 'Shoulder'], el = J[s + 'Elbow'];
    // rest: the arm's natural hang for this character (cast rigs: the painted pose)
    const ar = sk.armRest || {};
    const rest = (ar[s + 'Up'] ?? 0) + (s === 'f' ? sk.farArmRest : 0);
    const restF = ar[s + 'Fo'] ?? 0;
    const cu = -ph[s + 'Up'] * D2R, cf = -(ph[s + 'Fo'] - ph[s + 'Up']) * D2R; // painted-angle corrections
    let up = (pose[s + 'Arm'] + rest) * D2R, fo = (pose[s + 'Fore'] + restF) * D2R;
    const tgt = pose[s + 'Hand'];
    if (tgt) {
      // optional hand target in torso rest space → 2-bone arm IK, elbow kept low
      const T = B.torso;
      const [tx, ty] = rot(tgt[0] - T.pivot[0], tgt[1] - T.pivot[1], T.rot);
      const [sx, sy] = rot(sh[0] - T.pivot[0], sh[1] - T.pivot[1], T.rot);
      const S = [T.pos[0] + sx, T.pos[1] + sy], H = [T.pos[0] + tx, T.pos[1] + ty];
      const sol = twoBone(S, H, sk.upperArm, sk.forearm, 1);
      const k = pose.handK ?? 1;
      up = lerp(up, sol.a - T.rot, k);
      fo = lerp(fo, sol.b - sol.a, k);
    }
    B[s + 'Upper'] = at('torso', sh, 0, 0, up + cu);
    B[s + 'Fore'] = at(s + 'Upper', el, 0, 0, fo + cf);
  }
  if (J.skirt) B.skirt = at('pelvis', J.skirt, 0, 0, pose.skirt * D2R);
  if (J.tail) B.tail = at(J.skirt ? 'skirt' : 'pelvis', J.tail, 0, 0, pose.tail * D2R);
  if (J.coatFar) B.coatFar = at('pelvis', J.coatFar, 0, 0, pose.coatFar * D2R);
  const legs = {};
  for (const [s, hipRest, ft, fr] of [['n', sk.hipN, pose.nFoot, pose.nFootRot], ['f', sk.hipF, pose.fFoot, pose.fFootRot]]) {
    const hp = at('pelvis', hipRest, 0, 0, 0).pos;
    const L = ik(sk, hp, [ft[0] + ox, ft[1] + oy]);
    legs[s] = { hip: hp, ...L, footRot: fr * D2R };
    B[s + 'Thigh'] = { pos: hp, rot: L.thigh - ph.thigh * D2R, pivot: sk.hipArt };
    B[s + 'Shin'] = { pos: L.knee, rot: L.shin - ph.shin * D2R, pivot: sk.kneeArt };
    B[s + 'Foot'] = { pos: L.ankle, rot: (fr - ph.foot) * D2R, pivot: sk.ankleArt };
  }
  return { B, legs };
}

/** World position (model space) of an art-space point carried by a solved part. */
export function partPoint(meta, B, name, pt) {
  const part = meta.parts[name], b = B[name];
  if (!part || !b || !pt) return null;
  const [dx, dy] = rot(pt[0] - part.pivot[0], pt[1] - part.pivot[1], b.rot);
  return [b.pos[0] + dx, b.pos[1] + dy];
}
/** Where a hand grips (model space) — props ride here. side 'n' | 'f'. */
export function handPoint(meta, B, side) {
  const part = meta.parts[side + 'Fore'];
  if (!part) return null;
  return partPoint(meta, B, side + 'Fore', part.hand || part.pivot);
}

// ------------------------------------------------------------------ draw
let SCRATCH = null;
function scratch(w, h) {
  if (!SCRATCH) {
    SCRATCH = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
    SCRATCH.ctx = SCRATCH.getContext('2d', { willReadFrequently: true });
  }
  if (SCRATCH.width < w || SCRATCH.height < h) {
    SCRATCH.width = Math.max(SCRATCH.width, w);
    SCRATCH.height = Math.max(SCRATCH.height, h);
    SCRATCH.ctx = SCRATCH.getContext('2d', { willReadFrequently: true });
  }
  return SCRATCH;
}
const PAD = 48;
let RIM = null;
function rimScratch(w, h) {
  if (!RIM || RIM.width < w || RIM.height < h) {
    RIM = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
    RIM.width = w; RIM.height = h;
    RIM.ctx = RIM.getContext('2d', { willReadFrequently: true });
  }
  return RIM;
}

/** Draw one part into a model-space context (handles slice-deformed cloth). */
function drawPart(g, img, part, b, up, bend) {
  g.save();
  g.translate(b.pos[0], b.pos[1]);
  if (b.rot) g.rotate(b.rot);
  if (!part.flex || !bend) {
    g.translate(-part.pivot[0], -part.pivot[1]);
    g.drawImage(img, part.x, part.y, part.w, part.h, part.ox, part.oy, part.w / up, part.h / up);
    g.restore();
    return;
  }
  // cloth below the pivot sways progressively toward the hem (secondary motion):
  // a per-row shear (quadratic toward the hem), so the cloth never opens gaps
  const px = part.pivot[0], py = part.pivot[1];
  const top = part.oy, bot = part.oy + part.h / up;
  const len = Math.max(1, bot - py);
  const amp = -Math.sin(bend * D2R) * len;
  g.translate(-px, -py);
  if (py > top) {
    const hh = Math.min(bot, py) - top;
    g.drawImage(img, part.x, part.y, part.w, hh * up, part.ox, top, part.w / up, hh);
  }
  const step = 1;
  for (let y0 = Math.max(top, py); y0 < bot; y0 += step) {
    const y1 = Math.min(bot, y0 + step);
    const u = (y0 + 0.5 * step - py) / len;
    const dx = amp * u * u;
    const sy = (y0 - top) * up;
    const hh = Math.min(bot - y0, y1 - y0 + 1); // 1 row of overlap: no seams when smoothed
    g.drawImage(img, part.x, part.y + sy, part.w, hh * up, part.ox + dx, y0, part.w / up, hh);
  }
  g.restore();
}

function drawParts(g, rig, pose, B) {
  const { meta, img } = rig;
  const up = meta.scale;
  let order = meta.order || DRAW_ORDER;
  if ((pose.kneelOrder || 0) > 0.5) {
    // kneeling: the planted shin lies on the ground in front of the coat hem, so the
    // knee and shin read clearly instead of vanishing under the skirt
    order = order.filter((n) => n !== 'nShin' && n !== 'nFoot');
    const i = order.indexOf('tail');
    order.splice(i + 1, 0, 'nFoot', 'nShin');
  }
  const pray = pose.pray && meta.parts.prayHands;
  for (const name of order) {
    let part = meta.parts[name];
    let b = B[name];
    if (name === 'prayHands') {
      if (!pray) continue;
      // palms together, centred between both wrists, fingers tilted up and forward
      const wn = partPoint(meta, B, 'nFore', meta.parts.nFore.wrist);
      const wf = partPoint(meta, B, 'fFore', meta.parts.fFore.wrist);
      if (!wn || !wf) continue;
      b = { pos: [(wn[0] + wf[0]) / 2, (wn[1] + wf[1]) / 2], rot: B.torso.rot + 14 * D2R };
    } else if (pray && (name === 'nFore' || name === 'fFore') && meta.parts[name + 'Open']) {
      part = meta.parts[name + 'Open'];
    }
    if (!part || !b) continue;
    const bend = name === 'tail' ? pose.tailBend : name === 'skirt' ? pose.skirtBend : 0;
    drawPart(g, img, part, b, up, bend || 0);
  }
}

/**
 * Draw the rig. opts: x, y = screen position of the model origin (cell top-left),
 * scale (screen px per model px), flip (face left), bones (debug overlay),
 * crisp (default true: composite at 1 model px per pixel, hard alpha, nearest blit —
 * the same pixel crispness as the original sprite), filter (e.g. hurt flash), alpha.
 */
export function drawRig(ctx, rig, pose, opts = {}) {
  const { meta } = rig;
  const s = opts.scale ?? 1;
  const crisp = opts.crisp !== false;
  const cw = meta.cell[0], ch = meta.cell[1];
  if (!crisp) {
    const { B, legs } = solve(meta, pose);
    ctx.save();
    ctx.translate(opts.x ?? 0, opts.y ?? 0);
    if (opts.flip) { ctx.translate(cw * s, 0); ctx.scale(-1, 1); }
    ctx.scale(s, s);
    if (opts.filter) ctx.filter = opts.filter;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawParts(ctx, rig, pose, B);
    ctx.filter = 'none';
    if (opts.bones) drawBones(ctx, B, legs, s, meta);
    ctx.restore();
    return { B, legs };
  }
  // integer part of the root offset moves the blit; only the fraction is resampled
  const ix = Math.floor(pose.rootX), iy = Math.floor(pose.rootY);
  const lp = { ...pose, rootX: pose.rootX - ix, rootY: pose.rootY - iy };
  const { B, legs } = solve(meta, lp);
  const W = cw + PAD * 2, H = ch + PAD * 2;
  const sc = scratch(W, H);
  const g = sc.ctx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.translate(PAD, PAD);
  drawParts(g, rig, lp, B);
  g.setTransform(1, 0, 0, 1, 0, 0);
  // hard alpha like the painted sprite (no soft fringes, no part seams)
  const id = g.getImageData(0, 0, W, H);
  const d = id.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 110 ? 255 : 0;
  if (opts.rim) {
    // 1px rim around chosen parts where they border empty space (e.g. Moroni's raised
    // hand against his glow): draw those parts alone, then darken the ring outside them
    const r2 = rimScratch(W, H);
    const h2 = r2.ctx;
    h2.setTransform(1, 0, 0, 1, 0, 0);
    h2.clearRect(0, 0, W, H);
    h2.imageSmoothingEnabled = true;
    h2.translate(PAD, PAD);
    const only = { ...rig, meta: { ...meta, order: (meta.order || DRAW_ORDER).filter((n) => opts.rim.parts.includes(n)) } };
    drawParts(h2, only, lp, B);
    const m = h2.getImageData(0, 0, W, H).data;
    const [rr, rg, rb] = opts.rim.color;
    const near = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m[(y * W + x) * 4 + 3] >= 110;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (d[i + 3]) continue;
        if (near(x + 1, y) || near(x - 1, y) || near(x, y + 1) || near(x, y - 1)) {
          d[i] = rr; d[i + 1] = rg; d[i + 2] = rb; d[i + 3] = 255;
        }
      }
    }
  }
  g.putImageData(id, 0, 0);
  ctx.save();
  ctx.translate(opts.x ?? 0, opts.y ?? 0);
  if (opts.flip) { ctx.translate(cw * s, 0); ctx.scale(-1, 1); }
  if (opts.filter) ctx.filter = opts.filter;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sc, 0, 0, W, H, (ix - PAD) * s, (iy - PAD) * s, W * s, H * s);
  ctx.filter = 'none';
  if (opts.bones) {
    ctx.translate(ix * s, iy * s);
    ctx.scale(s, s);
    drawBones(ctx, B, legs, s, meta);
  }
  ctx.restore();
  // report bones in the caller's frame (root offset re-applied)
  for (const k in B) B[k] = { ...B[k], pos: [B[k].pos[0] + ix, B[k].pos[1] + iy] };
  return { B, legs };
}

function drawBones(ctx, B, legs, s, meta) {
  const lw = 1.6 / s;
  const seg = (a, b, col) => {
    if (!a || !b) return;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw * 1.6;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  };
  const dot = (p, col, r = 2.2) => {
    if (!p) return;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(p[0], p[1], (r / s) * 1.6, 0, Math.PI * 2); ctx.fill();
  };
  ctx.save();
  ctx.globalAlpha = 0.9;
  const spine = '#ffd34d', armC = '#5ad1ff', legC = '#7dff8a';
  seg(B.pelvis.pos, B.head.pos, spine);
  const top = partPoint(meta, B, 'head', [meta.joints.neck[0], meta.joints.neck[1] - 22]);
  seg(B.head.pos, top, spine);
  for (const s2 of ['n', 'f']) {
    const up = B[s2 + 'Upper'], fo = B[s2 + 'Fore'];
    seg(up.pos, fo.pos, armC);
    seg(fo.pos, handPoint(meta, B, s2), armC);
    const L = legs[s2];
    seg(L.hip, L.knee, legC); seg(L.knee, L.ankle, legC);
    const sk = skelOf(meta);
    seg(L.ankle, partPoint(meta, B, s2 + 'Foot', sk.toeArt), legC);
    dot(L.knee, '#fff'); dot(L.ankle, '#fff'); dot(L.hip, legC);
    dot(up.pos, armC); dot(fo.pos, '#fff');
  }
  if (B.tail && meta.parts.tail) seg(B.tail.pos, partPoint(meta, B, 'tail', [meta.joints.tail[0] - 3, meta.joints.tail[1] + 20]), '#ff9a3d');
  dot(B.pelvis.pos, '#ff5a5a', 3); dot(B.head.pos, spine);
  ctx.restore();
}

/** Ground contact points of each sole (model space) — used by QA to measure foot slide. */
export function soleContacts(meta, pose) {
  const sk = skelOf(meta);
  const { B } = solve(meta, pose);
  const out = {};
  for (const s of ['n', 'f']) {
    const b = B[s + 'Foot'];
    const pts = [sk.heelArt, sk.toeArt].map(([x, y]) => {
      const [dx, dy] = rot(x - b.pivot[0], y - b.pivot[1], b.rot);
      return [b.pos[0] + dx, b.pos[1] + dy];
    });
    out[s] = { heel: pts[0], toe: pts[1] };
  }
  return out;
}
