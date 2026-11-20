import { describe, expect, it } from 'vitest';
import { codexDays, codexEntries, searchCodex } from '../../src/core/codex';
import { formatEuro } from '../../src/core/format';
import { newGame } from '../../src/core/game';
import { clearSave, hasSave, loadGame, SAVE_KEY, saveGame } from '../../src/core/save';
import { MemoryStore, realContent } from './helpers';

const content = realContent();

describe('Kodex', () => {
  it('gesperrte Regeln tragen keinen Inhalt', () => {
    const entries = codexEntries(content, 1);
    const locked = entries.filter((e) => e.locked);
    expect(locked.map((e) => e.id)).toEqual(['R3', 'R4', 'R5', 'R6', 'R7']);
    for (const e of locked) {
      expect(Object.keys(e).sort()).toEqual(['day', 'id', 'locked']);
    }
  });

  it('markiert Regeln des aktuellen Tages als neu', () => {
    const entries = codexEntries(content, 2);
    const isNew = entries.filter((e) => !e.locked && e.isNew).map((e) => e.id);
    expect(isNew).toEqual(['R3', 'R4', 'R5']);
  });

  it('Suche findet nur freigeschaltete Regeln, ohne Groß/Klein und Umlaut-Probleme', () => {
    expect(searchCodex(content, 1, 'kleidung').map((r) => r.id)).toEqual(['R2']);
    expect(searchCodex(content, 2, 'KLEIDUNG').map((r) => r.id)).toEqual(['R2', 'R4']);
    expect(searchCodex(content, 3, 'ergänzung').map((r) => r.id)).toEqual(['R7']);
    expect(searchCodex(content, 3, 'erganzung').map((r) => r.id)).toEqual(['R7']);
    expect(searchCodex(content, 1, 'wohnsitz')).toEqual([]);
    expect(searchCodex(content, 2, '')).toHaveLength(5);
  });

  it('Lesezeichen nach Tagen', () => {
    expect(codexDays(content)).toEqual([1, 2, 3]);
  });
});

describe('formatEuro', () => {
  it.each([
    [1200, '1.200,00 €'],
    [89, '89,00 €'],
    [0.5, '0,50 €'],
    [1234567.891, '1.234.567,89 €'],
  ])('%d → %s', (n, s) => expect(formatEuro(n)).toBe(s));
});

describe('Speichern', () => {
  it('speichert und lädt', () => {
    const store = new MemoryStore();
    const s = newGame(content);
    expect(hasSave(store)).toBe(false);
    expect(saveGame(store, s)).toBe(true);
    expect(loadGame(store)).toEqual(s);
    clearSave(store);
    expect(hasSave(store)).toBe(false);
  });

  it('kaputter Spielstand ergibt null', () => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEY, '{kaputt');
    expect(loadGame(store)).toBeNull();
    store.setItem(SAVE_KEY, JSON.stringify({ version: 99 }));
    expect(loadGame(store)).toBeNull();
  });

  it('werfender Speicher wird abgefangen', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(saveGame(throwing, newGame(content))).toBe(false);
    expect(loadGame(throwing)).toBeNull();
    expect(() => clearSave(throwing)).not.toThrow();
    expect(saveGame(null, newGame(content))).toBe(false);
  });
});
