import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Timeout for a long test (they run in Chromium and Firefox only). */
export function longTest(ms: number) {
  test.setTimeout(ms);
}

/**
 * Smoke set: the only tests run in WebKit (Safari). They touch every kind of
 * interaction once; the game logic itself does not depend on the browser and
 * is covered in full by Chromium and Firefox.
 */
export const SMOKE = { tag: '@smoke' };

/** Akt I straight from the JSON (independent of src/core). */
export const raw = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'content', 'akt1.json'), 'utf8'));

interface LineRef {
  document: string;
  line: string;
}

export interface Solution {
  positions: Record<string, string>;
  option?: string;
  /** Option value per choice decision. */
  decisions: Record<string, string>;
  /** Amount per amount decision, as the player would type it (`4236,7`). */
  amounts: Record<string, string>;
  marks: { a: LineRef; b: LineRef }[];
  inquiry?: string;
  stamp: string;
}

/** The case of an Akte id; follow-ups carry `/folge`. */
export function caseOf(akteId: string) {
  return raw.cases.find((c: { id: string }) => c.id === akteId.replace('/folge', ''));
}

/** Correct answer for an Akte id straight from the JSON. */
export function solutionFor(akteId: string): Solution {
  const follow = akteId.endsWith('/folge');
  const k = caseOf(akteId);
  const src = follow ? k.followUp : k;
  const s: Solution = { positions: {}, decisions: {}, amounts: {}, marks: [], stamp: src.correctStamp, option: src.decision?.correct };
  for (const p of src.positions ?? []) if (p.correct !== 'offen') s.positions[p.id] = p.correct;
  for (const d of src.decisions ?? []) {
    if (d.answerType === 'amount') s.amounts[d.id] = String(d.correct).replace('.', ',');
    else if (d.correct !== 'offen') s.decisions[d.id] = d.correct;
  }
  if (!follow && src.correctStamp === 'ergaenzung') {
    s.marks = (k.discrepancies ?? []).map((w: { a: LineRef; b: LineRef }) => ({ a: w.a, b: w.b }));
    s.inquiry = k.inquiry?.correct;
  }
  return s;
}

/** Documents of the Akte as shown on the desk. */
export function documentsOf(akteId: string): { title: string; lines: [string, string][] }[] {
  const k = caseOf(akteId);
  return akteId.endsWith('/folge') ? k.followUp.documents : k.documents;
}

/** data-key of the mark button of a line (`mark-<paper>-<line>`). */
export function markKey(akteId: string, ref: LineRef): string {
  const docs = documentsOf(akteId);
  const d = docs.findIndex((x) => x.title === ref.document);
  const l = docs[d]!.lines.findIndex(([label]) => label === ref.line);
  return `mark-${d}-${l}`;
}

export async function freshStart(page: Page) {
  // Relative: stays under the Pages sub-path of baseURL.
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

export const key = (page: Page, k: string) => page.locator(`[data-key="${k}"]`);

/**
 * Double-clicks the morning paper on the desk to zoom it. WebKit's
 * `document.elementsFromPoint` misses the two-column text of the rotated paper
 * and reports `<html>`, so Playwright's hit-target check never passes there,
 * although `elementFromPoint` and real clicks hit the paper. In WebKit the check
 * is skipped; Chromium and Firefox keep it.
 */
export async function zoomNewspaper(page: Page, paper: Locator = key(page, 'newspaper-0')): Promise<void> {
  const webkit = page.context().browser()?.browserType().name() === 'webkit';
  await paper.dblclick({ force: webkit });
}

/** Takes the top Akte from the inbox: it opens on the desk (SPEC 7.2). Returns its id. */
export async function openAkte(page: Page): Promise<string> {
  await key(page, 'stack').click();
  await expect(page.locator('.folder.open .pruefvermerk')).toBeVisible();
  return (await page.locator('.pruefvermerk').getAttribute('data-akte'))!;
}

/** Inbox counter („Eingang (3)“). */
export const inboxCount = (page: Page) => page.getByTestId('inbox-count');

/** Clicks a paper in the pocket on its title strip (the papers overlap there); it lands next to the folder. */
export async function pullOut(page: Page, doc: number) {
  const paper = key(page, `paper-${doc}`);
  if (await paper.evaluate((el) => el.classList.contains('loose'))) return;
  await paper.click({ position: { x: 40, y: 7 } });
  await expect(paper).toHaveClass(/loose/);
  await paper.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
}

/** Marks a pair of lines in mark mode (mouse). Both papers are taken out of the pocket first. */
export async function markPair(page: Page, akteId: string, m: { a: LineRef; b: LineRef }) {
  const docs = documentsOf(akteId);
  const on = (await key(page, 'mark-mode').getAttribute('aria-pressed')) === 'true';
  if (on) await key(page, 'mark-mode').click();
  for (const r of [m.a, m.b]) await pullOut(page, docs.findIndex((d) => d.title === r.document));
  await key(page, 'mark-mode').click();
  for (const r of [m.a, m.b]) {
    const line = key(page, markKey(akteId, r));
    // The paper may lie under another one: bring it to the top by its title first.
    await line.evaluate((el) => el.closest<HTMLElement>('.paper')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await line.click();
  }
}

/**
 * Takes a stamp from the holder, chooses the question if given, and presses it
 * onto the stamp field of the open folder (SPEC 7.3).
 */
export async function stampAkte(page: Page, stamp: string, inquiry?: string) {
  await key(page, `stamp-${stamp}`).click();
  if (inquiry) await key(page, `inq-${inquiry}`).click();
  await key(page, 'stamp-field').click();
  await expect(page.locator('.stamp-imprint')).toBeVisible();
}

/** Closes the open folder (papers fly back) and puts it into the outbox with the button on its cover. */
export async function fileAkte(page: Page) {
  await key(page, 'close-akte').click();
  await expect(page.locator('.folder.on-desk')).toBeVisible();
  await key(page, 'folder-outbox').click();
}

/**
 * How the player works (SPEC 11, Auftrag 05 B5):
 * - `click`: clicks only, the shortest way;
 * - `drag`: with the mouse by dragging – Akte from the inbox onto the pad, papers out
 *   of the pocket, the closed Akte into the outbox;
 * - `keys`: keyboard only – Enter, Space and typing on the focused element.
 */
export type Way = 'click' | 'drag' | 'keys';

/** Mouse drag from the middle (or `from`) of an element to a point. */
export async function dragTo(page: Page, l: Locator, to: { x: number; y: number }, from?: { x: number; y: number }) {
  const b = (await l.boundingBox())!;
  const a = from ?? { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + to.x) / 2, (a.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

/** Focus by keyboard target and press a key: the element is activated with the keyboard, not the mouse. */
async function press(page: Page, k: string, keyName = 'Enter') {
  await key(page, k).focus();
  await page.keyboard.press(keyName);
}

async function openWith(page: Page, way: Way): Promise<string> {
  if (way === 'click') return openAkte(page);
  if (way === 'keys') await press(page, 'stack');
  else {
    const pad = (await page.locator('.stage .pad').boundingBox())!;
    await dragTo(page, key(page, 'stack'), { x: pad.x + 300, y: pad.y + 120 });
  }
  await expect(page.locator('.folder.open .pruefvermerk')).toBeVisible();
  return (await page.locator('.pruefvermerk').getAttribute('data-akte'))!;
}

async function pullOutWith(page: Page, way: Way, doc: number) {
  const paper = key(page, `paper-${doc}`);
  if (await paper.evaluate((el) => el.classList.contains('loose'))) return;
  if (way === 'click') return pullOut(page, doc);
  if (way === 'keys') await press(page, `paper-${doc}`);
  else {
    // Grabbed at its title strip in the pocket, dropped on the pad right of the folder.
    const b = (await paper.boundingBox())!;
    const pad = (await page.locator('.stage .pad').boundingBox())!;
    const folder = (await page.locator('.folder.open').boundingBox())!;
    const x = Math.min(pad.x + pad.width - 180, folder.x + folder.width + 60 + (doc % 2) * 60);
    await dragTo(page, paper, { x, y: pad.y + 60 + doc * 70 }, { x: b.x + 40, y: b.y + 6 });
  }
  await expect(paper).toHaveClass(/loose/);
  await paper.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
}

/** Enters a solution for the Akte on the desk, stamps and files it. */
export async function enter(page: Page, id: string, s: Solution, way: Way = 'click') {
  const act = (k: string) => (way === 'keys' ? press(page, k) : key(page, k).click());
  for (const [pid, v] of Object.entries(s.positions)) await act(`pos-${pid}-${v}`);
  if (s.option) await act(`opt-${s.option}`);
  for (const [d, v] of Object.entries(s.decisions)) await act(`dec-${d}-${v}`);
  for (const [d, v] of Object.entries(s.amounts)) {
    if (way === 'keys') {
      await key(page, `amt-${d}`).focus();
      await page.keyboard.type(v);
    } else await key(page, `amt-${d}`).fill(v);
  }
  if (way === 'click') for (const m of s.marks) await markPair(page, id, m);
  else if (s.marks.length) {
    const docs = documentsOf(id);
    for (const m of s.marks) for (const r of [m.a, m.b]) await pullOutWith(page, way, docs.findIndex((d) => d.title === r.document));
    await act('mark-mode');
    // Mark lines by keyboard in both ways: papers may lie on top of each other.
    for (const m of s.marks) for (const r of [m.a, m.b]) await press(page, markKey(id, r));
  }
  const inquiry = s.stamp === 'ergaenzung' && caseOf(id).inquiry && !id.endsWith('/folge') ? s.inquiry : undefined;
  if (way === 'keys') {
    // Tab to the stamp, Enter takes it, Enter presses it (after choosing the question, focus is on the stamp field).
    await press(page, `stamp-${s.stamp}`);
    if (inquiry) await press(page, `inq-${inquiry}`);
    await expect(key(page, 'stamp-field')).toHaveClass(/ready/);
    await page.keyboard.press('Enter');
    await expect(page.locator('.stamp-imprint')).toBeVisible();
    await expect(key(page, 'close-akte')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(key(page, 'folder-outbox')).toBeFocused();
    await page.keyboard.press('Enter');
  } else {
    await stampAkte(page, s.stamp, inquiry);
    if (way === 'click') await fileAkte(page);
    else {
      await key(page, 'close-akte').click();
      const folder = page.locator('.desk-folder');
      await expect(folder).toBeVisible();
      // Measured once the cover has closed.
      await folder.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      const out = (await page.locator('.outbox-zone').boundingBox())!;
      const f = (await folder.boundingBox())!;
      await dragTo(page, folder, { x: out.x + out.width / 2, y: out.y + out.height / 2 }, { x: f.x + f.width / 2, y: f.y + 40 });
    }
  }
  await expect(page.locator('.folder.open, .desk-folder')).toHaveCount(0);
}

/** Draws the next Akte and solves it. Returns its id. */
export async function solveNext(page: Page, answer: (id: string) => Solution = solutionFor, way: Way = 'click'): Promise<string> {
  const id = await openWith(page, way);
  await enter(page, id, answer(id), way);
  return id;
}

export async function playDay(page: Page, opts: { reloadAfter?: number; answer?: (id: string) => Solution; way?: Way } = {}) {
  await key(page, 'begin').click();
  let n = 0;
  while (await page.locator('.screen.desk').isVisible()) {
    await solveNext(page, opts.answer, opts.way);
    n++;
    if (opts.reloadAfter === n) {
      await page.reload();
      await key(page, 'continue').click();
    }
  }
  await expect(page.locator('.screen.summary')).toBeVisible();
}

/**
 * Starts at the beginning of `day` with a clean record, as if days before were
 * played perfectly: a save in the format of src/core (version 2) is put into
 * localStorage. Follow-ups due that day come first; tools unlocked so far are on.
 */
export async function startAtDay(page: Page, day: number, opts: { effects?: 'aus' | 'reduziert' | 'voll'; codex?: { lastRuleId: string; seenDay: number } } = {}) {
  const tools: string[] = [];
  for (const d of raw.days) {
    if (d.day > day) continue;
    for (const e of d.storyEvents) if (e.type === 'unlock' && !tools.includes(e.feature)) tools.push(e.feature);
  }
  const followUps = raw.cases
    .filter((c: { followUp?: { arrivesOnDay: number } }) => c.followUp?.arrivesOnDay === day)
    .map((c: { id: string }) => `${c.id}/folge`);
  const queue = [...followUps, ...raw.days.find((d: { day: number }) => d.day === day).cases];
  const save = {
    version: 2,
    day,
    phase: 'intro',
    queue,
    current: null,
    results: [],
    pendingFollowUps: [],
    tools,
    settings: { effects: opts.effects ?? 'voll', volume: 0.7, music: 0.5 },
    // Without `codex` unless given: like a save from before SPEC 0.3.2.
    ...(opts.codex ? { codex: opts.codex } : {}),
  };
  await page.goto('./');
  await page.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem('taxes-please/save/v1', JSON.stringify(s));
  }, save);
  await page.reload();
  await key(page, 'continue').click();
  await expect(page.locator('.day-card h1')).toHaveText(`Tag ${day}`);
}

/** Draws Akten (solving those before) until `id` is on the desk. */
export async function drawUntil(page: Page, id: string) {
  await key(page, 'begin').click();
  for (;;) {
    const current = await openAkte(page);
    if (current === id) return;
    await enter(page, current, solutionFor(current));
  }
}
