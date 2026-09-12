import { W, H, STATES, COLORS, MAX_LEVEL, SCALE } from './constants.js';
import { justPressed, clearAll } from './input.js';
import {
  createPlayer,
  updatePlayer,
  drawPlayer,
  playerHitbox,
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
  };
}

export function startCampaign(game) {
  game.score = 0;
  startLevel(game, 1, true);
}

export function startLevel(game, num, resetScore = false) {
  const level = createLevel(num);
  game.level = level;
  game.levelNum = num;
  game.player = createPlayer(level.spawn.x, level.spawn.y, { young: num === 1 });
  game.camX = 0;
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

  const target = player.x - W * 0.35;
  game.camX += (target - game.camX) * 0.15;
  if (game.camX < 0) game.camX = 0;
  const maxCam = level.widthPx - W;
  if (game.camX > maxCam) game.camX = maxCam;

  if (!game.bossIntro && level.bossTitle && player.x >= level.bossZoneX) {
    game.bossIntro = true;
    game.message = level.bossTitle || 'BOSS!';
    game.messageT = 90;
  }

  // Faith pray vs cloud
  const cloud = level.enemies.find((e) => e.type === 'cloud' && e.alive);
  if (cloud && player.alive) {
    const near =
      Math.abs(player.x + player.w / 2 - (cloud.x + cloud.w / 2)) < 70 * SCALE &&
      Math.abs(player.y - cloud.y) < 90 * SCALE;
    const praying =
      player.crouching && player.onGround && Math.abs(player.vx) < 0.12 * SCALE;
    if (near && praying) {
      const killed = hurtEnemy(cloud, 1.1 * dt, { faith: true });
      game.message = 'Pray.';
      game.messageT = 20;
      if (killed) {
        game.score += cloud.score;
        game.cloudDefeated = true;
        game.visionT = 200;
        sfx('heal');
        return;
      }
    }
  }

  for (const e of level.enemies) {
    if (!e.alive) continue;
    updateEnemy(e, level.solids, player, dt);

    if (player.alive && aabb(playerHitbox(player), enemyHitbox(e))) {
      if (hurtPlayer(player, e.damage)) {
        player.vx = (player.x < e.x ? -1 : 1) * 2.5 * SCALE;
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

  drawHUD(ctx, game);

  // Cloud faith meter
  const cloud = game.level.enemies.find((e) => e.type === 'cloud' && e.alive);
  if (cloud) {
    const bx = 80 * SCALE;
    const by = 26 * SCALE;
    const bw = W - 160 * SCALE;
    drawRect(ctx, bx, by, bw, 8 * SCALE, '#1a0a20');
    const ratio = Math.max(0, cloud.hp / cloud.maxHp);
    drawRect(ctx, bx + 2, by + 2, (bw - 4) * (1 - ratio), 8 * SCALE - 4, '#d4a84b');
    drawText(ctx, 'FAITH', bx - 36 * SCALE, by + 1 * SCALE, COLORS.uiGold, 8);
  }

  if (game.messageT > 0) {
    drawPanel(ctx, 40 * SCALE, 88 * SCALE, W - 80 * SCALE, 28 * SCALE);
    drawCentered(ctx, game.message, 97 * SCALE, COLORS.uiGold, 12);
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

function drawHUD(ctx, game) {
  drawRect(ctx, 0, 0, W, 22 * SCALE, '#14100c');
  drawRect(ctx, 0, 20 * SCALE, W, 2, '#8b6914');
  drawRect(ctx, 0, 21 * SCALE, W, 3, COLORS.uiGold);
  drawText(ctx, 'JOSEPH', 4 * SCALE, 6 * SCALE, COLORS.uiGold, 8);
  for (let i = 0; i < game.player.maxHp; i++) {
    drawHeart(ctx, (52 + i * 13) * SCALE, 5 * SCALE, i < game.player.hp);
  }
  drawText(ctx, `SC ${String(game.score).padStart(5, '0')}`, 148 * SCALE, 8 * SCALE, COLORS.uiCream, 8);
  drawText(ctx, `L${game.levelNum}`, 230 * SCALE, 8 * SCALE, COLORS.uiGreen, 8);
}

function drawTitleScene(ctx, game) {
  for (let i = 0; i < 20; i++) {
    const t = i / 20;
    drawRect(ctx, 0, i * 24, W, 24, `rgb(${16 + t * 42},${12 + t * 48},${32 + t * 88})`);
  }
  const stars = [
    [40, 40], [120, 24], [220, 56], [320, 32], [400, 48], [480, 20],
    [80, 80], [360, 72], [180, 16], [440, 80], [60, 120], [280, 100],
  ];
  for (const [sx, sy] of stars) {
    const twinkle = ((Math.floor(game.titleBlink / 20) + sx) % 3) !== 0;
    if (twinkle) {
      drawRect(ctx, sx, sy, 3, 3, 'rgba(255,245,210,0.9)');
      drawRect(ctx, sx + 1, sy - 1, 1, 5, 'rgba(255,245,210,0.35)');
    }
  }
  drawRect(ctx, 0, 250, W, 140, '#0a140c');
  for (let i = 0; i < 14; i++) {
    const tx = -10 + i * 42;
    const sc = 0.85 + (i % 3) * 0.08;
    ctx.fillStyle = i % 2 ? '#0c1a10' : '#102014';
    ctx.beginPath();
    ctx.moveTo(tx + 24, 250 - 40 * sc);
    ctx.lineTo(tx + 24 + 30 * sc, 250 + 8 * sc);
    ctx.lineTo(tx + 24 - 30 * sc, 250 + 8 * sc);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx + 24, 230 - 36 * sc);
    ctx.lineTo(tx + 24 + 22 * sc, 250 - 8 * sc);
    ctx.lineTo(tx + 24 - 22 * sc, 250 - 8 * sc);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx + 24, 210 - 28 * sc);
    ctx.lineTo(tx + 24 + 14 * sc, 236 - 8 * sc);
    ctx.lineTo(tx + 24 - 14 * sc, 236 - 8 * sc);
    ctx.closePath();
    ctx.fill();
    drawRect(ctx, tx + 21, 250, 7, 40, '#081008');
  }
  drawRect(ctx, 0, 380, W, 100, '#081008');
  drawRect(ctx, 0, 380, W, 2, '#1a2818');
  drawRect(ctx, 160, 400, 192, 4, '#1e2c14');
  for (let i = 0; i < 24; i++) {
    drawRect(ctx, 12 + i * 22, 372, 2, 8, '#143018');
    drawRect(ctx, 15 + i * 22, 374, 2, 6, '#1e4020');
  }
  drawPortrait(ctx, 36, 248, Math.floor(game.titleBlink / 40) % 4, 40);
  drawJoseph(ctx, 36, 304, 1, Math.floor(game.titleBlink / 20) % 3, false, false, false, false);
}
