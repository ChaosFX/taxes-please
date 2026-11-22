import type { Rule } from './types';

/**
 * The codex as a book (SPEC 6): which rules can be read on a day, how they are
 * grouped into deliveries, the search and the reading progress. Pure functions,
 * no DOM. Locked rules never leave this module with title, text or source.
 */

/** One delivery („Lieferung“): the rules unlocked on one day, in content order. */
export interface Delivery {
  day: number;
  rules: Rule[];
}

/** Rules readable on `day` (`rule.day <= day`), by delivery day, content order within a day. */
export function visibleRules(rules: readonly Rule[], day: number): Rule[] {
  return rules
    .map((rule, i) => ({ rule, i }))
    .filter(({ rule }) => rule.day <= day)
    .sort((a, b) => a.rule.day - b.rule.day || a.i - b.i)
    .map(({ rule }) => rule);
}

/** All days that bring a delivery, ascending (one register tab each). */
export function codexDays(rules: readonly Rule[]): number[] {
  return [...new Set(rules.map((r) => r.day))].sort((a, b) => a - b);
}

/** Unlocked deliveries up to `day`, ascending. */
export function deliveries(rules: readonly Rule[], day: number): Delivery[] {
  const visible = visibleRules(rules, day);
  return codexDays(visible).map((d) => ({ day: d, rules: visible.filter((r) => r.day === d) }));
}

/** Days whose delivery is still locked on `day`. Carries only the day number. */
export function lockedDays(rules: readonly Rule[], day: number): number[] {
  return codexDays(rules).filter((d) => d > day);
}

// ---------- Search ----------

/**
 * Folds a single character for the search: lower case, ä ö ü → a o u, ß → ss,
 * accents removed. May return more than one character (ß) or none (a lone accent).
 */
function foldChar(ch: string): string {
  const lower = ch.toLocaleLowerCase('de-AT');
  if (lower === 'ß' || lower === 'ẞ') return 'ss';
  return lower.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Lower case, umlauts and ß folded, accents removed (SPEC 6.6). */
export function normalizeForSearch(text: string): string {
  let out = '';
  for (const ch of text) out += foldChar(ch);
  return out;
}

/** Normalised text plus, for every normalised index, the index in the original. */
function normalizeWithMap(text: string): { norm: string; map: number[] } {
  let norm = '';
  const map: number[] = [];
  let i = 0;
  for (const ch of text) {
    const f = foldChar(ch);
    for (let k = 0; k < f.length; k++) map.push(i);
    norm += f;
    i += ch.length;
  }
  map.push(text.length);
  return { norm, map };
}

/** A found passage as `[start, end)` in the original string. */
export type Span = [start: number, end: number];

/** Every occurrence of every term in `text`, merged and sorted, in original positions. */
export function findSpans(text: string, terms: readonly string[]): Span[] {
  const { norm, map } = normalizeWithMap(text);
  const raw: Span[] = [];
  for (const term of terms) {
    if (!term) continue;
    for (let at = norm.indexOf(term); at !== -1; at = norm.indexOf(term, at + term.length)) {
      // The end maps to the first original char after the match, so a folded ß stays whole.
      raw.push([map[at]!, map[at + term.length] ?? text.length]);
    }
  }
  raw.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Span[] = [];
  for (const s of raw) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  return merged;
}

/** Length of the excerpt around the first find in a hit. */
export const SNIPPET_LENGTH = 80;

export interface SearchHit {
  id: string;
  title: string;
  day: number;
  hint: boolean;
  /** True when the input was the rule id („R12“). */
  byId: boolean;
  /** About SNIPPET_LENGTH characters of the text around the first find, cut at word boundaries. */
  snippet: string;
  /** The excerpt starts after the beginning or ends before the end of the text. */
  snippetCutStart: boolean;
  snippetCutEnd: boolean;
  /** Finds in the excerpt, relative to `snippet`. */
  snippetSpans: Span[];
  /** All finds in title and text, for the highlighter in the book. */
  titleSpans: Span[];
  textSpans: Span[];
}

/** Terms of a query: normalised, split at white space. */
export function searchTerms(query: string): string[] {
  return normalizeForSearch(query).split(/\s+/).filter(Boolean);
}

const ID_QUERY = /^\s*r\s*(\d+)\s*$/i;

/** Excerpt of `text` around `at`: about `len` characters, not cutting words. */
export function excerpt(text: string, at: number, len = SNIPPET_LENGTH): { start: number; end: number } {
  if (text.length <= len) return { start: 0, end: text.length };
  let start = Math.max(0, Math.min(at - Math.floor(len / 3), text.length - len));
  let end = Math.min(text.length, start + len);
  if (start > 0) {
    const space = text.indexOf(' ', start);
    if (space !== -1 && space < at) start = space + 1;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    if (space > at) end = space;
  }
  return { start, end };
}

function hitFor(rule: Rule, byId: boolean, titleSpans: Span[], textSpans: Span[]): SearchHit {
  const first = textSpans[0]?.[0] ?? 0;
  const { start, end } = excerpt(rule.text, first);
  const snippetSpans = textSpans
    .filter(([a, b]) => a < end && b > start)
    .map(([a, b]): Span => [Math.max(a, start) - start, Math.min(b, end) - start]);
  return {
    id: rule.id,
    title: rule.title,
    day: rule.day,
    hint: rule.hint === true,
    byId,
    snippet: rule.text.slice(start, end),
    snippetCutStart: start > 0,
    snippetCutEnd: end < rule.text.length,
    snippetSpans,
    titleSpans,
    textSpans,
  };
}

/**
 * Searches title and text of the rules unlocked on `day` (SPEC 6.6): parts of
 * words, case, umlauts and ß ignored, every term must occur. A rule id („R12“)
 * finds that rule first. An empty query finds nothing; locked rules never.
 */
export function searchRules(rules: readonly Rule[], day: number, query: string): SearchHit[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];
  const visible = visibleRules(rules, day);
  const hits: SearchHit[] = [];

  const idMatch = ID_QUERY.exec(query);
  const byId = idMatch ? visible.find((r) => r.id.toUpperCase() === `R${Number(idMatch[1])}`) : undefined;
  if (byId) hits.push(hitFor(byId, true, [], []));

  for (const rule of visible) {
    if (rule === byId) continue;
    const titleNorm = normalizeForSearch(rule.title);
    const textNorm = normalizeForSearch(rule.text);
    if (!terms.every((t) => titleNorm.includes(t) || textNorm.includes(t))) continue;
    hits.push(hitFor(rule, false, findSpans(rule.title, terms), findSpans(rule.text, terms)));
  }
  return hits;
}

// ---------- Page numbers ----------

const ROMAN: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** Roman numeral for 1 to 3999 (page numbers of the register). */
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) throw new RangeError(`toRoman: ${n}`);
  let out = '';
  for (const [value, sym] of ROMAN) {
    while (n >= value) {
      out += sym;
      n -= value;
    }
  }
  return out;
}

// ---------- Reading progress (SPEC 6.7, 9) ----------

export interface CodexProgress {
  /** Id of the rule read last; empty for the register. */
  lastRuleId: string;
  /** Highest day whose delivery the player has seen. */
  seenDay: number;
}

export const DEFAULT_CODEX: CodexProgress = { lastRuleId: '', seenDay: 0 };

/** Progress from a save; missing or broken fields get the defaults (older saves have none). */
export function codexProgress(raw: unknown): CodexProgress {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Record<keyof CodexProgress, unknown>>;
  return {
    lastRuleId: typeof r.lastRuleId === 'string' ? r.lastRuleId : DEFAULT_CODEX.lastRuleId,
    seenDay: typeof r.seenDay === 'number' && Number.isFinite(r.seenDay) && r.seenDay >= 0 ? r.seenDay : DEFAULT_CODEX.seenDay,
  };
}

/** Where the book opens. */
export type CodexTarget = { kind: 'register' } | { kind: 'delivery'; day: number } | { kind: 'rule'; id: string };

/**
 * An unseen delivery of today opens on its first page; otherwise the book
 * opens at the rule read last, or at the register.
 */
export function codexOpenTarget(rules: readonly Rule[], day: number, progress: CodexProgress): CodexTarget {
  if (progress.seenDay < day && rules.some((r) => r.day === day)) return { kind: 'delivery', day };
  const last = progress.lastRuleId ? rules.find((r) => r.id === progress.lastRuleId) : undefined;
  if (last && last.day <= day) return { kind: 'rule', id: last.id };
  return { kind: 'register' };
}

/** True while today's delivery has not been looked at („neu“ on the closed book and the tab). */
export function deliveryUnseen(rules: readonly Rule[], day: number, progress: CodexProgress): boolean {
  return progress.seenDay < day && rules.some((r) => r.day === day);
}
