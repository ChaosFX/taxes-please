import { expect, test, type Locator, type Page } from '@playwright/test';
import { SMOKE, freshStart, key, openAkte, pullOut, stampAkte } from './helpers';

/** Auftrag 01: Ziehen, Zoom, Stempel-Effekt, Einstellungen; auf dem Arbeitstisch aus Auftrag 05. */

/** Akte 1-1 open, its three papers taken out of the pocket. */
async function toDeskWithAkte(page: Page) {
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  await openAkte(page);
  for (const i of [0, 1, 2]) await pullOut(page, i);
}

async function setEffects(page: Page, level: 'aus' | 'reduziert' | 'voll') {
  await page.locator('.settings summary').click();
  await key(page, `fx-${level}`).check();
  await expect(page.locator('html')).toHaveAttribute('data-effects', level);
}

const box = async (l: Locator) => (await l.boundingBox())!;
/** Waits until the drop animation is over, then measures. */
const settled = async (l: Locator) => {
  await expect(l).not.toHaveClass(/lifted/);
  await l.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  return box(l);
};
const zIndex = (l: Locator) => l.evaluate((el) => Number(getComputedStyle(el).zIndex) || 0);

async function mouseDrag(page: Page, l: Locator, dx: number, dy: number) {
  const b = await box(l);
  // Grab near the bottom edge, away from the title.
  const x = b.x + b.width / 2;
  const y = b.y + b.height - 12;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
}

/** Touch drag via Pointer Events with pointerType "touch" on the paper's title. */
async function touchDrag(l: Locator, dx: number, dy: number) {
  await l.evaluate(
    (el, [dx, dy]) => {
      const t = el.querySelector('h3')!.getBoundingClientRect();
      const x = t.left + 10;
      const y = t.top + t.height / 2;
      const ev = (type: string, cx: number, cy: number) =>
        new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, clientX: cx, clientY: cy });
      el.querySelector('h3')!.dispatchEvent(ev('pointerdown', x, y));
      for (let i = 1; i <= 5; i++) el.dispatchEvent(ev('pointermove', x + (dx! * i) / 5, y + (dy! * i) / 5));
      el.dispatchEvent(ev('pointerup', x + dx!, y + dy!));
    },
    [dx, dy],
  );
}

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('Papier mit der Maus ziehen; zuletzt angefasstes liegt oben', async ({ page }) => {
  await toDeskWithAkte(page);
  const a = key(page, 'paper-0');
  const b = key(page, 'paper-1');
  const before = await box(a);
  await mouseDrag(page, a, 120, 60);
  const after = await settled(a);
  expect(after.x - before.x).toBeGreaterThan(80);
  expect(after.y - before.y).toBeGreaterThan(30);
  await mouseDrag(page, b, -40, 20);
  expect(await zIndex(b)).toBeGreaterThan(await zIndex(a));
  // Position survives a re-render (deciding a position re-renders the desk).
  await key(page, 'pos-p1-anerkennen').click();
  const again = await settled(key(page, 'paper-0'));
  expect(Math.abs(again.x - after.x)).toBeLessThan(2);
});

test('Papier per Touch ziehen', SMOKE, async ({ page }) => {
  await toDeskWithAkte(page);
  const a = key(page, 'paper-1');
  const before = await box(a);
  // To the right: on the left of it lies the folder with its pocket, which would take the paper back.
  await touchDrag(a, 90, 70);
  const after = await settled(a);
  expect(after.x - before.x).toBeGreaterThan(60);
  expect(after.y - before.y).toBeGreaterThan(40);
});

test('Effekte aus: Ziehen geht, aber ohne Animation; Stempel ohne Animation', async ({ page }) => {
  await setEffects(page, 'aus');
  await page.locator('.settings summary').click();
  await toDeskWithAkte(page);
  const a = key(page, 'paper-0');
  const before = await box(a);
  await mouseDrag(page, a, 100, 0);
  expect((await settled(a)).x - before.x).toBeGreaterThan(70);
  expect(await a.evaluate((el) => el.getAnimations().length)).toBe(0);
  expect(await a.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  await stampAkte(page, 'bescheid');
  const anims = await page.locator('.stamp-imprint').evaluate((el) => el.getAnimations().length);
  expect(anims).toBe(0);
  await expect(page.locator('.folder.open')).not.toHaveClass(/shake/);
});

test('Effekte voll: Stempel schlägt auf und die Arbeitsfläche wackelt', async ({ page }) => {
  await setEffects(page, 'voll');
  await page.locator('.settings summary').click();
  await toDeskWithAkte(page);
  await stampAkte(page, 'bescheid');
  await expect(page.locator('.stamp-imprint')).toHaveClass(/hit/);
  await expect(page.locator('.folder.open')).toHaveClass(/shake/);
  expect(await page.locator('.stamp-imprint').evaluate((el) => el.getAnimations().length)).toBeGreaterThan(0);
  // Imprint stays, stamp stays final.
  await page.waitForTimeout(500);
  await expect(page.locator('.stamp-imprint')).toBeVisible();
  await expect(key(page, 'pos-p1-anerkennen')).toBeDisabled();
});

test('Zoom per Doppelklick und per Tastatur', SMOKE, async ({ page }) => {
  await toDeskWithAkte(page);
  const a = key(page, 'paper-0');
  await a.dblclick();
  const dialog = page.locator('dialog.zoom');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Anna Huber');
  const big = await dialog.locator('.paper').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const small = await a.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(big).toBeGreaterThan(small * 1.2);
  await dialog.locator('.paper').dblclick();
  await expect(dialog).toHaveCount(0);

  await a.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('dialog.zoom')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.zoom')).toHaveCount(0);
  await expect(a).toBeFocused();
  await page.keyboard.press(' ');
  await expect(page.locator('dialog.zoom')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('dialog.zoom')).toHaveCount(0);
});

test('Papier per Pfeiltasten verschieben', async ({ page }) => {
  await toDeskWithAkte(page);
  const a = key(page, 'paper-0');
  const before = await box(a);
  await a.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  const after = await settled(a);
  expect(after.x - before.x).toBeGreaterThan(25);
  expect(after.y - before.y).toBeGreaterThan(10);
});

test('Einstellung wird gespeichert und übersteht Neuladen', async ({ page }) => {
  await setEffects(page, 'aus');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-effects', 'aus');
  await toDeskWithAkte(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('taxes-please/save/v1')!).settings.effects);
  expect(saved).toBe('aus');
});

test.describe('prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('setzt automatisch „reduziert“', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-effects', 'reduziert');
    await page.locator('.settings summary').click();
    await expect(key(page, 'fx-reduziert')).toBeChecked();
  });
});
