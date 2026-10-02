/**
 * Chapter set pieces + checkpoints (procedural canvas art; sprite sheets untouched).
 *  ch4 Missouri Night — torch-lit night, rolling barrels from the mob's wagons
 *  ch5 Far West Road  — winter snowstorm; telegraphed gusts push Joseph back
 *  ch6 Nauvoo         — temple-building scaffolds with falling bricks, river dock with sinking planks
 */
import { W, H, TILE, SCALE } from './constants.js';
import { createHazard, groundTopBelow, drawAlert } from './hazards.js';
import { drawText, measureText, drawRect } from './sprites.js';
import { sfx } from './audio.js';

const S = SCALE;

export function initSetPieces(level) {
  level.hazards = level.hazards || [];
  level.sp = { t: 0, barrelT: 90, barrelWarn: 0, brickT: 60, wind: { mode: 'calm', t: 0 }, flakes: [] };
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
    const s = { x: c * TILE, y, w: TILE, h: 8, kind: 'plat', dock: true, sink, unsafe: sink, baseY: y, st: 0, gone: 0 };
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
    for (const s of level.dock || []) {
      if (!s.sink) continue;
      if (s.gone > 0) {
        s.gone -= dt;
        if (s.gone <= 0 && !playerOn(p, { ...s, y: s.baseY })) {
          s.x = s.homeX ?? s.x;
          s.y = s.baseY;
          s.st = 0;
        } else if (s.gone <= 0) s.gone = 10;
        continue;
      }
      if (playerOn(p, s)) s.st += dt;
      else if (s.st > 0 && s.st < 26) s.st = Math.max(0, s.st - dt * 0.5);
      if (s.st > 26) {
        s.y += 1.6 * S * dt * 0.5;
        if (s.y > s.baseY + 22 * S) {
          s.homeX = s.homeX ?? s.x;
          s.x = -9999;
          s.gone = 150;
          sfx('splash');
        }
      }
    }
  }
}

// ── Drawing ────────────────────────────────────────────────
export function drawSetPiecesBack(ctx, game) {
  const { level, camX } = game;
  if (level.num === 6) {
    for (const sc of level.scaffolds || []) drawScaffold(ctx, sc, camX);
  }
  for (const cp of level.checkpoints || []) drawCheckpoint(ctx, cp, camX, game.tick);
}

export function drawSetPiecesMid(ctx, game) {
  const { level, camX } = game;
  for (const s of level.dock || []) {
    const hx = (s.homeX ?? s.x) - camX;
    if (hx < -TILE || hx > W + TILE) continue;
    // posts
    ctx.fillStyle = '#3a2614';
    if (!s.sink) ctx.fillRect(hx + TILE / 2 - 3, s.baseY + 6, 6, 3 * TILE);
    if (s.x < -1000) continue;
    const x = s.x - camX;
    const wob = s.sink && s.st > 0 ? Math.sin(game.tick * 0.9) * 1.5 : 0;
    ctx.fillStyle = s.sink ? '#6a5a3a' : '#8a6238';
    ctx.fillRect(x + 1, s.y + wob, s.w - 2, 10);
    ctx.fillStyle = s.sink ? '#4e6a3a' : '#a87a48';
    ctx.fillRect(x + 1, s.y + wob, s.w - 2, 3);
    if (s.sink) {
      // mossy cracked plank = tell that it will not hold
      ctx.fillStyle = '#2a3a1a';
      ctx.fillRect(x + 10, s.y + wob + 4, 10, 2);
    }
  }
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
export function drawBossBar(ctx, boss, name, phase) {
  const bw = Math.round(W * 0.5);
  const bx = Math.round((W - bw) / 2);
  const by = 46 * S;
  const ratio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
  const nw = measureText(name, 8);
  drawText(ctx, name, W / 2 - nw / 2, by - 12 * S, phase === 2 ? '#ff9a70' : '#f0d078', 8);
  drawRect(ctx, bx - 3, by - 3, bw + 6, 8 * S + 6, '#000000');
  drawRect(ctx, bx - 1, by - 1, bw + 2, 8 * S + 2, '#a07a30');
  drawRect(ctx, bx, by, bw, 8 * S, '#1a0c0c');
  const fill = boss.type === 'cloud' ? '#8a5ac8' : phase === 2 ? '#e04a2a' : '#c83a3a';
  drawRect(ctx, bx, by, Math.round(bw * ratio), 8 * S, fill);
  drawRect(ctx, bx, by, Math.round(bw * ratio), 2 * S, 'rgba(255,255,255,0.25)');
  drawRect(ctx, bx + bw / 2 - 1, by - 2, 2, 8 * S + 4, '#f0e6d0');
}
