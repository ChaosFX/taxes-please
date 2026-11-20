import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AMBIENT_FILE, MUSIC_FILE, SOUND_FILES, gainFor, nextVariant } from '../../src/audio';

describe('audio', () => {
  it('Lautstärke wird begrenzt und quadratisch abgebildet', () => {
    expect(gainFor(0)).toBe(0);
    expect(gainFor(1)).toBe(1);
    expect(gainFor(0.5)).toBe(0.25);
    expect(gainFor(-1)).toBe(0);
    expect(gainFor(3)).toBe(1);
    expect(gainFor(Number.NaN)).toBe(0);
  });

  it('dieselbe Variante kommt nie zweimal hintereinander', () => {
    for (let last = 0; last < 3; last++) {
      for (const r of [0, 0.4, 0.99]) {
        const i = nextVariant(3, last, () => r);
        expect(i).not.toBe(last);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(3);
      }
    }
    expect(nextVariant(1, 0)).toBe(0);
    expect(nextVariant(3, -1, () => 0.99)).toBe(1);
  });

  it('alle Audiodateien liegen in public/audio', () => {
    const dir = join(__dirname, '..', '..', 'public', 'audio');
    for (const f of [...Object.values(SOUND_FILES).flat(), AMBIENT_FILE, MUSIC_FILE]) {
      expect(existsSync(join(dir, f)), f).toBe(true);
    }
  });
});

describe('Einstellungen mit Musik', () => {
  it('alte Spielstände ohne `music` bekommen den Standardwert', async () => {
    const { withDefaults } = await import('../../src/ui/settings');
    expect(withDefaults({ effects: 'reduziert', volume: 0.3 })).toEqual({ effects: 'reduziert', volume: 0.3, music: 0.5 });
    expect(withDefaults({ effects: 'voll', volume: 1, music: 0 })?.music).toBe(0);
    expect(withDefaults(null)).toBeNull();
    expect(withDefaults({ effects: 'kaputt' as never, volume: 1 })).toBeNull();
  });
});
