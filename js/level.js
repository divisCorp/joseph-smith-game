/**
 * Level data — Palmyra Quest campaign (Levels 1–5)
 * Tile codes: 0 empty, 1 solid ground, 2 platform, 3 wall, 4 water (visual/hazard gap).
 */
import { TILE, W, H, COLORS, LEVEL_META } from './constants.js';
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
        solids.push({
          x: c * TILE,
          y: r * TILE,
          w: TILE,
          h: TILE,
          kind: t === 2 ? 'plat' : t === 3 ? 'wall' : 'ground',
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
    solids: tilesToSolids(tiles),
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

// ── Level 1: Palmyra Woods ────────────────────────────────
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
    createEnemy('brigand', 22 * TILE, 11 * TILE, { patrolMin: 20 * TILE, patrolMax: 26 * TILE }),
    createEnemy('wolf', 38 * TILE, 7 * TILE, { patrolMin: 35 * TILE, patrolMax: 42 * TILE }),
    createEnemy('brigand', 48 * TILE, 11 * TILE, { patrolMin: 45 * TILE, patrolMax: 51 * TILE }),
    createEnemy('wolf', 65 * TILE, 8 * TILE, { patrolMin: 60 * TILE, patrolMax: 70 * TILE }),
    createEnemy('brigand', 74 * TILE, 11 * TILE, { patrolMin: 72 * TILE, patrolMax: 77 * TILE }),
    createEnemy('brigand', 92 * TILE, 11 * TILE, { patrolMin: 88 * TILE, patrolMax: 96 * TILE }),
    createEnemy('boss', 110 * TILE, 10 * TILE, {
      bossKind: 'ringleader',
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

  return wrapLevel(1, 'woods', cols, rows, tiles, enemies, decor, { x: 3 * TILE, y: 10 * TILE }, 100 * TILE);
}

// ── Level 2: Sacred Grove (night, denser) ─────────────────
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
  // denser vertical platforms — hill climb feel
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
    createEnemy('scout', 68 * TILE, 9 * TILE, { patrolMin: 66 * TILE, patrolMax: 72 * TILE }),
    createEnemy('wolf', 80 * TILE, 7 * TILE, { patrolMin: 76 * TILE, patrolMax: 88 * TILE }),
    createEnemy('scout', 98 * TILE, 8 * TILE, { patrolMin: 96 * TILE, patrolMax: 102 * TILE }),
    createEnemy('boss', 116 * TILE, 10 * TILE, {
      bossKind: 'sentinel',
      patrolMin: 110 * TILE,
      patrolMax: 124 * TILE,
    }),
  ];

  const decor = [];
  for (let c = 2; c < 108; c += 4) {
    if (tiles[groundR][c] === 1) {
      decor.push({ type: 'tree', x: c * TILE - 4, y: (groundR - 5) * TILE, variant: c % 3, tall: true });
    }
  }
  // soft glow markers (grove stones)
  for (const c of [16, 36, 60, 82, 100]) {
    decor.push({ type: 'stone', x: c * TILE, y: (groundR - 1) * TILE });
  }
  decor.push({ type: 'gate', x: 108 * TILE, y: (groundR - 5) * TILE });
  decor.push({ type: 'gate', x: 109 * TILE, y: (groundR - 5) * TILE });

  return wrapLevel(2, 'grove', cols, rows, tiles, enemies, decor, { x: 3 * TILE, y: 10 * TILE }, 108 * TILE);
}

// ── Level 3: Palmyra Streets ──────────────────────────────
export function createLevel3() {
  const cols = 130;
  const rows = 15;
  const tiles = emptyTiles(cols, rows);
  const groundR = 13;
  fillGround(tiles, groundR, cols, [
    [36, 37],
    [62, 63],
  ]);
  // rooftop / balcony platforms
  placePlatform(tiles, 10, 10, 5); // low roof
  placePlatform(tiles, 18, 8, 4);
  placePlatform(tiles, 28, 9, 3);
  placePlatform(tiles, 40, 10, 5);
  placePlatform(tiles, 48, 7, 4); // high roof
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
      patrolMin: 114 * TILE,
      patrolMax: 126 * TILE,
    }),
  ];

  const decor = [];
  // street buildings (visual)
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

  return wrapLevel(3, 'village', cols, rows, tiles, enemies, decor, { x: 3 * TILE, y: 10 * TILE }, 112 * TILE);
}

// ── Level 4: River Crossing ───────────────────────────────
export function createLevel4() {
  const cols = 136;
  const rows = 15;
  const tiles = emptyTiles(cols, rows);
  const groundR = 13;
  // Large water gaps — must use bridges/platforms
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
  // bridge platforms across water
  placePlatform(tiles, 21, 11, 3);
  placePlatform(tiles, 25, 10, 3);
  placePlatform(tiles, 41, 11, 4);
  placePlatform(tiles, 46, 9, 3);
  placePlatform(tiles, 67, 11, 3);
  placePlatform(tiles, 71, 10, 4);
  placePlatform(tiles, 93, 11, 4);
  placePlatform(tiles, 98, 9, 3);
  // mid land platforms
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
  // reeds along water edges
  for (const c of [19, 28, 39, 50, 65, 76, 91, 102]) {
    decor.push({ type: 'reed', x: c * TILE, y: (groundR - 1) * TILE });
  }
  decor.push({ type: 'gate', x: 116 * TILE, y: (groundR - 5) * TILE });
  decor.push({ type: 'gate', x: 117 * TILE, y: (groundR - 5) * TILE });

  return wrapLevel(4, 'river', cols, rows, tiles, enemies, decor, { x: 3 * TILE, y: 10 * TILE }, 116 * TILE);
}

// ── Level 5: Temple Hill / Final Trial ────────────────────
export function createLevel5() {
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
  // ascending hill platforms
  placePlatform(tiles, 10, 11, 3);
  placePlatform(tiles, 16, 9, 3);
  placePlatform(tiles, 28, 10, 4);
  placePlatform(tiles, 36, 8, 3);
  placePlatform(tiles, 48, 9, 4);
  placePlatform(tiles, 56, 7, 3);
  placePlatform(tiles, 62, 10, 3);
  placePlatform(tiles, 72, 8, 4);
  placePlatform(tiles, 80, 6, 3); // high
  placePlatform(tiles, 92, 9, 4);
  placePlatform(tiles, 100, 7, 3);
  placePlatform(tiles, 108, 10, 4);
  for (let c = 120; c < cols; c++) {
    tiles[groundR][c] = 1;
    tiles[groundR + 1][c] = 1;
  }
  // raised boss dais
  placePlatform(tiles, 124, 11, 8);
  farWall(tiles, cols, groundR);

  const enemies = [
    createEnemy('scout', 14 * TILE, 7 * TILE, { patrolMin: 10 * TILE, patrolMax: 20 * TILE }),
    createEnemy('wolf', 30 * TILE, 8 * TILE, { patrolMin: 28 * TILE, patrolMax: 36 * TILE }),
    createEnemy('thug', 40 * TILE, 6 * TILE, { patrolMin: 36 * TILE, patrolMax: 44 * TILE }),
    createEnemy('brigand', 52 * TILE, 7 * TILE, { patrolMin: 48 * TILE, patrolMax: 58 * TILE }),
    createEnemy('scout', 64 * TILE, 8 * TILE, { patrolMin: 62 * TILE, patrolMax: 68 * TILE }),
    createEnemy('wolf', 76 * TILE, 6 * TILE, { patrolMin: 72 * TILE, patrolMax: 84 * TILE }),
    createEnemy('thug', 94 * TILE, 7 * TILE, { patrolMin: 92 * TILE, patrolMax: 100 * TILE }),
    createEnemy('scout', 104 * TILE, 5 * TILE, { patrolMin: 100 * TILE, patrolMax: 110 * TILE }),
    createEnemy('brigand', 112 * TILE, 8 * TILE, { patrolMin: 108 * TILE, patrolMax: 116 * TILE }),
    createEnemy('boss', 128 * TILE, 7 * TILE, {
      bossKind: 'overseer',
      patrolMin: 122 * TILE,
      patrolMax: 136 * TILE,
    }),
  ];

  const decor = [];
  for (let c = 4; c < 120; c += 9) {
    if (tiles[groundR][c] === 1) {
      decor.push({ type: 'tree', x: c * TILE, y: (groundR - 4) * TILE, variant: c % 3 });
    }
  }
  // hill pillars / markers
  for (const c of [20, 50, 78, 110]) {
    decor.push({ type: 'pillar', x: c * TILE, y: (groundR - 4) * TILE });
  }
  decor.push({ type: 'gate', x: 120 * TILE, y: (groundR - 5) * TILE });
  decor.push({ type: 'gate', x: 121 * TILE, y: (groundR - 5) * TILE });
  decor.push({ type: 'shrine', x: 130 * TILE, y: (groundR - 6) * TILE });

  return wrapLevel(5, 'storm', cols, rows, tiles, enemies, decor, { x: 3 * TILE, y: 10 * TILE }, 120 * TILE);
}

export function createLevel(num) {
  switch (num) {
    case 1: return createLevel1();
    case 2: return createLevel2();
    case 3: return createLevel3();
    case 4: return createLevel4();
    case 5: return createLevel5();
    default: return createLevel1();
  }
}

// ── Drawing ───────────────────────────────────────────────
export function drawLevelBackground(ctx, camX, level) {
  const theme = level.theme || 'woods';
  if (theme === 'grove') drawBgGrove(ctx, camX);
  else if (theme === 'village') drawBgVillage(ctx, camX);
  else if (theme === 'river') drawBgRiver(ctx, camX);
  else if (theme === 'storm') drawBgStorm(ctx, camX, level);
  else drawBgWoods(ctx, camX);

  for (const d of level.decor) {
    const dx = d.x - camX;
    if (dx < -80 || dx > W + 80) continue;
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

function drawBgWoods(ctx, camX) {
  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    const r = Math.floor(88 + t * 90);
    const g = Math.floor(150 + t * 60);
    const b = Math.floor(210 + t * 30);
    drawRect(ctx, 0, i * 14, W, 14, `rgb(${r},${g},${b})`);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 70 - camX * 0.08) % (W + 60)) - 30;
    drawRect(ctx, cx, 28 + (i % 3) * 10, 28, 4, 'rgba(255,255,255,0.28)');
    drawRect(ctx, cx + 8, 24 + (i % 3) * 10, 16, 4, 'rgba(255,255,255,0.22)');
  }
  drawRect(ctx, 0, 118, W, 42, '#3a6038');
  for (let i = 0; i < 12; i++) {
    const hx = ((i * 36 - camX * 0.15) % (W + 40)) - 20;
    const hh = 18 + (i % 4) * 6;
    drawRect(ctx, hx + 6, 118 - hh + 18, 6, hh, '#2d4a2a');
    drawRect(ctx, hx, 118 - hh + 10, 18, 14, '#355832');
  }
  ctx.fillStyle = '#3d6a40';
  for (let i = 0; i < 8; i++) {
    const hx = ((i * 80 - camX * 0.28) % (W + 80)) - 40;
    ctx.beginPath();
    ctx.moveTo(hx, 168);
    ctx.lineTo(hx + 50, 118);
    ctx.lineTo(hx + 100, 168);
    ctx.fill();
  }
  drawRect(ctx, 0, 150, W, 70, '#4a7a48');
  for (let i = 0; i < 20; i++) {
    const gx = ((i * 16 - camX * 0.55) % (W + 16));
    drawRect(ctx, gx, 168, 2, 4, '#3d6a35');
    drawRect(ctx, gx + 4, 170, 2, 3, '#2d5a28');
  }
  drawRect(ctx, 0, 172, W, 48, '#5a8a50');
}

function drawBgGrove(ctx, camX) {
  // night sky
  for (let i = 0; i < 14; i++) {
    const t = i / 14;
    drawRect(ctx, 0, i * 14, W, 14, `rgb(${12 + t * 20},${16 + t * 28},${40 + t * 50})`);
  }
  const stars = [[18, 14], [50, 22], [90, 10], [130, 28], [170, 16], [210, 24], [240, 12], [70, 36], [150, 40]];
  for (const [sx, sy] of stars) {
    drawRect(ctx, sx, sy, 2, 2, 'rgba(220,230,255,0.7)');
  }
  // moon
  drawRect(ctx, 210, 28, 14, 14, '#e8e8d0');
  drawRect(ctx, 212, 30, 10, 10, '#f0f0e0');
  drawRect(ctx, 218, 28, 8, 10, `rgb(${12},${16},${40})`); // crescent cut

  drawRect(ctx, 0, 120, W, 50, '#1a3020');
  for (let i = 0; i < 14; i++) {
    const hx = ((i * 30 - camX * 0.12) % (W + 40)) - 20;
    drawRect(ctx, hx, 100, 16, 40, '#142818');
    drawRect(ctx, hx + 2, 90, 12, 16, '#1a3820');
  }
  drawRect(ctx, 0, 160, W, 60, '#243828');
  drawRect(ctx, 0, 180, W, 40, '#2a4030');
}

function drawBgVillage(ctx, camX) {
  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    drawRect(ctx, 0, i * 14, W, 14, `rgb(${140 + t * 40},${170 + t * 30},${200 + t * 20})`);
  }
  // distant rooftops
  drawRect(ctx, 0, 110, W, 50, '#6a6a78');
  for (let i = 0; i < 10; i++) {
    const hx = ((i * 42 - camX * 0.2) % (W + 50)) - 25;
    drawRect(ctx, hx, 100, 28, 30, '#5a5a68');
    drawRect(ctx, hx - 2, 96, 32, 6, '#4a3a30');
  }
  drawRect(ctx, 0, 150, W, 70, '#7a7a70');
  drawRect(ctx, 0, 170, W, 50, '#8a8070'); // dirt street
  for (let i = 0; i < 16; i++) {
    const gx = ((i * 20 - camX * 0.5) % (W + 20));
    drawRect(ctx, gx, 176, 10, 2, '#6a6050');
  }
}

function drawBgRiver(ctx, camX) {
  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    drawRect(ctx, 0, i * 14, W, 14, `rgb(${100 + t * 50},${140 + t * 40},${180 + t * 30})`);
  }
  // mist bands
  drawRect(ctx, 0, 100, W, 20, 'rgba(200,220,240,0.25)');
  drawRect(ctx, 0, 130, W, 50, '#4a7a68');
  // far water shimmer
  for (let i = 0; i < 8; i++) {
    const wx = ((i * 40 - camX * 0.18) % (W + 40)) - 20;
    drawRect(ctx, wx, 148, 24, 3, 'rgba(160,200,220,0.35)');
  }
  drawRect(ctx, 0, 165, W, 55, '#5a8a70');
}

function drawBgStorm(ctx, camX, level) {
  for (let i = 0; i < 14; i++) {
    const t = i / 14;
    drawRect(ctx, 0, i * 14, W, 14, `rgb(${30 + t * 25},${28 + t * 20},${48 + t * 40})`);
  }
  // storm clouds
  for (let i = 0; i < 6; i++) {
    const cx = ((i * 55 - camX * 0.1) % (W + 70)) - 35;
    drawRect(ctx, cx, 20 + (i % 3) * 8, 40, 10, '#2a2840');
    drawRect(ctx, cx + 10, 14 + (i % 3) * 8, 28, 8, '#343050');
  }
  // lightning flash occasional (based on width as pseudo time via cam)
  const flash = Math.floor(camX / 40 + (level.num || 5) * 3) % 17 === 0;
  if (flash) drawRect(ctx, 0, 0, W, 100, 'rgba(200,220,255,0.12)');

  drawRect(ctx, 0, 120, W, 50, '#2a3038');
  for (let i = 0; i < 8; i++) {
    const hx = ((i * 50 - camX * 0.22) % (W + 60)) - 30;
    ctx.fillStyle = '#3a4048';
    ctx.beginPath();
    ctx.moveTo(hx, 160);
    ctx.lineTo(hx + 30, 120);
    ctx.lineTo(hx + 60, 160);
    ctx.fill();
  }
  drawRect(ctx, 0, 160, W, 60, '#3a4448');
  drawRect(ctx, 0, 180, W, 40, '#4a5050');
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
  if (theme === 'village') {
    if (isTop) {
      drawRect(ctx, x, y, TILE, 4, '#8a8070');
      drawRect(ctx, x, y + 4, TILE, TILE - 4, '#6a6050');
    } else {
      drawRect(ctx, x, y, TILE, TILE, '#5a5040');
    }
  } else if (theme === 'river') {
    if (isTop) {
      drawRect(ctx, x, y, TILE, 5, '#4a8a5a');
      drawRect(ctx, x, y + 5, TILE, TILE - 5, '#6a5a38');
    } else {
      drawRect(ctx, x, y, TILE, TILE, '#5a4a28');
    }
  } else if (theme === 'storm') {
    if (isTop) {
      drawRect(ctx, x, y, TILE, 5, '#4a5a48');
      drawRect(ctx, x, y + 5, TILE, TILE - 5, '#5a4a38');
    } else {
      drawRect(ctx, x, y, TILE, TILE, '#4a3a2a');
    }
  } else if (theme === 'grove') {
    if (isTop) {
      drawRect(ctx, x, y, TILE, 5, '#2a5a38');
      drawRect(ctx, x, y + 5, TILE, TILE - 5, '#4a3820');
    } else {
      drawRect(ctx, x, y, TILE, TILE, '#3a2818');
    }
  } else {
    if (isTop) {
      drawRect(ctx, x, y, TILE, 5, '#3d8a3a');
      drawRect(ctx, x, y + 1, TILE, 3, COLORS.grass);
      drawRect(ctx, x + 2, y, 2, 2, '#5aaa48');
      drawRect(ctx, x + 8, y - 1, 2, 2, '#4a9a40');
      drawRect(ctx, x + 12, y, 2, 2, '#5aaa48');
      drawRect(ctx, x, y + 5, TILE, TILE - 5, COLORS.dirt);
    } else {
      drawRect(ctx, x, y, TILE, TILE, '#7a4a28');
    }
  }
  const seed = (c * 7 + r * 13) & 7;
  drawRect(ctx, x + 2 + (seed % 4), y + 8, 2, 2, '#6b4420');
  drawRect(ctx, x + 9, y + 11 + (seed % 2), 2, 1, '#5a3818');
}

function drawPlatformTile(ctx, x, y, theme) {
  if (theme === 'village') {
    drawRect(ctx, x, y, TILE, 4, '#6a5a48');
    drawRect(ctx, x, y + 1, TILE, 3, '#8a7a60');
    drawRect(ctx, x, y + 4, TILE, 4, '#3a3020');
  } else if (theme === 'river') {
    drawRect(ctx, x, y, TILE, 4, '#5a4a30');
    drawRect(ctx, x, y + 1, TILE, 3, '#7a6a48');
    drawRect(ctx, x + 2, y + 4, 3, 6, '#4a3a28'); // post
    drawRect(ctx, x + 11, y + 4, 3, 6, '#4a3a28');
  } else {
    drawRect(ctx, x, y, TILE, 4, '#7a5530');
    drawRect(ctx, x, y + 1, TILE, 3, COLORS.wood);
    drawRect(ctx, x + 1, y, 2, 1, '#a08050');
    drawRect(ctx, x + 8, y, 2, 1, '#a08050');
    drawRect(ctx, x, y + 4, TILE, 4, '#3a2818');
    drawRect(ctx, x + 3, y + 5, 2, 2, '#2a1810');
    drawRect(ctx, x + 10, y + 5, 2, 2, '#2a1810');
  }
  drawRect(ctx, x, y + 8, TILE, 1, 'rgba(0,0,0,0.25)');
}

function drawWallTile(ctx, x, y, r) {
  drawRect(ctx, x, y, TILE, TILE, '#5a4030');
  drawRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, '#6a4a35');
  drawRect(ctx, x, y + 7, TILE, 1, '#3a2818');
  drawRect(ctx, x + 4, y + 2, 2, 4, '#3a2818');
  drawRect(ctx, x + 10, y + 9, 2, 4, '#3a2818');
  if (r % 2 === 0) drawRect(ctx, x + 2, y + 3, 3, 2, '#8a6a48');
}

function drawWaterTile(ctx, x, y, c, r) {
  const wave = ((c + Math.floor(r)) % 3);
  drawRect(ctx, x, y, TILE, TILE, COLORS.waterDeep);
  drawRect(ctx, x, y, TILE, 4, COLORS.water);
  drawRect(ctx, x + wave * 3, y + 1, 6, 2, 'rgba(180,220,240,0.45)');
  drawRect(ctx, x + 2, y + 8, 4, 2, 'rgba(100,160,200,0.3)');
}

function drawTree(ctx, x, y, variant = 0, tall = false) {
  const ox = Math.floor(x);
  const oy = Math.floor(y) - (tall ? 8 : 0);
  drawRect(ctx, ox + 10, oy + 22, 8, tall ? 38 : 30, COLORS.treeTrunk);
  drawRect(ctx, ox + 11, oy + 24, 2, 4, '#3a2418');
  drawRect(ctx, ox + 14, oy + 32, 2, 3, '#3a2418');
  const shift = variant === 1 ? -2 : variant === 2 ? 2 : 0;
  drawRect(ctx, ox + 2 + shift, oy + 8, 24, 16, COLORS.treeLeaf);
  drawRect(ctx, ox + 6 + shift, oy - 2, 16, 14, '#3d6a35');
  drawRect(ctx, ox + 10 + shift, oy - 8, 10, 10, '#4a7a40');
  drawRect(ctx, ox + 8 + shift, oy + 2, 4, 3, '#5a9a48');
  drawRect(ctx, ox + 16 + shift, oy + 10, 5, 3, '#244a22');
  if (tall) {
    drawRect(ctx, ox + 4 + shift, oy - 14, 20, 10, '#2d5a28');
  }
}

function drawFence(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox + 2, oy, 3, 15, COLORS.fence);
  drawRect(ctx, ox + 11, oy, 3, 15, COLORS.fence);
  drawRect(ctx, ox + 2, oy, 3, 2, '#a09070');
  drawRect(ctx, ox + 11, oy, 3, 2, '#a09070');
  drawRect(ctx, ox, oy + 3, 16, 2, COLORS.fence);
  drawRect(ctx, ox, oy + 9, 16, 2, COLORS.fence);
  drawRect(ctx, ox, oy + 3, 16, 1, '#a09070');
}

function drawGatePost(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox + 4, oy, 8, 80, '#5a4030');
  drawRect(ctx, ox + 5, oy + 1, 6, 78, '#6a4a35');
  drawRect(ctx, ox + 4, oy + 18, 8, 1, '#3a2818');
  drawRect(ctx, ox + 4, oy + 40, 8, 1, '#3a2818');
  drawRect(ctx, ox + 4, oy + 62, 8, 1, '#3a2818');
  drawRect(ctx, ox + 3, oy, 10, 3, '#8a6a48');
}

function drawCabin(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox, oy + 8, 48, 40, COLORS.cabin);
  for (let i = 0; i < 5; i++) drawRect(ctx, ox, oy + 12 + i * 7, 48, 1, '#5a3818');
  drawRect(ctx, ox - 4, oy + 2, 56, 10, COLORS.cabinRoof);
  drawRect(ctx, ox - 2, oy, 52, 6, '#2a1a10');
  drawRect(ctx, ox + 8, oy - 4, 32, 6, '#4a3020');
  drawRect(ctx, ox + 36, oy - 10, 8, 12, '#5a4030');
  drawRect(ctx, ox + 18, oy + 24, 12, 24, '#3a2818');
  drawRect(ctx, ox + 20, oy + 26, 8, 20, '#4a3020');
  drawRect(ctx, ox + 27, oy + 34, 2, 2, '#d4a84b');
  drawRect(ctx, ox + 6, oy + 16, 8, 8, '#1a3040');
  drawRect(ctx, ox + 7, oy + 17, 6, 6, '#a8c8e0');
  drawRect(ctx, ox + 34, oy + 16, 8, 8, '#1a3040');
  drawRect(ctx, ox + 35, oy + 17, 6, 6, '#a8c8e0');
}

function drawStone(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox + 2, oy + 6, 12, 8, '#6a6a58');
  drawRect(ctx, ox + 4, oy + 4, 8, 4, '#8a8a70');
  drawRect(ctx, ox + 6, oy + 2, 4, 3, 'rgba(180,220,160,0.5)');
}

function drawBuilding(ctx, x, y, variant = 0) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const h = 48 + variant * 8;
  const w = 40 + variant * 4;
  drawRect(ctx, ox, oy + 16, w, h - 8, variant === 1 ? '#7a6050' : '#8a7060');
  drawRect(ctx, ox - 2, oy + 8, w + 4, 12, '#4a3020');
  drawRect(ctx, ox + 4, oy + 4, w - 8, 8, '#3a2818');
  // windows
  drawRect(ctx, ox + 6, oy + 24, 8, 8, '#1a3040');
  drawRect(ctx, ox + 7, oy + 25, 6, 6, '#c8a860');
  drawRect(ctx, ox + w - 16, oy + 24, 8, 8, '#1a3040');
  drawRect(ctx, ox + w - 15, oy + 25, 6, 6, '#c8a860');
  drawRect(ctx, ox + w / 2 - 4, oy + h - 8, 10, 16, '#3a2818');
}

function drawLamp(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox + 6, oy, 3, 28, '#4a4030');
  drawRect(ctx, ox + 3, oy - 6, 10, 8, '#6a5a40');
  drawRect(ctx, ox + 5, oy - 4, 6, 4, '#e8c860');
}

function drawReed(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox + 4, oy, 2, 14, '#3a6a38');
  drawRect(ctx, ox + 8, oy + 2, 2, 12, '#2a5a28');
  drawRect(ctx, ox + 2, oy - 2, 3, 4, '#4a8a40');
  drawRect(ctx, ox + 7, oy, 3, 3, '#4a8a40');
}

function drawPillar(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox + 4, oy, 8, 56, '#6a6a60');
  drawRect(ctx, ox + 2, oy - 2, 12, 4, '#8a8a78');
  drawRect(ctx, ox + 2, oy + 54, 12, 4, '#5a5a50');
}

function drawShrine(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  drawRect(ctx, ox, oy + 20, 40, 40, '#5a5048');
  drawRect(ctx, ox - 4, oy + 12, 48, 10, '#3a3028');
  drawRect(ctx, ox + 8, oy, 24, 16, '#4a4038');
  drawRect(ctx, ox + 16, oy + 28, 8, 8, '#d4a84b');
  drawRect(ctx, ox + 18, oy + 26, 4, 12, '#e8c860');
}
