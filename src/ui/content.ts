import { loadContentFiles } from '../core/loader';
import type { Content } from '../core/types';

/** All JSON files in content/, sorted by file name, validated. Throws ContentError. */
export function loadBundledContent(): Content {
  const modules = import.meta.glob<unknown>('../../content/*.json', { eager: true, import: 'default' });
  const files = Object.keys(modules)
    .sort()
    .map((k) => modules[k]);
  return loadContentFiles(files);
}
