import { fromCents, parseAmount } from '../core/amount';
import type { CalcKey, CalcState } from '../core/calculator';
import { formatEuro } from '../core/format';
import { dayInfo, type GameState } from '../core/game';
import { getAkte, optionValue } from '../core/loader';
import {
  isAmountDecision,
  type Akte,
  type Answer,
  type Content,
  type Document,
  type EDecision,
  type Mark,
  type PlayerVerdict,
  type Stamp,
  type StoryEvent,
} from '../core/types';
import { renderCalculator } from './calculator';
import { closedBook } from './codex';
import { h } from './dom';
import { akteHeading, choiceLabel, optionLabel, pairText, playerVerdictLabel, stampLabel } from './labels';
import { newspaperSheet } from './story';
import { t } from './text';

export interface DeskActions {
  drawNext(): void;
  decide(positionId: string, verdict: PlayerVerdict | undefined): void;
  choose(option: string | undefined): void;
  decideE(decisionId: string, value: string | undefined): void;
  /** Stores a typed amount without re-rendering, so typing keeps focus and caret. */
  amount(decisionId: string, raw: string): void;
  stamp(stamp: Stamp): void;
  inquiry(questionId: string): void;
  toggleMarkMode(): void;
  markLine(doc: number, line: string): void;
  removeMark(index: number): void;
  clearMarks(): void;
  calc(key: CalcKey): void;
  file(): void;
  openCodex(): void;
}

/** Desk state that lives only in the interface; reset when a new Akte lands on the desk. */
export interface DeskUi {
  akteId: string | null;
  markMode: boolean;
  /** First line chosen in mark mode, waiting for its partner in another paper. */
  pending: { doc: number; line: string } | null;
  inquiryOpen: boolean;
  calc: CalcState;
}

/** Called for each paper after creation, e.g. to make it draggable. */
export type PaperHook = (el: HTMLElement, key: string, rotationSeed: string) => void;

const lineMatches = (m: Mark, title: string, line: string) =>
  (m.a.document === title && m.a.line === line) || (m.b.document === title && m.b.line === line);

/** Shown amount: formatted once readable, else as typed. */
const amountValue = (raw: string | undefined) => {
  if (raw === undefined) return '';
  const cents = parseAmount(raw);
  return cents === null ? raw : formatEuro(fromCents(cents));
};

function paper(doc: Document, docIndex: number, akte: Akte, answer: Answer, ui: DeskUi, a: DeskActions, hook: PaperHook): HTMLElement {
  const key = `paper-${docIndex}`;
  const marks = answer.marks ?? [];
  const markable = ui.markMode && answer.stamp === undefined;
  const el = h(
    'article',
    {
      class: `paper doc ${doc.kind}${doc.stamp ? ' has-stamp' : ''}`,
      tabindex: 0,
      'data-key': key,
      'aria-label': doc.title,
      'aria-roledescription': t('aria.paper'),
    },
    h('h3', {}, doc.title),
    h(
      'table',
      {},
      h(
        'tbody',
        {},
        doc.lines.map(([label, value], lineIndex) => {
          const numbers = marks.flatMap((m, i) => (lineMatches(m, doc.title, label) ? [i + 1] : []));
          const selected = ui.pending?.doc === docIndex && ui.pending.line === label;
          const head = markable
            ? h(
                'button',
                {
                  class: 'mark-line',
                  'data-key': `mark-${docIndex}-${lineIndex}`,
                  'aria-pressed': String(selected),
                  'aria-label': t('aria.markableLine', { label }),
                  onclick: () => a.markLine(docIndex, label),
                },
                label,
              )
            : label;
          return h(
            'tr',
            { class: numbers.length || selected ? `marked${selected ? ' selected' : ''}` : null },
            h('th', { scope: 'row' }, head, numbers.map((n) => h('span', { class: 'mark-no' }, n))),
            h('td', {}, value),
          );
        }),
      ),
    ),
    doc.stamp ? h('div', { class: 'office-stamp', 'aria-label': t('aria.officeStamp', { stamp: doc.stamp }) }, doc.stamp) : null,
  );
  hook(el, key, `${akte.id}#${docIndex}`);
  return el;
}

function decisionRow(content: Content, d: EDecision, answer: Answer, locked: boolean, a: DeskActions): HTMLElement {
  let controls: HTMLElement;
  if (isAmountDecision(d)) {
    const raw = answer.amounts?.[d.id];
    const input = h('input', {
      type: 'text',
      inputmode: 'decimal',
      autocomplete: 'off',
      class: 'amount-input',
      'data-key': `amt-${d.id}`,
      'aria-label': t('aria.amountInput', { label: d.label }),
      title: t('desk.amountLabel'),
      placeholder: t('desk.amountPlaceholder'),
      value: amountValue(raw),
      'aria-invalid': raw !== undefined && parseAmount(raw) === null ? 'true' : null,
      disabled: locked,
    });
    input.addEventListener('input', () => a.amount(d.id, input.value));
    const tidy = () => {
      const cents = parseAmount(input.value);
      if (cents !== null) input.value = formatEuro(fromCents(cents));
      if (input.value.trim() !== '' && cents === null) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    };
    input.addEventListener('blur', tidy);
    input.addEventListener('keydown', (e) => e.key === 'Enter' && tidy());
    controls = h('div', { class: 'controls' }, input);
  } else {
    const given = answer.decisions?.[d.id];
    controls = h(
      'div',
      { class: 'controls verdicts', role: 'group', 'aria-label': d.label },
      d.options.map((o) => {
        const value = optionValue(o);
        return h(
          'button',
          {
            class: 'option',
            'data-key': `dec-${d.id}-${value}`,
            'aria-pressed': String(given === value),
            disabled: locked,
            onclick: () => a.decideE(d.id, given === value ? undefined : value),
          },
          choiceLabel(content, d, value),
        );
      }),
    );
  }
  return h(
    'li',
    { class: 'decision-row', 'data-decision': d.id },
    h(
      'div',
      { class: 'decision-head' },
      h('span', { class: 'decision-label' }, d.label),
      d.amount !== undefined ? h('span', { class: 'amount' }, formatEuro(d.amount)) : null,
    ),
    controls,
  );
}

function markPanel(answer: Answer, ui: DeskUi, locked: boolean, a: DeskActions): HTMLElement {
  const marks = answer.marks ?? [];
  return h(
    'div',
    { class: 'marks' },
    h(
      'button',
      { class: 'mark-toggle', 'data-key': 'mark-mode', 'aria-pressed': String(ui.markMode && !locked), disabled: locked, onclick: a.toggleMarkMode },
      t('desk.markMode'),
    ),
    ui.markMode && !locked ? h('p', { class: 'hint', role: 'status' }, t('desk.markHint')) : null,
    marks.length
      ? [
          h('p', { class: 'mark-count' }, t('desk.markCount', { count: marks.length })),
          h(
            'ol',
            { class: 'mark-list' },
            marks.map((m, i) =>
              h(
                'li',
                {},
                h('span', { class: 'mark-no' }, i + 1),
                h('span', { class: 'mark-pair' }, pairText(m)),
                h(
                  'button',
                  { class: 'mark-remove', 'data-key': `mark-remove-${i}`, 'aria-label': t('aria.markRemove', { no: i + 1 }), disabled: locked, onclick: () => a.removeMark(i) },
                  t('desk.markRemove'),
                ),
              ),
            ),
          ),
          h('button', { class: 'mark-clear', 'data-key': 'mark-clear', disabled: locked, onclick: a.clearMarks }, t('desk.markClear')),
        ]
      : null,
  );
}

function inquiryPanel(akte: Akte, a: DeskActions): HTMLElement | null {
  if (akte.kind.type !== 'entscheidungen' || !akte.kind.inquiry) return null;
  const q = akte.kind.inquiry;
  return h(
    'section',
    { class: 'inquiry', role: 'group', 'aria-labelledby': 'inquiry-heading' },
    h('h3', { id: 'inquiry-heading' }, t('desk.inquiryHeading')),
    h('p', { class: 'inquiry-prompt' }, q.prompt),
    h(
      'div',
      { class: 'inquiry-options' },
      q.options.map((o) => h('button', { class: 'option', 'data-key': `inq-${o.id}`, onclick: () => a.inquiry(o.id) }, o.label)),
    ),
    h('p', { class: 'hint' }, t('desk.inquiryRequired')),
  );
}

function pruefvermerk(content: Content, akte: Akte, answer: Answer, ui: DeskUi, a: DeskActions): HTMLElement {
  const locked = answer.stamp !== undefined;
  const header = h('header', {}, h('h2', {}, t('desk.pruefvermerk')), h('p', {}, akteHeading(akte)));

  let body: HTMLElement;
  const kind = akte.kind;
  if (kind.type === 'werbungskosten') {
    body = h(
      'table',
      { class: 'positions' },
      h('thead', {}, h('tr', {}, h('th', {}, t('desk.colPosition')), h('th', {}, t('desk.colAmount')), h('th', {}, t('desk.colDecision')))),
      h(
        'tbody',
        {},
        kind.positions.map((p) => {
          const given = answer.positions[p.id];
          const btn = (v: PlayerVerdict) =>
            h(
              'button',
              {
                class: `verdict ${v}`,
                'data-key': `pos-${p.id}-${v}`,
                'aria-pressed': String(given === v),
                disabled: locked,
                onclick: () => a.decide(p.id, given === v ? undefined : v),
              },
              playerVerdictLabel(v),
            );
          return h(
            'tr',
            { 'data-position': p.id },
            h('td', {}, p.label),
            h('td', { class: 'amount' }, formatEuro(p.amount)),
            h('td', {}, h('div', { class: 'verdicts', role: 'group', 'aria-label': p.label }, btn('anerkennen'), btn('streichen'))),
          );
        }),
      ),
    );
  } else if (kind.type === 'steuerpflicht') {
    const d = kind.decision;
    body = h(
      'div',
      { class: 'decision', role: 'group', 'aria-label': d.question },
      h('h3', {}, d.question),
      d.options.map((o) =>
        h(
          'button',
          {
            class: 'option',
            'data-key': `opt-${o}`,
            'aria-pressed': String(answer.option === o),
            disabled: locked,
            onclick: () => a.choose(answer.option === o ? undefined : o),
          },
          optionLabel(content, o),
        ),
      ),
    );
  } else {
    body = h('ol', { class: 'decisions' }, kind.decisions.map((d) => decisionRow(content, d, answer, locked, a)));
  }

  return h(
    'section',
    { class: 'paper pruefvermerk', 'aria-label': t('aria.pruefvermerk'), 'data-akte': akte.id },
    header,
    body,
    markPanel(answer, ui, locked, a),
    ui.inquiryOpen && !locked ? inquiryPanel(akte, a) : null,
    answer.stamp ? h('div', { class: `stamp-imprint ${answer.stamp}`, role: 'status' }, stampLabel(content, answer.stamp)) : null,
  );
}

/** Newspapers of the day lie on the desk until the day ends (SPEC 7). */
function newspapers(events: StoryEvent[], hook: PaperHook): HTMLElement[] {
  return events.flatMap((e, i) => {
    if (e.type !== 'newspaper') return [];
    const el = newspaperSheet(e, { tabindex: 0, 'data-key': `newspaper-${i}`, class: 'paper doc newspaper' });
    hook(el, `newspaper-${i}`, `zeitung#${e.headline}`);
    return [el];
  });
}

export function deskView(content: Content, state: GameState, ui: DeskUi, a: DeskActions, hook: PaperHook): HTMLElement {
  const d = dayInfo(content, state.day);
  const akte = state.current ? getAkte(content, state.current.akteId) : null;
  const answer = state.current?.answer;
  const stamped = answer?.stamp !== undefined;

  const stack = h(
    'div',
    { class: 'stack-bar' },
    h('span', { class: 'day-label' }, t('desk.day', { day: state.day })),
    h(
      'button',
      { class: 'stack', 'data-key': 'stack', disabled: !!state.current || state.queue.length === 0, onclick: a.drawNext },
      t('desk.stack', { count: state.queue.length }),
    ),
  );

  const work = h(
    'section',
    { class: 'worksurface', 'aria-label': t('aria.worksurface') },
    akte && answer
      ? [
          pruefvermerk(content, akte, answer, ui, a),
          h(
            'div',
            { class: `papers count-${akte.documents.length}` },
            akte.documents.map((doc, i) => paper(doc, i, akte, answer, ui, a, hook)),
          ),
        ]
      : h('p', { class: 'empty-desk' }, t('desk.emptyDesk')),
    h('div', { class: 'newspapers' }, newspapers(d.storyEvents, hook)),
  );

  const tools = h(
    'aside',
    { class: 'tools', 'aria-label': t('aria.tools') },
    h('h2', {}, t('desk.stamps')),
    d.stamps.map((s) =>
      h(
        'button',
        {
          class: `stamp-btn ${s}`,
          'data-key': `stamp-${s}`,
          'aria-expanded': s === 'ergaenzung' && akte?.kind.type === 'entscheidungen' && akte.kind.inquiry ? String(ui.inquiryOpen) : null,
          disabled: !akte || stamped,
          onclick: () => a.stamp(s),
        },
        stampLabel(content, s),
      ),
    ),
    h('h2', {}, t('desk.outbox')),
    h('button', { class: 'outbox', 'data-key': 'outbox', disabled: !stamped, onclick: a.file }, t('desk.outboxButton')),
    akte && !stamped ? h('p', { class: 'hint' }, t('desk.stampFirst')) : null,
  );

  const left = h(
    'div',
    { class: 'left-col' },
    closedBook(content, state.day, state.codex, a.openCodex),
    state.tools.includes('calculator') ? renderCalculator(ui.calc, a.calc) : null,
  );

  return h('main', { class: 'screen desk' }, stack, h('div', { class: 'desk-grid' }, left, work, tools));
}
