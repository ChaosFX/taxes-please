import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContentFiles, type ContentFile } from '../../src/core/loader';
import type { Content } from '../../src/core/types';

const CONTENT_DIR = join(__dirname, '..', '..', 'content');

export function rawContentFiles(): ContentFile[] {
  return readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'ui.json' && f !== 'kalender.json')
    .sort()
    .map((name) => ({ name, data: JSON.parse(readFileSync(join(CONTENT_DIR, name), 'utf8')) as unknown }));
}

export function realContent(): Content {
  return loadContentFiles(rawContentFiles());
}

export function clone<T>(v: T): T {
  return structuredClone(v);
}

export class MemoryStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
