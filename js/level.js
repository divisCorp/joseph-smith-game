/**
 * Level data — The Prophet's Path campaign (Levels 1–7)
 * Tile codes: 0 empty, 1 solid ground, 2 platform, 3 wall, 4 water (visual/hazard gap).
 */
import { TILE, W, H, COLORS, LEVEL_META, SCALE } from './constants.js';
import { createEnemy } from './enemy.js';
import { drawRect } from './sprites.js';

function emptyTiles(cols, rows) {
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    tiles[r] = [];
    for (let c = 0; c < cols; c++) tiles[r][c] = 0;
  }
  return tiles;
}

function fillGround(tiles, groundR, cols, gaps = []) {
  for (let c = 0; c < cols; c++) {
    const gap = gaps.some(([a, b]) => c >= a && c <= b);
    if (!gap) {
      tiles[groundR][c] = 1;
      tiles[groundR + 1][c] = 1;
    }
  }
}

function placePlatform(tiles, c, r, len) {
  for (let i = 0; i < len; i++) {
    if (c + i < tiles[0].length) tiles[r][c + i] = 2;
  }
}

function placeWater(tiles, groundR, cols, ranges) {
  for (const [a, b] of ranges) {
    for (let c = a; c <= b && c < cols; c++) {
      tiles[groundR][c] = 4;
      tiles[groundR + 1][c] = 4;
    }
  }
}

function farWall(tiles, cols, groundR) {
  for (let r = 8; r < groundR; r++) tiles[r][cols - 1] = 3;
}

function tilesToSolids(tiles) {
  const solids = [];
  const rows = tiles.length;
  const cols = tiles[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = tiles[r][c];
      if (t === 1 || t === 2 || t === 3) {
        const plat = t === 2;
        solids.push({
          x: c * TILE,
          y: r * TILE,
          w: TILE,
          h: plat ? 8 : TILE,
          kind: plat ? 'plat' : t === 3 ? 'wall' : 'ground',
        });
      }
    }
  }
  return solids;
}

function wrapLevel(num, theme, cols, rows, tiles, enemies, decor, spawn, bossZoneX, extras = {}) {
  const meta = LEVEL_META[num];
  return {
    id: `level${num}`,
    num,
    name: meta.name,
    short: meta.short,
    theme,
    cols,
    rows,
    tiles,
    solids: tilesToSolids(tiles).concat([
      { x: -TILE, y: 0, w: TILE, h: rows * TILE, kind: 'wall' },
    ]),
    enemies,
    decor,
    spawn,
    widthPx: cols * TILE,
    bossTriggered: false,
    bossZoneX,
    bossTitle: meta.bossTitle,
    ...extras,
  };
}

// ── Level 1: Sacred Grove (boy / First Vision) ────────────
export function createLevel1() {
  const cols = 120;
  const rows = 15;
  const tiles = emptyTiles(cols, rows);
  const groundR = 13;
  fillGround(tiles, groundR, cols, [
    [32, 33],
    [55, 57],
    [79, 81],
  ]);
  placePlatform(tiles, 18, 10, 4);
  placePlatform(tiles, 35, 9, 3);
  placePlatform(tiles, 42, 11, 3);
  placePlatform(tiles, 60, 10, 5);
  placePlatform(tiles, 70, 8, 3);
  placePlatform(tiles, 88, 10, 4);
  placePlatform(tiles, 96, 9, 3);
  for (let c = 100; c < cols; c++) {
    tiles[groundR][c] = 1;
    tiles[groundR + 1][c] = 1;
  }
  farWall(tiles, cols, groundR);

  const enemies = [
    createEnemy('wolf', 22 * TILE, 11 * TILE, { patrolMin: 20 * TILE, patrolMax: 28 * TILE }),
    createEnemy('wolf', 38 * TILE, 7 * TILE, { patrolMin: 35 * TILE, patrolMax: 42 * TILE }),
    createEnemy('wolf', 65 * TILE, 8 * TILE, { patrolMin: 60 * TILE, patrolMax: 70 * TILE }),
    createEnemy('wolf', 92 * TILE, 11 * TILE, { patrolMin: 88 * TILE, patrolMax: 96 * TILE }),
    createEnemy('cloud', 108 * TILE, 8 * TILE, {
      patrolMin: 102 * TILE,
      patrolMax: 116 * TILE,
    }),
  ];

  const decor = [];
  for (let c = 4; c < 100; c += 7) {
    if (tiles[groundR][c] === 1) {
      decor.push({ type: 'tree', x: c * TILE, y: (groundR - 4) * TILE, variant: (c / 7) % 3 });
    }
  }
  for (let c = 12; c < 20; c++) {
    if (tiles[groundR][c] === 1) decor.push({ type: 'fence', x: c * TILE, y: (groundR - 1) * TILE });
  }
  for (const c of [44, 45, 46, 84, 85]) {
    if (tiles[groundR][c] === 1) decor.push({ type: 'fence', x: c * TILE, y: (groundR - 1) * TILE });
  }
  decor.push({ type: 'gate', x: 100 * TILE, y: (groundR - 5) * TILE });
  decor.push({ type: 'gate', x: 101 * TILE, y: (groundR - 5) * TILE });
  decor.push({ type: 'cabin', x: 8 * TILE, y: 9 * TILE });

  return wrapLevel(1, 'woods', cols, rows, tiles, enemies, decor, { x: 3 * TILE, y: 10 * TILE }, 100 * TILE, {
    goal: 'boss',
  });
}

// ── Level 2: A Messenger (meet Moroni) ────────────────────
export function createLevel2() {
  const cols = 128;
  const rows = 15;
  const tiles = emptyTiles(cols, rows);
  const groundR = 13;
  fillGround(tiles, groundR, cols, [
    [28, 29],
    [48, 50],
    [72, 73],
    [90, 92],
  ]);
  placePlatform(tiles, 14, 11, 3);
  placePlatform(tiles, 20, 9, 3);
  placePlatform(tiles, 32, 10, 4);
  placePlatform(tiles, 40, 8, 3);
  placePlatform(tiles, 52, 10, 3);
  placePlatform(tiles, 58, 8, 4);
  placePlatform(tiles, 66, 11, 3);
  placePlatform(tiles, 76, 9, 4);
  placePlatform(tiles, 84, 7, 3);
  placePlatform(tiles, 96, 10, 4);
  for (let c = 108; c < cols; c++) {
    tiles[groundR][c] = 1;
    tiles[groundR + 1][c] = 1;
  }
  farWall(tiles, cols, groundR);

  const enemies = [
    createEnemy('scout', 18 * TILE, 7 * TILE, { patrolMin: 14 * TILE, patrolMax: 24 * TILE }),
    createEnemy('wolf', 34 * TILE, 8 * TILE, { patrolMin: 32 * TILE, patrolMax: 38 * TILE }),
    createEnemy('scout', 44 * TILE, 11 * TILE, { patrolMin: 42 * TILE, patrolMax: 48 * TILE }),
    createEnemy('wolf', 55 * TILE, 8 * TILE, { patrolMin: 52 * TILE, patrolMax: 62 * TILE }),
    createEnemy('scout', 80 * TILE, 7 * TILE, { patrolMin: 76 * TILE, patrolMax: 88 * TILE }),
    createEnemy('wolf', 98 * TILE, 8 * TILE, { patrolMin: 96 * TILE, patrolMax: 102 * TILE }),
  ];

  const decor = [];
  for (let c = 2; c < 108; c += 4) {
    if (tiles[groundR][c] === 1) {
      decor.push({ type: 'tree', x: c * TILE - 8, y: (groundR - 5) * TILE, variant: c % 3, tall: true });
    }
  }
  for (const c of [16, 36, 60, 82, 100]) {
    decor.push({ type: 'stone', x: c * TILE, y: (groundR - 1) * TILE });
  }
  decor.push({ type: 'gate', x: 108 * TILE, y: (groundR - 5) * TILE });
  decor.push({ type: 'gate', x: 109 * TILE, y: (groundR - 5) * TILE });

  const goalX = 112 * TILE;
  return wrapLevel(2, 'grove', cols, rows, tiles, enemies, decor, { x: 3 * TILE, y: 10 * TILE }, 108 * TILE, {
    goal: 'reach',
    goalX,
    moroni: { x: goalX, y: (groundR - 3) * TILE },
  });
}

// ── Level 3: Hill Cumorah (find the plates) ───────────────
export function createLevel3() {
  // Reuse storm/hill geometry (former Temple Hill)
  const cols = 140;
  const rows = 15;
  const tiles = emptyTiles(cols, rows);
  const groundR = 13;
  fillGround(tiles, groundR, cols, [
    [24, 25],
    [44, 46],
    [68, 69],
    [88, 90],
  ]);
  placePlatform(tiles, 10, 11, 3);
  placePlatform(tiles, 16, 9, 3);
  placePlatform(tiles, 28, 10, 4);
  placePlatform(tiles, 36, 8, 3);
  placePlatform(tiles, 48, 9, 4);
  placePlatform(tiles, 56, 7, 3);
  placePlatform(tiles, 62, 10, 3);
  placePlatform(tiles, 72, 8, 4);
  placePlatform(tiles, 80, 6, 3);
  placePlatform(tiles, 92, 9, 4);
  placePlatform(tiles, 100, 7, 3);
  placePlatform(tiles, 108, 10, 4);
  for (let c = 120; c < cols; c++) {
    tiles[groundR][c] = 1;
    tiles[groundR + 1][c] = 1;
  }
  placePlatform(tiles, 124, 11, 8);
  farWall(tiles, cols, groundR);

  const enemies = [
    createEnemy('scout', 14 * TILE, 7 * TILE, { patrolMin: 10 * TILE, patrolMax: 20 * TILE }),
    createEnemy('wolf', 30 * TILE, 8 * TILE, { patrolMin: 28 * TILE, patrolMax: 36 * TILE }),
    createEnemy('wisp', 48 * TILE, 6 * TILE, { patrolMin: 44 * TILE, patrolMax: 56 * TILE }),
    createEnemy('scout', 64 * TILE, 8 * TILE, { patrolMin: 62 * TILE, patrolMax: 68 * TILE }),
    createEnemy('wolf', 76 * TILE, 6 * TILE, { patrolMin: 72 * TILE, patrolMax: 84 * TILE }),
    createEnemy('wisp', 100 * TILE, 5 * TILE, { patrolMin: 96 * TILE, patrolMax: 108 * TILE }),
  ];

  const decor = [];
  for (let c = 4; c < 120; c += 9) {
    if (tiles[groundR][c] === 1) {
      decor.push({ type: 'tree', x: c * TILE, y: (groundR - 4) * TILE, variant: c % 3 });
    }
  }
  for (const c of [20, 50, 78, 110]) {
    decor.push({ type: 'pillar', x: c * TILE, y: (groundR - 4) * TILE });
  }
  decor.push({ type: 'gate', x: 120 * TILE, y: (groundR - 5) * TILE });
  decor.push({ type: 'gate', x: 121 * TILE, y: (groundR - 5) * TILE });
  decor.push({ type: 'shrine', x: 130 * TILE, y: (groundR - 6) * TILE });

  const pickup = { x: 130 * TILE + 20, y: (groundR - 2) * TILE - 8, w: 40, h: 28, taken: false };
  return wrapLevel(3, 'storm', cols, rows, tiles, enemies, decor, { x: 3 * TILE, y: 10 * TILE }, 120 * TILE, {
    goal: 'pickup',
    pickup,
  });
}

// ── Level 4: Missouri Night (mobs + captain) ──────────────
export function createLevel4() {
  // Reuse village layout
  const cols = 130;
  const rows = 15;
  const tiles = emptyTiles(cols, rows);
  const groundR = 13;
  fillGround(tiles, groundR, cols, [
    [36, 37],
    [62, 63],
  ]);
  placePlatform(tiles, 10, 10, 5);
  placePlatform(tiles, 18, 8, 4);
  placePlatform(tiles, 28, 9, 3);
  placePlatform(tiles, 40, 10, 5);
  placePlatform(tiles, 48, 7, 4);
  placePlatform(tiles, 56, 9, 3);
  placePlatform(tiles, 68, 10, 4);
  placePlatform(tiles, 76, 8, 5);
  placePlatform(tiles, 88, 10, 3);
  placePlatform(tiles, 94, 7, 4);
  placePlatform(tiles, 102, 9, 4);
  for (let c = 112; c < cols; c++) {
    tiles[groundR][c] = 1;
    tiles[groundR + 1][c] = 1;
  }
  farWall(tiles, cols, groundR);

  const enemies = [
    createEnemy('brigand', 14 * TILE, 8 * TILE, { patrolMin: 10 * TILE, patrolMax: 18 * TILE }),
    createEnemy('thug', 24 * TILE, 11 * TILE, { patrolMin: 22 * TILE, patrolMax: 30 * TILE }),
    createEnemy('brigand', 42 * TILE, 8 * TILE, { patrolMin: 40 * TILE, patrolMax: 48 * TILE }),
    createEnemy('thug', 50 * TILE, 5 * TILE, { patrolMin: 48 * TILE, patrolMax: 56 * TILE }),
    createEnemy('wolf', 70 * TILE, 8 * TILE, { patrolMin: 68 * TILE, patrolMax: 76 * TILE }),
    createEnemy('thug', 80 * TILE, 6 * TILE, { patrolMin: 76 * TILE, patrolMax: 86 * TILE }),
    createEnemy('brigand', 96 * TILE, 5 * TILE, { patrolMin: 94 * TILE, patrolMax: 102 * TILE }),
    createEnemy('thug', 104 * TILE, 11 * TILE, { patrolMin: 102 * TILE, patrolMax: 108 * TILE }),
    createEnemy('boss', 120 * TILE, 10 * TILE, {
      bossKind: 'captain',
      title: 'MOB CAPTAIN',
      patrolMin: 114 * TILE,
      patrolMax: 126 * TILE,
    }),
  ];

  const decor = [];
  const buildings = [
    [6, 3], [22, 2], [44, 3], [64, 2], [84, 3], [100, 2],
  ];
  for (const [c, variant] of buildings) {
    decor.push({ type: 'building', x: c * TILE, y: (groundR - 6) * TILE, variant });
  }
  for (let c = 0; c < 112; c += 8) {
    if (tiles[groundR][c] === 1) decor.push({ type: 'lamp', x: c * TILE, y: (groundR - 3) * TILE });
  }
  decor.push({ type: 'gate', x: 112 * TILE, y: (groundR - 5) * TILE });
  decor.push({ type: 'gate', x: 113 * TILE, y: (groundR - 5) * TILE });

  return wrapLevel(4, 'village', cols, rows, tiles, enemies, decor, { x: 3 * TILE, y: 10 * TILE }, 112 * TILE, {
    goal: 'boss',
  });
}

// ── Level 5: Far West Road (warden boss) ──────────────────
export function createLevel5() {
  // Reuse river layout
  const cols = 136;
  const rows = 15;
  const tiles = emptyTiles(cols, rows);
  const groundR = 13;
  fillGround(tiles, groundR, cols, [
    [20, 27],
    [40, 49],
    [66, 75],
    [92, 101],
  ]);
  placeWater(tiles, groundR, cols, [
    [20, 27],
    [40, 49],
    [66, 75],
    [92, 101],
  ]);
  placePlatform(tiles, 21, 11, 3);
  placePlatform(tiles, 25, 10, 3);
  placePlatform(tiles, 41, 11, 4);
  placePlatform(tiles, 46, 9, 3);
  placePlatform(tiles, 67, 11, 3);
  placePlatform(tiles, 71, 10, 4);
  placePlatform(tiles, 93, 11, 4);
  placePlatform(tiles, 98, 9, 3);
  placePlatform(tiles, 12, 10, 3);
  placePlatform(tiles, 32, 9, 3);
  placePlatform(tiles, 56, 10, 4);
  placePlatform(tiles, 82, 9, 3);
  placePlatform(tiles, 106, 10, 4);
  for (let c = 116; c < cols; c++) {
    tiles[groundR][c] = 1;
    tiles[groundR + 1][c] = 1;
  }
  farWall(tiles, cols, groundR);

  const enemies = [
    createEnemy('brigand', 14 * TILE, 8 * TILE, { patrolMin: 12 * TILE, patrolMax: 18 * TILE }),
    createEnemy('scout', 34 * TILE, 7 * TILE, { patrolMin: 32 * TILE, patrolMax: 38 * TILE }),
    createEnemy('wolf', 44 * TILE, 7 * TILE, { patrolMin: 41 * TILE, patrolMax: 50 * TILE }),
    createEnemy('thug', 58 * TILE, 8 * TILE, { patrolMin: 56 * TILE, patrolMax: 64 * TILE }),
    createEnemy('scout', 72 * TILE, 8 * TILE, { patrolMin: 67 * TILE, patrolMax: 78 * TILE }),
    createEnemy('wolf', 84 * TILE, 7 * TILE, { patrolMin: 82 * TILE, patrolMax: 88 * TILE }),
    createEnemy('brigand', 108 * TILE, 8 * TILE, { patrolMin: 106 * TILE, patrolMax: 112 * TILE }),
    createEnemy('boss', 124 * TILE, 10 * TILE, {
      bossKind: 'warden',
      title: 'JAILER WARDEN',
      patrolMin: 118 * TILE,
      patrolMax: 132 * TILE,
    }),
  ];

  const decor = [];
  for (let c = 2; c < 18; c += 6) {
    decor.push({ type: 'tree', x: c * TILE, y: (groundR - 4) * TILE, variant: 0 });
  }
  for (let c = 108; c < 116; c += 4) {
    decor.push({ type: 'tree', x: c * TILE, y: (groundR - 4) * TILE, variant: 1 });
  }
  for (const c of [19, 28, 39, 50, 65, 76, 91, 102]) {
    decor.push({ type: 'reed', x: c * TILE, y: (groundR - 1) * TILE });
  }
  decor.push({ type: 'gate', x: 116 * TILE, y: (groundR - 5) * TILE });
  decor.push({ type: 'gate', x: 117 * TILE, y: (groundR - 5) * TILE });

  return wrapLevel(5, 'river', cols, rows, tiles, enemies, decor, { x: 3 * TILE, y: 10 * TILE }, 116 * TILE, {
    goal: 'boss',
  });
}

// ── Level 6: Nauvoo (ringleader / overseer) ───────────────
export function createLevel6() {
  // Village-like, shifted enemy/boss positions
  const cols = 132;
  const rows = 15;
  const tiles = emptyTiles(cols, rows);
  const groundR = 13;
  fillGround(tiles, groundR, cols, [
    [30, 31],
    [58, 60],
    [84, 85],
  ]);
  placePlatform(tiles, 8, 10, 4);
  placePlatform(tiles, 16, 8, 4);
  placePlatform(tiles, 26, 9, 3);
  placePlatform(tiles, 38, 10, 5);
  placePlatform(tiles, 46, 7, 4);
  placePlatform(tiles, 54, 9, 3);
  placePlatform(tiles, 66, 10, 4);
  placePlatform(tiles, 74, 8, 5);
  placePlatform(tiles, 90, 10, 3);
  placePlatform(tiles, 96, 7, 4);
  placePlatform(tiles, 106, 9, 4);
  for (let c = 116; c < cols; c++) {
    tiles[groundR][c] = 1;
    tiles[groundR + 1][c] = 1;
  }
  farWall(tiles, cols, groundR);

  const enemies = [
    createEnemy('thug', 12 * TILE, 8 * TILE, { patrolMin: 8 * TILE, patrolMax: 18 * TILE }),
    createEnemy('brigand', 28 * TILE, 11 * TILE, { patrolMin: 24 * TILE, patrolMax: 34 * TILE }),
    createEnemy('scout', 40 * TILE, 8 * TILE, { patrolMin: 38 * TILE, patrolMax: 46 * TILE }),
    createEnemy('thug', 52 * TILE, 5 * TILE, { patrolMin: 46 * TILE, patrolMax: 56 * TILE }),
    createEnemy('brigand', 70 * TILE, 8 * TILE, { patrolMin: 66 * TILE, patrolMax: 76 * TILE }),
    createEnemy('thug', 78 * TILE, 6 * TILE, { patrolMin: 74 * TILE, patrolMax: 86 * TILE }),
    createEnemy('scout', 98 * TILE, 5 * TILE, { patrolMin: 96 * TILE, patrolMax: 104 * TILE }),
    createEnemy('thug', 108 * TILE, 11 * TILE, { patrolMin: 106 * TILE, patrolMax: 114 * TILE }),
    createEnemy('boss', 122 * TILE, 10 * TILE, {
      bossKind: 'overseer',
      title: 'CONSPIRACY RINGLEADER',
      patrolMin: 116 * TILE,
      patrolMax: 128 * TILE,
    }),
  ];

  const decor = [];
  const buildings = [
    [4, 2], [20, 3], [42, 2], [62, 3], [88, 2], [104, 3],
  ];
  for (const [c, variant] of buildings) {
    decor.push({ type: 'building', x: c * TILE, y: (groundR - 6) * TILE, variant });
  }
  for (let c = 2; c < 116; c += 7) {
    if (tiles[groundR][c] === 1) decor.push({ type: 'lamp', x: c * TILE, y: (groundR - 3) * TILE });
  }
  decor.push({ type: 'gate', x: 116 * TILE, y: (groundR - 5) * TILE });
  decor.push({ type: 'gate', x: 117 * TILE, y: (groundR - 5) * TILE });

  return wrapLevel(6, 'village', cols, rows, tiles, enemies, decor, { x: 3 * TILE, y: 10 * TILE }, 116 * TILE, {
    goal: 'boss',
  });
}

// ── Level 7: Carthage Jail (martyr ending) ────────────────
export function createLevel7() {
  const cols = 70;
  const rows = 15;
  const tiles = emptyTiles(cols, rows);
  const groundR = 13;
  fillGround(tiles, groundR, cols, []);
  // Cell platforms / stairs feel
  placePlatform(tiles, 6, 11, 4);
  placePlatform(tiles, 12, 9, 3);
  placePlatform(tiles, 18, 11, 4);
  placePlatform(tiles, 26, 10, 3);
  placePlatform(tiles, 32, 8, 4);
  placePlatform(tiles, 40, 10, 3);
  placePlatform(tiles, 46, 9, 4);
  placePlatform(tiles, 54, 11, 3);
  // Stone wall segments (indoor cells)
  for (let r = 8; r < groundR; r++) {
    tiles[r][0] = 3;
    tiles[r][cols - 1] = 3;
  }
  for (let c = 2; c < 8; c++) tiles[8][c] = 3;
  for (let c = 22; c < 28; c++) tiles[8][c] = 3;
  for (let c = 42; c < 48; c++) tiles[8][c] = 3;
  farWall(tiles, cols, groundR);

  const enemies = [
    createEnemy('thug', 10 * TILE, 11 * TILE, { patrolMin: 8 * TILE, patrolMax: 16 * TILE }),
    createEnemy('brigand', 20 * TILE, 11 * TILE, { patrolMin: 18 * TILE, patrolMax: 26 * TILE }),
    createEnemy('thug', 34 * TILE, 6 * TILE, { patrolMin: 32 * TILE, patrolMax: 40 * TILE }),
    createEnemy('brigand', 48 * TILE, 11 * TILE, { patrolMin: 46 * TILE, patrolMax: 54 * TILE }),
    createEnemy('thug', 56 * TILE, 11 * TILE, { patrolMin: 54 * TILE, patrolMax: 62 * TILE }),
  ];

  const decor = [];
  for (const c of [4, 14, 24, 36, 50]) {
    decor.push({ type: 'lamp', x: c * TILE, y: (groundR - 3) * TILE });
  }
  decor.push({ type: 'pillar', x: 8 * TILE, y: (groundR - 4) * TILE });
  decor.push({ type: 'pillar', x: 28 * TILE, y: (groundR - 4) * TILE });
  decor.push({ type: 'pillar', x: 50 * TILE, y: (groundR - 4) * TILE });
  // Window marker near far end
  decor.push({ type: 'shrine', x: 58 * TILE, y: (groundR - 5) * TILE });

  const goalX = 58 * TILE;
  return wrapLevel(7, 'jail', cols, rows, tiles, enemies, decor, { x: 3 * TILE, y: 10 * TILE }, 50 * TILE, {
    goal: 'martyr',
    goalX,
  });
}

export function createLevel(num) {
  switch (num) {
    case 1: return createLevel1();
    case 2: return createLevel2();
    case 3: return createLevel3();
    case 4: return createLevel4();
    case 5: return createLevel5();
    case 6: return createLevel6();
    case 7: return createLevel7();
    default: return createLevel1();
  }
}

// ── Drawing (HD illustrated environments @ 2×) ────────────
export function drawLevelBackground(ctx, camX, level) {
  const theme = level.theme || 'woods';
  if (theme === 'grove') drawBgGrove(ctx, camX);
  else if (theme === 'village') drawBgVillage(ctx, camX);
  else if (theme === 'river') drawBgRiver(ctx, camX);
  else if (theme === 'storm') drawBgStorm(ctx, camX, level);
  else if (theme === 'jail') drawBgJail(ctx, camX);
  else drawBgWoods(ctx, camX);

  for (const d of level.decor) {
    const dx = d.x - camX;
    if (dx < -80 * SCALE || dx > W + 80 * SCALE) continue;
    if (d.type === 'tree') drawTree(ctx, dx, d.y, d.variant || 0, d.tall);
    if (d.type === 'fence') drawFence(ctx, dx, d.y);
    if (d.type === 'gate') drawGatePost(ctx, dx, d.y);
    if (d.type === 'cabin') drawCabin(ctx, dx, d.y);
    if (d.type === 'stone') drawStone(ctx, dx, d.y);
    if (d.type === 'building') drawBuilding(ctx, dx, d.y, d.variant || 0);
    if (d.type === 'lamp') drawLamp(ctx, dx, d.y);
    if (d.type === 'reed') drawReed(ctx, dx, d.y);
    if (d.type === 'pillar') drawPillar(ctx, dx, d.y);
    if (d.type === 'shrine') drawShrine(ctx, dx, d.y);
  }
}

function skyGradient(ctx, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Wrap parallax x into view range without breaking path order */
function wrapX(x, span) {
  const s = span || W + 120;
  return ((x % s) + s) % s - 60;
}

/** Soft painted cloud (no flat single oval) */
function drawCloud(ctx, cx, cy, scale, alpha) {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 38 * scale, 12 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - 22 * scale, cy + 2 * scale, 22 * scale, 10 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 26 * scale, cy - 2 * scale, 26 * scale, 11 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 4 * scale, cy - 8 * scale, 18 * scale, 10 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.45})`;
  ctx.beginPath();
  ctx.ellipse(cx - 8 * scale, cy - 4 * scale, 14 * scale, 6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Solid layered pine silhouette — each canopy layer is its OWN filled triangle.
 * Never one self-intersecting path (that caused sky diamond holes).
 */
function drawSolidPine(ctx, cx, baseY, scale, color, trunkColor) {
  const s = scale;
  ctx.fillStyle = color;
  // bottom wide canopy
  ctx.beginPath();
  ctx.moveTo(cx, baseY - 62 * s);
  ctx.lineTo(cx + 28 * s, baseY - 22 * s);
  ctx.lineTo(cx - 28 * s, baseY - 22 * s);
  ctx.closePath();
  ctx.fill();
  // mid canopy (overlaps solidly)
  ctx.beginPath();
  ctx.moveTo(cx, baseY - 78 * s);
  ctx.lineTo(cx + 22 * s, baseY - 40 * s);
  ctx.lineTo(cx - 22 * s, baseY - 40 * s);
  ctx.closePath();
  ctx.fill();
  // top canopy
  ctx.beginPath();
  ctx.moveTo(cx, baseY - 96 * s);
  ctx.lineTo(cx + 14 * s, baseY - 58 * s);
  ctx.lineTo(cx - 14 * s, baseY - 58 * s);
  ctx.closePath();
  ctx.fill();
  // soft edge darkening (no holes)
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.moveTo(cx + 2 * s, baseY - 62 * s);
  ctx.lineTo(cx + 26 * s, baseY - 24 * s);
  ctx.lineTo(cx + 8 * s, baseY - 24 * s);
  ctx.closePath();
  ctx.fill();
  // trunk
  drawRect(ctx, cx - 3 * s, baseY - 24 * s, 6 * s, 24 * s, trunkColor || '#1a2a14');
}

/** Far ridge: solid filled hill band (sorted samples → no XOR diamonds) */
function drawHillBand(ctx, camX, speed, yBase, amp, color, steps, span) {
  const pts = [];
  for (let i = -1; i <= steps + 1; i++) {
    const wx = i * (span / steps) - ((camX * speed) % span);
    const h = (Math.sin(i * 1.7) * 0.5 + Math.cos(i * 0.9) * 0.5) * amp;
    pts.push([wx, yBase - amp - h]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0][0] - 40, H);
  ctx.lineTo(pts[0][0] - 40, pts[0][1]);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0] + 40, last[1]);
  ctx.lineTo(last[0] + 40, H);
  ctx.closePath();
  ctx.fill();
}


function drawBgJail(ctx, camX) {
  skyGradient(ctx, [
    [0, '#0a0a0e'],
    [0.4, '#14141a'],
    [0.7, '#1a1814'],
    [1, '#221c14'],
  ]);
  // Dark stone wall band
  ctx.fillStyle = '#1a1816';
  ctx.fillRect(0, 200, W, H - 200);
  for (let i = 0; i < 12; i++) {
    const bx = wrapX(i * 56 - camX * 0.15, W + 80);
    drawRect(ctx, bx, 220, 48, 100, i % 2 ? '#24201c' : '#2a2620');
    drawRect(ctx, bx + 4, 228, 16, 20, '#0e0c0a');
    drawRect(ctx, bx + 28, 260, 14, 18, '#0e0c0a');
  }
  // Floor stone
  const mg = ctx.createLinearGradient(0, 320, 0, H);
  mg.addColorStop(0, '#2a241c');
  mg.addColorStop(1, '#1a1610');
  ctx.fillStyle = mg;
  ctx.fillRect(0, 320, W, H - 320);
  // Dim torch glows
  for (let i = 0; i < 5; i++) {
    const tx = wrapX(i * 110 - camX * 0.4 + 40, W + 40);
    ctx.fillStyle = 'rgba(200,120,40,0.12)';
    ctx.beginPath();
    ctx.ellipse(tx, 280, 40, 50, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBgWoods(ctx, camX) {
  skyGradient(ctx, [
    [0, '#3a7ab8'],
    [0.3, '#6aa8d8'],
    [0.55, '#a0cce8'],
    [0.78, '#c8dcb0'],
    [1, '#6a9a58'],
  ]);
  // painted clouds
  for (let i = 0; i < 7; i++) {
    const cx = wrapX(i * 150 - camX * 0.06, W + 160);
    const cy = 42 + (i % 3) * 20;
    drawCloud(ctx, cx, cy, 0.85 + (i % 3) * 0.12, 0.22 + (i % 2) * 0.08);
  }
  // far soft hills (solid band — no sky under trees)
  drawHillBand(ctx, camX, 0.1, 300, 36, '#2a4a30', 8, W + 80);
  drawHillBand(ctx, camX, 0.16, 320, 28, '#345838', 10, W + 60);
  // opaque forest wall so sky never shows through the pine band
  ctx.fillStyle = '#1a3220';
  ctx.fillRect(0, 268, W, 55);
  // distant solid pine tops along the wall (separate fills, dense overlap)
  for (let i = 0; i < 22; i++) {
    const hx = wrapX(i * 38 - camX * 0.2, W + 60);
    const sc = 0.5 + (i % 4) * 0.07;
    const col = i % 2 === 0 ? '#152818' : '#1c3424';
    drawSolidPine(ctx, hx + 24, 330, sc, col, '#102010');
  }
  // second nearer pine row for depth
  for (let i = 0; i < 14; i++) {
    const hx = wrapX(i * 58 - camX * 0.28 + 20, W + 80);
    drawSolidPine(ctx, hx + 28, 345, 0.72 + (i % 3) * 0.06, '#0e2414', '#0a1a10');
  }
  // mid meadow gradient
  const mg = ctx.createLinearGradient(0, 300, 0, H);
  mg.addColorStop(0, '#3d6a40');
  mg.addColorStop(0.4, '#4a7a48');
  mg.addColorStop(1, '#5a8a50');
  ctx.fillStyle = mg;
  ctx.fillRect(0, 310, W, H - 310);
  // grass blades catching light
  for (let i = 0; i < 40; i++) {
    const gx = wrapX(i * 22 - camX * 0.55, W + 40);
    const gh = 6 + (i % 4) * 2;
    drawRect(ctx, gx, 336 - gh, 2, gh, '#2d5a28');
    drawRect(ctx, gx + 3, 338 - gh + 2, 2, gh - 2, '#4a8a40');
    drawRect(ctx, gx + 1, 336 - gh, 1, 2, 'rgba(180,220,140,0.45)');
  }
}

function drawBgGrove(ctx, camX) {
  skyGradient(ctx, [
    [0, '#060a16'],
    [0.35, '#0e1628'],
    [0.65, '#152820'],
    [1, '#1e3024'],
  ]);
  const stars = [[36, 28], [100, 44], [180, 20], [260, 56], [340, 32], [420, 48], [480, 24], [140, 72], [300, 80], [60, 90], [220, 36], [400, 70]];
  for (const [sx, sy] of stars) {
    drawRect(ctx, sx, sy, 2 + (sx % 3), 2 + (sx % 3), 'rgba(220,230,255,0.7)');
  }
  // moon + glow
  ctx.fillStyle = 'rgba(232,232,208,0.12)';
  ctx.beginPath();
  ctx.ellipse(420, 70, 42, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e8d0';
  ctx.beginPath();
  ctx.ellipse(420, 70, 18, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0e1628';
  ctx.beginPath();
  ctx.ellipse(430, 66, 14, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // solid night forest wall + pine silhouettes (no sky diamonds)
  drawHillBand(ctx, camX, 0.08, 300, 40, '#0a1810', 7, W + 90);
  ctx.fillStyle = '#0a1810';
  ctx.fillRect(0, 260, W, 90);
  for (let i = 0; i < 20; i++) {
    const hx = wrapX(i * 42 - camX * 0.14, W + 70);
    drawSolidPine(ctx, hx + 26, 355, 0.65 + (i % 3) * 0.1, i % 2 ? '#0c1a10' : '#102014', '#060e08');
  }
  // mist band
  ctx.fillStyle = 'rgba(40,70,60,0.25)';
  ctx.fillRect(0, 300, W, 40);
  drawRect(ctx, 0, 340, W, H - 340, '#1e3024');
  for (let i = 0; i < 24; i++) {
    const gx = wrapX(i * 30 - camX * 0.4, W + 40);
    drawRect(ctx, gx, 348, 2, 8, '#143020');
    drawRect(ctx, gx + 4, 350, 2, 6, '#2a5040');
  }
}

function drawBgVillage(ctx, camX) {
  skyGradient(ctx, [
    [0, '#7aa4c8'],
    [0.4, '#b0c8dc'],
    [0.7, '#d4cfc0'],
    [1, '#8a8070'],
  ]);
  for (let i = 0; i < 5; i++) {
    const cx = wrapX(i * 180 - camX * 0.05, W + 200);
    drawCloud(ctx, cx, 50 + (i % 2) * 18, 0.9, 0.28);
  }
  // distant rooftops — each building separate solid fill
  for (let i = 0; i < 12; i++) {
    const hx = wrapX(i * 84 - camX * 0.2, W + 100);
    const bh = 50 + (i % 3) * 10;
    drawRect(ctx, hx, 280 - bh, 56, bh, i % 2 ? '#5a5a68' : '#4a4a58');
    ctx.fillStyle = '#4a3a30';
    ctx.beginPath();
    ctx.moveTo(hx - 6, 286 - bh);
    ctx.lineTo(hx + 28, 260 - bh);
    ctx.lineTo(hx + 62, 286 - bh);
    ctx.closePath();
    ctx.fill();
    drawRect(ctx, hx + 12, 250 - bh + 40, 10, 10, '#c8a860');
    drawRect(ctx, hx + 34, 250 - bh + 40, 10, 10, '#c8a860');
  }
  drawRect(ctx, 0, 300, W, 40, '#7a7a70');
  const dirt = ctx.createLinearGradient(0, 340, 0, H);
  dirt.addColorStop(0, '#8a8070');
  dirt.addColorStop(1, '#6a6050');
  ctx.fillStyle = dirt;
  ctx.fillRect(0, 340, W, H - 340);
  for (let i = 0; i < 20; i++) {
    const gx = wrapX(i * 40 - camX * 0.5, W + 40);
    drawRect(ctx, gx, 352, 18, 3, '#6a6050');
    drawRect(ctx, gx + 6, 360, 8, 2, '#5a5040');
  }
}

function drawBgRiver(ctx, camX) {
  skyGradient(ctx, [
    [0, '#5a98c0'],
    [0.35, '#88b8d0'],
    [0.6, '#a8c8c0'],
    [1, '#5a8a70'],
  ]);
  for (let i = 0; i < 4; i++) {
    const cx = wrapX(i * 200 - camX * 0.05, W + 220);
    drawCloud(ctx, cx, 44 + i * 12, 1.0, 0.25);
  }
  drawHillBand(ctx, camX, 0.12, 260, 30, '#3a6a48', 8, W + 70);
  drawRect(ctx, 0, 200, W, 40, 'rgba(200,220,240,0.22)');
  const wg = ctx.createLinearGradient(0, 280, 0, 360);
  wg.addColorStop(0, '#4a8aaa');
  wg.addColorStop(0.45, '#3a7a98');
  wg.addColorStop(1, '#5a8a70');
  ctx.fillStyle = wg;
  ctx.fillRect(0, 280, W, 100);
  for (let i = 0; i < 12; i++) {
    const wx = wrapX(i * 70 - camX * 0.18, W + 80);
    drawRect(ctx, wx, 300, 48, 3, 'rgba(180,220,240,0.4)');
    drawRect(ctx, wx + 20, 318, 36, 2, 'rgba(160,200,220,0.3)');
    drawRect(ctx, wx + 8, 336, 40, 2, 'rgba(200,230,240,0.25)');
  }
  drawRect(ctx, 0, 360, W, H - 360, '#5a8a70');
  for (let i = 0; i < 18; i++) {
    const gx = wrapX(i * 36 - camX * 0.45, W + 40);
    drawRect(ctx, gx, 368, 2, 7, '#3a6a48');
    drawRect(ctx, gx + 4, 370, 2, 5, '#4a8a58');
  }
}

function drawBgStorm(ctx, camX, level) {
  skyGradient(ctx, [
    [0, '#141228'],
    [0.3, '#242240'],
    [0.6, '#383648'],
    [1, '#4a5050'],
  ]);
  for (let i = 0; i < 8; i++) {
    const cx = wrapX(i * 110 - camX * 0.08, W + 140);
    const cy = 40 + (i % 3) * 18;
    ctx.fillStyle = '#2a2840';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 55, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 30, cy - 10, 40, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 24, cy - 4, 32, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(60,60,90,0.5)';
    ctx.beginPath();
    ctx.ellipse(cx + 10, cy - 6, 28, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const flash = Math.floor(camX / 80 + (level.num || 5) * 3) % 17 === 0;
  if (flash) drawRect(ctx, 0, 0, W, 220, 'rgba(200,220,255,0.14)');
  // solid storm ridge wall + separate peaks (no self-intersecting path)
  drawHillBand(ctx, camX, 0.14, 340, 50, '#2e343c', 7, W + 100);
  ctx.fillStyle = '#2e343c';
  ctx.fillRect(0, 300, W, 50);
  for (let i = 0; i < 10; i++) {
    const hx = wrapX(i * 90 - camX * 0.22, W + 110);
    ctx.fillStyle = i % 2 ? '#3a4048' : '#343a44';
    ctx.beginPath();
    ctx.moveTo(hx, 340);
    ctx.lineTo(hx + 48, 248 - (i % 3) * 14);
    ctx.lineTo(hx + 96, 340);
    ctx.closePath();
    ctx.fill();
  }
  drawRect(ctx, 0, 340, W, H - 340, '#4a5050');
  for (let i = 0; i < 20; i++) {
    const gx = wrapX(i * 34 - camX * 0.4, W + 40);
    drawRect(ctx, gx, 348, 2, 6, '#3a4440');
  }
}

export function drawLevelTiles(ctx, camX, level) {
  const startC = Math.max(0, Math.floor(camX / TILE) - 1);
  const endC = Math.min(level.cols, Math.ceil((camX + W) / TILE) + 1);
  const theme = level.theme || 'woods';
  for (let r = 0; r < level.rows; r++) {
    for (let c = startC; c < endC; c++) {
      const t = level.tiles[r][c];
      if (!t) continue;
      const x = c * TILE - camX;
      const y = r * TILE;
      if (t === 1) drawGroundTile(ctx, x, y, c, r, level, theme);
      else if (t === 2) drawPlatformTile(ctx, x, y, theme);
      else if (t === 3) drawWallTile(ctx, x, y, r);
      else if (t === 4) drawWaterTile(ctx, x, y, c, r);
    }
  }
}

function drawGroundTile(ctx, x, y, c, r, level, theme) {
  const above = r > 0 ? level.tiles[r - 1][c] : 1;
  const isTop = !above || above === 4;
  const topH = 10;
  if (theme === 'village') {
    if (isTop) {
      drawRect(ctx, x, y, TILE, topH, '#8a8070');
      drawRect(ctx, x, y + 2, TILE, 4, '#9a9080');
      drawRect(ctx, x, y + topH, TILE, TILE - topH, '#6a6050');
    } else {
      drawRect(ctx, x, y, TILE, TILE, '#5a5040');
    }
  } else if (theme === 'river') {
    if (isTop) {
      drawRect(ctx, x, y, TILE, topH, '#4a8a5a');
      drawRect(ctx, x, y + 2, TILE, 3, '#5aaa68');
      drawRect(ctx, x, y + topH, TILE, TILE - topH, '#6a5a38');
    } else {
      drawRect(ctx, x, y, TILE, TILE, '#5a4a28');
    }
  } else if (theme === 'storm') {
    if (isTop) {
      drawRect(ctx, x, y, TILE, topH, '#4a5a48');
      drawRect(ctx, x, y + topH, TILE, TILE - topH, '#5a4a38');
    } else {
      drawRect(ctx, x, y, TILE, TILE, '#4a3a2a');
    }
  } else if (theme === 'grove') {
    if (isTop) {
      drawRect(ctx, x, y, TILE, topH, '#2a5a38');
      drawRect(ctx, x, y + 2, TILE, 3, '#3a7a48');
      drawRect(ctx, x, y + topH, TILE, TILE - topH, '#4a3820');
    } else {
      drawRect(ctx, x, y, TILE, TILE, '#3a2818');
    }
  } else {
    if (isTop) {
      drawRect(ctx, x, y, TILE, topH, '#3d8a3a');
      drawRect(ctx, x, y + 2, TILE, 5, COLORS.grass);
      drawRect(ctx, x + 4, y, 3, 5, '#5aaa48');
      drawRect(ctx, x + 10, y - 2, 2, 6, '#4a9a40');
      drawRect(ctx, x + 14, y - 3, 3, 6, '#6aba58');
      drawRect(ctx, x + 20, y - 1, 2, 5, '#3d7a3a');
      drawRect(ctx, x + 24, y, 3, 5, '#5aaa48');
      drawRect(ctx, x + 6, y, 1, 3, 'rgba(200,230,140,0.4)');
      drawRect(ctx, x, y + topH, TILE, TILE - topH, COLORS.dirt);
    } else {
      drawRect(ctx, x, y, TILE, TILE, '#7a4a28');
    }
  }
  const seed = (c * 7 + r * 13) & 7;
  drawRect(ctx, x + 4 + (seed % 4) * 2, y + 16, 4, 3, '#6b4420');
  drawRect(ctx, x + 18, y + 22 + (seed % 2) * 2, 4, 2, '#5a3818');
  drawRect(ctx, x + 8, y + 26, 3, 2, 'rgba(0,0,0,0.15)');
}

function drawPlatformTile(ctx, x, y, theme) {
  if (theme === 'village') {
    drawRect(ctx, x, y, TILE, 8, '#6a5a48');
    drawRect(ctx, x, y + 2, TILE, 5, '#8a7a60');
    drawRect(ctx, x, y + 8, TILE, 8, '#3a3020');
  } else if (theme === 'river') {
    drawRect(ctx, x, y, TILE, 8, '#5a4a30');
    drawRect(ctx, x, y + 2, TILE, 5, '#7a6a48');
    drawRect(ctx, x + 4, y + 8, 6, 12, '#4a3a28');
    drawRect(ctx, x + 22, y + 8, 6, 12, '#4a3a28');
  } else {
    drawRect(ctx, x, y, TILE, 8, '#7a5530');
    drawRect(ctx, x, y + 2, TILE, 5, COLORS.wood);
    drawRect(ctx, x + 2, y, 4, 2, '#a08050');
    drawRect(ctx, x + 16, y, 4, 2, '#a08050');
    drawRect(ctx, x, y + 8, TILE, 8, '#3a2818');
    drawRect(ctx, x + 6, y + 10, 4, 4, '#2a1810');
    drawRect(ctx, x + 20, y + 10, 4, 4, '#2a1810');
  }
  drawRect(ctx, x, y + 16, TILE, 2, 'rgba(0,0,0,0.25)');
}

function drawWallTile(ctx, x, y, r) {
  drawRect(ctx, x, y, TILE, TILE, '#5a4030');
  drawRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, '#6a4a35');
  drawRect(ctx, x, y + 14, TILE, 2, '#3a2818');
  drawRect(ctx, x + 8, y + 4, 4, 8, '#3a2818');
  drawRect(ctx, x + 20, y + 18, 4, 8, '#3a2818');
  if (r % 2 === 0) drawRect(ctx, x + 4, y + 6, 6, 4, '#8a6a48');
}

function drawWaterTile(ctx, x, y, c, r) {
  const wave = ((c + Math.floor(r)) % 3);
  drawRect(ctx, x, y, TILE, TILE, COLORS.waterDeep);
  drawRect(ctx, x, y, TILE, 8, COLORS.water);
  drawRect(ctx, x + wave * 6, y + 2, 12, 3, 'rgba(180,220,240,0.5)');
  drawRect(ctx, x + 4, y + 16, 8, 3, 'rgba(100,160,200,0.35)');
}

function drawTree(ctx, x, y, variant = 0, tall = false) {
  const ox = Math.floor(x);
  const oy = Math.floor(y) - (tall ? 16 : 0);
  const shift = variant === 1 ? -4 : variant === 2 ? 4 : 0;
  // trunk with bark striations
  drawRect(ctx, ox + 20, oy + 44, 14, tall ? 76 : 60, COLORS.treeTrunk);
  drawRect(ctx, ox + 22, oy + 48, 4, 10, '#3a2418');
  drawRect(ctx, ox + 28, oy + 64, 4, 8, '#3a2418');
  drawRect(ctx, ox + 24, oy + 44, 4, tall ? 76 : 60, 'rgba(90,70,40,0.35)');
  drawRect(ctx, ox + 30, oy + 52, 2, tall ? 60 : 48, 'rgba(0,0,0,0.15)');
  // layered canopy — separate solid ellipses (no holes)
  const leaf = COLORS.treeLeaf;
  const leafL = '#3d6a35';
  const leafH = '#4a7a40';
  const leafD = '#1e3a1c';
  ctx.fillStyle = leafD;
  ctx.beginPath();
  ctx.ellipse(ox + 26 + shift, oy + 40, 38, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = leaf;
  ctx.beginPath();
  ctx.ellipse(ox + 26 + shift, oy + 32, 34, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = leafL;
  ctx.beginPath();
  ctx.ellipse(ox + 26 + shift, oy + 16, 26, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = leafH;
  ctx.beginPath();
  ctx.ellipse(ox + 22 + shift, oy + 4, 16, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // leaf highlight clusters
  drawRect(ctx, ox + 14 + shift, oy + 18, 8, 5, '#5a9a48');
  drawRect(ctx, ox + 30 + shift, oy + 26, 8, 5, '#244a22');
  drawRect(ctx, ox + 18 + shift, oy + 8, 6, 4, 'rgba(160,200,120,0.35)');
  if (tall) {
    ctx.fillStyle = '#2d5a28';
    ctx.beginPath();
    ctx.ellipse(ox + 26 + shift, oy - 14, 28, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a7a40';
    ctx.beginPath();
    ctx.ellipse(ox + 22 + shift, oy - 20, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFence(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox + 4, oy, 5, 30, COLORS.fence);
  drawRect(ctx, ox + 22, oy, 5, 30, COLORS.fence);
  drawRect(ctx, ox + 4, oy, 5, 3, '#a09070');
  drawRect(ctx, ox + 22, oy, 5, 3, '#a09070');
  drawRect(ctx, ox, oy + 6, 32, 4, COLORS.fence);
  drawRect(ctx, ox, oy + 18, 32, 4, COLORS.fence);
  drawRect(ctx, ox, oy + 6, 32, 2, '#a09070');
}

function drawGatePost(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox + 8, oy, 16, 160, '#5a4030');
  drawRect(ctx, ox + 10, oy + 2, 12, 156, '#6a4a35');
  drawRect(ctx, ox + 8, oy + 36, 16, 2, '#3a2818');
  drawRect(ctx, ox + 8, oy + 80, 16, 2, '#3a2818');
  drawRect(ctx, ox + 8, oy + 124, 16, 2, '#3a2818');
  drawRect(ctx, ox + 6, oy, 20, 6, '#8a6a48');
}

function drawCabin(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  // body with log shading
  drawRect(ctx, ox, oy + 16, 96, 80, COLORS.cabin);
  for (let i = 0; i < 5; i++) {
    drawRect(ctx, ox, oy + 24 + i * 14, 96, 2, '#5a3818');
    drawRect(ctx, ox, oy + 26 + i * 14, 96, 1, 'rgba(255,200,140,0.08)');
  }
  drawRect(ctx, ox + 2, oy + 18, 4, 76, 'rgba(0,0,0,0.15)');
  drawRect(ctx, ox + 90, oy + 18, 4, 76, 'rgba(0,0,0,0.2)');
  // roof layers
  drawRect(ctx, ox - 8, oy + 4, 112, 20, COLORS.cabinRoof);
  drawRect(ctx, ox - 4, oy, 104, 12, '#2a1a10');
  drawRect(ctx, ox + 16, oy - 8, 64, 12, '#4a3020');
  drawRect(ctx, ox - 6, oy + 4, 108, 3, 'rgba(255,255,255,0.06)');
  // chimney + smoke puff
  drawRect(ctx, ox + 72, oy - 20, 16, 24, '#5a4030');
  drawRect(ctx, ox + 74, oy - 22, 12, 4, '#3a2818');
  ctx.fillStyle = 'rgba(180,180,180,0.25)';
  ctx.beginPath();
  ctx.ellipse(ox + 80, oy - 28, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // door
  drawRect(ctx, ox + 36, oy + 48, 24, 48, '#3a2818');
  drawRect(ctx, ox + 40, oy + 52, 16, 40, '#4a3020');
  drawRect(ctx, ox + 42, oy + 54, 4, 36, 'rgba(255,200,140,0.1)');
  drawRect(ctx, ox + 52, oy + 68, 4, 4, '#d4a84b');
  // windows with panes
  drawRect(ctx, ox + 12, oy + 32, 16, 16, '#1a3040');
  drawRect(ctx, ox + 14, oy + 34, 12, 12, '#a8c8e0');
  drawRect(ctx, ox + 19, oy + 34, 2, 12, '#1a3040');
  drawRect(ctx, ox + 14, oy + 39, 12, 2, '#1a3040');
  drawRect(ctx, ox + 68, oy + 32, 16, 16, '#1a3040');
  drawRect(ctx, ox + 70, oy + 34, 12, 12, '#a8c8e0');
  drawRect(ctx, ox + 75, oy + 34, 2, 12, '#1a3040');
  drawRect(ctx, ox + 70, oy + 39, 12, 2, '#1a3040');
}

function drawStone(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  ctx.fillStyle = '#6a6a58';
  ctx.beginPath();
  ctx.ellipse(ox + 16, oy + 20, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a8a70';
  ctx.beginPath();
  ctx.ellipse(ox + 14, oy + 16, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  drawRect(ctx, ox + 12, oy + 8, 8, 5, 'rgba(180,220,160,0.55)');
}

function drawBuilding(ctx, x, y, variant = 0) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const h = 96 + variant * 16;
  const w = 80 + variant * 8;
  drawRect(ctx, ox, oy + 32, w, h - 16, variant === 1 ? '#7a6050' : '#8a7060');
  drawRect(ctx, ox - 4, oy + 16, w + 8, 24, '#4a3020');
  drawRect(ctx, ox + 8, oy + 8, w - 16, 16, '#3a2818');
  drawRect(ctx, ox + 12, oy + 48, 16, 16, '#1a3040');
  drawRect(ctx, ox + 14, oy + 50, 12, 12, '#c8a860');
  drawRect(ctx, ox + w - 32, oy + 48, 16, 16, '#1a3040');
  drawRect(ctx, ox + w - 30, oy + 50, 12, 12, '#c8a860');
  drawRect(ctx, ox + w / 2 - 8, oy + h - 16, 20, 32, '#3a2818');
}

function drawLamp(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox + 12, oy, 6, 56, '#4a4030');
  drawRect(ctx, ox + 6, oy - 12, 20, 16, '#6a5a40');
  drawRect(ctx, ox + 10, oy - 8, 12, 8, '#e8c860');
  ctx.fillStyle = 'rgba(232,200,96,0.25)';
  ctx.beginPath();
  ctx.ellipse(ox + 16, oy + 4, 18, 14, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawReed(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox + 8, oy, 3, 28, '#3a6a38');
  drawRect(ctx, ox + 16, oy + 4, 3, 24, '#2a5a28');
  drawRect(ctx, ox + 4, oy - 4, 6, 8, '#4a8a40');
  drawRect(ctx, ox + 14, oy, 6, 6, '#4a8a40');
}

function drawPillar(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox + 8, oy, 16, 112, '#6a6a60');
  drawRect(ctx, ox + 10, oy + 4, 4, 104, 'rgba(255,255,255,0.12)');
  drawRect(ctx, ox + 4, oy - 4, 24, 8, '#8a8a78');
  drawRect(ctx, ox + 4, oy + 108, 24, 8, '#5a5a50');
}

function drawShrine(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox, oy + 40, 80, 80, '#5a5048');
  drawRect(ctx, ox - 8, oy + 24, 96, 20, '#3a3028');
  drawRect(ctx, ox + 16, oy, 48, 32, '#4a4038');
  drawRect(ctx, ox + 32, oy + 56, 16, 16, '#d4a84b');
  drawRect(ctx, ox + 36, oy + 52, 8, 24, '#e8c860');
}
