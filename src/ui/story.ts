import type { Question, StoryEvent } from '../core/types';
import { h } from './dom';
import { t } from './text';

type Newspaper = Extract<StoryEvent, { type: 'newspaper' }>;

/** A narrow newspaper page: masthead `from`, big headline, text in columns (SPEC 7). */
export function newspaperSheet(e: Newspaper, attrs: Record<string, string | number> = {}): HTMLElement {
  return h(
    'article',
    { class: 'newspaper', ...attrs, 'aria-label': e.headline, 'aria-roledescription': t('intro.newspaper') },
    h('header', { class: 'masthead' }, e.from),
    h('h3', { class: 'headline' }, e.headline),
    h('p', { class: 'columns' }, e.text),
  );
}

/**
 * One story event at the start of the day. Events that this version only
 * checks (`event`, `actSummary`) show nothing.
 */
export function storyEvent(e: StoryEvent): HTMLElement | null {
  switch (e.type) {
    case 'note':
      return h(
        'figure',
        { class: 'note' },
        e.title ? h('h2', { class: 'note-title' }, e.title) : null,
        h('blockquote', {}, e.text),
        h('figcaption', {}, t('intro.noteFrom', { from: e.from })),
      );
    case 'dialog':
      return h('figure', { class: 'dialog' }, h('figcaption', {}, t('intro.speaker', { from: e.from })), h('blockquote', {}, e.text));
    case 'newspaper':
      return newspaperSheet(e, { class: 'newspaper intro-paper' });
    case 'call':
      return h(
        'figure',
        { class: 'call' },
        h('div', { class: 'phone', 'aria-hidden': 'true' }),
        h('div', { class: 'dialog' }, h('figcaption', {}, t('intro.call', { from: e.from })), h('blockquote', {}, e.text)),
      );
    case 'unlock':
      if (e.feature === 'calculator') return h('p', { class: 'unlock calculator-unlock' }, t('intro.unlockCalculator'));
      if (e.feature === 'calendar') return h('p', { class: 'unlock calendar-unlock' }, t('intro.unlockCalendar'));
      if (e.feature === 'pinboard') return h('p', { class: 'unlock pinboard-unlock' }, t('intro.unlockPinboard'));
      return h('p', { class: 'unlock drawer-unlock' }, t('intro.unlockDrawer'));
    case 'event':
    case 'actSummary':
      return null;
  }
}

/** A new question on the pinboard, shown as a note at the start of its day (SPEC 4.9). */
export function questionNotice(q: Question): HTMLElement {
  return h(
    'figure',
    { class: 'note question-notice', 'data-question': q.id },
    h('figcaption', { class: 'notice-head' }, q.from ? t('pinboard.questionNotice', { from: q.from }) : t('pinboard.questionNoticeOwn')),
    h('blockquote', {}, q.text),
  );
}
