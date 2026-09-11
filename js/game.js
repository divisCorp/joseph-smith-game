import { W, H, STATES, COLORS, LEVEL_META, MAX_LEVEL } from './constants.js';
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
import { updatePlates, drawPlates, plateHitbox } from './projectiles.js';
import { drawHeart, drawText, drawCentered, drawRect, drawPanel, drawJoseph } from './sprites.js';

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
  game.player = createPlayer(level.spawn.x, level.spawn.y);
  // Mild HP restore between levels (keep some challenge)
  if (!resetScore && game.player) {
    // already fresh player with full HP
  }
  game.camX = 0;
  if (resetScore) game.score = 0;
  game.state = STATES.PLAYING;
  game.bossIntro = false;
  game.message = '';
  game.messageT = 0;
  game.clearTimer = 0;
  clearAll();
}

export function updateGame(game, dt) {
  game.tick += dt;
  game.titleBlink += dt;

  if (game.state === STATES.TITLE) {
    if (justPressed('start') || justPressed('attack')) {
      startCampaign(game);
    }
    return;
  }

  if (game.state === STATES.CLEAR) {
    game.clearTimer += dt;
    // Auto-advance after ~2s, or sooner on start/attack
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
    if (justPressed('pause')) {
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

function tickPlay(game, dt) {
  const { player, level } = game;
  if (game.messageT > 0) game.messageT -= dt;

  updatePlayer(player, level.solids, dt);

  const target = player.x - W * 0.35;
  game.camX += (target - game.camX) * 0.15;
  if (game.camX < 0) game.camX = 0;
  const maxCam = level.widthPx - W;
  if (game.camX > maxCam) game.camX = maxCam;

  if (!game.bossIntro && player.x >= level.bossZoneX) {
    game.bossIntro = true;
    game.message = level.bossTitle || 'BOSS!';
    game.messageT = 90;
  }

  for (const e of level.enemies) {
    if (!e.alive) continue;
    updateEnemy(e, level.solids, player, dt);

    if (player.alive && aabb(playerHitbox(player), enemyHitbox(e))) {
      if (hurtPlayer(player, e.damage)) {
        player.vx = (player.x < e.x ? -1 : 1) * 2.5;
      }
    }
  }

  // Gold-plate projectiles: move, then damage enemies/bosses on hit
  updatePlates(player.plates, dt, game.camX, level.widthPx);
  for (const plate of player.plates) {
    if (!plate.alive) continue;
    const ph = plateHitbox(plate);
    for (const e of level.enemies) {
      if (!e.alive) continue;
      if (aabb(ph, enemyHitbox(e))) {
        plate.alive = false;
        const killed = hurtEnemy(e, plate.damage);
        if (killed) game.score += e.score;
        e.vx = plate.facing * 2.2;
        e.vy = -2;
        break;
      }
    }
  }

  const boss = level.enemies.find((e) => e.type === 'boss');
  if (boss && !boss.alive && player.alive) {
    if (level.num >= MAX_LEVEL) {
      game.state = STATES.WIN;
      game.messageT = 0;
      clearAll();
    } else {
      game.state = STATES.CLEAR;
      game.clearTimer = 0;
      game.messageT = 0;
      clearAll();
    }
  }

  if (!player.alive) {
    game.state = STATES.LOSE;
    clearAll();
  }
}

export function drawGame(ctx, game) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);

  if (game.state === STATES.TITLE) {
    drawTitleScene(ctx, game);
    return;
  }

  if (!game.level || !game.player) return;

  drawLevelBackground(ctx, game.camX, game.level);
  drawLevelTiles(ctx, game.camX, game.level);

  for (const e of game.level.enemies) {
    drawEnemy(ctx, e, game.camX);
  }
  drawPlayer(ctx, game.player, game.camX);
  drawPlates(ctx, game.player.plates, game.camX);

  drawHUD(ctx, game);

  if (game.messageT > 0) {
    drawPanel(ctx, 20, 88, W - 40, 28);
    drawCentered(ctx, game.message, 97, COLORS.uiGold, 10);
  }

  if (game.state === STATES.PAUSED || game.state === STATES.CLEAR) {
    drawRect(ctx, 0, 0, W, H, 'rgba(0,0,0,0.25)');
  }
}

function drawHUD(ctx, game) {
  drawRect(ctx, 0, 0, W, 22, '#14100c');
  drawRect(ctx, 0, 20, W, 1, '#8b6914');
  drawRect(ctx, 0, 21, W, 2, COLORS.uiGold);
  drawText(ctx, 'JOSEPH', 4, 4, COLORS.uiGold, 8);
  for (let i = 0; i < game.player.maxHp; i++) {
    drawHeart(ctx, 52 + i * 13, 4, i < game.player.hp);
  }
  drawText(ctx, `SC ${String(game.score).padStart(5, '0')}`, 148, 6, COLORS.uiCream, 8);
  drawText(ctx, `L${game.levelNum}`, 230, 6, COLORS.uiGreen, 8);
}

function drawTitleScene(ctx, game) {
  for (let i = 0; i < 15; i++) {
    const t = i / 15;
    drawRect(ctx, 0, i * 16, W, 16, `rgb(${16 + t * 42},${12 + t * 48},${32 + t * 88})`);
  }
  const stars = [[20, 20], [60, 12], [110, 28], [160, 16], [200, 24], [240, 10], [40, 40], [180, 36], [90, 8], [220, 40]];
  for (const [sx, sy] of stars) {
    const twinkle = ((Math.floor(game.titleBlink / 20) + sx) % 3) !== 0;
    if (twinkle) drawRect(ctx, sx, sy, 2, 2, 'rgba(255,245,210,0.85)');
  }
  for (let i = 0; i < 7; i++) {
    const tx = 4 + i * 38;
    drawRect(ctx, tx + 10, 155, 7, 55, '#081408');
    drawRect(ctx, tx + 2, 132, 22, 26, '#0a180a');
    drawRect(ctx, tx + 6, 120, 14, 16, '#0c1c0c');
  }
  drawRect(ctx, 0, 190, W, 50, '#081008');
  drawRect(ctx, 0, 190, W, 1, '#1a2818');
  drawRect(ctx, 80, 200, 96, 3, '#1e2c14');
  drawJoseph(ctx, 18, 152, 1, Math.floor(game.titleBlink / 16) % 2, false, false);
}
