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
  CLEAR: 'clear', // mid-campaign level cleared — brief advance screen
  WIN: 'win',
  LOSE: 'lose',
};

/** Campaign metadata (1-indexed levels) */
export const LEVEL_META = [
  null, // pad so index matches level number
  {
    num: 1,
    name: 'Palmyra Woods',
    short: 'Woods Path',
    blurb: 'Defend the frontier path. Reach the Ringleader.',
    clearNext: 'The Sacred Grove awaits…',
    bossTitle: 'FRONTIER RINGLEADER!',
  },
  {
    num: 2,
    name: 'Sacred Grove',
    short: 'Hill Path',
    blurb: 'Night among the trees. Seek the Grove Sentinel.',
    clearNext: 'Palmyra streets lie ahead…',
    bossTitle: 'GROVE SENTINEL!',
  },
  {
    num: 3,
    name: 'Palmyra Streets',
    short: 'Village',
    blurb: 'Rooftops and alleys. Face the Street Captain.',
    clearNext: 'A river crossing waits…',
    bossTitle: 'STREET CAPTAIN!',
  },
  {
    num: 4,
    name: 'River Crossing',
    short: 'Bridges',
    blurb: 'Watch the water. Cross carefully.',
    clearNext: 'The final trial approaches…',
    bossTitle: 'RIVER WARDEN!',
  },
  {
    num: 5,
    name: 'Temple Hill',
    short: 'Final Trial',
    blurb: 'Storm on the hill. Stand firm to the end.',
    clearNext: '',
    bossTitle: 'STORM OVERSEER!',
  },
];

export const MAX_LEVEL = 5;

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
  water: '#3a6a9a',
  waterDeep: '#1a3a5a',
};
