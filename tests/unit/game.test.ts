import { describe, expect, it } from 'vitest';
import { correctAnswer } from '../../src/core/evaluate';
import {
  advanceDay,
  applyStamp,
  beginWork,
  chooseOption,
  dayInfo,
  decidePosition,
  drawNext,
  errorsOfDay,
  errorsPerDay,
  fileCurrent,
  needsReprimand,
  newGame,
  type GameState,
} from '../../src/core/game';
import { getAkte } from '../../src/core/loader';
import { loadGame, saveGame } from '../../src/core/save';
import type { Answer } from '../../src/core/types';
import { MemoryStore, realContent } from './helpers';

const content = realContent();

/** Plays the Akte on the desk with the given answer and files it. */
function play(state: GameState, answer: (akteId: string) => Answer): GameState {
  let s = drawNext(state);
  const cur = s.current!;
  const a = answer(cur.akteId);
  for (const [pid, v] of Object.entries(a.positions)) s = decidePosition(s, pid, v);
  if (a.option) s = chooseOption(s, a.option);
  if (a.stamp) s = applyStamp(content, s, a.stamp);
  return fileCurrent(content, s);
}

function playDay(state: GameState, answer: (akteId: string) => Answer, store?: MemoryStore): GameState {
  let s = beginWork(state);
  while (s.phase === 'desk') {
    s = play(s, answer);
    if (store) {
      saveGame(store, s);
      s = loadGame(store)!; // simulates a reload after every stamped Akte
    }
  }
  return s;
}

const perfect = (id: string) => correctAnswer(getAkte(content, id));

function playAll(answer: (id: string) => Answer, store?: MemoryStore): GameState {
  let s = newGame(content);
  const seen: number[] = [];
  while (s.phase !== 'finished') {
    seen.push(s.day);
    s = playDay(s, answer, store);
    expect(s.phase).toBe('summary');
    s = advanceDay(content, s);
  }
  expect(seen.length).toBeGreaterThan(0);
  return s;
}

describe('Tagesablauf', () => {
  it('perfektes Spiel: null Fehler an jedem Tag, Folgeakte kommt an Tag 4', () => {
    const s = playAll(perfect);
    expect(errorsPerDay(content, s)).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0 });
    expect(s.results.filter((r) => r.day === 4).map((r) => r.akteId)).toEqual(['3-4/folge']);
    expect(s.results).toHaveLength(12);
  });

  it('übersteht Neuladen nach jeder Akte', () => {
    const store = new MemoryStore();
    const s = playAll(perfect, store);
    expect(errorsPerDay(content, s)).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0 });
  });

  it('Bescheid statt Ergänzungsersuchen bei 3-4: keine Folgeakte, Tag 4 mit leerem Stapel', () => {
    const s = playAll((id) => (id === '3-4' ? { positions: {}, stamp: 'bescheid' } : perfect(id)));
    expect(s.results.some((r) => r.akteId === '3-4/folge')).toBe(false);
    expect(errorsPerDay(content, s)).toEqual({ 1: 0, 2: 0, 3: 1, 4: 0 });
  });

  it('leerer Tag geht vom Tagesbeginn direkt zur Auswertung', () => {
    let s = newGame(content);
    for (let d = 1; d <= 3; d++) {
      s = playDay(s, (id) => (id === '3-4' ? { positions: {}, stamp: 'bescheid' } : perfect(id)));
      s = advanceDay(content, s);
    }
    expect(s.day).toBe(4);
    expect(s.queue).toEqual([]);
    s = beginWork(s);
    expect(s.phase).toBe('summary');
    expect(advanceDay(content, s).phase).toBe('finished');
  });

  it('Akten kommen in der Reihenfolge des JSON', () => {
    const s = playAll(perfect);
    expect(s.results.filter((r) => r.day === 2).map((r) => r.akteId)).toEqual(['2-1', '2-2', '2-3', '2-4']);
  });

  it('Tag 4 kommt aus dem Inhalt und hat beide Stempel', () => {
    expect(dayInfo(content, 4).stamps).toEqual(['bescheid', 'ergaenzung']);
    expect(() => dayInfo(content, 5)).toThrow();
  });

  it('nicht verfügbare Stempel werden ignoriert', () => {
    let s = drawNext(beginWork(newGame(content)));
    s = applyStamp(content, s, 'ergaenzung');
    expect(s.current!.answer.stamp).toBeUndefined();
  });

  it('nächste Akte erst nach Ablage in den Ausgangskorb', () => {
    let s = drawNext(beginWork(newGame(content)));
    const first = s.current!.akteId;
    s = drawNext(s);
    expect(s.current!.akteId).toBe(first);
    s = fileCurrent(content, s); // unstamped: not possible
    expect(s.current!.akteId).toBe(first);
  });

  it('nach dem Stempeln sind Entscheidungen gesperrt', () => {
    let s = drawNext(beginWork(newGame(content)));
    s = decidePosition(s, 'p1', 'anerkennen');
    s = applyStamp(content, s, 'bescheid');
    s = decidePosition(s, 'p1', 'streichen');
    expect(s.current!.answer.positions.p1).toBe('anerkennen');
  });

  it('Entscheidung zurücknehmen', () => {
    let s = drawNext(beginWork(newGame(content)));
    s = decidePosition(s, 'p1', 'anerkennen');
    s = decidePosition(s, 'p1', undefined);
    expect('p1' in s.current!.answer.positions).toBe(false);
  });

  it('Ermahnung ab drei Fehlern', () => {
    const wrong = (id: string): Answer => {
      const a = perfect(id);
      const flipped = Object.fromEntries(
        Object.entries(a.positions).map(([k, v]) => [k, v === 'anerkennen' ? 'streichen' : 'anerkennen']),
      ) as Answer['positions'];
      return { ...a, positions: flipped };
    };
    let s = playDay(newGame(content), (id) => (id === '1-1' ? wrong(id) : perfect(id)));
    expect(errorsOfDay(s, 1)).toBe(2);
    expect(needsReprimand(content, s, 1)).toBe(false);
    const strict = { ...content, texts: { ...content.texts, warning: { ...content.texts.warning, minErrors: 2 } } };
    expect(needsReprimand(strict, s, 1)).toBe(true);
    s = playDay(newGame(content), (id) => (id === '1-3' ? perfect(id) : wrong(id)));
    expect(errorsOfDay(s, 1)).toBe(4);
    expect(needsReprimand(content, s, 1)).toBe(true);
  });
});
