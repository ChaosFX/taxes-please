import type { Content, Rule } from './types';

export type CodexEntry =
  | { locked: false; id: string; day: number; isNew: boolean; rule: Rule }
  /** Locked entries deliberately carry no title, text or source. */
  | { locked: true; id: string; day: number };

/** All rules in order; only those with `day <= currentDay` carry content. */
export function codexEntries(content: Content, currentDay: number): CodexEntry[] {
  return [...content.rules]
    .sort((a, b) => a.day - b.day)
    .map((rule) =>
      rule.day <= currentDay
        ? { locked: false, id: rule.id, day: rule.day, isNew: rule.day === currentDay, rule }
        : { locked: true, id: rule.id, day: rule.day },
    );
}

function normalize(s: string): string {
  return s.toLocaleLowerCase('de-AT').normalize('NFD').replace(/\p{M}/gu, '');
}

/** Full-text search over title and text of unlocked rules only. Empty query returns all unlocked. */
export function searchCodex(content: Content, currentDay: number, query: string): Rule[] {
  const unlocked = content.rules.filter((r) => r.day <= currentDay);
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return unlocked;
  return unlocked.filter((r) => {
    const hay = normalize(`${r.title} ${r.text}`);
    return terms.every((t) => hay.includes(t));
  });
}

/** Days for the bookmarks, ascending. */
export function codexDays(content: Content): number[] {
  return [...new Set(content.rules.map((r) => r.day))].sort((a, b) => a - b);
}
