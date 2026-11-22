import { expect, test, type Page } from '@playwright/test';
import { fileAkte, freshStart, key, stampAkte } from './helpers';

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
  await expect.poll(async () => (await played(page)).some((d) => d > 1 && d < 2)).toBe(true);
  await stampAkte(page, 'bescheid');
  // Stamp hit (< 0.7 s).
  await expect.poll(async () => (await played(page)).some((d) => d > 0 && d < 0.7)).toBe(true);
  // Filing into the out tray (≈ 1.45–1.55 s).
  const before = (await played(page)).length;
  await fileAkte(page);
  await expect.poll(async () => (await played(page)).slice(before).some((d) => d > 1.4 && d < 1.6)).toBe(true);
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
  await stampAkte(page, 'bescheid');
  await expect(page.locator('.stamp-imprint')).toBeVisible();
  await page.waitForTimeout(300);
  // Effects are silent; only the music loop (≈ 55 s) may run, it has its own slider.
  expect((await played(page)).filter((d) => d < 10)).toEqual([]);
});

test('Lautstärke per Tastatur einstellbar', async ({ page }) => {
  await page.locator('.settings summary').click();
  const slider = key(page, 'volume');
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(slider).toHaveValue('65');
  await expect(slider).toBeFocused();
});

test('Musik läuft als Schleife nach dem ersten Klick, eigener Regler wird gespeichert', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __loops: number[] }).__loops = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      if (this.loop) (window as unknown as { __loops: number[] }).__loops.push(this.buffer?.duration ?? 0);
      return start.apply(this, args);
    };
  });
  await page.reload();
  // Nothing plays before the first user action.
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __loops: number[] }).__loops)).toEqual([]);
  await key(page, 'new-game').click();
  // Loop length: 48 bars at 156 bpm ≈ 55.38 s. WebKit on Linux (GStreamer) keeps the
  // MP3 encoder padding and decodes about 60 ms more, hence ±0.1 s.
  await expect.poll(() => page.evaluate(() => (window as unknown as { __loops: number[] }).__loops.length)).toBe(1);
  const [loop] = await page.evaluate(() => (window as unknown as { __loops: number[] }).__loops);
  expect(Math.abs(loop! - 55.38)).toBeLessThan(0.1);

  await page.locator('.settings summary').click();
  const slider = key(page, 'music');
  await expect(slider).toHaveValue('50');
  await slider.evaluate((el: HTMLInputElement) => {
    el.value = '20';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.reload();
  await page.locator('.settings summary').click();
  await expect(key(page, 'music')).toHaveValue('20');
});

test('Musik-Regler 0: Musik wird weder geladen noch abgespielt; Umschalten blendet und setzt fort', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __music: { fetched: number; starts: number[]; stops: number; clock: number[] } };
    w.__music = { fetched: 0, starts: [], stops: 0, clock: [] };
    const fetch0 = window.fetch;
    window.fetch = (input, init) => {
      if (String(input).includes('musik-akt1')) w.__music.fetched++;
      return fetch0(input, init);
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      if (this.loop) {
        w.__music.starts.push(Number(args[1] ?? 0));
        w.__music.clock.push(this.context.currentTime);
      }
      return start.apply(this, args);
    };
    const stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.stop = function (...args: Parameters<typeof stop>) {
      if (this.loop) {
        w.__music.stops++;
        w.__music.clock.push(this.context.currentTime);
      }
      return stop.apply(this, args);
    };
  });
  // Settings saved earlier with music at 0.
  await page.evaluate(() => localStorage.setItem('taxes-please/settings/v1', JSON.stringify({ effects: 'voll', volume: 0.7, music: 0 })));
  await page.reload();
  const music = () => page.evaluate(() => (window as unknown as { __music: { fetched: number; starts: number[]; stops: number; clock: number[] } }).__music);

  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  await page.waitForTimeout(500);
  expect(await music()).toEqual({ fetched: 0, starts: [], stops: 0, clock: [] });

  const setMusic = (v: number) =>
    key(page, 'music').evaluate((el: HTMLInputElement, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, v);
  await page.locator('.settings summary').click();
  await setMusic(50);
  await expect.poll(async () => (await music()).starts).toEqual([0]);
  expect((await music()).fetched).toBe(1);
  await page.waitForTimeout(700);
  await setMusic(0);
  await expect.poll(async () => (await music()).stops).toBe(1);
  await setMusic(40);
  // Resumes where it stopped (not from the start), file not loaded again.
  await expect.poll(async () => (await music()).starts.length).toBe(2);
  // The offset is the audio clock time it played. Without an audio device (CI) the clock
  // may stand still; then it correctly resumes at 0.
  const m = await music();
  const played = m.clock[1]! - m.clock[0]!;
  expect(m.starts[1]).toBeCloseTo(played, 1);
  if (played > 0.3) expect(m.starts[1]).toBeGreaterThan(0.3);
  expect((await music()).fetched).toBe(1);
});
