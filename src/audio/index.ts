/**
 * Sound effects and office ambience (SPEC 7, optional).
 *
 * Files live in `public/audio/` (CC0, sources in `public/audio/QUELLEN.md`).
 * Short effects play through Web Audio (low latency, may overlap); the long
 * ambience loop streams through an <audio> element so it is not decoded into
 * memory as a whole. Everything fails silently: the game never depends on sound.
 */

export type SoundName = 'stamp' | 'paper' | 'file';

export const SOUND_FILES: Record<SoundName, readonly string[]> = {
  stamp: ['stempel-1.mp3', 'stempel-2.mp3', 'stempel-3.mp3'],
  paper: ['papier-1.mp3', 'papier-2.mp3'],
  file: ['ablage.mp3'],
};
export const AMBIENT_FILE = 'buero.mp3';

/** Ambience sits under the effects. */
const AMBIENT_LEVEL = 0.5;
const EFFECT_LEVEL: Record<SoundName, number> = { stamp: 1, paper: 0.6, file: 0.7 };
/** Paper rustle is not repeated faster than this (ms). */
const PAPER_COOLDOWN = 250;

/** Slider position 0..1 to gain; squared so the slider feels even to the ear. */
export function gainFor(volume: number): number {
  const v = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0));
  return v * v;
}

/** Picks a variant index, never the same one twice in a row when there is a choice. */
export function nextVariant(count: number, last: number, random: () => number = Math.random): number {
  if (count <= 1) return 0;
  const i = Math.floor(random() * (count - 1));
  return i >= last && last >= 0 ? i + 1 : i;
}

export interface Sound {
  /** Call from a user gesture; browsers only allow audio after one. Starts the ambience. */
  unlock(): void;
  setVolume(volume: number): void;
  play(name: SoundName): void;
}

export function createSound(volume: number, base = `${import.meta.env.BASE_URL}audio/`): Sound {
  let gain = gainFor(volume);
  let unlocked = false;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  const buffers = new Map<string, Promise<AudioBuffer | null>>();
  const last: Record<SoundName, number> = { stamp: -1, paper: -1, file: -1 };
  let lastPaper = -Infinity;
  let ambient: HTMLAudioElement | null = null;

  const context = (): AudioContext | null => {
    if (ctx) return ctx;
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = gain;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  };

  const load = (file: string): Promise<AudioBuffer | null> => {
    let p = buffers.get(file);
    if (!p) {
      const c = context();
      p = c
        ? fetch(base + file)
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${file}: ${r.status}`))))
            .then((data) => c.decodeAudioData(data))
            .catch(() => null)
        : Promise.resolve(null);
      buffers.set(file, p);
    }
    return p;
  };

  const syncAmbient = () => {
    if (!unlocked) return;
    if (!ambient) {
      try {
        ambient = new Audio(base + AMBIENT_FILE);
        ambient.loop = true;
        ambient.preload = 'auto';
      } catch {
        return;
      }
    }
    ambient.volume = gain * AMBIENT_LEVEL;
    if (gain > 0 && document.visibilityState !== 'hidden') ambient.play().catch(() => undefined);
    else ambient.pause();
  };

  document.addEventListener('visibilitychange', syncAmbient);

  return {
    unlock() {
      if (unlocked) return;
      unlocked = true;
      const c = context();
      c?.resume().catch(() => undefined);
      Object.values(SOUND_FILES).flat().forEach((f) => void load(f));
      syncAmbient();
    },
    setVolume(v) {
      gain = gainFor(v);
      if (master) master.gain.value = gain;
      syncAmbient();
    },
    play(name) {
      if (!unlocked || gain === 0) return;
      if (name === 'paper') {
        const now = performance.now();
        if (now - lastPaper < PAPER_COOLDOWN) return;
        lastPaper = now;
      }
      const files = SOUND_FILES[name];
      const i = nextVariant(files.length, last[name]);
      last[name] = i;
      const c = context();
      void load(files[i]!).then((buf) => {
        if (!buf || !c || !master) return;
        try {
          const src = c.createBufferSource();
          src.buffer = buf;
          const g = c.createGain();
          g.gain.value = EFFECT_LEVEL[name];
          src.connect(g).connect(master);
          src.start();
        } catch {
          /* no sound */
        }
      });
    },
  };
}
