/**
 * 8-bit SFX + chiptune BGM (Web Audio).
 * Every melody is a public-domain hymn tune (see js/songs.js + README "Music").
 * Arrangements (chiptune voicing + bass lines) are original to this game.
 * AudioContext is created only inside a user gesture so iPhone will actually play.
 */
import { STATES } from './constants.js?v=75';
import { savedMuted, saveMuted } from './save.js?v=75';
import * as S from './songs.js?v=75';

let actx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let muted = savedMuted();
let unlocked = false;
let lastState = '';
let htmlKick = null;

const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Build a bass line from chord roots in one of a few chiptune styles. */
function bassLine(chords, style) {
  const out = [];
  for (const [root, beats] of chords) {
    if (style === 'hold') {
      out.push([root, beats, 0.95]);
      continue;
    }
    const step = style === 'pulse' ? 0.5 : 1;
    let left = beats;
    let k = 0;
    while (left > 1e-6) {
      const b = Math.min(step, left);
      let m = root;
      if (style === 'pulse') m = k % 2 ? root + 12 : root;
      else if (style === 'root5') m = k % 2 ? root + 7 : root;
      else if (style === 'march') m = k % 2 ? root + 7 : root;
      out.push([m, b, style === 'march' || style === 'pulse' ? 0.55 : 0.9]);
      left -= b;
      k++;
    }
  }
  return out;
}

function track(song, o) {
  return {
    id: o.id,
    bpm: o.bpm,
    lead: song.lead.map(([m, b]) => [m ? m + (o.transpose || 0) : 0, b, o.leadGate ?? 0.9]),
    bass: bassLine(song.chords, o.bassStyle || 'root5').map(([m, b, g]) => [m + (o.bassTranspose || 0), b, g]),
    leadWave: o.leadWave || 'square',
    leadVol: o.leadVol ?? 0.2,
    bassWave: o.bassWave || 'triangle',
    bassVol: o.bassVol ?? 0.24,
  };
}

/**
 * One tune per chapter / mood. Reverent pieces use soft triangle leads;
 * boss fights use the brisk camp-meeting tune with a pulsing bass.
 */
export const TRACKS = {
  // Bradbury, 1862 — title, chapter-clear and ending screens
  title: track(S.JESUS_LOVES_ME, { id: 'title', bpm: 108, leadVol: 0.18, bassStyle: 'root5' }),
  // NEW BRITAIN (American folk, pub. 1829) — "Amazing Grace"
  grove: track(S.NEW_BRITAIN, { id: 'grove', bpm: 78, leadWave: 'triangle', leadVol: 0.34, bassStyle: 'hold', bassVol: 0.2 }),
  // Same tune, lower and slower, while Joseph kneels in the grove
  prayer: track(S.NEW_BRITAIN, { id: 'prayer', bpm: 62, transpose: -5, leadWave: 'triangle', leadVol: 0.36, bassStyle: 'hold', bassVol: 0.22 }),
  // OLD HUNDREDTH (Genevan Psalter, 1551)
  moroni: track(S.OLD_100TH, { id: 'moroni', bpm: 84, leadWave: 'triangle', leadVol: 0.34, bassStyle: 'hold', bassVol: 0.2 }),
  // FOUNDATION (Funk's Genuine Church Music, 1832) — "How Firm a Foundation"
  cumorah: track(S.FOUNDATION, { id: 'cumorah', bpm: 132, leadVol: 0.16, bassStyle: 'root5' }),
  // ALL IS WELL (Sacred Harp, 1844 / Revival Melodies, 1842) — "Come, Come, Ye Saints"
  missouri: track(S.ALL_IS_WELL, { id: 'missouri', bpm: 92, leadVol: 0.17, bassStyle: 'root5' }),
  // ST. GERTRUDE (Sullivan, 1871) — "Onward, Christian Soldiers"
  road: track(S.ST_GERTRUDE, { id: 'road', bpm: 116, leadVol: 0.16, bassStyle: 'march', leadGate: 0.8 }),
  // AUSTRIAN HYMN (Haydn, 1797) — "Glorious Things of Thee Are Spoken"
  nauvoo: track(S.AUSTRIAN, { id: 'nauvoo', bpm: 100, leadVol: 0.17, bassStyle: 'root5' }),
  // BETHANY (Lowell Mason, 1856) — "Nearer, My God, to Thee"
  carthage: track(S.BETHANY, { id: 'carthage', bpm: 70, leadWave: 'triangle', leadVol: 0.36, bassStyle: 'hold', bassVol: 0.2 }),
  // Credits roll after Carthage: Amazing Grace, slow and gentle
  credits: track(S.NEW_BRITAIN, { id: 'credits', bpm: 70, leadWave: 'triangle', leadVol: 0.34, bassStyle: 'hold', bassVol: 0.2 }),
  // Camp-meeting tune (c. 1856) later used for the "Battle Hymn of the Republic"
  boss: track(S.BATTLE_HYMN, { id: 'boss', bpm: 138, leadVol: 0.19, bassStyle: 'pulse', bassVol: 0.26, leadGate: 0.8 }),
};

const CHAPTER_TRACK = [null, 'grove', 'moroni', 'cumorah', 'missouri', 'road', 'nauvoo', 'carthage'];

function buildGraph() {
  if (actx) return actx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  actx = new AC();
  master = actx.createGain();
  master.gain.value = muted ? 0 : 0.75;
  master.connect(actx.destination);
  musicGain = actx.createGain();
  musicGain.gain.value = 0.42;
  musicGain.connect(master);
  sfxGain = actx.createGain();
  sfxGain.gain.value = 0.6;
  sfxGain.connect(master);
  return actx;
}

function kickSilent() {
  try {
    if (!htmlKick) {
      htmlKick = new Audio(SILENT_WAV);
      htmlKick.loop = true;
      htmlKick.volume = 0.01;
      htmlKick.muted = muted;
    }
    htmlKick.play().catch(() => {});
  } catch (_) {
    /* ignore */
  }
  if (!actx) return;
  try {
    const buf = actx.createBuffer(1, 1, 22050);
    const src = actx.createBufferSource();
    src.buffer = buf;
    src.connect(actx.destination);
    src.start(0);
  } catch (_) {
    /* ignore */
  }
}

export function unlockAudio() {
  const c = buildGraph();
  if (!c) return;
  if (unlocked && c.state === 'running') return;
  kickSilent();
  const finish = () => {
    const first = !unlocked;
    unlocked = true;
    if (first) {
      tone(392, 0.07, 'square', 0.28, sfxGain);
      tone(523, 0.09, 'square', 0.26, sfxGain);
    }
  };
  if (c.state === 'suspended') {
    c.resume().then(finish).catch(finish);
  } else {
    finish();
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.75;
  if (htmlKick) htmlKick.muted = muted;
  if (muted) silenceMusic();
  saveMuted(muted);
  syncMuteButton();
  return muted;
}

export function isMuted() {
  return muted;
}

export function syncMuteButton() {
  const btn = document.getElementById('mute-btn');
  if (btn) {
    btn.classList.toggle('is-muted', muted);
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    btn.textContent = muted ? 'UNMUTE' : 'MUTE';
  }
  document.querySelectorAll('[data-ui-sound-label]').forEach((n) => {
    if (n.classList.contains('pqt-row')) n.innerHTML = `<span>Sound</span><b>${muted ? 'Off' : 'On'}</b>`;
    else n.textContent = muted ? 'Sound: Off' : 'Sound: On';
  });
  document.querySelectorAll('[data-ui-sound-icon]').forEach((n) => {
    n.classList.toggle('is-muted', muted);
    n.setAttribute('aria-pressed', muted ? 'true' : 'false');
    n.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  });
}

export function bindMuteButton() {
  const btn = document.getElementById('mute-btn');
  if (!btn) return;
  const go = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!unlocked) unlockAudio();
    toggleMute();
  };
  btn.addEventListener('pointerdown', go);
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  syncMuteButton();
}

function tone(freq, dur, type, vol, dest, slide) {
  if (!unlocked || !actx || muted || !freq) return;
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
  if (!unlocked || !actx || muted) return;
  const t = actx.currentTime;
  const len = Math.max(1, Math.floor(actx.sampleRate * dur));
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
  if (!unlocked || muted || !sfxGain) return;
  const d = sfxGain;
  switch (name) {
    case 'jump':
      tone(220, 0.12, 'square', 0.28, d, 420);
      break;
    case 'land':
      tone(90, 0.08, 'triangle', 0.22, d, 60);
      noise(0.06, 0.16, d, 400);
      break;
    case 'throw':
      tone(520, 0.08, 'square', 0.22, d, 180);
      noise(0.05, 0.14, d, 2000);
      break;
    case 'swing':
      noise(0.07, 0.22, d, 700);
      tone(160, 0.08, 'square', 0.2, d, 90);
      break;
    case 'hit':
      noise(0.12, 0.42, d, 700);
      noise(0.06, 0.28, d, 1600);
      tone(160, 0.09, 'square', 0.26, d, 70);
      tone(90, 0.11, 'triangle', 0.22, d, 50);
      break;
    case 'yelp':
      tone(620, 0.07, 'square', 0.28, d, 380);
      tone(480, 0.12, 'square', 0.22, d, 180);
      noise(0.08, 0.2, d, 1400);
      break;
    case 'rattle':
      noise(0.32, 0.1, d, 5200);
      break;
    case 'huff':
      noise(0.22, 0.24, d, 260);
      tone(80, 0.2, 'triangle', 0.18, d, 55);
      break;
    case 'caw':
      tone(760, 0.09, 'sawtooth', 0.1, d, 520);
      break;
    case 'hoot':
      tone(380, 0.16, 'sine', 0.16, d, 320);
      break;
    case 'step':
      noise(0.03, 0.05, d, 300);
      break;
    case 'hurt':
      tone(320, 0.18, 'square', 0.28, d, 90);
      break;
    case 'heal':
      tone(392, 0.08, 'square', 0.2, d);
      setTimeout(() => tone(523, 0.1, 'square', 0.2, d), 70);
      setTimeout(() => tone(659, 0.14, 'square', 0.2, d), 140);
      break;
    case 'die':
      tone(196, 0.22, 'square', 0.24, d, 80);
      setTimeout(() => tone(130, 0.35, 'square', 0.22, d, 50), 180);
      break;
    case 'start':
      tone(262, 0.08, 'square', 0.24, d);
      setTimeout(() => tone(330, 0.08, 'square', 0.24, d), 80);
      setTimeout(() => tone(392, 0.08, 'square', 0.24, d), 160);
      setTimeout(() => tone(523, 0.16, 'square', 0.26, d), 240);
      break;
    case 'clear':
      tone(392, 0.1, 'square', 0.22, d);
      setTimeout(() => tone(494, 0.1, 'square', 0.22, d), 90);
      setTimeout(() => tone(587, 0.2, 'square', 0.24, d), 180);
      break;
    case 'win':
      tone(392, 0.12, 'square', 0.22, d);
      setTimeout(() => tone(523, 0.12, 'square', 0.22, d), 110);
      setTimeout(() => tone(659, 0.12, 'square', 0.22, d), 220);
      setTimeout(() => tone(784, 0.28, 'square', 0.26, d), 330);
      break;
    case 'tell':
      // Two rising warning beeps: an attack is coming
      tone(660, 0.07, 'square', 0.2, d);
      setTimeout(() => tone(880, 0.09, 'square', 0.2, d), 90);
      break;
    case 'roar':
      tone(140, 0.5, 'sawtooth', 0.22, d, 60);
      noise(0.45, 0.25, d, 300);
      break;
    case 'dash':
      noise(0.18, 0.24, d, 1800);
      tone(300, 0.15, 'square', 0.14, d, 120);
      break;
    case 'slam':
      tone(80, 0.25, 'triangle', 0.35, d, 40);
      noise(0.25, 0.35, d, 250);
      break;
    case 'whistle':
      tone(1200, 0.12, 'square', 0.14, d, 1500);
      setTimeout(() => tone(1500, 0.16, 'square', 0.14, d, 1100), 140);
      break;
    case 'rumble':
      noise(0.6, 0.22, d, 180);
      tone(70, 0.5, 'triangle', 0.2, d, 55);
      break;
    case 'wind':
      noise(0.9, 0.12, d, 900);
      break;
    case 'gust':
      noise(1.4, 0.26, d, 600);
      break;
    case 'splash':
      noise(0.3, 0.25, d, 1400);
      tone(240, 0.12, 'triangle', 0.16, d, 90);
      break;
    case 'checkpoint':
      tone(523, 0.1, 'triangle', 0.3, d);
      setTimeout(() => tone(659, 0.1, 'triangle', 0.3, d), 100);
      setTimeout(() => tone(784, 0.1, 'triangle', 0.3, d), 200);
      setTimeout(() => tone(1047, 0.22, 'triangle', 0.3, d), 300);
      break;
    case 'creak':
      // old wood groaning: a slow wobbling low saw
      tone(150, 0.32, 'sawtooth', 0.12, d, 105);
      setTimeout(() => tone(125, 0.26, 'sawtooth', 0.1, d, 95), 160);
      noise(0.2, 0.08, d, 500);
      break;
    case 'knock':
      tone(110, 0.09, 'triangle', 0.4, d, 60);
      noise(0.08, 0.3, d, 320);
      break;
    case 'page':
      tone(784, 0.07, 'triangle', 0.24, d);
      setTimeout(() => tone(988, 0.07, 'triangle', 0.24, d), 70);
      setTimeout(() => tone(1319, 0.16, 'triangle', 0.22, d), 140);
      noise(0.1, 0.08, d, 3000);
      break;
    case 'star':
      tone(880, 0.1, 'triangle', 0.26, d, 1320);
      break;
    case 'select':
      tone(660, 0.05, 'square', 0.14, d);
      break;
    default:
      break;
  }
}


// ── Music sequencer (look-ahead scheduling on the audio clock) ─────────────
let seq = null; // { trk, voices: [{ part, i, t }] }
let musicPaused = false;
const liveNodes = new Set();

function silenceMusic() {
  for (const o of liveNodes) {
    try {
      o.stop();
    } catch (_) {
      /* already stopped */
    }
  }
  liveNodes.clear();
}

function playNote(freq, when, dur, type, vol) {
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, when);
  const a = 0.008;
  const end = when + Math.max(0.05, dur);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vol, when + a);
  g.gain.exponentialRampToValueAtTime(vol * 0.6, when + a + Math.min(0.12, dur * 0.4));
  g.gain.setValueAtTime(vol * 0.6, Math.max(when + a + 0.01, end - 0.04));
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  o.connect(g);
  g.connect(musicGain);
  o.start(when);
  o.stop(end + 0.02);
  liveNodes.add(o);
  o.onended = () => liveNodes.delete(o);
}

function startTrack(trk) {
  silenceMusic();
  const t0 = actx ? actx.currentTime + 0.06 : 0;
  seq = {
    trk,
    voices: [
      { part: 'lead', i: 0, t: t0 },
      { part: 'bass', i: 0, t: t0 },
    ],
  };
}

function scheduleMusic() {
  if (!seq || !actx) return;
  const now = actx.currentTime;
  const trk = seq.trk;
  const spb = 60 / trk.bpm;
  // After a pause / hidden tab / mute, slide the timeline forward instead of bursting
  const lag = now + 0.05 - Math.min(seq.voices[0].t, seq.voices[1].t);
  if (lag > 0.3) for (const v of seq.voices) v.t += lag;
  const ahead = now + 0.25;
  for (const v of seq.voices) {
    const notes = trk[v.part];
    if (!notes.length) continue;
    let guard = 0;
    while (v.t < ahead && guard++ < 64) {
      const [m, b, gate] = notes[v.i];
      const dur = b * spb;
      if (m) {
        const lead = v.part === 'lead';
        playNote(
          mtof(m),
          v.t,
          dur * gate,
          lead ? trk.leadWave : trk.bassWave,
          lead ? trk.leadVol : trk.bassVol
        );
      }
      v.t += dur;
      v.i = (v.i + 1) % notes.length;
    }
  }
}

export function tickMusic() {
  if (!unlocked || !actx || muted || musicPaused || !seq) return;
  if (actx.state !== 'running') return;
  scheduleMusic();
}

export function setMusic(id) {
  const trk = TRACKS[id] || null;
  musicPaused = false;
  if (!trk) {
    stopMusic();
    return;
  }
  if (seq && seq.trk === trk) return;
  startTrack(trk);
}

export function pauseMusic() {
  if (musicPaused) return;
  musicPaused = true;
  silenceMusic();
}

export function stopMusic() {
  silenceMusic();
  seq = null;
}

/** Which track fits the current moment of play. */
export function trackFor(game) {
  const st = game.state;
  if (st === STATES.WIN) return 'credits';
  if (st === STATES.TITLE || st === STATES.CLEAR || st === STATES.CHAPTERS) return 'title';
  if (st === STATES.LOSE) return null;
  const n = game.levelNum || 1;
  if (game.martyrEnding) return 'carthage';
  // Chapter 1: the hymn turns low and slow as Joseph kneels in the grove
  const camp = game.level?.camp?.state;
  if (n === 1 && (camp === 'kneel' || camp === 'light' || camp === 'done')) return 'prayer';
  if (game.bossIntro && st !== STATES.INTRO && n >= 4 && n <= 6) return 'boss';
  return CHAPTER_TRACK[n] || 'title';
}

export function syncAudio(game) {
  if (!unlocked) return;
  const st = game.state;
  if (st !== lastState) {
    if ((st === STATES.INTRO || st === STATES.PLAYING) && (lastState === STATES.TITLE || lastState === STATES.CHAPTERS)) sfx('start');
    if (st === STATES.CLEAR) sfx('clear');
    if (st === STATES.WIN) sfx('win');
    if (st === STATES.LOSE) sfx('die');
    lastState = st;
  }
  if (st === STATES.PAUSED) {
    pauseMusic();
    return;
  }
  const id = trackFor(game);
  if (!id) {
    stopMusic();
    return;
  }
  setMusic(id);
}
