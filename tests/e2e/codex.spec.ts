import { expect, test, type Page } from '@playwright/test';
import { freshStart, key, raw, startAtDay } from './helpers';

/**
 * Auftrag 04: der Kodex als Buch (SPEC 6). Most tests run with „Effekte aus“,
 * so every page turn is immediate and positions can be measured at once.
 */

interface RawRule {
  id: string;
  day: number;
  title: string;
  text: string;
  source: string;
  sourceUrl: string;
}
const rules = raw.rules as RawRule[];
const ruleById = (id: string) => rules.find((r) => r.id === id)!;
const fold = (s: string) => s.toLowerCase().replaceAll('ß', 'ss').normalize('NFD').replace(/\p{M}/gu, '');

const dialog = (page: Page) => page.locator('dialog.codex-dialog');

async function openAtDesk(page: Page, day: number, effects: 'aus' | 'reduziert' | 'voll' = 'aus') {
  await startAtDay(page, day, { effects });
  await key(page, 'begin').click();
  await page.keyboard.press('k');
  await expect(dialog(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** Ids of rules lying completely inside a visible page body (and inside the window). */
function fullyVisibleRules(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const vp = document.querySelector('.book-viewport')!.getBoundingClientRect();
    for (const pg of document.querySelectorAll<HTMLElement>('.book-strip > .page.shown')) {
      if (pg.inert) continue;
      const body = pg.querySelector('.page-body')!.getBoundingClientRect();
      const left = Math.max(body.left, vp.left, 0);
      const right = Math.min(body.right, vp.right, window.innerWidth);
      const top = Math.max(body.top, vp.top, 0);
      const bottom = Math.min(body.bottom, vp.bottom, window.innerHeight);
      for (const r of pg.querySelectorAll<HTMLElement>('.rule')) {
        const b = r.getBoundingClientRect();
        if (b.width > 0 && b.left >= left - 0.5 && b.right <= right + 0.5 && b.top >= top - 0.5 && b.bottom <= bottom + 0.5) out.push(r.dataset.rule!);
      }
    }
    return out;
  });
}

/** Names of the visible pages („Seite 3“). */
function shownPages(page: Page): Promise<string[]> {
  return page.locator('.book-strip > .page.shown').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
}

/** Every block on a visible page ends inside its page body (nothing cut off at the foot). */
function cutBlocks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const pg of document.querySelectorAll<HTMLElement>('.book-strip > .page.shown')) {
      const body = pg.querySelector('.page-body')!;
      const bottom = body.getBoundingClientRect().bottom;
      for (const b of body.children) if (b.getBoundingClientRect().bottom > bottom + 0.5) out.push(`${pg.getAttribute('aria-label')}: ${(b as HTMLElement).dataset.rule ?? (b as HTMLElement).dataset.key ?? b.className}`);
      if (body.classList.contains('overflowing')) out.push(`${pg.getAttribute('aria-label')}: overflowing`);
    }
    return out;
  });
}

/** All text and attribute values in the document, hidden or not. */
const everything = (page: Page) =>
  page.evaluate(() => {
    const attrs = [...document.querySelectorAll('*')].flatMap((el) => [...el.attributes].map((a) => a.value));
    return `${document.documentElement.textContent}\n${attrs.join('\n')}`;
  });

test('Tag 1: Titel, Text und Fundstelle von R54 stehen nirgends im DOM, Reiter Tag 10 ist gesperrt', async ({ page }) => {
  await freshStart(page);
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  const r54 = ruleById('R54');
  expect(r54.day).toBe(10);
  await key(page, 'codex-book').click();
  await expect(dialog(page)).toBeVisible();

  const all = await everything(page);
  for (const s of [r54.title, r54.text, r54.source]) expect(all).not.toContain(s);
  // No locked rule leaks anything, not even its id.
  for (const r of rules.filter((x) => x.day > 1)) {
    expect(all).not.toContain(r.title);
    expect(all).not.toContain(r.text);
    expect(all).not.toContain(`regel-${r.id}`);
  }

  const tab10 = key(page, 'tab-10');
  await expect(tab10).toHaveAttribute('aria-disabled', 'true');
  await expect(tab10).toHaveAttribute('aria-label', 'Gesperrt – ab Tag 10');
  await expect(page.locator('.tab.locked')).toHaveCount(9);
  await expect(page.locator('.toc-locked')).toHaveCount(9);
  await expect(page.locator('.page.locked')).toHaveCount(9);
  await expect(page.locator('.page.locked').first()).toHaveAttribute('aria-description', 'gesperrte Seite');
  // A locked tab does nothing.
  const before = await shownPages(page);
  await tab10.click({ force: true });
  expect(await shownPages(page)).toEqual(before);

  // Closing with the button returns focus to the closed book.
  await key(page, 'codex-close').click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(key(page, 'codex-book')).toBeFocused();
});

test('Öffnen mit K, Blättern mit Pfeiltasten bis R9, Escape, Neuladen, wieder an derselben Stelle', async ({ page }) => {
  await openAtDesk(page, 10);
  await expect(page.locator('.book')).toBeFocused();
  for (let i = 0; i < 40 && !(await fullyVisibleRules(page)).includes('R9'); i++) await page.keyboard.press('ArrowLeft');
  expect(await fullyVisibleRules(page)).toContain('R9');
  const place = await shownPages(page);

  // Focus never lands on a hidden page while tabbing through the dialog.
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const ok = await page.evaluate(() => {
      const a = document.activeElement;
      return !!a && !!a.closest('dialog.codex-dialog') && !a.closest('[inert]') && !a.closest('.page:not(.shown)');
    });
    expect(ok, `Fokus nach ${i + 1}× Tab`).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await expect(key(page, 'codex-book')).toBeFocused();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('taxes-please/save/v1')!).codex);
  expect(saved.seenDay).toBe(10);
  expect(['R8', 'R9']).toContain(saved.lastRuleId);

  await page.reload();
  await key(page, 'continue').click();
  await expect(page.locator('.screen.desk')).toBeVisible();
  await page.keyboard.press('k');
  await expect(dialog(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await fullyVisibleRules(page)).toContain('R9');
  expect(await shownPages(page)).toEqual(place);
  // K closes again.
  await page.keyboard.press('k');
  await expect(dialog(page)).toHaveCount(0);
});

test('Öffnen mit Enter und Leertaste, Schließen per Klick daneben; K wirkt nicht im Eingabefeld', async ({ page }) => {
  await startAtDay(page, 9, { effects: 'aus' });
  await key(page, 'begin').click();
  await key(page, 'codex-book').focus();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(key(page, 'codex-book')).toBeFocused();
  await page.keyboard.press(' ');
  await expect(dialog(page)).toBeVisible();
  // K typed into the search stays in the field.
  await key(page, 'codex-search').click();
  await page.keyboard.type('k');
  await expect(dialog(page)).toBeVisible();
  await expect(key(page, 'codex-search')).toHaveValue('k');
  await page.mouse.click(4, 4);
  await expect(dialog(page)).toHaveCount(0);
  await expect(key(page, 'codex-book')).toBeFocused();
  // On the desk, K in an amount field does not open the book.
  await key(page, 'stack').click();
  const amount = page.locator('.amount-input').first();
  if (await amount.count()) {
    await amount.focus();
    await page.keyboard.press('k');
    await expect(dialog(page)).toHaveCount(0);
  }
});

test('Suche: „abzugsfahig“ findet „abzugsfähig“, „R12“ findet R12, Klick springt und markiert', async ({ page }) => {
  await openAtDesk(page, 10);
  await key(page, 'codex-search').fill('abzugsfahig');
  const expected = rules.filter((r) => fold(`${r.title} ${r.text}`).includes('abzugsfahig')).map((r) => r.id);
  expect(expected.length).toBeGreaterThan(1);
  await expect(page.locator('.search-hit')).toHaveCount(expected.length);
  expect(await page.locator('.search-hit').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.key!.slice(4)))).toEqual(expected);
  await expect(page.locator('.book-status')).toHaveText(`${expected.length} Treffer`);
  await expect(page.locator('.search-hit').first().locator('mark.find').first()).toBeVisible();

  // A hit on the first double page (the list itself runs over several pages).
  const target = expected[1]!;
  await expect(key(page, `hit-${target}`)).toBeVisible();
  await key(page, `hit-${target}`).click();
  expect(await fullyVisibleRules(page)).toContain(target);
  const marks = page.locator(`.page.shown [data-rule="${target}"] mark.find`);
  await expect(marks.first()).toBeVisible();
  for (const m of await marks.allTextContents()) expect(fold(m)).toBe('abzugsfahig');
  expect(await marks.first().evaluate((m) => getComputedStyle(m).backgroundImage)).toContain('gradient');

  await key(page, 'codex-search').fill('R12');
  await expect(page.locator('.search-hit').first()).toHaveAttribute('data-key', 'hit-R12');
  await key(page, 'hit-R12').click();
  expect(await fullyVisibleRules(page)).toContain('R12');
  await expect(page.locator('.page.shown [data-rule="R12"] .rule-id mark.find')).toHaveText('R12');

  // Clearing brings the register back.
  await key(page, 'codex-search-clear').click();
  await expect(key(page, 'codex-search')).toHaveValue('');
  await expect(page.locator('.page.shown .front-title')).toHaveText('Inhaltsverzeichnis');
  await expect(page.locator('mark.find')).toHaveCount(0);
});

test('Suche vor Tag 4: „R12“ findet nichts, gesperrte Regeln nie', async ({ page }) => {
  await openAtDesk(page, 3);
  await key(page, 'codex-search').fill('R12');
  await expect(page.locator('.search-hit')).toHaveCount(0);
  await expect(page.locator('.book-status')).toHaveText('Kein Treffer');
  await key(page, 'codex-search').fill('einkunftsarten');
  await expect(page.locator('.search-hit')).toHaveCount(0);
  await key(page, 'codex-search').fill('STRASSE');
  for (const k of await page.locator('.search-hit').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.key!.slice(4)))) expect(ruleById(k).day).toBeLessThanOrEqual(3);
});

test('Effekte aus: beim Blättern läuft keine Animation', async ({ page }) => {
  await openAtDesk(page, 10, 'aus');
  const running = () =>
    page.evaluate(() => {
      const anims = document.getAnimations().length;
      const moving = [...document.querySelectorAll<HTMLElement>('.book, .book-strip, .page, .flip-layer *')].filter((el) => {
        const cs = getComputedStyle(el);
        const t = cs.transitionDuration.split(',').some((d) => parseFloat(d) > 0) && cs.transitionProperty !== 'none';
        return t || cs.animationName !== 'none';
      }).length;
      return { anims, moving, layer: document.querySelector('.flip-layer')!.childElementCount };
    });
  expect(await running()).toEqual({ anims: 0, moving: 0, layer: 0 });
  for (const k of ['ArrowLeft', 'ArrowLeft', 'Home', 'ArrowRight', 'PageDown', 'End', 'PageUp']) {
    await page.keyboard.press(k);
    expect(await running(), k).toEqual({ anims: 0, moving: 0, layer: 0 });
  }
  await key(page, 'codex-prev').click();
  expect(await running()).toEqual({ anims: 0, moving: 0, layer: 0 });
});

/** Records every Web Animation started from now on (duration and animated properties). */
async function recordAnimations(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __anims: { duration: number; props: string[] }[] };
    w.__anims = [];
    const orig = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, frames: Keyframe[] | PropertyIndexedKeyframes | null, opts?: number | KeyframeAnimationOptions) {
      const props = Array.isArray(frames) ? [...new Set(frames.flatMap((f) => Object.keys(f).filter((k) => !['offset', 'easing', 'composite'].includes(k))))] : Object.keys(frames ?? {});
      w.__anims.push({ duration: typeof opts === 'number' ? opts : Number(opts?.duration ?? 0), props });
      return orig.call(this, frames, opts);
    };
  });
}
const recorded = (page: Page) => page.evaluate(() => (window as unknown as { __anims: { duration: number; props: string[] }[] }).__anims);

test('Effekte voll und reduziert: Umblättern ist animiert, nur transform und opacity, danach ist der Layer leer', async ({ page }) => {
  await openAtDesk(page, 10, 'voll');
  await page.waitForTimeout(500);
  await recordAnimations(page);
  await page.keyboard.press('ArrowLeft');
  // Copies in the animation carry no ids or keys.
  expect(await page.locator('.flip-layer [data-key], .flip-layer [id]').count()).toBe(0);
  const full = await recorded(page);
  expect(full.length).toBeGreaterThan(0);
  expect(Math.max(...full.map((a) => a.duration))).toBeGreaterThanOrEqual(350);
  expect(Math.max(...full.map((a) => a.duration))).toBeLessThanOrEqual(450);
  for (const a of full) for (const p of a.props) expect(['transform', 'opacity']).toContain(p);
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => document.querySelector('.flip-layer')!.childElementCount)).toBe(0);

  await openAtDesk(page, 10, 'reduziert');
  await page.waitForTimeout(300);
  await recordAnimations(page);
  await page.keyboard.press('ArrowLeft');
  const fade = await recorded(page);
  expect(fade.length).toBeGreaterThan(0);
  for (const a of fade) {
    expect(a.duration).toBeLessThanOrEqual(120);
    expect(a.props).toEqual(['opacity']);
  }
});

for (const size of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
]) {
  test(`Tag 10, ${size.width} × ${size.height}: jede Regel ist auf einer Seite vollständig sichtbar`, async ({ page }) => {
    await page.setViewportSize(size);
    await openAtDesk(page, 10);
    const single = size.width < 900;
    await expect(page.locator('.book-shell')).toHaveAttribute('data-mode', single ? 'single' : 'spread');
    const box = await page.locator('.book').boundingBox();
    expect(box!.width).toBeLessThanOrEqual(1120.5);
    expect(box!.height).toBeLessThanOrEqual(760.5);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
    // Tabs and bar stay inside the window.
    for (const sel of ['.register-tabs', '.book-bar']) {
      const b = (await page.locator(sel).boundingBox())!;
      expect(b.x + b.width, sel).toBeLessThanOrEqual(size.width + 0.5);
      expect(b.y + b.height, sel).toBeLessThanOrEqual(size.height + 0.5);
    }
    expect(await shownPages(page)).toHaveLength(single ? 1 : 2);

    await page.keyboard.press('Home');
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      for (const id of await fullyVisibleRules(page)) seen.add(id);
      expect(await cutBlocks(page)).toEqual([]);
      if (await key(page, 'codex-next').isDisabled()) break;
      await page.keyboard.press('ArrowRight');
    }
    expect([...seen].sort()).toEqual(rules.map((r) => r.id).sort());
  });
}

test('schmale Ansicht: Einzelseite, Blättern per Wischen und Seitenrand', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAtDesk(page, 6);
  await page.keyboard.press('Home');
  await expect(page.locator('.page.shown')).toHaveCount(1);
  const swipe = async (from: number, to: number) => {
    const vp = (await page.locator('.book-viewport').boundingBox())!;
    const y = vp.y + vp.height / 2;
    await page.locator('.book-viewport').dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 7, clientX: vp.x + from, clientY: y, isPrimary: true });
    await page.locator('.book-viewport').dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 7, clientX: vp.x + to, clientY: y + 4, isPrimary: true });
  };
  await page.evaluate(() => document.fonts.ready);
  const first = await shownPages(page);
  await swipe(300, 80);
  await expect.poll(() => shownPages(page)).not.toEqual(first);
  const second = await shownPages(page);
  await swipe(80, 300);
  await expect.poll(() => shownPages(page)).toEqual(first);
  await page.locator('.edge.next').click();
  await expect.poll(() => shownPages(page)).toEqual(second);
});

test('Spielstand ohne codex: lädt und öffnet auf der ersten Seite der heutigen Lieferung', async ({ page }) => {
  await startAtDay(page, 5, { effects: 'aus' });
  // The save was written without `codex` (startAtDay); loading gave it the defaults and saved again.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('taxes-please/save/v1')!));
  expect(stored.codex).toEqual({ lastRuleId: '', seenDay: 0 });
  expect(stored.day).toBe(5);
  await key(page, 'begin').click();
  await expect(page.locator('.codex-book .new-slip')).toHaveText('neu');
  await expect(page.locator('.codex-book .cover-stand')).toHaveText('Stand: Tag 5');
  await page.keyboard.press('k');
  await expect(page.locator('.page.shown .delivery-head[data-delivery="5"]')).toBeVisible();
  await expect(key(page, 'tab-5')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.page.shown.fresh')).not.toHaveCount(0);
  await expect(page.locator('.page.shown [data-rule="R16"] .rule-new')).toHaveText('neu');
  await expect(page.locator('.tab-new')).toHaveCount(0);

  // Elsewhere, closed: the slip is gone and the book reopens where it was left.
  await key(page, 'tab-2').click();
  const place = await shownPages(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.codex-book .new-slip')).toHaveCount(0);
  await page.keyboard.press('k');
  expect(await shownPages(page)).toEqual(place);
  await expect(key(page, 'tab-2')).toHaveAttribute('aria-current', 'page');
});

test('Kodex mit Screenreader-Struktur: Dialog, Seiten als Regionen, Griffregister', async ({ page }) => {
  await openAtDesk(page, 10);
  await expect(page.getByRole('dialog', { name: 'Kodex' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Lesezeichen' })).toBeVisible();
  await expect(page.getByRole('region', { name: /^Seite / })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Nächste Seite' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vorige Seite' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Kodex durchsuchen' })).toBeVisible();
  // Register with roman folios, then arabic ones; each line jumps to its rule.
  await page.keyboard.press('Home');
  await expect(page.locator('.page.shown .folio').first()).toHaveText('I');
  await key(page, 'toc-R28').click();
  expect(await fullyVisibleRules(page)).toContain('R28');
  await expect(page.locator('.page.shown [data-rule="R28"] .hint-label')).toContainText('Hinweis, ohne eigenen Fall');
  await expect(page.locator('.page.shown [data-rule="R28"] .rule-foot')).toContainText('vereinfacht');
  await expect(page.locator('.page.shown [data-rule="R28"] .rule-foot a')).toHaveAttribute('href', ruleById('R28').sourceUrl);
  await expect(page.locator('.page.shown [data-rule="R28"] .rule-title')).toBeFocused();
  // The ribbon lies on the page read last when that page is open.
  await page.keyboard.press('Escape');
  await page.keyboard.press('k');
  await expect(page.locator('.ribbon')).toHaveClass(/lying/);
});

test('Titel bleibt auf dem Buchdeckel, Kodex-Klassen stören den Stempelabdruck nicht', async ({ page }) => {
  await freshStart(page);
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  await page.evaluate(() => document.fonts.ready);
  const inside = await page.locator('.cover-title').evaluate((el) => {
    const frame = el.closest('.cover-frame')!.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    return text.left >= frame.left && text.right <= frame.right;
  });
  expect(inside).toBe(true);

  await key(page, 'stack').click();
  await key(page, 'pos-p1-anerkennen').click();
  await key(page, 'pos-p2-streichen').click();
  await key(page, 'stamp-bescheid').click();
  const imprint = page.locator('.stamp-imprint');
  await expect(imprint).toHaveClass(/hit/);
  const { w, paper } = await imprint.evaluate((el) => ({ w: (el as HTMLElement).offsetWidth, paper: el.parentElement!.clientWidth }));
  expect(w).toBeLessThan(paper / 2);
});

test('jede Lieferung beginnt auf eigener Seite, jeder Reiter springt zu seiner Lieferung und ist hervorgehoben', async ({ page }) => {
  await startAtDay(page, 10, { effects: 'aus' });
  await key(page, 'begin').click();
  await page.keyboard.press('k');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  // No page carries a delivery head below other blocks.
  const mixed = await page.locator('.book-strip .page-body').evaluateAll((bodies) =>
    bodies.filter((b) => [...b.children].some((c, i) => i > 0 && c.classList.contains('delivery-head'))).length,
  );
  expect(mixed).toBe(0);
  for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1]) {
    await key(page, `tab-${d}`).click();
    await expect(page.locator(`.book-strip .page.shown [data-delivery="${d}"]`)).toHaveCount(1);
    await expect(key(page, `tab-${d}`)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.tab[aria-current]')).toHaveCount(1);
  }
  await key(page, 'tab-register').click();
  await expect(key(page, 'tab-register')).toHaveAttribute('aria-current', 'page');
});
