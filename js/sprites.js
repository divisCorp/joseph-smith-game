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
  T: '#3a4568', // trousers (visible vs grass)
  G: '#8b6914', // gold plate / trim
  L: '#c4a060', // plate highlight
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
// Full-height maps (30 rows @ oy+1 → feet at oy+30). Coat→pants→boots continuous.
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
  '..NNDNSSSNDN..',
  '..NNNDSSDNNN..',
  '..NNNNNNNNNN..',
  '..NNSSSSSSNN..',
  '..NNTTTTTTNN..',
  '..NNTTTTTTNN..',
  '...TTTTTTTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...BBB..BBB...',
  '...BBB..BBB...',
  '...BBB..BBB...',
  '...BBB..BBB...',
  '..BBBB..BBBB..',
  '..BBBB..BBBB..',
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
  '..NNDNSSSNDN..',
  '..NNNDSSDNNN..',
  '..NNNNNNNNNN..',
  '..NNSSSSSSNN..',
  '..NNTTTTTTNN..',
  '..NNTTTTTTNN..',
  '...TTTTTTTT...',
  '...TTT...TTT..',
  '...TTT...TTT..',
  '..TTT....TTT..',
  '..TTT....TTT..',
  '..TTT....TTT..',
  '.TTT.....TTT..',
  '.TTT.....TTT..',
  '.BBB.....BBB..',
  '.BBB.....BBB..',
  '.BBB.....BBB..',
  'BBBB.....BBBB.',
  'BBBB.....BBBB.',
  'BBBB.....BBBB.',
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
  '..NNDNSSSNDN..',
  '..NNNDSSDNNN..',
  '..NNNNNNNNNN..',
  '..NNSSSSSSNN..',
  '..NNTTTTTTNN..',
  '..NNTTTTTTNN..',
  '...TTTTTTTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '....TTT.TTT...',
  '....TTTTTT....',
  '....TTTTTT....',
  '....TTT.TTT...',
  '....TTT.TTT...',
  '....BBB.BBB...',
  '....BBB.BBB...',
  '....BBB.BBB...',
  '...BBBB.BBBB..',
  '...BBBB.BBBB..',
  '...BBBB.BBBB..',
];

const JOSEPH_ATTACK = [
  // Throwing pose — arm extended, releasing an engraved gold plate
  '....HHHHHH....',
  '...HHHHHHHH...',
  '...HHFFFFFFH..',
  '...HFFFEFFF...',
  '...HFFFFFFR...',
  '....FFFFFF....',
  '...NNNSSSNNN..',
  '..NNDNSSSNDN..',
  '..NNDNSSSNFFF.',
  '..NNDNSSS.FF..',
  '..NNDNSSD.GLG.',
  '..NNNDSS.GLGLG',
  '..NNNNNN.GLG..',
  '..NNSSSSSSNN..',
  '..NNTTTTTTNN..',
  '..NNTTTTTTNN..',
  '...TTTTTTTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...BBB..BBB...',
  '...BBB..BBB...',
  '...BBB..BBB...',
  '...BBB..BBB...',
  '..BBBB..BBBB..',
  '..BBBB..BBBB..',
];


const JOSEPH_CROUCH = [
  // Compressed / ducked — coat scrunched, knees bent (18 rows, drawn lower)
  '....HHHHHH....',
  '...HHHHHHHH...',
  '...HHFFFFFFH..',
  '...HFFFEFFF...',
  '...HFFFFFFR...',
  '....FFFFFF....',
  '...NNNSSSNNN..',
  '..NNDNSSSNDN..',
  '..NNDNSSSNDN..',
  '..NNNDSSDNNN..',
  '..NNNNNNNNNN..',
  '..NNTTTTTTNN..',
  '...TTTTTTTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...BBB..BBB...',
  '...BBB..BBB...',
  '..BBBB..BBBB..',
];

/** Joseph Smith — coat, face, walk / jump / crouch / throw (gold-plate) poses */
export function drawJoseph(ctx, x, y, facing, frame, attacking, jumping = false, crouching = false) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const flip = facing < 0;

  // soft shadow (feet stay at oy+30 whether standing or crouched draw offset)
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(ox + 3, oy + 30, 10, 2);

  let rows = JOSEPH_IDLE;
  let rowOy = oy + 1;
  if (crouching && !jumping) {
    rows = JOSEPH_CROUCH;
    // 18-row map: pin feet to same baseline as 30-row standing maps (oy+30)
    rowOy = oy + 1 + (30 - rows.length);
  } else if (attacking) rows = JOSEPH_ATTACK;
  else if (jumping) rows = JOSEPH_JUMP;
  else if (frame % 2 === 1) rows = JOSEPH_WALK;

  // maps are 14 wide; center in 16px slot
  drawPixels(ctx, ox + 1, rowOy, rows, P_JOSEPH, flip);

  // coat button highlights (readable silhouette)
  if (!attacking && !crouching) {
    const bx = flip ? ox + 6 : ox + 9;
    drawRect(ctx, bx, oy + 12, 1, 1, '#d4a84b');
    drawRect(ctx, bx, oy + 15, 1, 1, '#d4a84b');
  } else if (crouching && !attacking) {
    const bx = flip ? ox + 6 : ox + 9;
    drawRect(ctx, bx, rowOy + 8, 1, 1, '#d4a84b');
  }
}

// ── Gold plate projectile (10×7 engraved sheet) ───────────
const P_PLATE = {
  K: '#5a4010', // rim / outline
  G: '#d4a84b', // gold face
  L: '#f0d878', // highlight
  D: '#8b6914', // engraved line / shadow
  E: '#c4983a', // mid engraving
};

const GOLD_PLATE = [
  '.KKKKKKKK.',
  'KGGLGLGGLK',
  'KGEGEGEGEK',
  'KGGLGLGGLK',
  'KDEDEDEDEK',
  'KLLLLLLLLK',
  '.KKKKKKKK.',
];

/** Small engraved golden plate / metal sheet flying as a projectile */
export function drawGoldPlate(ctx, x, y, facing = 1) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawPixels(ctx, ox, oy, GOLD_PLATE, P_PLATE, facing < 0);
  // subtle leading edge gleam
  const gx = facing > 0 ? ox + 8 : ox + 1;
  drawRect(ctx, gx, oy + 2, 1, 3, 'rgba(255,245,200,0.55)');
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
  '..CCDSSSSDCC..',
  '..CCDSSMMDCC..',
  '..CCCCCCCCCC..',
  '..CCSSSSSSCC..',
  '..CCTTTTTTCC..',
  '..CCTTTTTTCC..',
  '...TTTTTTTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...OOO..OOO...',
  '...OOO..OOO...',
  '...OOO..OOO...',
  '...OOO..OOO...',
  '..OOOO..OOOO..',
  '..OOOO..OOOO..',
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
  '..CCDSSSSDCC..',
  '..CCDSSMMDCC..',
  '..CCCCCCCCCC..',
  '..CCSSSSSSCC..',
  '..CCTTTTTTCC..',
  '..CCTTTTTTCC..',
  '...TTTTTTTT...',
  '..TTT....TTT..',
  '..TTT....TTT..',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '...TTT..TTT...',
  '....TTTTTT....',
  '....TTTTTT....',
  '....OOOOOO....',
  '....OOO.OOO...',
  '....OOO.OOO...',
  '...OOOO.OOOO..',
  '...OOOO.OOOO..',
  '...OOOO.OOOO..',
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
  drawRect(ctx, dx, oy + 22, 2, 4, '#8a8a9a');
}

/** Grove scout — green-brown coat, same silhouette */
export function drawScout(ctx, x, y, facing, frame, flash = false) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(ox + 3, oy + 30, 10, 2);

  const pal = flash
    ? { ...P_BRIGAND, C: '#a07040', D: '#806028', B: '#2a5a2a', T: '#2a3a20' }
    : { ...P_BRIGAND, C: '#3a4a28', D: '#2a3818', B: '#2a5a28', T: '#2a3a1a', S: '#6a7a58' };
  const rows = frame % 2 === 0 ? BRIGAND_A : BRIGAND_B;
  drawPixels(ctx, ox + 1, oy + 1, rows, pal, facing < 0);
  const dx = facing > 0 ? ox + 13 : ox + 1;
  drawRect(ctx, dx, oy + 22, 2, 4, '#6a8a5a');
}

/** Village thug — darker coat, red sash */
export function drawThug(ctx, x, y, facing, frame, flash = false) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(ox + 3, oy + 30, 10, 2);

  const pal = flash
    ? { ...P_BRIGAND, C: '#a04050', D: '#802030', B: '#c04040' }
    : { ...P_BRIGAND, C: '#2a2030', D: '#1a1020', B: '#8b2028', T: '#1a1a22', S: '#5a4858' };
  const rows = frame % 2 === 0 ? BRIGAND_A : BRIGAND_B;
  drawPixels(ctx, ox + 1, oy + 1, rows, pal, facing < 0);
  const dx = facing > 0 ? ox + 13 : ox + 1;
  drawRect(ctx, dx, oy + 22, 2, 4, '#c0a060');
  // sash stripe
  drawRect(ctx, ox + 4, oy + 18, 8, 2, flash ? '#ff8080' : '#a02828');
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
  '..DF....FD....',
  '..DP....PD....',
  '..DP....PD....',
  '..DD....DD....',
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
  '.DF......FD...',
  '.DP......PD...',
  '.DP......PD...',
  '.DD......DD...',
  '.DD......DD...',
];

export function drawWolf(ctx, x, y, facing, frame, flash = false) {
  const ox = Math.floor(x);
  const oy = Math.floor(y) + 14;
  const bob = frame % 2;
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(ox + 2, oy + 16, 12, 2);

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
  '..PPPP.CCDSSSSDCC.PPPP..',
  '..QPPP.CCCDSSDCCC.PPPQ..',
  '..QPPP.CCCCCCCCCC.PPPQ..',
  '...PPP.CCCCCCCCCC.PPP...',
  '...PPP..CCCCCCCC..PPP...',
  '....PP..CCTTTTCC..PP....',
  '........TTTTTTTT........',
  '........TTTTTTTT........',
  '........TTTTTTTT........',
  '........TT....TT........',
  '........TT....TT........',
  '........TT....TT........',
  '........TT....TT........',
  '........TT....TT........',
  '........TT....TT........',
  '........TT....TT........',
  '........TT....TT........',
  '........TT....TT........',
  '........TT....TT........',
  '........TT....TT........',
  '........BB....BB........',
  '........BB....BB........',
  '........BB....BB........',
  '........BB....BB........',
  '........BB....BB........',
  '........BB....BB........',
  '.......BBB....BBB.......',
  '.......BBB....BBB.......',
  '......BBBB....BBBB......',
  '......BBBB....BBBB......',
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
  '..PPPP.CCDSSSSDCC.PPPP..',
  '..QPPP.CCCDSSDCCC.PPPQ..',
  '..QPPP.CCCCCCCCCC.PPPQ..',
  '...PPP.CCCCCCCCCC.PPP...',
  '...PPP..CCCCCCCC..PPP...',
  '....PP..CCTTTTCC..PP....',
  '........TTTTTTTT........',
  '........TTTTTTTT........',
  '........TTTTTTTT........',
  '.......TT......TT.......',
  '.......TT......TT.......',
  '......TT........TT......',
  '......TT........TT......',
  '......TT........TT......',
  '......TT........TT......',
  '.....TT..........TT.....',
  '.....TT..........TT.....',
  '.....TT..........TT.....',
  '.....TT..........TT.....',
  '.....TT..........TT.....',
  '.....BB..........BB.....',
  '.....BB..........BB.....',
  '.....BB..........BB.....',
  '.....BB..........BB.....',
  '.....BB..........BB.....',
  '.....BB..........BB.....',
  '....BBB..........BBB....',
  '....BBB..........BBB....',
  '...BBBB..........BBBB...',
  '...BBBB..........BBBB...',
];

const BOSS_PALETTES = {
  ringleader: P_BOSS,
  sentinel: {
    ...P_BOSS,
    H: '#0a1810',
    C: '#1a3020',
    D: '#0e2014',
    M: '#2a4030',
    P: '#1a4028',
    Q: '#2a5838',
    T: '#142018',
    B: '#081208',
    G: '#6a8b4b',
  },
  captain: {
    ...P_BOSS,
    H: '#1a1018',
    C: '#3a2030',
    D: '#281018',
    M: '#4a3040',
    P: '#5a1830',
    Q: '#7a2840',
    T: '#201018',
    B: '#100808',
    G: '#c07040',
  },
  warden: {
    ...P_BOSS,
    H: '#081018',
    C: '#1a2840',
    D: '#101828',
    M: '#2a3850',
    P: '#183048',
    Q: '#285070',
    T: '#101828',
    B: '#080c14',
    G: '#6a90b0',
  },
  overseer: {
    ...P_BOSS,
    H: '#080810',
    C: '#201028',
    D: '#140818',
    M: '#302038',
    P: '#401020',
    Q: '#602030',
    T: '#100818',
    B: '#08040c',
    G: '#d4a84b',
    S: '#e8d0b0',
  },
};

export function drawBoss(ctx, x, y, facing, frame, flash, bossKind = 'ringleader') {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(ox + 6, oy + 46, 20, 3);

  let pal = BOSS_PALETTES[bossKind] || P_BOSS;
  if (flash) {
    pal = {
      ...pal,
      C: '#c04040',
      D: '#a02828',
      M: '#e05050',
      P: '#801020',
      Q: '#a01830',
    };
  }

  const rows = frame % 2 === 0 ? BOSS_BODY : BOSS_WALK;
  drawPixels(ctx, ox + 4, oy + 2, rows, pal, facing < 0);

  const bx = facing > 0 ? ox + 14 : ox + 15;
  const accent = bossKind === 'warden' ? '#6a90b0' : bossKind === 'sentinel' ? '#6a8b4b' : '#d4a84b';
  drawRect(ctx, bx, oy + 30, 4, 2, flash ? '#fff0a0' : accent);
  drawRect(ctx, bx + 1, oy + 29, 2, 4, flash ? '#fff0a0' : '#8b6914');

  // Overseer storm spark accents
  if (bossKind === 'overseer' && !flash) {
    drawRect(ctx, ox + 8, oy + 12, 2, 2, '#a0c0ff');
    drawRect(ctx, ox + 22, oy + 16, 2, 2, '#c0e0ff');
  }
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
export function drawPanel(ctx, x, y, w, h, fill = 'rgba(12,8,6,0.92)') {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox, oy, w, h, fill);
  // outer gold border
  drawRect(ctx, ox, oy, w, 1, COLORS.uiGold);
  drawRect(ctx, ox, oy + h - 1, w, 1, COLORS.uiGold);
  drawRect(ctx, ox, oy, 1, h, COLORS.uiGold);
  drawRect(ctx, ox + w - 1, oy, 1, h, COLORS.uiGold);
  // inner highlight / shadow
  drawRect(ctx, ox + 2, oy + 2, w - 4, 1, '#c4983a');
  drawRect(ctx, ox + 2, oy + h - 3, w - 4, 1, '#5a4010');
  drawRect(ctx, ox + 2, oy + 2, 1, h - 4, '#c4983a');
  drawRect(ctx, ox + w - 3, oy + 2, 1, h - 4, '#5a4010');
}

// ── Crisp 5×7 bitmap font (integer pixels; stays sharp when canvas is upscaled) ──
const FONT_W = 5;
const FONT_H = 7;
const FONT_GAP = 1;

/** Packed 5-wide rows as bitmasks (MSB = leftmost). */
const FONT = {
  " ": [0, 0, 0, 0, 0, 0, 0],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "'": [4, 4, 8, 0, 0, 0, 0],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "+": [0, 4, 4, 31, 4, 4, 0],
  ",": [0, 0, 0, 0, 4, 4, 8],
  "-": [0, 0, 0, 31, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 4, 4],
  "/": [1, 2, 2, 4, 8, 8, 16],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 2, 4, 8, 31],
  "3": [30, 1, 1, 14, 1, 1, 30],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [14, 16, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 1, 14],
  ":": [0, 4, 4, 0, 4, 4, 0],
  "?": [14, 17, 1, 2, 4, 0, 4],
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 14],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 17, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 17, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  a: [0, 0, 14, 1, 15, 17, 15],
  b: [16, 16, 30, 17, 17, 17, 30],
  c: [0, 0, 14, 16, 16, 16, 14],
  d: [1, 1, 15, 17, 17, 17, 15],
  e: [0, 0, 14, 17, 31, 16, 14],
  f: [6, 8, 8, 28, 8, 8, 8],
  g: [0, 0, 15, 17, 15, 1, 14],
  h: [16, 16, 30, 17, 17, 17, 17],
  i: [4, 0, 12, 4, 4, 4, 14],
  j: [2, 0, 6, 2, 2, 18, 12],
  k: [16, 16, 18, 20, 24, 20, 18],
  l: [12, 4, 4, 4, 4, 4, 14],
  m: [0, 0, 26, 21, 21, 17, 17],
  n: [0, 0, 30, 17, 17, 17, 17],
  o: [0, 0, 14, 17, 17, 17, 14],
  p: [0, 0, 30, 17, 30, 16, 16],
  q: [0, 0, 15, 17, 15, 1, 1],
  r: [0, 0, 22, 25, 16, 16, 16],
  s: [0, 0, 15, 16, 14, 1, 30],
  t: [8, 8, 28, 8, 8, 8, 6],
  u: [0, 0, 17, 17, 17, 17, 15],
  v: [0, 0, 17, 17, 17, 10, 4],
  w: [0, 0, 17, 17, 21, 21, 10],
  x: [0, 0, 17, 10, 4, 10, 17],
  y: [0, 0, 17, 17, 15, 1, 14],
  z: [0, 0, 31, 2, 4, 8, 31],
  "·": [0, 0, 0, 4, 0, 0, 0],
  "–": [0, 0, 0, 31, 0, 0, 0],
  "—": [0, 0, 0, 31, 0, 0, 0],
};

/** Map CSS-ish size (legacy API) → integer pixel scale (1 or 2). */
export function textScale(size = 8) {
  return size >= 12 ? 2 : 1;
}

export function measureText(text, size = 8) {
  const scale = textScale(size);
  const s = String(text);
  if (!s.length) return 0;
  return s.length * (FONT_W + FONT_GAP) * scale - FONT_GAP * scale;
}

function glyphFor(ch) {
  return FONT[ch] || FONT['?'] || FONT[' '];
}

function paintGlyph(ctx, glyph, x, y, scale, color) {
  ctx.fillStyle = color;
  for (let row = 0; row < FONT_H; row++) {
    const bits = glyph[row];
    for (let col = 0; col < FONT_W; col++) {
      if (bits & (0x10 >> col)) {
        ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
      }
    }
  }
}

/**
 * Pixel-perfect text. Integer positions only.
 * Optional 1-canvas-px dark outline (not scale-thick) for contrast on busy BGs.
 * size ~8 → 5×7, size ≥12 → 2× scale (10×14).
 */
export function drawText(ctx, text, x, y, color = COLORS.uiCream, size = 8, outline = true) {
  const scale = textScale(size);
  const px = Math.floor(x);
  const py = Math.floor(y);
  const s = String(text);
  const outlineColor = '#050302';
  // 1px outline in canvas space so 2× titles stay sharp (not a fat halo)
  const ring = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];

  if (outline) {
    for (let i = 0; i < s.length; i++) {
      const g = glyphFor(s[i]);
      const gx = px + i * (FONT_W + FONT_GAP) * scale;
      for (const [ox, oy] of ring) {
        paintGlyph(ctx, g, gx + ox, py + oy, scale, outlineColor);
      }
    }
  }

  for (let i = 0; i < s.length; i++) {
    const g = glyphFor(s[i]);
    const gx = px + i * (FONT_W + FONT_GAP) * scale;
    paintGlyph(ctx, g, gx, py, scale, color);
  }
}

export function drawCentered(ctx, text, y, color = COLORS.uiCream, size = 8, outline = true) {
  const w = measureText(text, size);
  drawText(ctx, text, Math.floor((256 - w) / 2), y, color, size, outline);
}

/** Title flourish: center gem + mirrored vine tips */
export function drawTitleFlourish(ctx, cx, y) {
  const gold = COLORS.uiGold;
  const dim = '#8b6914';
  cx = Math.floor(cx);
  y = Math.floor(y);
  // diamond gem
  drawRect(ctx, cx - 1, y, 2, 1, gold);
  drawRect(ctx, cx - 2, y + 1, 4, 1, gold);
  drawRect(ctx, cx - 3, y + 2, 6, 1, gold);
  drawRect(ctx, cx - 2, y + 3, 4, 1, gold);
  drawRect(ctx, cx - 1, y + 4, 2, 1, gold);
  drawRect(ctx, cx - 1, y + 2, 2, 1, '#fff0c0');
  for (const dir of [-1, 1]) {
    drawRect(ctx, cx + dir * 6, y + 2, 12, 1, dim);
    drawRect(ctx, cx + dir * 18, y + 1, 2, 3, gold);
    drawRect(ctx, cx + dir * 21, y + 2, 10, 1, dim);
    // small leaf tip
    drawRect(ctx, cx + dir * 31, y + 1, 3, 1, '#3d7a3a');
    drawRect(ctx, cx + dir * 32, y + 2, 3, 1, '#4a8a40');
    drawRect(ctx, cx + dir * 31, y + 3, 3, 1, '#3d7a3a');
  }
}

/** Double-line gold underline under titles */
export function drawTitleUnderline(ctx, cx, y, halfW = 70) {
  cx = Math.floor(cx);
  y = Math.floor(y);
  drawRect(ctx, cx - halfW, y, halfW * 2, 1, COLORS.uiGold);
  drawRect(ctx, cx - halfW + 4, y + 2, halfW * 2 - 8, 1, '#8b6914');
  drawRect(ctx, cx - 2, y - 1, 4, 1, '#fff0c0');
}
