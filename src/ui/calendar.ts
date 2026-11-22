import { compareDates, daysBetween, holidaysOfYear, monthGrid, sameDate, shiftMonth, weekday, type CalDate } from '../core/calendar';
import type { CalendarContent } from '../core/schema';
import { h } from './dom';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Arrow for the month buttons, without text. */
function chevron(dir: -1 | 1): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', 'chevron');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', dir > 0 ? 'M5 2l6 6-6 6' : 'M11 2L5 8l6 6');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  svg.append(path);
  return svg;
}
import { t } from './text';

/*
 * Desk calendar (SPEC 7.5). Names of months and weekdays come from
 * Intl.DateTimeFormat with de-AT („Jänner“), never from the code. No „today“:
 * the game has no date. Counting days only shows the distance, it computes no deadline.
 */

export interface CalendarView {
  year: number;
  month: number;
  /** Zero, one or two chosen days, in click order. */
  sel: CalDate[];
}

const LOCALE = 'de-AT';
const utc = (d: CalDate) => new Date(Date.UTC(d.year, d.month - 1, d.day));
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE, { ...o, timeZone: 'UTC' });

const monthName = (year: number, month: number) => fmt({ month: 'long' }).format(utc({ year, month, day: 1 }));
/** „Sa., 21. März 2026“ */
export const longDate = (d: CalDate) => fmt({ weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(utc(d));
/** Short weekday names from Monday (2024-01-01 was a Monday). */
const weekdayNames = () => Array.from({ length: 7 }, (_, i) => fmt({ weekday: 'short' }).format(utc({ year: 2024, month: 1, day: 1 + i })));

export interface CalendarActions {
  month(by: 1 | -1): void;
  pick(d: CalDate): void;
  putBack(): void;
}

/** Closed: a pad with ring binding showing year and month. */
export function closedCalendar(view: CalendarView, attrs: Record<string, string | number>): HTMLElement {
  return h(
    'div',
    { ...attrs, class: `${attrs.class ?? ''} calendar-closed`, role: 'button', tabindex: 0, 'aria-label': t('aria.calendar', { month: monthName(view.year, view.month), year: view.year }) },
    h('span', { class: 'cal-rings', 'aria-hidden': 'true' }),
    h('span', { class: 'cal-year', 'aria-hidden': 'true' }, view.year),
    h('span', { class: 'cal-month', 'aria-hidden': 'true' }, monthName(view.year, view.month)),
  );
}

function countText(sel: CalDate[]): string {
  if (sel.length === 0) return t('calendar.countHint');
  if (sel.length === 1) return t('calendar.countStart', { date: longDate(sel[0]!) });
  const [a, b] = [...sel].sort(compareDates) as [CalDate, CalDate];
  const days = daysBetween(a, b);
  return days === 1 ? t('calendar.countResultOne', { from: longDate(a), to: longDate(b) }) : t('calendar.countResult', { from: longDate(a), to: longDate(b), days });
}

/** Open: one month, Monday to Sunday, weekends tinted, Sundays and holidays in red. */
export function openCalendar(cal: CalendarContent, view: CalendarView, a: CalendarActions, attrs: Record<string, string | number>): HTMLElement {
  const { year, month } = view;
  const holidays = new Map(holidaysOfYear(cal, year).map((x) => [`${x.date.month}-${x.date.day}`, x.name]));
  const sorted = [...view.sel].sort(compareDates);
  const [lo, hi] = sorted.length === 2 ? sorted : [null, null];
  const title = t('calendar.monthYear', { month: monthName(year, month), year });

  const cells = monthGrid(year, month)
    .flat()
    .map((day) => {
      if (day === null) return h('span', { class: 'cal-empty', 'aria-hidden': 'true' });
      const date = { year, month, day };
      const wd = weekday(date);
      const holiday = holidays.get(`${month}-${day}`);
      const chosen = view.sel.some((s) => sameDate(s, date));
      const between = lo && hi && compareDates(date, lo) > 0 && compareDates(date, hi) < 0;
      const cls = ['cal-day', wd >= 5 ? 'weekend' : '', wd === 6 ? 'sunday' : '', holiday ? 'holiday' : '', chosen ? 'chosen' : '', between ? 'between' : ''].filter(Boolean).join(' ');
      return h(
        'button',
        {
          class: cls,
          'data-key': `cal-${year}-${month}-${day}`,
          'aria-label': holiday ? t('aria.calendarHoliday', { date: longDate(date), name: holiday }) : t('aria.calendarDay', { date: longDate(date) }),
          'aria-pressed': String(chosen),
          title: holiday ?? null,
          onclick: () => a.pick(date),
        },
        day,
      );
    });

  return h(
    'section',
    { ...attrs, class: `${attrs.class ?? ''} calendar-open`, tabindex: 0, 'aria-label': t('aria.calendar', { month: monthName(year, month), year }) },
    h('p', { class: 'cal-label', 'aria-hidden': 'true' }, t('calendar.heading')),
    h(
      'header',
      { class: 'cal-head' },
      h('button', { class: 'cal-nav', 'data-key': 'cal-prev', 'aria-label': t('calendar.prevMonth'), onclick: () => a.month(-1) }, chevron(-1)),
      h('h2', { class: 'cal-title' }, title),
      h('button', { class: 'cal-nav', 'data-key': 'cal-next', 'aria-label': t('calendar.nextMonth'), onclick: () => a.month(1) }, chevron(1)),
      h('button', { class: 'put-back', 'data-key': 'cal-putback', onclick: a.putBack }, t('desk.putBack')),
    ),
    h('div', { class: 'cal-grid' }, weekdayNames().map((n, i) => h('span', { class: `cal-wd${i >= 5 ? ' weekend' : ''}`, 'aria-hidden': 'true' }, n)), cells),
    h('p', { class: 'cal-count', role: 'status', 'aria-live': 'polite' }, countText(view.sel)),
  );
}

/** Next month view; the selection stays. */
export const turnMonth = (v: CalendarView, by: number): CalendarView => ({ ...v, ...shiftMonth(v, by) });

/** Click on a day: first sets the start, second the end, a third starts again (SPEC 7.5). */
export function pickDay(v: CalendarView, d: CalDate): CalendarView {
  return { ...v, sel: v.sel.length === 1 && !sameDate(v.sel[0]!, d) ? [v.sel[0]!, d] : [d] };
}
