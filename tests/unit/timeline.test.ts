import { describe, expect, it } from 'vitest';
import { correctAnswer } from '../../src/core/evaluate';
import {
  advanceDay,
  applyStamp,
  beginWork,
  drawNext,
  dueDeskEvents,
  fileCurrent,
  finishPrologue,
  newGame,
  showDeskEvent,
  toolsUntil,
  type GameState,
} from '../../src/core/game';
import { getAkte, loadContent } from '../../src/core/loader';
import { loadGame, saveGame } from '../../src/core/save';
import { MemoryStore, clone, rawContentFiles, realContent, settle } from './helpers';

const content = realContent();
const events10 = content.days.find((d) => d.day === 10)!.storyEvents;
const gerri = events10.findIndex((e) => 'at' in e && typeof e.at === 'object');
const atEnd = events10.flatMap((e, i) => ('at' in e && e.at === 'end' ? [i] : []));

/** Day 10 at the desk with the given stack, every day before played. */
function day10(queue: string[]): GameState {
  const s = newGame(content);
  return { ...s, day: 10, phase: 'desk', queue, current: null, tools: toolsUntil(content, 10), prologueSeen: [1] };
}

/** Draws the top Akte, solves it correctly, stamps and files it. */
function solveTop(s: GameState, c = content): GameState {
  s = drawNext(s);
  const a = correctAnswer(getAkte(c, s.current!.akteId));
  s = { ...s, current: { ...s.current!, answer: { ...a, stamp: undefined } } };
  return fileCurrent(c, applyStamp(c, s, a.stamp!, a.inquiry));
}

describe('Vorspann (SPEC 4.1a)', () => {
  it('Neues Spiel beginnt mit dem Vorspann, danach Tag 1; gesehen bleibt gesehen', () => {
    const s = newGame(content);
    expect(s.phase).toBe('prologue');
    expect(beginWork(s)).toBe(s);
    const t = finishPrologue(content, s);
    expect(t).toMatchObject({ phase: 'intro', day: 1, prologueSeen: [1] });
    expect(finishPrologue(content, t)).toBe(t);
  });

  it('ohne Vorspann im Inhalt beginnt das Spiel mit der Tageskarte', () => {
    const c = clone(rawContentFiles()[0]!.data) as any;
    delete c.prologue;
    expect(newGame(loadContent(c)).phase).toBe('intro');
  });

  it('ein alter Spielstand ohne prologueSeen gilt nach Tag 1 als gesehen, ohne eventsShown als leer', () => {
    const store = new MemoryStore();
    const { prologueSeen: _p, eventsShown: _e, ...old } = { ...finishPrologue(content, newGame(content)), day: 3 };
    saveGame(store, old as GameState);
    expect(loadGame(store, content)).toMatchObject({ prologueSeen: [1], eventsShown: {} });
  });
});

describe('Ereignisse im Lauf des Tages (SPEC 4.4a, 4.5)', () => {
  it('Tag 10: Gerri gleich nach der Folgeakte 9-2, die Lade erst am Tagesende, dann die Auswertung', () => {
    let s = solveTop(day10(['9-2/folge', '10-1']));
    expect(s.phase).toBe('desk');
    expect(dueDeskEvents(content, s)).toEqual([gerri]);
    s = showDeskEvent(content, s, gerri);
    expect(dueDeskEvents(content, s)).toEqual([]);
    expect(s.tools).not.toContain('drawer');
    s = solveTop(s);
    // The stack is done, but the evening comes first.
    expect(s.phase).toBe('desk');
    expect(dueDeskEvents(content, s)).toEqual(atEnd);
    // Closing one that is already shown changes nothing.
    s = showDeskEvent(content, s, atEnd[0]!);
    expect(s.tools).toContain('drawer');
    expect(showDeskEvent(content, s, atEnd[0]!)).toBe(s);
    for (const i of atEnd.slice(1)) {
      expect(s.phase).toBe('desk');
      s = showDeskEvent(content, s, i);
    }
    expect(s.phase).toBe('summary');
    expect(advanceDay(content, s).phase).toBe('actEnd');
  });

  it('ohne Folgeakte kommt Gerris Satz am Tagesende, vor den anderen', () => {
    const s = solveTop(day10(['10-1']));
    expect(dueDeskEvents(content, s)).toEqual([gerri, ...atEnd]);
  });

  it('Neuladen mitten am Tag zeigt nichts doppelt und verliert nichts', () => {
    const store = new MemoryStore();
    let s = solveTop(day10(['9-2/folge', '10-1']));
    // Reload before Gerri was closed: he is still due.
    saveGame(store, s);
    expect(dueDeskEvents(content, loadGame(store, content)!)).toEqual([gerri]);
    s = showDeskEvent(content, s, gerri);
    saveGame(store, s);
    s = loadGame(store, content)!;
    expect(dueDeskEvents(content, s)).toEqual([]);
    s = solveTop(s);
    s = showDeskEvent(content, s, atEnd[0]!);
    saveGame(store, s);
    s = loadGame(store, content)!;
    expect(dueDeskEvents(content, s)).toEqual(atEnd.slice(1));
    expect(s.tools).toContain('drawer');
  });

  it('beginWork mit leerem Stapel: erst die Ereignisse am Tisch, dann die Auswertung', () => {
    const s = { ...day10([]), phase: 'intro' as const };
    const t = beginWork(s, content);
    expect(t.phase).toBe('desk');
    expect(settle(content, t).phase).toBe('summary');
  });

  it('Werkzeuge: eine Freischaltung am Tagesende zählt erst am Folgetag in toolsUntil', () => {
    expect(toolsUntil(content, 10)).not.toContain('drawer');
    expect(toolsUntil(content, 11)).toContain('drawer');
  });
});

describe('Der Code kennt keine Figur (SPEC 11)', () => {
  it('ein anderer Inhalt mit anderem Vorspann und anderen Zeitpunkten läuft ohne Codeänderung', () => {
    const c = clone(rawContentFiles()[0]!.data) as any;
    c.prologue = [{ text: 'Ein Leuchtturm. Niemand da.' }];
    const d2 = c.days.find((d: any) => d.day === 2);
    d2.storyEvents.push(
      { type: 'call', from: 'Frau Unbekannt', text: 'Ist dort das Amt?', at: { case: d2.cases[1] } },
      { type: 'newspaper', from: 'Abendblatt', headline: 'Sturm', text: 'Es stürmt.', at: 'end', clipping: { date: '1. Mai 1999', note: 'Merken!', noteFrom: 'Jemand' } },
      { type: 'note', from: 'Hausmeister', text: 'Licht aus.', at: 'end' },
    );
    const other = loadContent(c);
    let s = finishPrologue(other, newGame(other));
    expect(s.prologueSeen).toEqual([1]);
    s = advanceDay(other, settle(other, (() => {
      let t = beginWork(s, other);
      while (t.phase === 'desk' && t.queue.length) t = settle(other, solveTop(t, other));
      return t;
    })()));
    expect(s.day).toBe(2);
    s = beginWork(s, other);
    s = solveTop(s, other);
    expect(dueDeskEvents(other, s)).toEqual([]);
    s = solveTop(s, other);
    const base = d2.storyEvents.length - 3;
    expect(dueDeskEvents(other, s)).toEqual([base]);
    s = showDeskEvent(other, s, base);
    while (s.queue.length) s = solveTop(s, other);
    expect(dueDeskEvents(other, s)).toEqual([base + 1, base + 2]);
    expect(settle(other, s).phase).toBe('summary');
  });
});
