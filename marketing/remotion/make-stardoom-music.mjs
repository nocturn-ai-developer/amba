// Synthesises the three 30-second Stardoom AI music beds (no samples, no licences) into public/sfx:
//   stardoom-intro.wav  100 BPM, A minor, cinematic: pad → riser → drop at 7.5 s
//   stardoom-web.wav    118 BPM, D minor, driving: drums from 3 s
//   stardoom-app.wav    110 BPM, E minor, glassy: drums from 3 s
// plus impact.wav (a low boom for reveals).  Usage: node make-stardoom-music.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const SR = 44100;
const OUT = "public/sfx";
mkdirSync(OUT, { recursive: true });

let seed = 7654321;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const lp = (fc) => 1 - Math.exp((-2 * Math.PI * fc) / SR);

function wav(name, channels, peak = 0.9) {
  const n = channels[0].length;
  let max = 0;
  for (const ch of channels) for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(ch[i]));
  const gain = max > 0 ? peak / max : 1;
  const buf = Buffer.alloc(44 + n * channels.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * channels.length * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels.length, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * channels.length * 2, 28);
  buf.writeUInt16LE(channels.length * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * channels.length * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++)
    for (const ch of channels) {
      buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, ch[i] * gain)) * 32767), o);
      o += 2;
    }
  writeFileSync(`${OUT}/${name}.wav`, buf);
  console.log(`${name}.wav  ${(n / SR).toFixed(2)}s`);
}

/**
 * One track. Sections: pad from 0, arpeggio from tArp, a filtered-noise riser into tDrums,
 * then bass + kick + hats (+ clap from tClap), everything out by `length`.
 */
function track(name, { bpm, chords, tArp, tDrums, tClap, length = 30, arpOct = 12, bright = 1 }) {
  const BEAT = 60 / bpm;
  const BAR = BEAT * 4;
  const tOut = length - 2.2;
  const N = Math.round(length * SR);
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  const add = (i, l, r = l) => {
    if (i >= 0 && i < N) {
      L[i] += l;
      R[i] += r;
    }
  };
  const fadeIn = (t, at, d) => Math.max(0, Math.min(1, (t - at) / d));
  const master = (t) => Math.min(1, t / 1.2) * Math.max(0, Math.min(1, (length - t) / 2));

  const kicks = [];
  for (let t = tDrums; t < tOut; t += BEAT) kicks.push(t);
  const duckArr = new Float32Array(N).fill(1);
  for (const k of kicks)
    for (let s = 0; s < 0.5 * SR; s++) {
      const i = Math.round(k * SR) + s;
      if (i < N) duckArr[i] = Math.min(duckArr[i], 1 - 0.4 * Math.exp(-(s / SR) * 8));
    }
  const duck = (t) => duckArr[Math.min(N - 1, Math.round(t * SR))];

  // Pad: detuned saws through a slowly breathing low-pass.
  const bars = Math.ceil(length / BAR) + 1;
  for (let b = 0; b < bars; b++) {
    const chord = chords[b % chords.length];
    const start = b * BAR;
    const len = BAR + 0.6;
    chord.notes.forEach((note, v) => {
      [-1, 1].forEach((side) => {
        const f = midi(note) * 2 ** ((side * 8) / 1200);
        let phase = rand() * 0.5 + 0.5;
        let y1 = 0;
        let y2 = 0;
        for (let s = 0; s < len * SR; s++) {
          const t = start + s / SR;
          if (t >= length) break;
          const u = s / SR;
          phase = (phase + f / SR) % 1;
          const fc = (600 + 450 * Math.sin(2 * Math.PI * 0.08 * t + v)) * bright;
          y1 += lp(fc) * (2 * phase - 1 - y1);
          y2 += lp(fc) * (y1 - y2);
          const env = Math.min(1, u / 0.4) * (u > BAR ? Math.max(0, 1 - (u - BAR) / 0.6) : 1);
          const g = y2 * env * 0.075 * duck(t);
          add(Math.round(t * SR), side < 0 ? g : g * 0.5, side < 0 ? g * 0.5 : g);
        }
      });
    });
  }

  // Sub drone on the chord root, under everything.
  for (let b = 0; b < bars; b++) {
    const chord = chords[b % chords.length];
    const f = midi(chord.root - 12);
    for (let s = 0; s < BAR * SR; s++) {
      const t = b * BAR + s / SR;
      if (t >= length) break;
      const env = Math.min(1, (s / SR) / 0.3) * Math.min(1, (BAR - s / SR) / 0.3);
      add(Math.round(t * SR), Math.sin(2 * Math.PI * f * (s / SR)) * 0.05 * env * duck(t));
    }
  }

  // Arpeggio with ping-pong echo.
  for (let t = tArp, k = 0; t < tOut; t += BEAT / 4, k++) {
    const chord = chords[Math.floor(t / BAR) % chords.length];
    const pattern = [0, 2, 1, 3, 2, 4, 3, 1];
    const note = chord.notes[pattern[k % pattern.length] % chord.notes.length] + arpOct;
    const f = midi(note);
    const level = 0.1 * fadeIn(t, tArp, 2.5) * (k % 4 === 0 ? 1 : 0.65);
    for (let s = 0; s < 0.28 * SR; s++) {
      const u = s / SR;
      const x = (Math.sin(2 * Math.PI * f * u) + 0.3 * Math.sin(2 * Math.PI * f * 2 * u)) * Math.exp(-u * 15) * level;
      add(Math.round((t + u) * SR), x);
      add(Math.round((t + u + (BEAT * 3) / 4) * SR), x * 0.35, 0);
      add(Math.round((t + u + (BEAT * 3) / 2) * SR), 0, x * 0.18);
    }
  }

  // Riser into the drop: noise through an opening low-pass, plus a rising tone.
  {
    const rLen = Math.min(3, tDrums);
    let y = 0;
    for (let s = 0; s < rLen * SR; s++) {
      const u = s / SR;
      const p = u / rLen;
      const t = tDrums - rLen + u;
      y += lp(300 + 7000 * p * p) * (rand() - y);
      const tone = Math.sin(2 * Math.PI * (200 + 600 * p * p) * u) * 0.15;
      add(Math.round(t * SR), (y * 0.5 + tone) * p * p * 0.5);
    }
  }

  // Bass: 8th-note pulses on the root, a little saturated.
  for (let t = tDrums; t < tOut; t += BEAT / 2) {
    const chord = chords[Math.floor(t / BAR) % chords.length];
    const f = midi(chord.root);
    for (let s = 0; s < 0.26 * SR; s++) {
      const u = s / SR;
      const x = Math.tanh((Math.sin(2 * Math.PI * f * u) + 0.35 * Math.sin(2 * Math.PI * f * 2 * u)) * 1.6) * Math.min(1, u / 0.004) * Math.exp(-u * 8) * 0.2;
      add(Math.round((t + u) * SR), x);
    }
  }

  // Kick, hats, clap.
  for (const k of kicks) {
    let ph = 0;
    for (let s = 0; s < 0.38 * SR; s++) {
      const u = s / SR;
      ph += (42 + 90 * Math.exp(-u * 32)) / SR;
      add(Math.round((k + u) * SR), Math.sin(2 * Math.PI * ph) * Math.exp(-u * 8) * 0.55);
    }
  }
  for (let t = tDrums + BEAT / 2; t < tOut; t += BEAT / 2) {
    const off = Math.round((t - tDrums) / (BEAT / 2)) % 2 === 1;
    let y = 0;
    for (let s = 0; s < 0.045 * SR; s++) {
      const u = s / SR;
      const n = rand();
      y += lp(7500) * (n - y);
      const v = (n - y) * Math.exp(-u * 75) * (off ? 0.1 : 0.05);
      add(Math.round((t + u) * SR), v * 0.9, v * 1.1);
    }
  }
  for (let t = tClap + BEAT; t < tOut; t += BEAT * 2) {
    let y1 = 0;
    let y2 = 0;
    for (let s = 0; s < 0.22 * SR; s++) {
      const u = s / SR;
      const bursts = [0, 0.011, 0.022].reduce((a, o) => a + (u >= o ? Math.exp(-(u - o) * 38) : 0), 0);
      const n = rand();
      y1 += lp(2600) * (n - y1);
      y2 += lp(900) * (y1 - y2);
      add(Math.round((t + u) * SR), (y1 - y2) * bursts * 0.33);
    }
  }

  // Final hit: low boom + bell on the last downbeat.
  {
    const t0 = tOut;
    for (let s = 0; s < 2 * SR; s++) {
      const u = s / SR;
      const boom = Math.sin(2 * Math.PI * (38 + 40 * Math.exp(-u * 6)) * u) * Math.exp(-u * 2.2) * 0.6;
      const bell = (Math.sin(2 * Math.PI * midi(chords[0].notes[0] + 24) * u) + 0.3 * Math.sin(2 * Math.PI * midi(chords[0].notes[0] + 31) * u)) * Math.exp(-u * 2.5) * 0.12;
      add(Math.round((t0 + u) * SR), boom + bell);
    }
  }

  for (let i = 0; i < N; i++) {
    const g = master(i / SR);
    L[i] = Math.tanh(L[i] * 1.25) * g;
    R[i] = Math.tanh(R[i] * 1.25) * g;
  }
  wav(name, [L, R], 0.88);
}

const Am = { root: 45, notes: [57, 60, 64, 67] };
const F = { root: 41, notes: [53, 57, 60, 64] };
const C = { root: 36, notes: [55, 60, 64, 67] };
const G = { root: 43, notes: [55, 59, 62, 67] };
track("stardoom-intro", { bpm: 100, chords: [Am, F, C, G], tArp: 2.4, tDrums: 7.5, tClap: 12, bright: 0.9 });

const Dm = { root: 38, notes: [50, 53, 57, 60] };
const Bb = { root: 34, notes: [46, 50, 53, 57] };
const Fm = { root: 41, notes: [53, 57, 60, 65] };
const Cm = { root: 36, notes: [48, 52, 55, 60] };
track("stardoom-web", { bpm: 118, chords: [Dm, Bb, Fm, Cm], tArp: 0.6, tDrums: 3, tClap: 7, arpOct: 24, bright: 1.15 });

const Em = { root: 40, notes: [52, 55, 59, 62] };
const Cc = { root: 36, notes: [48, 52, 55, 59] };
const Gg = { root: 43, notes: [55, 59, 62, 66] };
const D = { root: 38, notes: [50, 54, 57, 62] };
track("stardoom-app", { bpm: 110, chords: [Em, Cc, Gg, D], tArp: 1.2, tDrums: 3, tClap: 9, arpOct: 24, bright: 1.05 });

// Impact: sub boom + noise burst for reveals.
{
  const len = 2.2;
  const a = new Float32Array(Math.round(len * SR));
  let y = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    y += lp(1800 * Math.exp(-t * 3) + 120) * (rand() - y);
    a[i] = Math.sin(2 * Math.PI * (36 + 70 * Math.exp(-t * 9)) * t) * Math.exp(-t * 1.8) + y * Math.exp(-t * 5) * 0.8;
  }
  wav("impact", [a], 0.9);
}
