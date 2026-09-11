/**
 * Level data — Level 1: Palmyra Woods Path
 * Clean structure for a future Level 2 (export more level factories).
 * Richer hand-drawn-style tiles, trees, cabin, fence, parallax.
 */
import { TILE, W, H, COLORS } from './constants.js';
import { createEnemy } from './enemy.js';
import { drawRect } from './sprites.js';

/** Tile map codes: 0 empty, 1 solid ground, 2 platform, 3 cabin wall (solid). Fence/gate posts are decor only (non-solid). */
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
  // Far arena boundary only (right edge). Do NOT place a solid wall at the
  // entrance (col 100): a full-height timber column was unjumpable (~80px vs
  // ~55px jump) and soft-locked players at "the pole" before the boss.
  for (let r = 8; r < groundR; r++) {
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
      decor.push({ type: 'tree', x: c * TILE, y: (groundR - 4) * TILE, variant: (c / 7) % 3 });
    }
  }
  for (let c = 12; c < 20; c++) {
    if (tiles[groundR][c] === 1) {
      decor.push({ type: 'fence', x: c * TILE, y: (groundR - 1) * TILE });
    }
  }
  // extra mid-path fence accents
  for (let c of [44, 45, 46, 84, 85]) {
    if (tiles[groundR][c] === 1) {
      decor.push({ type: 'fence', x: c * TILE, y: (groundR - 1) * TILE });
    }
  }
  // Boss-arena gate posts (visual only — non-solid so the path stays open)
  decor.push({ type: 'gate', x: 100 * TILE, y: (groundR - 5) * TILE });
  decor.push({ type: 'gate', x: 101 * TILE, y: (groundR - 5) * TILE });

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
  // sky gradient bands (dawn over Palmyra)
  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    const r = Math.floor(88 + t * 90);
    const g = Math.floor(150 + t * 60);
    const b = Math.floor(210 + t * 30);
    drawRect(ctx, 0, i * 14, W, 14, `rgb(${r},${g},${b})`);
  }

  // far cloud wisps (parallax slow)
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 70 - camX * 0.08) % (W + 60)) - 30;
    drawRect(ctx, cx, 28 + (i % 3) * 10, 28, 4, 'rgba(255,255,255,0.28)');
    drawRect(ctx, cx + 8, 24 + (i % 3) * 10, 16, 4, 'rgba(255,255,255,0.22)');
  }

  // distant forest silhouette band
  drawRect(ctx, 0, 118, W, 42, '#3a6038');
  for (let i = 0; i < 12; i++) {
    const hx = ((i * 36 - camX * 0.15) % (W + 40)) - 20;
    const hh = 18 + (i % 4) * 6;
    drawRect(ctx, hx + 6, 118 - hh + 18, 6, hh, '#2d4a2a');
    drawRect(ctx, hx, 118 - hh + 10, 18, 14, '#355832');
  }

  // mid hills (parallax)
  ctx.fillStyle = '#3d6a40';
  for (let i = 0; i < 8; i++) {
    const hx = ((i * 80 - camX * 0.28) % (W + 80)) - 40;
    ctx.beginPath();
    ctx.moveTo(hx, 168);
    ctx.lineTo(hx + 50, 118);
    ctx.lineTo(hx + 100, 168);
    ctx.fill();
  }

  // near meadow floor wash
  drawRect(ctx, 0, 150, W, 70, '#4a7a48');
  // grass tuft strip
  for (let i = 0; i < 20; i++) {
    const gx = ((i * 16 - camX * 0.55) % (W + 16));
    drawRect(ctx, gx, 168, 2, 4, '#3d6a35');
    drawRect(ctx, gx + 4, 170, 2, 3, '#2d5a28');
  }
  drawRect(ctx, 0, 172, W, 48, '#5a8a50');

  // decor
  for (const d of level.decor) {
    const dx = d.x - camX;
    if (dx < -48 || dx > W + 48) continue;
    if (d.type === 'tree') drawTree(ctx, dx, d.y, d.variant || 0);
    if (d.type === 'fence') drawFence(ctx, dx, d.y);
    if (d.type === 'gate') drawGatePost(ctx, dx, d.y);
  }

  // cabin near start
  const cabinX = 8 * TILE - camX;
  if (cabinX > -70 && cabinX < W) {
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
        drawGroundTile(ctx, x, y, c, r, level);
      } else if (t === 2) {
        drawPlatformTile(ctx, x, y);
      } else if (t === 3) {
        drawWallTile(ctx, x, y, r);
      }
    }
  }
}

function drawGroundTile(ctx, x, y, c, r, level) {
  const above = r > 0 ? level.tiles[r - 1][c] : 1;
  const isTop = !above;
  if (isTop) {
    // grass cap with tufts
    drawRect(ctx, x, y, TILE, 5, '#3d8a3a');
    drawRect(ctx, x, y + 1, TILE, 3, COLORS.grass);
    drawRect(ctx, x + 2, y, 2, 2, '#5aaa48');
    drawRect(ctx, x + 8, y - 1, 2, 2, '#4a9a40');
    drawRect(ctx, x + 12, y, 2, 2, '#5aaa48');
    drawRect(ctx, x, y + 5, TILE, TILE - 5, COLORS.dirt);
  } else {
    drawRect(ctx, x, y, TILE, TILE, '#7a4a28');
  }
  // dirt pebbles / cracks
  const seed = (c * 7 + r * 13) & 7;
  drawRect(ctx, x + 2 + (seed % 4), y + 8, 2, 2, '#6b4420');
  drawRect(ctx, x + 9, y + 11 + (seed % 2), 2, 1, '#5a3818');
  if (seed > 4) drawRect(ctx, x + 5, y + 13, 3, 1, '#9a6a3a');
}

function drawPlatformTile(ctx, x, y) {
  drawRect(ctx, x, y, TILE, 4, '#7a5530');
  drawRect(ctx, x, y + 1, TILE, 3, COLORS.wood);
  drawRect(ctx, x + 1, y, 2, 1, '#a08050');
  drawRect(ctx, x + 8, y, 2, 1, '#a08050');
  drawRect(ctx, x, y + 4, TILE, 4, '#3a2818');
  drawRect(ctx, x + 3, y + 5, 2, 2, '#2a1810');
  drawRect(ctx, x + 10, y + 5, 2, 2, '#2a1810');
  // underside shadow
  drawRect(ctx, x, y + 8, TILE, 1, 'rgba(0,0,0,0.25)');
}

function drawWallTile(ctx, x, y, r) {
  drawRect(ctx, x, y, TILE, TILE, '#5a4030');
  drawRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, '#6a4a35');
  // timber lines
  drawRect(ctx, x, y + 7, TILE, 1, '#3a2818');
  drawRect(ctx, x + 4, y + 2, 2, 4, '#3a2818');
  drawRect(ctx, x + 10, y + 9, 2, 4, '#3a2818');
  if (r % 2 === 0) drawRect(ctx, x + 2, y + 3, 3, 2, '#8a6a48');
}

function drawTree(ctx, x, y, variant = 0) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  // trunk with bark notches
  drawRect(ctx, ox + 10, oy + 22, 8, 30, COLORS.treeTrunk);
  drawRect(ctx, ox + 11, oy + 24, 2, 4, '#3a2418');
  drawRect(ctx, ox + 14, oy + 32, 2, 3, '#3a2418');
  drawRect(ctx, ox + 12, oy + 40, 3, 2, '#5a4030');

  // layered canopy (variant shifts shape)
  const shift = variant === 1 ? -2 : variant === 2 ? 2 : 0;
  drawRect(ctx, ox + 2 + shift, oy + 8, 24, 16, COLORS.treeLeaf);
  drawRect(ctx, ox + 6 + shift, oy - 2, 16, 14, '#3d6a35');
  drawRect(ctx, ox + 10 + shift, oy - 8, 10, 10, '#4a7a40');
  // leaf highlights / shadows
  drawRect(ctx, ox + 8 + shift, oy + 2, 4, 3, '#5a9a48');
  drawRect(ctx, ox + 16 + shift, oy + 10, 5, 3, '#244a22');
  drawRect(ctx, ox + 4 + shift, oy + 14, 6, 3, '#244a22');
}

function drawFence(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  // posts
  drawRect(ctx, ox + 2, oy, 3, 15, COLORS.fence);
  drawRect(ctx, ox + 11, oy, 3, 15, COLORS.fence);
  drawRect(ctx, ox + 2, oy, 3, 2, '#a09070');
  drawRect(ctx, ox + 11, oy, 3, 2, '#a09070');
  // rails
  drawRect(ctx, ox, oy + 3, 16, 2, COLORS.fence);
  drawRect(ctx, ox, oy + 9, 16, 2, COLORS.fence);
  drawRect(ctx, ox, oy + 3, 16, 1, '#a09070');
}

function drawGatePost(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  // Tall timber post (decoration only — collision comes from tiles, not decor)
  drawRect(ctx, ox + 4, oy, 8, 80, '#5a4030');
  drawRect(ctx, ox + 5, oy + 1, 6, 78, '#6a4a35');
  drawRect(ctx, ox + 4, oy + 18, 8, 1, '#3a2818');
  drawRect(ctx, ox + 4, oy + 40, 8, 1, '#3a2818');
  drawRect(ctx, ox + 4, oy + 62, 8, 1, '#3a2818');
  drawRect(ctx, ox + 6, oy + 8, 2, 6, '#3a2818');
  drawRect(ctx, ox + 6, oy + 48, 2, 6, '#3a2818');
  drawRect(ctx, ox + 3, oy, 10, 3, '#8a6a48'); // cap
}

function drawCabin(ctx, x, y) {
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  // body
  drawRect(ctx, ox, oy + 8, 48, 40, COLORS.cabin);
  // log lines
  for (let i = 0; i < 5; i++) {
    drawRect(ctx, ox, oy + 12 + i * 7, 48, 1, '#5a3818');
  }
  // roof
  drawRect(ctx, ox - 4, oy + 2, 56, 10, COLORS.cabinRoof);
  drawRect(ctx, ox - 2, oy, 52, 6, '#2a1a10');
  drawRect(ctx, ox + 8, oy - 4, 32, 6, '#4a3020');
  // chimney
  drawRect(ctx, ox + 36, oy - 10, 8, 12, '#5a4030');
  drawRect(ctx, ox + 35, oy - 12, 10, 3, '#3a2818');
  // door
  drawRect(ctx, ox + 18, oy + 24, 12, 24, '#3a2818');
  drawRect(ctx, ox + 20, oy + 26, 8, 20, '#4a3020');
  drawRect(ctx, ox + 27, oy + 34, 2, 2, '#d4a84b'); // knob
  // windows
  drawRect(ctx, ox + 6, oy + 16, 8, 8, '#1a3040');
  drawRect(ctx, ox + 7, oy + 17, 6, 6, '#a8c8e0');
  drawRect(ctx, ox + 9, oy + 16, 1, 8, '#3a2818');
  drawRect(ctx, ox + 6, oy + 19, 8, 1, '#3a2818');
  drawRect(ctx, ox + 34, oy + 16, 8, 8, '#1a3040');
  drawRect(ctx, ox + 35, oy + 17, 6, 6, '#a8c8e0');
  drawRect(ctx, ox + 37, oy + 16, 1, 8, '#3a2818');
  drawRect(ctx, ox + 34, oy + 19, 8, 1, '#3a2818');
}
