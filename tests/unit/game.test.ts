import { describe, expect, it } from 'vitest';
import { correctAnswer } from '../../src/core/evaluate';
import {
  advanceDay,
  applyStamp,
  beginWork,
  chooseOption,
  clearMarks,
  continueAfterAct,
  dayInfo,
  decide,
  decidePosition,
  drawNext,
  enterAmount,
  errorsOfDay,
  errorsPerDay,
  fileCurrent,
  needsInquiry,
  needsReprimand,
  newGame,
  removeMark,
  toggleMark,
  type GameState,
} from '../../src/core/game';
import { getAkte } from '../../src/core/loader';
import { loadGame, saveGame } from '../../src/core/save';
import type { Answer } from '../../src/core/types';
import { MemoryStore, realContent } from './helpers';

const content = realContent();

/** Enters the answer through the game actions, stamps and files. */
function play(state: GameState, answer: (akteId: string) => Answer): GameState {
  let s = drawNext(state);
  const a = answer(s.current!.akteId);
  for (const [pid, v] of Object.entries(a.positions)) s = decidePosition(s, pid, v);
  if (a.option) s = chooseOption(s, a.option);
  for (const [id, v] of Object.entries(a.decisions ?? {})) s = decide(s, id, v);
  for (const [id, v] of Object.entries(a.amounts ?? {})) s = enterAmount(s, id, v);
  for (const m of a.marks ?? []) s = toggleMark(content, s, m);
  if (a.stamp) s = applyStamp(content, s, a.stamp, a.inquiry);
  return fileCurrent(content, s);
}

function playDay(state: GameState, answer: (akteId: string) => Answer, store?: MemoryStore): GameState {
  let s = beginWork(state);
  while (s.phase === 'desk') {
    s = play(s, answer);
    if (store) {
      saveGame(store, s);
      s = loadGame(store, content)!; // simulates a reload after every stamped Akte
    }
  }
  return s;
}

const perfect = (id: string) => correctAnswer(getAkte(content, id));
const ALL_ZERO = Object.fromEntries(content.days.map((d) => [d.day, 0]));

function playAll(answer: (id: string) => Answer, store?: MemoryStore): GameState {
  let s = newGame(content);
  while (s.phase !== 'actEnd') {
    s = playDay(s, answer, store);
    expect(s.phase).toBe('summary');
    s = advanceDay(content, s);
  }
  return s;
}

describe('Tagesablauf Akt I', () => {
  it('perfektes Spiel: null Fehler an allen zehn Tagen, dann Ende von Akt I', () => {
    const s = playAll(perfect);
    expect(errorsPerDay(content, s)).toEqual(ALL_ZERO);
    expect(s.phase).toBe('actEnd');
    expect(s.act).toBe(1);
    expect(s.day).toBe(10);
    expect(s.results).toHaveLength(48 + 6);
  });

  it('Folgeakten kommen an Tag 4, 5, 6, 7, 8 und 10, vor den Akten des Tages', () => {
    const s = playAll(perfect);
    const follow = s.results.filter((r) => r.akteId.endsWith('/folge')).map((r) => [r.akteId, r.day]);
    expect(follow).toEqual([
      ['3-4/folge', 4],
      ['4-1/folge', 5],
      ['5-3/folge', 6],
      ['6-3/folge', 7],
      ['7-3/folge', 8],
      ['9-2/folge', 10],
    ]);
    for (const day of [4, 5, 6, 7, 8, 10]) expect(s.results.find((r) => r.day === day)!.akteId).toMatch(/\/folge$/);
  });

  it('übersteht Neuladen nach jeder Akte', () => {
    const s = playAll(perfect, new MemoryStore());
    expect(errorsPerDay(content, s)).toEqual(ALL_ZERO);
  });

  it('Bescheid statt Ergänzungsersuchen: keine Folgeakte, ein Fehler', () => {
    const s = playAll((id) => (id === '5-3' ? { ...perfect(id), stamp: 'bescheid', marks: [] } : perfect(id)));
    expect(s.results.some((r) => r.akteId === '5-3/folge')).toBe(false);
    expect(errorsOfDay(s, 5)).toBe(1);
    expect(errorsOfDay(s, 6)).toBe(0);
  });

  it('Folgeakte kommt auch nach falscher Nachfrage', () => {
    const s = playAll((id) => (id === '6-3' ? { ...perfect(id), inquiry: 'q3' } : perfect(id)));
    expect(s.results.find((r) => r.akteId === '6-3')!.errors.map((e) => e.kind)).toEqual(['nachfrage-falsch']);
    expect(s.results.find((r) => r.akteId === '6-3/folge')?.day).toBe(7);
  });

  it('Akten kommen in der Reihenfolge des JSON', () => {
    const s = playAll(perfect);
    expect(s.results.filter((r) => r.day === 2).map((r) => r.akteId)).toEqual(['2-1', '2-2', '2-3', '2-4']);
    expect(s.results.filter((r) => r.day === 10).map((r) => r.akteId)).toEqual(['9-2/folge', '10-1', '10-2', '10-3', '10-4', '10-5', '10-6', '10-7']);
  });

  it('Tag 4 ist ein normaler Spieltag', () => {
    let s = newGame(content);
    for (let d = 1; d <= 3; d++) s = advanceDay(content, playDay(s, perfect));
    expect(s.day).toBe(4);
    expect(s.queue).toEqual(['3-4/folge', '4-1', '4-2', '4-3', '4-4', '4-5']);
    expect(dayInfo(content, 4).stamps).toEqual(['bescheid', 'ergaenzung']);
  });

  it('nach dem Schlussbildschirm von Akt I geht es nicht weiter', () => {
    const s = playAll(perfect);
    expect(continueAfterAct(content, s)).toBe(s);
    expect(advanceDay(content, s)).toBe(s);
  });

  it('Kalender ab Tag 4 und Rechner ab Tag 8 werden freigeschaltet und bleiben', () => {
    let s = newGame(content);
    const tools: Record<number, string[]> = {};
    while (s.phase !== 'actEnd') {
      tools[s.day] = s.tools;
      s = advanceDay(content, playDay(s, perfect));
    }
    expect(tools[3]).toEqual([]);
    expect(tools[4]).toEqual(['calendar']);
    expect(tools[7]).toEqual(['calendar', 'pinboard']);
    expect(tools[8]).toEqual(['calendar', 'pinboard', 'calculator']);
    expect(tools[10]).toEqual(['calendar', 'pinboard', 'calculator', 'drawer']);
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
    s = playDay(newGame(content), (id) => (id === '1-3' ? perfect(id) : wrong(id)));
    expect(errorsOfDay(s, 1)).toBe(4);
    expect(needsReprimand(content, s, 1)).toBe(true);
  });
});

describe('Aktionen am Schreibtisch', () => {
  /** State with Akte `id` on the desk (the day's stack is replaced). */
  const onDesk = (id: string, day = Number(id.split('-')[0])): GameState =>
    drawNext({ ...beginWork(newGame(content)), day, phase: 'desk', queue: [id] });

  it('nicht verfügbare Stempel werden ignoriert', () => {
    const s = applyStamp(content, drawNext(beginWork(newGame(content))), 'ergaenzung');
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

  it('Entscheidung setzen, ändern und zurücknehmen', () => {
    let s = onDesk('4-2');
    s = decide(s, 'd1', 'steuerfrei');
    s = decide(s, 'd1', 'steuerpflichtig');
    expect(s.current!.answer.decisions).toEqual({ d1: 'steuerpflichtig' });
    s = decide(s, 'd1', undefined);
    expect(s.current!.answer.decisions).toEqual({});
  });

  it('Betrag wird wie getippt gespeichert, leer entfernt ihn', () => {
    let s = onDesk('8-1');
    s = enterAmount(s, 'd1', '300,00');
    expect(s.current!.answer.amounts).toEqual({ d1: '300,00' });
    s = enterAmount(s, 'd1', '  ');
    expect(s.current!.answer.amounts).toEqual({});
  });

  it('Markieren: Paar anlegen, gleiches Paar hebt auf, nur verschiedene Papiere', () => {
    let s = onDesk('5-3');
    const k = getAkte(content, '5-3');
    const line = (doc: number, i = 0) => ({ document: k.documents[doc]!.title, line: k.documents[doc]!.lines[i]![0] });
    s = toggleMark(content, s, { a: line(0), b: line(0, 1) });
    expect(s.current!.answer.marks).toBeUndefined();
    s = toggleMark(content, s, { a: line(0), b: { document: 'Gibt es nicht', line: 'X' } });
    expect(s.current!.answer.marks).toBeUndefined();
    s = toggleMark(content, s, { a: line(0), b: line(1) });
    s = toggleMark(content, s, { a: line(2), b: line(3) });
    expect(s.current!.answer.marks).toHaveLength(2);
    s = toggleMark(content, s, { a: line(1), b: line(0) });
    expect(s.current!.answer.marks).toEqual([{ a: line(2), b: line(3) }]);
    s = toggleMark(content, s, { a: line(0), b: line(1) });
    s = removeMark(s, 0);
    expect(s.current!.answer.marks).toEqual([{ a: line(0), b: line(1) }]);
    s = clearMarks(s);
    expect(s.current!.answer.marks).toEqual([]);
  });

  it('Ergänzungsersuchen mit Nachfrage braucht eine gültige Frage', () => {
    const s = onDesk('6-3');
    expect(needsInquiry(content, s, 'ergaenzung')).toBe(true);
    expect(needsInquiry(content, s, 'bescheid')).toBe(false);
    expect(applyStamp(content, s, 'ergaenzung').current!.answer.stamp).toBeUndefined();
    expect(applyStamp(content, s, 'ergaenzung', 'q9').current!.answer.stamp).toBeUndefined();
    const stamped = applyStamp(content, s, 'ergaenzung', 'q2');
    expect(stamped.current!.answer).toMatchObject({ stamp: 'ergaenzung', inquiry: 'q2' });
    expect(applyStamp(content, s, 'bescheid').current!.answer.inquiry).toBeUndefined();
    expect(needsInquiry(content, onDesk('5-3'), 'ergaenzung')).toBe(false);
  });

  it('nach dem Stempeln sind Prüfvermerk, Markierungen und Nachfrage gesperrt', () => {
    let s = applyStamp(content, onDesk('5-3'), 'ergaenzung');
    const before = s.current!.answer;
    const k = getAkte(content, '5-3');
    s = decide(s, 'd1', 'ba');
    s = enterAmount(s, 'd1', '5');
    s = toggleMark(content, s, { a: { document: k.documents[0]!.title, line: 'Name' }, b: { document: k.documents[1]!.title, line: k.documents[1]!.lines[0]![0] } });
    s = clearMarks(s);
    s = applyStamp(content, s, 'bescheid');
    expect(s.current!.answer).toBe(before);
  });
});
