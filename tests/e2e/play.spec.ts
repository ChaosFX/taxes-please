import { expect, test, type Page } from '@playwright/test';
import { drawUntil, enter, fileAkte, freshStart, inboxCount, key, longTest, markKey, openAkte, playDay, pullOut, raw, solutionFor, solveNext, stampAkte, startAtDay, zoomNewspaper } from './helpers';

const FOLLOW_UP_DAYS: Record<number, string> = { 4: '3-4/folge', 5: '4-1/folge', 6: '5-3/folge', 7: '6-3/folge', 8: '7-3/folge', 10: '9-2/folge' };
const eventsOf = (day: number): { type: string; feature?: string }[] => raw.days.find((d: { day: number }) => d.day === day).storyEvents;

/**
 * Akt I all the way through (SPEC 11): once with the mouse by dragging (Akte onto the
 * pad, papers out of the pocket, Akte into the outbox), once with the keyboard only.
 */
for (const way of ['drag', 'keys'] as const) {
test(`Akt I richtig durchspielen (${way === 'drag' ? 'Maus mit Ziehen' : 'nur Tastatur'}) mit Neuladen: null Fehler an allen zehn Tagen, dann „Ende von Akt I“`, async ({ page }) => {
  longTest(300_000);
  await freshStart(page);
  await key(page, 'new-game').click();
  for (let day = 1; day <= 10; day++) {
    await expect(page.locator('.day-card h1')).toHaveText(`Tag ${day}`);
    // Story events of the day appear as in the JSON.
    const events = eventsOf(day);
    await expect(page.locator('.day-card .newspaper')).toHaveCount(events.filter((e) => e.type === 'newspaper').length);
    await expect(page.locator('.day-card .call')).toHaveCount(events.filter((e) => e.type === 'call').length);
    await expect(page.locator('.day-card .calculator-unlock')).toHaveCount(events.some((e) => e.type === 'unlock' && e.feature === 'calculator') ? 1 : 0);

    await playDay(page, { reloadAfter: day % 3 === 0 ? 2 : undefined, way });
    await expect(page.getByTestId('errors-total')).toHaveText('Keine Fehler.');
    await expect(page.locator('.result')).toHaveCount(raw.days[day - 1].cases.length + (FOLLOW_UP_DAYS[day] ? 1 : 0));
    if (FOLLOW_UP_DAYS[day]) await expect(page.locator('.result').first()).toHaveAttribute('data-akte', FOLLOW_UP_DAYS[day]!);
    await key(page, 'advance').click();
  }
  await expect(page.locator('.screen.finished h1')).toHaveText('Ende von Akt I');
  const rows = page.locator('.overview tbody tr');
  await expect(rows).toHaveCount(10);
  for (let i = 0; i < 10; i++) await expect(rows.nth(i)).toHaveText(`${i + 1}0`);
  // The game stays there, also after a reload.
  await page.reload();
  await key(page, 'continue').click();
  await expect(page.locator('.screen.finished h1')).toHaveText('Ende von Akt I');
});
}

/** Plays the day starting at `day`, `wrong` for one Akte; returns the error lines of that Akte. */
async function oneWrong(page: Page, day: number, akteId: string, wrong: (s: ReturnType<typeof solutionFor>) => ReturnType<typeof solutionFor>) {
  await startAtDay(page, day);
  await playDay(page, { answer: (id) => (id === akteId ? wrong(solutionFor(id)) : solutionFor(id)) });
  await expect(page.getByTestId('errors-total')).toHaveText('Fehler heute: 1');
  return page.locator(`.result[data-akte="${akteId}"] .errors li`);
}

test('falscher Betrag: genau ein Fehler mit eingegebenem und richtigem Betrag', async ({ page }) => {
  const errs = await oneWrong(page, 8, '8-1', (s) => ({ ...s, amounts: { ...s.amounts, d1: '301' } }));
  await expect(errs).toHaveText(['Kamera: Absetzung 2025: 301,00 € → 300,00 €']);
  const result = page.locator('.result[data-akte="8-1"]');
  await expect(result.locator('.given').first()).toHaveText('Ihr Betrag: 301,00 €');
});

test('vergessene Markierung: genau ein Fehler „Widerspruch nicht benannt“', async ({ page }) => {
  const errs = await oneWrong(page, 5, '5-3', (s) => ({ ...s, marks: [] }));
  await expect(errs).toHaveText(['Widerspruch nicht benannt: Eintrittskarte Gastro-Messe Wien: Gültig ↔ Hotelrechnung Wien: Aufenthalt']);
  await expect(page.locator('.result[data-akte="5-3"] .discrepancies')).toContainText('Zwei Daten für dieselbe Reise.');
});

test('falsche Nachfrage: genau ein Fehler, die Folgeakte kommt trotzdem', async ({ page }) => {
  const errs = await oneWrong(page, 6, '6-3', (s) => ({ ...s, inquiry: 'q2' }));
  await expect(errs).toHaveText(['Diese Frage klärt den offenen Punkt nicht.: Wie wurde die Küchenmaschine bezahlt?']);
  const result = page.locator('.result[data-akte="6-3"]');
  await expect(result).toContainText('Ihre Frage: Wie wurde die Küchenmaschine bezahlt?');
  await expect(result).toContainText('Richtige Frage: Wo steht die Küchenmaschine und wofür wird sie genutzt?');
  await key(page, 'advance').click();
  await key(page, 'begin').click();
  await openAkte(page);
  await expect(page.locator('.pruefvermerk')).toHaveAttribute('data-akte', '6-3/folge');
});

test('Bescheid statt Ergänzungsersuchen: keine Folgeakte am nächsten Tag', async ({ page }) => {
  await startAtDay(page, 5);
  await playDay(page, { answer: (id) => (id === '5-3' ? { ...solutionFor(id), stamp: 'bescheid', marks: [] } : solutionFor(id)) });
  await expect(page.getByTestId('errors-total')).toHaveText('Fehler heute: 1');
  await key(page, 'advance').click();
  await key(page, 'begin').click();
  await openAkte(page);
  await expect(page.locator('.pruefvermerk')).toHaveAttribute('data-akte', '6-1');
});

test('Markierungen: auf Papier und im Prüfvermerk, aufheben, nur zwischen zwei Papieren', async ({ page }) => {
  await startAtDay(page, 5);
  await drawUntil(page, '5-3');
  const w = solutionFor('5-3').marks[0]!;
  // Papers in the pocket cannot be marked: lines become buttons only on papers taken out (SPEC 4).
  await key(page, 'mark-mode').click();
  await expect(page.locator('.mark-line')).toHaveCount(0);
  await key(page, 'mark-mode').click();
  for (let i = 0; i < 6; i++) await pullOut(page, i);
  await key(page, 'mark-mode').click();
  await expect(key(page, 'mark-mode')).toHaveAttribute('aria-pressed', 'true');
  // Two lines in the same paper make no pair: the second choice replaces the first.
  await key(page, 'mark-0-0').press('Enter');
  await key(page, 'mark-0-1').press('Enter');
  await expect(key(page, 'mark-0-1')).toHaveAttribute('aria-pressed', 'true');
  await expect(key(page, 'mark-0-0')).toHaveAttribute('aria-pressed', 'false');
  await key(page, 'mark-0-1').press('Enter');
  await expect(page.locator('.mark-list li')).toHaveCount(0);

  await key(page, markKey('5-3', w.a)).press('Enter');
  await key(page, markKey('5-3', w.b)).press('Enter');
  await expect(page.locator('.mark-count')).toHaveText('Markierte Widersprüche: 1');
  await expect(page.locator('.mark-list li .mark-pair')).toHaveText('Eintrittskarte Gastro-Messe Wien: Gültig ↔ Hotelrechnung Wien: Aufenthalt');
  await expect(page.locator('.paper.doc tr.marked')).toHaveCount(2);
  await expect(page.locator('.paper.doc tr.marked .mark-no')).toHaveText(['1', '1']);
  await key(page, 'mark-remove-0').click();
  await expect(page.locator('.paper.doc tr.marked')).toHaveCount(0);
  await key(page, markKey('5-3', w.a)).press('Enter');
  await key(page, markKey('5-3', w.b)).press('Enter');
  await key(page, 'mark-clear').click();
  await expect(page.locator('.mark-list')).toHaveCount(0);
  // Mode off: marks stay visible, lines are no buttons any more.
  await key(page, markKey('5-3', w.a)).press('Enter');
  await key(page, markKey('5-3', w.b)).press('Enter');
  await key(page, 'mark-mode').click();
  await expect(page.locator('.mark-line')).toHaveCount(0);
  await expect(page.locator('.paper.doc tr.marked')).toHaveCount(2);
  // Mark mode is there for every Akte, also without contradictions.
  await enter(page, '5-3', { ...solutionFor('5-3'), marks: [] });
  await openAkte(page);
  await expect(key(page, 'mark-mode')).toBeEnabled();
});

test('Markieren und Nachfrage mit der Tastatur', async ({ page }) => {
  await startAtDay(page, 9);
  await drawUntil(page, '9-2');
  const s = solutionFor('9-2');
  /** Tabs to the element with data-key and presses `k`. Fails if unreachable. */
  const press = async (dataKey: string, k = 'Enter') => {
    for (let i = 0; i < 120; i++) {
      if ((await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.key)) === dataKey) {
        await page.keyboard.press(k);
        return;
      }
      await page.keyboard.press('Tab');
    }
    throw new Error(`${dataKey} nicht per Tastatur erreichbar`);
  };
  // Take the two papers out with Enter in the pocket.
  const docs = (await import('./helpers')).documentsOf('9-2');
  for (const r of [s.marks[0]!.a, s.marks[0]!.b]) await press(`paper-${docs.findIndex((d) => d.title === r.document)}`);
  await key(page, 'pruefvermerk').focus();
  for (const [d, v] of Object.entries(s.decisions)) await press(`dec-${d}-${v}`);
  await press('mark-mode');
  await press(markKey('9-2', s.marks[0]!.a), ' ');
  await press(markKey('9-2', s.marks[0]!.b));
  await expect(page.locator('.mark-list li')).toHaveCount(1);
  await press('stamp-ergaenzung');
  // Taken: the choice of questions opens before the stamp and has focus.
  await expect(page.locator('.desk-message')).toHaveText('Stempel aufgenommen. Aufs Stempelfeld drücken, Escape legt ihn zurück.');
  await expect(page.locator('.inquiry')).toBeVisible();
  await expect(key(page, 'inq-q1')).toBeFocused();
  // Enter before a question is chosen does not stamp.
  await key(page, 'stamp-ergaenzung').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.stamp-imprint')).toHaveCount(0);
  await expect(key(page, 'inq-q1')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(key(page, 'inq-q1')).toHaveAttribute('aria-pressed', 'true');
  await expect(key(page, 'stamp-field')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.stamp-imprint')).toBeVisible();
  await expect(key(page, 'close-akte')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(key(page, 'folder-outbox')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(key(page, 'stack')).toBeFocused();
  while (await page.locator('.screen.desk').isVisible()) await solveNext(page);
  await expect(page.getByTestId('errors-total')).toHaveText('Keine Fehler.');
});

test('Nachfrage: Auswahl beim Aufnehmen, das Stempelfeld nimmt erst nach der Wahl an, Zurücklegen schließt sie', async ({ page }) => {
  await startAtDay(page, 6);
  await drawUntil(page, '6-3');
  // Not stamped yet: the outbox refuses the folder.
  await key(page, 'close-akte').click();
  await key(page, 'folder-outbox').click();
  await expect(page.locator('.desk-message')).toHaveText('Erst stempeln, dann ablegen.');
  await key(page, 'folder').click();
  await key(page, 'stamp-ergaenzung').click();
  await expect(key(page, 'stamp-ergaenzung')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.inquiry h3')).toHaveText('Nachfrage');
  await expect(page.locator('.inquiry-prompt')).toHaveText('Was wollen Sie klären?');
  await expect(page.locator('.inquiry .option')).toHaveCount(3);
  // The stamp field does not take the stamp before a question is chosen.
  await key(page, 'stamp-field').click();
  await expect(page.locator('.stamp-imprint')).toHaveCount(0);
  await expect(key(page, 'stamp-ergaenzung')).toHaveAttribute('aria-pressed', 'true');
  // A second click on the holder puts it back; the choice closes.
  await key(page, 'stamp-ergaenzung').click();
  await expect(page.locator('.inquiry')).toHaveCount(0);
  await expect(key(page, 'stamp-ergaenzung')).toHaveAttribute('aria-pressed', 'false');
  // Escape, a right click and a click beside the stamp field put it back as well.
  for (const back of [() => page.keyboard.press('Escape'), () => page.locator('.pocket').click({ button: 'right' }), () => page.locator('.pocket').click()]) {
    await key(page, 'stamp-ergaenzung').click();
    await expect(page.locator('.inquiry')).toBeVisible();
    await back();
    await expect(page.locator('.inquiry')).toHaveCount(0);
    await expect(page.locator('.stage')).not.toHaveClass(/carrying/);
  }
  // While carried, nothing can be dragged.
  await key(page, 'stamp-ergaenzung').click();
  const bar = (await page.locator('.folder-bar').boundingBox())!;
  await page.mouse.move(bar.x + 100, bar.y + 10);
  await page.mouse.down();
  await page.mouse.move(bar.x + 300, bar.y + 200, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('.folder.open')).toBeVisible();
  expect(Math.abs((await page.locator('.folder-bar').boundingBox())!.x - bar.x)).toBeLessThan(2);
  await stampAkte(page, 'ergaenzung', 'q1');
  await expect(page.locator('.stamp-imprint')).toHaveText('Ergänzungsersuchen');
  await expect(page.locator('.inquiry')).toHaveCount(0);
});

test('Betragsfeld: verschiedene Schreibweisen, Format nach dem Verlassen', async ({ page }) => {
  await startAtDay(page, 9);
  await drawUntil(page, '9-5');
  const field = key(page, 'amt-d3');
  for (const typed of ['4236,7', '4.236,70', '4236.70', '4 236,70']) {
    await field.fill(typed);
    await field.blur();
    await expect(field).toHaveValue('4.236,70 €');
    await expect(field).not.toHaveAttribute('aria-invalid', 'true');
  }
  await field.fill('viel');
  await field.blur();
  await expect(field).toHaveValue('viel');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  // An open Akte without stamp is not kept: after a reload it lies on top of the inbox again, empty (SPEC 9).
  await field.fill('4236,7');
  await page.reload();
  await key(page, 'continue').click();
  await expect(page.locator('.folder.open')).toHaveCount(0);
  await expect(key(page, 'stack')).toHaveAttribute('aria-label', /^Akte 9-5,/);
  await openAkte(page);
  await expect(key(page, 'amt-d3')).toHaveValue('');
});

test('Morgenzeitung und Anruf an den Tagen laut JSON, Zeitung liegt am Tisch', async ({ page }) => {
  await startAtDay(page, 4);
  await expect(page.locator('.day-card .newspaper .masthead')).toHaveText('Donau-Kurier');
  await expect(page.locator('.day-card .call')).toHaveCount(0);
  await key(page, 'begin').click();
  const paper = page.locator('.stage .paper.newspaper');
  await expect(paper).toHaveCount(1);
  await expect(paper).toHaveAttribute('aria-roledescription', 'Morgenzeitung');
  await zoomNewspaper(page, paper);
  await expect(page.locator('dialog.zoom .newspaper')).toBeVisible();
  await page.keyboard.press('Escape');
  // Still there with an Akte on the desk.
  await openAkte(page);
  await expect(paper).toHaveCount(1);

  await startAtDay(page, 9);
  await expect(page.locator('.day-card .call figcaption')).toHaveText('Anruf von Dr. Wallner:'.replace(':', ''));
  await expect(page.locator('.day-card .call blockquote')).toContainText('ab heute rechnen Sie die Steuer selbst aus');
});

test('Tischrechner ab Tag 8: Maus und Tastatur, Fehler bei Division durch null', async ({ page }) => {
  await startAtDay(page, 7);
  await key(page, 'begin').click();
  await expect(page.locator('.calculator')).toHaveCount(0);
  await expect(key(page, 'calc-tool')).toHaveCount(0);

  await startAtDay(page, 8);
  await expect(page.locator('.day-card .calculator-unlock')).toHaveText('Neben dem Kodex steht ab heute ein Tischrechner.');
  await key(page, 'begin').click();
  // In the rail, closed; a click lays it open on the pad (SPEC 7.4).
  await expect(page.locator('.calculator')).toHaveCount(0);
  await key(page, 'calc-tool').click();
  const display = page.locator('.calc-display');
  await expect(display).toHaveText('0');
  for (const k of ['1', '8', 'comma', '5', 'mul', '4', 'eq']) await key(page, `calc-${k}`).click();
  await expect(display).toHaveText('74');
  await key(page, 'calc').focus();
  await page.keyboard.type('9000/8');
  await page.keyboard.press('Enter');
  await expect(display).toHaveText('1.125');
  await page.keyboard.type('5/0=');
  await expect(display).toHaveText('Fehler');
  await page.keyboard.press('Escape');
  await expect(display).toHaveText('0');
  // Nothing is carried into the Prüfvermerk.
  await solveNext(page); // 7-3/folge
  await openAkte(page);
  await expect(page.locator('.pruefvermerk')).toHaveAttribute('data-akte', '8-1');
  await key(page, 'calc').focus();
  await page.keyboard.type('300=');
  await expect(display).toHaveText('300');
  await expect(key(page, 'amt-d1')).toHaveValue('');
});

test('Ermahnung ab drei Fehlern, Auswertung zeigt Lösung und Fundstelle', async ({ page }) => {
  await freshStart(page);
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  const flip = (id: string) => {
    const s = solutionFor(id);
    const positions = Object.fromEntries(Object.entries(s.positions).map(([k, v]) => [k, v === 'anerkennen' ? 'streichen' : 'anerkennen']));
    return { ...s, positions };
  };
  while (await page.locator('.screen.desk').isVisible()) await solveNext(page, flip);
  await expect(page.getByTestId('errors-total')).toHaveText('Fehler heute: 6');
  await expect(page.locator('.reprimand figcaption')).toHaveText('Dr. Wallner:');
  await expect(page.locator('.reprimand blockquote')).toHaveText(/^Drei Fehler an einem Tag\./);
  await expect(page.locator('.result[data-akte="1-1"] .errors li').first()).toHaveText('Fachbuch Bilanzierung: streichen → anerkennen');
  const first = page.locator('.result[data-akte="1-1"]');
  await expect(first).toContainText('falsch');
  await expect(first.locator('.explanation').first()).toContainText('Fachbuch');
  await expect(first.locator('.rule-refs a').first()).toHaveText('§ 16 Abs. 1 erster Satz EStG');
});

test('eine Akte vollständig mit der Tastatur', async ({ page }) => {
  await freshStart(page);
  /** Tabs to the element with data-key and presses Enter. Fails if unreachable. */
  const press = async (k: string) => {
    for (let i = 0; i < 80; i++) {
      if ((await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.key)) === k) {
        await page.keyboard.press('Enter');
        return;
      }
      await page.keyboard.press('Tab');
    }
    throw new Error(`${k} nicht per Tastatur erreichbar`);
  };
  await press('new-game');
  await press('begin');
  await press('stack');
  // Focus goes to the Prüfvermerk of the open folder.
  await expect(key(page, 'pruefvermerk')).toBeFocused();
  const s = solutionFor('1-1');
  for (const [pid, v] of Object.entries(s.positions)) await press(`pos-${pid}-${v}`);
  // Tab to the stamp, Enter takes it, Enter presses it.
  await press('stamp-bescheid');
  await expect(key(page, 'stamp-field')).toHaveClass(/ready/);
  await page.keyboard.press('Enter');
  await expect(page.locator('.stamp-imprint')).toBeVisible();
  await expect(key(page, 'close-akte')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(key(page, 'folder-outbox')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(inboxCount(page)).toHaveText('Eingang (2)');
  await expect(key(page, 'stack')).toBeFocused();
  await press('stack');
  await press('pos-p1-anerkennen');
  await expect(key(page, 'pos-p1-anerkennen')).toHaveAttribute('aria-pressed', 'true');
});

test('Neues Spiel fragt vor dem Überschreiben', async ({ page }) => {
  await freshStart(page);
  await key(page, 'new-game').click();
  await key(page, 'begin').click();
  await page.reload();
  await expect(key(page, 'continue')).toBeEnabled();
  let asked = false;
  page.once('dialog', (d) => {
    asked = true;
    void d.dismiss();
  });
  await key(page, 'new-game').click();
  expect(asked).toBe(true);
  await expect(page.locator('.screen.start')).toBeVisible();
});

test('Spielstand vom Ende des Prototyps (0.2) geht mit Tag 4 weiter', async ({ page }) => {
  await page.goto('./');
  // Days 1 to 3 played, 3-4 sent back, prototype end screen on day 4.
  const results = raw.days
    .filter((d: { day: number }) => d.day <= 3)
    .flatMap((d: { day: number; cases: string[] }) => d.cases.map((id) => ({ akteId: id, day: d.day, answer: { positions: solutionFor(id).positions, option: solutionFor(id).option, stamp: solutionFor(id).stamp }, errors: [] })));
  const old = { version: 1, day: 4, phase: 'finished', queue: [], current: null, results: [...results, { akteId: '3-4/folge', day: 4, answer: { positions: {}, stamp: 'bescheid' }, errors: [] }], pendingFollowUps: [], settings: { effects: 'voll', volume: 0.7, music: 0.5 } };
  await page.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem('taxes-please/save/v1', JSON.stringify(s));
  }, old);
  await page.reload();
  await key(page, 'continue').click();
  await expect(page.locator('.day-card h1')).toHaveText('Tag 4');
  await key(page, 'begin').click();
  await expect(inboxCount(page)).toHaveText('Eingang (6)');
  await openAkte(page);
  await expect(page.locator('.pruefvermerk')).toHaveAttribute('data-akte', '3-4/folge');
});
