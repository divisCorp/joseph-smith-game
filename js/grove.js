/**
 * Chapter 1 story: preachers of the 1820 revivals urge young Joseph to join their
 * churches; a camp meeting at the edge of the grove; Joseph recalls James 1:5,
 * walks into the trees and kneels to pray. The chapter closes with a gentle light
 * fade (no depiction of Deity), then the results card.
 */
import { bindText } from './input.js?v=78';
import { TILE, SCALE, W, H } from './constants.js?v=78';
import { drawPreacher, drawPortrait } from './sprites.js?v=78';
import { drawPreacherRig } from './rig-cast.js?v=78';
import { sfx } from './audio.js?v=78';
import { reduceFlash } from './save.js?v=78';

const S = SCALE;
const GROUND_Y = 13 * TILE;
const NPC_H = 112;

export const CAMP_X = 101.6 * TILE; // Joseph stops here for the camp meeting
export const KNEEL_X = 114.5 * TILE;

const ROAD_PREACHERS = [
  {
    kind: 'methodist',
    col: 13.5,
    name: 'Methodist circuit rider',
    line: 'Good day, Joseph! Come to the camp meeting and join the Methodists. The Spirit is moving!',
  },
  {
    kind: 'presbyterian',
    col: 47.2,
    name: 'Presbyterian minister',
    line: 'Your mother, Hyrum, Samuel and Sophronia sit with us now. Join the Presbyterians, son.',
  },
  {
    kind: 'baptist',
    col: 75.6,
    name: 'Baptist preacher',
    line: 'Be baptized by immersion, as the Scriptures teach. Join the Baptists, young man!',
  },
];

const CAMP_PREACHERS = [
  { kind: 'methodist', col: 104, line: 'Lo, here! Join the Methodists!', hi: false },
  { kind: 'presbyterian', col: 107.4, line: 'Lo, there! The Presbyterians!', hi: true },
  { kind: 'baptist', col: 110.8, line: 'No, the Baptists are right!', hi: false },
];

const JOSEPH_LINES = [
  '“Who of all these parties are right; or, are they all wrong together? If any one of them be right, which is it, and how shall I know it?” (JS—History 1:10)',
  '“If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.” (James 1:5)',
  'I will go into the grove and ask of God.',
];

export function initGrove(level) {
  if (level.num !== 1) return;
  level.preachers = ROAD_PREACHERS.map((p) => ({ ...p, x: p.col * TILE, y: GROUND_Y - NPC_H, facing: -1, talkT: 0, said: false }));
  level.camp = {
    state: 'idle',
    t: 0,
    line: 0,
    lineT: 0,
    kneelT: 0,
    light: 0,
    preachers: CAMP_PREACHERS.map((p) => ({ ...p, x: p.col * TILE, y: GROUND_Y - NPC_H, facing: -1 })),
  };
}

function near(p, x, r) {
  return Math.abs(p.x + p.w / 2 - (x + 28)) < r;
}

/**
 * Returns true while the camp-meeting cutscene owns Joseph (no player input).
 * `confirm` is a one-shot press that skips to the next line.
 */
export function updateGrove(game, dt, confirm) {
  const { level, player: p } = game;
  if (!level.camp || !p) return false;
  const camp = level.camp;

  // Road preachers: a friendly word as Joseph passes; the pitchfork is put away nearby
  let calm = false;
  // never disarm Joseph while a wild animal or foe is close by
  const foeNear = level.enemies.some((e) => e.alive && Math.abs(e.x - p.x) < 8 * TILE);
  for (const pr of level.preachers) {
    const close = near(p, pr.x, 4.2 * TILE);
    if (near(p, pr.x, 4.5 * TILE) && !foeNear) calm = true;
    pr.facing = p.x + p.w / 2 < pr.x + 28 ? -1 : 1;
    if (close && !pr.said) {
      pr.said = true;
      pr.talkT = 1;
      sfx('select');
    }
    if (pr.talkT > 0) {
      pr.talkT += dt;
      if (pr.talkT > 330 || !near(p, pr.x, 8 * TILE)) pr.talkT = 0;
    }
  }
  if (camp.state !== 'idle' || p.x > 99 * TILE) calm = true;
  p.noAttack = calm;
  p.forkAway = calm;

  camp.t += dt;
  switch (camp.state) {
    case 'idle':
      if (p.x >= CAMP_X - 6 && p.onGround && p.alive) {
        camp.state = 'gather';
        camp.t = 0;
        p.vx = 0;
        p.x = Math.min(p.x, CAMP_X + 4);
        game.tip = null;
        return true;
      }
      return false;
    case 'gather': {
      holdStill(p);
      p.facing = 1;
      // all three call out at once, a beat apart
      if (camp.t > 230 || (confirm && camp.t > 60)) {
        camp.state = 'joseph';
        camp.t = 0;
        camp.line = 0;
        camp.lineT = 0;
      }
      return true;
    }
    case 'joseph':
      holdStill(p);
      camp.lineT += dt;
      if (camp.lineT > 220 || (confirm && camp.lineT > 30)) {
        camp.line++;
        camp.lineT = 0;
        if (camp.line >= JOSEPH_LINES.length) {
          camp.state = 'walk';
          camp.t = 0;
        }
      }
      return true;
    case 'walk':
      p.facing = 1;
      p.walking = true;
      p.vx = 1.2 * S;
      p.x += p.vx * dt;
      if (p.x >= KNEEL_X) {
        p.x = KNEEL_X;
        p.vx = 0;
        p.walking = false;
        camp.state = 'kneel';
        camp.t = 0;
      }
      return true;
    case 'kneel': {
      // Joseph is free to kneel (hold Down); he stays within the clearing
      p.noAttack = true;
      if (p.x < KNEEL_X - 2 * TILE) p.x = KNEEL_X - 2 * TILE;
      if (p.x > KNEEL_X + 2 * TILE) p.x = KNEEL_X + 2 * TILE;
      const praying = p.crouching && p.onGround && Math.abs(p.vx) < 0.2 * S;
      if (praying) camp.kneelT += dt;
      else camp.kneelT = Math.max(0, camp.kneelT - dt * 2);
      if (camp.kneelT > 110) {
        camp.state = 'light';
        camp.t = 0;
        p.vx = 0;
        sfx('heal');
      }
      return false; // normal control so the player kneels themselves
    }
    case 'light':
      p.vx = 0;
      camp.light = Math.min(1, camp.t / (reduceFlash() ? 260 : 200));
      if (camp.t > (reduceFlash() ? 330 : 270) && camp.state !== 'done') {
        camp.state = 'done';
        game.onGroveDone?.();
      }
      return true;
    default:
      return true;
  }
}

function holdStill(p) {
  p.vx = 0;
  p.walking = false;
  if (p.crouching) {
    p.crouching = false;
    p.y -= p.standH - p.crouchH;
    p.h = p.standH;
  }
}

/** Kneeling uses the existing chapter-1 music cue (lower, slower hymn). */
export function groveCalmMusic(game) {
  const st = game.level?.camp?.state;
  return st === 'kneel' || st === 'light' || st === 'done';
}

// ── Drawing ───────────────────────────────────────────────────────────────

/** Camp-meeting grounds behind the characters (world space). */
export function drawGroveBack(ctx, game) {
  const level = game.level;
  if (!level.camp) return;
  const camX = game.camX;
  const x0 = 105.6 * TILE - camX;
  if (x0 > W + 400 || x0 < -800) return;
  ctx.save();
  // canvas meeting tent
  const tx = x0 - 30;
  const ty = GROUND_Y - 120;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(tx - 6, GROUND_Y - 4, 160, 6);
  ctx.fillStyle = '#d8cfb4';
  ctx.beginPath();
  ctx.moveTo(tx, GROUND_Y);
  ctx.lineTo(tx + 10, ty + 40);
  ctx.lineTo(tx + 74, ty);
  ctx.lineTo(tx + 138, ty + 40);
  ctx.lineTo(tx + 148, GROUND_Y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b8ad90';
  ctx.beginPath();
  ctx.moveTo(tx + 74, ty);
  ctx.lineTo(tx + 138, ty + 40);
  ctx.lineTo(tx + 148, GROUND_Y);
  ctx.lineTo(tx + 74, GROUND_Y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.moveTo(tx + 60, GROUND_Y);
  ctx.lineTo(tx + 74, ty + 46);
  ctx.lineTo(tx + 88, GROUND_Y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(tx + 72, ty - 10, 4, 12);
  ctx.fillStyle = '#8a7a5a';
  for (let k = 0; k < 6; k++) ctx.fillRect(tx + 16 + k * 20, ty + 46 + (k % 2) * 4, 1, GROUND_Y - ty - 52);
  // preaching stand (simple plank pulpit) and benches
  const sx = 109 * TILE - camX;
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(sx, GROUND_Y - 40, 70, 40);
  ctx.fillStyle = '#7a5434';
  ctx.fillRect(sx + 2, GROUND_Y - 38, 66, 6);
  ctx.fillStyle = '#5e3e24';
  for (let k = 0; k < 4; k++) ctx.fillRect(sx + 4, GROUND_Y - 28 + k * 7, 62, 2);
  for (const bx of [104.5 * TILE, 106.6 * TILE]) {
    const b = bx - camX;
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(b, GROUND_Y - 16, 52, 6);
    ctx.fillStyle = '#3a2414';
    ctx.fillRect(b + 4, GROUND_Y - 10, 4, 10);
    ctx.fillRect(b + 44, GROUND_Y - 10, 4, 10);
  }
  // lanterns on poles
  for (const lx of [103.2 * TILE, 112.6 * TILE]) {
    const l = lx - camX;
    ctx.fillStyle = '#3a2818';
    ctx.fillRect(l, GROUND_Y - 92, 4, 92);
    ctx.fillRect(l - 6, GROUND_Y - 92, 16, 3);
    const g = ctx.createRadialGradient(l + 2, GROUND_Y - 80, 1, l + 2, GROUND_Y - 80, 26);
    g.addColorStop(0, 'rgba(255,220,140,0.8)');
    g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(l - 26, GROUND_Y - 106, 56, 52);
    ctx.fillStyle = '#ffd890';
    ctx.fillRect(l - 2, GROUND_Y - 88, 8, 10);
  }
  ctx.restore();
}

/** Preachers (world space, before Joseph). */
export function drawGroveNpcs(ctx, game) {
  const level = game.level;
  if (!level.preachers) return;
  const camX = game.camX;
  const t = game.tick;
  for (const pr of level.preachers) {
    const x = pr.x - camX;
    if (x < -80 || x > W + 80) continue;
    if (!drawPreacherRig(ctx, x, pr.y, pr.facing, pr.kind, t, pr.talkT > 0)) drawPreacher(ctx, x, pr.y, pr.facing, pr.kind, t, pr.talkT > 0);
  }
  const camp = level.camp;
  if (camp) {
    for (const pr of camp.preachers) {
      const x = pr.x - camX;
      if (x < -80 || x > W + 80) continue;
      const p = game.player;
      pr.facing = p.x + p.w / 2 < pr.x + 28 ? -1 : 1;
      if (!drawPreacherRig(ctx, x, pr.y, pr.facing, pr.kind, t, camp.state === 'gather')) drawPreacher(ctx, x, pr.y, pr.facing, pr.kind, t, camp.state === 'gather');
    }
  }
}

/** Speech bubbles over preachers (world space, after Joseph). */
export function drawGroveBubbles(ctx, game) {
  const level = game.level;
  if (!level.preachers) return;
  const camX = game.camX;
  for (const pr of level.preachers) {
    if (pr.talkT <= 0) continue;
    if (pr.x - camX < -40 || pr.x - camX > W - 16) continue;
    const a = Math.min(1, pr.talkT / 12, (330 - pr.talkT) / 20);
    bubble(ctx, pr.x - camX + 28, pr.y - 8, pr.line, pr.name, a, 260);
  }
  const camp = level.camp;
  if (camp && camp.state === 'gather') {
    camp.preachers.forEach((pr, i) => {
      const t = camp.t - i * 26;
      if (t <= 0) return;
      const a = Math.min(1, t / 10);
      bubble(ctx, pr.x - camX + 28, pr.y - 8 - (pr.hi ? 62 : 0), pr.line, '', a, 200);
    });
  }
}

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function bubble(ctx, cx, bottomY, text, name, alpha, maxW) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.font = '600 15px Georgia, "Times New Roman", serif';
  const lines = wrap(ctx, text, maxW - 24);
  const lh = 19;
  const nameH = name ? 16 : 0;
  const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width), name ? 120 : 0) + 24);
  const h = lines.length * lh + 16 + nameH;
  let x = Math.round(cx - w / 2);
  x = Math.max(8, Math.min(W - w - 8, x));
  const y = Math.round(bottomY - h - 12);
  // parchment bubble with a small tail
  ctx.fillStyle = 'rgba(30,20,10,0.85)';
  roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 9);
  ctx.fill();
  ctx.fillStyle = '#f4e8c8';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.beginPath();
  const tx = Math.max(x + 14, Math.min(x + w - 14, cx));
  ctx.moveTo(tx - 8, y + h - 1);
  ctx.lineTo(tx, y + h + 12);
  ctx.lineTo(tx + 6, y + h - 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(30,20,10,0.85)';
  ctx.fillRect(tx - 1, y + h + 9, 2, 3);
  if (name) {
    ctx.font = 'italic 12px Georgia, serif';
    ctx.fillStyle = '#7a5a2a';
    ctx.fillText(name, x + 12, y + 16);
  }
  ctx.font = '600 15px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#2a1a0c';
  lines.forEach((l, i) => ctx.fillText(l, x + 12, y + 8 + nameH + (i + 1) * lh - 4));
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Screen-space story UI: Joseph's words, the kneel prompt, and the light. */
export function drawGroveUi(ctx, game) {
  const camp = game.level?.camp;
  if (!camp) return;
  if (camp.state === 'joseph') {
    const text = JOSEPH_LINES[camp.line] || '';
    const a = Math.min(1, camp.lineT / 10);
    ctx.save();
    ctx.globalAlpha = a;
    const bw = Math.min(W - 120, 760);
    const bx = Math.round((W - bw) / 2);
    const by = 36;
    ctx.font = 'italic 600 21px Georgia, "Times New Roman", serif';
    const lines = wrap(ctx, text, bw - 130);
    const bh = Math.max(92, lines.length * 28 + 44);
    ctx.fillStyle = 'rgba(20,12,6,0.9)';
    roundRect(ctx, bx - 3, by - 3, bw + 6, bh + 6, 12);
    ctx.fill();
    ctx.fillStyle = '#f2e4c0';
    roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.strokeStyle = '#b08840';
    ctx.lineWidth = 2;
    roundRect(ctx, bx + 6, by + 6, bw - 12, bh - 12, 7);
    ctx.stroke();
    drawPortrait(ctx, bx + 18, by + (bh - 72) / 2, 0, 72);
    ctx.font = '700 14px Georgia, serif';
    ctx.fillStyle = '#7a5a2a';
    ctx.fillText('JOSEPH', bx + 108, by + 28);
    ctx.font = 'italic 600 21px Georgia, "Times New Roman", serif';
    ctx.fillStyle = '#2a1a0c';
    lines.forEach((l, i) => ctx.fillText(l, bx + 108, by + 56 + i * 28));
    ctx.font = '13px Georgia, serif';
    ctx.fillStyle = '#8a6a3a';
    if (camp.lineT > 40) ctx.fillText('▶', bx + bw - 26, by + bh - 14);
    ctx.restore();
  }
  if (camp.state === 'kneel') {
    const touch = typeof document !== 'undefined' && document.body?.classList.contains('touch-ui');
    const msg = touch ? 'Hold ▼ on the stick to kneel and pray' : `Hold ${bindText('down', ' or ')} to kneel and pray`;
    ctx.save();
    ctx.font = '600 20px Georgia, serif';
    const w = ctx.measureText(msg).width + 40;
    const x = (W - w) / 2;
    const pulse = 0.75 + Math.sin(game.tick * 0.08) * 0.25;
    ctx.globalAlpha = camp.kneelT > 0 ? 0.6 : pulse;
    ctx.fillStyle = 'rgba(20,12,6,0.82)';
    roundRect(ctx, x, 40, w, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#f0e0b0';
    ctx.fillText(msg, x + 20, 67);
    // quiet progress ring while kneeling
    if (camp.kneelT > 0) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,230,170,0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(W / 2, 112, 14, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.min(1, camp.kneelT / 110)));
      ctx.stroke();
    }
    ctx.restore();
  }
  if (camp.state === 'light' || camp.state === 'done') {
    const a = camp.state === 'done' ? 1 : camp.light;
    ctx.save();
    // warm morning light filling the grove from above
    const g = ctx.createRadialGradient(W * 0.7, -40, 20, W * 0.7, -40, H * 1.5);
    g.addColorStop(0, `rgba(255,252,236,${0.95 * a})`);
    g.addColorStop(0.5, `rgba(255,240,200,${0.7 * a})`);
    g.addColorStop(1, `rgba(255,228,170,${0.45 * a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // soft shafts through the trees
    ctx.globalAlpha = a;
    for (let k = 0; k < 4; k++) {
      const x = W * (0.5 + k * 0.13);
      const beam = ctx.createLinearGradient(0, 0, 0, H);
      beam.addColorStop(0, 'rgba(255,248,224,0.32)');
      beam.addColorStop(0.7, 'rgba(255,248,224,0.08)');
      beam.addColorStop(1, 'rgba(255,248,224,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 70, 0);
      ctx.lineTo(x - 60 + k * 14, H);
      ctx.lineTo(x - 190 + k * 14, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = Math.max(0, Math.min(1, (a - 0.55) / 0.35));
    ctx.font = 'italic 600 24px Georgia, serif';
    ctx.fillStyle = '#5a3c14';
    const line = '“I saw a pillar of light exactly over my head, above the brightness of the sun…”';
    ctx.fillText(line, (W - ctx.measureText(line).width) / 2, H * 0.42);
    ctx.font = '16px Georgia, serif';
    const sub = 'Joseph Smith—History 1:16 · Spring 1820';
    ctx.fillText(sub, (W - ctx.measureText(sub).width) / 2, H * 0.42 + 30);
    ctx.restore();
  }
}
