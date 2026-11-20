import { describe, expect, it } from 'vitest';
import { correctAnswer, evaluate } from '../../src/core/evaluate';
import { getAkte } from '../../src/core/loader';
import { realContent } from './helpers';

const content = realContent();
const akte = (id: string) => getAkte(content, id);

describe('evaluate', () => {
  it('die laut JSON richtige Antwort ergibt bei jeder Akte null Fehler', () => {
    const ids = [...content.cases.map((k) => k.id), '3-4/folge'];
    for (const id of ids) expect(evaluate(akte(id), correctAnswer(akte(id))), id).toEqual([]);
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

  it('falscher Stempel ist ein Fehler', () => {
    const errs = evaluate(akte('3-4'), { positions: {}, stamp: 'bescheid' });
    expect(errs.map((e) => e.kind)).toEqual(['stempel-falsch']);
  });

  it('fehlender Stempel ist ein Fehler', () => {
    const errs = evaluate(akte('1-1'), { positions: { p1: 'anerkennen', p2: 'streichen' } });
    expect(errs.map((e) => e.kind)).toEqual(['stempel-falsch']);
  });

  it('Ergänzungsersuchen bei vollständiger Akte: genau ein Fehler „unnötige Verzögerung“', () => {
    const errs = evaluate(akte('3-1'), { positions: {}, option: 'unbeschraenkt', stamp: 'ergaenzung' });
    expect(errs).toHaveLength(1);
    expect(errs[0]).toEqual({ kind: 'unnoetige-verzoegerung', given: 'ergaenzung', expected: 'bescheid' });
  });

  describe('offene Position (3-4)', () => {
    it('unentschieden plus Ergänzungsersuchen ist richtig', () => {
      expect(evaluate(akte('3-4'), { positions: {}, stamp: 'ergaenzung' })).toEqual([]);
    });
    it('anerkennen oder streichen ist jeweils ein Fehler', () => {
      for (const v of ['anerkennen', 'streichen'] as const) {
        const errs = evaluate(akte('3-4'), { positions: { p1: v }, stamp: 'ergaenzung' });
        expect(errs.map((e) => e.kind)).toEqual(['position-offen-entschieden']);
      }
    });
    it('anerkennen und Bescheid sind zwei Fehler', () => {
      expect(evaluate(akte('3-4'), { positions: { p1: 'anerkennen' }, stamp: 'bescheid' })).toHaveLength(2);
    });
  });

  describe('Steuerpflicht', () => {
    it('falsche Option ist ein Fehler', () => {
      const errs = evaluate(akte('3-3'), { positions: {}, option: 'unbeschraenkt', stamp: 'bescheid' });
      expect(errs.map((e) => e.kind)).toEqual(['option-falsch']);
    });
    it('fehlende Option ist ein Fehler', () => {
      const errs = evaluate(akte('3-3'), { positions: {}, stamp: 'bescheid' });
      expect(errs.map((e) => e.kind)).toEqual(['option-fehlt']);
    });
    it('falsche Option und falscher Stempel sind zwei Fehler', () => {
      expect(evaluate(akte('3-2'), { positions: {}, option: 'beschraenkt', stamp: 'ergaenzung' })).toHaveLength(2);
    });
  });
});
