/** NES-like fixed resolution and shared game constants */
export const W = 256;
export const H = 240;
export const TILE = 16;
export const GRAVITY = 0.35;
export const FRICTION = 0.75;
export const MAX_FALL = 8;

export const STATES = {
  TITLE: 'title',
  PLAYING: 'playing',
  PAUSED: 'paused',
  WIN: 'win',
  LOSE: 'lose',
};

export const COLORS = {
  skyTop: '#5ba3d9',
  skyBot: '#a8d4f0',
  ground: '#6b4a2a',
  grass: '#3d7a3a',
  dirt: '#8b5a2b',
  wood: '#5c3d1e',
  path: '#c4a574',
  treeTrunk: '#4a3020',
  treeLeaf: '#2d5a28',
  cabin: '#7a5030',
  cabinRoof: '#3a2818',
  fence: '#8b7355',
  uiBg: '#1a1410',
  uiGold: '#d4a84b',
  uiCream: '#f0e6d0',
  uiRed: '#c04040',
  uiGreen: '#40a060',
  shadow: 'rgba(0,0,0,0.35)',
};
