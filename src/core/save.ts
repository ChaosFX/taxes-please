import { codexProgress } from './codex';
import { STATE_VERSION, startDay, toolsUntil, type GameState } from './game';
import type { Content } from './types';

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

/** Shape shared by both save versions. */
interface StoredState extends Omit<GameState, 'version' | 'phase' | 'tools' | 'codex'> {
  version: 1 | typeof STATE_VERSION;
  phase: string;
  tools?: GameState['tools'];
  /** Missing in saves before SPEC 0.3.2. */
  codex?: unknown;
}

function isStoredState(v: unknown): v is StoredState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Partial<StoredState>;
  return (
    (s.version === 1 || s.version === STATE_VERSION) &&
    typeof s.day === 'number' &&
    typeof s.phase === 'string' &&
    Array.isArray(s.queue) &&
    Array.isArray(s.results) &&
    Array.isArray(s.pendingFollowUps) &&
    (s.version === 1 || Array.isArray(s.tools)) &&
    typeof s.settings === 'object' &&
    s.settings !== null
  );
}

/** Last day of the prototype 0.2. Its saves stop there („Ende des Prototyps“). */
export const PROTOTYPE_LAST_DAY = 4;

/**
 * Takes over a save from 0.2 (SPEC 9). Days 1 to 3 are unchanged in Akt I, so
 * a save before day 4 plays on as it is. A save on day 4 or later restarts
 * day 4 under the new content: results of days 1 to 3 stay, results of the old
 * day 4 are dropped, and follow-ups earned by an Ergänzungsersuchen before
 * day 4 (3-4) come again.
 */
export function migrateV1(content: Content, old: StoredState): GameState {
  const base: GameState = {
    ...old,
    version: STATE_VERSION,
    phase: old.phase as GameState['phase'],
    tools: toolsUntil(content, old.day),
    codex: codexProgress(old.codex),
  };
  if (old.day < PROTOTYPE_LAST_DAY && old.phase !== 'finished') return base;

  const results = old.results.filter((r) => r.day < PROTOTYPE_LAST_DAY);
  const pending = results.flatMap((r) => {
    const k = content.cases.find((c) => c.id === r.akteId);
    return k?.followUp && r.answer.stamp === 'ergaenzung' && k.followUp.arrivesOnDay >= PROTOTYPE_LAST_DAY
      ? [{ akteId: `${k.id}/folge`, day: k.followUp.arrivesOnDay }]
      : [];
  });
  return startDay(content, { ...base, results, pendingFollowUps: pending, current: null, queue: [], tools: toolsUntil(content, PROTOTYPE_LAST_DAY - 1) }, PROTOTYPE_LAST_DAY);
}

/** The raw save if it has a known shape; does not need the content. */
function readSave(store: KeyValueStore | null): StoredState | null {
  if (!store) return null;
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * An open Akte without stamp is not kept (SPEC 9): after loading it lies closed
 * on top of the inbox again, its input empty. A stamped Akte stays on the desk.
 */
export function shelveUnstamped(state: GameState): GameState {
  const cur = state.current;
  if (!cur || cur.answer.stamp !== undefined) return state;
  return { ...state, current: null, queue: [cur.akteId, ...state.queue] };
}

/** Loads the save, taking over saves from 0.2. Returns null if there is none or it is broken. */
export function loadGame(store: KeyValueStore | null, content: Content): GameState | null {
  const saved = readSave(store);
  if (!saved) return null;
  try {
    if (saved.version === 1) return shelveUnstamped(migrateV1(content, saved));
    // A save without `codex` (before SPEC 0.3.2) keeps everything else (SPEC 9).
    return shelveUnstamped({ ...(saved as Omit<GameState, 'codex'>), codex: codexProgress(saved.codex) } as GameState);
  } catch {
    return null;
  }
}

export function hasSave(store: KeyValueStore | null): boolean {
  return readSave(store) !== null;
}

export function clearSave(store: KeyValueStore | null): void {
  try {
    store?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
