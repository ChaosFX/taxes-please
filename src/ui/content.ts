import { loadContentFiles } from '../core/loader';
import type { Content } from '../core/types';
import uiTexts from '../../content/ui.json';
import { initTexts } from './text';

/** All JSON files in content/ except ui.json (interface texts are no content section, SPEC 3), sorted by file name, validated. Throws ContentError. */
export function loadBundledContent(): Content {
  const modules = import.meta.glob<unknown>(['../../content/*.json', '!../../content/ui.json'], { eager: true, import: 'default' });
  const files = Object.keys(modules)
    .sort()
    .map((k) => ({ name: k.split('/').pop()!, data: modules[k] }));
  return loadContentFiles(files);
}

/** Validates content/ui.json and makes it available to `t`. Throws UiTextError. */
export function loadBundledTexts(): void {
  initTexts(uiTexts);
}

