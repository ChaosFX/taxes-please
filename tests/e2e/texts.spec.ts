import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { freshStart, key, solutionFor, solveNext } from './helpers';

/**
 * Auftrag 02: Jeder Text, den der Spieler sieht oder ein Screenreader vorliest,
 * stammt aus content/ui.json oder aus der Inhaltsdatei. Ergänzt den Literal-Test
 * in tests/unit: der findet Text im Quellcode, dieser hier Text im fertigen DOM,
 * auch wenn er über eine Variable hineinkommt (z. B. ein Enum-Wert als Beschriftung).
 */

const dir = join(import.meta.dirname, '..', '..', 'content');
const ui = JSON.parse(readFileSync(join(dir, 'ui.json'), 'utf8')) as Record<string, Record<string, string> | string>;
const content = JSON.parse(readFileSync(join(dir, 'akt1-tag1-3.json'), 'utf8'));

/** Fields that hold ids or enum values; they are never shown as such. */
const NOT_SHOWN = new Set(['type', 'kind', 'correct', 'correctStamp', 'stamps', 'options', 'rules', 'cases', 'sourceUrl', 'version']);

const atoms = new Set<string>();
const collect = (v: unknown, field = '') => {
  if (typeof v === 'string' || typeof v === 'number') {
    if (!NOT_SHOWN.has(field)) atoms.add(String(v).trim());
  } else if (Array.isArray(v)) v.forEach((x) => collect(x, field));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => collect(x, k));
};
collect(content);

const patterns: { key: string; re: RegExp; holes: number }[] = [];
for (const [area, entries] of Object.entries(ui)) {
  if (typeof entries === 'string') continue;
  for (const [k, text] of Object.entries(entries)) {
    const parts = text.trim().split(/\{\w+\}/);
    if (parts.length === 1) atoms.add(text.trim());
    else {
      const esc = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      patterns.push({ key: `${area}.${k}`, re: new RegExp(`^${esc.join('(.+?)')}$`), holes: parts.length - 1 });
    }
  }
}

const AMOUNT = /^−?\d{1,3}(\.\d{3})*,\d{2} €$/;
const NUMBER = /^\d+$/;

/** True if `s` is an allowed atom or a ui.json pattern whose holes are allowed again. */
function allowed(s: string, depth = 3): boolean {
  s = s.trim();
  if (s === '' || atoms.has(s) || AMOUNT.test(s) || NUMBER.test(s)) return true;
  if (depth === 0) return false;
  for (const p of patterns) {
    for (const re of [p.re, new RegExp(p.re.source.replaceAll('(.+?)', '(.+)'))]) {
      const m = re.exec(s);
      if (m && m.slice(1).every((g) => allowed(g, depth - 1))) return true;
    }
  }
  return false;
}

const seen = new Set<string>();
async function check(page: Page, where: string) {
  const items = await page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.parentElement?.closest('script, style')) continue;
      if (n.textContent?.trim()) out.push(n.textContent);
    }
    const attrs = ['aria-label', 'aria-roledescription', 'aria-valuetext', 'aria-description', 'placeholder', 'title', 'alt'];
    for (const el of document.body.querySelectorAll('*')) for (const a of attrs) if (el.hasAttribute(a)) out.push(el.getAttribute(a)!);
    out.push(document.title);
    return out;
  });
  items.forEach((s) => seen.add(s.trim()));
  const foreign = [...new Set(items.filter((s) => !allowed(s)).map((s) => s.trim()))];
  expect(foreign, `Text ohne Herkunft in ui.json oder Inhalt (${where})`).toEqual([]);
}

const flip = (v: string) => (v === 'anerkennen' ? 'streichen' : 'anerkennen');

test('jeder sichtbare und vorgelesene Text stammt aus ui.json oder dem Inhalt', async ({ page }) => {
  test.setTimeout(60_000);
  await freshStart(page);
  await check(page, 'Startbildschirm');
  await page.locator('.settings summary').click();
  await check(page, 'Einstellungen');
  await page.locator('.settings summary').click();

  await key(page, 'new-game').click();
  await check(page, 'Tag 1 Beginn');
  await key(page, 'begin').click();
  await check(page, 'leerer Tisch');
  await key(page, 'stack').click();
  await check(page, 'Akte offen');
  await key(page, 'paper-0').dblclick();
  await check(page, 'Zoom');
  await page.keyboard.press('Escape');
  await key(page, 'codex-search').fill('werbungskosten');
  await check(page, 'Kodex-Suche');
  await key(page, 'codex-search').fill('');
  await key(page, 'codex-toggle').click();
  await check(page, 'Kodex zu');
  await key(page, 'codex-toggle').click();

  // Day 1 wrong: flipped verdicts, one left open, wrong stamp → reprimand and every error line.
  for (let first = true; await page.locator('.screen.desk').isVisible(); first = false) {
    if (!first) await key(page, 'stack').click();
    const id = (await page.locator('.pruefvermerk').getAttribute('data-akte'))!;
    const s = solutionFor(id);
    // Verdicts flipped; the first position of the first Akte stays undecided („–“ in the summary).
    const answers = Object.entries(s.positions).slice(first ? 1 : 0);
    for (const [pid, v] of answers) await key(page, `pos-${pid}-${flip(v)}`).click();
    await key(page, `stamp-${s.stamp}`).click();
    await check(page, `gestempelt ${id}`);
    await key(page, 'outbox').click();
  }
  await check(page, 'Auswertung Tag 1 mit Ermahnung');

  // Day 2 correct, day 3 with a wrong option and 3-4 sent back for documents.
  await key(page, 'advance').click();
  await check(page, 'Tag 2 Beginn');
  await key(page, 'begin').click();
  while (await page.locator('.screen.desk').isVisible()) await solveNext(page);
  await check(page, 'Auswertung Tag 2');
  await key(page, 'advance').click();
  await check(page, 'Tag 3 Beginn');
  await key(page, 'begin').click();
  while (await page.locator('.screen.desk').isVisible()) {
    await key(page, 'stack').click();
    const id = (await page.locator('.pruefvermerk').getAttribute('data-akte'))!;
    const s = solutionFor(id);
    for (const [pid, v] of Object.entries(s.positions)) await key(page, `pos-${pid}-${v}`).click();
    if (s.option) {
      const other = await page.locator(`.option:not([data-key="opt-${s.option}"])`).first().getAttribute('data-key');
      await key(page, other!).click();
    }
    await check(page, `Tag 3 ${id}`);
    await key(page, `stamp-${s.stamp}`).click();
    await key(page, 'outbox').click();
  }
  await check(page, 'Auswertung Tag 3');
  await key(page, 'advance').click();
  await check(page, 'Tag 4 Beginn');
  await key(page, 'begin').click();
  await key(page, 'stack').click();
  await check(page, 'Nachreichung');
  const s = solutionFor((await page.locator('.pruefvermerk').getAttribute('data-akte'))!);
  await key(page, `stamp-${s.stamp}`).click();
  await key(page, 'outbox').click();
  await check(page, 'Auswertung Tag 4');
  await key(page, 'advance').click();
  await check(page, 'Ende');

  // Coverage: the walk reached the labels that used to be raw enum values.
  for (const t of ['anerkennen', 'streichen', 'voll', 'reduziert', 'aus']) expect([...seen]).toContain(t);
});
