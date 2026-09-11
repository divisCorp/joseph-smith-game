import { W, H, STATES, COLORS } from './constants.js';
import { justPressed, clearAll } from './input.js';
import {
  createPlayer,
  updatePlayer,
  drawPlayer,
  playerAttackBox,
  playerHitbox,
  hurtPlayer,
  aabb,
} from './player.js';
import { updateEnemy, drawEnemy, enemyHitbox, hurtEnemy } from './enemy.js';
import { createLevel1, drawLevelBackground, drawLevelTiles } from './level.js';
import { drawHeart, drawText, drawCentered, drawRect } from './sprites.js';

export function createGame() {
  return {
    state: STATES.TITLE,
    level: null,
    player: null,
    camX: 0,
    score: 0,
    message: '',
    messageT: 0,
    bossIntro: false,
    titleBlink: 0,
    tick: 0,
  };
}

export function startLevel1(game) {
  const level = createLevel1();
  game.level = level;
  game.player = createPlayer(level.spawn.x, level.spawn.y);
  game.camX = 0;
  game.score = 0;
  game.state = STATES.PLAYING;
  game.bossIntro = false;
  game.message = '';
  game.messageT = 0;
  clearAll();
}

export function updateGame(game, dt) {
  game.tick += dt;
  game.titleBlink += dt;

  if (game.state === STATES.TITLE) {
    if (justPressed('start') || justPressed('attack')) {
      startLevel1(game);
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

  // camera follow
  const target = player.x - W * 0.35;
  game.camX += (target - game.camX) * 0.15;
  if (game.camX < 0) game.camX = 0;
  const maxCam = level.widthPx - W;
  if (game.camX > maxCam) game.camX = maxCam;

  // boss zone banner
  if (!game.bossIntro && player.x >= level.bossZoneX) {
    game.bossIntro = true;
    game.message = 'FRONTIER RINGLEADER!';
    game.messageT = 90;
  }

  // enemies
  for (const e of level.enemies) {
    if (!e.alive) continue;
    updateEnemy(e, level.solids, player, dt);

    // contact damage
    if (player.alive && aabb(playerHitbox(player), enemyHitbox(e))) {
      if (hurtPlayer(player, e.damage)) {
        player.vx = (player.x < e.x ? -1 : 1) * 2.5;
      }
    }
  }

  // melee hits (one connect per swing)
  const atk = playerAttackBox(player);
  if (atk && !player.attackHit) {
    for (const e of level.enemies) {
      if (!e.alive) continue;
      if (aabb(atk, enemyHitbox(e))) {
        player.attackHit = true;
        const killed = hurtEnemy(e, 1);
        if (killed) game.score += e.score;
        e.vx = player.facing * 2;
        e.vy = -2;
        break;
      }
    }
  }

  // win: boss defeated
  const boss = level.enemies.find((e) => e.type === 'boss');
  if (boss && !boss.alive && player.alive) {
    game.state = STATES.WIN;
    game.messageT = 0;
  }

  if (!player.alive) {
    game.state = STATES.LOSE;
  }
}

export function drawGame(ctx, game) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);

  if (game.state === STATES.TITLE) {
    drawTitle(ctx, game);
    return;
  }

  if (!game.level || !game.player) return;

  drawLevelBackground(ctx, game.camX, game.level);
  drawLevelTiles(ctx, game.camX, game.level);

  for (const e of game.level.enemies) {
    drawEnemy(ctx, e, game.camX);
  }
  drawPlayer(ctx, game.player, game.camX);

  // attack spark
  const atk = playerAttackBox(game.player);
  if (atk) {
    drawRect(ctx, atk.x - game.camX, atk.y, atk.w, atk.h, 'rgba(212,168,75,0.45)');
  }

  drawHUD(ctx, game);

  if (game.messageT > 0) {
    drawRect(ctx, 20, 90, W - 40, 24, 'rgba(20,12,8,0.85)');
    drawCentered(ctx, game.message, 97, COLORS.uiGold, 10);
  }

  if (game.state === STATES.PAUSED) {
    drawRect(ctx, 0, 0, W, H, 'rgba(0,0,0,0.5)');
    drawCentered(ctx, 'PAUSED', 100, COLORS.uiCream, 14);
    drawCentered(ctx, 'P / Enter / START to resume', 120, COLORS.uiGold, 8);
  }

  if (game.state === STATES.WIN) drawWin(ctx, game);
  if (game.state === STATES.LOSE) drawLose(ctx, game);
}

function drawHUD(ctx, game) {
  drawRect(ctx, 0, 0, W, 22, '#1a1410');
  drawRect(ctx, 0, 22, W, 2, COLORS.uiGold);
  drawText(ctx, 'JOSEPH', 4, 4, COLORS.uiGold, 8);
  for (let i = 0; i < game.player.maxHp; i++) {
    drawHeart(ctx, 52 + i * 12, 5, i < game.player.hp);
  }
  drawText(ctx, `SC ${String(game.score).padStart(5, '0')}`, 150, 6, COLORS.uiCream, 8);
  drawText(ctx, 'L1', 232, 6, COLORS.uiGreen, 8);
}

function drawTitle(ctx, game) {
  // night-to-dawn title bg
  for (let i = 0; i < 15; i++) {
    const t = i / 15;
    drawRect(ctx, 0, i * 16, W, 16, `rgb(${20 + t * 40},${16 + t * 50},${40 + t * 80})`);
  }
  // silhouette trees
  ctx.fillStyle = '#0a180a';
  for (let i = 0; i < 6; i++) {
    const tx = 10 + i * 45;
    drawRect(ctx, tx + 8, 160, 8, 50, '#0a180a');
    drawRect(ctx, tx, 140, 24, 28, '#0a180a');
  }
  drawRect(ctx, 0, 200, W, 40, '#1a2810');

  drawCentered(ctx, 'JOSEPH SMITH', 48, COLORS.uiGold, 14);
  drawCentered(ctx, 'PALMYRA QUEST', 66, COLORS.uiCream, 12);
  drawCentered(ctx, '— Level 1: Woods Path —', 86, '#a09070', 8);

  drawRect(ctx, 48, 110, 160, 50, 'rgba(20,12,8,0.7)');
  drawCentered(ctx, 'Defend the frontier path.', 118, COLORS.uiCream, 8);
  drawCentered(ctx, 'Reach the Ringleader.', 130, COLORS.uiCream, 8);
  drawCentered(ctx, 'Family-friendly arcade.', 142, '#908070', 8);

  const blink = Math.floor(game.titleBlink / 30) % 2 === 0;
  if (blink) {
    drawCentered(ctx, 'TAP START · ENTER / Z', 175, COLORS.uiGold, 10);
  }
  drawCentered(ctx, 'Arrows/WASD · Space/Z · or touch buttons', 200, '#706050', 7);
  drawCentered(ctx, 'Inspired by classic NES action', 220, '#504030', 7);
}

function drawWin(ctx, game) {
  drawRect(ctx, 0, 0, W, H, 'rgba(10,30,20,0.8)');
  drawCentered(ctx, 'PATH CLEARED!', 70, COLORS.uiGold, 14);
  drawCentered(ctx, 'Joseph stood firm.', 95, COLORS.uiCream, 10);
  drawCentered(ctx, `Score: ${game.score}`, 115, COLORS.uiCream, 10);
  drawCentered(ctx, 'Level 2 coming someday...', 140, '#80a080', 8);
  drawCentered(ctx, 'TAP START · ENTER / Z — Title', 175, COLORS.uiGold, 9);
}

function drawLose(ctx, game) {
  drawRect(ctx, 0, 0, W, H, 'rgba(40,10,10,0.8)');
  drawCentered(ctx, 'DEFEATED', 80, COLORS.uiRed, 14);
  drawCentered(ctx, 'Rise again, Joseph.', 110, COLORS.uiCream, 10);
  drawCentered(ctx, `Score: ${game.score}`, 130, COLORS.uiCream, 9);
  drawCentered(ctx, 'TAP START · ENTER / Z — Title', 170, COLORS.uiGold, 9);
}
