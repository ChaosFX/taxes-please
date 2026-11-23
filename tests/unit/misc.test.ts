import { describe, expect, it } from 'vitest';
import { correctAnswer } from '../../src/core/evaluate';
import { formatEuro } from '../../src/core/format';
import { advanceDay, beginWork, drawNext, fileCurrent, applyStamp, decidePosition, newGame, toolsUntil, type GameState } from '../../src/core/game';
import { getAkte } from '../../src/core/loader';
import { clearSave, hasSave, loadGame, SAVE_KEY, saveGame } from '../../src/core/save';
import { MemoryStore, realContent } from './helpers';

const content = realContent();

describe('formatEuro', () => {
  it.each([
    [1200, '1.200,00 €'],
    [89, '89,00 €'],
    [0.5, '0,50 €'],
    [4236.7, '4.236,70 €'],
    [1234567.891, '1.234.567,89 €'],
  ])('%d → %s', (n, s) => expect(formatEuro(n)).toBe(s));
});

describe('Speichern', () => {
  it('speichert und lädt', () => {
    const store = new MemoryStore();
    const s = newGame(content);
    expect(hasSave(store)).toBe(false);
    expect(saveGame(store, s)).toBe(true);
    expect(loadGame(store, content)).toEqual(s);
    clearSave(store);
    expect(hasSave(store)).toBe(false);
  });

  it('Spielstand ohne Freischaltung „marking“ bekommt sie ab Tag 5 beim Laden', () => {
    const store = new MemoryStore();
    for (const [day, has] of [[3, false], [5, true], [6, true], [9, true]] as const) {
      const s = newGame(content);
      const old = { ...s, day, tools: toolsUntil(content, day).filter((x) => x !== 'marking') };
      saveGame(store, old);
      const loaded = loadGame(store, content)!;
      expect(loaded.tools.includes('marking')).toBe(has);
      expect(loaded.tools.slice(0, old.tools.length)).toEqual(old.tools);
    }
  });

  it('kaputter Spielstand ergibt null', () => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEY, '{kaputt');
    expect(loadGame(store, content)).toBeNull();
    store.setItem(SAVE_KEY, JSON.stringify({ version: 99 }));
    expect(loadGame(store, content)).toBeNull();
    expect(hasSave(store)).toBe(false);
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
    expect(loadGame(throwing, content)).toBeNull();
    expect(() => clearSave(throwing)).not.toThrow();
    expect(saveGame(null, newGame(content))).toBe(false);
  });
});

describe('Spielstände aus 0.2 (SPEC 9)', () => {
  /** Plays days 1 to 3 correctly, but with `stamp34` on Akte 3-4. */
  function throughDay3(stamp34: 'ergaenzung' | 'bescheid'): GameState {
    let s = newGame(content);
    for (let d = 1; d <= 3; d++) {
      s = beginWork(s);
      while (s.phase === 'desk') {
        s = drawNext(s);
        const a = correctAnswer(getAkte(content, s.current!.akteId));
        for (const [pid, v] of Object.entries(a.positions)) s = decidePosition(s, pid, v);
        if (a.option) s = { ...s, current: { ...s.current!, answer: { ...s.current!.answer, option: a.option } } };
        s = applyStamp(content, s, s.current!.akteId === '3-4' ? stamp34 : a.stamp!);
        s = fileCurrent(content, s);
      }
      if (d < 3) s = advanceDay(content, s);
    }
    return s;
  }

  /** A save as 0.2 wrote it: version 1, no tools, ended on the „Ende des Prototyps“ screen. */
  function prototypeSave(stamp34: 'ergaenzung' | 'bescheid', extra: object = {}) {
    const s = throughDay3(stamp34);
    const { tools: _t, act: _a, ...rest } = s;
    const followUp = stamp34 === 'ergaenzung';
    const day4 = followUp
      ? [{ akteId: '3-4/folge', day: 4, answer: { positions: {}, stamp: 'bescheid' }, errors: [] }]
      : [];
    return {
      ...rest,
      version: 1,
      day: 4,
      phase: 'finished',
      queue: [],
      current: null,
      results: [...s.results, ...day4],
      pendingFollowUps: [],
      ...extra,
    };
  }

  const load = (raw: unknown) => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEY, JSON.stringify(raw));
    return loadGame(store, content);
  };

  it('Ende des Prototyps: weiter mit Tag 4, Tag 1 bis 3 bleiben, Folgeakte 3-4 kommt wieder', () => {
    const old = prototypeSave('ergaenzung');
    const s = load(old)!;
    expect(s.version).toBe(2);
    expect(s.day).toBe(4);
    expect(s.phase).toBe('intro');
    expect(s.results.map((r) => r.akteId)).toEqual(old.results.filter((r: { day: number }) => r.day < 4).map((r: { akteId: string }) => r.akteId));
    expect(s.results).toHaveLength(11);
    expect(s.queue).toEqual(['3-4/folge', '4-1', '4-2', '4-3', '4-4', '4-5']);
    // Day 4 unlocks the desk calendar (akt1.json 0.3.2).
    expect(s.tools).toEqual(['calendar']);
    expect(s.settings).toEqual(old.settings);
  });

  it('ohne Ergänzungsersuchen bei 3-4 kommt keine Folgeakte', () => {
    const s = load(prototypeSave('bescheid'))!;
    expect(s.queue).toEqual(['4-1', '4-2', '4-3', '4-4', '4-5']);
    expect(s.results.find((r) => r.akteId === '3-4')!.errors).toHaveLength(1);
  });

  it('auch mitten in Tag 4 (Folgeakte auf dem Tisch) geht es mit Tag 4 neu los', () => {
    const s = load(prototypeSave('ergaenzung', { phase: 'desk', current: { akteId: '3-4/folge', answer: { positions: {} } }, results: throughDay3('ergaenzung').results }))!;
    expect(s.phase).toBe('intro');
    expect(s.current).toBeNull();
    expect(s.queue[0]).toBe('3-4/folge');
  });

  it('ein Spielstand vor Tag 4 spielt unverändert weiter', () => {
    const s = throughDay3('ergaenzung');
    const { tools: _t, ...rest } = s;
    const loaded = load({ ...rest, version: 1 })!;
    expect(loaded).toEqual({ ...s, version: 2, tools: [] });
    const next = advanceDay(content, loaded);
    expect(next.day).toBe(4);
    expect(next.queue[0]).toBe('3-4/folge');
  });
});
