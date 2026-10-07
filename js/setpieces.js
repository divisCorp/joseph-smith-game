/**
 * Chapter set pieces + checkpoints (procedural canvas art; sprite sheets untouched).
 *  ch4 Missouri Night — torch-lit night, rolling barrels from the mob's wagons
 *  ch5 Far West Road  — winter snowstorm; telegraphed gusts push Joseph back
 *  ch6 Nauvoo         — temple-building scaffolds with falling bricks, river dock with sinking planks
 */
import { bindText } from './input.js?v=72';
import { W, H, TILE, SCALE } from './constants.js?v=72';
import { createHazard, groundTopBelow, drawAlert } from './hazards.js?v=72';
import { drawText, measureText, drawRect } from './sprites.js?v=72';
import { sfx } from './audio.js?v=72';
import { isEasy, reduceFlash } from './save.js?v=72';

const S = SCALE;

export function initSetPieces(level) {
  level.hazards = level.hazards || [];
  level.sp = { t: 0, barrelT: 90, barrelWarn: 0, brickT: 60, wind: { mode: 'calm', t: 0 }, flakes: [], ripples: [], dust: [] };
  if (level.num === 5) {
    for (let i = 0; i < 140; i++) {
      level.sp.flakes.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2.4, s: 0.6 + Math.random() * 1.2 });
    }
  }
}

/** Planks over the Nauvoo river; some sink after you stand on them. */
export function buildDock(level, fromCol, toCol, sinkingCols) {
  const y = 13 * TILE;
  level.dock = [];
  for (let c = fromCol; c <= toCol; c++) {
    const sink = sinkingCols.includes(c);
    const s = { x: c * TILE, y, w: TILE, h: 8, kind: 'plat', dock: true, sink, unsafe: sink, baseY: y, homeX: c * TILE, phase: 'idle', pt: 0, dx: 0, st: 0 };
    level.dock.push(s);
    level.solids.push(s);
  }
}

function playerOn(p, s) {
  return p.onGround && Math.abs(p.y + p.h - s.y) <= 4 && p.x + p.w - 2 * S > s.x && p.x + 2 * S < s.x + s.w;
}

export function updateSetPieces(game, dt) {
  const { level, player: p } = game;
  const sp = level.sp;
  if (!sp || !p) return;
  sp.t += dt;
  p.extVx = 0;
  const px = p.x + p.w / 2;
  const col = px / TILE;
  const preBoss = !level.bossZoneX || p.x < level.bossZoneX - 2 * TILE;

  // Checkpoints
  for (const cp of level.checkpoints || []) {
    if (cp.lit) continue;
    if (Math.abs(px - (cp.x + 8 * S)) < 18 * S && p.alive) {
      for (const c of level.checkpoints) if (c.x <= cp.x) c.lit = true;
      game.onCheckpoint?.(cp);
    }
  }

  if (level.num === 4 && preBoss && p.alive) {
    const inZone = (col > 12 && col < 34) || (col > 66 && col < 106);
    if (inZone) {
      if (sp.barrelWarn > 0) {
        sp.barrelWarn -= dt;
        if (sp.barrelWarn <= 0) {
          const bx = game.camX + W + 24 * S;
          const top = groundTopBelow(level.solids, bx + 11 * S, 10 * TILE, true);
          if (top !== null) level.hazards.push(createHazard('barrel', bx, top - 22 * S, { vx: -2.3 * S }));
          sp.barrelT = 150 + Math.random() * 70;
        }
      } else {
        sp.barrelT -= dt;
        if (sp.barrelT <= 0) {
          sp.barrelWarn = 48;
          sfx('rumble');
        }
      }
    }
  }

  if (level.num === 5) {
    const w = sp.wind;
    w.t += dt;
    if (!preBoss) {
      w.mode = 'calm';
    } else if (w.mode === 'calm' && w.t > 230) {
      w.mode = 'warn';
      w.t = 0;
      sfx('wind');
    } else if (w.mode === 'warn' && w.t > 60) {
      w.mode = 'gust';
      w.t = 0;
      sfx('gust');
    } else if (w.mode === 'gust' && w.t > 110) {
      w.mode = 'calm';
      w.t = 0;
    }
    if (w.mode === 'gust' && p.alive) p.extVx = (p.onGround ? -0.8 : -0.45) * S;
    const drift = w.mode === 'gust' ? -7 : w.mode === 'warn' ? -3 : -1.2;
    for (const f of sp.flakes) {
      f.x += drift * f.s * dt;
      f.y += (1.1 + f.s) * dt;
      if (f.y > H) { f.y = -4; f.x = Math.random() * W; }
      if (f.x < -10) f.x += W + 20;
      if (f.x > W + 10) f.x -= W + 20;
    }
  }

  if (level.num === 6) {
    // Falling bricks under the scaffolds (shadow marker first)
    if (col > 36 && col < 58 && p.alive) {
      sp.brickT -= dt;
      if (sp.brickT <= 0) {
        const bx = px + (Math.random() * 90 - 30) * S * Math.sign(p.facing || 1);
        const landY = groundTopBelow(level.solids, bx, 0);
        if (landY !== null) level.hazards.push(createHazard('brick', bx - 7 * S, -10 * S, { warn: 54, landY }));
        sp.brickT = 95 + Math.random() * 40;
      }
    }
    updateDock(level, p, dt);
  }

  if (level.finale) updateFinale(game, dt);
}

/**
 * Sinking dock planks read in three beats: CREAK (shakes, groans, dust) →
 * SINK (slides under with ripples, still briefly standable) → GONE, then the
 * plank floats back up with a ripple. Nearby weak planks bob as a pre-tell.
 */
const CREAK_T = 34;
const SINK_T = 42;
const GONE_T = 150;
const RISE_T = 30;

function updateDock(level, p, dt) {
  const sp = level.sp;
  const creak = isEasy() ? CREAK_T * 1.5 : CREAK_T;
  for (const s of level.dock || []) {
    if (!s.sink) continue;
    s.pt += dt;
    const on = s.phase !== 'gone' && playerOn(p, s);
    if (s.phase === 'idle') {
      s.dx = 0;
      s.y = s.baseY;
      // gentle bob when Joseph is close: "this one is loose"
      const near = Math.abs(p.x + p.w / 2 - (s.homeX + TILE / 2)) < 3 * TILE;
      s.bob = near ? Math.sin(sp.t * 0.18 + s.homeX) * 1.2 * S : 0;
      if (on) {
        s.phase = 'creak';
        s.pt = 0;
        sfx('creak');
      }
    } else if (s.phase === 'creak') {
      s.bob = 0;
      s.dx = Math.sin(s.pt * 1.7) * 3 * S * Math.min(1, s.pt / 8);
      if (Math.floor(s.pt) % 6 === 0) sp.dust.push({ x: s.homeX + Math.random() * TILE, y: s.baseY + 8 * S, vy: 0.6 + Math.random(), t: 0 });
      if (s.pt > creak) {
        s.phase = 'sink';
        s.pt = 0;
        sp.ripples.push({ x: s.homeX + TILE / 2, y: s.baseY + 4 * S, t: 0 });
        sfx('splash');
      }
    } else if (s.phase === 'sink') {
      s.dx = 0;
      s.y = s.baseY + (s.pt / SINK_T) * 28 * S;
      s.x = s.y > s.baseY + 10 * S ? -9999 : s.homeX; // no longer holds you past half-way
      if (Math.floor(s.pt) % 14 === 0) sp.ripples.push({ x: s.homeX + TILE / 2, y: s.baseY + 4 * S, t: 0 });
      if (s.pt > SINK_T) {
        s.phase = 'gone';
        s.pt = 0;
        s.x = -9999;
      }
    } else if (s.phase === 'gone') {
      if (s.pt > GONE_T && !playerOn(p, { ...s, x: s.homeX, y: s.baseY })) {
        s.phase = 'rise';
        s.pt = 0;
        sp.ripples.push({ x: s.homeX + TILE / 2, y: s.baseY + 4 * S, t: 0 });
      }
    } else if (s.phase === 'rise') {
      s.y = s.baseY + (1 - Math.min(1, s.pt / RISE_T)) * 22 * S;
      if (s.pt > RISE_T) {
        s.phase = 'idle';
        s.pt = 0;
        s.x = s.homeX;
        s.y = s.baseY;
      }
    }
    s.st = s.phase === 'creak' ? s.pt : s.phase === 'sink' ? creak + s.pt : 0; // QA readout
  }
  for (const r of sp.ripples) r.t += dt;
  sp.ripples = sp.ripples.filter((r) => r.t < 50);
  for (const d of sp.dust) {
    d.t += dt;
    d.y += d.vy * dt;
  }
  sp.dust = sp.dust.filter((d) => d.t < 24);
}

// ── Carthage finale: hold the door, gently ──────────────────
/*
 * No fight and no harm shown. Joseph stands in the lamplight by the door to
 * shield his friends. Knocks build in three waves; each is telegraphed (the
 * door rattles, "!" + knock sound) and then pressure pushes Joseph back —
 * hold → to brace. Courage fills only while he stands in the light. Nothing
 * here costs hearts. When courage is full, the existing reverent fade plays.
 */
export const FINALE_NEED = 900;

function updateFinale(game, dt) {
  const { level, player: p } = game;
  const f = level.finale;
  if (!f.state) Object.assign(f, { state: 'idle', courage: 0, mode: 'calm', t: 0, wave: 0, knocks: 0, rattle: 0 });
  if (f.state === 'idle') {
    if (p.x + p.w / 2 >= level.goalX) {
      f.state = 'active';
      f.t = 0;
      game.message = 'Stand in the light · Hold the door';
      game.messageT = 150;
      sfx('checkpoint');
    }
    return;
  }
  if (f.state !== 'active') return;
  const need = isEasy() ? FINALE_NEED * 0.7 : FINALE_NEED;
  const cx = p.x + p.w / 2;
  f.inZone = cx >= f.zoneX0 && cx <= f.zoneX1 && p.alive;
  f.t += dt;
  if (f.inZone) f.courage = Math.min(need, f.courage + dt);
  f.wave = f.courage < need / 3 ? 0 : f.courage < (2 * need) / 3 ? 1 : 2;
  f.need = need;
  const calmT = [150, 120, 96][f.wave];
  const tellT = isEasy() ? 70 : 54;
  if (f.mode === 'calm' && f.t > calmT) {
    f.mode = 'tell';
    f.t = 0;
    f.knocks = 0;
    if (f.wave === 1 && !f.toldBrace) {
      f.toldBrace = true;
      game.message = 'The knocking grows stronger';
      game.messageT = 80;
    }
  } else if (f.mode === 'tell') {
    // three knocks, spaced, then the push
    const k = Math.floor(f.t / (tellT / 3));
    if (k > f.knocks - 1 && f.knocks < 3) {
      f.knocks++;
      f.rattle = 10;
      sfx('knock');
      if (!reduceFlash()) game.shake = Math.max(game.shake, 4 + f.wave * 2);
    }
    if (f.t > tellT) {
      f.mode = 'push';
      f.t = 0;
      if (!f.toldHold) {
        f.toldHold = true;
        game.message = game.touchUi ? 'Hold ▶ to brace the door' : `Hold ${bindText('right', ' or ')} to brace the door`;
        game.messageT = 90;
      }
    }
  } else if (f.mode === 'push') {
    const pushT = 60 + f.wave * 12;
    const strength = (1.0 + 0.2 * f.wave) * S * (isEasy() ? 0.7 : 1);
    if (p.alive && p.x < f.doorX) p.extVx = -strength * Math.min(1, f.t / 10);
    if (f.t % 18 < dt) f.rattle = 8;
    if (f.t > pushT) {
      f.mode = 'calm';
      f.t = 0;
    }
  }
  if (f.rattle > 0) f.rattle -= dt;
  if (f.courage >= need) {
    f.state = 'done';
    game.onFinaleDone?.();
  }
}

function drawFriend(ctx, x0, base0, coat, hat, t, i) {
  // simple procedural figures (no sprite-sheet art): seated friends in the jail room
  ctx.save();
  ctx.translate(x0, base0);
  ctx.scale(1.7, 1.7);
  drawFriendBody(ctx, 0, 0, coat, hat, t, i);
  ctx.restore();
}

function drawFriendBody(ctx, x, base, coat, hat, t, i) {
  // Seated friend, facing the door (right). Units are pre-scale pixels.
  const sway = Math.sin(t * 0.03 + i * 1.7) * 0.6;
  const breathe = Math.sin(t * 0.05 + i) * 0.4;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x + 13, base, 15, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // stool
  ctx.fillStyle = '#4a3018';
  ctx.fillRect(x + 2, base - 15, 18, 3);
  ctx.fillRect(x + 4, base - 12, 2, 12);
  ctx.fillRect(x + 16, base - 12, 2, 12);
  // legs: thigh forward, shin down, boot
  ctx.fillStyle = '#2a2622';
  ctx.fillRect(x + 8, base - 17, 15, 5);
  ctx.fillRect(x + 19, base - 13, 4, 11);
  ctx.fillStyle = '#16120e';
  ctx.fillRect(x + 18, base - 3, 7, 3);
  // coat body (slightly tapered) with tails over the stool
  const bx = x + 6 + sway;
  const top = base - 38 + breathe;
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(bx + 1, top);
  ctx.lineTo(bx + 13, top);
  ctx.lineTo(bx + 15, base - 14);
  ctx.lineTo(bx - 2, base - 12);
  ctx.closePath();
  ctx.fill();
  // lapel, shirt and cravat
  ctx.fillStyle = '#f0ead8';
  ctx.fillRect(bx + 8, top + 1, 4, 7);
  ctx.fillStyle = '#1a1414';
  ctx.fillRect(bx + 9, top + 2, 2, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(bx + 6, top + 2, 2, 20);
  // arm resting on the knee
  ctx.fillStyle = coat;
  ctx.fillRect(bx + 7, top + 6, 5, 13);
  ctx.fillRect(bx + 9, top + 16, 10, 4);
  ctx.fillStyle = '#e2bc98';
  ctx.fillRect(bx + 18, top + 16, 3, 4);
  // head
  const hx = bx + 7;
  const hy = top - 7;
  ctx.fillStyle = '#e8c4a0';
  ctx.beginPath();
  ctx.ellipse(hx, hy, 5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2416';
  ctx.beginPath();
  ctx.ellipse(hx - 2, hy - 2, 4.5, 4.5, 0, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fill();
  ctx.fillRect(hx - 6, hy - 3, 3, 6); // hair at the back
  ctx.fillStyle = '#1a1210';
  ctx.fillRect(hx + 2, hy - 1, 1.5, 1.5); // eye, looking toward the door
  // hats: top hat, wide brim, bare head
  ctx.fillStyle = hat;
  if (i === 0) {
    ctx.fillRect(hx - 7, hy - 6, 14, 2);
    ctx.fillRect(hx - 4.5, hy - 15, 9, 10);
  } else if (i === 1) {
    ctx.fillRect(hx - 8, hy - 5, 16, 2);
    ctx.fillRect(hx - 4.5, hy - 10, 9, 5);
  }
}

function drawFinaleBack(ctx, game) {
  const { level, camX, tick } = game;
  const f = level.finale;
  if (!f) return;
  const base = 13 * TILE;
  // lamplight zone by the door
  const zx = f.zoneX0 - camX;
  const zw = f.zoneX1 - f.zoneX0;
  if (zx > -zw - 100 && zx < W + 100) {
    const active = f.state === 'active';
    const pulse = reduceFlash() ? 0.8 : 0.75 + 0.25 * Math.sin(tick * 0.08);
    const g = ctx.createRadialGradient(zx + zw / 2, base - 20 * S, 4, zx + zw / 2, base - 20 * S, zw * 0.9);
    g.addColorStop(0, `rgba(255,214,120,${(active && f.inZone ? 0.42 : 0.28) * pulse})`);
    g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(zx - zw, base - 120 * S, zw * 3, 124 * S);
    ctx.fillStyle = `rgba(255,224,150,${0.5 * pulse})`;
    ctx.fillRect(zx, base - 2 * S, zw, 2 * S);
  }
  const coats = ['#3a4a6a', '#5a3a2a', '#4a4a44'];
  const hats = ['#1a1a1e', '#2a1a10', '#1e1e1e'];
  f.friendsX.forEach((fx, i) => {
    const x = fx - camX;
    if (x < -60 || x > W + 60) return;
    drawFriend(ctx, x, base, coats[i], hats[i], tick, i);
  });
  // the door
  const dx = f.doorX - camX + (f.rattle > 0 ? Math.sin(tick * 2.2) * 2 * S : 0);
  if (dx > -60 && dx < W + 60) {
    ctx.fillStyle = '#2a1a0c';
    ctx.fillRect(dx - 3 * S, base - 5 * TILE - 3 * S, TILE + 6 * S, 5 * TILE + 3 * S);
    ctx.fillStyle = '#6a4a28';
    ctx.fillRect(dx, base - 5 * TILE, TILE, 5 * TILE);
    ctx.fillStyle = '#5a3c20';
    for (let k = 1; k < 4; k++) ctx.fillRect(dx + (k * TILE) / 4 - 1, base - 5 * TILE, 2, 5 * TILE);
    ctx.fillStyle = '#3a3a40';
    ctx.fillRect(dx, base - 4.2 * TILE, TILE, 3 * S);
    ctx.fillRect(dx, base - 1.4 * TILE, TILE, 3 * S);
    ctx.fillStyle = '#c8a050';
    ctx.fillRect(dx + 4 * S, base - 2.6 * TILE, 3 * S, 3 * S);
  }
  if (f.state === 'active' && f.mode === 'tell') drawAlert(ctx, dx + TILE / 2, base - 5 * TILE - 26 * S, tick);
}

// ── Drawing ──// ── Drawing ────────────────────────────────────────────────
export function drawSetPiecesBack(ctx, game) {
  const { level, camX } = game;
  if (level.num === 6) {
    for (const sc of level.scaffolds || []) drawScaffold(ctx, sc, camX);
  }
  for (const cp of level.checkpoints || []) drawCheckpoint(ctx, cp, camX, game.tick);
  if (level.finale) drawFinaleBack(ctx, game);
}

export function drawSetPiecesMid(ctx, game) {
  const { level, camX } = game;
  const sp = level.sp || {};
  const surface = 13 * TILE;
  let lastAlert = -1e9;
  for (const s of level.dock || []) {
    const hx = s.homeX - camX;
    if (hx < -TILE || hx > W + TILE) continue;
    ctx.fillStyle = '#3a2614';
    if (!s.sink) ctx.fillRect(hx + TILE / 2 - 3, s.baseY + 6, 6, 3 * TILE);
    if (s.phase === 'gone') continue;
    const x = hx + (s.dx || 0);
    const y = s.y + (s.bob || 0);
    ctx.fillStyle = s.sink ? (s.phase === 'creak' ? '#7a5a34' : '#6a5a3a') : '#8a6238';
    ctx.fillRect(x + 1, y, s.w - 2, 10);
    ctx.fillStyle = s.sink ? '#4e6a3a' : '#a87a48';
    ctx.fillRect(x + 1, y, s.w - 2, 3);
    if (s.sink) {
      // mossy cracked plank = it will not hold
      ctx.fillStyle = '#2a3a1a';
      ctx.fillRect(x + 10, y + 4, 10, 2);
      ctx.fillRect(x + 6, y + 6, 4, 2);
    }
    // under the surface the plank is tinted by the water
    if (y + 10 > surface + 3 * S) {
      const top = Math.max(y, surface + 3 * S);
      ctx.fillStyle = 'rgba(30,70,120,0.62)';
      ctx.fillRect(x, top, s.w, y + 10 - top);
    }
    if (s.phase === 'creak') {
      // growing crack + the same "!" bubble bosses use: this plank is going
      const k = Math.min(1, s.pt / 20);
      ctx.fillStyle = '#1a1208';
      ctx.fillRect(x + 4, y + 3, (s.w - 8) * k, 2);
      ctx.strokeStyle = 'rgba(255,200,120,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y - 1, s.w, 12);
      if (s.homeX - lastAlert > 1.5 * TILE) drawAlert(ctx, x + s.w / 2, y - 62 * S, s.pt); // above Joseph's head
      lastAlert = s.homeX;
    }
  }
  for (const r of sp.ripples || []) {
    const x = r.x - camX;
    const k = r.t / 50;
    ctx.strokeStyle = `rgba(220,240,255,${0.8 * (1 - k)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, r.y, 6 * S + k * 26 * S, 2 * S + k * 4 * S, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(200,180,140,0.8)';
  for (const d of sp.dust || []) ctx.fillRect(d.x - camX, d.y, 2 * S, 2 * S);
}

export function drawSetPiecesFront(ctx, game) {
  const { level, camX } = game;
  const sp = level.sp;
  if (!sp) return;
  if (level.num === 4) drawNight(ctx, level, camX, game.tick);
  if (level.num === 4 && sp.barrelWarn > 0) {
    // Edge warning: a barrel is about to roll in from the right
    const top = 13 * TILE - 30 * S;
    drawAlert(ctx, W - 22 * S, top + 20 * S, sp.t);
  }
  if (level.num === 5) drawSnow(ctx, sp);
}

function drawNight(ctx, level, camX, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,40,0.5)';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (const d of level.decor) {
    if (d.type !== 'lamp') continue;
    const x = d.x - camX + 8 * S;
    if (x < -120 || x > W + 120) continue;
    const fl = 0.85 + 0.15 * Math.sin(t * 0.3 + d.x);
    const g = ctx.createRadialGradient(x, d.y + 6 * S, 4, x, d.y + 6 * S, 70 * S * fl);
    g.addColorStop(0, 'rgba(255,160,60,0.35)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 80 * S, d.y - 70 * S, 160 * S, 160 * S);
  }
  ctx.restore();
}

function drawSnow(ctx, sp) {
  ctx.save();
  ctx.fillStyle = 'rgba(210,225,255,0.16)';
  ctx.fillRect(0, 0, W, H);
  const w = sp.wind;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (const f of sp.flakes) {
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (w.mode !== 'calm') {
    // Wind streaks; denser during the gust
    const n = w.mode === 'gust' ? 26 : 10;
    ctx.strokeStyle = w.mode === 'gust' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const y = (i * 53 + sp.t * 3) % H;
      const x = W - ((i * 97 + sp.t * 14) % (W + 200));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 40 * S, y);
      ctx.stroke();
    }
    const label = w.mode === 'gust' ? '« WIND «' : 'WIND COMING';
    const lw = measureText(label, 12);
    drawText(ctx, label, W / 2 - lw / 2, 120 * S, w.mode === 'gust' ? '#ffffff' : '#d8e8ff', 12);
  }
  ctx.restore();
}

function drawScaffold(ctx, sc, camX) {
  const x = sc.x - camX;
  if (x < -sc.w - 40 || x > W + 40) return;
  ctx.save();
  ctx.strokeStyle = '#7a5a30';
  ctx.lineWidth = 3 * S;
  const bottom = sc.bottom;
  for (const px of [x + 4 * S, x + sc.w - 4 * S]) {
    ctx.beginPath();
    ctx.moveTo(px, sc.top);
    ctx.lineTo(px, bottom);
    ctx.stroke();
  }
  ctx.lineWidth = 2 * S;
  ctx.strokeStyle = '#6a4a26';
  for (let y = sc.top + 24 * S; y < bottom; y += 34 * S) {
    ctx.beginPath();
    ctx.moveTo(x + 4 * S, y);
    ctx.lineTo(x + sc.w - 4 * S, Math.min(bottom, y + 30 * S));
    ctx.stroke();
  }
  // half-built limestone wall behind (Nauvoo Temple construction)
  ctx.fillStyle = 'rgba(200,190,160,0.35)';
  ctx.fillRect(x + 8 * S, sc.top + 10 * S, sc.w - 16 * S, bottom - sc.top - 10 * S);
  ctx.restore();
}

function drawCheckpoint(ctx, cp, camX, t) {
  const x = cp.x - camX;
  if (x < -40 * S || x > W + 40 * S) return;
  const base = cp.y;
  ctx.save();
  // post
  ctx.fillStyle = '#4a3018';
  ctx.fillRect(x + 6 * S, base - 44 * S, 4 * S, 44 * S);
  ctx.fillRect(x + 6 * S, base - 44 * S, 12 * S, 3 * S);
  // lantern
  const lx = x + 15 * S;
  const ly = base - 40 * S;
  if (cp.lit) {
    const fl = 0.85 + 0.15 * Math.sin(t * 0.25);
    const g = ctx.createRadialGradient(lx, ly + 8 * S, 2, lx, ly + 8 * S, 46 * S * fl);
    g.addColorStop(0, 'rgba(255,220,120,0.6)');
    g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(lx - 50 * S, ly - 40 * S, 100 * S, 100 * S);
  }
  ctx.fillStyle = '#2a1a0c';
  ctx.fillRect(lx - 5 * S, ly + 1 * S, 10 * S, 2 * S);
  ctx.fillStyle = cp.lit ? '#ffd870' : '#3a3a40';
  ctx.fillRect(lx - 4 * S, ly + 3 * S, 8 * S, 10 * S);
  ctx.fillStyle = cp.lit ? '#fff4c0' : '#24242a';
  ctx.fillRect(lx - 2 * S, ly + 5 * S, 4 * S, 6 * S);
  ctx.fillStyle = '#2a1a0c';
  ctx.fillRect(lx - 5 * S, ly + 13 * S, 10 * S, 2 * S);
  ctx.restore();
}

/** Boss health bar with the boss's name; the tick marks the phase change at half health. */
export function drawBossBar(ctx, boss, name, phase, alpha = 1) {
  const bw = Math.round(W * 0.5);
  const bx = Math.round((W - bw) / 2);
  const by = 46 * S;
  const ratio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
  const nw = measureText(name, 8);
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  drawText(ctx, name, W / 2 - nw / 2, by - 12 * S, phase === 2 ? '#ff9a70' : '#f0d078', 8);
  drawRect(ctx, bx - 3, by - 3, bw + 6, 8 * S + 6, '#000000');
  drawRect(ctx, bx - 1, by - 1, bw + 2, 8 * S + 2, '#a07a30');
  drawRect(ctx, bx, by, bw, 8 * S, '#1a0c0c');
  const fill = boss.type === 'finale' ? '#e0b040' : phase === 2 ? '#e04a2a' : '#c83a3a';
  drawRect(ctx, bx, by, Math.round(bw * ratio), 8 * S, fill);
  drawRect(ctx, bx, by, Math.round(bw * ratio), 2 * S, 'rgba(255,255,255,0.25)');
  if (boss.type !== 'finale') drawRect(ctx, bx + bw / 2 - 1, by - 2, 2, 8 * S + 4, '#f0e6d0');
  ctx.restore();
}

/** Boss entrance banner: sits where the bar will be, then hands over to it. */
export function drawBossBanner(ctx, name, t, total) {
  const k = t / total; // 1 → 0
  const a = Math.min(1, (1 - k) * 6, k * 4);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  const bw = Math.round(W * 0.56);
  const bx = Math.round((W - bw) / 2);
  const by = 24 * S;
  const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  g.addColorStop(0, 'rgba(10,6,4,0)');
  g.addColorStop(0.15, 'rgba(10,6,4,0.82)');
  g.addColorStop(0.85, 'rgba(10,6,4,0.82)');
  g.addColorStop(1, 'rgba(10,6,4,0)');
  ctx.fillStyle = g;
  ctx.fillRect(bx, by, bw, 34 * S);
  ctx.fillStyle = '#c8a050';
  ctx.fillRect(bx + bw * 0.15, by, bw * 0.7, 1 * S);
  ctx.fillRect(bx + bw * 0.15, by + 34 * S - 1 * S, bw * 0.7, 1 * S);
  const nw = measureText(name, 12);
  drawText(ctx, name, W / 2 - nw / 2, by + 10 * S, '#f0d078', 12);
  ctx.restore();
}
