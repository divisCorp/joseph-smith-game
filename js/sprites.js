/**
 * Hand-drawn-style pixel sprites (canvas rects + compact pixel maps).
 * Respectful NES arcade look for Joseph Smith and frontier foes.
 * Kept lightweight for phones — no large image assets.
 */
import { COLORS } from './constants.js';

export function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
}

/** Draw a compact pixel map. rows: array of strings; palette: char→color. Transparent = ' ' or '.' */
export function drawPixels(ctx, ox, oy, rows, palette, flipX = false) {
  const h = rows.length;
  const w = rows[0].length;
  ox = Math.floor(ox);
  oy = Math.floor(oy);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === ' ' || ch === '.') continue;
      const c = palette[ch];
      if (!c) continue;
      const px = flipX ? ox + (w - 1 - x) : ox + x;
      ctx.fillStyle = c;
      ctx.fillRect(px, oy + y, 1, 1);
    }
  }
}

// ── palettes ──────────────────────────────────────────────
const P_JOSEPH = {
  K: '#1a1010', // outline / dark
  H: '#2a1810', // hair
  F: '#e8c4a0', // face / skin
  E: '#2a1a10', // eye
  N: '#1a3a5c', // navy coat
  D: '#0e2848', // coat dark
  S: '#e8dcc8', // shirt
  B: '#3a2818', // boot
  T: '#2a2a4a', // trousers
  G: '#8b6914', // staff / gold
  L: '#c4a060', // staff light
  R: '#c07050', // lip / cheek
  W: '#f0e8d8', // highlight
};

const P_BRIGAND = {
  K: '#1a1010',
  H: '#1a1a1a',
  F: '#c4a080',
  E: '#8b0000',
  C: '#5a3020', // coat
  D: '#3a2010', // coat dark
  B: '#8b2020', // bandana
  T: '#3a2a1a', // trousers
  O: '#2a1a10', // boots
  S: '#8a7060', // shirt
  M: '#6a5030', // pouch
  W: '#d4b090', // skin light
};

const P_WOLF = {
  K: '#1a1a1a',
  D: '#3a3a3a', // dark fur
  F: '#5a5a5a', // fur
  L: '#7a7a7a', // light fur
  W: '#e8e8e8', // snout / fang
  E: '#ffcc00', // eye
  N: '#2a2a2a', // nose
  P: '#8a6a5a', // paw / inner ear
};

const P_BOSS = {
  K: '#0a0808',
  H: '#1a0a08', // hat
  F: '#d4a880', // face
  E: '#200808', // eye
  C: '#2a1a40', // coat
  D: '#1a1028', // coat dark
  P: '#4a1020', // cape
  Q: '#6a1830', // cape light
  S: '#e8dcc8', // shirt
  T: '#1a1a2a', // trousers
  B: '#0a0a12', // boots
  G: '#8b6914', // buckle / trim
  R: '#c04040', // flash red
  W: '#e8c4a0', // highlight skin
  M: '#3a2040', // mid coat
};

const P_HEART = {
  R: '#e04040',
  D: '#a02020',
  L: '#f08080',
  K: '#401010',
  E: '#602020', // empty
  M: '#301818',
};

// ── Joseph Smith (16×32) ──────────────────────────────────
// Standing / walk A
const JOSEPH_IDLE = [
  '....HHHHHH....',
  '...HHHHHHHH...',
  '...HHFFFFFFH..',
  '...HFFFEFFF...',
  '...HFFFFFFR...',
  '....FFFFFF....',
  '...NNNSSSNNN..',
  '..NNDNSSSNDN..',
  '..NNDNSSSNDN..',
  '..NNDNSSSNDN..',
  '..NNNDSSDNNN..',
  '..NNNNNNNNNN..',
  '..NN......NN..',
  '...TT....TT...',
  '...TT....TT...',
  '...TT....TT...',
  '...TT....TT...',
  '...BB....BB...',
  '...BB....BB...',
];

const JOSEPH_WALK = [
  '....HHHHHH....',
  '...HHHHHHHH...',
  '...HHFFFFFFH..',
  '...HFFFEFFF...',
  '...HFFFFFFR...',
  '....FFFFFF....',
  '...NNNSSSNNN..',
  '..NNDNSSSNDN..',
  '..NNDNSSSNDN..',
  '..NNDNSSSNDN..',
  '..NNNDSSDNNN..',
  '..NNNNNNNNNN..',
  '..NN......NN..',
  '...TT.....TT..',
  '...TT.....TT..',
  '..TT......TT..',
  '..TT......TT..',
  '..BB......BB..',
  '..BB......BB..',
];

const JOSEPH_JUMP = [
  '....HHHHHH....',
  '...HHHHHHHH...',
  '...HHFFFFFFH..',
  '...HFFFEFFF...',
  '...HFFFFFFR...',
  '....FFFFFF....',
  '...NNNSSSNNN..',
  '..NNDNSSSNDN..',
  '.FNNDNSSSNDNF.',
  '..NNDNSSSNDN..',
  '..NNNDSSDNNN..',
  '..NNNNNNNNNN..',
  '..NN......NN..',
  '...TT....TT...',
  '...TT....TT...',
  '....TT..TT....',
  '....TT..TT....',
  '....BB..BB....',
  '....BB..BB....',
];

const JOSEPH_ATTACK = [
  '....HHHHHH....',
  '...HHHHHHHH...',
  '...HHFFFFFFH..',
  '...HFFFEFFF...',
  '...HFFFFFFR...',
  '....FFFFFF....',
  '...NNNSSSNNN..',
  '..NNDNSSSNDN..',
  '..NNDNSSSNDNFF',
  '..NNDNSSSN.LG.',
  '..NNNDSSD.LG..',
  '..NNNNNNN.G...',
  '..NN..........',
  '...TT....TT...',
  '...TT....TT...',
  '...TT....TT...',
  '...TT....TT...',
  '...BB....BB...',
  '...BB....BB...',
];

/** Joseph Smith — coat, face, walk / jump / attack poses */
export function drawJoseph(ctx, x, y, facing, frame, attacking, jumping = false) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const flip = facing < 0;

  // soft shadow
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(ox + 3, oy + 30, 10, 2);

  let rows = JOSEPH_IDLE;
  if (attacking) rows = JOSEPH_ATTACK;
  else if (jumping) rows = JOSEPH_JUMP;
  else if (frame % 2 === 1) rows = JOSEPH_WALK;

  // maps are 14 wide; center in 16px slot
  drawPixels(ctx, ox + 1, oy + 1, rows, P_JOSEPH, flip);

  // coat button highlights (readable silhouette)
  if (!attacking) {
    const bx = flip ? ox + 6 : ox + 9;
    drawRect(ctx, bx, oy + 14, 1, 1, '#d4a84b');
    drawRect(ctx, bx, oy + 17, 1, 1, '#d4a84b');
  }
}

// ── Brigand (16×32) ───────────────────────────────────────
const BRIGAND_A = [
  '....HHHHHH....',
  '...HHHHHHHH...',
  '...HHFFFFFF...',
  '..BBBBBBBBBB..',
  '...HFFEFFFF...',
  '...HFFFFFFW...',
  '....FFFFFF....',
  '...CCCSSSCCC..',
  '..CCDSSSSDCC..',
  '..CCDSSSSDCC..',
  '..CCDSSMMDCC..',
  '..CCCCCCCCCC..',
  '..CC......CC..',
  '...TT....TT...',
  '...TT....TT...',
  '...TT....TT...',
  '...TT....TT...',
  '...OO....OO...',
  '...OO....OO...',
];

const BRIGAND_B = [
  '....HHHHHH....',
  '...HHHHHHHH...',
  '...HHFFFFFF...',
  '..BBBBBBBBBB..',
  '...HFFEFFFF...',
  '...HFFFFFFW...',
  '....FFFFFF....',
  '...CCCSSSCCC..',
  '..CCDSSSSDCC..',
  '..CCDSSSSDCC..',
  '..CCDSSMMDCC..',
  '..CCCCCCCCCC..',
  '..CC......CC..',
  '..TT......TT..',
  '..TT......TT..',
  '...TT....TT...',
  '...TT....TT...',
  '...OO....OO...',
  '...OO....OO...',
];

export function drawBrigand(ctx, x, y, facing, frame, flash = false) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(ox + 3, oy + 30, 10, 2);

  const pal = flash
    ? { ...P_BRIGAND, C: '#a05040', D: '#802830' }
    : P_BRIGAND;
  const rows = frame % 2 === 0 ? BRIGAND_A : BRIGAND_B;
  drawPixels(ctx, ox + 1, oy + 1, rows, pal, facing < 0);

  // dagger hint at hip
  const dx = facing > 0 ? ox + 13 : ox + 1;
  drawRect(ctx, dx, oy + 18, 2, 4, '#8a8a9a');
}

// ── Wolf (20×20 drawn into 16×32 slot with y offset) ──────
const WOLF_A = [
  '..............',
  '...D....D.....',
  '..DFD..DFD....',
  '..DLLDDLLD....',
  '.DFFFFFFFFD...',
  'DFFLFFFFFFFD..',
  'DFFEFFFFFFND..',
  'DFFFFFFFFFWWD.',
  '.DFFFFFFFFD...',
  '..DFFFFFFD....',
  '..DF....FD....',
  '..DP....PD....',
  '..DD....DD....',
];

const WOLF_B = [
  '..............',
  '...D....D.....',
  '..DFD..DFD....',
  '..DLLDDLLD....',
  '.DFFFFFFFFD...',
  'DFFLFFFFFFFD..',
  'DFFEFFFFFFND..',
  'DFFFFFFFFFWWD.',
  '.DFFFFFFFFD...',
  '..DFFFFFFD....',
  '.DF......FD...',
  '.DP......PD...',
  '.DD......DD...',
];

export function drawWolf(ctx, x, y, facing, frame, flash = false) {
  const ox = Math.floor(x);
  const oy = Math.floor(y) + 10;
  const bob = frame % 2;
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(ox + 2, oy + 18, 12, 2);

  const pal = flash
    ? { ...P_WOLF, F: '#8a6060', L: '#aa8080', D: '#5a3030' }
    : P_WOLF;
  const rows = bob === 0 ? WOLF_A : WOLF_B;
  // flip so snout faces movement; maps face right
  drawPixels(ctx, ox + 1, oy + bob, rows, pal, facing < 0);
}

// ── Boss: Frontier Ringleader (32×48) ─────────────────────
const BOSS_BODY = [
  '........HHHHHHHH........',
  '.......HHHHHHHHHH.......',
  '......HHHHHHHHHHHH......',
  '.....HH....HH....HH.....',
  '........FFFFFFFF........',
  '.......FFFEFFEFFF.......',
  '.......FFFFFFFFFF.......',
  '........FFFRRFFF........',
  '.........FFFFFF.........',
  '....PP..CCCCCCCC..PP....',
  '...PPP.CCMSSSSMCC.PPP...',
  '..PPPP.CCDSSSSDCC.PPPP..',
  '..PPPP.CCDSSSSDCC.PPPP..',
  '..PPPP.CCDSSSSDCC.PPPP..',
  '..QPPP.CCCDSSDCCC.PPPQ..',
  '..QPPP.CCCCCCCCCC.PPPQ..',
  '...PPP.CCCCCCCCCC.PPP...',
  '...PPP..CCCCCCCC..PPP...',
  '....PP..CC....CC..PP....',
  '........TT....TT........',
  '........TT....TT........',
  '........TT....TT........',
  '........TT....TT........',
  '........TT....TT........',
  '........BB....BB........',
  '........BB....BB........',
  '.......BBB....BBB.......',
];

const BOSS_WALK = [
  '........HHHHHHHH........',
  '.......HHHHHHHHHH.......',
  '......HHHHHHHHHHHH......',
  '.....HH....HH....HH.....',
  '........FFFFFFFF........',
  '.......FFFEFFEFFF.......',
  '.......FFFFFFFFFF.......',
  '........FFFRRFFF........',
  '.........FFFFFF.........',
  '....PP..CCCCCCCC..PP....',
  '...PPP.CCMSSSSMCC.PPP...',
  '..PPPP.CCDSSSSDCC.PPPP..',
  '..PPPP.CCDSSSSDCC.PPPP..',
  '..PPPP.CCDSSSSDCC.PPPP..',
  '..QPPP.CCCDSSDCCC.PPPQ..',
  '..QPPP.CCCCCCCCCC.PPPQ..',
  '...PPP.CCCCCCCCCC.PPP...',
  '...PPP..CCCCCCCC..PPP...',
  '....PP..CC....CC..PP....',
  '.......TT......TT.......',
  '.......TT......TT.......',
  '......TT........TT......',
  '......TT........TT......',
  '......TT........TT......',
  '......BB........BB......',
  '......BB........BB......',
  '.....BBB........BBB.....',
];

export function drawBoss(ctx, x, y, facing, frame, flash) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(ox + 6, oy + 46, 20, 3);

  let pal = P_BOSS;
  if (flash) {
    pal = {
      ...P_BOSS,
      C: '#c04040',
      D: '#a02828',
      M: '#e05050',
      P: '#801020',
      Q: '#a01830',
    };
  }

  const rows = frame % 2 === 0 ? BOSS_BODY : BOSS_WALK;
  // 24-wide art centered in 32px
  drawPixels(ctx, ox + 4, oy + 2, rows, pal, facing < 0);

  // gold buckle (imposing detail)
  const bx = facing > 0 ? ox + 14 : ox + 15;
  drawRect(ctx, bx, oy + 28, 4, 2, flash ? '#fff0a0' : '#d4a84b');
  drawRect(ctx, bx + 1, oy + 27, 2, 4, flash ? '#fff0a0' : '#8b6914');
}

// ── UI hearts ─────────────────────────────────────────────
const HEART_FULL = [
  '.RR.RR.',
  'RLRLRLR',
  'RLRRRLR',
  'DRRRRRD',
  '.DRRRD.',
  '..DRD..',
  '...D...',
];

const HEART_EMPTY = [
  '.EE.EE.',
  'EMEMEME',
  'EMEEEME',
  'MEMMMEM',
  '.MEMEM.',
  '..MEM..',
  '...M...',
];

export function drawHeart(ctx, x, y, filled) {
  drawPixels(ctx, Math.floor(x), Math.floor(y), filled ? HEART_FULL : HEART_EMPTY, P_HEART);
}

/** Pixel-bordered text panel */
export function drawPanel(ctx, x, y, w, h, fill = 'rgba(20,12,8,0.88)') {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox, oy, w, h, fill);
  // double pixel border
  drawRect(ctx, ox, oy, w, 1, COLORS.uiGold);
  drawRect(ctx, ox, oy + h - 1, w, 1, COLORS.uiGold);
  drawRect(ctx, ox, oy, 1, h, COLORS.uiGold);
  drawRect(ctx, ox + w - 1, oy, 1, h, COLORS.uiGold);
  drawRect(ctx, ox + 2, oy + 2, w - 4, 1, '#8b6914');
  drawRect(ctx, ox + 2, oy + h - 3, w - 4, 1, '#8b6914');
  drawRect(ctx, ox + 2, oy + 2, 1, h - 4, '#8b6914');
  drawRect(ctx, ox + w - 3, oy + 2, 1, h - 4, '#8b6914');
}

export function drawText(ctx, text, x, y, color = COLORS.uiCream, size = 8) {
  ctx.fillStyle = color;
  ctx.font = `${size}px "Courier New", monospace`;
  ctx.textBaseline = 'top';
  // subtle shadow for readability on busy scenes
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(text, Math.floor(x) + 1, Math.floor(y) + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, Math.floor(x), Math.floor(y));
}

export function drawCentered(ctx, text, y, color = COLORS.uiCream, size = 8) {
  ctx.font = `${size}px "Courier New", monospace`;
  const w = ctx.measureText(text).width;
  drawText(ctx, text, (256 - w) / 2, y, color, size);
}

/** Title flourish: decorative diamond / leaf accents */
export function drawTitleFlourish(ctx, cx, y) {
  const gold = COLORS.uiGold;
  const dim = '#8b6914';
  // center gem
  drawRect(ctx, cx - 2, y, 4, 4, gold);
  drawRect(ctx, cx - 1, y + 1, 2, 2, '#fff0c0');
  // side vines
  for (const dir of [-1, 1]) {
    drawRect(ctx, cx + dir * 6, y + 1, 8, 1, dim);
    drawRect(ctx, cx + dir * 14, y, 2, 3, gold);
    drawRect(ctx, cx + dir * 18, y + 1, 6, 1, dim);
    drawRect(ctx, cx + dir * 24, y, 3, 3, '#3d6a35');
  }
}
