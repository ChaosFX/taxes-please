import { expect, test, type Locator, type Page } from '@playwright/test';
import { freshStart, key } from './helpers';

/** Auftrag 02, Aufgabe 3: Ein Papier wird an keinem Rand der Unterlage abgeschnitten. */

const DIRECTIONS = {
  links: [-1, 0],
  rechts: [1, 0],
  oben: [0, -1],
  unten: [0, 1],
  'links oben': [-1, -1],
  'rechts oben': [1, -1],
  'links unten': [-1, 1],
  'rechts unten': [1, 1],
} as const;

async function toDesk(page: Page) {
  await freshStart(page);
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  await key(page, 'stack').click();
}

/** Visible area of the pad (padding box, where `overflow: hidden` clips). */
const clipBox = (page: Page) =>
  page.locator('.worksurface').evaluate((s) => {
    const r = s.getBoundingClientRect();
    return { left: r.left + s.clientLeft, top: r.top + s.clientTop, right: r.left + s.clientLeft + s.clientWidth, bottom: r.top + s.clientTop + s.clientHeight };
  });

/** Rotated outline of the paper including its paper clip, after any drop animation. */
async function paperBox(paper: Locator) {
  await expect(paper).not.toHaveClass(/dropping|lifted/);
  return paper.evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((a) => a.finished));
    const r = el.getBoundingClientRect();
    // The clip (::before) sticks out above the paper by -top.
    const clipTop = Math.max(0, -parseFloat(getComputedStyle(el, '::before').top) || 0);
    return { left: r.left, top: r.top - clipTop, right: r.right, bottom: r.bottom };
  });
}

/**
 * `near`: how close to the edge the paper must get. With effects „voll“ a lifted
 * paper is 5 % larger and tilts up to 6°; that room is kept free while dragging.
 */
async function expectInside(page: Page, paper: Locator, where: string, dir: readonly [number, number], near = 12) {
  const c = await clipBox(page);
  const b = await paperBox(paper);
  expect(b.left, `${where}: linker Rand`).toBeGreaterThanOrEqual(c.left);
  expect(b.top, `${where}: oberer Rand`).toBeGreaterThanOrEqual(c.top);
  expect(b.right, `${where}: rechter Rand`).toBeLessThanOrEqual(c.right);
  expect(b.bottom, `${where}: unterer Rand`).toBeLessThanOrEqual(c.bottom);
  // And it really went to that edge (not stuck in the middle).
  if (dir[0] < 0) expect(b.left - c.left, `${where}: bis zum Rand`).toBeLessThan(near);
  if (dir[0] > 0) expect(c.right - b.right, `${where}: bis zum Rand`).toBeLessThan(near);
  if (dir[1] < 0) expect(b.top - c.top, `${where}: bis zum Rand`).toBeLessThan(near);
  if (dir[1] > 0) expect(c.bottom - b.bottom, `${where}: bis zum Rand`).toBeLessThan(near);
}

for (const fx of ['voll', 'aus'] as const) {
  test(`Maus: Papier mit Büroklammer an jede Kante und in jede Ecke (Effekte ${fx})`, async ({ page }) => {
    await toDesk(page);
    if (fx === 'aus') {
      await page.locator('.settings summary').click();
      await key(page, 'fx-aus').check();
      await page.locator('.settings summary').click();
    }
    const paper = key(page, 'paper-1');
    await expect(paper).toHaveClass(/beleg/);
    const vp = page.viewportSize()!;
    for (const [where, dir] of Object.entries(DIRECTIONS)) {
      const b = (await paper.boundingBox())!;
      const x = b.x + b.width / 2;
      const y = b.y + b.height - 14;
      await page.mouse.move(x, y);
      await page.mouse.down();
      // Drag far beyond the pad, towards the viewport corner.
      const tx = dir[0] < 0 ? 1 : dir[0] > 0 ? vp.width - 1 : x;
      const ty = dir[1] < 0 ? 1 : dir[1] > 0 ? vp.height - 1 : y;
      await page.mouse.move(tx, ty, { steps: 10 });
      // While lifted the paper is also inside.
      const c = await clipBox(page);
      const lifted = await paper.evaluate((el) => el.getBoundingClientRect().toJSON());
      expect(lifted.left, `${where}: beim Ziehen`).toBeGreaterThanOrEqual(c.left);
      expect(lifted.right, `${where}: beim Ziehen`).toBeLessThanOrEqual(c.right);
      await page.mouse.up();
      await expectInside(page, paper, `Maus ${where}`, dir, fx === 'voll' ? 30 : 12);
    }
  });
}

test('Pfeiltasten: Papier an jede Kante und in jede Ecke', async ({ page }) => {
  await toDesk(page);
  const paper = key(page, 'paper-1');
  const keys = (d: number, neg: string, pos: string) => (d < 0 ? neg : d > 0 ? pos : null);
  for (const [where, dir] of Object.entries(DIRECTIONS)) {
    await paper.focus();
    for (let i = 0; i < 40; i++) {
      for (const k of [keys(dir[0], 'ArrowLeft', 'ArrowRight'), keys(dir[1], 'ArrowUp', 'ArrowDown')]) {
        if (k) await page.keyboard.press(`Shift+${k}`);
      }
    }
    await expectInside(page, paper, `Tastatur ${where}`, dir);
  }
  // Zoom and back: the paper stays where it was and inside.
  const before = await paperBox(paper);
  await page.keyboard.press('Enter');
  await expect(page.locator('dialog.zoom')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.zoom')).toHaveCount(0);
  expect(await paperBox(paper)).toEqual(before);
  await expectInside(page, paper, 'nach dem Zoom', [1, 1]);
});

test('Mobil: Papier bleibt beim Ziehen an den Rand vollständig sichtbar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await toDesk(page);
  // No paper is wider than the pad, not even before it is moved (measured with the web fonts).
  await page.evaluate(() => document.fonts.ready);
  const tooWide = () =>
    page.locator('.worksurface .paper').evaluateAll((els) =>
      els.filter((el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().width > el.closest('.worksurface')!.clientWidth).length,
    );
  await expect.poll(tooWide).toBe(0);
  const paper = key(page, 'paper-1');
  await paper.scrollIntoViewIfNeeded();
  for (const [where, dir] of Object.entries({ links: [-1, 0], rechts: [1, 0] } as const)) {
    await paper.focus();
    for (let i = 0; i < 20; i++) await page.keyboard.press(dir[0] < 0 ? 'Shift+ArrowLeft' : 'Shift+ArrowRight');
    await expectInside(page, paper, `mobil ${where}`, dir);
  }
});
