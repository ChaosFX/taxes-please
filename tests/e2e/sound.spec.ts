import { expect, test, type Page } from '@playwright/test';
import { freshStart, key } from './helpers';

/** Auftrag 01, Punkt 6: Stempel, Papierrascheln, Büro-Ambiente, Lautstärke-Regler. */

declare global {
  interface Window {
    __played: number[];
    __ambient: string[];
  }
}

test.beforeEach(async ({ page }) => {
  // Records played effects (by buffer length) and started media, without changing behaviour.
  await page.addInitScript(() => {
    window.__played = [];
    window.__ambient = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      window.__played.push(this.buffer?.duration ?? 0);
      return start.apply(this, args);
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.__ambient.push(this.currentSrc || this.src);
      return play.call(this);
    };
  });
  await freshStart(page);
});

const played = (page: Page) => page.evaluate(() => window.__played);

test('Stempel und Papier sind zu hören, Ambiente startet nach dem ersten Klick', async ({ page }) => {
  await key(page, 'new-game').click();
  await expect.poll(() => page.evaluate(() => window.__ambient)).toContainEqual(expect.stringContaining('audio/buero.mp3'));
  await key(page, 'begin').click();
  await key(page, 'stack').click();
  // Paper rustle (> 1 s) when the Akte is drawn.
  await expect.poll(async () => (await played(page)).some((d) => d > 1)).toBe(true);
  await key(page, 'stamp-bescheid').click();
  // Stamp hit (< 0.7 s).
  await expect.poll(async () => (await played(page)).some((d) => d > 0 && d < 0.7)).toBe(true);
  // Filing into the out tray (≈ 0.49 s).
  const before = (await played(page)).length;
  await key(page, 'outbox').click();
  await expect.poll(async () => (await played(page)).slice(before).some((d) => d > 0.45 && d < 0.52)).toBe(true);
});

test('Lautstärke 0 schaltet den Ton ab und wird gespeichert', async ({ page }) => {
  await page.locator('.settings summary').click();
  const slider = key(page, 'volume');
  await expect(slider).toHaveValue('70');
  // Range inputs cannot be filled; set the value like a finished slider move.
  await slider.evaluate((el: HTMLInputElement) => {
    el.value = '0';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.reload();
  await page.locator('.settings summary').click();
  await expect(key(page, 'volume')).toHaveValue('0');
  await page.locator('.settings summary').click();

  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  await key(page, 'stack').click();
  await key(page, 'stamp-bescheid').click();
  await expect(page.locator('.stamp-imprint')).toBeVisible();
  await page.waitForTimeout(300);
  expect(await played(page)).toEqual([]);
});

test('Lautstärke per Tastatur einstellbar', async ({ page }) => {
  await page.locator('.settings summary').click();
  const slider = key(page, 'volume');
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(slider).toHaveValue('65');
  await expect(slider).toBeFocused();
});
