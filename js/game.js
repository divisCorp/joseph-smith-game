import { W, H, STATES, COLORS, MAX_LEVEL, SCALE, TILE, LEVEL_META } from './constants.js';
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
import { sfx, syncAudio, tickMusic, toggleMute } from './audio.js';
import { unlockChapter, unlockedChapter, recordScore, tipSeen, markTip } from './save.js';

export function createGame() {
  return {
    state: STATES.TITLE,
    level: null,
    levelNum: 1,
    player: null,
    camX: 0,
    score: 0,
    chapterStartScore: 0,
    message: '',
    messageT: 0,
    bossIntro: false,
    titleBlink: 0,
    tick: 0,
    clearTimer: 0,
    stateT: 0,
    martyrTimer: 0,
    martyrEnding: false,
    martyrFade: 0,
    cloudDefeated: false,
    hasPlates: false,
    shake: 0,
    hitStop: 0,
    introFade: 0,
    introT: 0,
    titleLevel: null,
    titleSel: 0,
    pauseSel: 0,
    cmd: null,
    newBest: false,
    tip: null,
    tipQueue: [],
    safe: null,
  };
}

/** Title choices: Continue only appears once a later chapter is unlocked. */
export function titleOptions() {
  const n = unlockedChapter();
  return n > 1 ? ['continue', 'begin'] : ['begin'];
}

export const PAUSE_OPTIONS = ['resume', 'restart', 'sound', 'quit'];

export function startCampaign(game, fromChapter = 1) {
  const num = Math.max(1, Math.min(MAX_LEVEL, fromChapter | 0 || 1));
  game.score = 0;
  game.newBest = false;
  // The plates are received in chapter 3; later chapters start with them.
  game.hasPlates = num > 3;
  startLevel(game, num, true);
}

export function startLevel(game, num, resetScore = false) {
  const level = createLevel(num);
  game.level = level;
  game.levelNum = num;
  if (resetScore) game.score = 0;
  game.chapterStartScore = game.score;
  game.hasPlates = num > 3;
  game.player = createPlayer(level.spawn.x, level.spawn.y, { young: num === 1, canThrow: !!game.hasPlates });
  game.camX = Math.max(0, game.player.x + game.player.w / 2 - W * 0.5);
  game.state = STATES.INTRO;
  game.introT = 0;
  game.stateT = 0;
  game.bossIntro = false;
  game.message = '';
  game.messageT = 0;
  game.clearTimer = 0;
  game.martyrTimer = 0;
  game.martyrEnding = false;
  game.martyrFade = 0;
  game.cloudDefeated = false;
  game.shake = 0;
  game.hitStop = 0;
  game.introFade = 0;
  game.pauseSel = 0;
  game.tip = null;
  game.tipQueue = [];
  game.safe = { x: game.player.x, y: game.player.y };
  unlockChapter(num);
  clearAll();
}

function restartChapter(game) {
  game.score = game.chapterStartScore || 0;
  startLevel(game, game.levelNum, false);
}

function quitToTitle(game) {
  if (recordScore(game.score)) game.newBest = true;
  game.state = STATES.TITLE;
  game.titleSel = 0;
  game.stateT = 0;
  game.tip = null;
  clearAll();
}

function setState(game, st) {
  game.state = st;
  game.stateT = 0;
  clearAll();
}

function pauseGame(game) {
  if (game.state !== STATES.PLAYING || game.martyrEnding) return;
  game.pauseSel = 0;
  setState(game, STATES.PAUSED);
}

/** Commands from HTML buttons (touch / mouse) and the visibility watcher. */
function runCommand(game, cmd) {
  switch (cmd) {
    case 'begin':
      if (game.state === STATES.TITLE) startCampaign(game, 1);
      break;
    case 'continue':
      if (game.state === STATES.TITLE) startCampaign(game, unlockedChapter());
      break;
    case 'pause':
      if (game.state === STATES.PLAYING) pauseGame(game);
      else if (game.state === STATES.PAUSED) setState(game, STATES.PLAYING);
      break;
    case 'autopause':
      pauseGame(game);
      break;
    case 'resume':
      if (game.state === STATES.PAUSED) setState(game, STATES.PLAYING);
      break;
    case 'restart':
      if (game.state === STATES.PAUSED || game.state === STATES.LOSE) restartChapter(game);
      break;
    case 'retry':
      if (game.state === STATES.LOSE) restartChapter(game);
      break;
    case 'sound':
      toggleMute();
      break;
    case 'quit':
    case 'title':
      quitToTitle(game);
      break;
    case 'skip':
      if (game.state === STATES.INTRO && game.introT > 20) endIntro(game);
      break;
    default:
      break;
  }
}

function endIntro(game) {
  game.state = STATES.PLAYING;
  game.stateT = 0;
  game.introFade = 24;
  clearAll();
  queueChapterTips(game);
}

function menuNav(sel, count) {
  if (justPressed('up') || justPressed('left')) return (sel + count - 1) % count;
  if (justPressed('down') || justPressed('right')) return (sel + 1) % count;
  return sel;
}

function confirmPressed() {
  // Evaluate all so each one-shot latch updates
  const a = justPressed('start');
  const b = justPressed('jump');
  const c = justPressed('attack');
  return a || b || c;
}

export function updateGame(game, dt) {
  game.tick += dt;
  game.titleBlink += dt;
  game.stateT += dt;
  syncAudio(game);
  tickMusic(dt);

  if (game.cmd) {
    const cmd = game.cmd;
    game.cmd = null;
    runCommand(game, cmd);
    return;
  }

  if (game.state === STATES.TITLE) {
    const opts = titleOptions();
    if (game.titleSel >= opts.length) game.titleSel = 0;
    game.titleSel = menuNav(game.titleSel, opts.length);
    if (confirmPressed() && game.stateT > 10) runCommand(game, opts[game.titleSel]);
    return;
  }

  if (game.state === STATES.INTRO) {
    game.introT += dt;
    const skip = confirmPressed();
    if (game.introT > 210 || (skip && game.introT > 20)) endIntro(game);
    return;
  }

  if (game.state === STATES.CLEAR) {
    game.clearTimer += dt;
    const go = confirmPressed() && game.clearTimer > 30;
    if (game.clearTimer > 150 || go) {
      const next = game.levelNum + 1;
      if (next <= MAX_LEVEL) startLevel(game, next, false);
      else goWin(game);
    }
    return;
  }

  if (game.state === STATES.WIN) {
    if (confirmPressed() && game.stateT > 60) quitToTitle(game);
    return;
  }

  if (game.state === STATES.LOSE) {
    if (game.stateT > 40) {
      if (justPressed('start') || justPressed('jump')) restartChapter(game);
      else if (justPressed('pause')) quitToTitle(game);
    }
    return;
  }

  if (game.state === STATES.PLAYING) {
    if (justPressed('pause') && !game.martyrEnding) {
      pauseGame(game);
      return;
    }
    tickPlay(game, dt);
    tickTips(game, dt);
  } else if (game.state === STATES.PAUSED) {
    if (justPressed('pause')) {
      setState(game, STATES.PLAYING);
      return;
    }
    game.pauseSel = menuNav(game.pauseSel, PAUSE_OPTIONS.length);
    if (confirmPressed()) runCommand(game, PAUSE_OPTIONS[game.pauseSel]);
  }
}

// ── First-run tips (chapter 1 only, each shown once ever) ─────────────────
const TIP_TEXT = {
  move: { touch: 'Drag the stick ◀ ▶ to walk', keys: 'Walk with ← → or A / D' },
  jump: { touch: 'Tap A to jump', keys: 'Press X (or K) to jump' },
  attack: { touch: 'Tap B to swing the pitchfork', keys: 'Space or Z swings the pitchfork' },
  kneel: { touch: 'Hurt? Hold the stick ▼ to kneel and pray — it heals', keys: 'Hurt? Hold ↓ to kneel and pray — it heals' },
  cloud: { touch: 'Stay kneeling until the PRAY bar fills', keys: 'Stay kneeling until the PRAY bar fills' },
};

function isTouchUi() {
  return typeof document !== 'undefined' && document.body?.classList.contains('touch-ui');
}

function queueChapterTips(game) {
  game.tipQueue = [];
  game.tip = null;
  if (game.levelNum !== 1) return;
  for (const id of ['move', 'jump']) if (!tipSeen(id)) game.tipQueue.push(id);
}

function showTip(game, id) {
  if (tipSeen(id) || game.tip?.id === id) return;
  const t = TIP_TEXT[id];
  game.tip = { id, text: isTouchUi() ? t.touch : t.keys, t: 0, done: false };
  markTip(id);
}

function tickTips(game, dt) {
  if (game.levelNum !== 1 || !game.player) {
    game.tip = null;
    return;
  }
  const p = game.player;
  const level = game.level;
  // Context-triggered tips can pre-empt the intro queue once the current one has been read
  const free = !game.tip || game.tip.t > 150;
  if (!free) {
    /* let the current tip finish */
  } else if (!tipSeen('cloud') && game.bossIntro) showTip(game, 'cloud');
  else if (!tipSeen('kneel') && p.hp < p.maxHp && p.alive) showTip(game, 'kneel');
  else if (!tipSeen('attack')) {
    const near = level.enemies.some(
      (e) => e.alive && e.type === 'wolf' && Math.abs(e.x - p.x) < 9 * TILE
    );
    if (near) showTip(game, 'attack');
  }
  if (!game.tip && game.tipQueue.length) {
    const id = game.tipQueue.shift();
    if (!tipSeen(id)) showTip(game, id);
  }
  const tip = game.tip;
  if (!tip) return;
  tip.t += dt;
  // Finish early once the player has clearly got it
  if (!tip.done && tip.t > 60) {
    if (tip.id === 'move' && Math.abs(p.x - level.spawn.x) > 3 * TILE) tip.done = true;
    if (tip.id === 'jump' && !p.onGround) tip.done = true;
    if (tip.id === 'attack' && p.attackTimer > 0) tip.done = true;
    if (tip.id === 'kneel' && p.hp >= p.maxHp) tip.done = true;
    if (tip.id === 'cloud' && p.crouching) tip.done = true;
    if (tip.done) tip.t = Math.max(tip.t, 300 - 20);
  }
  if (tip.t > 300) game.tip = null;
}

function goClear(game) {
  game.state = STATES.CLEAR;
  game.clearTimer = 0;
  game.stateT = 0;
  game.messageT = 0;
  game.tip = null;
  unlockChapter(Math.min(MAX_LEVEL, game.levelNum + 1));
  if (recordScore(game.score)) game.newBest = true;
  clearAll();
}

function goWin(game) {
  game.state = STATES.WIN;
  game.stateT = 0;
  game.messageT = 0;
  game.tip = null;
  if (recordScore(game.score)) game.newBest = true;
  clearAll();
}

function hasFooting(p, solids) {
  const feet = p.y + p.h;
  const probe = (x) =>
    solids.some((s) => x >= s.x && x <= s.x + s.w && Math.abs(feet - s.y) <= 4);
  return probe(p.x + 2 * SCALE) && probe(p.x + p.w - 2 * SCALE);
}

function tickPlay(game, dt) {
  const { player, level } = game;
  if (game.messageT > 0) game.messageT -= dt;
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt);
  if (game.introFade > 0) game.introFade -= dt;

  // Brief hit-stop: freeze simulation a few frames on solid hits
  if (game.hitStop > 0) {
    game.hitStop -= dt;
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

  // Remember solid footing; a fall into a gap costs one heart, not the whole run.
  if (player.alive && player.onGround && hasFooting(player, level.solids)) {
    game.safe = { x: player.x, y: player.y + player.h - player.standH };
  }
  if (player.fellOut) {
    player.fellOut = false;
    if (player.hp > 1 && game.safe) {
      player.hp -= 1;
      player.x = game.safe.x;
      player.y = game.safe.y;
      player.vx = 0;
      player.vy = 0;
      player.invuln = 90;
      if (player.crouching) {
        player.crouching = false;
        player.h = player.standH;
      }
      sfx('hurt');
      game.shake = Math.max(game.shake, 10);
    } else {
      player.hp = 0;
      player.alive = false;
    }
  }

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
        sfx('heal');
        goClear(game);
        return;
      }
    } else if (inGrove || nearX) {
      game.message = isTouchUi() ? 'Hold ▼ to kneel and pray' : 'Hold ↓ to kneel and pray';
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
        sfx(e.type === 'wolf' ? 'yelp' : 'hit');
        game.hitStop = Math.max(game.hitStop, 5);
        game.shake = Math.max(game.shake, 14);
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
        game.hitStop = Math.max(game.hitStop, 6);
        game.shake = Math.max(game.shake, 16);
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
          game.hitStop = Math.max(game.hitStop, 6);
          game.shake = Math.max(game.shake, 16);
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
        sfx(e.type === 'wolf' ? 'yelp' : 'hit');
        game.hitStop = Math.max(game.hitStop, 4);
        game.shake = Math.max(game.shake, 12);
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

  // Boss-defeat clear
  if (level.goal === 'boss' || !level.goal) {
    const boss = level.enemies.find((e) => e.type === 'boss' || e.type === 'cloud');
    if (boss && !boss.alive && player.alive && !game.cloudDefeated) {
      if (boss.type === 'cloud') {
        // already cleared when faith killed the cloud
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
    if (recordScore(game.score)) game.newBest = true;
    game.tip = null;
    setState(game, STATES.LOSE);
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
    const mag = Math.min(8, game.shake * 0.65);
    const decay = Math.min(1, game.shake / 16);
    ctx.translate(
      (Math.random() - 0.5) * mag * 2 * decay,
      (Math.random() - 0.5) * mag * 2 * decay
    );
  }
  const zoom = 1.08;
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

  if (game.martyrEnding) {
    drawMartyrFade(ctx, game);
  }

  if (game.state === STATES.PAUSED || game.state === STATES.CLEAR) {
    drawRect(ctx, 0, 0, W, H, 'rgba(0,0,0,0.25)');
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
    const walk = Math.floor(game.titleBlink / 8) % 8;
    drawJoseph(ctx, W * 0.28, game.titleLevel.spawn.y, 1, walk, false, false, false, true, false);
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
