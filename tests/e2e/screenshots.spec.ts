import { test } from '@playwright/test';
import { drawUntil, enter, freshStart, key, markKey, playDay, solutionFor, solveNext, startAtDay } from './helpers';

/** Screenshots of the main views (SPEC section 10.3). Output: screenshots/. */
const shot = (name: string) => `screenshots/${name}.png`;

test('Screenshots Akt I (SPEC 10.3)', async ({ page }) => {
  test.setTimeout(120_000);
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

  // Mark mode with one pair (5-3, six papers).
  await startAtDay(page, 5);
  await drawUntil(page, '5-3');
  const w = solutionFor('5-3').marks[0]!;
  await key(page, 'mark-mode').click();
  await key(page, markKey('5-3', w.a)).click();
  await key(page, markKey('5-3', w.b)).click();
  await key(page, 'mark-0-1').click(); // a pending first line of the next pair
  await page.screenshot({ path: shot('04-markiermodus-paar'), fullPage: true });

  // Question choice before the stamp (6-3).
  await startAtDay(page, 6);
  await drawUntil(page, '6-3');
  const s63 = solutionFor('6-3');
  for (const [d, v] of Object.entries(s63.decisions)) await key(page, `dec-${d}-${v}`).click();
  await key(page, 'stamp-ergaenzung').click();
  await page.screenshot({ path: shot('05-nachfrage-auswahl'), fullPage: true });

  // Codex open with a hint rule (R28, day 6).
  await key(page, 'codex-search').fill('R28');
  await key(page, 'codex-search').fill('');
  await page.locator('.rule[data-rule="R28"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: shot('06-kodex-hinweisregel') });

  // Desk with an amount field and the calculator (day 8, 8-1).
  await startAtDay(page, 8);
  await page.screenshot({ path: shot('07-tag8-freischaltung-rechner'), fullPage: true });
  await drawUntil(page, '8-1');
  await key(page, 'amt-d1').fill('300');
  await key(page, 'dec-d3-nein').click();
  for (const k of ['1', '5', '0', '0', 'div', '5', 'eq']) await key(page, `calc-${k}`).click();
  await page.screenshot({ path: shot('08-entscheidungen-betragsfeld-rechner'), fullPage: true });
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

test('Screenshots mobil und Effekte', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startAtDay(page, 9);
  await drawUntil(page, '9-2');
  await key(page, 'mark-mode').click();
  await page.screenshot({ path: shot('14-mobil-markiermodus'), fullPage: true });
  await enter(page, '9-2', solutionFor('9-2'));
  await solveNext(page);
  await solveNext(page);
  await key(page, 'stack').click(); // 9-5 with amount fields
  await page.screenshot({ path: shot('15-mobil-betragsfeld'), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await freshStart(page);
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  await key(page, 'stack').click();
  await key(page, 'pos-p1-anerkennen').click();
  await key(page, 'pos-p2-streichen').click();
  await key(page, 'stamp-bescheid').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: shot('16-gestempelt'), fullPage: true });
  await page.locator('.settings summary').click();
  await page.screenshot({ path: shot('17-einstellungen') });
});
