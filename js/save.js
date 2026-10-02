/**
 * Local progress (localStorage). Every read is validated and every write is
 * wrapped so private-mode / quota errors can never break the game.
 */
import { MAX_LEVEL } from './constants.js?v=68';

const KEY = 'palmyraQuest.save.v1';

const DEFAULTS = { unlocked: 1, best: 0, muted: false, tips: {}, diff: 'normal', reduceFlash: false, chapters: {} };

let data = load();

function clampInt(v, lo, hi, fallback) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

function load() {
  let raw = null;
  try {
    raw = JSON.parse(window.localStorage.getItem(KEY) || 'null');
  } catch (_) {
    raw = null;
  }
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS, tips: {}, chapters: {} };
  return {
    unlocked: clampInt(raw.unlocked, 1, MAX_LEVEL, 1),
    best: clampInt(raw.best, 0, 99999999, 0),
    muted: raw.muted === true,
    tips: raw.tips && typeof raw.tips === 'object' ? { ...raw.tips } : {},
    diff: raw.diff === 'easy' ? 'easy' : 'normal',
    reduceFlash: raw.reduceFlash === true,
    chapters: cleanChapters(raw.chapters),
  };
}

/** Per-chapter bests: { [n]: { stars 0-3, pages bitmask 0-7, time frames } } */
function cleanChapters(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (let n = 1; n <= MAX_LEVEL; n++) {
    const c = raw[n];
    if (!c || typeof c !== 'object') continue;
    out[n] = {
      stars: clampInt(c.stars, 0, 3, 0),
      pages: clampInt(c.pages, 0, 7, 0),
      time: clampInt(c.time, 0, 10000000, 0),
    };
  }
  return out;
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch (_) {
    /* storage unavailable — progress lives for this session only */
  }
}

export function getSave() {
  return data;
}

/** Furthest chapter the player may start from (1..MAX_LEVEL). */
export function unlockedChapter() {
  return clampInt(data.unlocked, 1, MAX_LEVEL, 1);
}

export function unlockChapter(num) {
  const n = clampInt(num, 1, MAX_LEVEL, 1);
  if (n > data.unlocked) {
    data.unlocked = n;
    persist();
  }
}

export function bestScore() {
  return data.best;
}

/** Returns true when this is a new best. */
export function recordScore(score) {
  const s = clampInt(score, 0, 99999999, 0);
  if (s > data.best) {
    data.best = s;
    persist();
    return true;
  }
  return false;
}

export function savedMuted() {
  return data.muted;
}

export function saveMuted(m) {
  data.muted = !!m;
  persist();
}

export function tipSeen(id) {
  return !!data.tips[id];
}

export function markTip(id) {
  if (data.tips[id]) return;
  data.tips[id] = 1;
  persist();
}

// ── Settings ───────────────────────────────────────────────
export function difficulty() {
  return data.diff === 'easy' ? 'easy' : 'normal';
}

export function isEasy() {
  return data.diff === 'easy';
}

export function setDifficulty(d) {
  data.diff = d === 'easy' ? 'easy' : 'normal';
  persist();
}

export function reduceFlash() {
  return data.reduceFlash === true;
}

export function setReduceFlash(on) {
  data.reduceFlash = !!on;
  persist();
}

// ── Chapter results ────────────────────────────────────────
export function chapterRecord(n) {
  return data.chapters[n] || { stars: 0, pages: 0, time: 0 };
}

/** Keep the best stars, the union of pages ever found, and the fastest time. */
export function recordChapter(n, stars, pagesMask, time) {
  const k = clampInt(n, 1, MAX_LEVEL, 1);
  const prev = data.chapters[k] || { stars: 0, pages: 0, time: 0 };
  const next = {
    stars: Math.max(prev.stars, clampInt(stars, 0, 3, 0)),
    pages: (prev.pages | clampInt(pagesMask, 0, 7, 0)) & 7,
    time: prev.time > 0 ? Math.min(prev.time, clampInt(time, 1, 10000000, 1)) : clampInt(time, 1, 10000000, 1),
  };
  const improved = next.stars > prev.stars;
  data.chapters[k] = next;
  persist();
  return { prev, next, improved };
}
