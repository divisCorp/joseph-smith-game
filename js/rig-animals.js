/**
 * Painted wildlife rigs (?rig=1 and rig-preview.html): timber rattlesnake, bobcat,
 * American black bear, American crow and great horned owl. Parts are painted in the
 * cast's style by tools/rig/paint_animals.py (assets/rig/animals.png/json) and posed
 * here with our own small skeletons:
 *  - snake: the painted body strip is laid column by column along a spine curve
 *    (arc length preserved: slither, coil, strike), with head, tongue and rattle;
 *  - bobcat / bear: quadruped legs with 2-bone IK and planted feet (each foot stays
 *    put on the ground while it bears weight), crouch/pounce and rear/swipe;
 *  - crow / owl: two-segment wings (flap, glide, swoop), head, tail, talons.
 * Animals are driven off, never hurt; no gore anywhere.
 */
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const wrap = (v) => ((v % 1) + 1) % 1;
const angDown = (a, b) => Math.atan2(-(b[0] - a[0]), b[1] - a[1]);

let RIG = null;
let loading = null;
export function loadAnimals(base = 'assets/rig/', v = '73') {
  if (!loading) {
    loading = Promise.all([
      fetch(`${base}animals.json?v=${v}`).then((r) => r.json()),
      new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = `${base}animals.png?v=${v}`; }),
    ]).then(([meta, img]) => (RIG = { meta, img })).catch(() => null);
  }
  return loading;
}
export const animalRig = () => RIG;

// --------------------------------------------------------------------- species
/** gameK = model px → game px before the critter's drawScale (cast density). */
export const ANIMALS = {
  snake: { label: 'Timber rattlesnake', anims: ['idle', 'move', 'attack'], drawScale: 1, box: [40, 14], kind: 'snake' },
  bobcat: { label: 'Bobcat', anims: ['idle', 'move', 'attack'], drawScale: 0.8, box: [32, 24], kind: 'quad' },
  bear: { label: 'American black bear', anims: ['idle', 'move', 'attack'], drawScale: 0.85, box: [46, 36], kind: 'quad' },
  crow: { label: 'American crow', anims: ['idle', 'move', 'glide', 'attack'], drawScale: 1, box: [24, 16], kind: 'bird', fly: true },
  owl: { label: 'Great horned owl', anims: ['idle', 'move', 'glide', 'attack'], drawScale: 1, box: [26, 20], kind: 'bird', fly: true },
};
export const ANIMAL_ANIM_LABEL = { idle: 'Idle', move: 'Move', glide: 'Glide', attack: 'Attack' };
export const ANIMAL_ANIM_DUR = { idle: 4, move: 2, glide: 3, attack: 2 };

// quadruped skeletons: body placement and leg chains (part names from the painter)
const QUAD = {
  bobcat: {
    bodyY: -30, walkLen: 30, duty: 0.62, lift: 5, bob: 1.0,
    legs: {
      fHind: { at: 'hipF', up: 'fHindUp', lo: 'fHindLo', paw: 'fPaw', side: -1, meta: 6.5, far: true },
      fFore: { at: 'shF', up: 'fForeUp', lo: 'fForeLo', paw: 'fPaw', side: 1, far: true },
      nHind: { at: 'hipN', up: 'nHindUp', lo: 'nHindLo', paw: 'nPaw', side: -1, meta: 6.5 },
      nFore: { at: 'shN', up: 'nForeUp', lo: 'nForeLo', paw: 'nPaw', side: 1 },
    },
    gaitOff: { nHind: 0, nFore: 0.25, fHind: 0.5, fFore: 0.75 },
  },
  bear: {
    bodyY: -40, walkLen: 40, duty: 0.66, lift: 6, bob: 1.6,
    legs: {
      fHind: { at: 'hipF', up: 'fHindUp', lo: 'fHindLo', paw: 'fPaw', side: -1, far: true },
      fFore: { at: 'shF', up: 'fForeUp', lo: 'fForeLo', paw: 'fPaw', side: 1, far: true },
      nHind: { at: 'hipN', up: 'nHindUp', lo: 'nHindLo', paw: 'nPaw', side: -1 },
      nFore: { at: 'shN', up: 'nForeUp', lo: 'nForeLo', paw: 'nPaw', side: 1 },
    },
    gaitOff: { nHind: 0, nFore: 0.25, fHind: 0.5, fFore: 0.75 },
  },
};

function P(sp, name) { return RIG.meta.animals[sp].parts[name]; }
/** Authoring scale of an animal's painting (skeleton numbers below are in design units). */
const AF = (sp) => RIG.meta.animals[sp].F || 1;
function xf(pos, rot, pivot, pt) {
  const dx = pt[0] - pivot[0], dy = pt[1] - pivot[1];
  const c = Math.cos(rot), s = Math.sin(rot);
  return [pos[0] + dx * c - dy * s, pos[1] + dx * s + dy * c];
}
function twoBone(r, t, l1, l2, side) {
  const dx = t[0] - r[0], dy = t[1] - r[1];
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const phi = Math.atan2(dy, dx);
  return [r[0] + l1 * Math.cos(phi + side * a), r[1] + l1 * Math.sin(phi + side * a)];
}
const partLen = (p) => Math.hypot(p.end[0] - p.pivot[0], p.end[1] - p.pivot[1]);
const partDir = (p) => angDown(p.pivot, p.end);

// --------------------------------------------------------------------- quadruped poses
function quadRest(sp) {
  const Q = QUAD[sp];
  const body = P(sp, 'body');
  const feet = {};
  const bodyY = Q.bodyY * AF(sp);
  for (const [k, L] of Object.entries(Q.legs)) {
    const a = xf([0, bodyY], 0, body.pivot, body[L.at]);
    feet[k] = [a[0] + (L.side < 0 ? 1 : 1), 0];
  }
  return { bodyX: 0, bodyY, bodyRot: 0, headRot: 0, headDx: 0, headDy: 0, tailRot: 0, head: 'head', feet, pawRot: {}, lift: {} };
}

/** Walk cycle locked to distance travelled: each foot is planted (fixed on the ground) while it bears weight. */
function quadWalk(sp, dist, speedK = 1) {
  const Q = QUAD[sp];
  const p = quadRest(sp);
  const F = AF(sp);
  const Lc = Q.walkLen * F * (speedK > 1.3 ? 1.5 : 1);
  const duty = speedK > 1.3 ? 0.45 : Q.duty;
  const ph = dist / Lc;
  for (const k of Object.keys(Q.legs)) {
    const u = wrap(ph + Q.gaitOff[k] * (speedK > 1.3 ? 1 : 1));
    const rest = p.feet[k][0];
    let x, y = 0, rot = 0;
    if (u < duty) {
      x = rest + Lc * duty * (0.5 - u / duty);
    } else {
      const v = (u - duty) / (1 - duty);
      x = rest + Lc * duty * (-0.5 + smooth(v));
      y = -Q.lift * F * Math.sin(v * Math.PI) * (speedK > 1.3 ? 1.6 : 1);
      rot = -0.5 * Math.sin(v * Math.PI) * (k.includes('Hind') ? -0.6 : 1);
    }
    p.feet[k] = [x, y];
    p.pawRot[k] = rot;
  }
  const b = Math.sin(ph * Math.PI * 4);
  p.bodyY += -Q.bob * F * (0.5 + 0.5 * b);
  p.bodyRot = 0.02 * Math.sin(ph * Math.PI * 2);
  p.headRot = -0.04 * b;
  p.headDy = 0.8 * b;
  p.tailRot = 0.18 * Math.sin(ph * Math.PI * 2 + 1);
  return p;
}

function quadIdle(sp, t) {
  const p = quadRest(sp);
  const br = Math.sin(t * 1.7);
  p.bodyY += -0.5 * (br + 1);
  p.headRot = 0.05 * Math.sin(t * 0.6) + (Math.sin(t * 0.23) > 0.85 ? -0.12 : 0);
  p.tailRot = sp === 'bobcat' ? 0.25 * Math.sin(t * 2.6) * (Math.sin(t * 0.5) > 0.2 ? 1 : 0.2) : 0.08 * Math.sin(t);
  return p;
}

function blendQ(a, b, k) {
  const o = { ...a, feet: {}, pawRot: {} };
  for (const key of ['bodyX', 'bodyY', 'bodyRot', 'headRot', 'headDx', 'headDy', 'tailRot']) o[key] = lerp(a[key] || 0, b[key] || 0, k);
  for (const f of Object.keys(a.feet)) {
    o.feet[f] = [lerp(a.feet[f][0], b.feet[f][0], k), lerp(a.feet[f][1], b.feet[f][1], k)];
    o.pawRot[f] = lerp(a.pawRot[f] || 0, b.pawRot[f] || 0, k);
  }
  o.head = k < 0.5 ? a.head : b.head;
  o.air = lerp(a.air || 0, b.air || 0, k);
  return o;
}

/** Bobcat: crouch (wind) → pounce (lunge, airborne stretch) → land. */
function bobcatAttack(base, phase, k, t) {
  const p = { ...base, feet: { ...base.feet }, pawRot: { ...base.pawRot } };
  if (phase === 'wind') {
    const a = smooth(clamp(k * 1.4, 0, 1));
    p.bodyY += 8 * a;
    p.bodyRot = 0.06 * a;
    p.headDy = 4 * a; p.headDx = 2 * a; p.headRot = 0.12 * a;
    p.feet.nHind = [p.feet.nHind[0] + 4 * a, 0];
    p.feet.fHind = [p.feet.fHind[0] + 4 * a, 0];
    p.bodyX = -2 * a + Math.sin(t * 30) * 0.4 * a;  // rump wiggle before the spring
    p.tailRot = 0.5 * Math.sin(t * 9) * a;
  } else if (phase === 'lunge') {
    const a = smooth(clamp(k, 0, 1));
    p.bodyRot = lerp(-0.22, 0.12, a);
    p.headRot = lerp(-0.1, 0.1, a);
    p.headDx = 3;
    p.air = 1;
    // forelegs reach forward, hind legs trail: feet relative to the airborne body
    p.feet.nFore = [p.feet.nFore[0] + 16, -14 + 6 * a]; p.pawRot.nFore = -0.6;
    p.feet.fFore = [p.feet.fFore[0] + 13, -12 + 6 * a]; p.pawRot.fFore = -0.6;
    p.feet.nHind = [p.feet.nHind[0] - 14, -6]; p.pawRot.nHind = 0.9;
    p.feet.fHind = [p.feet.fHind[0] - 11, -5]; p.pawRot.fHind = 0.9;
    p.bodyY -= 4;
    p.tailRot = -0.4;
  }
  return p;
}

/** Bear: rears up and huffs (wind) → drops into a short bluff charge with a forepaw swipe (lunge). */
function bearAttack(base, phase, k, t) {
  const p = { ...base, feet: { ...base.feet }, pawRot: { ...base.pawRot } };
  const body = P('bear', 'body');
  if (phase === 'wind') {
    const a = smooth(clamp(k * 1.3, 0, 1));
    // pivot the body up around the hind feet
    const rot = -0.82 * a;
    const hip = xf([0, QUAD.bear.bodyY * AF('bear')], 0, body.pivot, body.hipN);
    const piv = [hip[0], 0];
    const c0 = [base.bodyX, base.bodyY];
    const dx = c0[0] - piv[0], dy = c0[1] - piv[1];
    p.bodyX = piv[0] + dx * Math.cos(rot) - dy * Math.sin(rot) - 4 * a;
    p.bodyY = piv[1] + dx * Math.sin(rot) + dy * Math.cos(rot) - 9 * a;
    p.bodyRot = rot;
    p.headRot = (0.82 * 0.6 - 0.12) * a + 0.05 * Math.sin(t * 6) * a; // head stays level, nose lifted to scent
    p.head = a > 0.6 && Math.sin(t * 5) > -0.2 ? 'headHuff' : 'head';
    // fore paws lifted, held up in front of the chest
    p.feet.nFore = null; p.feet.fFore = null;
    p.foreHold = { a, sw: Math.sin(t * 3) };
    p.feet.nHind = [p.feet.nHind[0] + 3 * a, 0];
    p.feet.fHind = [p.feet.fHind[0] + 3 * a, 0];
  } else if (phase === 'lunge') {
    const a = smooth(clamp(k, 0, 1));
    p.head = 'headHuff';
    p.headRot = -0.1 + 0.15 * a;
    p.bodyRot = 0.08 - 0.08 * a;
    p.bodyY += 2;
    p.swipe = a; // near forepaw sweeps forward and down
  }
  return p;
}

function quadSolve(sp, pose) {
  const Q = QUAD[sp];
  const body = P(sp, 'body');
  const bpos = [pose.bodyX, pose.bodyY];
  const brot = pose.bodyRot;
  const ops = { far: [], body: [], near: [] };
  const at = (pt) => xf(bpos, brot, body.pivot, pt);
  for (const [k, L] of Object.entries(Q.legs)) {
    const up = P(sp, L.up), lo = P(sp, L.lo), paw = P(sp, L.paw);
    const root = at(body[L.at]);
    const l1 = partLen(up), l2 = partLen(lo);
    let foot = pose.feet[k];
    let wrist;
    let pawRot = pose.pawRot[k] || 0;
    const pawH = (sp === 'bobcat' ? 5 : 6) * AF(sp);
    if (!foot && pose.foreHold) {
      // bear reared: forepaws held up and forward of the chest, swaying
      const h = pose.foreHold;
      // forelegs hang loosely in front of the belly, paws curled
      const fw = [root[0] + 12 + (k === 'nFore' ? 3 : 0) + h.sw * 1.5, root[1] + 20 - (k === 'nFore' ? 0 : 2)];
      wrist = fw;
      pawRot = -0.9 * h.a;
    } else if (pose.swipe != null && k === 'nFore') {
      const s = pose.swipe;
      const ang = lerp(-2.2, -0.2, s); // from raised to forward-down
      const reach = l1 + l2 - 3;
      wrist = [root[0] + Math.sin(-ang) * reach * 0.95 + 6, root[1] + Math.cos(ang) * reach * 0.85];
      pawRot = lerp(-1.4, 0.2, s);
    } else {
      foot = foot || [root[0], 0];
      wrist = [foot[0] - 1, foot[1] - pawH];
      if (L.meta) wrist = [foot[0] - 2.5, foot[1] - pawH - L.meta * AF(sp)];
    }
    let side = L.side;
    const knee = twoBone(root, wrist, l1, l2, side);
    const list0 = L.far ? ops.far : ops.near;
    const list = { push: (o) => list0.push({ ...o, leg: k }) };
    list.push({ p: L.up, pos: root, rot: angDown(root, knee) - partDir(up), sp });
    list.push({ p: L.lo, pos: knee, rot: angDown(knee, wrist) - partDir(lo), sp });
    if (L.meta) {
      // hock → paw: the long hind foot of a cat, reusing the lower-leg painting
      const pawPt = [foot[0] - 1, foot[1] - pawH];
      list.push({ p: L.lo, pos: wrist, rot: angDown(wrist, pawPt) - partDir(lo), sp, sy: Math.hypot(pawPt[0] - wrist[0], pawPt[1] - wrist[1]) / partLen(lo) });
      list.push({ p: L.paw, pos: pawPt, rot: pawRot, sp });
    } else {
      list.push({ p: L.paw, pos: wrist, rot: pawRot, sp });
    }
  }
  const tail = P(sp, 'tail');
  ops.body.push({ p: 'tail', pos: at(body.tail), rot: brot + pose.tailRot, sp });
  ops.body.push({ p: 'body', pos: bpos, rot: brot, sp });
  const neck = at(body.neck);
  ops.body.push({ p: pose.head || 'head', pos: [neck[0] + pose.headDx, neck[1] + pose.headDy], rot: brot * 0.6 + pose.headRot, sp });
  const nearHind = ops.near.filter((o) => o.leg === 'nHind');
  const nearFore = ops.near.filter((o) => o.leg === 'nFore');
  // far legs, tail, body, near hind leg, near foreleg, head
  return [...ops.far, ...ops.body.slice(0, 2), ...nearHind, ...nearFore, ops.body[2]];
}

// --------------------------------------------------------------------- snake
function snakeCurve(pose) {
  const body = P('snake', 'body');
  const L = body.length;
  const r = body.r;
  const coil = pose.coil || 0, strike = pose.strike || 0;
  const th = new Float64Array(L + 1);
  for (let s = 0; s <= L; s++) {
    // slither: gentle arches fixed in the world (the body flows through them)
    const kx = (2 * Math.PI) / 34;
    const ph = kx * (s + (pose.dist || 0)) + (pose.t || 0) * 0.8 * (pose.idle ? 1 : 0);
    let a0 = Math.atan(2.2 * kx * Math.cos(ph)) * (pose.idle ? 0.55 : 1);
    if (s < 12) a0 += -0.32 * (1 - s / 12) * (1 + 0.3 * Math.sin((pose.t || 0) * 1.3));
    // coiled: level head, raised S-neck, then flattened loops
    let a1;
    if (s < 4) a1 = 0.1;
    else if (s < 26) a1 = lerp(0.1, -1.55, smooth(clamp((s - 4) / 8, 0, 1)));
    else if (s < 36) a1 = lerp(-1.55, 0.9, smooth((s - 26) / 10));
    else {
      // one and a bit loops, tighter near the neck, widening toward the tail
      const u = (s - 36) / (L - 36);
      a1 = 0.9 + 2 * Math.PI * 1.2 * (1.3 * u - 0.3 * u * u);
    }
    // strike: the neck section straightens forward, slightly down to the target
    if (strike > 0 && s < 40) a1 = lerp(a1, 0.18 + 0.1 * (s / 40), smooth(clamp(strike * 1.25 - s / 160, 0, 1)));
    th[s] = lerp(a0, a1, coil);
  }
  // integrate from the tail tip toward the head (direction toward the head = (cos θ, sin θ))
  const pts = new Array(L + 1);
  pts[L] = [0, 0];
  for (let s = L - 1; s >= 0; s--) pts[s] = [pts[s + 1][0] + Math.cos(th[s]), pts[s + 1][1] + Math.sin(th[s])];
  // loops of the coil seen in perspective: flatten them vertically
  const sq = lerp(1, 0.5, coil);
  if (sq < 1) {
    let my = 0, n = 0;
    for (let s = 36; s <= L; s++) { my += pts[s][1]; n++; }
    my /= n;
    for (let s = 0; s <= L; s++) {
      const w = clamp((s - 30) / 8, 0, 1);
      const yy = my + (pts[s][1] - my) * sq;
      pts[s] = [pts[s][0], lerp(pts[s][1], yy, w)];
    }
  }
  // stand on the ground: lowest belly point at y = 0; mid-body at x anchor
  let maxY = -1e9;
  for (let s = 0; s <= L; s++) maxY = Math.max(maxY, pts[s][1] + (r[L - Math.min(L - 1, s)] || 2) * 0.9);
  const ai = Math.round(L * (coil > 0.5 ? 0.62 : 0.55));
  const ax = pts[ai][0] - lerp(-4, -10, coil);
  for (let s = 0; s <= L; s++) pts[s] = [pts[s][0] - ax, pts[s][1] - maxY];
  return pts;
}

function snakeOps(pose) {
  const body = P('snake', 'body');
  const L = body.length;
  const pts = snakeCurve(pose);
  const ops = [];
  const tailA = Math.atan2(pts[L - 1][1] - pts[L][1], pts[L - 1][0] - pts[L][0]);
  const buzz = pose.buzz ? Math.sin((pose.t || 0) * 70) * 0.9 : 0;
  ops.push({ p: 'rattle', pos: [pts[L][0], pts[L][1] + buzz], rot: tailA + buzz * 0.1, sp: 'snake' });
  ops.push({ strip: true, pts, sp: 'snake' });
  const hA = Math.atan2(pts[0][1] - pts[2][1], pts[0][0] - pts[2][0]);
  if (pose.tongue) {
    const head = P('snake', 'head');
    const sn = xf(pts[0], hA, head.pivot, head.snout);
    ops.push({ p: 'tongue', pos: sn, rot: hA + 0.1 * Math.sin((pose.t || 0) * 20), sp: 'snake', sx: pose.tongue });
  }
  ops.push({ p: 'head', pos: pts[0], rot: hA, sp: 'snake' });
  return ops;
}

// --------------------------------------------------------------------- birds
function birdOps(sp, pose) {
  const body = P(sp, 'body');
  const bpos = [0, pose.bob || 0];
  const brot = pose.pitch || 0;
  const at = (pt) => xf(bpos, brot, body.pivot, pt);
  const ops = [];
  const wing = (side) => {
    // flap = rotation about the body's long axis, seen from the side: the painted
    // (fully raised) wing is foreshortened vertically; below zero it shows under the body
    const sh = at(body.shoulder);
    const s = side === 'f' ? [sh[0] + 2.5, sh[1] - 1] : sh;
    const e = clamp(pose.wing * (side === 'f' ? 0.92 : 1), -1, 1);
    const sy = Math.abs(e) < 0.12 ? 0.12 * Math.sign(e || 1) : e;
    ops.push({ p: side + 'Wing', pos: s, rot: brot + (pose.sweep || 0), sp, sy, dark: e < 0 ? 0.75 : 1 });
  };
  wing('f');
  ops.push({ p: 'tail', pos: at(body.tail), rot: brot + (pose.tailRot || 0), sp });
  ops.push({ p: pose.reach ? 'feetReach' : 'feetTuck', pos: at(body.hip), rot: brot + (pose.reach ? -0.6 : 0.3), sp });
  ops.push({ p: 'body', pos: bpos, rot: brot, sp });
  const neck = at(body.neck);
  ops.push({ p: 'head', pos: neck, rot: brot * 0.5 + (pose.headRot || 0), sp });
  wing('n');
  return ops;
}

function birdPose(sp, mode, t, k = 0) {
  const owl = sp === 'owl';
  const p = { wing: 0, sweep: 0, pitch: 0, bob: 0, headRot: 0, reach: false, tailRot: 0 };
  if (mode === 'glide') {
    p.wing = 0.22 + 0.06 * Math.sin(t * 2);
    p.sweep = -0.15;
    p.bob = Math.sin(t * 2) * 1.5;
    p.pitch = 0.04;
  } else if (mode === 'swoop') {
    const a = smooth(clamp(k * 2, 0, 1));
    p.pitch = 0.45 * a;
    p.wing = 0.62; p.sweep = -1.05 * a - 0.2; // wings swept back
    p.reach = a > 0.3;
    p.headRot = -0.3 * a;
    p.tailRot = -0.2 * a;
  } else {
    // flap: quick downstroke, slower recovery (the owl slower and deeper)
    const rate = (owl ? 1.5 : 2.3) * (mode === 'hover' ? 1.6 : 1);
    const ph = wrap(t * rate);
    const s = ph < 0.4 ? Math.cos((ph / 0.4) * Math.PI) : -Math.cos(((ph - 0.4) / 0.6) * Math.PI);
    p.wing = 0.15 + s * 0.8;
    p.sweep = -0.18 - 0.22 * Math.max(0, -s) + 0.1 * Math.sin(ph * 2 * Math.PI);
    p.bob = s * 1.8;
    p.pitch = mode === 'hover' ? -0.2 : 0;
    p.headRot = -p.pitch * 0.8;
    p.tailRot = mode === 'hover' ? 0.25 : 0.05 * s;
  }
  return p;
}

// --------------------------------------------------------------------- composite
let SC = null;
function scratch(w, h) {
  if (!SC) { SC = document.createElement('canvas'); SC.ctx = SC.getContext('2d', { willReadFrequently: true }); }
  if (SC.width < w || SC.height < h) { SC.width = Math.max(SC.width, w); SC.height = Math.max(SC.height, h); SC.ctx = SC.getContext('2d', { willReadFrequently: true }); }
  return SC;
}
const BOX = 260, OX = 130, OY = 170;

function drawOps(g, ops) {
  const img = RIG.img;
  const up = RIG.meta.scale;
  for (const o of ops) {
    if (o.strip) {
      const part = P(o.sp, 'body');
      const L = part.length;
      const h = part.h / up;
      // column c of the strip (tail tip at c=0) sits at spine sample s = L - c
      for (let c = 0; c < L; c++) {
        const s = L - c;
        const a = o.pts[Math.min(L, s)], b = o.pts[Math.max(0, s - 1)];
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        g.save();
        g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        g.rotate(ang);
        g.drawImage(img, part.x + c * up, part.y, Math.min(2, L - c) * up, part.h, -0.5, -part.pivot[1], Math.min(2, L - c), h);
        g.restore();
      }
      continue;
    }
    const part = P(o.sp, o.p);
    if (!part) continue;
    g.save();
    g.translate(o.pos[0], o.pos[1]);
    if (o.rot) g.rotate(o.rot);
    if (o.sx || o.sy) g.scale(o.sx || 1, o.sy || 1);
    g.translate(-part.pivot[0], -part.pivot[1]);
    if (o.dark && o.dark < 1) g.filter = `brightness(${o.dark})`;
    g.drawImage(img, part.x, part.y, part.w, part.h, 0, 0, part.w / up, part.h / up);
    if (o.dark && o.dark < 1) g.filter = 'none';
    g.restore();
  }
}

/**
 * Draw an animal pose. (x, y) = screen point of the model origin (ground point under
 * the body for ground animals, body centre for birds); scale = screen px per model px.
 */
export function drawAnimal(ctx, sp, pose, x, y, scale, opts = {}) {
  if (!RIG) return false;
  const def = ANIMALS[sp];
  let ops;
  if (def.kind === 'snake') ops = snakeOps(pose);
  else if (def.kind === 'quad') ops = quadSolve(sp, pose);
  else ops = birdOps(sp, pose);
  const sc = scratch(BOX, BOX);
  const g = sc.ctx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, BOX, BOX);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.translate(OX, OY - (def.fly ? 60 : 0));
  drawOps(g, ops);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const id = g.getImageData(0, 0, BOX, BOX);
  const d = id.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 110 ? 255 : 0;
  g.putImageData(id, 0, 0);
  ctx.save();
  ctx.translate(x, y);
  if (opts.flip) ctx.scale(-1, 1);
  if (opts.filter) ctx.filter = opts.filter;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sc, 0, 0, BOX, BOX, -OX * scale, -(OY - (def.fly ? 60 : 0)) * scale, BOX * scale, BOX * scale);
  ctx.filter = 'none';
  ctx.restore();
  return true;
}

// --------------------------------------------------------------------- poses by anim / game state
/**
 * Pose for the preview: anim in idle | move | glide | attack, t seconds, dist = distance
 * travelled (model px) for planted feet. Attack timeline matches the game's beats:
 * wait 0.3 s → wind-up (telegraph) → lunge → recover.
 */
export function attackBeat(t) {
  const T = t % ANIMAL_ANIM_DUR.attack;
  if (T < 0.3) return { phase: 'none', k: 0 };
  if (T < 1.0) return { phase: 'wind', k: (T - 0.3) / 0.7 };
  if (T < 1.35) return { phase: 'lunge', k: (T - 1.0) / 0.35 };
  if (T < 1.85) return { phase: 'recover', k: (T - 1.35) / 0.5 };
  return { phase: 'none', k: 0 };
}

export function animalPose(sp, anim, t, extra = {}) {
  const def = ANIMALS[sp];
  if (def.kind === 'snake') {
    const p = { t, dist: extra.dist || 0, idle: anim === 'idle', coil: 0, strike: 0, tongue: 0, buzz: false };
    const flick = Math.floor(t * 1.4) % 3 === 0 ? Math.sin(wrap(t * 1.4) * Math.PI) : 0;
    p.tongue = flick > 0.05 ? flick : 0;
    if (anim === 'move') p.dist = extra.dist ?? t * 34;
    if (anim === 'attack' || extra.phase) {
      const b = extra.phase ? extra : attackBeat(t);
      if (b.phase === 'wind') { p.coil = smooth(clamp(b.k * 2.5, 0, 1)); p.buzz = true; p.tongue = Math.max(p.tongue, 0.8 * (Math.sin(t * 9) > 0)); }
      else if (b.phase === 'lunge') { p.coil = 1; p.strike = smooth(clamp(b.k * 1.5, 0, 1)); p.tongue = 0; }
      else if (b.phase === 'recover') { p.coil = 1 - smooth(b.k) * 0.0; p.strike = 1 - smooth(b.k); p.coil = 1 - smooth(clamp(b.k * 1.2 - 0.2, 0, 1)); }
    }
    return p;
  }
  if (def.kind === 'quad') {
    const dist = anim === 'move' ? t * (sp === 'bear' ? 26 : 34) : extra.dist || 0;
    let p = anim === 'move' || extra.moving ? quadWalk(sp, dist, extra.speedK || 1) : quadIdle(sp, t);
    if (extra.moveK != null && extra.moveK < 1 && extra.moveK > 0) p = blendQ(quadIdle(sp, t), quadWalk(sp, dist), smooth(extra.moveK));
    if (anim === 'attack' || extra.phase) {
      const b = extra.phase ? extra : attackBeat(t);
      const atk = sp === 'bobcat' ? bobcatAttack : bearAttack;
      if (b.phase === 'wind') p = atk(p, 'wind', b.k, t);
      else if (b.phase === 'lunge') p = atk(sp === 'bear' ? quadWalk(sp, t * 60, 1.5) : p, 'lunge', b.k, t);
      else if (b.phase === 'recover') {
        const hit = atk(sp === 'bear' ? quadWalk(sp, t * 60, 1.5) : p, 'lunge', 1, t);
        if (sp === 'bear') { hit.swipe = null; hit.foreHold = null; }
        const land = { ...hit, air: 0, feet: { ...p.feet }, pawRot: { ...p.pawRot } };
        p = blendQ(land, p, smooth(b.k));
      }
    }
    if (anim === 'attack' && sp === 'bobcat') {
      const b = attackBeat(t);
      p.hop = b.phase === 'lunge' ? Math.sin(b.k * Math.PI) * 18 : 0;
    }
    return p;
  }
  // birds
  if (anim === 'glide') return birdPose(sp, 'glide', t);
  if (anim === 'attack' || extra.phase) {
    const b = extra.phase ? extra : attackBeat(t);
    if (b.phase === 'wind') return birdPose(sp, 'hover', t);
    if (b.phase === 'lunge') return birdPose(sp, 'swoop', t, b.k);
    if (b.phase === 'recover') return birdPose(sp, 'flap', t);
  }
  return birdPose(sp, anim === 'idle' && extra.perch ? 'glide' : 'flap', t);
}

// --------------------------------------------------------------------- in-game (?rig=1)
const RIG_MODE = typeof location !== 'undefined' && new URLSearchParams(location.search).get('rig') === '1';
if (RIG_MODE) loadAnimals().catch(() => {});

/** Draw a critter enemy with its painted rig. Returns false to fall back to the procedural drawing. */
export function drawAnimalRig(ctx, e, dx, flash) {
  if (!RIG_MODE || !RIG || !ANIMALS[e.type]) return false;
  const sp = e.type;
  const def = ANIMALS[sp];
  const sc = (e.drawScale || 1) * 0.875;
  const r = e.arig || (e.arig = { lastX: e.x, dist: 0, t: Math.random() * 4, moveK: 0 });
  const mv = (e.x - r.lastX) / sc;
  r.lastX = e.x;
  r.t += 1 / 60;
  const moving = Math.abs(mv) > 0.04 || (!e.alive);
  r.dist += Math.abs(mv);
  r.moveK = clamp(r.moveK + (moving ? 1 / 9 : -1 / 12), 0, 1);
  const state = e.alive ? e.melee || 'none' : 'none';
  if (state !== r.state) { r.state = state; r.len = Math.max(1, e.meleeT || 1); }
  let phase = null;
  const k = clamp(1 - (e.meleeT || 0) / r.len, 0, 1); // 0 → 1 through the current beat
  if (state === 'wind' || state === 'lunge' || state === 'recover') phase = state;
  let pose;
  if (def.kind === 'bird') {
    pose = phase ? animalPose(sp, 'attack', r.t, { phase, k }) : animalPose(sp, 'move', r.t);
  } else if (def.kind === 'snake') {
    pose = animalPose(sp, moving ? 'move' : 'idle', r.t, phase ? { phase, k, dist: r.dist } : { dist: r.dist });
    if (!phase) pose.dist = r.dist;
  } else {
    pose = animalPose(sp, 'idle', r.t, { dist: r.dist, moving: r.moveK > 0.5, moveK: r.moveK, speedK: Math.abs(mv) > 2.4 ? 1.6 : 1, ...(phase ? { phase, k } : {}) });
    if (sp === 'bobcat' && e.onGround === false && e.alive) pose = animalPose(sp, 'idle', r.t, { phase: 'lunge', k: 0.5 });
  }
  const ax = dx + e.w / 2;
  const ay = def.fly ? e.y + e.h / 2 : e.y + e.h;
  // soft ground shadow like the procedural critters
  if (!def.fly && e.onGround !== false) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(ax, ay - 1, (sp === 'bear' ? 44 : sp === 'bobcat' ? 26 : 40) * (e.drawScale || 1), 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  drawAnimal(ctx, sp, pose, Math.round(ax), Math.round(ay), sc, {
    flip: e.facing < 0,
    filter: flash ? 'brightness(1.9) saturate(0.6)' : undefined,
  });
  return true;
}

/** QA: planted-paw drift (world px while a paw bears weight) and leg reach gaps for a walk. */
export function quadStats(sp, speed = 34, dur = 4) {
  const Q = QUAD[sp];
  const body = P(sp, 'body');
  let drift = 0, gap = 0, samples = 0;
  const runs = {};
  for (let t = 0; t <= dur; t += 1 / 120) {
    const dist = speed * t;
    const p = quadWalk(sp, dist);
    for (const [k, L] of Object.entries(Q.legs)) {
      const f = p.feet[k];
      const wx = f[0] + dist;
      if (Math.abs(f[1]) < 1e-6) {
        const r = runs[k] || (runs[k] = { a: wx, b: wx });
        r.a = Math.min(r.a, wx); r.b = Math.max(r.b, wx);
        drift = Math.max(drift, r.b - r.a);
      } else runs[k] = null;
      const root = xf([p.bodyX, p.bodyY], p.bodyRot, body.pivot, body[L.at]);
      const pawH = (sp === 'bobcat' ? 5 : 6) * AF(sp);
      const wrist = L.meta ? [f[0] - 2.5, f[1] - pawH - L.meta * AF(sp)] : [f[0] - 1, f[1] - pawH];
      const reach = partLen(P(sp, L.up)) + partLen(P(sp, L.lo));
      gap = Math.max(gap, Math.hypot(wrist[0] - root[0], wrist[1] - root[1]) - reach);
      samples++;
    }
  }
  return { samples, maxPlantedDriftPx: +drift.toFixed(3), maxReachGapPx: +Math.max(0, gap).toFixed(2) };
}
