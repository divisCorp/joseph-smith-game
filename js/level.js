/**
 * Level data — Palmyra Quest campaign (Levels 1–5)
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
      decor.push({ type: 'tree', x: c * TILE - 8, y: (groundR - 5) * TILE, variant: c % 3, tall: true });
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

// ── Drawing (HD illustrated environments @ 2×) ────────────
export function drawLevelBackground(ctx, camX, level) {
  const theme = level.theme || 'woods';
  if (theme === 'grove') drawBgGrove(ctx, camX);
  else if (theme === 'village') drawBgVillage(ctx, camX);
  else if (theme === 'river') drawBgRiver(ctx, camX);
  else if (theme === 'storm') drawBgStorm(ctx, camX, level);
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

function drawBgWoods(ctx, camX) {
  skyGradient(ctx, [
    [0, '#4a8ec8'],
    [0.35, '#7ab8e0'],
    [0.55, '#a8d4f0'],
    [0.75, '#c8e0b0'],
    [1, '#6a9a58'],
  ]);
  // soft clouds
  for (let i = 0; i < 6; i++) {
    const cx = ((i * 140 - camX * 0.08) % (W + 120)) - 60;
    const cy = 50 + (i % 3) * 22;
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 42, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 28, cy - 6, 28, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 24, cy + 2, 24, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // far hills
  ctx.fillStyle = '#3a6038';
  ctx.beginPath();
  ctx.moveTo(0, 280);
  for (let i = 0; i < 10; i++) {
    const hx = ((i * 90 - camX * 0.12) % (W + 100)) - 50;
    ctx.lineTo(hx + 45, 220 - (i % 3) * 18);
    ctx.lineTo(hx + 90, 280);
  }
  ctx.lineTo(W, 280);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  // mid meadow
  const mg = ctx.createLinearGradient(0, 300, 0, H);
  mg.addColorStop(0, '#4a7a48');
  mg.addColorStop(1, '#5a8a50');
  ctx.fillStyle = mg;
  ctx.fillRect(0, 300, W, H - 300);
  // grass tufts
  for (let i = 0; i < 28; i++) {
    const gx = ((i * 28 - camX * 0.55) % (W + 28));
    drawRect(ctx, gx, 340, 3, 8, '#3d6a35');
    drawRect(ctx, gx + 6, 344, 3, 6, '#2d5a28');
  }
}

function drawBgGrove(ctx, camX) {
  skyGradient(ctx, [
    [0, '#080c1a'],
    [0.4, '#121c38'],
    [0.7, '#1a3028'],
    [1, '#243828'],
  ]);
  const stars = [[36, 28], [100, 44], [180, 20], [260, 56], [340, 32], [420, 48], [480, 24], [140, 72], [300, 80], [60, 90]];
  for (const [sx, sy] of stars) {
    drawRect(ctx, sx, sy, 3, 3, 'rgba(220,230,255,0.75)');
  }
  // moon + glow
  ctx.fillStyle = 'rgba(232,232,208,0.15)';
  ctx.beginPath();
  ctx.ellipse(420, 70, 36, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e8d0';
  ctx.beginPath();
  ctx.ellipse(420, 70, 18, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#121c38';
  ctx.beginPath();
  ctx.ellipse(430, 66, 14, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // dark canopy silhouettes
  for (let i = 0; i < 14; i++) {
    const hx = ((i * 60 - camX * 0.12) % (W + 80)) - 40;
    ctx.fillStyle = '#142818';
    ctx.beginPath();
    ctx.ellipse(hx + 20, 240, 28, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    drawRect(ctx, hx + 16, 260, 10, 80, '#0e1c12');
  }
  drawRect(ctx, 0, 340, W, H - 340, '#2a4030');
}

function drawBgVillage(ctx, camX) {
  skyGradient(ctx, [
    [0, '#8ab0d0'],
    [0.45, '#c0d4e0'],
    [0.7, '#d8d0c0'],
    [1, '#8a8070'],
  ]);
  // distant rooftops
  for (let i = 0; i < 12; i++) {
    const hx = ((i * 84 - camX * 0.2) % (W + 100)) - 50;
    drawRect(ctx, hx, 220, 56, 60, '#5a5a68');
    ctx.fillStyle = '#4a3a30';
    ctx.beginPath();
    ctx.moveTo(hx - 6, 226);
    ctx.lineTo(hx + 28, 200);
    ctx.lineTo(hx + 62, 226);
    ctx.fill();
    drawRect(ctx, hx + 12, 236, 10, 10, '#c8a860');
    drawRect(ctx, hx + 34, 236, 10, 10, '#c8a860');
  }
  drawRect(ctx, 0, 300, W, 40, '#7a7a70');
  const dirt = ctx.createLinearGradient(0, 340, 0, H);
  dirt.addColorStop(0, '#8a8070');
  dirt.addColorStop(1, '#6a6050');
  ctx.fillStyle = dirt;
  ctx.fillRect(0, 340, W, H - 340);
  for (let i = 0; i < 20; i++) {
    const gx = ((i * 40 - camX * 0.5) % (W + 40));
    drawRect(ctx, gx, 352, 18, 3, '#6a6050');
  }
}

function drawBgRiver(ctx, camX) {
  skyGradient(ctx, [
    [0, '#6aa0c8'],
    [0.4, '#98c0d8'],
    [0.65, '#b0d0c0'],
    [1, '#5a8a70'],
  ]);
  drawRect(ctx, 0, 200, W, 40, 'rgba(200,220,240,0.28)');
  // water band
  const wg = ctx.createLinearGradient(0, 280, 0, 360);
  wg.addColorStop(0, '#4a8aaa');
  wg.addColorStop(0.5, '#3a7a98');
  wg.addColorStop(1, '#5a8a70');
  ctx.fillStyle = wg;
  ctx.fillRect(0, 280, W, 100);
  for (let i = 0; i < 10; i++) {
    const wx = ((i * 80 - camX * 0.18) % (W + 80)) - 40;
    drawRect(ctx, wx, 300, 48, 4, 'rgba(180,220,240,0.4)');
    drawRect(ctx, wx + 20, 320, 36, 3, 'rgba(160,200,220,0.3)');
  }
  drawRect(ctx, 0, 360, W, H - 360, '#5a8a70');
}

function drawBgStorm(ctx, camX, level) {
  skyGradient(ctx, [
    [0, '#1a1830'],
    [0.35, '#2a2848'],
    [0.65, '#3a3848'],
    [1, '#4a5050'],
  ]);
  for (let i = 0; i < 8; i++) {
    const cx = ((i * 110 - camX * 0.1) % (W + 140)) - 70;
    const cy = 40 + (i % 3) * 18;
    ctx.fillStyle = '#2a2840';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 55, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 30, cy - 10, 40, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const flash = Math.floor(camX / 80 + (level.num || 5) * 3) % 17 === 0;
  if (flash) drawRect(ctx, 0, 0, W, 220, 'rgba(200,220,255,0.14)');
  for (let i = 0; i < 8; i++) {
    const hx = ((i * 100 - camX * 0.22) % (W + 120)) - 60;
    ctx.fillStyle = '#3a4048';
    ctx.beginPath();
    ctx.moveTo(hx, 340);
    ctx.lineTo(hx + 50, 250);
    ctx.lineTo(hx + 100, 340);
    ctx.fill();
  }
  drawRect(ctx, 0, 340, W, H - 340, '#4a5050');
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
      drawRect(ctx, x + 4, y, 4, 4, '#5aaa48');
      drawRect(ctx, x + 14, y - 2, 4, 4, '#4a9a40');
      drawRect(ctx, x + 24, y, 4, 4, '#5aaa48');
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
  // trunk with bark
  drawRect(ctx, ox + 20, oy + 44, 14, tall ? 76 : 60, COLORS.treeTrunk);
  drawRect(ctx, ox + 22, oy + 48, 4, 10, '#3a2418');
  drawRect(ctx, ox + 28, oy + 64, 4, 8, '#3a2418');
  drawRect(ctx, ox + 24, oy + 44, 4, tall ? 76 : 60, 'rgba(90,70,40,0.35)');
  // layered canopy
  const leaf = COLORS.treeLeaf;
  const leafL = '#3d6a35';
  const leafH = '#4a7a40';
  ctx.fillStyle = leaf;
  ctx.beginPath();
  ctx.ellipse(ox + 26 + shift, oy + 36, 36, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = leafL;
  ctx.beginPath();
  ctx.ellipse(ox + 26 + shift, oy + 18, 26, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = leafH;
  ctx.beginPath();
  ctx.ellipse(ox + 26 + shift, oy + 4, 16, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  drawRect(ctx, ox + 16 + shift, oy + 20, 8, 5, '#5a9a48');
  drawRect(ctx, ox + 32 + shift, oy + 28, 8, 5, '#244a22');
  if (tall) {
    ctx.fillStyle = '#2d5a28';
    ctx.beginPath();
    ctx.ellipse(ox + 26 + shift, oy - 16, 30, 16, 0, 0, Math.PI * 2);
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
  drawRect(ctx, ox, oy + 16, 96, 80, COLORS.cabin);
  for (let i = 0; i < 5; i++) drawRect(ctx, ox, oy + 24 + i * 14, 96, 2, '#5a3818');
  drawRect(ctx, ox - 8, oy + 4, 112, 20, COLORS.cabinRoof);
  drawRect(ctx, ox - 4, oy, 104, 12, '#2a1a10');
  drawRect(ctx, ox + 16, oy - 8, 64, 12, '#4a3020');
  drawRect(ctx, ox + 72, oy - 20, 16, 24, '#5a4030');
  drawRect(ctx, ox + 36, oy + 48, 24, 48, '#3a2818');
  drawRect(ctx, ox + 40, oy + 52, 16, 40, '#4a3020');
  drawRect(ctx, ox + 52, oy + 68, 4, 4, '#d4a84b');
  drawRect(ctx, ox + 12, oy + 32, 16, 16, '#1a3040');
  drawRect(ctx, ox + 14, oy + 34, 12, 12, '#a8c8e0');
  drawRect(ctx, ox + 68, oy + 32, 16, 16, '#1a3040');
  drawRect(ctx, ox + 70, oy + 34, 12, 12, '#a8c8e0');
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
