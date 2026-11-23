import { expect, test, type Page } from '@playwright/test';
import { SMOKE, dragTo, enter, key, openAkte, pullOut, raw, savedState, solutionFor, startAtDay } from './helpers';

/**
 * Pinnwand mit Fragen und Lade (SPEC 4, 5, 7.6, 7.7, 11, Auftrag 06). Every
 * test starts from a save on its day; none plays days through.
 */

type Q = { id: string; text: string; answer: { text: string } };
const questions: Q[] = raw.days.flatMap((d: { questions?: Q[] }) => d.questions ?? []);
const q = (id: string) => questions.find((x) => x.id === id)!;
const ES118 = '7-3|Rechnung Eventservice GmbH|Rechnungsnummer';
const WOLF = '2-4|Arbeitnehmerveranlagung 2025|Arbeitgeber';
const STAMP_10_4 = '10-4|@representative';
const card = (page: Page, k: string) => key(page, `card-${k}`);
const question = (page: Page, id: string) => key(page, `q-${id}`);
const message = (page: Page) => page.locator('.desk-message');

/** Opens the Akte on top, solves it and files it. */
async function solveTop(page: Page) {
  const id = await openAkte(page);
  await enter(page, id, solutionFor(id));
  return id;
}

test('q1 an Tag 7: 7-3 ablegen, Hinweis auf q1 ziehen, q2 taucht auf', SMOKE, async ({ page }) => {
  await startAtDay(page, 7, { filed: true, queue: ['7-3', '7-1'] });
  // The new question comes as a note at the start of the day (SPEC 4.9).
  await expect(page.locator('.question-notice')).toContainText(q('q1').text);
  await expect(page.locator('.pinboard-unlock')).toBeVisible();
  await key(page, 'begin').click();
  await expect(key(page, 'pinboard')).toBeVisible();
  await expect(key(page, 'pinboard').locator('.cork-count')).toHaveCount(0);

  await solveTop(page);
  await expect(message(page)).toContainText('ES-2025-118');
  await expect(key(page, 'pinboard').locator('.cork-count')).toBeVisible();

  await key(page, 'pinboard').click();
  const dialog = page.locator('dialog.pinboard-dialog');
  await expect(dialog).toBeVisible();
  await expect(question(page, 'q1')).toContainText('1 von 2');
  await expect(card(page, ES118)).toContainText('ES-2025-118');
  const to = (await question(page, 'q1').boundingBox())!;
  await dragTo(page, card(page, ES118), { x: to.x + to.width / 2, y: to.y + to.height / 2 });

  await expect(question(page, 'q1')).toHaveClass(/answered/);
  await expect(dialog.locator('[data-answer="q1"]')).toContainText(q('q1').answer.text);
  await expect(question(page, 'q2')).toBeVisible();
  // 2-4 lies in the outbox since day 2: its clue for q2 is in the hand at once.
  await expect(card(page, WOLF)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(key(page, 'pinboard')).toBeFocused();
});

test('Lade an Tag 10: Zettel liegen drin, auch nach Neuladen', SMOKE, async ({ page }) => {
  await startAtDay(page, 10, { queue: ['10-1'] });
  await expect(page.locator('.drawer-unlock')).toBeVisible();
  await key(page, 'begin').click();
  await expect(message(page)).toHaveText('Der Zettel kommt in die Lade.');
  await key(page, 'drawer').click();
  const drawer = page.locator('dialog.drawer-dialog');
  await expect(drawer.locator('.drawer-note')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(key(page, 'drawer')).toBeFocused();

  await page.reload();
  await key(page, 'continue').click();
  await key(page, 'drawer').focus();
  await page.keyboard.press('Enter');
  await expect(drawer.locator('.drawer-note')).toHaveCount(2);
  // Read and zoom.
  await drawer.locator('.drawer-note').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('dialog.zoom')).toBeVisible();
  await page.keyboard.press('Escape');
  await key(page, 'drawer-close').click();
  await expect(drawer).toHaveCount(0);
});

test('Sprung aus der Auswertung in den Kodex und zurück', SMOKE, async ({ page }) => {
  await startAtDay(page, 1, { queue: ['1-1'] });
  await key(page, 'begin').click();
  await solveTop(page);
  await expect(page.locator('.screen.summary')).toBeVisible();
  // A correct Akte keeps its solution folded.
  await page.locator('.result details > summary').first().click();
  const jump = page.locator('.rule-jump').first();
  const id = (await jump.textContent())!;
  await expect(jump).toHaveAccessibleName(`Regel ${id} im Kodex nachlesen`);
  await jump.click();
  const reader = page.locator('dialog.codex-dialog');
  await expect(reader).toBeVisible();
  await expect(reader.locator(`[data-rule="${id}"]`).first()).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(reader).toHaveCount(0);
  await expect(page.locator('.rule-jump').first()).toBeFocused();
  expect((await savedState(page)).codex.lastRuleId).toBe(id);
});

test('Pinnwand erst ab Tag 7, Lade klemmt bis Tag 10', async ({ page }) => {
  await startAtDay(page, 6, { queue: ['6-1'] });
  await key(page, 'begin').click();
  await expect(key(page, 'pinboard')).toHaveCount(0);
  await page.keyboard.press('p');
  await expect(page.locator('dialog.pinboard-dialog')).toHaveCount(0);
  await key(page, 'drawer').click();
  await expect(message(page)).toHaveText('Die Lade klemmt.');
  await expect(page.locator('dialog.drawer-dialog')).toHaveCount(0);

  // Day 7: nothing of later questions or answers in the DOM, not even in the pinboard.
  await startAtDay(page, 7, { filed: true, queue: ['7-1'] });
  await key(page, 'begin').click();
  await page.keyboard.press('p');
  await expect(page.locator('dialog.pinboard-dialog')).toBeVisible();
  const html = await page.content();
  for (const later of [q('q2').text, q('q3').text, q('q1').answer.text, q('q3').answer.text]) expect(html).not.toContain(later);
  for (const k of raw.cases.filter((c: { id: string }) => Number(c.id.split('-')[0]) > 7)) expect(html).not.toContain(`copy-${k.id}"`);
});

test('Zuordnen nur mit der Tastatur, q3 an Tag 10, übersteht Neuladen', async ({ page }) => {
  await startAtDay(page, 10, { filed: true, queue: ['10-4', '10-1'], effects: 'aus', board: { placed: { q1: [ES118], q2: [WOLF] }, pinned: [], seenClues: [], seenAnswers: ['q1', 'q2'], misses: 0 } });
  await key(page, 'begin').click();
  await solveTop(page);
  await expect(message(page)).toContainText('Pernold & Partner Steuerberatung');
  await page.keyboard.press('p');
  await expect(question(page, 'q3')).toContainText('2 von 3');
  await card(page, STAMP_10_4).focus();
  await page.keyboard.press('Enter');
  // The card is chosen, focus goes to the first open question.
  await expect(card(page, STAMP_10_4)).toHaveAttribute('aria-pressed', 'true');
  await expect(question(page, 'q3')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(question(page, 'q3')).toHaveClass(/answered/);
  await expect(page.locator('[data-answer="q3"]')).toContainText(q('q3').answer.text);
  // Effects off: no animation at the answer.
  expect(await page.locator('dialog.pinboard-dialog').evaluate((d) => d.getAnimations({ subtree: true }).length)).toBe(0);
  await page.keyboard.press('p');
  await expect(page.locator('dialog.pinboard-dialog')).toHaveCount(0);

  await page.reload();
  await key(page, 'continue').click();
  await page.keyboard.press('p');
  for (const id of ['q1', 'q2', 'q3']) await expect(question(page, id)).toHaveClass(/answered/);
});

test('falsch zugeordnet: bleibt in der Hand, misses steigt, keine Fehler', async ({ page }) => {
  await startAtDay(page, 10, { filed: true, queue: ['10-4', '10-1'] });
  await key(page, 'begin').click();
  await solveTop(page);
  await page.keyboard.press('p');
  await card(page, STAMP_10_4).click();
  await question(page, 'q1').click();
  await expect(page.locator('.pb-live')).toHaveText('Das passt nicht zu dieser Frage.');
  await expect(card(page, STAMP_10_4)).toBeVisible();
  await expect(question(page, 'q1')).not.toHaveClass(/answered/);
  // Escape first drops the choice, then closes.
  await page.keyboard.press('Escape');
  await expect(card(page, STAMP_10_4)).toHaveAttribute('aria-pressed', 'false');
  const saved = await savedState(page);
  expect(saved.board.misses).toBe(1);
  expect(saved.results.flatMap((r: { errors: unknown[] }) => r.errors)).toEqual([]);
});

test('In Akt I keine Nadel an den Zeilen und keine Durchschläge (Tag 7 und 10)', async ({ page }) => {
  for (const day of [7, 10]) {
    await startAtDay(page, day, { filed: true, queue: [`${day}-1`], effects: 'aus' });
    await key(page, 'begin').click();
    await openAkte(page);
    await pullOut(page, 0);
    await key(page, 'paper-0').locator('tr').first().hover();
    await expect(page.locator('.pin-needle, tr.pinnable, .pinnable-stamp')).toHaveCount(0);
    await page.keyboard.press('p');
    await expect(page.locator('dialog.pinboard-dialog')).toBeVisible();
    await expect(page.locator('.pb-archive, [data-key="carbon-folder"], .copy-paper')).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
});

for (const size of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
]) {
  test(`Pinnwand und Lade passen bei ${size.width} × ${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await startAtDay(page, 10, { filed: true, queue: ['10-1'], board: { placed: { q1: [ES118] }, pinned: [], seenClues: [], seenAnswers: [], misses: 0 } });
    await key(page, 'begin').click();
    for (const k of ['pinboard', 'drawer']) await expect(key(page, k)).toBeInViewport({ ratio: 0.99 });
    await key(page, 'pinboard').click();
    for (const sel of ['.pb-wall', '.pb-hand', '[data-key="pb-close"]']) await expect(page.locator(sel)).toBeInViewport({ ratio: 0.99 });
    await page.keyboard.press('Escape');
    await key(page, 'drawer').click();
    await expect(page.locator('.drawer-box')).toBeInViewport({ ratio: 0.99 });
  });
}
