import { W, H, STATES, COLORS, MAX_LEVEL, SCALE, LEVEL_META } from './constants.js';
import { justPressed, clearAll, isDown as isDownHold } from './input.js';
import {
  createPlayer,
  updatePlayer,
  drawPlayer,
  playerHitbox,
  playerAttackBox,
  hurtPlayer,
  aabb,
} from './player.js';
import { updateEnemy, drawEnemy, enemyHitbox, hurtEnemy } from './enemy.js';
import { createLevel, drawLevelBackground, drawLevelTiles } from './level.js';
import { updatePlates, drawPlates, plateHitbox, updateKnives, drawKnives, knifeHitbox } from './projectiles.js';
import {
  drawHeart,
  drawText,
  drawCentered,
  drawRect,
  drawPanel,
  drawJoseph,
  drawPortrait,
  drawMoroni,
  drawPlateChest,
  measureText,
} from './sprites.js';
import { sfx, syncAudio, tickMusic } from './audio.js';

export function createGame() {
  return {
    state: STATES.TITLE,
    level: null,
    levelNum: 1,
    player: null,
    camX: 0,
    score: 0,
    message: '',
    messageT: 0,
    bossIntro: false,
    titleBlink: 0,
    tick: 0,
    clearTimer: 0,
    visionT: 0,
    martyrTimer: 0,
    martyrEnding: false,
    martyrFade: 0,
    cloudDefeated: false,
    hasPlates: false,
    shake: 0,
    introFade: 0,
    titleLevel: null,
  };
}

export function startCampaign(game) {
  game.score = 0;
  game.hasPlates = false;
  startLevel(game, 1, true);
}

export function startLevel(game, num, resetScore = false) {
  const level = createLevel(num);
  game.level = level;
  game.levelNum = num;
  game.player = createPlayer(level.spawn.x, level.spawn.y, { young: num === 1, canThrow: !!game.hasPlates });
  game.camX = Math.max(0, game.player.x + game.player.w / 2 - W * 0.5);
  if (resetScore) game.score = 0;
  game.state = STATES.PLAYING;
  game.bossIntro = false;
  game.message = '';
  game.messageT = 0;
  game.clearTimer = 0;
  game.visionT = 0;
  game.martyrTimer = 0;
  game.martyrEnding = false;
  game.martyrFade = 0;
  game.cloudDefeated = false;
  game.shake = 0;
  game.introFade = 36;
  const meta = LEVEL_META[num];
  if (meta?.name) {
    game.message = meta.name.toUpperCase();
    game.messageT = 80;
  }
  clearAll();
}

export function updateGame(game, dt) {
  game.tick += dt;
  game.titleBlink += dt;
  syncAudio(game);
  tickMusic(dt);

  if (game.state === STATES.TITLE) {
    if (justPressed('start') || justPressed('attack')) {
      startCampaign(game);
    }
    return;
  }

  if (game.state === STATES.CLEAR) {
    game.clearTimer += dt;
    if (game.clearTimer > 120 || justPressed('start') || justPressed('attack')) {
      const next = game.levelNum + 1;
      if (next <= MAX_LEVEL) startLevel(game, next, false);
      else {
        game.state = STATES.WIN;
        clearAll();
      }
    }
    return;
  }

  if (game.state === STATES.WIN || game.state === STATES.LOSE) {
    if (justPressed('start') || justPressed('attack')) {
      game.state = STATES.TITLE;
      clearAll();
    }
    return;
  }

  if (game.state === STATES.PLAYING) {
    if (justPressed('pause') && game.visionT <= 0 && !game.martyrEnding) {
      game.state = STATES.PAUSED;
      return;
    }
    tickPlay(game, dt);
  } else if (game.state === STATES.PAUSED) {
    if (justPressed('pause') || justPressed('start')) {
      game.state = STATES.PLAYING;
    }
  }
}

function goClear(game) {
  game.state = STATES.CLEAR;
  game.clearTimer = 0;
  game.messageT = 0;
  clearAll();
}

function goWin(game) {
  game.state = STATES.WIN;
  game.messageT = 0;
  clearAll();
}

function tickPlay(game, dt) {
  const { player, level } = game;
  if (game.messageT > 0) game.messageT -= dt;
  if (game.shake > 0) game.shake -= dt;
  if (game.introFade > 0) game.introFade -= dt;

  // First Vision overlay — pause normal play
  if (game.visionT > 0) {
    game.visionT -= dt;
    if (game.visionT <= 0) {
      game.visionT = 0;
      goClear(game);
    }
    return;
  }

  // Martyr ending sequence
  if (game.martyrEnding) {
    game.martyrFade += dt;
    if (game.martyrFade > 120) {
      goWin(game);
    }
    return;
  }

  updatePlayer(player, level.solids, dt);

  const target = player.x + player.w / 2 - W * 0.5;
  game.camX += (target - game.camX) * 0.15;
  if (game.camX < 0) game.camX = 0;
  const maxCam = level.widthPx - W;
  if (game.camX > maxCam) game.camX = maxCam;

  if (!game.bossIntro && level.bossTitle && player.x >= level.bossZoneX) {
    game.bossIntro = true;
    game.message = level.bossTitle || 'BOSS!';
    game.messageT = 90;
  }

  // Faith pray vs cloud — kneel anywhere under/near the grove cloud
  const cloud = level.enemies.find((e) => e.type === 'cloud' && e.alive);
  if (cloud && player.alive) {
    const px = player.x + player.w / 2;
    const cx = cloud.x + cloud.w / 2;
    const inGrove = player.x >= level.bossZoneX - 4 * SCALE;
    const nearX = Math.abs(px - cx) < 110 * SCALE;
    const praying =
      (player.crouching || isDownHold('down')) && Math.abs(player.vx) < 0.2 * SCALE;
    if ((inGrove || nearX) && praying) {
      const killed = hurtEnemy(cloud, 2.4 * dt, { faith: true });
      const pct = Math.max(0, Math.min(100, Math.round((1 - cloud.hp / cloud.maxHp) * 100)));
      game.message = `Praying… ${pct}%`;
      game.messageT = 30;
      if (killed) {
        game.score += cloud.score;
        game.cloudDefeated = true;
        game.visionT = 200;
        sfx('heal');
        return;
      }
    } else if (inGrove || nearX) {
      game.message = 'Kneel (↓) and pray';
      game.messageT = 20;
    }
  }

  const fork = playerAttackBox(player);
  if (fork && player.alive) {
    if (!player.forkHits) player.forkHits = new Set();
    for (const e of level.enemies) {
      if (!e.alive || e.immuneToPlates) continue;
      if (player.forkHits.has(e)) continue;
      if (aabb(fork, enemyHitbox(e))) {
        player.forkHits.add(e);
        const killed = hurtEnemy(e, 1);
        sfx('hit');
        e.vx = player.facing * 2.6 * SCALE;
        e.vy = -2.2 * SCALE;
        if (killed) game.score += e.score;
      }
    }
  }

  for (const e of level.enemies) {
    if (!e.alive) continue;
    updateEnemy(e, level.solids, player, dt);

    if (player.alive && aabb(playerHitbox(player), enemyHitbox(e))) {
      if (hurtPlayer(player, e.damage)) {
        player.vx = (player.x < e.x ? -1 : 1) * 2.5 * SCALE;
        game.shake = 10;
      }
    }
  }

  updatePlates(player.plates, dt, game.camX, level.widthPx);
  for (const e of level.enemies) {
    if (!e.knives) continue;
    updateKnives(e.knives, dt, game.camX, level.widthPx);
    if (!player.alive) continue;
    for (const k of e.knives) {
      if (!k.alive) continue;
      if (aabb(playerHitbox(player), knifeHitbox(k))) {
        k.alive = false;
        if (hurtPlayer(player, k.damage)) {
          player.vx = k.facing * 2.2 * SCALE;
          game.shake = 10;
        }
      }
    }
  }
  for (const plate of player.plates) {
    if (!plate.alive) continue;
    const ph = plateHitbox(plate);
    for (const e of level.enemies) {
      if (!e.alive) continue;
      if (aabb(ph, enemyHitbox(e))) {
        if (e.immuneToPlates) {
          plate.alive = false;
          sfx('hit');
          break;
        }
        plate.alive = false;
        const killed = hurtEnemy(e, plate.damage);
        sfx('hit');
        if (killed) game.score += e.score;
        e.vx = plate.facing * 2.2 * SCALE;
        e.vy = -2 * SCALE;
        break;
      }
    }
  }

  // Pickup plates chest (level 3)
  if (level.goal === 'pickup' && level.pickup && !level.pickup.taken && player.alive) {
    const pk = level.pickup;
    if (aabb(playerHitbox(player), { x: pk.x, y: pk.y, w: pk.w || 40, h: pk.h || 28 })) {
      pk.taken = true;
      game.hasPlates = true;
      if (player) player.canThrow = true;
      game.score += 500;
      sfx('heal');
      goClear(game);
      return;
    }
  }

  // Reach Moroni (level 2)
  if (level.goal === 'reach' && player.alive && level.goalX != null) {
    if (player.x >= level.goalX) {
      game.score += 500;
      sfx('heal');
      goClear(game);
      return;
    }
  }

  // Martyr last stand (level 7)
  if (level.goal === 'martyr' && player.alive && level.goalX != null) {
    if (player.x >= level.goalX && game.martyrTimer <= 0) {
      game.martyrTimer = 1;
      game.message = 'LAST STAND';
      game.messageT = 60;
    }
    if (game.martyrTimer > 0) {
      game.martyrTimer += dt;
      // Survive ~20s (assuming ~60fps dt≈1 → 180 frames ≈ 3s at dt=1; use 180 frames as spec)
      // Spec: ~180 frames then fade. Also trigger if all mobs dead after reaching window.
      const mobsAlive = level.enemies.some((e) => e.alive);
      if (game.martyrTimer > 180 || (!mobsAlive && game.martyrTimer > 60)) {
        game.martyrEnding = true;
        game.martyrFade = 0;
        return;
      }
    }
  }

  // Boss-defeat clear (default for levels with boss / cloud handled via vision)
  if (level.goal === 'boss' || !level.goal) {
    const boss = level.enemies.find((e) => e.type === 'boss' || e.type === 'cloud');
    if (boss && !boss.alive && player.alive && !game.cloudDefeated) {
      // cloud path uses visionT; regular bosses clear/win here
      if (boss.type === 'cloud') {
        // handled above when killed by faith
      } else if (level.num >= MAX_LEVEL) {
        goWin(game);
      } else {
        goClear(game);
      }
      return;
    }
  }

  if (!player.alive) {
    // During martyr last stand / ending — memorial WIN instead of LOSE
    if (game.martyrEnding || (level.goal === 'martyr' && game.martyrTimer > 0)) {
      game.martyrEnding = true;
      game.martyrFade = Math.max(game.martyrFade, 1);
      player.alive = true; // keep drawing respectful fade, not corpse defeat
      player.hp = 0;
      return;
    }
    game.state = STATES.LOSE;
    clearAll();
  }
}

export function drawGame(ctx, game) {
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, W, H);

  if (game.state === STATES.TITLE) {
    drawTitleScene(ctx, game);
    return;
  }

  if (!game.level || !game.player) return;

  ctx.save();
  if (game.shake > 0) {
    const mag = Math.min(6, game.shake * 0.55);
    ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
  }
  const zoom = 1.22;
  const ax = W * 0.5;
  const ay = H * 0.72;
  ctx.translate(ax, ay);
  ctx.scale(zoom, zoom);
  ctx.translate(-ax, -ay);

  drawLevelBackground(ctx, game.camX, game.level);
  drawLevelTiles(ctx, game.camX, game.level);

  // Plate chest
  if (game.level.pickup) {
    drawPlateChest(ctx, game.level.pickup.x - game.camX, game.level.pickup.y, game.level.pickup.taken);
  }

  // Moroni NPC
  if (game.level.moroni) {
    drawMoroni(ctx, game.level.moroni.x - game.camX, game.level.moroni.y, game.tick);
  }

  for (const e of game.level.enemies) {
    drawEnemy(ctx, e, game.camX);
  }
  drawPlayer(ctx, game.player, game.camX);
  drawPlates(ctx, game.player.plates, game.camX);
  for (const e of game.level.enemies) {
    if (e.knives) drawKnives(ctx, e.knives, game.camX);
  }

  drawVignette(ctx);
  ctx.restore();

  drawHUD(ctx, game);

  // Faith meter only when the cloud is in play
  const cloud = game.level.enemies.find((e) => e.type === 'cloud' && e.alive);
  const nearCloud =
    cloud &&
    game.player &&
    (game.player.x >= game.level.bossZoneX - 8 * SCALE ||
      Math.abs(cloud.x - game.camX - W * 0.5) < W);
  if (nearCloud) {
    const label = 'PRAY';
    const lx = 8 * SCALE;
    const by = 28 * SCALE;
    const lw = measureText(label, 8);
    drawText(ctx, label, lx, by + 1 * SCALE, COLORS.uiGold, 8);
    const bx = lx + lw + 8;
    const bw = W - bx - 10 * SCALE;
    drawRect(ctx, bx - 2, by - 2, bw + 4, 12 * SCALE, '#2a1a08');
    drawRect(ctx, bx, by, bw, 8 * SCALE, '#140810');
    const ratio = Math.max(0, 1 - cloud.hp / cloud.maxHp);
    drawRect(ctx, bx + 2, by + 2, Math.max(0, (bw - 4) * ratio), 8 * SCALE - 4, '#d4a84b');
  }

  if (game.messageT > 0) {
    const mw = W - 56 * SCALE;
    drawPanel(ctx, 28 * SCALE, 86 * SCALE, mw, 32 * SCALE);
    drawCentered(ctx, game.message, 96 * SCALE, COLORS.uiGold, 12);
  }

  if (game.introFade > 0) {
    drawRect(ctx, 0, 0, W, H, `rgba(6,4,2,${Math.min(0.85, game.introFade / 36)})`);
  }

  if (game.visionT > 0) {
    drawVisionOverlay(ctx, game);
  }

  if (game.martyrEnding) {
    drawMartyrFade(ctx, game);
  }

  if (game.state === STATES.PAUSED || game.state === STATES.CLEAR) {
    drawRect(ctx, 0, 0, W, H, 'rgba(0,0,0,0.25)');
  }
}

function drawVisionOverlay(ctx, game) {
  const t = 200 - game.visionT;
  const alpha = Math.min(0.92, t / 40);
  // Golden light wash
  const g = ctx.createRadialGradient(W / 2, H * 0.35, 10, W / 2, H * 0.4, W * 0.7);
  g.addColorStop(0, `rgba(255,240,180,${0.85 * alpha})`);
  g.addColorStop(0.45, `rgba(255,210,100,${0.45 * alpha})`);
  g.addColorStop(1, `rgba(255,255,255,${0.15 * alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Two radiant silhouettes (Father & Son) — stylized light only, no faces
  if (t > 30) {
    const fade = Math.min(1, (t - 30) / 40);
    ctx.save();
    ctx.globalAlpha = fade * 0.9;
    for (const [cx, cy] of [
      [W * 0.38, H * 0.32],
      [W * 0.58, H * 0.34],
    ]) {
      ctx.fillStyle = 'rgba(255,250,230,0.95)';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 20, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy + 28, 22, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,230,150,0.35)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 10, 40, 70, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (t > 70) {
    drawCentered(ctx, 'This is My Beloved Son.', 200 * SCALE, '#fff8e0', 12);
    drawCentered(ctx, 'Hear Him!', 218 * SCALE, COLORS.uiGold, 14);
  }
}

function drawMartyrFade(ctx, game) {
  const a = Math.min(0.88, game.martyrFade / 90);
  drawRect(ctx, 0, 0, W, H, `rgba(8,6,4,${a})`);
  if (game.martyrFade > 40) {
    drawCentered(ctx, 'He sealed his testimony.', 160 * SCALE, COLORS.uiGold, 12);
    drawCentered(ctx, 'Carthage, 1844', 180 * SCALE, COLORS.uiCream, 10);
  }
}

function drawVignette(ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.2, W / 2, H * 0.5, H * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.72, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(4,2,0,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawHUD(_ctx, _game) {
  // HTML HUD in index.html — canvas bar was clipping/overlapping on widescreen
}

function drawTitleScene(ctx, game) {
  if (!game.titleLevel) {
    try {
      game.titleLevel = createLevel(1);
    } catch (_) {
      game.titleLevel = null;
    }
  }
  if (game.titleLevel) {
    const cam = 36 + (Math.sin(game.titleBlink * 0.01) * 0.5 + 0.5) * 64;
    drawLevelBackground(ctx, cam, game.titleLevel);
    drawLevelTiles(ctx, cam, game.titleLevel);
    const walk = Math.floor(game.titleBlink / 10) % 4;
    const bob = Math.sin(game.titleBlink * 0.08) * 1.5;
    drawJoseph(ctx, W / 2 - 18, game.titleLevel.spawn.y + bob, 1, walk, false, false, false, true, false);
  } else {
    for (let i = 0; i < 20; i++) {
      const t = i / 20;
      drawRect(ctx, 0, i * 24, W, 24, `rgb(${16 + t * 42},${12 + t * 48},${32 + t * 88})`);
    }
  }
  drawVignette(ctx);
  drawRect(ctx, 0, 0, W, 56, 'rgba(6,4,2,0.35)');
  drawRect(ctx, 0, H - 90, W, 90, 'rgba(6,4,2,0.45)');
}
