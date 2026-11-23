import { expect, test, type Locator, type Page } from '@playwright/test';
import { SMOKE, documentsOf, freshStart, inboxCount, key, openAkte, pullOut, raw, startAtDay, stampAkte } from './helpers';

/** Auftrag 05, Etappe A: Tischplan, Mappe, Werkzeuge, Kalender (SPEC 7.1 bis 7.5, 11). */

const box = async (l: Locator) => (await l.boundingBox())!;
const center = async (l: Locator) => {
  const b = await box(l);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
/** Drag with the mouse from `from` (default: middle of the element) to a point. */
async function drag(page: Page, l: Locator, to: { x: number; y: number }, from?: { x: number; y: number }) {
  const a = from ?? (await center(l));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + (to.x - a.x) / 2, a.y + (to.y - a.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}
const padBox = (page: Page) => box(page.locator('.stage .pad'));
const message = (page: Page) => page.locator('.desk-message');

async function toDesk(page: Page, effects: 'aus' | 'voll' = 'aus') {
  await startAtDay(page, 1, { effects });
  await key(page, 'begin').click();
}

test('Akte aus dem Eingang auf die Unterlage ziehen; eine zweite wird abgewiesen und gleitet zurück', SMOKE, async ({ page }) => {
  await toDesk(page);
  await expect(inboxCount(page)).toHaveText('Eingang (3)');
  const pad = await padBox(page);
  await drag(page, key(page, 'stack'), { x: pad.x + pad.width * 0.6, y: pad.y + 120 });
  await expect(page.locator('.folder.open .pruefvermerk')).toHaveAttribute('data-akte', '1-1');
  await expect(inboxCount(page)).toHaveText('Eingang (2)');
  // Lies where it was dropped (right half of the pad), not at the default place.
  expect((await box(page.locator('.folder.open'))).x).toBeGreaterThan(pad.x + pad.width * 0.25);

  const top = key(page, 'stack');
  const before = await box(top);
  await drag(page, top, { x: pad.x + 300, y: pad.y + 500 });
  await expect(message(page)).toHaveText('Es liegt schon eine Akte am Tisch. Erst ablegen.');
  await expect(page.locator('.folder.open')).toHaveCount(1);
  const after = await box(key(page, 'stack'));
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  expect(Math.abs(after.y - before.y)).toBeLessThan(2);
  // A click is refused as well.
  await key(page, 'stack').click();
  await expect(page.locator('.folder')).toHaveCount(3); // the open one and two in the inbox
  await expect(page.locator('.pruefvermerk')).toHaveAttribute('data-akte', '1-1');
});

test('Unterlagen herausziehen und auf die Tasche zurückziehen; Schließen holt alle zurück', SMOKE, async ({ page }) => {
  await toDesk(page);
  await openAkte(page);
  const pad = await padBox(page);
  const p0 = key(page, 'paper-0');
  await expect(p0).toHaveClass(/in-pocket/);
  // Out of the pocket by dragging at its title strip.
  const t0 = await box(p0);
  await drag(page, p0, { x: pad.x + pad.width - 200, y: pad.y + 420 }, { x: t0.x + 40, y: t0.y + 6 });
  await expect(p0).toHaveClass(/loose/);
  // Back onto the pocket.
  const pocket = await center(page.locator('.pocket'));
  await drag(page, p0, pocket, { x: (await box(p0)).x + 60, y: (await box(p0)).y + 12 });
  await expect(p0).toHaveClass(/in-pocket/);
  // Click and Enter take papers out to a free place next to the folder.
  await pullOut(page, 1);
  await key(page, 'paper-2').focus();
  await page.keyboard.press('Enter');
  await expect(key(page, 'paper-2')).toHaveClass(/loose/);
  await expect(page.locator('.paper.loose')).toHaveCount(2);
  // Closing: every paper back in the pocket, none stays on the pad; the folder stays closed on the desk.
  await key(page, 'close-akte').click();
  await expect(page.locator('.folder.on-desk')).toBeVisible();
  await expect(page.locator('.stage .paper.doc')).toHaveCount(0);
  await key(page, 'folder').click();
  await expect(page.locator('.paper.loose')).toHaveCount(0);
  await expect(page.locator('.pocket .paper')).toHaveCount(3);
});

test('Markiermodus: nur Zeilen herausgezogener Papiere sind anklickbar', async ({ page }) => {
  await startAtDay(page, 5, { effects: 'aus' });
  await key(page, 'begin').click();
  const id = await openAkte(page);
  await key(page, 'mark-mode').click();
  await expect(page.locator('.mark-line')).toHaveCount(0);
  await expect(page.locator('.pocket .paper').first()).toHaveAttribute('inert', '');
  await key(page, 'mark-mode').click();
  await pullOut(page, 0);
  await key(page, 'mark-mode').click();
  await expect(page.locator('.mark-line')).toHaveCount(documentsOf(id)[0]!.lines.length);
});

test('Ausgangskorb: offene und ungestempelte Akte werden abgewiesen, gestempelte zugeklappte angenommen', async ({ page }) => {
  await toDesk(page);
  await openAkte(page);
  const outbox = await center(page.locator('.outbox-zone'));
  const bar = await box(page.locator('.folder-bar'));
  await drag(page, page.locator('.folder.open'), outbox, { x: bar.x + 120, y: bar.y + bar.height / 2 });
  await expect(message(page)).toHaveText('Erst die Akte schließen. Die Unterlagen kommen dabei zurück in die Mappe.');
  await expect(page.locator('.folder.open')).toBeVisible();
  await key(page, 'close-akte').click();
  await drag(page, key(page, 'folder'), outbox);
  await expect(message(page)).toHaveText('Erst stempeln, dann ablegen.');
  await expect(page.locator('.folder.on-desk')).toBeVisible();
  // Stamping needs the open folder.
  await key(page, 'stamp-bescheid').click();
  await expect(message(page)).toHaveText('Zum Stempeln muss eine Akte offen am Tisch liegen.');
  await key(page, 'folder').click();
  await key(page, 'pos-p1-anerkennen').click();
  await key(page, 'pos-p2-streichen').click();
  await stampAkte(page, 'bescheid');
  await key(page, 'stamp-bescheid').click();
  await expect(message(page)).toHaveText('Die Akte ist schon gestempelt. Der Stempel ist endgültig.');
  await key(page, 'close-akte').click();
  await expect(page.locator('.folder.on-desk')).toHaveAttribute('aria-label', 'Akte 1-1, Anna Huber, gestempelt mit Bescheid');
  await drag(page, key(page, 'folder'), outbox);
  await expect(page.locator('.folder.on-desk')).toHaveCount(0);
  await expect(page.locator('.outbox-count')).toHaveText('1');
  await expect(inboxCount(page)).toHaveText('Eingang (2)');
});

test('Kodex auf die Unterlage ziehen, blättern, verschieben, Lesemodus an derselben Regel, zurücklegen', async ({ page }) => {
  await startAtDay(page, 3, { effects: 'aus', codex: { lastRuleId: 'R2', seenDay: 3 } });
  await key(page, 'begin').click();
  const pad = await padBox(page);
  await drag(page, key(page, 'codex-book'), { x: pad.x + pad.width - 300, y: pad.y + 200 });
  const book = page.locator('.desk-book');
  await expect(book).toBeVisible();
  // Laid open where it was dropped, two pages side by side, place from the save.
  const b = await box(book);
  expect(b.x + b.width).toBeLessThanOrEqual(pad.x + pad.width + 1);
  expect(b.x).toBeGreaterThan(pad.x + pad.width / 3);
  await expect(book.locator('.page.shown')).toHaveCount(2);
  await expect(book.locator('.page.shown [data-rule="R2"]')).toHaveCount(1);
  // Turning pages with the corner button and the arrow keys.
  const first = await book.locator('.page.shown').first().getAttribute('aria-label');
  await book.locator('.corner.next').click();
  await expect(book.locator('.page.shown').first()).not.toHaveAttribute('aria-label', first!);
  await book.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(book.locator('.page.shown').first()).toHaveAttribute('aria-label', first!);
  // Moves like a paper (by its tool bar).
  const bar = await box(book.locator('.book-tools'));
  await drag(page, book, { x: bar.x + 20, y: bar.y + 300 }, { x: bar.x + 20, y: bar.y + bar.height / 2 });
  expect((await box(book)).y).toBeGreaterThan(b.y + 100);
  // Reading mode at the same rule; back on the desk afterwards at the rule read there.
  await key(page, 'codex-read').click();
  await expect(page.locator('dialog.codex-dialog .page.shown [data-rule="R2"]')).toHaveCount(1);
  await page.keyboard.press('Home');
  await page.keyboard.press('Escape');
  await expect(book.locator('.page.shown .front-title')).toHaveCount(1);
  // Dragged back onto the rail it closes.
  await drag(page, book, { x: (await box(page.locator('.rail.left'))).x + 100, y: 400 }, await center(book.locator('.book-tools')));
  await expect(book).toHaveCount(0);
  await expect(key(page, 'codex-book')).toBeVisible();
});

test('Tag 1: auch am Tisch keine Inhalte gesperrter Regeln im DOM', async ({ page }) => {
  await freshStart(page);
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  await key(page, 'codex-book').click();
  await expect(page.locator('.desk-book .page.shown')).toHaveCount(2);
  const all = await page.evaluate(() => {
    const attrs = [...document.querySelectorAll('*')].flatMap((el) => [...el.attributes].map((a) => a.value));
    return `${document.documentElement.textContent}\n${attrs.join('\n')}`;
  });
  for (const r of raw.rules.filter((x: { day: number }) => x.day > 1)) {
    expect(all).not.toContain(r.title);
    expect(all).not.toContain(r.text);
    expect(all).not.toContain(`regel-${r.id}`);
  }
});

test('Kalender erst ab Tag 4, schlägt im April 2026 auf, Feiertage rot, 21. März bis 3. April sind 13 Tage', async ({ page }) => {
  await startAtDay(page, 3, { effects: 'aus' });
  await key(page, 'begin').click();
  await expect(key(page, 'calendar-tool')).toHaveCount(0);
  await expect(page.locator('.calendar-closed, .calendar-open, .slot-calendar')).toHaveCount(0);

  await startAtDay(page, 4, { effects: 'aus' });
  await expect(page.locator('.day-card .calendar-unlock')).toHaveText('Neben dem Kodex liegt ab heute ein Tischkalender.');
  await key(page, 'begin').click();
  await expect(key(page, 'calendar-tool')).toHaveAttribute('aria-label', 'Tischkalender, April 2026');
  await key(page, 'calendar-tool').click();
  const cal = page.locator('.calendar-open');
  await expect(cal.locator('.cal-title')).toHaveText('April 2026');
  await expect(cal.locator('.cal-count')).toHaveText('Zum Zählen Beginn und Ende anklicken.');
  // Easter Monday 6 April is a holiday, Good Friday 3 April is not.
  await expect(key(page, 'cal-2026-4-6')).toHaveClass(/holiday/);
  await expect(key(page, 'cal-2026-4-6')).toHaveAttribute('aria-label', 'Mo., 6. April 2026, Ostermontag');
  await expect(key(page, 'cal-2026-4-6')).toHaveAttribute('title', 'Ostermontag');
  await expect(key(page, 'cal-2026-4-3')).not.toHaveClass(/holiday/);
  await expect(key(page, 'cal-2026-4-5')).toHaveClass(/sunday/);
  await expect(key(page, 'cal-2026-4-4')).toHaveClass(/weekend/);
  // Back to March, 21 March as start, forward to April, 3 April as end.
  await key(page, 'cal-prev').click();
  await expect(cal.locator('.cal-title')).toHaveText('März 2026');
  await key(page, 'cal-2026-3-21').click();
  await expect(cal.locator('.cal-count')).toHaveText('Beginn: Sa., 21. März 2026. Jetzt das Ende anklicken.');
  await key(page, 'cal-next').click();
  await key(page, 'cal-2026-4-3').click();
  await expect(cal.locator('.cal-count')).toHaveText('Sa., 21. März 2026 bis Fr., 3. April 2026: 13 Tage Abstand.');
  await expect(page.locator('.cal-day.between')).toHaveCount(2); // 1 and 2 April in this month
  // A third click starts again.
  await key(page, 'cal-2026-4-4').click();
  await expect(cal.locator('.cal-count')).toHaveText('Beginn: Sa., 4. April 2026. Jetzt das Ende anklicken.');
  await key(page, 'cal-2026-4-5').click();
  await expect(cal.locator('.cal-count')).toHaveText('Sa., 4. April 2026 bis So., 5. April 2026: 1 Tag Abstand.');
  // By keyboard as well.
  await key(page, 'cal-2026-4-10').focus();
  await page.keyboard.press('Enter');
  await expect(cal.locator('.cal-count')).toHaveText('Beginn: Fr., 10. April 2026. Jetzt das Ende anklicken.');
  // Put back: closed in the rail. Not saved: after a reload April again, nothing chosen.
  await key(page, 'cal-putback').click();
  await expect(cal).toHaveCount(0);
  await key(page, 'calendar-tool').click();
  await key(page, 'cal-next').click();
  await page.reload();
  await key(page, 'continue').click();
  await expect(page.locator('.calendar-open')).toHaveCount(0);
  await key(page, 'calendar-tool').click();
  await expect(page.locator('.calendar-open .cal-title')).toHaveText('April 2026');
});

test('Am Tagesende und nach dem Neuladen liegen alle Werkzeuge zugeklappt auf ihrem Platz', async ({ page }) => {
  await startAtDay(page, 8, { effects: 'aus' });
  await key(page, 'begin').click();
  for (const k of ['codex-book', 'calendar-tool', 'calc-tool']) await key(page, k).click();
  await expect(page.locator('.tool.open')).toHaveCount(3);
  await page.reload();
  await key(page, 'continue').click();
  await expect(page.locator('.tool.open')).toHaveCount(0);
  await expect(page.locator('.tool.closed')).toHaveCount(3);
});

for (const [w, h] of [
  [1280, 720],
  [1920, 1080],
  [1024, 768],
] as const) {
  test(`${w} × ${h}: der ganze Tisch passt ins Fenster, Akte, Kodex und Kalender liegen nebeneinander`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await startAtDay(page, 4, { effects: 'aus' });
    await key(page, 'begin').click();
    const stage = await box(page.locator('.stage'));
    expect(stage.x).toBeGreaterThanOrEqual(0);
    expect(stage.y).toBeGreaterThanOrEqual(0);
    expect(stage.x + stage.width).toBeLessThanOrEqual(w + 0.5);
    expect(stage.y + stage.height).toBeLessThanOrEqual(h + 0.5);
    expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([w, h]);
    // Every control of the rails is inside the window.
    for (const k of ['stack', 'codex-book', 'calendar-tool', 'stamp-bescheid']) {
      const b = await box(key(page, k));
      expect(b.x + b.width, k).toBeLessThanOrEqual(w);
      expect(b.y + b.height, k).toBeLessThanOrEqual(h);
    }
    await openAkte(page);
    await key(page, 'codex-book').click();
    await key(page, 'calendar-tool').click();
    const rects = await Promise.all(['.folder.open', '.desk-book', '.calendar-open'].map((s) => box(page.locator(s))));
    const pad = await padBox(page);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(pad.x - 0.5);
      expect(r.y).toBeGreaterThanOrEqual(pad.y - 0.5);
      expect(r.x + r.width).toBeLessThanOrEqual(pad.x + pad.width + 0.5);
      expect(r.y + r.height).toBeLessThanOrEqual(pad.y + pad.height + 0.5);
    }
    const overlap = (a: (typeof rects)[number], b: (typeof rects)[number]) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(overlap(rects[0]!, rects[1]!), 'Akte und Kodex').toBe(false);
    expect(overlap(rects[0]!, rects[2]!), 'Akte und Kalender').toBe(false);
    expect(overlap(rects[1]!, rects[2]!), 'Kodex und Kalender').toBe(false);
  });
}

test('Effekte aus: Aufschlagen, Zurückfliegen und Ablegen ohne Animation', async ({ page }) => {
  await toDesk(page, 'aus');
  const anims = () => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
  await key(page, 'stack').click();
  expect(await anims()).toBe(0);
  await pullOut(page, 0);
  expect(await anims()).toBe(0);
  await key(page, 'codex-book').click();
  expect(await anims()).toBe(0);
  await key(page, 'close-akte').click();
  expect(await anims()).toBe(0);
  await expect(page.locator('.paper.loose')).toHaveCount(0);
  await key(page, 'folder').click();
  await key(page, 'pos-p1-anerkennen').click();
  await key(page, 'pos-p2-streichen').click();
  await stampAkte(page, 'bescheid');
  expect(await anims()).toBe(0);
  await expect(page.locator('.folder.open')).not.toHaveClass(/shake/);
  await key(page, 'close-akte').click();
  await key(page, 'folder-outbox').click();
  expect(await anims()).toBe(0);
  await expect(page.locator('.outbox-count')).toHaveText('1');
});

test('Effekte voll: Mappe klappt auf, Papiere fliegen zurück', async ({ page }) => {
  await toDesk(page, 'voll');
  await key(page, 'stack').click();
  await expect(page.locator('.folder.open.opening .folder-cover')).toHaveCount(1);
  await pullOut(page, 0);
  await pullOut(page, 1);
  await key(page, 'close-akte').click();
  // The papers are on their way into the pocket.
  expect(await page.locator('.pocket .paper').evaluateAll((els) => els.filter((e) => e.getAnimations().length > 0).length)).toBeGreaterThan(0);
  await expect(page.locator('.folder.on-desk')).toBeVisible();
});
