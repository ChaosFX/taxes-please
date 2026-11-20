import type { GameState } from './game';

export const SAVE_KEY = 'taxes-please/save/v1';

/** Minimal storage interface so tests can use an in-memory map. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Returns the browser storage or null if access throws (private mode, blocked). */
export function browserStorage(): KeyValueStore | null {
  try {
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

export function saveGame(store: KeyValueStore | null, state: GameState): boolean {
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function isGameState(v: unknown): v is GameState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Partial<GameState>;
  return (
    s.version === 1 &&
    typeof s.day === 'number' &&
    typeof s.phase === 'string' &&
    Array.isArray(s.queue) &&
    Array.isArray(s.results) &&
    Array.isArray(s.pendingFollowUps) &&
    typeof s.settings === 'object' &&
    s.settings !== null
  );
}

export function loadGame(store: KeyValueStore | null): GameState | null {
  if (!store) return null;
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isGameState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function hasSave(store: KeyValueStore | null): boolean {
  return loadGame(store) !== null;
}

export function clearSave(store: KeyValueStore | null): void {
  try {
    store?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
