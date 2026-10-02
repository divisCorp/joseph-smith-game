import { W, H, STATES, COLORS, MAX_LEVEL, SCALE, TILE, LEVEL_META } from './constants.js?v=69';
import { justPressed, clearAll } from './input.js?v=69';
import {
  createPlayer,
  updatePlayer,
  drawPlayer,
  playerHitbox,
  playerAttackBox,
  hurtPlayer,
  aabb,
} from './player.js?v=69';
import { updateEnemy, drawEnemy, enemyHitbox, hurtEnemy } from './enemy.js?v=69';
import { createLevel, drawLevelBackground, drawLevelTiles, drawPages } from './level.js?v=69';
import { updateHazards, drawHazards, hazardHitbox, hazardActive, createHazard } from './hazards.js?v=69';
import { updateSetPieces, drawSetPiecesBack, drawSetPiecesMid, drawSetPiecesFront, drawBossBar, drawBossBanner } from './setpieces.js?v=69';
import { updatePlates, drawPlates, plateHitbox, updateKnives, drawKnives, knifeHitbox } from './projectiles.js?v=69';
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
} from './sprites.js?v=69';
import { sfx, syncAudio, tickMusic, toggleMute } from './audio.js?v=69';
import {
  unlockChapter,
  unlockedChapter,
  recordScore,
  tipSeen,
  markTip,
  isEasy,
  setDifficulty,
  reduceFlash,
  setReduceFlash,
  recordChapter,
  journalUnlocked,
  unlockJournal,
} from './save.js?v=69';
import { updateGrove, drawGroveBack, drawGroveNpcs, drawGroveBubbles, drawGroveUi } from './grove.js?v=69';

const BANNER_T = 110;
export const EASY_HP = 7;
export const NORMAL_HP = 5;

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
    journalN: 0,
    journalFrom: 'play',
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
    checkpointIdx: -1,
    cpScore: 0,
    // chapter run stats (kept through checkpoint retries)
    chapterT: 0,
    heartsLost: 0,
    lastHp: 0,
    pagesGot: 0,
    result: null,
    chapterSel: 0,
    bossBannerT: 0,
    bossBarA: 0,
    beatIdx: 0,
    toast: null,
  };
}

let fsOffered = true;
/** Home Screen web apps are already full screen: hide that option there. */
export function setFullscreenOffered(on) {
  fsOffered = !!on;
}

/** Title choices: Continue only appears once a later chapter is unlocked. */
export function titleOptions() {
  const n = unlockedChapter();
  const base = ['begin', 'chapters', 'difficulty', 'flash'];
  if (fsOffered) base.push('fullscreen');
  return n > 1 ? ['continue', ...base] : base;
}

/** Tapping the bare title scene begins only for brand-new players. */
export function titleTapBegins() {
  return unlockedChapter() <= 1;
}

export const PAUSE_OPTIONS = ['resume', 'restart', 'fullscreen', 'difficulty', 'flash', 'sound', 'quit'];

function applyDifficulty(game) {
  const p = game.player;
  if (!p) return;
  const max = isEasy() ? EASY_HP : NORMAL_HP;
  const delta = max - p.maxHp;
  p.maxHp = max;
  p.hp = Math.max(p.alive ? 1 : 0, Math.min(max, p.hp + Math.max(0, delta)));
  game.lastHp = p.hp;
}

export function startCampaign(game, fromChapter = 1) {
  const num = Math.max(1, Math.min(MAX_LEVEL, fromChapter | 0 || 1));
  game.score = 0;
  game.newBest = false;
  // The plates are received in chapter 3; later chapters start with them.
  game.hasPlates = num > 3;
  startLevel(game, num, true);
}

export function startLevel(game, num, resetScore = false, opts = {}) {
  const level = createLevel(num);
  if (!opts.checkpoint) game.checkpointIdx = -1;
  game.level = level;
  game.levelNum = num;
  if (resetScore) game.score = 0;
  if (!opts.checkpoint) game.chapterStartScore = game.score;
  game.hasPlates = num > 3;
  game.player = createPlayer(level.spawn.x, level.spawn.y, { young: num === 1, canThrow: !!game.hasPlates });
  game.player.maxHp = isEasy() ? EASY_HP : NORMAL_HP;
  game.player.hp = game.player.maxHp;
  game.player.noAttack = !!level.finale; // Carthage: no fighting
  if (!opts.checkpoint) {
    game.chapterT = 0;
    game.heartsLost = 0;
    game.pagesGot = 0;
  }
  for (const pg of level.pages || []) if (game.pagesGot & (1 << pg.i)) pg.taken = true;
  game.lastHp = game.player.hp;
  game.result = null;
  game.bossBannerT = 0;
  game.bossBarA = 0;
  game.beatIdx = 0;
  game.onFinaleDone = () => {
    game.martyrEnding = true;
    game.martyrFade = 0;
  };
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
  game.shake = 0;
  game.hitStop = 0;
  game.introFade = 0;
  game.pauseSel = 0;
  game.tip = null;
  game.tipQueue = [];
  game.safe = { x: game.player.x, y: game.player.y };
  game.onCheckpoint = (cp) => reachCheckpoint(game, cp);
  game.onGroveDone = () => {
    game.score += 1000;
    goClear(game);
  };
  unlockChapter(num);
  if (opts.checkpoint && game.checkpointIdx >= 0) placeAtCheckpoint(game);
  clearAll();
}

function reachCheckpoint(game, cp) {
  const idx = game.level.checkpoints.indexOf(cp);
  if (idx <= game.checkpointIdx) return;
  game.checkpointIdx = idx;
  game.cpScore = game.score;
  const p = game.player;
  p.hp = p.maxHp;
  game.message = 'CHECKPOINT';
  game.messageT = 60;
  sfx('checkpoint');
}

/** Resume a chapter at its last lit lantern: full hearts, passed foes stay cleared. */
function placeAtCheckpoint(game) {
  const { level, player } = game;
  const cp = level.checkpoints[game.checkpointIdx];
  if (!cp) return;
  for (let i = 0; i <= game.checkpointIdx; i++) level.checkpoints[i].lit = true;
  level.enemies = level.enemies.filter((e) => e.type === 'boss' || e.x > cp.x + 4 * TILE);
  if (level.pickup && level.pickup.x < cp.x) level.pickup.taken = true;
  player.x = cp.x + 2 * SCALE;
  player.y = cp.y - player.standH;
  player.hp = player.maxHp;
  game.lastHp = player.hp;
  player.invuln = 60;
  game.score = game.cpScore;
  if (level.beats) game.beatIdx = level.beats.filter((b) => b.col * TILE <= cp.x).length;
  game.camX = Math.max(0, Math.min(level.widthPx - W, player.x + player.w / 2 - W * 0.5));
  game.safe = { x: player.x, y: player.y };
  game.state = STATES.PLAYING;
  game.stateT = 0;
  game.introFade = 30;
  game.message = 'CHECKPOINT';
  game.messageT = 50;
}

/** Full chapter restart (pause menu). */
function restartChapter(game) {
  game.score = game.chapterStartScore || 0;
  startLevel(game, game.levelNum, false);
}

/** After a loss: back to the last checkpoint if one is lit, else the chapter start. */
function retryAfterLoss(game) {
  if (game.checkpointIdx >= 0) {
    startLevel(game, game.levelNum, false, { checkpoint: true });
    // keep the chapter's opening score for a later full restart
  } else {
    restartChapter(game);
  }
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
    case 'chapters':
      if (game.state === STATES.TITLE) {
        game.chapterSel = Math.max(0, unlockedChapter() - 1);
        setState(game, STATES.CHAPTERS);
      }
      break;
    case 'back':
      if (game.state === STATES.CHAPTERS) {
        setState(game, STATES.TITLE);
        game.titleSel = titleOptions().indexOf('chapters');
      }
      break;
    case 'difficulty':
      setDifficulty(isEasy() ? 'normal' : 'easy');
      applyDifficulty(game);
      sfx('select');
      break;
    case 'flash':
      setReduceFlash(!reduceFlash());
      if (reduceFlash()) game.shake = 0;
      sfx('select');
      break;
    case 'next':
      if (game.state === STATES.CLEAR && game.clearTimer > 20) advanceFromClear(game);
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
      if (game.state === STATES.PAUSED) restartChapter(game);
      break;
    case 'retry':
      if (game.state === STATES.LOSE) retryAfterLoss(game);
      break;
    case 'sound':
      toggleMute();
      break;
    case 'fullscreen':
      // keyboard / pad path (buttons call the Fullscreen API directly in their click)
      game.onFullscreen?.();
      break;
    case 'quit':
    case 'title':
      quitToTitle(game);
      break;
    case 'skip':
      if (game.state === STATES.INTRO && game.introT > 20) endIntro(game);
      break;
    case 'journal-close':
      if (game.state === STATES.JOURNAL) closeJournal(game);
      break;
    default:
      if (cmd.startsWith('play:') && game.state === STATES.CHAPTERS) {
        const n = parseInt(cmd.slice(5), 10);
        if (n >= 1 && n <= unlockedChapter()) startCampaign(game, n);
      } else if (cmd.startsWith('journal:') && game.state === STATES.CHAPTERS) {
        const n = parseInt(cmd.slice(8), 10);
        if (journalUnlocked(n)) openJournal(game, n, 'chapters');
      }
      break;
  }
}

/** Parchment pop-up for a chapter's journal entry (pauses play). */
function openJournal(game, n, from) {
  game.journalN = n;
  game.journalFrom = from;
  game.tip = null;
  setState(game, STATES.JOURNAL);
}

function closeJournal(game) {
  if (game.journalFrom === 'chapters') setState(game, STATES.CHAPTERS);
  else setState(game, STATES.PLAYING);
}

function advanceFromClear(game) {
  const next = game.levelNum + 1;
  if (next <= MAX_LEVEL) startLevel(game, next, false);
  else goWin(game);
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

  if (game.state === STATES.CHAPTERS) {
    const n = unlockedChapter();
    const before = game.chapterSel;
    if (justPressed('left') || justPressed('up')) game.chapterSel = (game.chapterSel + n - 1) % n;
    if (justPressed('right') || justPressed('down')) game.chapterSel = (game.chapterSel + 1) % n;
    if (before !== game.chapterSel) sfx('select');
    if (confirmPressed() && game.stateT > 10) runCommand(game, `play:${game.chapterSel + 1}`);
    else if (justPressed('pause') && game.stateT > 10) runCommand(game, 'back');
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
    // Results card stays until the player continues (stars pop in first)
    if (game.result && game.result.shown < game.result.stars && game.clearTimer > 24 + game.result.shown * 16) {
      game.result.shown++;
      sfx('star');
    }
    if (confirmPressed() && game.clearTimer > 45) advanceFromClear(game);
    return;
  }

  if (game.state === STATES.JOURNAL) {
    const close = confirmPressed() || justPressed('pause');
    if (close && game.stateT > 30) closeJournal(game);
    return;
  }

  if (game.state === STATES.WIN) {
    const go = justPressed('start') || justPressed('pause');
    if (go && game.stateT > 120) quitToTitle(game);
    return;
  }

  if (game.state === STATES.LOSE) {
    if (game.stateT > 40) {
      if (justPressed('start') || justPressed('jump')) retryAfterLoss(game);
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

// ── First-run tips (each shown once ever): move/jump/attack in chapter 1,
// prayer-to-heal in chapter 2 (its journal entry explains it in full) ─────
const TIP_TEXT = {
  move: { touch: 'Drag the stick ◀ ▶ to walk', keys: 'Walk with ← → or A / D' },
  jump: { touch: 'Tap A to jump', keys: 'Press X (or K) to jump' },
  attack: { touch: 'Tap B to swing the pitchfork', keys: 'Space or Z swings the pitchfork' },
  kneel: { touch: 'Hurt? Stand still and hold the stick ▼ to kneel and pray. It heals.', keys: 'Hurt? Stand still and hold ↓ to kneel and pray. It heals.' },
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
  if (game.levelNum > 2 || !game.player || (game.level.camp && game.level.camp.state !== 'idle')) {
    game.tip = null;
    return;
  }
  const p = game.player;
  const level = game.level;
  // Context-triggered tips can pre-empt the intro queue once the current one has been read
  const free = !game.tip || game.tip.t > 150;
  if (!free) {
    /* let the current tip finish */
  } else if (game.levelNum === 2) {
    if (!tipSeen('kneel') && p.hp < p.maxHp && p.alive) showTip(game, 'kneel');
  } else if (!tipSeen('attack')) {
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
    if (tip.done) tip.t = Math.max(tip.t, 300 - 20);
  }
  if (tip.t > 300) game.tip = null;
}

/** Stars: one for finishing, and each of three goals met counts (max 3). */
function computeResult(game) {
  const meta = LEVEL_META[game.levelNum] || {};
  const par = Math.round((meta.par || 150) * (isEasy() ? 1.5 : 1));
  const time = Math.max(1, Math.round(game.chapterT));
  const pages = [0, 1, 2].filter((i) => game.pagesGot & (1 << i)).length;
  const timeOk = time <= par * 60;
  const heartsOk = game.heartsLost <= 1;
  const pagesOk = pages >= 3;
  const met = (timeOk ? 1 : 0) + (heartsOk ? 1 : 0) + (pagesOk ? 1 : 0);
  const stars = Math.max(1, met);
  const rec = recordChapter(game.levelNum, stars, game.pagesGot, time);
  return {
    chapter: game.levelNum,
    stars,
    shown: 0,
    time,
    par,
    heartsLost: game.heartsLost,
    pages,
    timeOk,
    heartsOk,
    pagesOk,
    bestStars: rec.next.stars,
    improved: rec.improved,
    easy: isEasy(),
  };
}

function goClear(game) {
  game.result = computeResult(game);
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
  if (game.levelNum === MAX_LEVEL && !game.result) game.result = computeResult(game);
  game.state = STATES.WIN;
  game.stateT = 0;
  game.messageT = 0;
  game.tip = null;
  if (recordScore(game.score)) game.newBest = true;
  clearAll();
}

const PHASE_LINES = {
  captain: 'The captain calls for more torches!',
  warden: 'The warden stamps in anger!',
  overseer: 'The ringleader grows desperate!',
  ringleader: 'The ringleader grows desperate!',
};

function hasFooting(p, solids) {
  const feet = p.y + p.h;
  const probe = (x) =>
    solids.some((s) => x >= s.x && x <= s.x + s.w && Math.abs(feet - s.y) <= 4);
  return probe(p.x + 2 * SCALE) && probe(p.x + p.w - 2 * SCALE);
}

function tickPlay(game, dt) {
  const { player, level } = game;
  game.touchUi = isTouchUi();
  if (game.messageT > 0) game.messageT -= dt;
  if (game.bossBannerT > 0) game.bossBannerT -= dt;
  else if (game.bossIntro) game.bossBarA = Math.min(1, game.bossBarA + dt / 20);
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt);
  if (!game.martyrEnding) game.chapterT += dt;
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

  // Chapter 1 story: preachers, the camp meeting, and the prayer in the grove
  const story = level.camp && level.camp.state !== 'idle' && level.camp.state !== 'kneel';
  const locked = updateGrove(game, dt, story ? confirmPressed() : false);
  if (game.state !== STATES.PLAYING) return;

  updateSetPieces(game, dt);
  if (!locked) updatePlayer(player, level.solids, dt);

  // Remember solid footing; a fall into a gap costs one heart, not the whole run.
  if (player.alive && player.onGround && hasFooting(player, level.solids.filter((s) => !s.unsafe))) {
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
    // Entrance banner takes the top slot first; the health bar fades in after it
    game.bossBannerT = BANNER_T;
    game.bossBarA = 0;
    sfx('tell');
  }

  // Story beats (Carthage): quiet lines as Joseph walks
  if (level.beats && game.beatIdx < level.beats.length && player.x >= level.beats[game.beatIdx].col * TILE) {
    game.message = level.beats[game.beatIdx].text;
    game.messageT = 130;
    game.beatIdx++;
  }

  // Hidden journal pages
  if (player.alive) {
    const pb = playerHitbox(player);
    for (const pg of level.pages || []) {
      if (pg.taken) continue;
      if (aabb(pb, { x: pg.x - 4 * SCALE, y: pg.y - 6 * SCALE, w: pg.w + 8 * SCALE, h: pg.h + 12 * SCALE })) {
        pg.taken = true;
        game.pagesGot |= 1 << pg.i;
        const got = [0, 1, 2].filter((i) => game.pagesGot & (1 << i)).length;
        game.score += 250;
        sfx('page');
        if (got >= 3) {
          // All three: pause for the chapter's journal entry
          unlockJournal(game.levelNum);
          game.messageT = 0;
          openJournal(game, game.levelNum, 'play');
          return;
        }
        game.message = `JOURNAL PAGE ${got}/3`;
        game.messageT = 70;
      }
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
        if (e.type === 'boss') e.vx = player.facing * 1.2 * SCALE;
        else {
          e.vx = player.facing * 2.6 * SCALE;
          e.vy = -2.2 * SCALE;
        }
        if (killed) game.score += e.score;
      }
    }
  }

  const world = {
    hazards: level.hazards,
    enemies: level.enemies,
    solids: level.solids,
    active: game.bossIntro && game.bossBannerT <= 40, // bosses wait out most of their entrance
    onPhase: (e) => {
      game.message = PHASE_LINES[e.bossKind] || 'The foe grows desperate!';
      game.messageT = 70;
      game.shake = Math.max(game.shake, 18);
    },
    onSlam: () => {
      game.shake = Math.max(game.shake, 14);
    },
  };
  for (const e of level.enemies) {
    if (!e.alive) continue;
    updateEnemy(e, level.solids, player, dt, world);

    if (player.alive && aabb(playerHitbox(player), enemyHitbox(e))) {
      if (hurtPlayer(player, e.damage)) {
        player.vx = (player.x < e.x ? -1 : 1) * 2.5 * SCALE;
        game.hitStop = Math.max(game.hitStop, 6);
        game.shake = Math.max(game.shake, 16);
      }
    }
  }

  updateHazards(level.hazards, level.solids, dt, level.widthPx);
  const pbox = playerHitbox(player);
  for (const h of level.hazards) {
    if (!hazardActive(h)) continue;
    // Pitchfork and plates can smash barrels
    if (h.breakable) {
      let broke = false;
      if (fork && aabb(fork, hazardHitbox(h))) broke = true;
      for (const plate of player.plates) {
        if (plate.alive && aabb(plateHitbox(plate), hazardHitbox(h))) {
          plate.alive = false;
          broke = true;
        }
      }
      if (broke) {
        h.alive = false;
        game.score += 50;
        sfx('hit');
        level.hazards.push(createHazard('puff', h.x, h.y + h.h / 2, { w: h.w, h: 10 * SCALE }));
        continue;
      }
    }
    if (player.alive && aabb(pbox, hazardHitbox(h))) {
      if (hurtPlayer(player, h.damage)) {
        player.vx = (h.vx > 0 ? 1 : h.vx < 0 ? -1 : player.x < h.x ? -1 : 1) * 2.4 * SCALE;
        game.hitStop = Math.max(game.hitStop, 5);
        game.shake = Math.max(game.shake, 14);
        if (h.kind === 'barrel' || h.kind === 'knife' || h.kind === 'drop' || h.kind === 'brick' || h.kind === 'torch') {
          h.alive = false;
        }
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
        if (e.type !== 'boss') {
          e.vx = plate.facing * 2.2 * SCALE;
          e.vy = -2 * SCALE;
        }
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

  // Carthage finale is driven by setpieces.js (updateFinale → game.onFinaleDone)

  // Boss-defeat clear
  if (level.goal === 'boss' || !level.goal) {
    const boss = level.enemies.find((e) => e.type === 'boss');
    if (boss && !boss.alive && player.alive) {
      if (level.num >= MAX_LEVEL) {
        goWin(game);
      } else {
        goClear(game);
      }
      return;
    }
  }

  // Hearts lost this chapter run (for the results card)
  if (player.hp < game.lastHp) game.heartsLost += game.lastHp - player.hp;
  game.lastHp = player.hp;

  if (!player.alive) {
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
  if (game.state === STATES.WIN) {
    drawCreditsScene(ctx, game);
    return;
  }

  if (!game.level || !game.player) return;

  ctx.save();
  if (game.shake > 0 && !reduceFlash()) {
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
  drawSetPiecesBack(ctx, game);
  drawLevelTiles(ctx, game.camX, game.level);
  drawSetPiecesMid(ctx, game);
  drawGroveBack(ctx, game);
  drawPages(ctx, game.level, game.camX, game.tick);

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
  drawGroveNpcs(ctx, game);
  drawPlayer(ctx, game.player, game.camX);
  drawGroveBubbles(ctx, game);
  drawPlates(ctx, game.player.plates, game.camX);
  for (const e of game.level.enemies) {
    if (e.knives) drawKnives(ctx, e.knives, game.camX);
  }
  drawHazards(ctx, game.level.hazards || [], game.camX, game.tick);
  drawSetPiecesFront(ctx, game);

  drawVignette(ctx);
  ctx.restore();

  drawHUD(ctx, game);

  // Boss entrance banner, then the health bar (name + half-health phase tick)
  const boss = game.level.enemies.find((e) => e.type === 'boss' && e.alive);
  if (game.state !== STATES.INTRO) {
    if (game.bossBannerT > 0 && game.level.bossTitle) {
      drawBossBanner(ctx, game.level.bossTitle, game.bossBannerT, BANNER_T);
    } else if (boss && game.bossIntro && game.bossBarA > 0) {
      const name = boss.title || 'BOSS';
      drawBossBar(ctx, boss, name, boss.bs?.phase || 1, game.bossBarA);
    }
    const f = game.level.finale;
    if (f && f.state === 'active') {
      drawBossBar(ctx, { type: 'finale', hp: f.courage, maxHp: f.need || 1 }, 'HOLD THE DOOR', 1, 1);
    }
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

  drawGroveUi(ctx, game);

  if (game.state === STATES.PAUSED || game.state === STATES.CLEAR || game.state === STATES.JOURNAL) {
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
    drawLevelTiles(ctx, cam, game.titleLevel, { noStacks: true });
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

/** Calm closing backdrop: the grove at sunrise, slowly drifting. */
function drawCreditsScene(ctx, game) {
  if (!game.titleLevel) {
    try {
      game.titleLevel = createLevel(1);
    } catch (_) {
      game.titleLevel = null;
    }
  }
  if (game.titleLevel) {
    const cam = 200 + game.stateT * 0.25;
    drawLevelBackground(ctx, cam % (game.titleLevel.widthPx - W - 400), game.titleLevel);
    drawLevelTiles(ctx, cam % (game.titleLevel.widthPx - W - 400), game.titleLevel);
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,190,120,0.35)');
  g.addColorStop(0.55, 'rgba(255,220,170,0.12)');
  g.addColorStop(1, 'rgba(20,12,6,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const sun = ctx.createRadialGradient(W * 0.5, H * 0.62, 10, W * 0.5, H * 0.62, H * 0.7);
  sun.addColorStop(0, 'rgba(255,236,190,0.45)');
  sun.addColorStop(1, 'rgba(255,236,190,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
  drawVignette(ctx);
}
