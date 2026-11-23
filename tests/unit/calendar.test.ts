import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  calendarStart,
  daysBetween,
  easterSunday,
  holidaysOfYear,
  monthGrid,
  shiftMonth,
  weekday,
  type CalDate,
} from '../../src/core/calendar';
import { applyStamp, beginWork, drawNext, finishPrologue, newGame } from '../../src/core/game';
import { ContentError, loadCalendar, loadContentFiles } from '../../src/core/loader';
import { loadGame, saveGame } from '../../src/core/save';
import { clone, MemoryStore, rawContentFiles, realContent } from './helpers';

const rawCalendar = JSON.parse(readFileSync(join(__dirname, '..', '..', 'content', 'kalender.json'), 'utf8')) as Record<string, unknown>;
const calendar = loadCalendar(rawCalendar);
const d = (year: number, month: number, day: number): CalDate => ({ year, month, day });

describe('Ostersonntag (gregorianisch)', () => {
  it.each([
    [2024, 3, 31],
    [2025, 4, 20],
    [2026, 4, 5],
    [2027, 3, 28],
    [2028, 4, 16],
    [2029, 4, 1],
    [2030, 4, 21],
  ])('%i: %i/%i', (year, month, day) => {
    expect(easterSunday(year)).toEqual(d(year, month, day));
    expect(weekday(easterSunday(year))).toBe(6);
  });
});

describe('Feiertage aus kalender.json', () => {
  const h2026 = holidaysOfYear(calendar, 2026);
  const dates = h2026.map((h) => `${h.date.day}.${h.date.month}.`);

  it('2026 vollständig und nach Datum sortiert', () => {
    expect(dates).toEqual(['1.1.', '6.1.', '6.4.', '1.5.', '14.5.', '25.5.', '4.6.', '15.8.', '26.10.', '1.11.', '8.12.', '25.12.', '26.12.']);
  });

  it('Namen kommen aus dem JSON, 6. April 2026 ist Ostermontag', () => {
    expect(h2026.find((h) => h.date.month === 4 && h.date.day === 6)?.name).toBe('Ostermontag');
    expect(h2026.every((h) => h.name.trim().length > 0)).toBe(true);
  });

  it('Karfreitag 3. April 2026 und 24. Dezember 2026 sind keine Feiertage', () => {
    expect(dates).not.toContain('3.4.');
    expect(dates).not.toContain('24.12.');
  });

  it('bewegliche Feiertage folgen dem Ostersonntag des Jahres', () => {
    const h2027 = holidaysOfYear(calendar, 2027);
    expect(h2027.find((h) => h.name === 'Ostermontag')?.date).toEqual(d(2027, 3, 29));
    expect(h2027.find((h) => h.name === 'Pfingstmontag')?.date).toEqual(d(2027, 5, 17));
  });
});

describe('daysBetween', () => {
  it.each([
    [d(2026, 3, 21), d(2026, 4, 3), 13],
    [d(2026, 4, 3), d(2026, 3, 21), 13],
    [d(2026, 1, 31), d(2026, 2, 1), 1],
    [d(2025, 12, 24), d(2026, 1, 7), 14],
    [d(2028, 2, 28), d(2028, 3, 1), 2],
    [d(2027, 2, 28), d(2027, 3, 1), 1],
    [d(2026, 5, 5), d(2026, 5, 5), 0],
    // Across the change to summer time, still whole days.
    [d(2026, 3, 28), d(2026, 3, 30), 2],
  ])('%o bis %o: %i', (a, b, n) => expect(daysBetween(a, b)).toBe(n));
});

describe('monthGrid', () => {
  it('Februar 2026 beginnt an einem Sonntag', () => {
    const g = monthGrid(2026, 2);
    expect(g[0]).toEqual([null, null, null, null, null, null, 1]);
    expect(g.flat().filter((x) => x !== null)).toHaveLength(28);
    expect(g.at(-1)).toEqual([23, 24, 25, 26, 27, 28, null]);
  });

  it('März 2026: Sonntag der 1., Dienstag der 31.', () => {
    const g = monthGrid(2026, 3);
    expect(g[0]).toEqual([null, null, null, null, null, null, 1]);
    expect(g).toHaveLength(6);
    expect(g.at(-1)).toEqual([30, 31, null, null, null, null, null]);
  });

  it('Februar im Schaltjahr 2028 hat 29 Tage', () => {
    const g = monthGrid(2028, 2);
    expect(g.flat().filter((x) => x !== null)).toHaveLength(29);
    expect(g[0]).toEqual([null, 1, 2, 3, 4, 5, 6]);
  });

  it('jede Woche hat sieben Felder', () => {
    for (let m = 1; m <= 12; m++) for (const w of monthGrid(2026, m)) expect(w).toHaveLength(7);
  });
});

describe('Monate blättern und Startmonat', () => {
  it('über den Jahreswechsel', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 4 }, -16)).toEqual({ year: 2024, month: 12 });
  });

  it('Akt I schlägt im April 2026 auf, ohne Angabe im Jänner nach dem Veranlagungsjahr', () => {
    expect(calendarStart(realContent().meta)).toEqual({ year: 2026, month: 4 });
    expect(calendarStart({ veranlagungsjahr: 2025 })).toEqual({ year: 2026, month: 1 });
  });
});

describe('Loader: kalender.json', () => {
  const broken = (patch: (c: { holidays: { fixed: { date: string; name: string }[]; easter: { offset: number; name: string }[] } }) => void) => {
    const c = clone(rawCalendar) as never;
    patch(c);
    return () => loadCalendar(c);
  };
  const problems = (f: () => unknown) => {
    try {
      f();
    } catch (e) {
      expect(e).toBeInstanceOf(ContentError);
      return (e as ContentError).message;
    }
    throw new Error('kein Fehler');
  };

  it('die echte Datei ist gültig', () => {
    expect(calendar.holidays.fixed.length).toBe(9);
    expect(calendar.holidays.easter.length).toBe(4);
  });

  it('meldet Monat 13', () => {
    expect(problems(broken((c) => (c.holidays.fixed[0]!.date = '13-01')))).toMatch(/kalender\.json, holidays\.fixed\.0\.date: kein gültiges Datum/);
  });

  it('meldet einen Tag, den es im Monat nicht gibt, und ein falsches Format', () => {
    expect(problems(broken((c) => (c.holidays.fixed[0]!.date = '04-31')))).toMatch(/kein gültiges Datum/);
    expect(problems(broken((c) => (c.holidays.fixed[0]!.date = '1-1')))).toMatch(/Format MM-TT/);
  });

  it('meldet doppeltes Datum und doppelten Abstand', () => {
    expect(problems(broken((c) => (c.holidays.fixed[1]!.date = c.holidays.fixed[0]!.date)))).toMatch(/Datum 01-01 doppelt/);
    expect(problems(broken((c) => (c.holidays.easter[1]!.offset = c.holidays.easter[0]!.offset)))).toMatch(/Abstand 1 doppelt/);
  });

  it('meldet leeren Namen und nennt die Version', () => {
    const msg = problems(broken((c) => (c.holidays.easter[2]!.name = '  ')));
    expect(msg).toMatch(/holidays\.easter\.2\.name: Name ist leer/);
    expect(msg).toMatch(/Versionen: kalender\.json 0\.1\.0/);
  });
});

describe('Inhalt: unlock calendar und meta.kalenderStart', () => {
  it('Tag 4 schaltet den Kalender frei', () => {
    const day4 = realContent().days.find((x) => x.day === 4)!;
    expect(day4.storyEvents).toContainEqual({ type: 'unlock', feature: 'calendar' });
  });

  it('kalenderStart im falschen Format ist ein Ladefehler', () => {
    const files = rawContentFiles();
    (files[0]!.data as { meta: { kalenderStart: string } }).meta.kalenderStart = '2026-13';
    expect(() => loadContentFiles(files)).toThrow(/meta\.kalenderStart|Monat im Format JJJJ-MM/);
  });
});

describe('Neuladen mit offener Akte (SPEC 9)', () => {
  const content = realContent();

  it('eine ungestempelte Akte liegt wieder oben im Eingang, ihre Eingaben sind leer', () => {
    const store = new MemoryStore();
    let s = drawNext(beginWork(finishPrologue(content, newGame(content))));
    const id = s.current!.akteId;
    s = { ...s, current: { akteId: id, answer: { positions: { p1: 'anerkennen' } } } };
    saveGame(store, s);
    const loaded = loadGame(store, content)!;
    expect(loaded.current).toBeNull();
    expect(loaded.queue).toEqual([id, ...s.queue]);
    expect(drawNext(loaded).current).toEqual({ akteId: id, answer: { positions: {} } });
  });

  it('eine gestempelte Akte bleibt am Tisch', () => {
    const store = new MemoryStore();
    const s = applyStamp(content, drawNext(beginWork(finishPrologue(content, newGame(content)))), 'bescheid');
    saveGame(store, s);
    expect(loadGame(store, content)).toEqual(s);
  });
});
