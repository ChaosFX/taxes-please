import { fromCents } from '../core/amount';
import { correctAnswer } from '../core/evaluate';
import { formatEuro, romanNumeral } from '../core/format';
import { dayInfo, errorsOfDay, errorsPerDay, needsReprimand, resultsOfDay, type GameState } from '../core/game';
import { getAkte } from '../core/loader';
import { OFFEN } from '../core/schema';
import { isAmountDecision, type Akte, type Answer, type CaseError, type Content, type EDecision, type PositionVerdict, type Rule, type Stamp } from '../core/types';
import { h } from './dom';
import { amountText, choiceLabel, optionLabel, pairText, playerVerdictLabel, stampLabel, verdictLabel } from './labels';
import { newQuestionsOfDay } from '../core/board';
import { questionNotice, storyEvent } from './story';
import { t, textsReady } from './text';

export interface ScreenActions {
  newGame(): void;
  continueGame(): void;
  beginWork(): void;
  advanceDay(): void;
  toStart(): void;
  /** Opens the codex in reading mode at a rule (SPEC 5, Sprung in den Kodex). */
  readRule(ruleId: string): void;
}

// ---------- Errors in the summary: built from data only ----------

const decisionOf = (akte: Akte, id: string | undefined): EDecision | undefined =>
  akte.kind.type === 'entscheidungen' ? akte.kind.decisions.find((d) => d.id === id) : undefined;

/** „Subject: given → expected“ */
const detailLine = (subject: string, given: string | undefined, expected: string) =>
  h('li', {}, h('strong', {}, subject), t('evaluation.errorDetail', { given: given ?? t('evaluation.notGiven'), expected }));

/** „Text: detail“, for errors with their own text from the content. */
const noteLine = (text: string | undefined, detail: string) => h('li', {}, h('strong', {}, text ?? ''), t('evaluation.errorAbout', { detail }));

function errorLine(c: Content, akte: Akte, e: CaseError): HTMLElement {
  const kind = akte.kind;
  switch (e.kind) {
    case 'unnoetige-verzoegerung':
      return h('li', {}, c.texts.unnecessaryDelay);
    case 'stempel-falsch':
      return detailLine(t('evaluation.errorStamp'), e.given ? stampLabel(c, e.given as Stamp) : undefined, stampLabel(c, e.expected as Stamp));
    case 'option-falsch':
    case 'option-fehlt':
      return detailLine(kind.type === 'steuerpflicht' ? kind.decision.question : '', e.given ? optionLabel(c, e.given) : undefined, optionLabel(c, e.expected!));
    case 'position-falsch':
    case 'position-offen-entschieden':
    case 'position-nicht-entschieden': {
      const pos = kind.type === 'werbungskosten' ? kind.positions.find((p) => p.id === e.positionId) : undefined;
      return detailLine(pos?.label ?? e.positionId ?? '', e.given ? playerVerdictLabel(e.given) : undefined, verdictLabel(c, e.expected as PositionVerdict));
    }
    case 'entscheidung-falsch':
    case 'entscheidung-offen-entschieden':
    case 'entscheidung-fehlt': {
      const d = decisionOf(akte, e.decisionId);
      if (!d || isAmountDecision(d)) return detailLine(e.decisionId ?? '', e.given, e.expected ?? '');
      return detailLine(d.label, e.given ? choiceLabel(c, d, e.given) : undefined, choiceLabel(c, d, e.expected!));
    }
    case 'betrag-falsch':
    case 'betrag-fehlt':
      return detailLine(decisionOf(akte, e.decisionId)?.label ?? '', e.given !== undefined ? amountText(e.given) : undefined, formatEuro(fromCents(e.expectedCents!)));
    case 'widerspruch-fehlt': {
      const w = kind.type === 'entscheidungen' ? kind.discrepancies.find((x) => x.id === e.discrepancyId) : undefined;
      return noteLine(c.texts.missedDiscrepancy, w ? pairText(w) : (e.discrepancyId ?? ''));
    }
    case 'widerspruch-falsch':
      return noteLine(c.texts.falseDiscrepancy, pairText(e.mark!));
    case 'nachfrage-falsch': {
      const q = kind.type === 'entscheidungen' ? kind.inquiry?.options.find((o) => o.id === e.given) : undefined;
      return noteLine(c.texts.wrongInquiry, q?.label ?? e.given ?? '');
    }
  }
}

// ---------- Start ----------

export function startView(content: Content, canContinue: boolean, a: ScreenActions): HTMLElement {
  return h(
    'main',
    { class: 'screen start sheet' },
    h('h1', {}, t('title.heading')),
    h('p', { class: 'subtitle' }, t('title.year', { year: content.meta.veranlagungsjahr })),
    h('div', { class: 'disclaimer', role: 'note' }, h('p', {}, content.meta.hinweis)),
    h(
      'div',
      { class: 'buttons' },
      h('button', { class: 'primary', 'data-key': 'new-game', onclick: a.newGame }, t('title.newGame')),
      h('button', { 'data-key': 'continue', disabled: !canContinue, onclick: a.continueGame }, t('title.continue')),
    ),
  );
}

// ---------- Day intro ----------

export function introView(content: Content, state: GameState, a: ScreenActions): HTMLElement {
  const d = dayInfo(content, state.day);
  return h(
    'main',
    { class: 'screen intro' },
    h(
      'section',
      { class: 'day-card sheet' },
      h('h1', {}, t('intro.day', { day: d.day })),
      h('p', {}, d.intro),
      d.storyEvents.map(storyEvent),
      // New questions on the pinboard come after the story events (SPEC 4.9).
      state.tools.includes('pinboard') ? newQuestionsOfDay(content, d.day).map(questionNotice) : null,
      h('button', { class: 'primary', 'data-key': 'begin', onclick: a.beginWork }, t('intro.begin')),
    ),
  );
}

// ---------- Summary ----------

/** A rule in the summary: its id opens the reading mode at it (SPEC 5); `at` keeps the key unique per result. */
function ruleRef(rule: Rule, at: string, a: ScreenActions): HTMLElement {
  return h(
    'li',
    {},
    h('button', { class: 'rule-jump', 'data-key': `rule-${at}-${rule.id}`, 'aria-label': t('evaluation.ruleJump', { id: rule.id }), onclick: () => a.readRule(rule.id) }, rule.id),
    h('strong', {}, rule.title),
    t('evaluation.ruleSeparator'),
    h('a', { href: rule.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, rule.source),
  );
}

function solution(content: Content, akte: Akte, answer: Answer, a: ScreenActions): HTMLElement {
  let n = 0;
  const rules = (ids: string[]) => h('ul', { class: 'rule-refs' }, ids.map((id) => ruleRef(content.rules.find((r) => r.id === id)!, `${akte.id}-${n++}`, a)));
  const stamp = h('p', {}, h('strong', {}, t('evaluation.correctStamp')), stampLabel(content, correctAnswer(akte).stamp!));
  const item = (heading: string, value: string, explanation: string, ruleIds: string[], ...extra: (HTMLElement | null)[]) =>
    h('div', { class: 'solution-item' }, h('p', {}, h('strong', {}, heading), value), ...extra, h('p', { class: 'explanation' }, explanation), rules(ruleIds));
  const kind = akte.kind;

  if (kind.type === 'werbungskosten') {
    return h(
      'div',
      { class: 'solution' },
      kind.positions.map((p) =>
        item(t('evaluation.positionHeading', { label: p.label, amount: formatEuro(p.amount) }), verdictLabel(content, p.correct), p.explanation, p.rules),
      ),
      stamp,
    );
  }
  if (kind.type === 'steuerpflicht') {
    const d = kind.decision;
    return h('div', { class: 'solution' }, item(t('evaluation.questionHeading', { question: d.question }), optionLabel(content, d.correct), d.explanation, d.rules), stamp);
  }

  const q = kind.inquiry;
  const chosen = q?.options.find((o) => o.id === answer.inquiry);
  return h(
    'div',
    { class: 'solution' },
    kind.decisions.map((d) => {
      const heading = d.amount !== undefined ? t('evaluation.positionHeading', { label: d.label, amount: formatEuro(d.amount) }) : t('evaluation.questionHeading', { question: d.label });
      if (isAmountDecision(d)) {
        return item(heading, formatEuro(d.correct), d.explanation, d.rules, h('p', { class: 'given' }, t('evaluation.amountGiven', { given: amountText(answer.amounts?.[d.id]) })));
      }
      return item(heading, d.correct === OFFEN ? verdictLabel(content, OFFEN) : choiceLabel(content, d, d.correct), d.explanation, d.rules);
    }),
    kind.discrepancies.length
      ? h(
          'div',
          { class: 'solution-item discrepancies' },
          h('p', {}, h('strong', {}, t('evaluation.discrepancyHeading'))),
          h('ul', {}, kind.discrepancies.map((w) => h('li', {}, pairText(w), h('p', { class: 'explanation' }, w.explanation)))),
        )
      : null,
    q
      ? h(
          'div',
          { class: 'solution-item inquiry-solution' },
          h('p', {}, t('evaluation.inquiryGiven', { given: chosen?.label ?? t('evaluation.notGiven') })),
          chosen ? h('p', { class: 'explanation' }, t('evaluation.inquiryAnswer', { answer: chosen.answer })) : null,
          h('p', {}, t('evaluation.inquiryCorrect', { correct: q.options.find((o) => o.id === q.correct)!.label })),
        )
      : null,
    stamp,
  );
}

export function summaryView(content: Content, state: GameState, a: ScreenActions): HTMLElement {
  const results = resultsOfDay(state, state.day);
  const total = errorsOfDay(state, state.day);
  return h(
    'main',
    { class: 'screen summary sheet' },
    h('h1', {}, t('evaluation.heading', { day: state.day })),
    h('p', { class: 'total', 'data-testid': 'errors-total' }, total === 0 ? t('evaluation.noErrors') : t('evaluation.errorsToday', { count: total })),
    needsReprimand(content, state, state.day)
      ? h(
          'figure',
          { class: 'dialog reprimand' },
          h('figcaption', {}, t('evaluation.speaker', { from: content.texts.warning.from })),
          h('blockquote', {}, content.texts.warning.text),
        )
      : null,
    results.length === 0 ? h('p', { class: 'empty-day', 'data-testid': 'empty-day' }, content.texts.emptyDay) : null,
    results.map((r) => {
      const akte = getAkte(content, r.akteId);
      const ok = r.errors.length === 0;
      return h(
        'section',
        { class: `result ${ok ? 'ok' : 'wrong'}`, 'data-akte': r.akteId },
        h(
          'h2',
          {},
          h('span', { class: 'mark', 'aria-hidden': 'true' }, ok ? t('evaluation.markOk') : t('evaluation.markWrong')),
          ' ' +
            t('evaluation.result', {
              name: akte.isFollowUp ? t('evaluation.followUpName', { name: akte.taxpayer.name }) : akte.taxpayer.name,
              verdict: ok ? t('evaluation.correct') : t('evaluation.wrong'),
            }),
        ),
        ok ? null : h('ul', { class: 'errors' }, r.errors.map((e) => errorLine(content, akte, e))),
        h('details', { open: !ok }, h('summary', {}, t('evaluation.solution')), solution(content, akte, r.answer, a)),
      );
    }),
    h('button', { class: 'primary', 'data-key': 'advance', onclick: a.advanceDay }, t('evaluation.closeDay')),
  );
}

// ---------- End of an act ----------

export function actEndView(content: Content, state: GameState, a: ScreenActions): HTMLElement {
  const perDay = errorsPerDay(content, state);
  return h(
    'main',
    { class: 'screen finished sheet' },
    h('h1', {}, t('end.heading', { act: romanNumeral(state.act ?? content.meta.akt) })),
    h(
      'table',
      { class: 'overview' },
      h('thead', {}, h('tr', {}, h('th', {}, t('end.colDay')), h('th', {}, t('end.colErrors')))),
      h(
        'tbody',
        {},
        Object.entries(perDay).map(([d, n]) => h('tr', {}, h('td', {}, d), h('td', {}, n))),
      ),
    ),
    h('button', { class: 'primary', 'data-key': 'to-start', onclick: a.toStart }, t('end.toStart')),
  );
}

/** Shown when content or ui.json is broken; without valid ui.json there is no heading, only the diagnosis. */
export function errorView(message: string): HTMLElement {
  return h('main', { class: 'screen error' }, textsReady() ? h('h1', {}, t('error.heading')) : null, h('pre', {}, message));
}
