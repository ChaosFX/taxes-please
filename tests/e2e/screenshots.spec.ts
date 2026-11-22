import { expect, test, type Page } from '@playwright/test';
import { drawUntil, enter, freshStart, key, markKey, openAkte, playDay, pullOut, solutionFor, startAtDay } from './helpers';

/** Screenshots of the main views (SPEC section 10.3). Output: screenshots/. */
const shot = (name: string) => `screenshots/${name}.png`;
const calm = (p: Page) => p.evaluate(() => document.fonts.ready).then(() => p.waitForTimeout(700));

test('Screenshots Akt I (SPEC 10.3)', async ({ page }) => {
  test.setTimeout(180_000);
  await freshStart(page);
  await page.screenshot({ path: shot('01-startbildschirm'), fullPage: true });

  // Morning paper: intro and on the desk.
  await startAtDay(page, 4);
  await page.screenshot({ path: shot('02-tag4-morgenzeitung-intro'), fullPage: true });
  await key(page, 'begin').click();
  await key(page, 'newspaper-0').dblclick();
  await page.waitForTimeout(250);
  await page.screenshot({ path: shot('03-morgenzeitung-zoom') });
  await page.keyboard.press('Escape');

  // Mark mode with one pair (5-3, six papers, all taken out).
  await startAtDay(page, 5);
  await drawUntil(page, '5-3');
  for (let i = 0; i < 6; i++) await pullOut(page, i);
  const w = solutionFor('5-3').marks[0]!;
  await key(page, 'mark-mode').click();
  await key(page, markKey('5-3', w.a)).press('Enter');
  await key(page, markKey('5-3', w.b)).press('Enter');
  await key(page, 'mark-0-1').press('Enter'); // a pending first line of the next pair
  await calm(page);
  await page.screenshot({ path: shot('04-markiermodus-paar') });

  // Question choice before the stamp (6-3).
  await startAtDay(page, 6);
  await drawUntil(page, '6-3');
  const s63 = solutionFor('6-3');
  for (const [d, v] of Object.entries(s63.decisions)) await key(page, `dec-${d}-${v}`).click();
  await key(page, 'stamp-ergaenzung').click();
  await calm(page);
  await page.screenshot({ path: shot('05-nachfrage-auswahl') });

  // Codex open with a hint rule (R28, day 6).
  await page.keyboard.press('k');
  await page.keyboard.press('Home');
  await key(page, 'toc-R28').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: shot('06-kodex-hinweisregel') });
  await page.keyboard.press('Escape');

  // Desk with an amount field and the calculator (day 8, 8-1).
  await startAtDay(page, 8);
  await page.screenshot({ path: shot('07-tag8-freischaltung-rechner'), fullPage: true });
  await drawUntil(page, '8-1');
  await key(page, 'calc-tool').click();
  await key(page, 'amt-d1').fill('300');
  await key(page, 'dec-d3-nein').click();
  for (const k of ['1', '5', '0', '0', 'div', '5', 'eq']) await key(page, `calc-${k}`).click();
  await calm(page);
  await page.screenshot({ path: shot('08-entscheidungen-betragsfeld-rechner') });
  await page.locator('.calculator').screenshot({ path: shot('09-rechner') });

  // Day 9: phone call; evaluation with a wrong amount and a missed contradiction.
  await startAtDay(page, 9);
  await page.screenshot({ path: shot('10-tag9-anruf'), fullPage: true });
  await playDay(page, {
    answer: (id) => {
      const s = solutionFor(id);
      if (id === '9-2') return { ...s, marks: [] };
      if (id === '9-5') return { ...s, amounts: { ...s.amounts, d3: '4236,07' } };
      return s;
    },
  });
  await page.locator('.result[data-akte="9-5"] details').evaluate((d) => ((d as HTMLDetailsElement).open = true));
  await page.screenshot({ path: shot('11-auswertung-betrag-widerspruch'), fullPage: true });

  // End of Akt I after day 10.
  await startAtDay(page, 10);
  await page.screenshot({ path: shot('12-tag10-intro'), fullPage: true });
  await playDay(page);
  await key(page, 'advance').click();
  await page.screenshot({ path: shot('13-ende-akt-1'), fullPage: true });
});

/** The desk of Auftrag 05 (SPEC 7.1 to 7.5, 10.3), at 1280 × 720. Output: screenshots/tisch-*.png. */
test('Screenshots Arbeitstisch', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await freshStart(page);
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  await calm(page);
  await page.screenshot({ path: shot('tisch-01-leer-tag1') });
  await openAkte(page);
  await calm(page);
  await page.screenshot({ path: shot('tisch-02-mappe-tasche') });
  for (const i of [0, 1, 2]) await pullOut(page, i);
  await key(page, 'codex-book').click();
  await calm(page);
  await page.screenshot({ path: shot('tisch-03-drei-papiere-kodex') });
  await key(page, 'pos-p1-anerkennen').click();
  await key(page, 'pos-p2-streichen').click();
  await key(page, 'stamp-bescheid').click();
  await key(page, 'close-akte').click();
  await expect(page.locator('.folder.on-desk')).toBeVisible();
  await calm(page);
  await page.screenshot({ path: shot('tisch-05-zugeklappt-gestempelt') });
  await key(page, 'outbox').click();

  // Day 8: calendar and calculator open next to an Akte.
  await startAtDay(page, 8);
  await key(page, 'begin').click();
  await key(page, 'calendar-tool').click();
  await key(page, 'calc-tool').click();
  await openAkte(page);
  await calm(page);
  await page.screenshot({ path: shot('tisch-06-tag8-kalender-rechner') });
  // Calendar April 2026 with a chosen range (from 21 March).
  await key(page, 'cal-prev').click();
  await key(page, 'cal-2026-3-21').click();
  await key(page, 'cal-next').click();
  await key(page, 'cal-2026-4-3').click();
  await page.locator('.calendar-open').screenshot({ path: shot('tisch-07-kalender-april-auswahl') });

  // Longest Prüfvermerk of Akt I (7-4, five decisions) and 7-3 with six papers out.
  await startAtDay(page, 7);
  await drawUntil(page, '7-3');
  for (let i = 0; i < 6; i++) await pullOut(page, i);
  await calm(page);
  await page.screenshot({ path: shot('tisch-08-sechs-papiere') });
  await enter(page, '7-3', solutionFor('7-3'));
  await openAkte(page);
  await calm(page);
  await page.screenshot({ path: shot('tisch-09-laengster-pruefvermerk-7-4') });

  for (const [w, h] of [[1920, 1080], [1024, 768]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await calm(page);
    await page.screenshot({ path: shot(`tisch-10-${w}x${h}`) });
  }
});

test('Screenshots Effekte und Einstellungen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await freshStart(page);
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  await openAkte(page);
  await key(page, 'pos-p1-anerkennen').click();
  await key(page, 'pos-p2-streichen').click();
  await key(page, 'stamp-bescheid').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: shot('16-gestempelt') });
  await page.locator('.settings summary').click();
  await page.screenshot({ path: shot('17-einstellungen') });
});

/** Codex views of Auftrag 04 (SPEC 6, 10.3). Output: screenshots/kodex-*.png. */
test('Screenshots Kodex als Buch', async ({ page }) => {
  test.setTimeout(120_000);
  const settle = (p: Page) => p.evaluate(() => document.fonts.ready).then(() => p.waitForTimeout(650));
  await page.setViewportSize({ width: 1440, height: 900 });

  // 1. Closed in the tool rail, day 1 and day 10 (thickness).
  await freshStart(page);
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  await page.screenshot({ path: shot('kodex-01-zu-tag1') });
  await page.locator('.tool-codex').screenshot({ path: shot('kodex-01a-zu-tag1-detail') });
  // 6. Locked page on day 1.
  await page.keyboard.press('k');
  await settle(page);
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowRight');
  await settle(page);
  await page.screenshot({ path: shot('kodex-06-gesperrte-seite') });
  await page.keyboard.press('Escape');

  await startAtDay(page, 10);
  await key(page, 'begin').click();
  await page.screenshot({ path: shot('kodex-01-zu-tag10') });
  await page.locator('.tool-codex').screenshot({ path: shot('kodex-01b-zu-tag10-detail') });
  // On the desk, small double page.
  await key(page, 'codex-book').click();
  await settle(page);
  await page.locator('.desk-book').screenshot({ path: shot('kodex-11-am-tisch') });

  // 4. Today's delivery with „neu“ (opens there).
  await page.keyboard.press('k');
  await settle(page);
  await page.screenshot({ path: shot('kodex-04-heutige-lieferung-neu') });
  // 2. Register on day 10.
  await page.keyboard.press('Home');
  await settle(page);
  await page.screenshot({ path: shot('kodex-02-inhaltsverzeichnis-tag10') });
  // 3. Hint rule.
  await key(page, 'toc-R36').click();
  await settle(page);
  await page.screenshot({ path: shot('kodex-03-hinweisregel') });
  // 5. Search with hits, then the marked word in the text.
  await key(page, 'codex-search').fill('abzugsfahig');
  await settle(page);
  await page.screenshot({ path: shot('kodex-05a-suche-treffer') });
  await page.locator('.search-hit').nth(1).click();
  await settle(page);
  await page.screenshot({ path: shot('kodex-05b-suche-markiert') });
  await key(page, 'codex-search-clear').click();
  // 7. Register tabs with locked tabs (day 4).
  await page.keyboard.press('Escape');
  await startAtDay(page, 4);
  await key(page, 'begin').click();
  await page.keyboard.press('k');
  await settle(page);
  await page.locator('.register-tabs').screenshot({ path: shot('kodex-07-griffregister') });
  await page.screenshot({ path: shot('kodex-07b-tag4-geoeffnet') });
  // 9. Mid page turn (effects „voll“).
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(190);
  await page.screenshot({ path: shot('kodex-09-umblaettern') });
  await page.keyboard.press('Escape');

  // 8. Narrow view with a single page.
  await page.setViewportSize({ width: 390, height: 844 });
  await startAtDay(page, 10);
  await key(page, 'begin').click();
  await page.screenshot({ path: shot('kodex-08a-mobil-tisch'), fullPage: true });
  await page.keyboard.press('k');
  await settle(page);
  await page.screenshot({ path: shot('kodex-08-mobil-einzelseite') });
  await page.keyboard.press('Home');
  await settle(page);
  await page.screenshot({ path: shot('kodex-08b-mobil-inhalt') });

  // 1280 × 720 for the smallest double page.
  await page.setViewportSize({ width: 1280, height: 720 });
  await startAtDay(page, 9);
  await key(page, 'begin').click();
  await page.keyboard.press('k');
  await settle(page);
  await page.screenshot({ path: shot('kodex-10-1280x720') });
});
