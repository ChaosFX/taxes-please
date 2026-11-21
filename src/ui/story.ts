import type { StoryEvent } from '../core/types';
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
 * checks (`event`, `unlock` of pinboard or drawer, `actSummary`) show nothing.
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
      return e.feature === 'calculator' ? h('p', { class: 'unlock calculator-unlock' }, t('intro.unlockCalculator')) : null;
    case 'event':
    case 'actSummary':
      return null;
  }
}
