import { loadCalendar, loadContentFiles } from '../core/loader';
import type { CalendarContent } from '../core/schema';
import type { Content } from '../core/types';
import calendarJson from '../../content/kalender.json';
import uiTexts from '../../content/ui.json';
import { initTexts } from './text';

/**
 * All JSON files in content/ except ui.json and kalender.json (interface texts and
 * the calendar are no act content, SPEC 3), sorted by file name, validated. Throws ContentError.
 */
export function loadBundledContent(): Content {
  const modules = import.meta.glob<unknown>(['../../content/*.json', '!../../content/ui.json', '!../../content/kalender.json'], { eager: true, import: 'default' });
  const files = Object.keys(modules)
    .sort()
    .map((k) => ({ name: k.split('/').pop()!, data: modules[k] }));
  return loadContentFiles(files);
}

/** Validates content/ui.json and makes it available to `t`. Throws UiTextError. */
export function loadBundledTexts(): void {
  initTexts(uiTexts);
}


/** Validates content/kalender.json (SPEC 3). Throws ContentError. */
export function loadBundledCalendar(): CalendarContent {
  return loadCalendar(calendarJson);
}
