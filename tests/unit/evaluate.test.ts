import { describe, expect, it } from 'vitest';
import { correctAnswer, evaluate } from '../../src/core/evaluate';
import { getAkte } from '../../src/core/loader';
import type { Answer } from '../../src/core/types';
import { realContent } from './helpers';

const content = realContent();
const akte = (id: string) => getAkte(content, id);
const allIds = content.cases.flatMap((k) => (k.followUp ? [k.id, `${k.id}/folge`] : [k.id]));

describe('evaluate', () => {
  it.each(allIds)('Akte %s: die laut JSON richtige Antwort ergibt null Fehler', (id) => {
    expect(evaluate(akte(id), correctAnswer(akte(id)))).toEqual([]);
  });

  it('jede falsche Position ist ein Fehler', () => {
    const errs = evaluate(akte('1-1'), { positions: { p1: 'streichen', p2: 'anerkennen' }, stamp: 'bescheid' });
    expect(errs.map((e) => e.kind)).toEqual(['position-falsch', 'position-falsch']);
    expect(errs.map((e) => e.positionId)).toEqual(['p1', 'p2']);
    expect(errs[0]).toMatchObject({ given: 'streichen', expected: 'anerkennen' });
  });

  it('eine nicht entschiedene Position ist ein Fehler', () => {
    const errs = evaluate(akte('1-1'), { positions: { p1: 'anerkennen' }, stamp: 'bescheid' });
    expect(errs).toHaveLength(1);
    expect(errs[0]!.kind).toBe('position-nicht-entschieden');
  });

  it('falscher und fehlender Stempel sind je ein Fehler', () => {
    expect(evaluate(akte('3-4'), { positions: {}, stamp: 'bescheid' }).map((e) => e.kind)).toEqual(['stempel-falsch']);
    expect(evaluate(akte('1-1'), { positions: { p1: 'anerkennen', p2: 'streichen' } }).map((e) => e.kind)).toEqual(['stempel-falsch']);
  });

  it('Ergänzungsersuchen bei vollständiger Akte: genau ein Fehler „unnötige Verzögerung“', () => {
    const errs = evaluate(akte('3-1'), { positions: {}, option: 'unbeschraenkt', stamp: 'ergaenzung' });
    expect(errs).toEqual([{ kind: 'unnoetige-verzoegerung', given: 'ergaenzung', expected: 'bescheid' }]);
  });

  describe('offene Position (3-4)', () => {
    it('unentschieden plus Ergänzungsersuchen ist richtig', () => {
      expect(evaluate(akte('3-4'), { positions: {}, stamp: 'ergaenzung' })).toEqual([]);
    });
    it('anerkennen oder streichen ist jeweils ein Fehler', () => {
      for (const v of ['anerkennen', 'streichen'] as const) {
        expect(evaluate(akte('3-4'), { positions: { p1: v }, stamp: 'ergaenzung' }).map((e) => e.kind)).toEqual(['position-offen-entschieden']);
      }
    });
  });

  describe('Steuerpflicht', () => {
    it('falsche und fehlende Option ist ein Fehler', () => {
      expect(evaluate(akte('3-3'), { positions: {}, option: 'unbeschraenkt', stamp: 'bescheid' }).map((e) => e.kind)).toEqual(['option-falsch']);
      expect(evaluate(akte('3-3'), { positions: {}, stamp: 'bescheid' }).map((e) => e.kind)).toEqual(['option-fehlt']);
    });
  });

  describe('Entscheidungen', () => {
    const ok = (id: string, patch: Partial<Answer> = {}): Answer => ({ ...correctAnswer(akte(id)), ...patch });

    it('falsche und fehlende Option sind je ein Fehler', () => {
      const base = correctAnswer(akte('4-2'));
      const errs = evaluate(akte('4-2'), ok('4-2', { decisions: { ...base.decisions, d1: 'steuerfrei', d2: undefined as never } }));
      expect(errs).toEqual([
        { kind: 'entscheidung-falsch', decisionId: 'd1', given: 'steuerfrei', expected: 'steuerpflichtig' },
        { kind: 'entscheidung-fehlt', decisionId: 'd2', expected: 'steuerfrei' },
      ]);
    });

    it('Option als Objekt wird über value verglichen', () => {
      expect(evaluate(akte('4-5'), ok('4-5', { decisions: { ...correctAnswer(akte('4-5')).decisions, d1: 'a1' } })).map((e) => e.kind)).toEqual(['entscheidung-falsch']);
    });

    it('offene Entscheidung: jede Option ist ein Fehler, unentschieden ist richtig', () => {
      const base = correctAnswer(akte('4-1'));
      expect(base.decisions!.d3).toBeUndefined();
      expect(evaluate(akte('4-1'), base)).toEqual([]);
      const errs = evaluate(akte('4-1'), { ...base, decisions: { ...base.decisions, d3: 'selbstaendig' } });
      expect(errs).toEqual([{ kind: 'entscheidung-offen-entschieden', decisionId: 'd3', given: 'selbstaendig', expected: 'offen' }]);
    });

    it('Bescheid statt Ergänzungsersuchen bei offener Entscheidung ist ein Stempelfehler', () => {
      expect(evaluate(akte('4-1'), ok('4-1', { stamp: 'bescheid' })).map((e) => e.kind)).toEqual(['stempel-falsch']);
    });
  });

  describe('Beträge', () => {
    // 9-5 d3: 4.236,70 €
    const with3 = (raw: string | undefined): Answer => {
      const a = correctAnswer(akte('9-5'));
      const amounts = { ...a.amounts };
      if (raw === undefined) delete amounts.d3;
      else amounts.d3 = raw;
      return { ...a, amounts };
    };

    it.each(['4236,7', '4.236,70', '4236.70', '4 236,70', '4236,70 €'])('„%s“ ist richtig', (raw) => {
      expect(evaluate(akte('9-5'), with3(raw))).toEqual([]);
    });

    it('ein Cent daneben ist falsch, mit eingegebenem und richtigem Betrag', () => {
      expect(evaluate(akte('9-5'), with3('4236,71'))).toEqual([{ kind: 'betrag-falsch', decisionId: 'd3', given: '4236,71', givenCents: 423671, expectedCents: 423670 }]);
    });

    it('leer oder unlesbar ist falsch', () => {
      expect(evaluate(akte('9-5'), with3(undefined))).toEqual([{ kind: 'betrag-fehlt', decisionId: 'd3', given: undefined, expectedCents: 423670 }]);
      expect(evaluate(akte('9-5'), with3('viel'))).toEqual([{ kind: 'betrag-fehlt', decisionId: 'd3', given: 'viel', expectedCents: 423670 }]);
    });

    it('Betrag 0 muss als 0 eingegeben werden', () => {
      const a = correctAnswer(akte('10-2'));
      expect(a.amounts!.d3).toBe('0');
      expect(evaluate(akte('10-2'), a)).toEqual([]);
      expect(evaluate(akte('10-2'), { ...a, amounts: { ...a.amounts, d3: '0,00' } })).toEqual([]);
    });
  });

  describe('Widersprüche (5-3)', () => {
    const right = correctAnswer(akte('5-3'));
    const w = right.marks![0]!;

    it('richtige Lösung markiert den Widerspruch', () => {
      expect(right.marks).toHaveLength(1);
      expect(right.stamp).toBe('ergaenzung');
    });

    it('Reihenfolge von a und b ist egal', () => {
      expect(evaluate(akte('5-3'), { ...right, marks: [{ a: w.b, b: w.a }] })).toEqual([]);
    });

    it('vergessene Markierung ist genau ein Fehler', () => {
      expect(evaluate(akte('5-3'), { ...right, marks: [] })).toEqual([{ kind: 'widerspruch-fehlt', discrepancyId: 'w1' }]);
    });

    it('jede falsche Paarung ist ein Fehler', () => {
      const wrong = { a: w.a, b: { document: 'Einkommensteuererklärung 2025', line: 'Name' } };
      expect(evaluate(akte('5-3'), { ...right, marks: [w, wrong] })).toEqual([{ kind: 'widerspruch-falsch', mark: wrong }]);
    });

    it('bei einem Bescheid werden Markierungen nicht bewertet', () => {
      const errs = evaluate(akte('5-3'), { ...right, stamp: 'bescheid', marks: [] });
      expect(errs.map((e) => e.kind)).toEqual(['stempel-falsch']);
    });

    it('bei Akten ohne Widersprüche werden Markierungen nicht bewertet', () => {
      const a = correctAnswer(akte('4-1'));
      const k = akte('4-1');
      const mark = { a: { document: k.documents[0]!.title, line: k.documents[0]!.lines[0]![0] }, b: { document: k.documents[1]!.title, line: k.documents[1]!.lines[0]![0] } };
      expect(evaluate(k, { ...a, marks: [mark] })).toEqual([]);
    });
  });

  describe('Nachfrage (6-3, 9-2)', () => {
    it('falsche Frage ist genau ein Fehler', () => {
      const a = correctAnswer(akte('6-3'));
      expect(a.inquiry).toBe('q1');
      expect(evaluate(akte('6-3'), { ...a, inquiry: 'q2' })).toEqual([{ kind: 'nachfrage-falsch', given: 'q2', expected: 'q1' }]);
    });

    it('9-2: Widerspruch und Nachfrage werden beide bewertet', () => {
      const a = correctAnswer(akte('9-2'));
      expect(evaluate(akte('9-2'), a)).toEqual([]);
      expect(evaluate(akte('9-2'), { ...a, inquiry: 'q3', marks: [] }).map((e) => e.kind)).toEqual(['widerspruch-fehlt', 'nachfrage-falsch']);
    });
  });
});
