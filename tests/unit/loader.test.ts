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

  describe('Fragen der Pinnwand (SPEC 3)', () => {
    const q = (c: any, id: string) => c.days.flatMap((d: any) => d.questions ?? []).find((x: any) => x.id === id);
    const p = (c: any) => problems(() => loadContent(c));

    it('lädt die Fragen von Akt I ohne Fehler', () => {
      expect(p(raw())).toEqual([]);
    });
    it('meldet unbekannte Akte, Dokument und Zeile', () => {
      const c = raw();
      q(c, 'q1').clues[1].line = 'Datum';
      q(c, 'q2').clues[0].document = 'Lieferschein';
      q(c, 'q3').clues[2].case = '4-9';
      expect(p(c)).toEqual(
        expect.arrayContaining([
          'Tag 7, Frage q1, Hinweis 2: Akte 7-3, Dokument „Rechnung Eventservice GmbH“ hat keine Zeile „Datum“',
          'Tag 7, Frage q2, Hinweis 1: Akte 2-4 hat kein Dokument „Lieferschein“',
          'Tag 10, Frage q3, Hinweis 3: unbekannte Akte 4-9',
        ]),
      );
    });
    it('verlinkt nur Unterlagen der Akte selbst, nicht die der Folgeakte', () => {
      const c = raw();
      const k = c.cases.find((x: any) => x.followUp && c.days.find((d: any) => d.cases.includes(x.id)).day < 7);
      const doc = k.followUp.documents.find((d: any) => !k.documents.some((o: any) => o.title === d.title));
      q(c, 'q1').clues[1] = { case: k.id, document: doc.title, line: doc.lines[0][0] };
      expect(p(c)).toContain(`Tag 7, Frage q1, Hinweis 2: Akte ${k.id} hat kein Dokument „${doc.title}“`);
    });
    it('meldet einen Hinweis auf eine Akte nach dem Tag der Frage', () => {
      const c = raw();
      q(c, 'q1').clues[1] = { case: '8-1', document: kase(c, '8-1').documents[0].title, line: kase(c, '8-1').documents[0].lines[0][0] };
      expect(p(c)).toContain('Tag 7, Frage q1, Hinweis 2: Akte 8-1 kommt erst an Tag 8, die Frage hängt ab Tag 7');
    });
    it('meldet given mit einer Akte vom selben Tag', () => {
      const c = raw();
      q(c, 'q3').clues[2].given = true;
      q(c, 'q3').clues[0].given = undefined;
      expect(p(c)).toContain('Tag 10, Frage q3, Hinweis 3: vorgegebener Hinweis aus Akte 10-4 muss vor Tag 10 kommen');
    });
    it('meldet given an einer Frage ohne from', () => {
      const c = raw();
      delete q(c, 'q1').from;
      expect(p(c)).toContain('Tag 7, Frage q1, Hinweis 1: vorgegebener Hinweis braucht eine Figur in „from“ der Frage');
    });
    it('meldet eine Frage, deren Hinweise alle given sind', () => {
      const c = raw();
      q(c, 'q1').clues[1] = { ...q(c, 'q1').clues[0] };
      q(c, 'q1').clues[1].line = 'Rechnungsnummer';
      q(c, 'q1').clues.pop();
      expect(p(c)).toContain('Tag 7, Frage q1: mindestens ein Hinweis darf nicht „given“ sein');
    });
    it('meldet field ungleich representative', () => {
      const c = raw();
      q(c, 'q3').clues[2].field = 'steuerberater';
      expect(p(c)).toContain('Tag 10, Frage q3, Hinweis 3: Feld „steuerberater“ gibt es nicht, erlaubt ist nur „representative“');
    });
    it('meldet einen Vertreter ohne sichtbaren Stempel', () => {
      const c = raw();
      kase(c, '10-4').representative.stampVisible = false;
      expect(p(c)).toContain('Tag 10, Frage q3, Hinweis 3: Akte 10-4 hat keinen sichtbaren Kanzleistempel');
    });
    it('meldet eine doppelte Frage-ID', () => {
      const c = raw();
      q(c, 'q3').id = 'q1';
      expect(p(c)).toContain('Frage-ID doppelt: q1');
    });
    it('meldet after auf eine unbekannte Frage', () => {
      const c = raw();
      q(c, 'q2').after = 'q9';
      expect(p(c)).toContain('Tag 7, Frage q2: after zeigt auf unbekannte Frage q9');
    });
    it('meldet after auf eine spätere Frage', () => {
      const c = raw();
      q(c, 'q2').after = 'q3';
      expect(p(c)).toContain('Tag 7, Frage q2: after zeigt auf Frage q3 von Tag 10, die später kommt');
    });
    it('meldet einen Kreis über after', () => {
      const c = raw();
      q(c, 'q1').after = 'q2';
      expect(p(c)).toEqual(expect.arrayContaining(['Tag 7, Frage q1: Kreis über after', 'Tag 7, Frage q2: Kreis über after']));
    });
    it('meldet eine Frage vor unlock: pinboard', () => {
      const c = raw();
      day(c, 6).questions = [q(c, 'q2')];
      day(c, 6).questions[0] = { ...q(c, 'q2'), id: 'q0', after: undefined };
      expect(p(c)).toContain('Tag 6, Frage q0: die Pinnwand ist an diesem Tag noch nicht freigeschaltet');
    });
    it('meldet ein unbekanntes Feld an einer Frage', () => {
      const c = raw();
      q(c, 'q1').reward = 'x';
      expect(p(c).some((x) => x.startsWith('Tag 7, questions.0'))).toBe(true);
    });
  });

  describe('Lade (SPEC 3, 7.7)', () => {
    const notes = (c: any, n: number) => day(c, n).storyEvents.filter((e: any) => e.type === 'note');
    it('meldet keep: "drawer" vor unlock: drawer', () => {
      const c = raw();
      const i = day(c, 6).storyEvents.findIndex((e: any) => e.type === 'note');
      day(c, 6).storyEvents[i].keep = 'drawer';
      expect(problems(() => loadContent(c))).toContain(`Tag 6, storyEvents.${i}: Zettel mit keep „drawer“, aber die Lade ist noch nicht freigeschaltet`);
    });
    it('meldet keep: "drawer" am selben Tag vor der Freischaltung', () => {
      const c = raw();
      const events = day(c, 10).storyEvents;
      const unlock = events.findIndex((e: any) => e.type === 'unlock');
      const [u] = events.splice(unlock, 1);
      events.push(u);
      const i = events.findIndex((e: any) => e.keep === 'drawer');
      expect(problems(() => loadContent(c))).toContain(`Tag 10, storyEvents.${i}: Zettel mit keep „drawer“, aber die Lade ist noch nicht freigeschaltet`);
    });
    it('meldet keep an einem anderen Typ als note', () => {
      const c = raw();
      const i = day(c, 10).storyEvents.findIndex((e: any) => e.type === 'dialog');
      day(c, 10).storyEvents[i].keep = 'drawer';
      expect(problems(() => loadContent(c)).some((x) => x.startsWith(`Tag 10, storyEvents.${i}`))).toBe(true);
    });
    it('Akt I hat zwei Zettel in der Lade an Tag 10', () => {
      expect(notes(raw(), 10).filter((e: any) => e.keep === 'drawer')).toHaveLength(2);
    });
  });

  it('nimmt provisional an jedem Story-Ereignis an', () => {
    const c = raw();
    for (const d of c.days) for (const e of d.storyEvents) e.provisional = true;
    expect(problems(() => loadContent(c))).toEqual([]);
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
