import { describe, expect, it } from 'vitest';
import { caseToAkte, followUpToAkte, rulesOf } from '../../src/core/loader';
import type { Akte, Case } from '../../src/core/types';
import { realContent } from './helpers';

/** Content validation against the real JSON in content/. */
describe('Inhalt content/*.json', () => {
  const content = realContent();
  const scheduledDay = (caseId: string) => content.days.find((d) => d.cases.includes(caseId))!.day;
  const ruleDay = (id: string) => content.rules.find((r) => r.id === id)!.day;
  const akten = (k: Case): [Akte, number][] => [
    [caseToAkte(k), scheduledDay(k.id)],
    ...(k.followUp ? ([[followUpToAkte(k), k.followUp.arrivesOnDay]] as [Akte, number][]) : []),
  ];

  it('lädt ohne Fehler: ganzer Akt I', () => {
    expect(content.meta.akt).toBe(1);
    expect(content.days.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(content.cases).toHaveLength(48);
    expect(content.cases.filter((k) => k.followUp)).toHaveLength(6);
    expect(content.rules).toHaveLength(54);
    expect(content.rules.filter((r) => r.hint).map((r) => r.id)).toHaveLength(5);
  });

  it.each(content.cases.map((k) => [k.id, k] as const))(
    'Akte %s: alle referenzierten Regeln sind spätestens am Tag der Akte freigeschaltet (Folgeakte: Tag des Eintreffens)',
    (_id, k) => {
      for (const [akte, day] of akten(k)) {
        for (const r of rulesOf(akte)) expect(ruleDay(r), `${akte.id}, Regel ${r}`).toBeLessThanOrEqual(day);
      }
    },
  );

  it.each(content.cases.map((k) => [k.id, k] as const))(
    'Akte %s: jede Position und Entscheidung hat eine explanation und mindestens eine Regel',
    (_id, k) => {
      for (const [akte] of akten(k)) {
        const items: { explanation: string; rules: string[] }[] =
          akte.kind.type === 'werbungskosten' ? akte.kind.positions : akte.kind.type === 'steuerpflicht' ? [akte.kind.decision] : akte.kind.decisions;
        expect(items.length).toBeGreaterThan(0);
        for (const it of items) {
          expect(it.explanation.trim().length, akte.id).toBeGreaterThan(0);
          expect(it.rules.length, akte.id).toBeGreaterThan(0);
        }
      }
    },
  );

  it('jede Akte ist mit dem an ihrem Tag verfügbaren Stempel lösbar', () => {
    for (const k of content.cases) {
      for (const [akte, day] of akten(k)) {
        expect(content.days.find((d) => d.day === day)!.stamps, akte.id).toContain(akte.correctStamp);
      }
    }
  });

  it('Folgeakten kommen an Tag 4, 5, 6, 7, 8 und 10', () => {
    const days = content.cases.flatMap((k) => (k.followUp ? [k.followUp.arrivesOnDay] : [])).sort((a, b) => a - b);
    expect(days).toEqual([4, 5, 6, 7, 8, 10]);
  });

  it('Rechner wird an Tag 8 freigeschaltet, Akt I endet an Tag 10', () => {
    const unlock = content.days.find((d) => d.storyEvents.some((e) => e.type === 'unlock' && e.feature === 'calculator'));
    expect(unlock?.day).toBe(8);
    const end = content.days.find((d) => d.storyEvents.some((e) => e.type === 'actSummary'));
    expect(end?.day).toBe(10);
  });

  it('Akte 2-2, Tageszeitung verweist auf R3 und R5', () => {
    const k = content.cases.find((c) => c.id === '2-2')!;
    expect(k.type === 'werbungskosten' && k.positions[1]!.rules).toEqual(['R3', 'R5']);
  });
});
