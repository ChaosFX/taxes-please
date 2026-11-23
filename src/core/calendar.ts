import type { CalendarContent } from './schema';

/**
 * Desk calendar (SPEC 3, 7.5). Pure calendar arithmetic, no tax rules: which
 * days are holidays comes only from `content/kalender.json`. Months run 1 to 12.
 */

export interface CalDate {
  year: number;
  month: number;
  day: number;
}

export interface Holiday {
  date: CalDate;
  name: string;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function daysInMonth(year: number, month: number): number {
  return [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}

const utc = (d: CalDate) => Date.UTC(d.year, d.month - 1, d.day);

function fromUtc(ms: number): CalDate {
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export const sameDate = (a: CalDate, b: CalDate) => a.year === b.year && a.month === b.month && a.day === b.day;

/** Negative if `a` is before `b`. */
export const compareDates = (a: CalDate, b: CalDate) => utc(a) - utc(b);

/** Day of the week, 0 = Monday … 6 = Sunday. */
export function weekday(d: CalDate): number {
  return (new Date(utc(d)).getUTCDay() + 6) % 7;
}

export function addDays(d: CalDate, n: number): CalDate {
  return fromUtc(utc(d) + n * 86_400_000);
}

/** Calendar days between two dates, whatever their order. */
export function daysBetween(a: CalDate, b: CalDate): number {
  return Math.round(Math.abs(utc(a) - utc(b)) / 86_400_000);
}

/** Easter Sunday in the Gregorian calendar (anonymous algorithm, Meeus/Jones/Butcher). */
export function easterSunday(year: number): CalDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

/**
 * Weeks of a month from Monday to Sunday. Each week has seven cells, the day of
 * the month or null for a cell before the first or after the last day.
 */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const lead = weekday({ year, month, day: 1 });
  const n = daysInMonth(year, month);
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** The month before or after: `shiftMonth({2026, 1}, -1)` is December 2025. */
export function shiftMonth(m: { year: number; month: number }, by: number): { year: number; month: number } {
  const i = m.year * 12 + (m.month - 1) + by;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}

/** Holidays of a year from the calendar content, by date. */
export function holidaysOfYear(cal: CalendarContent, year: number): Holiday[] {
  const easter = easterSunday(year);
  const out: Holiday[] = [
    ...cal.holidays.fixed.map((f) => {
      const [month, day] = f.date.split('-').map(Number) as [number, number];
      return { date: { year, month, day }, name: f.name };
    }),
    // Feb 29 exists only in leap years.
    ...cal.holidays.easter.map((e) => ({ date: addDays(easter, e.offset), name: e.name })),
  ].filter((h) => h.date.year === year && h.date.day <= daysInMonth(year, h.date.month));
  return out.sort((a, b) => compareDates(a.date, b.date));
}

/** Month the calendar opens with: `meta.kalenderStart` (`JJJJ-MM`), else January after the assessment year (SPEC 3). */
export function calendarStart(meta: { kalenderStart?: string; veranlagungsjahr: number }): { year: number; month: number } {
  if (meta.kalenderStart) {
    const [year, month] = meta.kalenderStart.split('-').map(Number) as [number, number];
    return { year, month };
  }
  return { year: meta.veranlagungsjahr + 1, month: 1 };
}
