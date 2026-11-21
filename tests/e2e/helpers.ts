import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

/** Marks a pair of lines in mark mode (mouse). */
export async function markPair(page: Page, akteId: string, m: { a: LineRef; b: LineRef }) {
  if ((await key(page, 'mark-mode').getAttribute('aria-pressed')) !== 'true') await key(page, 'mark-mode').click();
  await key(page, markKey(akteId, m.a)).click();
  await key(page, markKey(akteId, m.b)).click();
}

/** Enters a solution for the Akte on the desk, stamps and files it. */
export async function enter(page: Page, id: string, s: Solution) {
  for (const [pid, v] of Object.entries(s.positions)) await key(page, `pos-${pid}-${v}`).click();
  if (s.option) await key(page, `opt-${s.option}`).click();
  for (const [d, v] of Object.entries(s.decisions)) await key(page, `dec-${d}-${v}`).click();
  for (const [d, v] of Object.entries(s.amounts)) await key(page, `amt-${d}`).fill(v);
  for (const m of s.marks) await markPair(page, id, m);
  await key(page, `stamp-${s.stamp}`).click();
  if (s.stamp === 'ergaenzung' && caseOf(id).inquiry && !id.endsWith('/folge')) await key(page, `inq-${s.inquiry}`).click();
  await key(page, 'outbox').click();
}

/** Draws the next Akte and solves it by mouse. Returns its id. */
export async function solveNext(page: Page, answer: (id: string) => Solution = solutionFor): Promise<string> {
  await key(page, 'stack').click();
  const id = (await page.locator('.pruefvermerk').getAttribute('data-akte'))!;
  await enter(page, id, answer(id));
  return id;
}

export async function playDay(page: Page, opts: { reloadAfter?: number; answer?: (id: string) => Solution } = {}) {
  await key(page, 'begin').click();
  let n = 0;
  while (await page.locator('.screen.desk').isVisible()) {
    await solveNext(page, opts.answer);
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
export async function startAtDay(page: Page, day: number) {
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
    settings: { effects: 'voll', volume: 0.7, music: 0.5 },
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
    await key(page, 'stack').click();
    const current = (await page.locator('.pruefvermerk').getAttribute('data-akte'))!;
    if (current === id) return;
    await enter(page, current, solutionFor(current));
  }
}
