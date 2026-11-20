import { test } from '@playwright/test';
import { freshStart, key, playDay, solutionFor, solveNext } from './helpers';

/** Screenshots of the main views (SPEC section 10.4). Output: screenshots/. */
const shot = (name: string) => `screenshots/${name}.png`;

test('Screenshots der Hauptansichten', async ({ page }) => {
  await freshStart(page);
  await page.screenshot({ path: shot('1-startbildschirm'), fullPage: true });

  await key(page, 'new-game').click();
  await playDay(page);
  await key(page, 'advance').click();
  await page.screenshot({ path: shot('2-tagesbeginn-tag2'), fullPage: true });

  await key(page, 'begin').click();
  await solveNext(page);
  await solveNext(page);
  await solveNext(page);
  await key(page, 'stack').click(); // 2-4 with office stamp
  await key(page, 'pos-p1-streichen').click();
  await page.screenshot({ path: shot('3-schreibtisch-akte-kodex-offen'), fullPage: true });

  await key(page, 'codex-toggle').click();
  await page.screenshot({ path: shot('4-schreibtisch-kodex-zu'), fullPage: true });
  await key(page, 'codex-toggle').click();
  await key(page, 'codex-search').fill('kleidung');
  await page.screenshot({ path: shot('5-kodex-suche') });

  await key(page, 'pos-p2-anerkennen').click();
  await key(page, 'stamp-bescheid').click();
  await key(page, 'outbox').click();
  await page.screenshot({ path: shot('6-tagesauswertung'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await key(page, 'advance').click();
  await key(page, 'begin').click();
  await key(page, 'stack').click();
  await page.screenshot({ path: shot('7-mobil-steuerpflicht'), fullPage: true });
});

test('Screenshots: Ermahnung und leerer Tag 4', async ({ page }) => {
  await freshStart(page);
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  const flip = (s: ReturnType<typeof solutionFor>) => ({
    ...s,
    positions: Object.fromEntries(Object.entries(s.positions).map(([k, v]) => [k, v === 'anerkennen' ? 'streichen' : 'anerkennen'])),
  });
  while (await page.locator('.screen.desk').isVisible()) await solveNext(page, (id) => flip(solutionFor(id)));
  await page.screenshot({ path: shot('8-auswertung-ermahnung'), fullPage: true });
  await key(page, 'advance').click();
  await playDay(page);
  await key(page, 'advance').click();
  await key(page, 'begin').click();
  while (await page.locator('.screen.desk').isVisible()) {
    await solveNext(page, (id) => (id === '3-4' ? { positions: {}, stamp: 'bescheid' } : solutionFor(id)));
  }
  await key(page, 'advance').click();
  await page.screenshot({ path: shot('9-tag4-intro'), fullPage: true });
  await key(page, 'begin').click();
  await page.screenshot({ path: shot('10-tag4-leer'), fullPage: true });
  await key(page, 'advance').click();
  await page.screenshot({ path: shot('11-ende'), fullPage: true });
});

test('Screenshots: gezogene Papiere, Stempelabdruck, Zoom, Einstellungen', async ({ page }) => {
  await freshStart(page);
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  await key(page, 'stack').click();
  const drag = async (k: string, dx: number, dy: number) => {
    const b = (await key(page, k).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height - 12);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height - 12 + dy, { steps: 8 });
    await page.mouse.up();
  };
  await drag('paper-2', -260, -40);
  await drag('paper-0', 40, 140);
  await key(page, 'pos-p1-anerkennen').click();
  await key(page, 'pos-p2-streichen').click();
  await key(page, 'stamp-bescheid').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: shot('12-gezogen-gestempelt'), fullPage: true });
  await key(page, 'paper-1').dblclick();
  await page.waitForTimeout(300);
  await page.screenshot({ path: shot('13-zoom') });
  await page.keyboard.press('Escape');
  await page.locator('.settings summary').click();
  await page.screenshot({ path: shot('14-einstellungen') });
});
