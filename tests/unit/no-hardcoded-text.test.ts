import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rawContentFiles } from './helpers';

/** Game text belongs in content/*.json, not in src/. */
const SRC = join(__dirname, '..', '..', 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.ts$/.test(f) ? [p] : [];
  });
}

/** All strings in the content that a player reads (excluding ids and short enum values). */
function contentStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') {
    if (v.length >= 12 && /\s/.test(v)) out.push(v);
  } else if (Array.isArray(v)) v.forEach((x) => contentStrings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => contentStrings(x, out));
  return out;
}

describe('kein Spieltext im Code', () => {
  const sources = files(SRC).map((f) => [f, readFileSync(f, 'utf8')] as const);

  it('kein Text aus dem JSON ist im Code dupliziert', () => {
    const texts = rawContentFiles().flatMap((f) => contentStrings(f));
    for (const [file, src] of sources) {
      for (const t of texts) expect(src.includes(t), `${file} enthält „${t}“`).toBe(false);
    }
  });

  it('Spiellogik in core erzeugt keine Anzeigetexte', () => {
    // Words separated by a space inside a string literal; Error messages for developers are exempt.
    const words = /(['"`])[^'"`\n]*\p{L}{2,} \p{L}{2,}[^'"`\n]*\1/u;
    for (const [file, src] of sources.filter(([f]) => /core[/\\](evaluate|game|codex|save|format)\.ts$/.test(f))) {
      const offending = src
        .split('\n')
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/new Error\(/.test(l))
        .filter((l) => words.test(l));
      expect(offending, file).toEqual([]);
    }
  });
});
