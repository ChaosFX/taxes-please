import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drawUntil, enter, freshStart, key, longTest, markKey, playDay, solutionFor, solveNext, startAtDay } from './helpers';

/**
 * Auftrag 02: Jeder Text, den der Spieler sieht oder ein Screenreader vorliest,
 * stammt aus content/ui.json oder aus der Inhaltsdatei. Ergänzt den Literal-Test
 * in tests/unit: der findet Text im Quellcode, dieser hier Text im fertigen DOM,
 * auch wenn er über eine Variable hineinkommt (z. B. ein Enum-Wert als Beschriftung).
 */

const dir = join(import.meta.dirname, '..', '..', 'content');
const ui = JSON.parse(readFileSync(join(dir, 'ui.json'), 'utf8')) as Record<string, Record<string, string> | string>;
const content = JSON.parse(readFileSync(join(dir, 'akt1.json'), 'utf8'));

/** Fields that hold ids or enum values; they are never shown as such. */
const NOT_SHOWN = new Set(['type', 'kind', 'correct', 'correctStamp', 'stamps', 'options', 'rules', 'cases', 'sourceUrl', 'version', 'value', 'feature', 'decision', 'answerType']);

const atoms = new Set<string>();
const collect = (v: unknown, field = '') => {
  if (typeof v === 'string' || typeof v === 'number') {
    if (!NOT_SHOWN.has(field)) atoms.add(String(v).trim());
  } else if (Array.isArray(v)) v.forEach((x) => collect(x, field));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => collect(x, k));
};
collect(content);
// Option objects ({ value, label }) are shown by label; plain string options by texts.optionLabels.
for (const k of content.cases) for (const d of [...(k.decisions ?? []), ...(k.followUp?.decisions ?? [])]) for (const o of d.options ?? []) if (typeof o !== 'string') atoms.add(o.label);

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

/** What the player types into an amount field comes back as typed when unreadable. */
const TYPED = 'abc';
atoms.add(TYPED);

const AMOUNT = /^−?\d{1,3}(\.\d{3})*,\d{2} €$/;
const NUMBER = /^\d+$/;
/** Calculator display: Austrian number format, possibly unfinished (`4.236,`). */
const CALC_NUMBER = /^−?\d{1,3}(\.\d{3})*(,\d*)?$/;
/** Act numbers on the end screen. */
const ROMAN = /^[IVXLCDM]+$/;

/** True if `s` is an allowed atom or a ui.json pattern whose holes are allowed again. */
function allowed(s: string, depth = 3): boolean {
  s = s.trim();
  if (s === '' || atoms.has(s) || AMOUNT.test(s) || NUMBER.test(s) || CALC_NUMBER.test(s) || ROMAN.test(s)) return true;
  if (depth === 0) return false;
  for (const p of patterns) {
    for (const re of [p.re, new RegExp(p.re.source.replaceAll('(.+?)', '(.+)'))]) {
      const m = re.exec(s);
      if (m && m.slice(1).every((g) => allowed(g, depth - 1))) return true;
    }
  }
  return false;
}

/** Content texts, for pieces of excerpts and highlighted passages (search in the codex). */
const contentTexts = [...atoms].filter((a) => a.length > 20);
/** A piece of an excerpt must be part of one content text. Other texts lose the marker and are checked as usual. */
function excerptOk(s: string): boolean {
  if (!s.startsWith('\u0000')) return false;
  const piece = s.slice(1).trim();
  return piece === '' || allowed(piece) || contentTexts.some((t) => t.includes(piece));
}

const seen = new Set<string>();
async function check(page: Page, where: string) {
  const items = await page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.parentElement?.closest('script, style')) continue;
      // Excerpts and highlighted passages split a content text into pieces; marked for the check.
      const excerpt = n.parentElement?.closest('[data-excerpt]') ? '\u0000' : '';
      if (n.textContent?.trim()) out.push(excerpt + n.textContent);
    }
    const attrs = ['aria-label', 'aria-roledescription', 'aria-valuetext', 'aria-description', 'placeholder', 'title', 'alt'];
    for (const el of document.body.querySelectorAll('*')) for (const a of attrs) if (el.hasAttribute(a)) out.push(el.getAttribute(a)!);
    out.push(document.title);
    return out;
  });
  items.forEach((s) => seen.add(s.trim()));
  const foreign = [...new Set(items.filter((s) => !allowed(s) && !excerptOk(s)).map((s) => s.trim()))];
  expect(foreign, `Text ohne Herkunft in ui.json oder Inhalt (${where})`).toEqual([]);
}

const flip = (v: string) => (v === 'anerkennen' ? 'streichen' : 'anerkennen');

test('jeder sichtbare und vorgelesene Text stammt aus ui.json oder dem Inhalt', async ({ page }) => {
  longTest(180_000);
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
  await check(page, 'Kodex zu');
  await key(page, 'codex-book').click();
  await check(page, 'Kodex offen');
  await key(page, 'codex-search').fill('werbungskosten');
  await check(page, 'Kodex-Suche');
  await key(page, 'hit-R1').click();
  await check(page, 'Kodex-Treffer markiert');
  await key(page, 'codex-search-clear').click();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowRight');
  await check(page, 'Kodex gesperrte Seite');
  await page.keyboard.press('Escape');

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
  await check(page, 'Tag 4 Beginn mit Zeitung');
  await key(page, 'begin').click();
  await key(page, 'stack').click();
  await check(page, 'Nachreichung');
  const s = solutionFor((await page.locator('.pruefvermerk').getAttribute('data-akte'))!);
  await key(page, `stamp-${s.stamp}`).click();
  await key(page, 'outbox').click();
  // Day 4: Entscheidungen with options as text and as objects, wrong answers everywhere.
  for (;;) {
    await key(page, 'stack').click();
    const id = (await page.locator('.pruefvermerk').getAttribute('data-akte'))!;
    await check(page, `Tag 4 ${id}`);
    const sol = solutionFor(id);
    for (const d of Object.keys(sol.decisions)) {
      const other = await page.locator(`[data-decision="${d}"] .option[aria-pressed="false"]`).last().getAttribute('data-key');
      await key(page, other!).click();
    }
    await key(page, `stamp-${sol.stamp === 'bescheid' ? 'ergaenzung' : 'bescheid'}`).click();
    await key(page, 'outbox').click();
    if (!(await page.locator('.screen.desk').isVisible())) break;
  }
  await check(page, 'Auswertung Tag 4 mit Entscheidungsfehlern');

  // Day 5: newspaper on the desk, zoomed; 5-3 with a wrong pair marked and the right one forgotten.
  await startAtDay(page, 5);
  await check(page, 'Tag 5 Beginn');
  await drawUntil(page, '5-3');
  await key(page, 'newspaper-0').dblclick();
  await check(page, 'Zeitung gezoomt');
  await page.keyboard.press('Escape');
  await key(page, 'mark-mode').click();
  await check(page, 'Markiermodus');
  await key(page, 'mark-0-0').click();
  await key(page, 'mark-1-0').click();
  await check(page, 'Markierung gesetzt');
  await enter(page, '5-3', { ...solutionFor('5-3'), marks: [] });
  while (await page.locator('.screen.desk').isVisible()) await solveNext(page);
  await check(page, 'Auswertung Widersprüche');

  // Day 6: question choice, a wrong one.
  await startAtDay(page, 6);
  await drawUntil(page, '6-3');
  await key(page, 'stamp-ergaenzung').click();
  await check(page, 'Nachfrage-Auswahl');
  await key(page, 'inq-q3').click();
  await key(page, 'outbox').click();
  while (await page.locator('.screen.desk').isVisible()) await solveNext(page);
  await check(page, 'Auswertung Nachfrage');

  // Day 8 and 9: calculator, amounts (wrong and unreadable), phone call.
  await startAtDay(page, 8);
  await check(page, 'Tag 8 Freischaltung Rechner');
  await drawUntil(page, '8-1');
  for (const k of ['1', 'comma', '5', 'div', '0', 'eq']) await key(page, `calc-${k}`).click();
  await check(page, 'Rechner Fehler');
  await key(page, 'calc-clear').click();
  for (const k of ['4', '2', '3', '6', 'comma', '7']) await key(page, `calc-${k}`).click();
  await check(page, 'Rechner Zahl');
  await key(page, 'amt-d1').fill(TYPED);
  await key(page, 'amt-d2').fill('181');
  await key(page, 'amt-d2').blur();
  await check(page, 'Betragsfeld');
  await enter(page, '8-1', { ...solutionFor('8-1'), amounts: {} });
  while (await page.locator('.screen.desk').isVisible()) await solveNext(page);
  await check(page, 'Auswertung Beträge');
  await startAtDay(page, 9);
  await check(page, 'Tag 9 Anruf');

  // Day 10: note with title, then the end screen of Akt I.
  await startAtDay(page, 10);
  await check(page, 'Tag 10 Notizbuch');
  await playDay(page);
  await check(page, 'Auswertung Tag 10');
  await key(page, 'advance').click();
  await check(page, 'Ende von Akt I');

  // Coverage: the walk reached the labels that used to be raw enum values.
  for (const t of ['anerkennen', 'streichen', 'voll', 'reduziert', 'aus']) expect([...seen]).toContain(t);
});
