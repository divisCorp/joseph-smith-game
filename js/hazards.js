/**
 * Hazards: boss attacks and chapter set pieces (barrels, falling bricks, wind snow…).
 * Everything here is drawn procedurally on the canvas; sprite sheets are untouched.
 * A hazard with `warn > 0` is only a telegraph (shadow / marker) and cannot hurt yet.
 */
import { SCALE, GRAVITY, MAX_FALL, H, W } from './constants.js?v=79';
import { drawKnife } from './sprites.js?v=79';

const S = SCALE;

export function createHazard(kind, x, y, o = {}) {
  const h = {
    kind,
    x,
    y,
    vx: o.vx || 0,
    vy: o.vy || 0,
    w: o.w || 16 * S,
    h: o.h || 16 * S,
    t: 0,
    life: o.life ?? 600,
    warn: o.warn || 0,
    damage: o.damage ?? 1,
    alive: true,
    breakable: !!o.breakable,
    owner: o.owner || null,
    landY: o.landY ?? null,
    spin: 0,
  };
  if (kind === 'barrel') { h.w = 22 * S; h.h = 22 * S; h.breakable = true; }
  if (kind === 'torch') { h.w = 10 * S; h.h = 10 * S; }
  if (kind === 'flame') { h.w = 18 * S; h.h = 16 * S; h.life = o.life ?? 110; }
  if (kind === 'shock') { h.w = 18 * S; h.h = 14 * S; h.life = o.life ?? 70; }
  if (kind === 'keys') { h.w = 16 * S; h.h = 12 * S; h.life = o.life ?? 150; h.dir = Math.sign(h.vx) || 1; }
  if (kind === 'drop') { h.w = 10 * S; h.h = 14 * S; }
  if (kind === 'brick') { h.w = 14 * S; h.h = 8 * S; }
  if (kind === 'knife') { h.w = 8 * S; h.h = 4 * S; h.life = o.life ?? 140; }
  if (kind === 'puff') { h.damage = 0; h.life = o.life ?? 24; }
  return h;
}

/** Top of the first solid under x starting at y (or null). */
export function groundTopBelow(solids, x, y, groundOnly = false) {
  let best = null;
  for (const s of solids) {
    if (groundOnly && s.kind === 'plat') continue;
    if (x < s.x || x > s.x + s.w) continue;
    if (s.y + 0.5 < y) continue;
    if (best === null || s.y < best) best = s.y;
  }
  return best;
}

function landOn(h, solids, groundOnly) {
  const foot = h.y + h.h;
  for (const s of solids) {
    if (groundOnly && s.kind === 'plat') continue;
    if (h.x + h.w * 0.5 < s.x || h.x + h.w * 0.5 > s.x + s.w) continue;
    if (foot >= s.y && foot - h.vy <= s.y + 2) return s.y;
  }
  return null;
}

export function hazardHitbox(h) {
  const m = 2 * S;
  return { x: h.x + m, y: h.y + m, w: Math.max(2, h.w - 2 * m), h: Math.max(2, h.h - 2 * m) };
}

export function updateHazards(list, solids, dt, worldW) {
  const spawned = [];
  for (const h of list) {
    if (!h.alive) continue;
    h.t += dt;
    if (h.warn > 0) {
      h.warn -= dt;
      continue;
    }
    h.life -= dt;
    if (h.life <= 0) { h.alive = false; continue; }
    switch (h.kind) {
      case 'barrel': {
        h.vy = Math.min(MAX_FALL, h.vy + GRAVITY);
        h.x += h.vx;
        h.y += h.vy;
        const top = landOn(h, solids, true);
        if (top !== null && h.vy >= 0) { h.y = top - h.h; h.vy = 0; }
        h.spin += h.vx * 0.04;
        break;
      }
      case 'torch': {
        h.vy = Math.min(MAX_FALL, h.vy + GRAVITY * 0.8);
        h.x += h.vx;
        h.y += h.vy;
        h.spin += 0.3;
        const top = landOn(h, solids, false);
        if (top !== null && h.vy > 0) {
          h.alive = false;
          spawned.push(createHazard('flame', h.x - 4 * S, top - 16 * S, { life: 100 }));
        }
        break;
      }
      case 'shock':
        h.x += h.vx;
        break;
      case 'keys': {
        // Boomerang: flies out, slows, comes back toward the thrower
        h.vx -= h.dir * 0.11 * S * dt;
        h.x += h.vx;
        h.spin += 0.35;
        if (h.owner && h.t > 40) {
          const ox = h.owner.x + h.owner.w / 2;
          if (Math.abs(h.x + h.w / 2 - ox) < 12 * S || !h.owner.alive) h.alive = false;
        }
        break;
      }
      case 'drop':
      case 'brick': {
        h.vy = Math.min(MAX_FALL * 1.2, h.vy + GRAVITY * 0.9);
        h.y += h.vy;
        const top = landOn(h, solids, false);
        if (top !== null || (h.landY !== null && h.y + h.h >= h.landY)) {
          h.alive = false;
          spawned.push(createHazard('puff', h.x - 4 * S, (top ?? h.landY) - 10 * S, { w: h.w + 8 * S, h: 10 * S }));
        }
        break;
      }
      case 'knife':
        h.x += h.vx;
        h.y += h.vy;
        break;
      default:
        break;
    }
    if (h.y > H + 60 * S || h.x < -60 * S || h.x > worldW + 60 * S) h.alive = false;
  }
  for (const s of spawned) list.push(s);
  for (let i = list.length - 1; i >= 0; i--) if (!list[i].alive) list.splice(i, 1);
}

export function hazardActive(h) {
  return h.alive && h.warn <= 0 && h.damage > 0;
}

// ── Drawing ───────────────────────────────────────────────
function ell(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawWarnMarker(ctx, h, camX) {
  // Pulsing shadow where something is about to land
  const x = h.x - camX + h.w / 2;
  const y = h.landY ?? h.y + h.h;
  const pulse = 0.35 + 0.35 * Math.abs(Math.sin(h.t * 0.25));
  ell(ctx, x, y - 2, h.w * 0.8, 4 * S, `rgba(0,0,0,${pulse})`);
  ctx.strokeStyle = h.kind === 'drop' ? `rgba(190,120,255,${pulse + 0.2})` : `rgba(255,200,80,${pulse + 0.2})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y - 2, h.w * 0.8, 4 * S, 0, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawHazards(ctx, list, camX, tick) {
  for (const h of list) {
    if (!h.alive) continue;
    const x = h.x - camX;
    if (x < -80 * S || x > W + 80 * S) continue;
    if (h.warn > 0) {
      if (h.kind === 'drop' || h.kind === 'brick') drawWarnMarker(ctx, h, camX);
      continue;
    }
    switch (h.kind) {
      case 'barrel': {
        const cx = x + h.w / 2;
        const cy = h.y + h.h / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(h.spin);
        ell(ctx, 0, 0, h.w / 2, h.h / 2, '#6a4222');
        ell(ctx, 0, 0, h.w / 2 - 3 * S, h.h / 2 - 3 * S, '#8a5a30');
        ctx.strokeStyle = '#2a1a0c';
        ctx.lineWidth = 2 * S;
        ctx.beginPath();
        ctx.moveTo(-h.w / 2 + 2, 0);
        ctx.lineTo(h.w / 2 - 2, 0);
        ctx.moveTo(0, -h.h / 2 + 2);
        ctx.lineTo(0, h.h / 2 - 2);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'torch': {
        ctx.save();
        ctx.translate(x + h.w / 2, h.y + h.h / 2);
        ctx.rotate(h.spin);
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(-2 * S, -6 * S, 4 * S, 12 * S);
        ell(ctx, 0, -7 * S, 5 * S, 6 * S, '#ff8a20');
        ell(ctx, 0, -7 * S, 2.5 * S, 3.5 * S, '#ffe080');
        ctx.restore();
        break;
      }
      case 'flame': {
        const f = Math.sin((h.t + h.x) * 0.4) * 2 * S;
        const fade = Math.min(1, h.life / 30);
        ctx.save();
        ctx.globalAlpha = fade;
        ell(ctx, x + h.w / 2, h.y + h.h - 2 * S, h.w / 2 + 2 * S, 4 * S, 'rgba(255,120,30,0.35)');
        for (let i = 0; i < 3; i++) {
          const fx = x + 3 * S + i * 6 * S;
          ctx.fillStyle = i === 1 ? '#ffb030' : '#ff6a20';
          ctx.beginPath();
          ctx.moveTo(fx - 3 * S, h.y + h.h);
          ctx.quadraticCurveTo(fx, h.y + 2 * S + (i === 1 ? f : -f), fx + 3 * S, h.y + h.h);
          ctx.fill();
        }
        ell(ctx, x + h.w / 2, h.y + h.h - 4 * S, 3 * S, 4 * S, '#ffe8a0');
        ctx.restore();
        break;
      }
      case 'shock': {
        const a = Math.min(1, h.life / 20);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#d8c8a0';
        ctx.beginPath();
        ctx.moveTo(x, h.y + h.h);
        ctx.quadraticCurveTo(x + h.w / 2, h.y - 4 * S, x + h.w, h.y + h.h);
        ctx.fill();
        ctx.fillStyle = '#a89070';
        ctx.fillRect(x + 2 * S, h.y + h.h - 3 * S, h.w - 4 * S, 3 * S);
        ctx.restore();
        break;
      }
      case 'keys': {
        ctx.save();
        ctx.translate(x + h.w / 2, h.y + h.h / 2);
        ctx.rotate(h.spin);
        ctx.strokeStyle = '#e8c860';
        ctx.lineWidth = 2 * S;
        ctx.beginPath();
        ctx.arc(0, 0, 5 * S, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#c8a040';
        ctx.fillRect(4 * S, -1 * S, 7 * S, 2 * S);
        ctx.fillRect(9 * S, -1 * S, 2 * S, 4 * S);
        ctx.fillRect(-11 * S, -1 * S, 7 * S, 2 * S);
        ctx.restore();
        break;
      }
      case 'drop': {
        ctx.fillStyle = '#5a2a8a';
        ctx.beginPath();
        ctx.moveTo(x + h.w / 2, h.y);
        ctx.quadraticCurveTo(x + h.w + 2, h.y + h.h, x + h.w / 2, h.y + h.h);
        ctx.quadraticCurveTo(x - 2, h.y + h.h, x + h.w / 2, h.y);
        ctx.fill();
        ctx.lineWidth = 1.5 * S;
        ctx.strokeStyle = '#f2e6ff'; // pale rim so it reads on dark ground without relying on hue
        ctx.stroke();
        ell(ctx, x + h.w / 2 - 1 * S, h.y + h.h - 5 * S, 1.5 * S, 2 * S, '#b080e0');
        break;
      }
      case 'brick':
        ctx.fillStyle = '#9a4a30';
        ctx.fillRect(x, h.y, h.w, h.h);
        ctx.fillStyle = '#c86a48';
        ctx.fillRect(x + 1 * S, h.y + 1 * S, h.w - 2 * S, 2 * S);
        break;
      case 'knife':
        // mobs throw stones; the hitbox and id stay 'knife' so the rules are unchanged
        drawKnife(ctx, x, h.y, Math.sign(h.vx) || 1);
        break;
      case 'puff': {
        const a = Math.max(0, h.life / 24);
        for (let i = 0; i < 3; i++) {
          ell(ctx, x + (i + 0.5) * (h.w / 3), h.y + h.h / 2 - (1 - a) * 6 * S, 5 * S * (1.4 - a * 0.4), 4 * S, `rgba(200,190,170,${a * 0.6})`);
        }
        break;
      }
      default:
        break;
    }
  }
}

/** "!" bubble used for every enemy wind-up tell. */
export function drawAlert(ctx, cx, topY, t, color = '#ffd040') {
  const bob = Math.sin(t * 0.4) * 2 * S;
  const y = topY - 22 * S + bob;
  ctx.save();
  ctx.fillStyle = 'rgba(20,10,4,0.85)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(cx - 8 * S, y - 9 * S, 16 * S, 18 * S, 4 * S) : ctx.rect(cx - 8 * S, y - 9 * S, 16 * S, 18 * S);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(cx - 1.5 * S, y - 6 * S, 3 * S, 8 * S);
  ctx.fillRect(cx - 1.5 * S, y + 4 * S, 3 * S, 3 * S);
  ctx.restore();
}
