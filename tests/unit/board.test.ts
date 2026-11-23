import { describe, expect, it } from 'vitest';
import {
  EMPTY_BOARD,
  boardContext,
  boardFromSave,
  clueKey,
  clueValue,
  copies,
  drawerNotes,
  hand,
  newClues,
  needlesActive,
  newQuestionsOfDay,
  refOnAkte,
  unseenAnswers,
  visibleQuestions,
  wall,
  type BoardContext,
  type BoardState,
  type ClueRef,
} from '../../src/core/board';
import { correctAnswer } from '../../src/core/evaluate';
import {
  advanceDay,
  applyStamp,
  discardClue,
  drawNext,
  errorsOfDay,
  fileCurrent,
  hasNeedles,
  newGame,
  pinClue,
  placeClue,
  seeBoard,
  startDay,
  type GameState,
} from '../../src/core/game';
import { getAkte, loadContent } from '../../src/core/loader';
import { loadGame, saveGame } from '../../src/core/save';
import { MemoryStore, begin, clone, rawContentFiles, realContent, settle } from './helpers';

/*
 * Pinboard and drawer (SPEC 3 „Fragen“, 4, 7.6, 7.7, 9, 11 „Pinnwand mit Fragen und Lade“).
 */

const content = realContent();
const ctx = (day: number, filed: string[] = [], board: BoardState = EMPTY_BOARD): BoardContext => ({ day, filed, board });
const ids = (qs: { id: string }[]) => qs.map((q) => q.id);
const keys = (cards: { key: string }[]) => cards.map((c) => c.key);

const ES118 = '7-3|Rechnung Eventservice GmbH|Rechnungsnummer';
const WOLF_EMPLOYER = '2-4|Arbeitnehmerveranlagung 2025|Arbeitgeber';
const STAMP_10_4 = '10-4|@representative';
/** All Akten of the days before `day` (as if filed). */
const filedBefore = (day: number) => content.days.filter((d) => d.day < day).flatMap((d) => d.cases);

describe('sichtbare Fragen', () => {
  it('erscheinen ab ihrem Tag, nicht vorher', () => {
    expect(ids(visibleQuestions(content, ctx(6)))).toEqual([]);
    expect(ids(visibleQuestions(content, ctx(7)))).toEqual(['q1']);
    expect(ids(visibleQuestions(content, ctx(9)))).toEqual(['q1']);
    expect(ids(visibleQuestions(content, ctx(10)))).toEqual(['q1', 'q3']);
  });

  it('mit after erst, wenn die vorige beantwortet ist, als Kette', () => {
    const c = clone(rawContentFiles()[0]!.data) as any;
    const d7 = c.days.find((d: any) => d.day === 7);
    d7.questions.push({ id: 'q2b', after: 'q2', text: 'Und dann?', clues: [{ case: '7-1', document: c.cases.find((k: any) => k.id === '7-1').documents[0].title, line: c.cases.find((k: any) => k.id === '7-1').documents[0].lines[0][0] }], answer: { text: 'So.' } });
    const cc = loadContent(c);
    const b1: BoardState = { ...EMPTY_BOARD, placed: { q1: [ES118] } };
    expect(ids(visibleQuestions(cc, ctx(7, [], EMPTY_BOARD)))).toEqual(['q1']);
    expect(ids(visibleQuestions(cc, ctx(7, [], b1)))).toEqual(['q1', 'q2']);
    const b2: BoardState = { ...b1, placed: { ...b1.placed, q2: [WOLF_EMPLOYER] } };
    expect(ids(visibleQuestions(cc, ctx(7, [], b2)))).toEqual(['q1', 'q2', 'q2b']);
    // A later day keeps the order in which the questions came up.
    expect(ids(visibleQuestions(cc, ctx(10, [], b2)))).toEqual(['q1', 'q2', 'q2b', 'q3']);
  });

  it('neue Fragen des Tages ohne after kommen als Zettel', () => {
    expect(ids(newQuestionsOfDay(content, 7))).toEqual(['q1']);
    expect(ids(newQuestionsOfDay(content, 10))).toEqual(['q3']);
    expect(ids(newQuestionsOfDay(content, 8))).toEqual([]);
  });
});

describe('Inhalt der Hand', () => {
  it('auto: erst nach dem Ablegen der Akte', () => {
    expect(keys(hand(content, ctx(7, filedBefore(7))))).toEqual([]);
    expect(keys(hand(content, ctx(7, [...filedBefore(7), '7-3'])))).toEqual([ES118]);
  });

  it('Akte vor der Frage abgelegt: der Hinweis liegt sofort in der Hand, sobald die Frage hängt', () => {
    // 2-4 was filed on day 2; q2 hangs once q1 is answered.
    const filed = [...filedBefore(7), '7-3'];
    const b: BoardState = { ...EMPTY_BOARD, placed: { q1: [ES118] } };
    expect(keys(hand(content, ctx(7, filed, b)))).toEqual([WOLF_EMPLOYER]);
    // q3 on day 10: 10-4 filed, the two given stamps hang already.
    expect(keys(hand(content, ctx(10, [...filedBefore(10), '10-4'], b)))).toEqual([WOLF_EMPLOYER, STAMP_10_4]);
  });

  it('ein Hinweis zu zwei offenen Fragen liegt nur einmal in der Hand', () => {
    const c = clone(rawContentFiles()[0]!.data) as any;
    const q3 = c.days.find((d: any) => d.day === 10).questions[0];
    q3.clues.push({ case: '7-3', document: 'Rechnung Eventservice GmbH', line: 'Rechnungsnummer' });
    const cc = loadContent(c);
    const cards = hand(cc, ctx(10, [...filedBefore(10)]));
    expect(keys(cards).filter((k) => k === ES118)).toHaveLength(1);
  });

  it('pin: kommt nicht von selbst, nur angeheftet', () => {
    const c = clone(rawContentFiles()[0]!.data) as any;
    c.days.find((d: any) => d.day === 10).questions[0].clues[2].source = 'pin';
    const cc = loadContent(c);
    const filed = [...filedBefore(10), '10-4'];
    expect(keys(hand(cc, ctx(10, filed)))).not.toContain(STAMP_10_4);
    const s = pinClue(cc, gameAt(cc, 10, filed), { case: '10-4', field: 'representative' });
    expect(s.result).toBe('pinned');
    expect(hand(cc, boardContext(s.state)).find((c) => c.key === STAMP_10_4)?.auto).toBe(false);
    expect(placeClue(cc, s.state, STAMP_10_4, 'q3').result).toBe('answered');
  });

  it('nach dem Zuordnen verschwindet der Hinweis aus der Hand', () => {
    const s = place(gameAt(content, 7, [...filedBefore(7), '7-3']), ES118, 'q1');
    expect(keys(hand(content, boardContext(s)))).toEqual([WOLF_EMPLOYER]);
  });
});

/** A game state on `day` with the given Akten in the outbox. */
function gameAt(c = content, day: number, filed: string[] = [], board: BoardState = EMPTY_BOARD): GameState {
  const s = newGame(c);
  return {
    ...s,
    day,
    phase: 'desk',
    tools: ['calendar', 'pinboard', ...(day >= 8 ? (['calculator'] as const) : []), ...(day >= 10 ? (['drawer'] as const) : [])],
    results: filed.map((akteId) => ({ akteId, day: Number(akteId.split('-')[0]), answer: { positions: {} }, errors: [] })),
    board,
  };
}

function place(s: GameState, key: string, q: string, c = content): GameState {
  const r = placeClue(c, s, key, q);
  expect(r.result).not.toBe('wrong');
  return r.state;
}

describe('Zuordnen', () => {
  it('q1 an Tag 7: passt, beantwortet, q2 taucht auf', () => {
    const s0 = gameAt(content, 7, [...filedBefore(7), '7-3']);
    const r = placeClue(content, s0, ES118, 'q1');
    expect(r.result).toBe('answered');
    expect(ids(visibleQuestions(content, boardContext(r.state)))).toEqual(['q1', 'q2']);
    const col = wall(content, boardContext(r.state));
    expect(col.map((c) => c.group)).toEqual(['Eventservice GmbH']);
    expect(col[0]!.questions.map((q) => [q.question.id, q.answered, q.have, q.total])).toEqual([
      ['q1', true, 2, 2],
      ['q2', false, 0, 1],
    ]);
    const r2 = placeClue(content, r.state, WOLF_EMPLOYER, 'q2');
    expect(r2.result).toBe('answered');
  });

  it('q3 an Tag 10 mit dem Kanzleistempel aus 10-4', () => {
    const s0 = gameAt(content, 10, [...filedBefore(10), '10-4']);
    expect(wall(content, boardContext(s0)).find((c) => c.group === 'Pernold & Partner')!.questions[0]!.have).toBe(2);
    expect(placeClue(content, s0, STAMP_10_4, 'q3').result).toBe('answered');
    expect(clueValue(content, { case: '10-4', field: 'representative' })).toBe('Pernold & Partner Steuerberatung');
  });

  it('passt nicht: bleibt in der Hand, misses steigt, keine Fehler', () => {
    const s0 = gameAt(content, 10, [...filedBefore(10), '10-4']);
    const r = placeClue(content, s0, STAMP_10_4, 'q1');
    expect(r.result).toBe('wrong');
    expect(r.state.board.misses).toBe(1);
    expect(keys(hand(content, boardContext(r.state)))).toContain(STAMP_10_4);
    expect(r.state.results).toBe(s0.results);
    expect(errorsOfDay(r.state, 10)).toBe(0);
  });

  it('auf eine beantwortete oder unsichtbare Frage geht nichts', () => {
    const s = place(gameAt(content, 7, [...filedBefore(7), '7-3']), ES118, 'q1');
    expect(placeClue(content, s, WOLF_EMPLOYER, 'q1').result).toBe('invalid');
    expect(placeClue(content, s, WOLF_EMPLOYER, 'q3').result).toBe('invalid');
    expect(placeClue(content, s, 'gibt|es|nicht', 'q2').result).toBe('invalid');
  });

  it('ohne Pinnwand am Tisch geht nichts', () => {
    const s = { ...gameAt(content, 7, ['7-3']), tools: [] };
    expect(placeClue(content, s, ES118, 'q1').result).toBe('invalid');
    expect(pinClue(content, s, { case: '7-3', document: 'Rechnung Eventservice GmbH', line: 'Rechnungsnummer' }).result).toBe('invalid');
  });
});

describe('Anheften und Weglegen', () => {
  // Akt I has no question with a pin clue, so no needle (SPEC 7.6); these tests add one.
  const content = pinContent();
  const line = (k: string): ClueRef => {
    const doc = getAkte(content, k).documents[0]!;
    return { case: k, document: doc.title, line: doc.lines[0]![0] };
  };

  it('legt jede Zeile in die Hand, zweimal geht nicht', () => {
    const s0 = gameAt(content, 7, filedBefore(7));
    const r = pinClue(content, s0, line('1-1'));
    expect(r.result).toBe('pinned');
    expect(hand(content, boardContext(r.state)).map((c) => [c.key, c.auto])).toEqual([[clueKey(line('1-1')), false]]);
    expect(pinClue(content, r.state, line('1-1')).result).toBe('already');
  });

  it('unbekannte Stellen und Vertreter ohne Stempel werden nicht angeheftet', () => {
    const s0 = gameAt(content, 7);
    expect(pinClue(content, s0, { case: '1-1', document: 'gibt es nicht', line: 'x' }).result).toBe('invalid');
    expect(pinClue(content, s0, { case: '1-1', field: 'representative' }).result).toBe('invalid');
  });

  it('angeheftete auto-Stelle passt und verlässt die Hand', () => {
    const s0 = gameAt(content, 7, filedBefore(7));
    const r = pinClue(content, s0, { case: '7-3', document: 'Rechnung Eventservice GmbH', line: 'Rechnungsnummer' });
    expect(keys(hand(content, boardContext(r.state)))).toEqual([ES118]);
    const s = place(r.state, ES118, 'q1');
    expect(s.board.pinned).toEqual([]);
    // q2 hangs now; the card for it comes by itself (2-4 is filed).
    expect(keys(hand(content, boardContext(s)))).toEqual([WOLF_EMPLOYER]);
  });

  it('weglegen nur für angeheftete Karten', () => {
    const s0 = gameAt(content, 7, filedBefore(7));
    const s = pinClue(content, s0, line('1-1')).state;
    expect(hand(content, boardContext(discardClue(s, clueKey(line('1-1')))))).toEqual([]);
    const auto = gameAt(content, 7, [...filedBefore(7), '7-3']);
    expect(discardClue(auto, ES118)).toBe(auto);
  });

  it('Folgeakten: Stellen tragen followUp und passen zu keiner Frage', () => {
    const ref = refOnAkte(content, '7-3/folge', { document: getAkte(content, '7-3/folge').documents[0]!.title, line: getAkte(content, '7-3/folge').documents[0]!.lines[0]![0] });
    expect(ref.followUp).toBe(true);
    const s = pinClue(content, gameAt(content, 8, [...filedBefore(8), '7-3/folge']), ref);
    expect(s.result).toBe('pinned');
    expect(clueKey(ref)).toMatch(/^7-3\/folge\|/);
    expect(placeClue(content, s.state, clueKey(ref), 'q1').result).toBe('wrong');
  });
});

describe('Nadel und Durchschläge erst mit der ersten pin-Frage (SPEC 7.6)', () => {
  it('in Akt I nie, auch nicht an Tag 7 und 10', () => {
    for (const day of [1, 7, 10]) expect(needlesActive(content, boardContext(gameAt(content, day, filedBefore(day))))).toBe(false);
    expect(hasNeedles(content, gameAt(content, 10))).toBe(false);
    expect(pinClue(content, gameAt(content, 7, filedBefore(7)), { case: '1-1', document: getAkte(content, '1-1').documents[0]!.title, line: getAkte(content, '1-1').documents[0]!.lines[0]![0] }).result).toBe('invalid');
  });

  it('mit einer pin-Frage an der Wand ab ihrem Tag, und danach bleiben sie', () => {
    const pc = pinContent();
    expect(needlesActive(pc, boardContext(gameAt(pc, 6)))).toBe(false);
    expect(needlesActive(pc, boardContext(gameAt(pc, 7)))).toBe(true);
    expect(needlesActive(pc, boardContext(gameAt(pc, 10)))).toBe(true);
    expect(hasNeedles(pc, gameAt(pc, 7))).toBe(true);
    // Without the pinboard on the desk there is no needle.
    expect(hasNeedles(pc, { ...gameAt(pc, 7), tools: [] })).toBe(false);
  });

  it('eine pin-Frage mit after kommt erst nach der vorigen Frage, beantwortet bleibt sie', () => {
    const c = clone(rawContentFiles()[0]!.data) as any;
    const q2 = c.days.find((d: any) => d.day === 7).questions.find((q: any) => q.id === 'q2');
    q2.clues[0].source = 'pin';
    const pc = loadContent(c);
    expect(needlesActive(pc, boardContext(gameAt(pc, 7, filedBefore(7))))).toBe(false);
    const s = place(gameAt(pc, 7, [...filedBefore(7), '7-3']), ES118, 'q1', pc);
    expect(needlesActive(pc, boardContext(s))).toBe(true);
  });
});

/** Akt I with one more question on day 7 whose only clue has to be pinned. */
function pinContent() {
  const c = clone(rawContentFiles()[0]!.data) as any;
  const doc = c.cases.find((k: any) => k.id === '1-2').documents[0];
  c.days.find((d: any) => d.day === 7).questions.push({ id: 'qpin', text: 'Testfrage', clues: [{ case: '1-2', document: doc.title, line: doc.lines[0][0], source: 'pin' }], answer: { text: 'Test' } });
  return loadContent(c);
}

describe('neu und gesehen', () => {
  it('neue Hinweise und Antworten bis die Pinnwand offen war', () => {
    let s = gameAt(content, 7, [...filedBefore(7), '7-3']);
    expect(newClues(content, boardContext(s))).toHaveLength(1);
    s = seeBoard(content, s);
    expect(newClues(content, boardContext(s))).toHaveLength(0);
    s = place(s, ES118, 'q1');
    expect(ids(unseenAnswers(content, boardContext(s)))).toEqual(['q1']);
    expect(newClues(content, boardContext(s)).map((c) => c.key)).toEqual([WOLF_EMPLOYER]);
    s = seeBoard(content, s);
    expect(unseenAnswers(content, boardContext(s))).toEqual([]);
    expect(seeBoard(content, s)).toBe(s);
  });
});

describe('Durchschläge', () => {
  it('nach Tag, in Ablagereihenfolge, mit Folgeakten', () => {
    const results = [
      { akteId: '6-1', day: 6 },
      { akteId: '6-3/folge', day: 7 },
      { akteId: '7-1', day: 7 },
      { akteId: '6-2', day: 6 },
    ];
    expect(copies(results)).toEqual([
      { day: 6, akten: ['6-1', '6-2'] },
      { day: 7, akten: ['6-3/folge', '7-1'] },
    ]);
  });
});

describe('Lade', () => {
  it('Zettel mit keep: drawer erst, wenn sie gezeigt sind (an Tag 10 am Tagesende)', () => {
    expect(drawerNotes(content, { day: 9 })).toEqual([]);
    expect(drawerNotes(content, { day: 10 })).toEqual([]);
    const events = content.days.find((d) => d.day === 10)!.storyEvents;
    const kept = events.flatMap((e, i) => (e.type === 'note' && e.keep === 'drawer' ? [i] : []));
    expect(drawerNotes(content, { day: 10, eventsShown: { 10: [kept[0]!] } })).toHaveLength(1);
    const notes = drawerNotes(content, { day: 10, eventsShown: { 10: kept } });
    expect(notes).toHaveLength(2);
    expect(notes.every((n) => n.day === 10 && n.keep === 'drawer')).toBe(true);
    // Next day they are there anyway.
    expect(drawerNotes(content, { day: 11 })).toHaveLength(2);
  });
});

describe('Spielstand', () => {
  it('Pinnwand übersteht Neuladen', () => {
    const store = new MemoryStore();
    let s = pinClue(content, gameAt(content, 7, [...filedBefore(7), '7-3']), { case: '1-1', field: 'representative' }).state;
    s = pinClue(content, s, { case: '2-4', field: 'representative' }).state;
    s = place(s, ES118, 'q1');
    s = { ...s, board: { ...s.board, misses: 2 } };
    saveGame(store, s);
    const back = loadGame(store, content)!;
    expect(back.board).toEqual(s.board);
    expect(ids(visibleQuestions(content, boardContext(back)))).toEqual(['q1', 'q2']);
  });

  it('ohne board: leere Pinnwand, der Rest bleibt', () => {
    const store = new MemoryStore();
    const s = gameAt(content, 7, ['1-1']);
    const { board: _b, ...old } = s;
    store.setItem('taxes-please/save/v1', JSON.stringify(old));
    const back = loadGame(store, content)!;
    expect(back.board).toEqual(EMPTY_BOARD);
    expect(back.results).toEqual(s.results);
  });

  it('Einträge zu unbekannten Fragen oder Fundstellen fallen weg', () => {
    const b = boardFromSave(content, {
      placed: { q1: [ES118, 'x|y|z', '5-3|Rechnung Eventservice GmbH|Rechnungsnummer'], q9: [ES118] },
      pinned: [{ case: '1-1', document: 'weg', line: 'x' }, { case: '9-9', field: 'representative' }, { case: '2-4', field: 'representative' }, 'kaputt'],
      seenClues: [ES118, 3],
      seenAnswers: ['q1', 'q9'],
      misses: -1,
    });
    expect(b).toEqual({ placed: { q1: [ES118] }, pinned: [{ case: '2-4', field: 'representative' }], seenClues: [ES118], seenAnswers: ['q1'], misses: 0 });
  });
});

describe('ganzer Akt mit Pinnwand', () => {
  it('Fragen lösen ändert keine Fehlerzahl; die Hand füllt sich beim Ablegen', () => {
    let s = newGame(content);
    const seen: string[][] = [];
    while (s.phase !== 'actEnd') {
      s = begin(content, s);
      while (s.phase === 'desk') {
        s = drawNext(s);
        const a = correctAnswer(getAkte(content, s.current!.akteId));
        s = { ...s, current: { ...s.current!, answer: { ...a, stamp: undefined } } };
        s = settle(content, fileCurrent(content, applyStamp(content, s, a.stamp!, a.inquiry)));
        // Every card goes onto the question it fits.
        for (let n = 0; n < 5; n++) {
          const cards = hand(content, boardContext(s));
          if (!cards.length) break;
          for (const c of cards) {
            for (const q of visibleQuestions(content, boardContext(s))) {
              const r = placeClue(content, s, c.key, q.id);
              if (r.result === 'placed' || r.result === 'answered') {
                s = r.state;
                break;
              }
            }
          }
        }
      }
      seen.push(ids(visibleQuestions(content, boardContext(s))));
      expect(errorsOfDay(s, s.day)).toBe(0);
      s = advanceDay(content, s);
    }
    expect(seen[6]).toEqual(['q1', 'q2']);
    // Akt I 0.4.0: q4 follows q3 on day 10.
    expect(seen[9]).toEqual(['q1', 'q2', 'q3', 'q4']);
    expect(wall(content, boardContext(s)).flatMap((c) => c.questions.map((q) => q.answered))).toEqual([true, true, true, true]);
  });
});

describe('der Code kennt keine Figur', () => {
  /** A content file of its own: another person asks, another group, a clue to pin. */
  function otherContent() {
    const c = clone(rawContentFiles()[0]!.data) as any;
    const d10 = c.days.find((d: any) => d.day === 10);
    const k = c.cases.find((x: any) => x.id === '10-2');
    const doc = k.documents[0];
    d10.questions = [
      {
        id: 'x1',
        from: 'Hofrätin Zierhut',
        group: 'Weingut am Bisamberg',
        text: 'Woher kommt das Geld für den Keller?',
        clues: [
          { case: '9-1', document: c.cases.find((x: any) => x.id === '9-1').documents[0].title, line: c.cases.find((x: any) => x.id === '9-1').documents[0].lines[0][0], given: true },
          { case: '10-2', document: doc.title, line: doc.lines[0][0], source: 'pin' },
        ],
        answer: { from: 'Hofrätin Zierhut', text: 'Aus der Erbschaft der Tante.' },
      },
    ];
    c.days.find((d: any) => d.day === 7).questions = [];
    return { content: loadContent(c), ref: { case: '10-2', document: doc.title, line: doc.lines[0][0] } as ClueRef };
  }

  it('wird ohne Codeänderung dargestellt und lässt sich lösen', () => {
    const { content: other, ref } = otherContent();
    let s = gameAt(other, 10, ['9-1', '10-2']);
    const col = wall(other, boardContext(s));
    expect(col.map((c) => c.group)).toEqual(['Weingut am Bisamberg']);
    expect(col[0]!.questions[0]!.question.from).toBe('Hofrätin Zierhut');
    expect(col[0]!.questions[0]!.have).toBe(1);
    expect(ids(newQuestionsOfDay(other, 10))).toEqual(['x1']);
    // source: pin – filing is not enough.
    expect(hand(other, boardContext(s))).toEqual([]);
    s = pinClue(other, s, ref).state;
    const r = placeClue(other, s, clueKey(ref), 'x1');
    expect(r.result).toBe('answered');
    expect(wall(other, boardContext(r.state))[0]!.questions[0]!.question.answer.text).toBe('Aus der Erbschaft der Tante.');
  });

  it('startDay und Ablauf laufen mit dem anderen Inhalt', () => {
    const { content: other } = otherContent();
    const s = startDay(other, newGame(other), 10);
    expect(s.board).toEqual(EMPTY_BOARD);
    expect(advanceDay(other, s)).toBe(s);
  });
});
