import { describe, expect, it } from 'vitest';
import {
  codexDays,
  codexOpenTarget,
  codexProgress,
  DEFAULT_CODEX,
  deliveries,
  deliveryUnseen,
  excerpt,
  findSpans,
  lockedDays,
  normalizeForSearch,
  searchRules,
  toRoman,
  visibleRules,
} from '../../src/core/codex';
import { markDeliverySeen, newGame, rememberCodexPlace } from '../../src/core/game';
import { loadGame, SAVE_KEY, saveGame } from '../../src/core/save';
import type { Rule } from '../../src/core/types';
import { MemoryStore, realContent } from './helpers';

const content = realContent();
const rules = content.rules;

const rule = (id: string, day: number, title: string, text: string, hint = false): Rule => ({
  id,
  day,
  title,
  text,
  source: `§ ${id}`,
  sourceUrl: 'https://example.org',
  ...(hint ? { hint: true as const } : {}),
});

/** Small fixed set, independent of the content. */
const sample: Rule[] = [
  rule('R1', 1, 'Werbungskosten', 'Aufwendungen zur Erwerbung, Sicherung und Erhaltung der Einnahmen sind abzugsfähig.'),
  rule('R3', 2, 'Straße und Weg', 'Fahrten zwischen Wohnung und Arbeitsstätte über die Straße.'),
  rule('R2', 1, 'Arbeitsmittel', 'Werkzeug und Fachliteratur sind Arbeitsmittel.'),
  rule('R4', 3, 'Café', 'Bewirtung im Café ist nicht abzugsfähig, außer zur Werbung.', true),
];

describe('Gliederung', () => {
  it('sichtbare Regeln nach Tag, innerhalb des Tags in Inhaltsreihenfolge', () => {
    expect(visibleRules(sample, 1).map((r) => r.id)).toEqual(['R1', 'R2']);
    expect(visibleRules(sample, 3).map((r) => r.id)).toEqual(['R1', 'R2', 'R3', 'R4']);
  });

  it('Lieferungen je Tag und gesperrte Tage', () => {
    expect(deliveries(sample, 2).map((d) => [d.day, d.rules.map((r) => r.id)])).toEqual([
      [1, ['R1', 'R2']],
      [2, ['R3']],
    ]);
    expect(lockedDays(sample, 2)).toEqual([3]);
    expect(lockedDays(sample, 3)).toEqual([]);
  });

  it('Akt I: zehn Lieferungen, an Tag 1 neun gesperrte Tage', () => {
    expect(codexDays(rules)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(deliveries(rules, 1)).toHaveLength(1);
    expect(lockedDays(rules, 1)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(visibleRules(rules, 10)).toHaveLength(54);
    expect(visibleRules(rules, 2).map((r) => r.id)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5']);
  });

  it('Hinweisregeln bleiben erkennbar', () => {
    expect(visibleRules(rules, 10).filter((r) => r.hint).map((r) => r.id)).toEqual(['R28', 'R36', 'R37', 'R44', 'R45']);
  });
});

describe('normalizeForSearch', () => {
  it.each([
    ['Abzugsfähig', 'abzugsfahig'],
    ['ÖSTERREICH', 'osterreich'],
    ['Übung', 'ubung'],
    ['Straße', 'strasse'],
    ['STRASSE', 'strasse'],
    ['Café à la crème', 'cafe a la creme'],
    ['R12', 'r12'],
  ])('%s → %s', (a, b) => expect(normalizeForSearch(a)).toBe(b));
});

describe('searchRules', () => {
  it('leere Eingabe liefert keine Treffer', () => {
    expect(searchRules(sample, 3, '')).toEqual([]);
    expect(searchRules(sample, 3, '   ')).toEqual([]);
  });

  it('Teilwort, ohne Groß/Klein, Umlaute und ß gefaltet', () => {
    expect(searchRules(sample, 3, 'abzugsfahig').map((h) => h.id)).toEqual(['R1', 'R4']);
    expect(searchRules(sample, 3, 'ABZUGSFÄHIG').map((h) => h.id)).toEqual(['R1', 'R4']);
    expect(searchRules(sample, 3, 'zugsf').map((h) => h.id)).toEqual(['R1', 'R4']);
    expect(searchRules(sample, 3, 'strasse').map((h) => h.id)).toEqual(['R3']);
    expect(searchRules(sample, 3, 'cafe').map((h) => h.id)).toEqual(['R4']);
  });

  it('mehrere Wörter müssen alle vorkommen, auch verteilt auf Titel und Text', () => {
    expect(searchRules(sample, 3, 'werkzeug arbeitsmittel').map((h) => h.id)).toEqual(['R2']);
    expect(searchRules(sample, 3, 'werkzeug strasse')).toEqual([]);
  });

  it('gesperrte Regeln werden nie gefunden, auch nicht über die ID', () => {
    expect(searchRules(sample, 2, 'abzugsfahig').map((h) => h.id)).toEqual(['R1']);
    expect(searchRules(sample, 2, 'R4')).toEqual([]);
    expect(searchRules(rules, 1, 'wohnsitz')).toEqual([]);
    expect(searchRules(rules, 3, 'R12')).toEqual([]);
    for (const h of searchRules(rules, 1, 'e')) expect(h.day).toBe(1);
  });

  it('eine Regel-ID findet diese Regel zuerst', () => {
    const hits = searchRules(rules, 4, 'R12');
    expect(hits[0]).toMatchObject({ id: 'R12', byId: true, title: 'Ertrags- und Aufwandsprinzip', day: 4 });
    expect(searchRules(rules, 4, ' r12 ')[0]?.id).toBe('R12');
    expect(searchRules(rules, 4, 'R 12')[0]?.id).toBe('R12');
  });

  it('Treffer tragen Titel, Tag und Fundstellen in Titel und Text', () => {
    const [r1, r4] = searchRules(sample, 3, 'abzugsfahig');
    expect(r1).toMatchObject({ id: 'R1', title: 'Werbungskosten', day: 1, hint: false, byId: false, titleSpans: [] });
    const text = sample[0]!.text;
    const [[a, b]] = r1!.textSpans as [[number, number]];
    expect(text.slice(a, b)).toBe('abzugsfähig');
    expect(r4!.hint).toBe(true);
    const title = searchRules(sample, 3, 'werbung')[0]!;
    expect(title.titleSpans).toEqual([[0, 7]]);
  });

  it('mehrere Fundstellen werden alle markiert', () => {
    const hit = searchRules(sample, 3, 'arbeit')[0]!;
    expect(hit.id).toBe('R2');
    expect(hit.textSpans).toHaveLength(1);
    expect(hit.titleSpans).toEqual([[0, 6]]);
    const many = searchRules(rules, 10, 'abzugsfahig');
    expect(many.length).toBeGreaterThan(1);
    for (const h of many) {
      const r = rules.find((x) => x.id === h.id)!;
      for (const [a, b] of h.textSpans) expect(normalizeForSearch(r.text.slice(a, b))).toBe('abzugsfahig');
    }
  });

  it('ß in der Fundstelle wird ganz markiert', () => {
    const hit = searchRules(sample, 3, 'strasse')[0]!;
    const [[a, b]] = hit.textSpans as [[number, number]];
    expect(sample[1]!.text.slice(a, b)).toBe('Straße');
    expect(findSpans('Maß und Maße', ['mass'])).toEqual([
      [0, 3],
      [8, 11],
    ]);
  });
});

describe('Ausschnitt', () => {
  const long = 'Anfang ' + 'wort '.repeat(60) + 'Ziel ' + 'wort '.repeat(60) + 'Ende';

  it('kurzer Text bleibt ganz', () => {
    expect(excerpt('kurz', 0)).toEqual({ start: 0, end: 4 });
    const hit = searchRules(sample, 3, 'werkzeug')[0]!;
    expect(hit.snippet).toBe(sample[2]!.text);
    expect(hit.snippetCutStart).toBe(false);
    expect(hit.snippetCutEnd).toBe(false);
  });

  it('Fundstelle am Textanfang', () => {
    const r = rule('R90', 1, 'T', long);
    const hit = searchRules([r], 1, 'anfang')[0]!;
    expect(hit.snippet.startsWith('Anfang')).toBe(true);
    expect(hit.snippetCutStart).toBe(false);
    expect(hit.snippetCutEnd).toBe(true);
    expect(hit.snippet.length).toBeLessThanOrEqual(80);
    expect(hit.snippet.length).toBeGreaterThan(60);
    expect(hit.snippetSpans).toEqual([[0, 6]]);
  });

  it('Fundstelle in der Mitte', () => {
    const hit = searchRules([rule('R90', 1, 'T', long)], 1, 'ziel')[0]!;
    expect(hit.snippetCutStart).toBe(true);
    expect(hit.snippetCutEnd).toBe(true);
    const [[a, b]] = hit.snippetSpans as [[number, number]];
    expect(hit.snippet.slice(a, b)).toBe('Ziel');
    expect(hit.snippet.length).toBeLessThanOrEqual(80);
  });

  it('Fundstelle am Textende', () => {
    const hit = searchRules([rule('R90', 1, 'T', long)], 1, 'ende')[0]!;
    expect(hit.snippet.endsWith('Ende')).toBe(true);
    expect(hit.snippetCutStart).toBe(true);
    expect(hit.snippetCutEnd).toBe(false);
    const [[a, b]] = hit.snippetSpans as [[number, number]];
    expect(hit.snippet.slice(a, b)).toBe('Ende');
  });

  it('Ausschnitt schneidet keine Wörter an', () => {
    const hit = searchRules([rule('R90', 1, 'T', long)], 1, 'ziel')[0]!;
    expect(hit.snippet).toMatch(/^wort /);
    expect(hit.snippet).toMatch(/ wort$/);
  });

  it('Treffer nur im Titel zeigt den Textanfang', () => {
    const hit = searchRules(sample, 3, 'werbungskosten')[0]!;
    expect(hit.snippetSpans).toEqual([]);
    expect(hit.snippet.startsWith('Aufwendungen')).toBe(true);
  });
});

describe('toRoman', () => {
  it.each([
    [1, 'I'],
    [2, 'II'],
    [3, 'III'],
    [4, 'IV'],
    [5, 'V'],
    [9, 'IX'],
    [14, 'XIV'],
    [40, 'XL'],
    [49, 'XLIX'],
    [90, 'XC'],
    [400, 'CD'],
    [1994, 'MCMXCIV'],
    [3999, 'MMMCMXCIX'],
  ])('%d → %s', (n, s) => expect(toRoman(n)).toBe(s));

  it('lehnt 0, negative und gebrochene Zahlen ab', () => {
    expect(() => toRoman(0)).toThrow(RangeError);
    expect(() => toRoman(-1)).toThrow(RangeError);
    expect(() => toRoman(1.5)).toThrow(RangeError);
  });
});

describe('Lesestand', () => {
  it('Standardwerte für fehlende oder kaputte Felder', () => {
    expect(codexProgress(undefined)).toEqual(DEFAULT_CODEX);
    expect(codexProgress({ lastRuleId: 5, seenDay: 'x' })).toEqual({ lastRuleId: '', seenDay: 0 });
    expect(codexProgress({ lastRuleId: 'R9', seenDay: 4 })).toEqual({ lastRuleId: 'R9', seenDay: 4 });
  });

  it('Öffnen: ungesehene Lieferung, sonst gemerkte Regel, sonst Inhaltsverzeichnis', () => {
    expect(codexOpenTarget(rules, 4, { lastRuleId: 'R2', seenDay: 3 })).toEqual({ kind: 'delivery', day: 4 });
    expect(codexOpenTarget(rules, 4, { lastRuleId: 'R9', seenDay: 4 })).toEqual({ kind: 'rule', id: 'R9' });
    expect(codexOpenTarget(rules, 4, { lastRuleId: '', seenDay: 4 })).toEqual({ kind: 'register' });
    // A remembered rule that is locked (e.g. after „Neues Spiel“) is not opened.
    expect(codexOpenTarget(rules, 1, { lastRuleId: 'R54', seenDay: 1 })).toEqual({ kind: 'register' });
    expect(codexOpenTarget(rules, 1, { lastRuleId: 'R99', seenDay: 1 })).toEqual({ kind: 'register' });
  });

  it('„neu“ bis die heutige Lieferung gesehen wurde', () => {
    expect(deliveryUnseen(rules, 2, { lastRuleId: '', seenDay: 1 })).toBe(true);
    expect(deliveryUnseen(rules, 2, { lastRuleId: '', seenDay: 2 })).toBe(false);
    expect(deliveryUnseen(rules, 11, { lastRuleId: '', seenDay: 10 })).toBe(false);
  });

  it('Aktionen im Spielstand', () => {
    const s = newGame(content);
    expect(s.codex).toEqual(DEFAULT_CODEX);
    const seen = markDeliverySeen(s, 1);
    expect(seen.codex.seenDay).toBe(1);
    expect(markDeliverySeen(seen, 1)).toBe(seen);
    expect(markDeliverySeen(seen, 0)).toBe(seen);
    const placed = rememberCodexPlace(seen, 'R2');
    expect(placed.codex).toEqual({ lastRuleId: 'R2', seenDay: 1 });
    expect(rememberCodexPlace(placed, 'R2')).toBe(placed);
  });

  it('Spielstand ohne codex lädt weiter und bekommt die Standardwerte', () => {
    const store = new MemoryStore();
    const { codex: _codex, ...old } = markDeliverySeen(newGame(content), 1);
    store.setItem(SAVE_KEY, JSON.stringify({ ...old, day: 4 }));
    const loaded = loadGame(store, content)!;
    expect(loaded.day).toBe(4);
    expect(loaded.queue).toEqual(old.queue);
    expect(loaded.codex).toEqual(DEFAULT_CODEX);
  });

  it('Lesestand übersteht Speichern und Laden', () => {
    const store = new MemoryStore();
    const s = rememberCodexPlace(markDeliverySeen(newGame(content), 1), 'R1');
    saveGame(store, s);
    expect(loadGame(store, content)!.codex).toEqual({ lastRuleId: 'R1', seenDay: 1 });
  });
});
