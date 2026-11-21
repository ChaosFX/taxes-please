import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rawContentFiles } from './helpers';
import { literalsIn, looksLikeText, sourceFiles, type Literal } from './source-text';

/**
 * Kein Text, den ein Spieler liest oder ein Screenreader vorliest, steht im Code
 * (SPEC 1.4, Auftrag 02). Spieltexte stehen in `texts` der Inhaltsdatei,
 * Oberflächentexte in `content/ui.json`; im Code stehen nur Schlüssel.
 */

/**
 * Ausnahmen. Jede ist eine Stelle, an der deutscher Text im Code stehen darf.
 * Kurz halten; jede neue Ausnahme braucht eine Begründung.
 */
const EXCEPTIONS: { reason: string; applies: (l: Literal) => boolean }[] = [
  {
    reason:
      'Fehlermeldungen beim Laden kaputter Inhaltsdateien (Error-Klassen, throw, Problemlisten des Loaders samt ' +
      'Ortsangaben wie „Akte 5-3, Widerspruch w1“). Sie richten sich an die Autoren der JSON-Dateien, erscheinen in ' +
      'einem geprüften Build nie und müssen auch ohne gültige ui.json lesbar sein (SPEC 1.4). loader.ts und schema.ts ' +
      'erzeugen sonst keinen Text.',
    applies: (l) => l.within.some((w) => /^(new \w*Error|throw|class extends Error)$/.test(w)) || /^src\/core\/(loader|schema)\.ts$/.test(l.file),
  },
  {
    reason: 'Betragsformat 1.200,00 € ist Formatierung, keine Beschriftung (Auftrag 02, Aufgabe 1).',
    applies: (l) => l.file === 'src/core/format.ts',
  },
];

const literals = sourceFiles().flatMap(literalsIn);
const exceptionFor = (l: Literal) => EXCEPTIONS.find((e) => e.applies(l));

describe('kein Text im Code', () => {
  it('keine deutschen Textliterale in src/', () => {
    const hits = literals.filter((l) => looksLikeText(l) && !exceptionFor(l));
    const report = hits.map((l) => `${l.file}:${l.line} ${JSON.stringify(l.value)}${l.sink ? ' (DOM)' : ''}`);
    expect(report, `${hits.length} Textliterale im Code`).toEqual([]);
  });

  it('jede Ausnahme wird gebraucht', () => {
    for (const e of EXCEPTIONS) expect(literals.some((l) => looksLikeText(l) && e.applies(l)), e.reason).toBe(true);
  });

  it('kein Text aus den Inhaltsdateien ist im Code dupliziert', () => {
    const texts: string[] = [];
    const collect = (v: unknown) => {
      if (typeof v === 'string') {
        if (v.length >= 12 && /\s/.test(v)) texts.push(v);
      } else if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === 'object') Object.values(v).forEach(collect);
    };
    rawContentFiles().forEach(collect);
    collect(uiJson());
    const values = literals.map((l) => l.value);
    for (const t of texts) expect(values.some((v) => v.includes(t)), `Code enthält „${t}“`).toBe(false);
  });
});

// ---------- ui.json und t(…) ----------

const UI_FILE = join(__dirname, '..', '..', 'content', 'ui.json');
function uiJson(): Record<string, unknown> {
  return existsSync(UI_FILE) ? (JSON.parse(readFileSync(UI_FILE, 'utf8')) as Record<string, unknown>) : {};
}
function uiEntries(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [area, v] of Object.entries(uiJson())) {
    if (area === 'version' || !v || typeof v !== 'object') continue;
    for (const [k, text] of Object.entries(v)) out.set(`${area}.${k}`, String(text));
  }
  return out;
}
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe('ui.json und Code passen zusammen', () => {
  const entries = uiEntries();

  it('ui.json existiert und hat Einträge', () => {
    expect(entries.size).toBeGreaterThan(0);
  });

  it('jeder Schlüssel in ui.json wird im Code verwendet', () => {
    const used = new Set(literals.map((l) => l.value));
    const unused = [...entries.keys()].filter((k) => !used.has(k));
    expect(unused).toEqual([]);
  });

  it('jeder im Code verwendete Schlüssel steht in ui.json', () => {
    const calls = literals.filter((l) => l.callee === 't' && l.argIndex === 0);
    expect(calls.length).toBeGreaterThan(0);
    const unknown = calls.filter((l) => !entries.has(l.value)).map((l) => `${l.file}:${l.line} ${l.value}`);
    expect(unknown).toEqual([]);
    // Keys kept in lookup tables (e.g. per verdict) look like `area.key` too.
    const keyLike = literals.filter((l) => /^[a-z]+\.[a-z][A-Za-z0-9]*$/.test(l.value) && !l.technical && l.callee !== 'glob');
    const stray = keyLike.filter((l) => !entries.has(l.value) && uiAreas(entries).has(l.value.split('.')[0]!));
    expect(stray.map((l) => `${l.file}:${l.line} ${l.value}`)).toEqual([]);
  });

  it('Platzhalter im Aufruf passen zum Text', () => {
    const problems: string[] = [];
    for (const l of literals.filter((x) => x.callee === 't' && x.argIndex === 0 && entries.has(x.value))) {
      const expected = placeholders(entries.get(l.value)!);
      if (JSON.stringify(l.params) !== JSON.stringify(expected)) {
        problems.push(`${l.file}:${l.line} ${l.value}: Aufruf {${(l.params ?? ['?']).join(', ')}}, Text {${expected.join(', ')}}`);
      }
    }
    expect(problems).toEqual([]);
  });
});

function uiAreas(entries: Map<string, string>): Set<string> {
  return new Set([...entries.keys()].map((k) => k.split('.')[0]!));
}
