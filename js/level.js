/**
 * Level data — Level 1: Palmyra Woods Path
 * Clean structure for a future Level 2 (export more level factories).
 */
import { TILE, W, H, COLORS } from './constants.js';
import { createEnemy } from './enemy.js';
import { drawRect } from './sprites.js';

/** Tile map codes: 0 empty, 1 solid ground, 2 platform, 3 cabin wall, 4 fence */
export function createLevel1() {
  const cols = 120; // ~1920 px wide
  const rows = 15;  // 240 px
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    tiles[r] = [];
    for (let c = 0; c < cols; c++) {
      tiles[r][c] = 0;
    }
  }

  // ground row (y = 13 * 16 = 208)
  const groundR = 13;
  for (let c = 0; c < cols; c++) {
    // gaps
    const gap =
      (c >= 32 && c <= 33) ||
      (c >= 55 && c <= 57) ||
      (c >= 79 && c <= 81);
    if (!gap) {
      tiles[groundR][c] = 1;
      tiles[groundR + 1][c] = 1;
    }
  }

  // floating platforms
  placePlatform(tiles, 18, 10, 4);
  placePlatform(tiles, 35, 9, 3);
  placePlatform(tiles, 42, 11, 3);
  placePlatform(tiles, 60, 10, 5);
  placePlatform(tiles, 70, 8, 3);
  placePlatform(tiles, 88, 10, 4);
  placePlatform(tiles, 96, 9, 3);

  // boss arena raised floor continuity (cols 100+)
  for (let c = 100; c < cols; c++) {
    tiles[groundR][c] = 1;
    tiles[groundR + 1][c] = 1;
  }
  // arena side walls (visual solids)
  for (let r = 8; r < groundR; r++) {
    tiles[r][100] = 3;
    tiles[r][cols - 1] = 3;
  }

  const solids = tilesToSolids(tiles);

  const enemies = [
    createEnemy('brigand', 22 * TILE, 11 * TILE, { patrolMin: 20 * TILE, patrolMax: 26 * TILE }),
    createEnemy('wolf', 38 * TILE, 7 * TILE, { patrolMin: 35 * TILE, patrolMax: 42 * TILE }),
    createEnemy('brigand', 48 * TILE, 11 * TILE, { patrolMin: 45 * TILE, patrolMax: 51 * TILE }),
    createEnemy('wolf', 65 * TILE, 8 * TILE, { patrolMin: 60 * TILE, patrolMax: 70 * TILE }),
    createEnemy('brigand', 74 * TILE, 11 * TILE, { patrolMin: 72 * TILE, patrolMax: 77 * TILE }),
    createEnemy('brigand', 92 * TILE, 11 * TILE, { patrolMin: 88 * TILE, patrolMax: 96 * TILE }),
    createEnemy('boss', 110 * TILE, 10 * TILE, {
      patrolMin: 102 * TILE,
      patrolMax: 116 * TILE,
    }),
  ];

  // decorative trees / fences (non-solid markers)
  const decor = [];
  for (let c = 4; c < 100; c += 7) {
    if (tiles[groundR][c] === 1) {
      decor.push({ type: 'tree', x: c * TILE, y: (groundR - 4) * TILE });
    }
  }
  for (let c = 12; c < 20; c++) {
    if (tiles[groundR][c] === 1) {
      decor.push({ type: 'fence', x: c * TILE, y: (groundR - 1) * TILE });
    }
  }

  return {
    id: 'level1',
    name: 'Palmyra Woods',
    cols,
    rows,
    tiles,
    solids,
    enemies,
    decor,
    spawn: { x: 3 * TILE, y: 10 * TILE },
    widthPx: cols * TILE,
    bossTriggered: false,
    bossZoneX: 100 * TILE,
  };
}

/** Placeholder for future Level 2 */
export function createLevel2() {
  // Future: Sacred Grove chapter — denser forest, new foe types
  return null;
}

function placePlatform(tiles, c, r, len) {
  for (let i = 0; i < len; i++) tiles[r][c + i] = 2;
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

export function drawLevelBackground(ctx, camX, level) {
  // sky gradient bands
  for (let i = 0; i < 10; i++) {
    const t = i / 10;
    const r = Math.floor(91 + t * 77);
    const g = Math.floor(163 + t * 49);
    const b = Math.floor(217 + t * 23);
    drawRect(ctx, 0, i * 16, W, 16, `rgb(${r},${g},${b})`);
  }
  // meadow fill under sky (avoid black gap above ground)
  drawRect(ctx, 0, 140, W, 80, '#4a7a48');
  // distant hills
  ctx.fillStyle = '#3d6a40';
  for (let i = 0; i < 8; i++) {
    const hx = ((i * 80 - camX * 0.2) % (W + 80)) - 40;
    ctx.beginPath();
    ctx.moveTo(hx, 160);
    ctx.lineTo(hx + 50, 110);
    ctx.lineTo(hx + 100, 160);
    ctx.fill();
  }
  drawRect(ctx, 0, 160, W, 60, '#5a8a50');

  // decor
  for (const d of level.decor) {
    const dx = d.x - camX;
    if (dx < -40 || dx > W + 40) continue;
    if (d.type === 'tree') drawTree(ctx, dx, d.y);
    if (d.type === 'fence') drawFence(ctx, dx, d.y);
  }

  // cabin near start
  const cabinX = 8 * TILE - camX;
  if (cabinX > -60 && cabinX < W) {
    drawCabin(ctx, cabinX, 9 * TILE);
  }
}

export function drawLevelTiles(ctx, camX, level) {
  const startC = Math.max(0, Math.floor(camX / TILE) - 1);
  const endC = Math.min(level.cols, Math.ceil((camX + W) / TILE) + 1);
  for (let r = 0; r < level.rows; r++) {
    for (let c = startC; c < endC; c++) {
      const t = level.tiles[r][c];
      if (!t) continue;
      const x = c * TILE - camX;
      const y = r * TILE;
      if (t === 1) {
        drawRect(ctx, x, y, TILE, 4, COLORS.grass);
        drawRect(ctx, x, y + 4, TILE, TILE - 4, COLORS.dirt);
        // dirt texture
        drawRect(ctx, x + 3, y + 8, 2, 2, '#6b4420');
        drawRect(ctx, x + 10, y + 11, 2, 2, '#6b4420');
      } else if (t === 2) {
        drawRect(ctx, x, y, TILE, 5, COLORS.wood);
        drawRect(ctx, x, y + 5, TILE, 3, '#3a2818');
      } else if (t === 3) {
        drawRect(ctx, x, y, TILE, TILE, '#5a4030');
        drawRect(ctx, x + 2, y + 2, 4, 4, '#3a2818');
      }
    }
  }
}

function drawTree(ctx, x, y) {
  drawRect(ctx, x + 10, y + 20, 8, 28, COLORS.treeTrunk);
  drawRect(ctx, x + 2, y + 4, 24, 18, COLORS.treeLeaf);
  drawRect(ctx, x + 6, y - 4, 16, 14, '#3d6a35');
}

function drawFence(ctx, x, y) {
  drawRect(ctx, x + 2, y, 3, 14, COLORS.fence);
  drawRect(ctx, x + 11, y, 3, 14, COLORS.fence);
  drawRect(ctx, x, y + 3, 16, 2, COLORS.fence);
  drawRect(ctx, x, y + 9, 16, 2, COLORS.fence);
}

function drawCabin(ctx, x, y) {
  drawRect(ctx, x, y + 8, 48, 40, COLORS.cabin);
  drawRect(ctx, x - 4, y, 56, 12, COLORS.cabinRoof);
  drawRect(ctx, x + 18, y + 24, 12, 24, '#3a2818'); // door
  drawRect(ctx, x + 6, y + 16, 8, 8, '#a8c8e0'); // window
  drawRect(ctx, x + 34, y + 16, 8, 8, '#a8c8e0');
}
