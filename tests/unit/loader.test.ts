import { describe, expect, it } from 'vitest';
import { ContentError, getAkte, loadContent, loadContentFiles } from '../../src/core/loader';
import { clone, rawContentFiles } from './helpers';

const raw = () => clone(rawContentFiles()[0]!.data) as any;
const kase = (c: any, id: string) => c.cases.find((x: any) => x.id === id);
const day = (c: any, n: number) => c.days.find((x: any) => x.day === n);

function problems(fn: () => unknown): string[] {
  try {
    fn();
  } catch (e) {
    if (e instanceof ContentError) return e.problems;
    throw e;
  }
  return [];
}

describe('loadContent: Schema', () => {
  it('meldet fehlende Pflichtfelder mit Akte und Pfad', () => {
    const c = raw();
    delete c.cases[0].correctStamp;
    expect(problems(() => loadContent(c)).some((x) => x.startsWith('Akte 1-1, correctStamp'))).toBe(true);
  });

  it('meldet unbekannten Akten-Typ', () => {
    const c = raw();
    c.cases[0].type = 'umsatzsteuer';
    expect(problems(() => loadContent(c)).some((x) => x.startsWith('Akte 1-1'))).toBe(true);
  });

  it('meldet unbekannten Story-Typ mit Tag', () => {
    const c = raw();
    day(c, 4).storyEvents[0].type = 'brief';
    expect(problems(() => loadContent(c)).some((x) => x.startsWith('Tag 4, storyEvents.0'))).toBe(true);
  });

  it('meldet unbekanntes Werkzeug bei unlock', () => {
    const c = raw();
    day(c, 8).storyEvents.find((e: any) => e.type === 'unlock').feature = 'abakus';
    expect(problems(() => loadContent(c)).some((x) => x.startsWith('Tag 8, storyEvents'))).toBe(true);
  });

  it('meldet Ereigniskarte mit nicht ganzzahliger Wirkung', () => {
    const c = raw();
    day(c, 9).storyEvents.find((e: any) => e.type === 'event').options[0].effects.time = 0.5;
    expect(problems(() => loadContent(c)).some((x) => x.startsWith('Tag 9, storyEvents.3.options.0.effects.time'))).toBe(true);
  });

  it('meldet Betrag mit mehr als zwei Nachkommastellen', () => {
    const c = raw();
    kase(c, '9-5').decisions[2].correct = 4236.705;
    expect(problems(() => loadContent(c)).some((x) => x.startsWith('Akte 9-5, decisions.2'))).toBe(true);
  });

  it('meldet Entscheidung ohne Regel', () => {
    const c = raw();
    kase(c, '4-2').decisions[0].rules = [];
    expect(problems(() => loadContent(c)).some((x) => x.startsWith('Akte 4-2, decisions.0'))).toBe(true);
  });

  it('meldet fehlenden texts-Block und fehlenden Stempelnamen', () => {
    const c = raw();
    delete c.texts;
    expect(problems(() => loadContent(c)).some((x) => x.startsWith('texts'))).toBe(true);
    const d = raw();
    delete d.texts.stampLabels.ergaenzung;
    expect(problems(() => loadContent(d)).some((x) => x.startsWith('texts.stampLabels.ergaenzung'))).toBe(true);
  });
});

describe('loadContent: Querprüfungen', () => {
  it('meldet unbekannte Regeln', () => {
    const c = raw();
    c.cases[0].positions[0].rules = ['R99'];
    expect(problems(() => loadContent(c))).toContain('Akte 1-1: unbekannte Regel R99');
  });

  it('meldet Regel, die zu früh referenziert wird', () => {
    const c = raw();
    kase(c, '4-2').decisions[0].rules = ['R54'];
    expect(problems(() => loadContent(c))).toContain('Akte 4-2: Regel R54 wird erst an Tag 10 freigeschaltet, die Akte liegt an Tag 4 auf dem Tisch');
  });

  it('meldet Regel, die in einer Folgeakte zu früh referenziert wird', () => {
    const c = raw();
    kase(c, '4-1').followUp.decisions[0].rules = ['R30'];
    const rule = c.rules.find((r: any) => r.id === 'R30');
    expect(rule.day).toBeGreaterThan(5);
    expect(problems(() => loadContent(c))).toContain(`Akte 4-1 (Folgeakte): Regel R30 wird erst an Tag ${rule.day} freigeschaltet, die Akte liegt an Tag 5 auf dem Tisch`);
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
    kase(c, '3-1').decision.correct = 'vielleicht';
    expect(problems(() => loadContent(c)).some((x) => x.includes('vielleicht'))).toBe(true);
    const d = raw();
    kase(d, '4-2').decisions[1].correct = 'vielleicht';
    expect(problems(() => loadContent(d))).toContain('Akte 4-2, Entscheidung d2: richtige Option „vielleicht“ ist nicht unter den Optionen');
  });

  it('meldet Stempel, der am Tag nicht verfügbar ist', () => {
    const c = raw();
    c.cases[0].correctStamp = 'ergaenzung';
    expect(problems(() => loadContent(c)).some((x) => x.includes('nicht verfügbar'))).toBe(true);
  });

  it('meldet offene Entscheidung ohne Ergänzungsersuchen und umgekehrt', () => {
    const c = raw();
    kase(c, '4-2').decisions[0].correct = 'offen';
    expect(problems(() => loadContent(c))).toContain('Akte 4-2: hat eine offene Entscheidung, richtiger Stempel muss „ergaenzung“ sein');
    const d = raw();
    kase(d, '4-2').correctStamp = 'ergaenzung';
    expect(problems(() => loadContent(d))).toContain('Akte 4-2: Ergänzungsersuchen als richtiger Stempel, aber keine Entscheidung ist „offen“');
  });

  it('meldet Folgeakte an einem Tag, den es nicht gibt', () => {
    const c = raw();
    kase(c, '3-4').followUp.arrivesOnDay = 99;
    expect(problems(() => loadContent(c))).toContain('Akte 3-4: Folgeakte trifft an Tag 99 ein, den es nicht gibt');
  });

  it('meldet Option ohne Anzeigenamen und Anzeigenamen ohne Option', () => {
    const c = raw();
    delete c.texts.optionLabels.beschraenkt;
    expect(problems(() => loadContent(c))).toContain('Akte 3-1: Option „beschraenkt“ fehlt in texts.optionLabels');
    const d = raw();
    delete d.texts.optionLabels.keineBa;
    expect(problems(() => loadContent(d))).toContain('Akte 5-3, Entscheidung d1: Option „keineBa“ fehlt in texts.optionLabels');
    const e = raw();
    e.texts.optionLabels.unbeschränkt = 'Tippfehler im Schlüssel';
    expect(problems(() => loadContent(e))).toContain('texts.optionLabels: Schlüssel „unbeschränkt“ kommt in keiner Entscheidung vor');
  });

  it('Optionen als Objekt brauchen keinen Anzeigenamen in texts', () => {
    const c = raw();
    expect(kase(c, '4-5').decisions[0].options[0]).toMatchObject({ value: 'a1' });
    expect(problems(() => loadContent(c))).toEqual([]);
  });

  it('meldet „offen“ als Option und doppelte Optionen', () => {
    const c = raw();
    kase(c, '4-2').decisions[0].options.push('offen');
    expect(problems(() => loadContent(c))).toContain('Akte 4-2, Entscheidung d1: „offen“ darf keine Option sein');
    const d = raw();
    kase(d, '4-2').decisions[0].options.push('steuerfrei');
    expect(problems(() => loadContent(d))).toContain('Akte 4-2, Entscheidung d1: Option doppelt: „steuerfrei“');
  });

  it('meldet doppelte IDs', () => {
    const c = raw();
    c.rules.push(clone(c.rules[0]));
    expect(problems(() => loadContent(c))).toContain('Regel-ID doppelt: R1');
    const d = raw();
    kase(d, '4-2').decisions[1].id = 'd1';
    expect(problems(() => loadContent(d))).toContain('Akte 4-2: Entscheidung doppelt: d1');
  });

  it('meldet doppelte Dokumenttitel und Zeilen', () => {
    const c = raw();
    const k = kase(c, '5-3');
    k.documents[1].title = k.documents[0].title;
    expect(problems(() => loadContent(c))).toContain(`Akte 5-3: Dokumenttitel doppelt: „${k.documents[0].title}“`);
    const d = raw();
    const doc = kase(d, '5-3').documents[0];
    doc.lines.push(clone(doc.lines[0]));
    expect(problems(() => loadContent(d))).toContain(`Akte 5-3, Dokument „${doc.title}“: Zeile doppelt: „${doc.lines[0][0]}“`);
  });

  describe('Widersprüche', () => {
    it('meldet unbekannte Zeile', () => {
      const c = raw();
      kase(c, '5-3').discrepancies[0].b.line = 'Abreise';
      expect(problems(() => loadContent(c))).toContain('Akte 5-3, Widerspruch w1: Zeile „Abreise“ fehlt in Dokument „Hotelrechnung Wien“');
    });
    it('meldet unbekanntes Dokument', () => {
      const c = raw();
      kase(c, '5-3').discrepancies[0].a.document = 'Flugticket';
      expect(problems(() => loadContent(c))).toContain('Akte 5-3, Widerspruch w1: Dokument „Flugticket“ gibt es in der Akte nicht');
    });
    it('meldet unbekannte Entscheidung', () => {
      const c = raw();
      kase(c, '5-3').discrepancies[0].decision = 'd9';
      expect(problems(() => loadContent(c))).toContain('Akte 5-3, Widerspruch w1: unbekannte Entscheidung d9');
    });
    it('meldet a und b im selben Dokument', () => {
      const c = raw();
      const w = kase(c, '5-3').discrepancies[0];
      w.b = { document: w.a.document, line: w.a.line };
      expect(problems(() => loadContent(c))).toContain(`Akte 5-3, Widerspruch w1: a und b liegen im selben Dokument „${w.a.document}“`);
    });
    it('verlangt texts.missedDiscrepancy und texts.falseDiscrepancy', () => {
      const c = raw();
      delete c.texts.missedDiscrepancy;
      expect(problems(() => loadContent(c))).toContain('texts.missedDiscrepancy fehlt, wird für Widersprüche gebraucht');
    });
  });

  describe('Nachfrage', () => {
    it('meldet Nachfrage ohne followUp', () => {
      const c = raw();
      delete kase(c, '6-3').followUp;
      expect(problems(() => loadContent(c))).toContain('Akte 6-3, Nachfrage: Akte mit Nachfrage braucht einen followUp');
    });
    it('meldet Nachfrage zu einer Entscheidung, die nicht offen ist', () => {
      const c = raw();
      kase(c, '6-3').inquiry.decision = 'd1';
      expect(problems(() => loadContent(c))).toContain('Akte 6-3, Nachfrage: Entscheidung d1 ist nicht „offen“');
    });
    it('meldet unbekannte richtige Frage und unbekannte Entscheidung', () => {
      const c = raw();
      kase(c, '6-3').inquiry.correct = 'q9';
      expect(problems(() => loadContent(c))).toContain('Akte 6-3, Nachfrage: richtige Frage „q9“ ist nicht unter den Fragen');
      const d = raw();
      kase(d, '6-3').inquiry.decision = 'd9';
      expect(problems(() => loadContent(d))).toContain('Akte 6-3, Nachfrage: unbekannte Entscheidung d9');
    });
    it('verlangt texts.wrongInquiry', () => {
      const c = raw();
      delete c.texts.wrongInquiry;
      expect(problems(() => loadContent(c))).toContain('texts.wrongInquiry fehlt, wird für Nachfragen gebraucht');
    });
  });

  it('meldet variantOf auf eine unbekannte Akte', () => {
    const c = raw();
    kase(c, '7-2').variantOf = '7-9';
    expect(problems(() => loadContent(c))).toContain('Akte 7-2: variantOf zeigt auf unbekannte Akte 7-9');
  });

  describe('Spuren', () => {
    it('meldet unbekannte Akte, Dokument, Zeile und Feld', () => {
      const c = raw();
      const [l1, l2] = day(c, 7).traces[0].links;
      l1.line = 'Datum';
      l2.document = 'Lieferschein';
      day(c, 10).traces[0].links[0].field = 'steuerberater';
      day(c, 10).traces[0].links[1].case = '4-9';
      const p = problems(() => loadContent(c));
      expect(p).toContain('Tag 7, Spur t1: Akte 5-3, Dokument „Rechnung Eventservice GmbH“ hat keine Zeile „Datum“');
      expect(p).toContain('Tag 7, Spur t1: Akte 7-3 hat kein Dokument „Lieferschein“');
      expect(p).toContain('Tag 10, Spur t2: Akte 2-4 hat kein Feld „steuerberater“');
      expect(p).toContain('Tag 10, Spur t2: unbekannte Akte 4-9');
    });
    it('verlangt mindestens zwei Verweise', () => {
      const c = raw();
      day(c, 7).traces[0].links.pop();
      expect(problems(() => loadContent(c)).some((x) => x.startsWith('Tag 7, traces.0.links'))).toBe(true);
    });
  });

  it('Fehlermeldung ist lesbar', () => {
    const c = raw();
    c.cases[0].positions[0].rules = ['R99'];
    expect(() => loadContent(c)).toThrow(/Inhaltsdatei ungültig:\n- Akte 1-1: unbekannte Regel R99/);
  });

  it('getAkte liefert reguläre Akten und Folgeakten beider Typen', () => {
    const c = loadContent(raw());
    expect(getAkte(c, '1-1').isFollowUp).toBe(false);
    const f = getAkte(c, '3-4/folge');
    expect(f.isFollowUp).toBe(true);
    expect(f.taxpayer.name).toBe('Petra Lang');
    expect(f.correctStamp).toBe('bescheid');
    const e = getAkte(c, '9-2/folge');
    expect(e.kind.type).toBe('entscheidungen');
    expect(e.kind.type === 'entscheidungen' && e.kind.inquiry).toBeUndefined();
    expect(() => getAkte(c, '99-9')).toThrow();
  });
});

describe('loadContentFiles: Zusammenführen', () => {
  const file = (name: string, data: unknown) => ({ name, data });

  /** The real Akt I split into two files after day 3. */
  function split() {
    const c = raw();
    const early = new Set(c.days.filter((d: any) => d.day <= 3).flatMap((d: any) => d.cases));
    const a = { meta: c.meta, texts: c.texts, rules: c.rules.filter((r: any) => r.day <= 3), days: c.days.filter((d: any) => d.day <= 3), cases: c.cases.filter((k: any) => early.has(k.id)) };
    const b = {
      meta: { version: '9.9.9' },
      texts: { optionLabels: {} as Record<string, string> },
      rules: c.rules.filter((r: any) => r.day > 3),
      days: c.days.filter((d: any) => d.day > 3),
      cases: c.cases.filter((k: any) => !early.has(k.id)),
    };
    return { a, b };
  }

  it('hängt Regeln, Tage und Akten aneinander', () => {
    const { a, b } = split();
    const merged = loadContentFiles([file('akt1.json', a), file('akt2.json', b)]);
    expect(merged.days).toHaveLength(10);
    expect(merged.cases).toHaveLength(48);
    expect(merged.rules).toHaveLength(54);
    expect(merged.meta.version).toBe(a.meta.version);
  });

  it('führt texts schlüsselweise zusammen, optionLabels als Vereinigung', () => {
    const { a, b } = split();
    // Move the labels used only after day 3 and the discrepancy texts to the second file.
    for (const k of Object.keys(a.texts.optionLabels)) {
      if (!['unbeschraenkt', 'beschraenkt'].includes(k)) {
        b.texts.optionLabels[k] = a.texts.optionLabels[k];
        delete a.texts.optionLabels[k];
      }
    }
    Object.assign(b.texts, { wrongInquiry: a.texts.wrongInquiry, missedDiscrepancy: a.texts.missedDiscrepancy, emptyDay: a.texts.emptyDay });
    delete a.texts.wrongInquiry;
    delete a.texts.missedDiscrepancy;
    delete a.texts.emptyDay;
    const merged = loadContentFiles([file('akt1.json', a), file('akt2.json', b)]);
    expect(merged.texts.optionLabels.unbeschraenkt).toBeDefined();
    expect(merged.texts.optionLabels.keineBa).toBeDefined();
    expect(merged.texts.wrongInquiry).toBe(raw().texts.wrongInquiry);
    expect(merged.texts.emptyDay).toBe(raw().texts.emptyDay);
  });

  it('meldet denselben Text mit verschiedenem Wert in zwei Dateien', () => {
    const { a, b } = split();
    Object.assign(b.texts, { emptyDay: 'Anderer Text.' });
    b.texts.optionLabels.ja = 'jawohl';
    const p = problems(() => loadContentFiles([file('akt1.json', a), file('akt2.json', b)]));
    expect(p).toContain('texts.emptyDay: verschiedene Werte in akt1.json und akt2.json');
    expect(p).toContain('texts.optionLabels.ja: verschiedene Werte in akt1.json und akt2.json');
  });

  it('gleicher Text mit gleichem Wert ist kein Fehler', () => {
    const { a, b } = split();
    Object.assign(b.texts, { emptyDay: a.texts.emptyDay, warning: clone(a.texts.warning) });
    expect(problems(() => loadContentFiles([file('akt1.json', a), file('akt2.json', b)]))).toEqual([]);
  });

  it('Pflichtschlüssel müssen nach dem Zusammenführen vorhanden sein', () => {
    const { a, b } = split();
    delete a.texts.warning;
    expect(problems(() => loadContentFiles([file('akt1.json', a), file('akt2.json', b)]))).toContain('texts.warning fehlt in allen Inhaltsdateien');
  });

  it('meldet doppelte Akten, Regeln und Tage über Dateien hinweg', () => {
    const { a, b } = split();
    b.cases.push(clone(a.cases[0]));
    b.rules.push(clone(a.rules[0]));
    b.days.push({ ...clone(a.days[0]), cases: [] });
    const p = problems(() => loadContentFiles([file('akt1.json', a), file('akt2.json', b)]));
    expect(p).toContain('Akten-ID doppelt: 1-1');
    expect(p).toContain('Regel-ID doppelt: R1');
    expect(p).toContain('Tag doppelt: 1');
  });

  it('jede Datei braucht meta.version, alle Versionen stehen in der Meldung', () => {
    const { a, b } = split();
    delete (b as any).meta;
    let err: ContentError | null = null;
    try {
      loadContentFiles([file('akt1.json', a), file('akt2.json', b)]);
    } catch (e) {
      err = e as ContentError;
    }
    expect(err?.problems).toContain('akt2.json: meta.version fehlt');
    expect(err?.message).toContain(`Versionen: akt1.json ${a.meta.version}, akt2.json ?`);
  });

  it('auch Querprüfungsfehler nennen die Versionen', () => {
    const { a, b } = split();
    b.cases[0].decisions[0].rules = ['R99'];
    expect(() => loadContentFiles([file('akt1.json', a), file('akt2.json', b)])).toThrow(/Versionen: akt1\.json [\d.]+, akt2\.json 9\.9\.9/);
  });

  it('keine Datei ist ein Fehler', () => {
    expect(problems(() => loadContentFiles([]))).toEqual(['Keine Inhaltsdateien gefunden']);
  });
});
