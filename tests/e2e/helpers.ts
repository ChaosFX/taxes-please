import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raw = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'content', 'akt1-tag1-3.json'), 'utf8'));

interface Solution {
  positions: Record<string, string>;
  option?: string;
  stamp: string;
}

/** Correct answer for an Akte id straight from the JSON (independent of src/core). */
export function solutionFor(akteId: string): Solution {
  const follow = akteId.endsWith('/folge');
  const k = raw.cases.find((c: { id: string }) => c.id === akteId.replace('/folge', ''));
  const src = follow ? k.followUp : k;
  const positions: Record<string, string> = {};
  for (const p of src.positions ?? []) if (p.correct !== 'offen') positions[p.id] = p.correct;
  return { positions, option: src.decision?.correct, stamp: src.correctStamp };
}

export async function freshStart(page: Page) {
  // Relative: stays under the Pages sub-path of baseURL.
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

export const key = (page: Page, k: string) => page.locator(`[data-key="${k}"]`);

/** Draws the next Akte and solves it by mouse. Returns its id. */
export async function solveNext(page: Page, answer: (id: string) => Solution = solutionFor): Promise<string> {
  await key(page, 'stack').click();
  const id = (await page.locator('.pruefvermerk').getAttribute('data-akte'))!;
  const s = answer(id);
  for (const [pid, v] of Object.entries(s.positions)) await key(page, `pos-${pid}-${v}`).click();
  if (s.option) await key(page, `opt-${s.option}`).click();
  await key(page, `stamp-${s.stamp}`).click();
  await key(page, 'outbox').click();
  return id;
}

export async function playDay(page: Page, opts: { reloadAfter?: number } = {}) {
  await key(page, 'begin').click();
  let n = 0;
  while (await page.locator('.screen.desk').isVisible()) {
    await solveNext(page);
    n++;
    if (opts.reloadAfter === n) {
      await page.reload();
      await key(page, 'continue').click();
    }
  }
  await expect(page.locator('.screen.summary')).toBeVisible();
}
