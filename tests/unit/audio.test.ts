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

describe('Einstellungen und alte Spielstände (SPEC 9)', () => {
  const full = { effects: 'reduziert', volume: 0.3, music: 0.2 } as const;

  it('fehlende oder ungültige Felder bekommen einzeln den Standardwert', async () => {
    const { withDefaults } = await import('../../src/ui/settings');
    const { DEFAULT_SETTINGS } = await import('../../src/core');
    for (const field of ['effects', 'volume', 'music'] as const) {
      const { [field]: _omit, ...rest } = full;
      expect(withDefaults(rest), `ohne ${field}`).toEqual({ ...full, [field]: DEFAULT_SETTINGS[field] });
      expect(withDefaults({ ...full, [field]: 'kaputt' as never }), `${field} ungültig`).toEqual({ ...full, [field]: DEFAULT_SETTINGS[field] });
    }
    expect(DEFAULT_SETTINGS.music).toBe(0.5);
    expect(withDefaults({ ...full, music: 0 })?.music).toBe(0);
    expect(withDefaults({ ...full, volume: 2 })?.volume).toBe(DEFAULT_SETTINGS.volume);
    expect(withDefaults(null)).toBeNull();
  });

  it('ein Spielstand ohne einzelne Einstellungsfelder lädt, der Rest bleibt unverändert', async () => {
    const { loadSavedGame } = await import('../../src/ui/settings');
    const core = await import('../../src/core');
    const { MemoryStore, realContent } = await import('./helpers');
    // A game in progress: day 1, first Akte drawn, decided and stamped (an Akte without
    // stamp goes back to the inbox on loading, SPEC 9).
    const content = realContent();
    let state = core.beginWork(core.finishPrologue(content, core.newGame(content, { ...full })));
    state = core.drawNext(state);
    state = core.decidePosition(state, 'p1', 'anerkennen');
    state = core.applyStamp(content, state, 'bescheid');
    expect(state.current?.answer.stamp).toBe('bescheid');

    for (const field of ['music', 'effects', 'volume'] as const) {
      const store = new MemoryStore();
      const { [field]: _omit, ...oldSettings } = full;
      store.setItem(core.SAVE_KEY, JSON.stringify({ ...state, settings: oldSettings }));
      const loaded = loadSavedGame(store, content);
      expect(loaded, `ohne ${field}`).not.toBeNull();
      expect(loaded!.settings[field]).toBe(core.DEFAULT_SETTINGS[field]);
      const { settings: s1, ...rest1 } = loaded!;
      const { settings: s0, ...rest0 } = state;
      expect(rest1).toEqual(rest0);
      expect({ ...s1, [field]: full[field] }).toEqual(s0);
    }
  });
});
