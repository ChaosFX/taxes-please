import { readdirSync, readFileSync } from 'node:fs';
import { beginWork, dueDeskEvents, finishPrologue, showDeskEvent, type GameState } from '../../src/core/game';
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

/** Past the prologue, if any, and to the desk (as the player would click). */
export function begin(content: Content, s: GameState): GameState {
  return beginWork(finishPrologue(content, s), content);
}

/** Closes every event due at the desk, in order (as the player would click „Weiter“). */
export function settle(content: Content, s: GameState): GameState {
  for (let due = dueDeskEvents(content, s); due.length; due = dueDeskEvents(content, s)) s = showDeskEvent(content, s, due[0]!);
  return s;
}
