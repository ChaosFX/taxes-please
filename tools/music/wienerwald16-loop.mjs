// Hörprobe 3: „G'schichten aus dem Wienerwald“ (J. Strauß II, op. 325, gemeinfrei),
// Walzer Nr. 1, als 16-Bit-Videospiel-Arrangement (SNES-Klangästhetik), komplett synthetisch.
// Melodie aus dem gemeinfreien Klavierauszug (cantorion.org), einzelne Takte ergänzt.
// node wienerwald16-loop.mjs out.wav  → nahtlose Schleife (48 Takte)
import { writeFileSync } from 'node:fs';

const SR = 32000; // SNES-typische Abtastrate
const TAU = 2 * Math.PI;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
let seed = 3;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const BPM = 156;
const BEAT = 60 / BPM;
const BAR = 3 * BEAT;

// ---------- Harmonie ----------
const CH = {
  F: { bass: [41, 36], oom: [57, 60, 65], pad: [53, 57, 60] },
  C7: { bass: [36, 43], oom: [58, 60, 64], pad: [52, 55, 58] },
  Bb: { bass: [34, 41], oom: [58, 62, 65], pad: [50, 53, 58] },
  Gm: { bass: [43, 38], oom: [58, 62, 67], pad: [50, 55, 58] },
  A7: { bass: [45, 40], oom: [55, 61, 64], pad: [52, 55, 61] },
};

// Melodie in Achteln: [midi|null, achtel, vorschlag?]
const P1 = [
  ['F', [[81, 4], [81, 1], [80, 1]]],
  ['F', [[81, 4], [81, 1], [80, 1]]],
  ['F', [[81, 2], [null, 2], [84, 2, 81]]],
  ['C7', [[84, 4], [84, 1], [82, 1]]],
  ['F', [[82, 4], [82, 1], [81, 1]]],
  ['F', [[81, 4], [81, 1], [80, 1]]],
  ['Bb', [[81, 2, 80], [null, 2], [79, 2]]],
  ['Gm', [[79, 4], [79, 1], [78, 1]]],
  ['C7', [[81, 4], [81, 1], [79, 1]]],
  ['C7', [[79, 4], [79, 1], [77, 1]]],
  ['C7', [[77, 2, 79], [null, 2], [76, 2]]],
  ['A7', [[76, 4], [76, 1], [73, 1]]],
  ['C7', [[76, 4], [76, 1], [74, 1]]],
  ['C7', [[72, 4], [74, 1], [72, 1]]],
  ['C7', [[68, 2], [null, 2], [69, 2]]],
  ['F', [[69, 2], [null, 3], [80, 1]]],
];
const P2 = [
  ['F', [[81, 4], [81, 1], [80, 1]]],
  ['F', [[81, 4], [81, 1], [80, 1]]],
  ['F', [[81, 2], [null, 2], [86, 2, 81]]],
  ['Bb', [[86, 4], [86, 1], [84, 1]]],
  ['C7', [[84, 4], [84, 1], [82, 1]]],
  ['F', [[82, 4], [82, 1], [81, 1]]],
  ['C7', [[81, 2, 82], [null, 2], [79, 2]]],
  ['F', [[77, 2], [null, 3], [80, 1]]],
];
const THEME = [...P1, ...P2];
const INTRO = [['F', []], ['F', []]];
// Schleife: Thema mit Akkordeon, dann mit Spieluhr. Dreimal gerendert, die mittlere
// Wiederholung wird herausgeschnitten, damit Nachklang und Echo nahtlos umlaufen.
const LOOP = [...THEME.map((b) => [...b, 1]), ...THEME.map((b) => [...b, 2])];
const song = [...LOOP, ...LOOP, ...LOOP];
void INTRO;

const END = song.length * BAR + 0.25;
const N = Math.ceil((END + 4) * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
function mix(start, buf, pan, gain) {
  const i0 = Math.floor((start + 0.25) * SR);
  const gl = Math.cos(((pan + 1) * Math.PI) / 4) * gain;
  const gr = Math.sin(((pan + 1) * Math.PI) / 4) * gain;
  for (let i = 0; i < buf.length && i0 + i < N; i++) {
    if (i0 + i < 0) continue;
    L[i0 + i] += buf[i] * gl;
    R[i0 + i] += buf[i] * gr;
  }
}
function render(dur, fn) {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i);
  return out;
}

// ---------- Instrumente (Sample-artig, wie auf dem SNES) ----------
// Lead: Akkordeon/Flöten-Mischung, rechteckig-weich, mit verzögertem Vibrato.
function lead(m, len, from) {
  const f = hz(m);
  const f0 = from ? hz(from) : f;
  let ph = 0;
  return render(len + 0.25, (t) => {
    const slide = from && t < 0.05 ? f0 * (f / f0) ** (t / 0.05) : f;
    const vib = 1 + Math.min(1, Math.max(0, (t - 0.2) / 0.25)) * 0.007 * Math.sin(TAU * 6 * t);
    ph += (TAU * slide * vib) / SR;
    // Weiche Pulswelle: Grundton + ungerade Obertöne, leicht gedämpft.
    const s = Math.sin(ph) + 0.33 * Math.sin(3 * ph) + 0.16 * Math.sin(5 * ph) + 0.25 * Math.sin(2 * ph) + 0.08 * Math.sin(7 * ph);
    const env = Math.min(1, t / 0.015) * (0.85 + 0.15 * Math.exp(-t / 0.1)) * (t > len ? Math.exp(-(t - len) / 0.05) : 1);
    return s * env;
  });
}
// Glocke/Spieluhr für den zweiten Durchgang.
function bell(m, len) {
  const f = hz(m);
  return render(len + 1.2, (t) => {
    const e = Math.min(1, t / 0.003);
    return e * (Math.sin(TAU * f * t) * Math.exp(-t / 0.7) + 0.4 * Math.sin(TAU * f * 4.01 * t) * Math.exp(-t / 0.15) + 0.2 * Math.sin(TAU * f * 2 * t) * Math.exp(-t / 0.3));
  });
}
// Zupfbass (Pizzicato-artig).
function bass(m) {
  const f = hz(m);
  return render(BAR * 0.9, (t) => {
    const e = Math.min(1, t / 0.004) * Math.exp(-t / 0.35);
    return e * (Math.sin(TAU * f * t) + 0.45 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / 0.12) + 0.2 * Math.sin(TAU * 3 * f * t) * Math.exp(-t / 0.06));
  });
}
// „Zither“-Akkord auf 2 und 3: Karplus-Strong, hell und kurz.
function pluck(m, len) {
  const f = hz(m);
  const p = Math.max(2, Math.round(SR / f));
  const line = Float32Array.from({ length: p }, () => rnd() * 2 - 1);
  const n = Math.floor((len + 0.1) * SR);
  const out = new Float32Array(n);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const a = line[idx];
    line[idx] = 0.5 * (a + line[(idx + 1) % p]) * (i < len * SR ? 0.995 : 0.9);
    out[i] = a;
    idx = (idx + 1) % p;
  }
  return out;
}
// Streicher-Pad: verstimmte Sägezähne, langsam ein- und ausblendend.
function pad(m, len) {
  const f = hz(m);
  const ph = [0, 0, 0];
  const det = [1, 1.004, 0.996];
  return render(len + 0.4, (t) => {
    let s = 0;
    for (let k = 0; k < 3; k++) {
      ph[k] += (f * det[k]) / SR;
      const x = ph[k] % 1;
      s += 2 * x - 1;
    }
    const env = Math.min(1, t / 0.35) * (t > len ? Math.exp(-(t - len) / 0.15) : 1);
    return (s / 3) * env;
  });
}
// Leises Schlagwerk: Kick auf 1, Shaker auf 2 und 3.
const kick = render(0.18, (t) => Math.sin(TAU * (50 + 90 * Math.exp(-t / 0.03)) * t) * Math.exp(-t / 0.08));
const shaker = render(0.06, (t) => (rnd() * 2 - 1) * Math.exp(-t / 0.015));

// ---------- Satz ----------
let prevNote = null;
song.forEach(([name, melody, pass], bar) => {
  const ch = CH[name];
  const t0 = bar * BAR;

  mix(t0, bass(ch.bass[bar % 2]), 0, 0.42);
  mix(t0, kick, 0, 0.25);
  for (const beat of [1, 2]) {
    const ts = t0 + beat * BEAT - (beat === 1 ? 0.025 : 0); // Wiener „zu frühe“ Zwei
    ch.oom.forEach((n, i) => mix(ts + i * 0.006, pluck(n + 12, BEAT * 0.35), 0.25 - i * 0.2, 0.09));
    mix(ts, shaker, 0.4, 0.06);
  }
  if (pass === 2) ch.pad.forEach((n) => mix(t0, pad(n, BAR), -0.1, 0.05));

  let tm = t0;
  for (const [m, eighths, grace] of melody) {
    const len = (eighths * BEAT) / 2;
    if (m !== null) {
      if (pass === 1) {
        if (grace) mix(tm - 0.05, lead(grace, 0.04), -0.15, 0.2);
        const legato = prevNote !== null && Math.abs(m - prevNote) <= 2;
        mix(tm, lead(m, len * 0.92, legato ? prevNote : grace ?? null), -0.15, 0.2);
      } else {
        if (grace) mix(tm - 0.05, bell(grace + 12, 0.04), 0.2, 0.05);
        mix(tm, bell(m + 12, len), 0.2, 0.15);
        mix(tm, lead(m - 12, len * 0.92, null), -0.2, 0.1);
      }
    }
    prevNote = m;
    tm += len;
  }
});
// ---------- SNES-Echo (Delay mit Tiefpass im Feedback) ----------
function echo(x, ms, fb, wet) {
  const d = Math.floor((ms / 1000) * SR);
  const buf = new Float32Array(d);
  const y = new Float32Array(x.length);
  let i = 0, lp = 0;
  for (let n = 0; n < x.length; n++) {
    const o = buf[i];
    lp = lp * 0.6 + o * 0.4;
    buf[i] = x[n] + lp * fb;
    i = (i + 1) % d;
    y[n] = x[n] + o * wet;
  }
  return y;
}
const eL = echo(L, 240, 0.4, 0.3);
const eR = echo(R, 256, 0.4, 0.3);

// Leichte „Gauß-Interpolation“: sanfter Tiefpass wie beim SNES-DSP.
function soften(x) {
  const y = new Float32Array(x.length);
  for (let n = 2; n < x.length; n++) y[n] = 0.15 * x[n - 2] + 0.35 * x[n - 1] + 0.5 * x[n];
  return y;
}
const oL = soften(eL);
const oR = soften(eR);

const LOOP_LEN = Math.round(LOOP.length * BAR * SR);
const from = Math.floor(0.25 * SR) + LOOP_LEN;
const xL = oL.slice(from, from + LOOP_LEN);
const xR = oR.slice(from, from + LOOP_LEN);
console.log(`Schleife: ${LOOP_LEN} Samples = ${(LOOP_LEN / SR).toFixed(6)} s`);
let peak = 0;
for (let i = 0; i < LOOP_LEN; i++) peak = Math.max(peak, Math.abs(xL[i]), Math.abs(xR[i]));
const g = 0.8 / peak;
const data = Buffer.alloc(LOOP_LEN * 4);
for (let i = 0; i < LOOP_LEN; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, xL[i] * g)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, xR[i] * g)) * 32767), i * 4 + 2);
}
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
h.write('data', 36); h.writeUInt32LE(data.length, 40);
writeFileSync(process.argv[2] ?? 'wienerwald16.wav', Buffer.concat([h, data]));

