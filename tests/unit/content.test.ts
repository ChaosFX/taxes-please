import { describe, expect, it } from 'vitest';
import { caseToAkte, followUpToAkte, rulesOf } from '../../src/core/loader';
import type { Position } from '../../src/core/types';
import { realContent } from './helpers';

/** Content validation against the real JSON in content/. */
describe('Inhalt content/*.json', () => {
  const content = realContent();
  const scheduledDay = (caseId: string) => content.days.find((d) => d.cases.includes(caseId))!.day;
  const ruleDay = (id: string) => content.rules.find((r) => r.id === id)!.day;

  it('lädt ohne Fehler', () => {
    expect(content.days.map((d) => d.day)).toEqual([1, 2, 3, 4]);
    expect(content.days.find((d) => d.day === 4)!.cases).toEqual([]);
    expect(content.cases).toHaveLength(11);
    expect(content.rules).toHaveLength(7);
  });

  it.each(content.cases.map((k) => [k.id, k] as const))(
    'Akte %s: alle referenzierten Regeln sind spätestens am Tag der Akte freigeschaltet',
    (_id, k) => {
      const day = scheduledDay(k.id);
      for (const r of rulesOf(caseToAkte(k))) expect(ruleDay(r), `Regel ${r}`).toBeLessThanOrEqual(day);
      if (k.followUp) {
        for (const r of rulesOf(followUpToAkte(k))) {
          expect(ruleDay(r), `Folgeakte, Regel ${r}`).toBeLessThanOrEqual(k.followUp.arrivesOnDay);
        }
      }
    },
  );

  it.each(content.cases.map((k) => [k.id, k] as const))(
    'Akte %s: jede Position und Entscheidung hat eine explanation und mindestens eine Regel',
    (_id, k) => {
      const items: { explanation: string; rules: string[] }[] = [];
      if (k.type === 'werbungskosten') items.push(...k.positions);
      else items.push(k.decision);
      if (k.followUp) items.push(...(k.followUp.positions as Position[]));
      for (const it of items) {
        expect(it.explanation.trim().length).toBeGreaterThan(0);
        expect(it.rules.length).toBeGreaterThan(0);
      }
    },
  );

  it('jede Akte ist mit dem an ihrem Tag verfügbaren Stempel lösbar', () => {
    for (const k of content.cases) {
      const day = content.days.find((d) => d.cases.includes(k.id))!;
      expect(day.stamps).toContain(k.correctStamp);
    }
  });

  it('Akte 2-2, Tageszeitung verweist auf R3 und R5', () => {
    const k = content.cases.find((c) => c.id === '2-2')!;
    expect(k.type === 'werbungskosten' && k.positions[1]!.rules).toEqual(['R3', 'R5']);
  });

  it('Akte 3-4 hat eine Folgeakte für Tag 4', () => {
    const k = content.cases.find((c) => c.id === '3-4')!;
    expect(k.followUp?.arrivesOnDay).toBe(4);
  });
});
