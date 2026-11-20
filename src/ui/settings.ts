import { DEFAULT_SETTINGS, type EffectsLevel, type KeyValueStore, type Settings } from '../core';

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

function isSettings(v: unknown): v is Settings {
  const s = v as Partial<Settings> | null;
  return !!s && EFFECT_LEVELS.includes(s.effects as EffectsLevel) && typeof s.volume === 'number';
}

/** Fills fields added after a settings object was saved (e.g. `music`). */
export function withDefaults(s: Partial<Settings> | null | undefined): Settings | null {
  if (!s) return null;
  const merged = { ...DEFAULT_SETTINGS, ...s };
  if (typeof merged.music !== 'number') merged.music = DEFAULT_SETTINGS.music;
  return isSettings(merged) ? merged : null;
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
