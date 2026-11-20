import { describe, expect, it } from 'vitest';
import { ContentError, getAkte, loadContent, loadContentFiles } from '../../src/core/loader';
import { clone, rawContentFiles } from './helpers';

const raw = () => clone(rawContentFiles()[0]) as any;

function problems(fn: () => unknown): string[] {
  try {
    fn();
  } catch (e) {
    if (e instanceof ContentError) return e.problems;
    throw e;
  }
  return [];
}

describe('loadContent', () => {
  it('meldet fehlende Pflichtfelder mit Pfad', () => {
    const c = raw();
    delete c.cases[0].correctStamp;
    const p = problems(() => loadContent(c));
    expect(p.some((x) => x.startsWith('cases.0.correctStamp'))).toBe(true);
  });

  it('meldet unbekannten Akten-Typ', () => {
    const c = raw();
    c.cases[0].type = 'umsatzsteuer';
    expect(problems(() => loadContent(c)).length).toBeGreaterThan(0);
  });

  it('meldet unbekannte Regeln', () => {
    const c = raw();
    c.cases[0].positions[0].rules = ['R99'];
    expect(problems(() => loadContent(c))).toContain('Akte 1-1: unbekannte Regel R99');
  });

  it('meldet unbekannte Akten in einem Tag und Akten ohne Tag', () => {
    const c = raw();
    c.days[0].cases = ['1-1', '1-2', 'X'];
    const p = problems(() => loadContent(c));
    expect(p).toContain('Tag 1: unbekannte Akte X');
    expect(p).toContain('Akte 1-3 ist keinem Tag zugeordnet');
  });

  it('meldet richtige Option, die keine Option ist', () => {
    const c = raw();
    const k = c.cases.find((x: any) => x.id === '3-1');
    k.decision.correct = 'vielleicht';
    expect(problems(() => loadContent(c)).some((x) => x.includes('vielleicht'))).toBe(true);
  });

  it('meldet Stempel, der am Tag nicht verfügbar ist', () => {
    const c = raw();
    c.cases[0].correctStamp = 'ergaenzung';
    expect(problems(() => loadContent(c)).some((x) => x.includes('nicht verfügbar'))).toBe(true);
  });

  it('meldet Folgeakte an einem Tag, den es nicht gibt', () => {
    const c = raw();
    c.cases.find((x: any) => x.id === '3-4').followUp.arrivesOnDay = 9;
    expect(problems(() => loadContent(c))).toContain('Akte 3-4: Folgeakte trifft an Tag 9 ein, den es nicht gibt');
  });

  it('meldet Option ohne Anzeigenamen', () => {
    const c = raw();
    delete c.texts.optionLabels.beschraenkt;
    expect(problems(() => loadContent(c))).toContain('Akte 3-1: Option „beschraenkt“ fehlt in texts.optionLabels');
  });

  it('meldet Anzeigenamen ohne passende Option', () => {
    const c = raw();
    c.texts.optionLabels.unbeschränkt = 'Tippfehler im Schlüssel';
    expect(problems(() => loadContent(c))).toContain('texts.optionLabels: Schlüssel „unbeschränkt“ kommt in keiner Entscheidung vor');
  });

  it('meldet unbekannten oder fehlenden Stempelnamen', () => {
    const c = raw();
    c.texts.stampLabels.vorhalt = 'Vorhalt';
    expect(problems(() => loadContent(c)).some((x) => x.startsWith('texts.stampLabels'))).toBe(true);
    const d = raw();
    delete d.texts.stampLabels.ergaenzung;
    expect(problems(() => loadContent(d)).some((x) => x.startsWith('texts.stampLabels.ergaenzung'))).toBe(true);
  });

  it('meldet fehlenden texts-Block', () => {
    const c = raw();
    delete c.texts;
    expect(problems(() => loadContent(c)).some((x) => x.startsWith('texts'))).toBe(true);
  });

  it('meldet doppelte IDs', () => {
    const c = raw();
    c.rules.push(clone(c.rules[0]));
    expect(problems(() => loadContent(c))).toContain('Regel-ID doppelt: R1');
  });

  it('Fehlermeldung ist lesbar', () => {
    const c = raw();
    c.cases[0].positions[0].rules = ['R99'];
    expect(() => loadContent(c)).toThrow(/Inhaltsdatei ungültig:\n- Akte 1-1: unbekannte Regel R99/);
  });

  it('führt mehrere Dateien zusammen', () => {
    const c = raw();
    const a = { meta: c.meta, texts: c.texts, rules: c.rules, days: c.days.slice(0, 2), cases: c.cases.slice(0, 7) };
    const b = { rules: [], days: c.days.slice(2), cases: c.cases.slice(7) };
    const merged = loadContentFiles([a, b]);
    expect(merged.days).toHaveLength(4);
    expect(merged.cases).toHaveLength(11);
  });

  it('getAkte liefert reguläre Akten und Folgeakten', () => {
    const c = loadContent(raw());
    expect(getAkte(c, '1-1').isFollowUp).toBe(false);
    const f = getAkte(c, '3-4/folge');
    expect(f.isFollowUp).toBe(true);
    expect(f.taxpayer.name).toBe('Petra Lang');
    expect(f.correctStamp).toBe('bescheid');
    expect(() => getAkte(c, '9-9')).toThrow();
  });
});
