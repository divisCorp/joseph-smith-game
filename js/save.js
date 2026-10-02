/**
 * Local progress (localStorage). Every read is validated and every write is
 * wrapped so private-mode / quota errors can never break the game.
 */
import { MAX_LEVEL } from './constants.js';

const KEY = 'palmyraQuest.save.v1';

const DEFAULTS = { unlocked: 1, best: 0, muted: false, tips: {} };

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
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS, tips: {} };
  return {
    unlocked: clampInt(raw.unlocked, 1, MAX_LEVEL, 1),
    best: clampInt(raw.best, 0, 99999999, 0),
    muted: raw.muted === true,
    tips: raw.tips && typeof raw.tips === 'object' ? { ...raw.tips } : {},
  };
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
