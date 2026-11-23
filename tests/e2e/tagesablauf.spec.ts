import { expect, test, type Page } from '@playwright/test';
import { SMOKE, closeDeskEvents, enter, freshStart, key, openAkte, raw, solutionFor, startAtDay, zoomNewspaper } from './helpers';

/*
 * Auftrag 07: prologue, events at the desk during and at the end of the day,
 * clippings. Short tests from a prepared save; all texts from the JSON.
 */

type Ev = { type: string; at?: unknown; text?: string; from?: string; feature?: string; keep?: string; clipping?: { date: string; note?: string } };
const eventsOf = (day: number): Ev[] => raw.days.find((d: { day: number }) => d.day === day).storyEvents;
const prologue: { title?: string; text: string }[] = raw.prologue;
const day10 = eventsOf(10);
const gerriAt = day10.findIndex((e) => typeof e.at === 'object');
const atEnd = day10.filter((e) => e.at === 'end');

/** Kind of an event as the overlay shows it. */
async function overlayKind(page: Page): Promise<string> {
  const card = page.locator('.desk-event-card');
  for (const [cls, kind] of [['.unlock', 'unlock'], ['.call', 'call'], ['.note', 'note'], ['.newspaper', 'newspaper'], ['.dialog', 'dialog']] as const) {
    if (await card.locator(cls).count()) return kind;
  }
  return '?';
}

test('Vorspann: drei Bildschirme mit Maus und Tastatur, Überspringen, Fortsetzen zeigt ihn nicht wieder', SMOKE, async ({ page }) => {
  await freshStart(page);
  await key(page, 'new-game').click();
  for (const [i, s] of prologue.entries()) {
    await expect(page.locator('.prologue-page h1')).toHaveText(s.title ?? '');
    await expect(page.locator('.prologue-page p')).toHaveText(s.text);
    await expect(page.locator('main.prologue')).toHaveAttribute('aria-label', 'Vorspann');
    const last = i === prologue.length - 1;
    await expect(key(page, 'prologue-next')).toHaveText(last ? 'Zum ersten Arbeitstag' : 'Weiter');
    await expect(key(page, 'prologue-skip')).toHaveCount(last ? 0 : 1);
    // First screen by click on the page, the others by keyboard.
    if (i === 0) await page.locator('.prologue-page').click();
    else {
      await expect(key(page, 'prologue-next')).toBeFocused();
      await page.keyboard.press(i === 1 ? 'Enter' : ' ');
    }
  }
  await expect(page.locator('.day-card h1')).toHaveText('Tag 1');
  await page.reload();
  await key(page, 'continue').click();
  await expect(page.locator('.day-card h1')).toHaveText('Tag 1');
  // A new game shows it again; Escape skips the rest.
  await page.reload();
  page.once('dialog', (d) => void d.accept());
  await key(page, 'new-game').click();
  await expect(page.locator('.prologue-page h1')).toHaveText(prologue[0]!.title ?? '');
  await page.keyboard.press('Escape');
  await expect(page.locator('.day-card h1')).toHaveText('Tag 1');
});

test('Tag 10: Gerri nach der Folgeakte 9-2, Neuladen zeigt ihn nicht noch einmal, am Abend alles der Reihe nach, dann Ende von Akt I', SMOKE, async ({ page }) => {
  await startAtDay(page, 10, { queue: ['9-2/folge', '10-1'], effects: 'aus' });
  // The card of day 10 shows only the morning.
  await expect(page.locator('.day-card .call, .day-card .note:not(.question-notice), .day-card .drawer-unlock')).toHaveCount(0);
  await key(page, 'begin').click();
  await key(page, 'drawer').click();
  await expect(page.locator('.desk-message')).toHaveText('Die Lade klemmt.');
  await openAkte(page);
  // Filed: Gerri's line comes at once, over the desk, which cannot be touched meanwhile.
  await enterWithoutClosing(page, '9-2/folge');
  const overlay = page.locator('.desk-event');
  await expect(overlay).toHaveAttribute('aria-label', 'Ereignis am Tisch');
  await expect(overlay).toHaveAttribute('data-event', String(gerriAt));
  await expect(overlay.locator('blockquote')).toHaveText(day10[gerriAt]!.text!);
  await expect(key(page, 'event-continue')).toBeFocused();
  await expect(page.locator('.stage')).toHaveAttribute('inert', '');
  await page.keyboard.press('Escape');
  await expect(overlay).toHaveCount(0);
  // Reload mid-day: Gerri does not come again.
  await page.reload();
  await key(page, 'continue').click();
  await expect(page.locator('.screen.desk')).toBeVisible();
  await expect(overlay).toHaveCount(0);
  await openAkte(page);
  await enterWithoutClosing(page, '10-1');
  // End of the day: in JSON order, the drawer opens with the first of them.
  const kinds: string[] = [];
  for (const e of atEnd) {
    await expect(overlay).toBeVisible();
    kinds.push(await overlayKind(page));
    if (e.text) await expect(overlay.locator('.desk-event-card')).toContainText(e.text);
    await key(page, 'event-continue').click();
  }
  expect(kinds).toEqual(atEnd.map((e) => e.type));
  await expect(page.locator('.screen.summary')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('taxes-please/save/v1')!));
  expect(saved.tools).toContain('drawer');
  await key(page, 'advance').click();
  await expect(page.locator('.screen.finished h1')).toHaveText('Ende von Akt I');
});

test('Tag 10 ohne Folgeakte: Gerris Satz kommt am Tagesende zuerst', async ({ page }) => {
  await startAtDay(page, 10, { queue: ['10-1'], effects: 'aus' });
  await key(page, 'begin').click();
  await openAkte(page);
  await enterWithoutClosing(page, '10-1');
  await expect(page.locator('.desk-event')).toHaveAttribute('data-event', String(gerriAt));
  const seen = await closeDeskEvents(page);
  expect(seen).toHaveLength(atEnd.length + 1);
  await expect(page.locator('.screen.summary')).toBeVisible();
});

test('Zeitungsausschnitte an Tag 4, 5 und 7 mit Datum und Randnotiz, die Morgenzeitung an 6, 8, 9 und 10 ohne', async ({ page }) => {
  for (const day of [4, 5, 6, 7, 8, 9, 10]) {
    const paper = eventsOf(day).find((e) => e.type === 'newspaper')!;
    await startAtDay(page, day, { effects: 'aus', queue: [raw.days.find((d: { day: number }) => d.day === day).cases[0]] });
    const card = page.locator('.day-card .newspaper');
    if (paper.clipping) {
      await expect(card).toHaveClass(/clipping/);
      await expect(card.locator('.clip-date')).toHaveText(`Zeitungsausschnitt vom ${paper.clipping.date}`);
      await expect(card.locator('.margin-note .hand')).toHaveText(paper.clipping.note!);
      await expect(card.locator('.margin-note .sr-only')).toHaveText(/^Randnotiz von /);
    } else {
      await expect(card).not.toHaveClass(/clipping/);
      await expect(card.locator('.clip-date, .margin-note')).toHaveCount(0);
    }
  }
  // On the desk it zooms like the paper.
  await startAtDay(page, 5, { effects: 'aus', queue: ['5-1'] });
  await key(page, 'begin').click();
  await zoomNewspaper(page);
  await expect(page.locator('dialog.zoom .newspaper.clipping .margin-note')).toBeVisible();
});

for (const size of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
]) {
  test(`Vorspann und Ereignis am Tisch passen bei ${size.width} × ${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await freshStart(page);
    await key(page, 'new-game').click();
    for (const k of ['prologue-next', 'prologue-skip']) await expect(key(page, k)).toBeInViewport({ ratio: 0.99 });
    await expect(page.locator('.prologue-page')).toBeInViewport({ ratio: 0.99 });
    await startAtDay(page, 10, { queue: ['10-1'], effects: 'aus' });
    await key(page, 'begin').click();
    await openAkte(page);
    await enterWithoutClosing(page, '10-1');
    for (let i = 0; i < atEnd.length + 1; i++) {
      await expect(page.locator('.desk-event-card')).toBeInViewport({ ratio: 0.99 });
      await expect(key(page, 'event-continue')).toBeInViewport({ ratio: 0.99 });
      await key(page, 'event-continue').click();
    }
  });
}

/** Solves the Akte on the desk and files it, leaving any event at the desk open. */
async function enterWithoutClosing(page: Page, id: string) {
  const s = solutionFor(id);
  await enter(page, id, s, 'click', { keepEvents: true });
}
