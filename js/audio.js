/**
 * 8-bit SFX + chiptune BGM (Web Audio).
 * Title/level theme is Bradbury's 1862 "Jesus Loves Me" — public domain.
 * Modern Primary songs stay unused (copyright).
 */
import { STATES } from './constants.js';

let actx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let musicTimer = 0;
let musicStep = 0;
let currentSong = null;
let muted = false;
let lastState = '';
let lastLevel = 0;

const NOTE = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
};

function n(name, beats) {
  return { f: name ? NOTE[name] : 0, b: beats };
}

/** Bradbury 1862, C major. Incipit 53323 55661 66555 (Hymnary). */
const JESUS_LOVES_ME = {
  bpm: 108,
  lead: [
    n('G4', 1), n('E4', 1), n('E4', 1), n('D4', 1), n('E4', 1), n('G4', 1), n('G4', 2),
    n('A4', 1), n('A4', 1), n('C5', 1), n('A4', 1), n('A4', 1), n('G4', 1), n('G4', 2),
    n('G4', 1), n('E4', 1), n('E4', 1), n('D4', 1), n('E4', 1), n('G4', 1), n('G4', 2),
    n('A4', 1), n('A4', 1), n('C5', 1), n('A4', 1), n('A4', 1), n('G4', 1), n('G4', 2),
    n('G4', 1), n('G4', 1), n('A4', 1), n('G4', 1), n('E4', 2), n('G4', 1), n('G4', 1),
    n('A4', 1), n('G4', 1), n('E4', 2), n('G4', 1), n('G4', 1),
    n('A4', 1), n('G4', 1), n('E4', 2), n('D4', 1), n('E4', 1), n('D4', 1), n('C4', 3),
    n(null, 2),
  ],
  bass: [
    n('C3', 2), n('G3', 2), n('C3', 2), n('G3', 2),
    n('F3', 2), n('C3', 2), n('G3', 2), n('C3', 2),
    n('C3', 2), n('G3', 2), n('C3', 2), n('G3', 2),
    n('F3', 2), n('C3', 2), n('G3', 2), n('C3', 2),
    n('C3', 2), n('G3', 2), n('C3', 2), n('E3', 2),
    n('C3', 2), n('G3', 2), n('F3', 2), n('C3', 2),
    n('G3', 2), n('G3', 2), n('C3', 4),
    n(null, 2),
  ],
};

const GROVE_HYMN = {
  bpm: 96,
  lead: JESUS_LOVES_ME.lead.map((x) => ({ f: x.f ? x.f * (3 / 4) : 0, b: x.b })),
  bass: JESUS_LOVES_ME.bass.map((x) => ({ f: x.f ? x.f * (3 / 4) : 0, b: x.b })),
};

function ensure() {
  if (actx) return actx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  actx = new AC();
  master = actx.createGain();
  master.gain.value = 0.4;
  master.connect(actx.destination);
  musicGain = actx.createGain();
  musicGain.gain.value = 0.18;
  musicGain.connect(master);
  sfxGain = actx.createGain();
  sfxGain.gain.value = 0.4;
  sfxGain.connect(master);
  return actx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.4;
  return muted;
}

function tone(freq, dur, type, vol, dest, slide) {
  if (!actx || muted || !freq) return;
  const t = actx.currentTime;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol, dest, freq) {
  if (!actx || muted) return;
  const t = actx.currentTime;
  const len = Math.floor(actx.sampleRate * dur);
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = actx.createBufferSource();
  src.buffer = buf;
  const filter = actx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq || 1200;
  const g = actx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(dest);
  src.start(t);
  src.stop(t + dur);
}

export function sfx(name) {
  if (!ensure() || muted) return;
  const d = sfxGain;
  switch (name) {
    case 'jump':
      tone(220, 0.12, 'square', 0.22, d, 420);
      break;
    case 'land':
      tone(90, 0.08, 'triangle', 0.18, d, 60);
      noise(0.06, 0.12, d, 400);
      break;
    case 'throw':
      tone(520, 0.08, 'square', 0.16, d, 180);
      noise(0.05, 0.1, d, 2000);
      break;
    case 'hit':
      noise(0.09, 0.28, d, 900);
      tone(180, 0.07, 'square', 0.14, d, 80);
      break;
    case 'hurt':
      tone(320, 0.18, 'square', 0.22, d, 90);
      break;
    case 'heal':
      tone(392, 0.08, 'square', 0.16, d);
      setTimeout(() => tone(523, 0.1, 'square', 0.16, d), 70);
      setTimeout(() => tone(659, 0.14, 'square', 0.16, d), 140);
      break;
    case 'die':
      tone(196, 0.22, 'square', 0.2, d, 80);
      setTimeout(() => tone(130, 0.35, 'square', 0.18, d, 50), 180);
      break;
    case 'start':
      tone(262, 0.08, 'square', 0.18, d);
      setTimeout(() => tone(330, 0.08, 'square', 0.18, d), 80);
      setTimeout(() => tone(392, 0.08, 'square', 0.18, d), 160);
      setTimeout(() => tone(523, 0.16, 'square', 0.2, d), 240);
      break;
    case 'clear':
      tone(392, 0.1, 'square', 0.18, d);
      setTimeout(() => tone(494, 0.1, 'square', 0.18, d), 90);
      setTimeout(() => tone(587, 0.2, 'square', 0.2, d), 180);
      break;
    case 'win':
      tone(392, 0.12, 'square', 0.18, d);
      setTimeout(() => tone(523, 0.12, 'square', 0.18, d), 110);
      setTimeout(() => tone(659, 0.12, 'square', 0.18, d), 220);
      setTimeout(() => tone(784, 0.28, 'square', 0.2, d), 330);
      break;
    default:
      break;
  }
}

function playSongNote(track, dest, vol, type) {
  if (!currentSong) return;
  const notes = currentSong[track];
  if (!notes || !notes.length) return;
  let acc = 0;
  const step = musicStep;
  for (const note of notes) {
    if (step === acc) {
      if (note.f) tone(note.f, (note.b * 60) / currentSong.bpm * 0.92, type, vol, dest);
      return;
    }
    acc += note.b;
    if (acc > step) return;
  }
}

function songLength(song) {
  return song.lead.reduce((s, n) => s + n.b, 0);
}

export function tickMusic(dtFrames) {
  if (!actx || muted || !currentSong) return;
  const beat = 60 / currentSong.bpm;
  musicTimer += dtFrames / 60;
  if (musicTimer >= beat) {
    musicTimer -= beat;
    playSongNote('lead', musicGain, 0.22, 'square');
    playSongNote('bass', musicGain, 0.12, 'triangle');
    musicStep += 1;
    if (musicStep >= songLength(currentSong)) musicStep = 0;
  }
}

export function setMusic(song) {
  if (currentSong === song) return;
  currentSong = song;
  musicStep = 0;
  musicTimer = 0;
}

export function stopMusic() {
  currentSong = null;
}

export function syncAudio(game) {
  unlockAudio();
  const st = game.state;
  if (st !== lastState) {
    if (st === STATES.PLAYING && lastState === STATES.TITLE) sfx('start');
    if (st === STATES.CLEAR) sfx('clear');
    if (st === STATES.WIN) sfx('win');
    if (st === STATES.LOSE) sfx('die');
    lastState = st;
    lastLevel = game.levelNum;
  }
  if (st === STATES.PAUSED || st === STATES.LOSE) {
    stopMusic();
    return;
  }
  if (st === STATES.TITLE || st === STATES.WIN || st === STATES.CLEAR) {
    setMusic(JESUS_LOVES_ME);
    return;
  }
  if (st === STATES.PLAYING) {
    setMusic(game.levelNum >= 3 ? GROVE_HYMN : JESUS_LOVES_ME);
  }
}

export { JESUS_LOVES_ME };
