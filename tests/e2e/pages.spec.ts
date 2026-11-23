import { expect, test } from '@playwright/test';
import { BASE_PATH } from './base-path';
import { SMOKE, fileAkte, freshStart, key, openAkte, solveNext, stampAkte } from './helpers';

/**
 * Auftrag 02, Aufgabe 5: The build works under the GitHub Pages sub-path.
 * Every request stays under the sub-path and succeeds; font, audio and the
 * content (bundled into the script) are found; reloading on the desk works.
 */
test('Unterpfad: alle Dateien gefunden, Schrift und Ton geladen, Neuladen am Schreibtisch', SMOKE, async ({ page }) => {
  const bad: string[] = [];
  page.on('response', (r) => {
    const url = new URL(r.url());
    if (url.hostname === 'localhost' && (!url.pathname.startsWith(BASE_PATH) || r.status() >= 400)) bad.push(`${r.status()} ${url.pathname}`);
  });
  page.on('requestfailed', (r) => bad.push(`fehlgeschlagen ${r.url()}`));

  await freshStart(page);
  expect(new URL(page.url()).pathname).toBe(BASE_PATH);
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  await key(page, 'stack').click();

  // Typewriter font (Courier Prime, bundled) is loaded and used on the papers.
  const font = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      loaded: document.fonts.check('16px "Courier Prime"'),
      used: getComputedStyle(document.querySelector('.paper.doc')!).fontFamily,
    };
  });
  expect(font.loaded).toBe(true);
  expect(font.used).toContain('Courier Prime');

  // Audio: effects and music are fetched from the sub-path after the first click.
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').map((e) => new URL(e.name).pathname).filter((p) => p.includes('/audio/')))).toEqual(
    expect.arrayContaining([`${BASE_PATH}audio/stempel-1.mp3`, `${BASE_PATH}audio/musik-akt1.mp3`]),
  );

  // Content came with the script: the desk shows an Akte from the JSON.
  await expect(page.locator('.pruefvermerk')).toContainText('Akte 1-1');

  // Reload on the desk, then continue where we were: the open Akte lies on top of the inbox again (SPEC 9).
  await page.keyboard.press('Escape');
  await page.reload();
  expect(new URL(page.url()).pathname).toBe(BASE_PATH);
  await key(page, 'continue').click();
  await openAkte(page);
  await expect(page.locator('.pruefvermerk')).toHaveAttribute('data-akte', '1-1');
  await stampAkte(page, 'bescheid');
  await fileAkte(page);
  await solveNext(page);
  await page.reload();
  await key(page, 'continue').click();
  await expect(page.locator('.screen.desk, .screen.summary')).toBeVisible();

  expect(bad).toEqual([]);
});
