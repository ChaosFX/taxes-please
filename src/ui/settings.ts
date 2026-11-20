import { DEFAULT_SETTINGS, loadGame, type EffectsLevel, type GameState, type KeyValueStore, type Settings } from '../core';

/**
 * Settings live in the save game (SPEC 9). This extra key keeps them before a
 * game exists, e.g. when chosen on the start screen.
 */
export const SETTINGS_KEY = 'taxes-please/settings/v1';

export const EFFECT_LEVELS: EffectsLevel[] = ['aus', 'reduziert', 'voll'];

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Defaults: `prefers-reduced-motion` sets „reduziert“. */
export function defaultSettings(): Settings {
  return { ...DEFAULT_SETTINGS, effects: prefersReducedMotion() ? 'reduziert' : DEFAULT_SETTINGS.effects };
}

const isLevel = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

/**
 * Fills fields that are missing or invalid with `DEFAULT_SETTINGS` (SPEC 9),
 * field by field, so an older save keeps everything it already has.
 */
export function withDefaults(s: Partial<Settings> | null | undefined): Settings | null {
  if (!s || typeof s !== 'object') return null;
  return {
    effects: EFFECT_LEVELS.includes(s.effects as EffectsLevel) ? (s.effects as EffectsLevel) : DEFAULT_SETTINGS.effects,
    volume: isLevel(s.volume) ? s.volume : DEFAULT_SETTINGS.volume,
    music: isLevel(s.music) ? s.music : DEFAULT_SETTINGS.music,
  };
}

/** The saved game with its settings completed; null if there is none. */
export function loadSavedGame(store: KeyValueStore | null): GameState | null {
  const saved = loadGame(store);
  if (!saved) return null;
  return { ...saved, settings: withDefaults(saved.settings) ?? { ...DEFAULT_SETTINGS } };
}

export function loadSettings(store: KeyValueStore | null): Settings | null {
  try {
    const raw = store?.getItem(SETTINGS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return withDefaults(parsed as Partial<Settings> | null);
  } catch {
    return null;
  }
}

export function saveSettings(store: KeyValueStore | null, s: Settings): void {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** CSS reads `html[data-effects]`; all motion is scoped to it. */
export function applyEffects(level: EffectsLevel): void {
  document.documentElement.dataset.effects = level;
}
