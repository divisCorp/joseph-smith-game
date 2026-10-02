/** HD illustrated side-scroller — internal 1080×480 landscape, CSS-scaled */
export const SCALE = 2;
export const W = 540 * SCALE; // 1080
export const H = 240 * SCALE; // 480
export const TILE = 16 * SCALE; // 32
export const GRAVITY = 0.35 * SCALE;
export const FRICTION = 0.75;
export const MAX_FALL = 8 * SCALE;

export const STATES = {
  TITLE: 'title',
  INTRO: 'intro',
  PLAYING: 'playing',
  PAUSED: 'paused',
  CLEAR: 'clear',
  WIN: 'win',
  LOSE: 'lose',
};

/** Campaign metadata (1-indexed levels) — The Prophet's Path */
export const LEVEL_META = [
  null,
  {
    num: 1,
    year: 'Spring 1820',
    place: 'Palmyra, New York',
    story: 'A farm boy with a question walks into the woods to pray.',
    name: 'Sacred Grove',
    short: 'The Grove',
    blurb: 'Young Joseph. Pitchfork the wolves. Kneel and pray to pierce the darkness.',
    clearNext: 'A heavenly messenger awaits…',
    bossTitle: 'DARK CLOUD!',
    clearTitle: 'The Cloud Breaks',
  },
  {
    num: 2,
    year: 'September 1823',
    place: 'Palmyra, New York',
    story: 'Three years later, a night of prayer brings a heavenly visitor.',
    name: 'A Messenger',
    short: 'Meet Moroni',
    blurb: 'Night grove. Reach the glowing messenger.',
    clearNext: 'Seek the plates upon the hill…',
    bossTitle: '',
    clearTitle: 'Moroni Appears',
  },
  {
    num: 3,
    year: 'September 1827',
    place: 'Hill Cumorah',
    story: 'At last Joseph may climb the hill and receive the plates.',
    name: 'Hill Cumorah',
    short: 'Find the plates',
    blurb: 'Climb the hill. Claim the gold plates.',
    clearNext: 'Trouble gathers in Missouri…',
    bossTitle: '',
    clearTitle: 'Plates Found',
  },
  {
    num: 4,
    year: 'Autumn 1838',
    place: 'Missouri',
    story: 'The Saints build homes in Missouri, but angry mobs gather.',
    name: 'Missouri Night',
    short: 'Mobs',
    blurb: 'Stand firm against the night mobs.',
    clearNext: 'The Far West road stretches on…',
    bossTitle: 'MOB CAPTAIN!',
    clearTitle: 'Missouri Cleared',
  },
  {
    num: 5,
    year: 'Winter 1838–39',
    place: 'Far West to Liberty Jail',
    story: 'Taken from Far West, Joseph is held through a long, cold winter.',
    name: 'Far West Road',
    short: 'Liberty road',
    blurb: 'Mobs on the road. Face the jailer.',
    clearNext: 'Nauvoo streets wait ahead…',
    bossTitle: 'JAILER WARDEN!',
    clearTitle: 'Road Cleared',
  },
  {
    num: 6,
    year: '1844',
    place: 'Nauvoo, Illinois',
    story: 'Nauvoo the Beautiful thrives, yet enemies plot in the shadows.',
    name: 'Nauvoo',
    short: 'Streets',
    blurb: 'City streets and conspiracy. Face the ringleader.',
    clearNext: 'Carthage Jail lies ahead…',
    bossTitle: 'CONSPIRACY RINGLEADER!',
    clearTitle: 'Nauvoo Cleared',
  },
  {
    num: 7,
    year: 'June 1844',
    place: 'Carthage, Illinois',
    story: 'Joseph keeps his word and goes to Carthage, faithful to the end.',
    name: 'Carthage Jail',
    short: 'Martyr',
    blurb: 'Last stand. He sealed his testimony.',
    clearNext: '',
    bossTitle: 'LAST STAND!',
    clearTitle: 'Testimony Sealed',
  },
];

export const MAX_LEVEL = 7;

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
