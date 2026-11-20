import { expect, test } from '@playwright/test';
import { freshStart, key, playDay, solutionFor, solveNext } from './helpers';

test('perfektes Spiel über alle Tage mit Neuladen: null Fehler, Folgeakte an Tag 4', async ({ page }) => {
  await freshStart(page);
  await key(page, 'new-game').click();
  for (const day of [1, 2, 3]) {
    await expect(page.locator('.day-card h1')).toHaveText(`Tag ${day}`);
    await playDay(page, { reloadAfter: 2 });
    await expect(page.getByTestId('errors-total')).toHaveText('Keine Fehler.');
    await key(page, 'advance').click();
  }
  await expect(page.locator('.day-card h1')).toHaveText('Tag 4');
  await playDay(page);
  await expect(page.locator('.result')).toHaveCount(1);
  await expect(page.locator('.result[data-akte="3-4/folge"]')).toBeVisible();
  await expect(page.getByTestId('errors-total')).toHaveText('Keine Fehler.');
  await key(page, 'advance').click();
  await expect(page.locator('.screen.finished')).toBeVisible();
});

test('Bescheid bei 3-4: Tag 4 ohne Post, dann Schlussbildschirm', async ({ page }) => {
  await freshStart(page);
  await key(page, 'new-game').click();
  for (const day of [1, 2]) {
    await playDay(page);
    await key(page, 'advance').click();
    expect(day).toBeGreaterThan(0);
  }
  await key(page, 'begin').click();
  while (await page.locator('.screen.desk').isVisible()) {
    await solveNext(page, (id) => (id === '3-4' ? { positions: {}, stamp: 'bescheid' } : solutionFor(id)));
  }
  await expect(page.getByTestId('errors-total')).toHaveText('Fehler heute: 1');
  await key(page, 'advance').click();
  await expect(page.locator('.day-card h1')).toHaveText('Tag 4');
  await key(page, 'begin').click();
  await expect(page.locator('.result')).toHaveCount(0);
  await expect(page.getByTestId('empty-day')).toHaveText('Heute ist keine Post gekommen. Ein ruhiger Tag.');
  await key(page, 'advance').click();
  await expect(page.locator('.screen.finished h1')).toHaveText('Ende des Prototyps');
});

test('Ermahnung ab drei Fehlern, Auswertung zeigt Lösung und Fundstelle', async ({ page }) => {
  await freshStart(page);
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  const flip = (id: string) => {
    const s = solutionFor(id);
    const positions = Object.fromEntries(Object.entries(s.positions).map(([k, v]) => [k, v === 'anerkennen' ? 'streichen' : 'anerkennen']));
    return { ...s, positions };
  };
  while (await page.locator('.screen.desk').isVisible()) await solveNext(page, flip);
  await expect(page.getByTestId('errors-total')).toHaveText('Fehler heute: 6');
  await expect(page.locator('.reprimand figcaption')).toHaveText('Dr. Wallner:');
  await expect(page.locator('.reprimand blockquote')).toHaveText(/^Drei Fehler an einem Tag\./);
  await expect(page.locator('.result[data-akte="1-1"] .errors li').first()).toHaveText('Fachbuch Bilanzierung: streichen → anerkennen');
  const first = page.locator('.result[data-akte="1-1"]');
  await expect(first).toContainText('falsch');
  await expect(first.locator('.explanation').first()).toContainText('Fachbuch');
  await expect(first.locator('.rule-refs a').first()).toHaveText('§ 16 Abs. 1 erster Satz EStG');
});

test('Kodex: gesperrte Seiten ohne Inhalt, Suche nur über freigeschaltete', async ({ page }) => {
  await freshStart(page);
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  const locked = page.locator('.rule.locked');
  await expect(locked).toHaveCount(5);
  await expect(locked.first()).toHaveText('Gesperrt – ab Tag 2');
  await expect(page.locator('.codex')).not.toContainText('Lebensführung');
  await key(page, 'codex-search').fill('wohnsitz');
  await expect(page.locator('.codex-list .rule')).toHaveCount(0);
  await key(page, 'codex-search').fill('werkzeug');
  await expect(page.locator('.codex-list .rule')).toHaveCount(1);
  await key(page, 'codex-toggle').click();
  await expect(page.locator('.codex-list')).toHaveCount(0);
});

test('eine Akte vollständig mit der Tastatur', async ({ page }) => {
  await freshStart(page);
  /** Tabs to the element with data-key and presses Enter. Fails if unreachable. */
  const press = async (k: string) => {
    for (let i = 0; i < 80; i++) {
      if ((await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.key)) === k) {
        await page.keyboard.press('Enter');
        return;
      }
      await page.keyboard.press('Tab');
    }
    throw new Error(`${k} nicht per Tastatur erreichbar`);
  };
  await press('new-game');
  await press('begin');
  await press('stack');
  const s = solutionFor('1-1');
  for (const [pid, v] of Object.entries(s.positions)) await press(`pos-${pid}-${v}`);
  await press('stamp-bescheid');
  await press('outbox');
  await expect(page.locator('[data-key="stack"]')).toHaveText('Aktenstapel (2)');
  // Pressed state is visible to assistive tech
  await press('stack');
  await press('pos-p1-anerkennen');
  await expect(key(page, 'pos-p1-anerkennen')).toHaveAttribute('aria-pressed', 'true');
});

test('Neues Spiel fragt vor dem Überschreiben', async ({ page }) => {
  await freshStart(page);
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  await page.reload();
  await expect(key(page, 'continue')).toBeEnabled();
  let asked = false;
  page.once('dialog', (d) => {
    asked = true;
    void d.dismiss();
  });
  await key(page, 'new-game').click();
  expect(asked).toBe(true);
  await expect(page.locator('.screen.start')).toBeVisible();
});
