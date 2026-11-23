import { expect, test, type Locator, type Page } from '@playwright/test';
import { freshStart, key, openAkte, pullOut, newGame } from './helpers';

/**
 * Auftrag 02, Aufgabe 3, und SPEC 7.1: Ein Papier lässt sich nie so ablegen, dass
 * ein Teil davon über den Rand der Unterlage ragt.
 */

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
  await newGame(page);
  await key(page, 'begin').click();
  await openAkte(page);
  await pullOut(page, 1);
}

/** The green pad. */
const clipBox = (page: Page) =>
  page.locator('.stage .pad').evaluate((s) => {
    const r = s.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });

/** Rotated outline of the paper including its paper clip, after any drop animation. */
async function paperBox(paper: Locator) {
  await expect(paper).not.toHaveClass(/lifted/);
  return paper.evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((a) => a.finished));
    const r = el.getBoundingClientRect();
    // The clip (::before) sticks out above the paper by -top, in CSS pixels of the scaled stage.
    const scale = el.closest<HTMLElement>('.stage')!.getBoundingClientRect().width / el.closest<HTMLElement>('.stage')!.offsetWidth;
    const clipTop = Math.max(0, -parseFloat(getComputedStyle(el, '::before').top) || 0) * scale;
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
    const c = await clipBox(page);
    for (const [where, dir] of Object.entries(DIRECTIONS)) {
      const b = (await paper.boundingBox())!;
      // Grabbed at the bottom middle: dragged to a pad edge, most of the paper hangs over it.
      const x = b.x + b.width / 2;
      const y = b.y + b.height - 14;
      await page.mouse.move(x, y);
      await page.mouse.down();
      // The pointer ends just inside the pad, so the pad takes the paper (SPEC 7.1).
      const tx = dir[0] < 0 ? c.left + 3 : dir[0] > 0 ? c.right - 3 : (c.left + c.right) / 2;
      const ty = dir[1] < 0 ? c.top + 3 : dir[1] > 0 ? c.bottom - 3 : (c.top + c.bottom) / 2;
      await page.mouse.move(tx, ty, { steps: 10 });
      await page.mouse.up();
      await expectInside(page, paper, `Maus ${where}`, dir, 16);
    }
    // Let go beyond the pad (on the rail), the paper glides back to where it lay.
    const before = await paperBox(paper);
    const b = (await paper.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + 20);
    await page.mouse.down();
    await page.mouse.move(c.right + 60, b.y + 20, { steps: 8 });
    await page.mouse.up();
    const back = await paperBox(paper);
    expect(Math.abs(back.left - before.left)).toBeLessThan(2);
    expect(Math.abs(back.top - before.top)).toBeLessThan(2);
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
  // The whole desk is scaled down to the window (SPEC 7.1); the paper comes out by keyboard.
  await freshStart(page);
  await newGame(page);
  await key(page, 'begin').click();
  await openAkte(page);
  await key(page, 'paper-1').focus();
  await page.keyboard.press('Enter');
  await expect(key(page, 'paper-1')).toHaveClass(/loose/);
  // No paper is wider than the pad, not even before it is moved (measured with the web fonts).
  await page.evaluate(() => document.fonts.ready);
  const tooWide = () =>
    page.locator('.stage .paper.loose').evaluateAll((els) =>
      els.filter((el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().width > document.querySelector('.stage .pad')!.getBoundingClientRect().width).length,
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
