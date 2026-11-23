import { expect, test } from '@playwright/test';
import { SMOKE, key, openAkte, raw, startAtDay } from './helpers';

/*
 * Auftrag 06b: tools spread over Akt I, the desk calculator by keyboard and
 * saves from before the Auftrag. Short tests from a prepared save.
 */

type Day = { day: number; cases: string[]; stamps: string[]; storyEvents: { type: string; feature?: string }[] };
const dayOf = (n: number): Day => raw.days.find((d: Day) => d.day === n);
const caseOf = (id: string) => raw.cases.find((c: { id: string }) => c.id === id);

/** Day on which each tool comes (Auftrag 06b, Aufgabe 1). */
const FROM = { ergaenzung: 3, calendar: 4, marking: 5, inquiry: 6, pinboard: 7, calculator: 8, call: 9, drawer: 10 };

test('Werkzeuge je Tag 1 bis 10 wie in der Tabelle: höchstens eines neu, vorher nicht am Tisch', async ({ page }) => {
  test.setTimeout(90_000);
  // From the data: inquiry, amount fields and calls come first on their day.
  const first = (pred: (d: Day) => boolean) => raw.days.find(pred)?.day;
  expect(first((d) => d.cases.some((id) => caseOf(id).inquiry))).toBe(FROM.inquiry);
  expect(first((d) => d.cases.some((id) => (caseOf(id).decisions ?? []).some((x: { answerType?: string }) => x.answerType === 'amount')))).toBe(FROM.calculator);
  expect(first((d) => d.storyEvents.some((e) => e.type === 'call'))).toBe(FROM.call);
  expect(first((d) => d.storyEvents.some((e) => e.type === 'newspaper'))).toBe(2);

  for (let day = 1; day <= 10; day++) {
    const d = dayOf(day);
    await startAtDay(page, day, { queue: [d.cases[0]!], effects: 'aus' });
    await expect(page.locator('.day-card .call')).toHaveCount(d.storyEvents.filter((e) => e.type === 'call' && !('at' in e)).length);
    await key(page, 'begin').click();
    // Always there: inbox, codex, stamp „Bescheid“, phone and the handle of the drawer (stuck before day 10).
    for (const k of ['stack', 'codex-book', 'stamp-bescheid', 'drawer']) await expect(key(page, k), `Tag ${day}: ${k}`).toBeVisible();
    await expect(page.locator('.desk-phone')).toBeVisible();
    await expect(key(page, 'stamp-ergaenzung'), `Tag ${day}`).toHaveCount(day >= FROM.ergaenzung ? 1 : 0);
    await expect(key(page, 'calendar-tool'), `Tag ${day}`).toHaveCount(day >= FROM.calendar ? 1 : 0);
    await expect(key(page, 'pinboard'), `Tag ${day}`).toHaveCount(day >= FROM.pinboard ? 1 : 0);
    await expect(key(page, 'calc-tool'), `Tag ${day}`).toHaveCount(day >= FROM.calculator ? 1 : 0);
    await expect(page.locator('.stage [data-key^="newspaper-"]'), `Tag ${day}`).toHaveCount(d.storyEvents.filter((e) => e.type === 'newspaper' && !('at' in e)).length);
    // No switch for marking at any day; the Gegenüberstellung only with the stamp from day 5 on.
    await openAkte(page);
    await expect(page.locator('[data-key="mark-mode"], .mark-toggle, .mark-area')).toHaveCount(0);
    if (day >= FROM.ergaenzung) {
      await key(page, 'stamp-ergaenzung').click();
      await expect(key(page, 'mark-area'), `Tag ${day}`).toHaveCount(day >= FROM.marking ? 1 : 0);
      await page.keyboard.press('Escape');
    }
  }
});

test('Tischrechner mit Numpad, Backspace und Entf; Betragsfeld und K bleiben unberührt', SMOKE, async ({ page }) => {
  await startAtDay(page, 8, { queue: ['8-1'], effects: 'aus' });
  await key(page, 'begin').click();
  await key(page, 'calc-tool').click();
  const display = page.locator('.calc-display');
  await expect(key(page, 'calc')).toBeFocused();
  for (const k of ['Numpad1', 'Numpad2', 'NumpadAdd', 'Numpad3', 'NumpadEnter']) await page.keyboard.press(k);
  await expect(display).toHaveText('15');
  for (const k of ['Numpad4', 'NumpadDecimal', 'Numpad5', 'Backspace']) await page.keyboard.press(k);
  await expect(display).toHaveText('4,');
  for (const k of ['Backspace', 'NumpadMultiply', 'Numpad6', 'NumpadDivide', 'Numpad8', 'NumpadSubtract', 'Numpad1', 'Enter']) await page.keyboard.press(k);
  await expect(display).toHaveText('2');
  await page.keyboard.press('Delete');
  await expect(display).toHaveText('0');
  // The key ⌫ on the device.
  await key(page, 'calc-9').click();
  await key(page, 'calc-back').click();
  await expect(display).toHaveText('0');

  // Focus elsewhere on the desk: digits still count; in an amount field they do not.
  await openAkte(page);
  await key(page, 'pruefvermerk').focus();
  await page.keyboard.press('7');
  await expect(display).toHaveText('7');
  const amount = page.locator('.amount-input').first();
  await amount.focus();
  await page.keyboard.type('42');
  await page.keyboard.press('Backspace');
  await expect(amount).toHaveValue('4');
  await expect(display).toHaveText('7');
  // K still opens the codex.
  await key(page, 'pruefvermerk').focus();
  await page.keyboard.press('k');
  await expect(page.locator('dialog[open]')).toHaveCount(1);
});

test('Spielstände von vor Auftrag 06b laden an Tag 3, 6 und 9 ohne Fehler', async ({ page }) => {
  for (const day of [3, 6, 9]) {
    await startAtDay(page, day, { effects: 'aus' });
    // As saved before 06b: without `marking` among the tools.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('taxes-please/save/v1')!);
      s.tools = s.tools.filter((x: string) => x !== 'marking');
      s.phase = 'desk';
      localStorage.setItem('taxes-please/save/v1', JSON.stringify(s));
    });
    await page.reload();
    await key(page, 'continue').click();
    await openAkte(page);
    await key(page, 'stamp-ergaenzung').click();
    await expect(key(page, 'mark-area')).toHaveCount(day >= FROM.marking ? 1 : 0);
  }
});

test('Papiere: keine automatische Silbentrennung, linksbündig, Beträge brechen nie um', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await startAtDay(page, 5, { effects: 'aus', queue: ['5-3'] });
  // Intro: note and newspaper are papers too.
  const check = () =>
    page.evaluate(() => {
      const bad: string[] = [];
      for (const root of document.querySelectorAll<HTMLElement>('.paper, .note, .newspaper')) {
        for (const el of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
          const cs = getComputedStyle(el);
          if (cs.hyphens === 'auto' || cs.webkitHyphens === 'auto') bad.push(`hyphens ${el.tagName}.${el.className}`);
          if (cs.textAlign === 'justify') bad.push(`justify ${el.tagName}.${el.className}`);
        }
      }
      for (const td of document.querySelectorAll<HTMLElement>('.paper td.amount')) {
        if (getComputedStyle(td).whiteSpace !== 'nowrap') bad.push(`wrap ${td.textContent}`);
        const r = document.createRange();
        r.selectNodeContents(td);
        if (new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size > 1) bad.push(`broken ${td.textContent}`);
      }
      return { bad, amounts: document.querySelectorAll('.paper td.amount').length, papers: document.querySelectorAll('.paper, .note, .newspaper').length };
    });
  let r = await check();
  expect(r.papers).toBeGreaterThan(0);
  expect(r.bad).toEqual([]);
  await key(page, 'begin').click();
  await openAkte(page);
  for (let i = 0; i < 6; i++) await key(page, `paper-${i}`).click({ position: { x: 40, y: 7 } });
  await expect(page.locator('.paper.doc.loose:not(.newspaper)')).toHaveCount(6);
  r = await check();
  expect(r.amounts).toBeGreaterThan(5);
  expect(r.bad).toEqual([]);
  // The codex keeps justified text and hyphenation.
  await page.keyboard.press('k');
  await expect(page.locator('.rule-text').first()).toHaveCSS('hyphens', 'auto');
});

test('Bleistift-Kringel: voll zeichnet ein und streicht durch, reduziert blendet ein, aus steht sofort; aria-pressed bleibt die Quelle', async ({ page }) => {
  for (const effects of ['voll', 'reduziert', 'aus'] as const) {
    await startAtDay(page, 5, { effects, queue: ['5-1'] });
    await key(page, 'begin').click();
    await openAkte(page);
    const a = key(page, 'dec-d1-bilanz');
    const b = key(page, 'dec-d1-ea');
    await a.click();
    await expect(a).toHaveAttribute('aria-pressed', 'true');
    await expect(a.locator('svg.pencil-ring')).toHaveAttribute('aria-hidden', 'true');
    await expect(a).toHaveClass(effects === 'voll' ? /ring-draw/ : effects === 'reduziert' ? /ring-fade/ : /option/);
    if (effects === 'aus') await expect(a).not.toHaveClass(/ring-draw|ring-fade/);
    // Changing one's mind: the new one gets the loop, the old one strikes through (voll) or loses it at once.
    await b.click();
    await expect(b).toHaveAttribute('aria-pressed', 'true');
    await expect(a).toHaveAttribute('aria-pressed', 'false');
    await expect(b.locator('svg.pencil-ring')).toHaveCount(1);
    if (effects === 'voll') await expect(a.locator('svg.ring-gone')).toHaveCount(0); // gone after the strike
    else await expect(a.locator('svg')).toHaveCount(0);
    // Taking it back: no loop, nothing pressed.
    await b.click();
    await expect(b).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.pruefvermerk [aria-pressed="false"] svg.pencil-ring:not(.ring-gone)')).toHaveCount(0);
  }
});
