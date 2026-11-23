import { fromCents, parseAmount } from '../core/amount';
import type { CalcKey, CalcState } from '../core/calculator';
import { formatEuro } from '../core/format';
import { boardContext, newClues, unseenAnswers, visibleQuestions, isAnswered } from '../core/board';
import { canMark, dayInfo, hasNeedles, hasPinboard, resultsOfDay, type GameState, type PendingLine } from '../core/game';
import { getAkte, optionValue } from '../core/loader';
import type { CalendarContent } from '../core/schema';
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
} from '../core/types';
import { closedCalendar, openCalendar, type CalendarActions, type CalendarView } from './calendar';
import { renderCalculator } from './calculator';
import { closedBook } from './codex';
import { h } from './dom';
import { akteHeading, akteLabel, choiceLabel, optionLabel, pairText, playerVerdictLabel, stampLabel } from './labels';
import { paperRotation } from './paper-interaction';
import { makePinnable, type PinPlace } from './pin-lines';
import { LEFT_RAIL, PAD, RIGHT_RAIL, SLOTS, STAGE_H, STAGE_W, objTransform, type Spot } from './stage';
import { newspaperSheet } from './story';
import { t } from './text';

/*
 * The desk (SPEC 7.1 to 7.5) as a stage: rails left and right, the green pad in
 * the middle. This module only builds elements from the state; what a press,
 * a drag or a click does is decided by the table (table.ts).
 */

export interface DeskActions {
  decide(positionId: string, verdict: PlayerVerdict | undefined): void;
  choose(option: string | undefined): void;
  decideE(decisionId: string, value: string | undefined): void;
  /** Stores a typed amount without re-rendering, so typing keeps focus and caret. */
  amount(decisionId: string, raw: string): void;
  /** Takes the stamp from the holder, or puts it back if it is the one carried (SPEC 7.3). */
  stamp(stamp: Stamp, byKeyboard?: boolean): void;
  /** Presses the carried stamp onto the stamp field of the open folder. */
  pressStamp(): void;
  /** Chooses the question of the Ergänzungsersuchen; the stamp is pressed afterwards (SPEC 4). */
  inquiry(questionId: string): void;
  /** A line chosen in the Gegenüberstellung (SPEC 4). */
  markLine(doc: number, line: string): void;
  removeMark(index: number): void;
  clearMarks(): void;
  calc(key: CalcKey): void;
  file(): void;
  /** Pins a line or the office stamp of a paper on the desk into the hand (SPEC 4). */
  pin(place: PinPlace): void;
  /** Opens the pinboard view (SPEC 7.6). */
  openPinboard(): void;
  /** The drawer: stuck before `unlock: drawer`, else the drawer view (SPEC 7.7). */
  drawer(): void;
}

/** Desk state that lives only in the interface; reset when a new Akte lands on the desk. */
export interface DeskUi {
  akteId: string | null;
  /** First line chosen in the Gegenüberstellung, waiting for its partner in another paper. */
  pending: PendingLine | null;
  inquiryOpen: boolean;
  /** Question chosen for the Ergänzungsersuchen while its stamp is carried. */
  inquiryChoice: string | null;
  /** Stamp taken from the holder, following the pointer. */
  carrying: Stamp | null;
  calc: CalcState;
}

export type ToolId = 'codex' | 'calendar' | 'calculator';

/** A spot on the stage plus stacking order. */
export interface Placed extends Spot {
  z: number;
}

/** Where things lie on the desk. Not saved (SPEC 9): a reload starts with closed tools and papers in the pocket. */
export interface TableUi {
  folderOpen: boolean;
  /** Spot of the folder on the pad. */
  folder: Placed | null;
  /** Papers taken out of the pocket, by document index. */
  papers: Record<number, Placed>;
  /** Tools lying open on the pad. */
  tools: Partial<Record<ToolId, Placed>>;
  newspapers: Record<string, Placed>;
  calendar: CalendarView;
  /** The folder plays its cover animation once after this render. */
  opening: boolean;
}

/** What the table does with presses, clicks and keys on desk objects. */
export interface TableHooks {
  /** Pointer pressed on an object: may become a drag. */
  press(e: PointerEvent, what: Grab): void;
  /** Click, or Enter or Space on the focused object. */
  activate(what: Grab, viaKeyboard?: boolean): void;
  /** Arrow key on a focused object. */
  nudge(what: Grab, dx: number, dy: number): void;
  zoom(el: HTMLElement): void;
  closeAkte(): void;
  putBack(tool: ToolId): void;
  readMode(): void;
  calendar: CalendarActions;
}

/** Things that can be grabbed. */
export type Grab =
  | { kind: 'inbox' }
  | { kind: 'folder' }
  | { kind: 'paper'; index: number }
  | { kind: 'tool'; tool: ToolId }
  | { kind: 'newspaper'; key: string };

export const FOLDER_ROTATION = 0;
export const TOOL_ROTATION: Record<ToolId, number> = { codex: 0, calendar: -1, calculator: 1.2 };
export const paperSeed = (akteId: string, i: number) => `${akteId}#${i}`;

/** Spots of papers in the pocket: staggered so every title stays visible (SPEC 7). */
export const POCKET_STEP = { x: 7, y: 25 };
/** Papers in the pocket are shown smaller, so the widest stack still fits its 206 px. */
const POCKET_SCALE = 0.68;

const lineMatches = (m: Mark, title: string, line: string) =>
  (m.a.document === title && m.a.line === line) || (m.b.document === title && m.b.line === line);

/** Shown amount: formatted once readable, else as typed. */
const amountValue = (raw: string | undefined) => {
  if (raw === undefined) return '';
  const cents = parseAmount(raw);
  return cents === null ? raw : formatEuro(fromCents(cents));
};

/**
 * The Gegenüberstellung is open (SPEC 4): from `unlock: marking` on, while the
 * stamp „Ergänzungsersuchen“ is in the hand of an Akte not yet stamped. It opens
 * for every Ergänzungsersuchen, with or without discrepancies, so it gives nothing away.
 */
export const markOpen = (state: GameState, ui: DeskUi): boolean =>
  ui.carrying === 'ergaenzung' && canMark(state) && state.current !== null && state.current.answer.stamp === undefined;

/** A value that is only an amount (`1.200,00 €`, `−80 €`): never wraps, right-aligned (SPEC 7, Papier). */
export const isAmountText = (v: string) => /^[−+-]?\s?\d{1,3}(\.\d{3})*(,\d{1,2})?\s?€$/.test(v.trim());

/** Click and Enter or Space (when the element itself has focus) do the same. */
function activatable(el: HTMLElement, fn: (viaKeyboard: boolean) => void): HTMLElement {
  el.addEventListener('click', (e) => {
    const control = (e.target as HTMLElement).closest('button, a, input');
    if (control && control !== el && !(control as HTMLElement).dataset.grab) return;
    fn(false);
  });
  el.addEventListener('keydown', (e) => {
    if (e.target !== el || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    fn(true);
  });
  return el;
}

/** Pointer presses on the object (not on its controls) may start a drag; arrows move it. */
function grabbable(el: HTMLElement, what: Grab, hooks: TableHooks, opts: { arrows?: boolean; handle?: string } = {}): HTMLElement {
  el.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement;
    const control = target.closest<HTMLElement>('button, a, input, select, textarea, .pv-scroll, .stamp-field');
    // A control that is itself the object (the closed codex) may be dragged.
    if (control && !control.dataset.grab) return;
    if (opts.handle && !target.closest(opts.handle)) return;
    e.preventDefault();
    hooks.press(e, what);
  });
  if (opts.arrows !== false) {
    el.addEventListener('keydown', (e) => {
      if (e.target !== el) return;
      const step = e.shiftKey ? 64 : 16;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!d) return;
      e.preventDefault();
      hooks.nudge(what, d[0]!, d[1]!);
    });
  }
  return el;
}

const place = (el: HTMLElement, p: Spot, rot: number, z = 0, extra = '') => {
  el.style.transform = objTransform(p, rot, extra);
  if (z) el.style.zIndex = String(z);
  return el;
};

// ---------- Papers ----------

interface PaperOpts {
  loose: boolean;
  akte: Akte;
  answer: Answer;
  ui: DeskUi;
  a: DeskActions;
  /** Lines carry needles (a question needs pinning, paper on the pad, no stamp in the hand). */
  pinnable?: boolean;
  /** The Gegenüberstellung is open: lines of papers on the pad can be chosen. */
  marking: boolean;
}

function paper(doc: Document, docIndex: number, o: PaperOpts): HTMLElement {
  const el = paperSheet(doc, docIndex, o);
  if (o.pinnable && o.loose && !o.ui.carrying) {
    makePinnable(el, doc, { key: `line-${docIndex}`, stampPinnable: !!o.akte.representative?.stampVisible, onPin: o.a.pin });
  }
  return el;
}

function paperSheet(doc: Document, docIndex: number, o: PaperOpts): HTMLElement {
  const { akte, answer, ui, a } = o;
  const marks = answer.marks ?? [];
  // Only papers on the pad can be chosen; those in the pocket are not clickable then (SPEC 4).
  const markable = o.marking && o.loose;
  return h(
    'article',
    {
      class: `obj paper doc ${doc.kind}${doc.stamp ? ' has-stamp' : ''}${o.loose ? ' loose' : ' in-pocket'}${markable ? ' marking' : ''}`,
      tabindex: 0,
      'data-key': `paper-${docIndex}`,
      'data-fx': `paper-${akte.id}-${docIndex}`,
      'aria-label': doc.title,
      'aria-roledescription': t('aria.paper'),
      inert: !o.loose && o.marking ? true : null,
    },
    h('h3', {}, doc.title),
    h(
      'table',
      { class: doc.lines.some(([, v]) => isAmountText(v)) ? 'lines has-amounts' : 'lines' },
      h(
        'tbody',
        {},
        doc.lines.map(([label, value], lineIndex) => {
          const numbers = marks.flatMap((m, i) => (lineMatches(m, doc.title, label) ? [i + 1] : []));
          const selected = ui.pending?.doc === docIndex && ui.pending.line === label;
          // The whole row answers a click; the button in it carries focus and Enter (SPEC 4).
          const head = markable
            ? h(
                'button',
                {
                  class: 'mark-line',
                  'data-key': `mark-${docIndex}-${lineIndex}`,
                  'aria-pressed': String(selected),
                  'aria-label': t('aria.markableLine', { label }),
                },
                label,
              )
            : label;
          const row = h(
            'tr',
            { class: [markable ? 'markable' : '', numbers.length || selected ? 'marked' : '', selected ? 'selected' : ''].filter(Boolean).join(' ') || null },
            h('th', { scope: 'row' }, head, numbers.map((n) => h('span', { class: 'mark-no' }, n))),
            h('td', { class: isAmountText(value) ? 'amount' : null }, value),
          );
          if (markable) {
            // A click on a line does nothing else while the Gegenüberstellung is open: no zoom, no raise, no drag.
            row.addEventListener('click', (e) => {
              e.stopPropagation();
              a.markLine(docIndex, label);
            });
            row.addEventListener('dblclick', (e) => e.stopPropagation());
          }
          return row;
        }),
      ),
    ),
    doc.stamp ? h('div', { class: 'office-stamp', 'aria-label': t('aria.officeStamp', { stamp: doc.stamp }) }, doc.stamp) : null,
  );
}

// ---------- Prüfvermerk ----------

/** How long the pencil stroke under a confirmed amount stays (ms); matches the CSS animation. */
const UNDERLINE_MS = 900;

function underline(box: HTMLElement): void {
  box.classList.remove('pencil-line');
  void box.offsetWidth;
  box.classList.add('pencil-line');
  setTimeout(() => box.classList.remove('pencil-line'), UNDERLINE_MS);
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
    controls = h('div', { class: 'controls' }, input);
    const box = controls;
    const tidy = () => {
      const cents = parseAmount(input.value);
      if (cents !== null) input.value = formatEuro(fromCents(cents));
      if (input.value.trim() !== '' && cents === null) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
      // A valid amount gets a short pencil stroke underneath, without sound (SPEC 7).
      if (cents !== null) underline(box);
    };
    input.addEventListener('blur', tidy);
    input.addEventListener('keydown', (e) => e.key === 'Enter' && tidy());
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

function markList(marks: Mark[], locked: boolean, a: DeskActions): HTMLElement[] {
  if (!marks.length) return [];
  return [
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
  ];
}

/**
 * Pairs in the Prüfvermerk. While the Gegenüberstellung is open (SPEC 4) as its
 * own area with heading and hints, at the place of the question choice; else
 * only the list of pairs, if there are any.
 */
function markPanel(answer: Answer, open: boolean, locked: boolean, a: DeskActions): HTMLElement | null {
  const marks = answer.marks ?? [];
  if (open) {
    return h(
      'section',
      { class: 'marks mark-area', role: 'group', 'aria-labelledby': 'mark-heading', 'data-key': 'mark-area', tabindex: -1 },
      h('h3', { id: 'mark-heading' }, t('desk.markHeading')),
      h('p', { class: 'hint' }, t('desk.markHint')),
      h('p', { class: 'hint optional' }, t('desk.markOptional')),
      markList(marks, locked, a),
    );
  }
  return marks.length ? h('div', { class: 'marks' }, markList(marks, locked, a)) : null;
}

function inquiryPanel(akte: Akte, chosen: string | null, a: DeskActions): HTMLElement | null {
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
      q.options.map((o) => h('button', { class: 'option', 'data-key': `inq-${o.id}`, 'aria-pressed': String(chosen === o.id), onclick: () => a.inquiry(o.id) }, o.label)),
    ),
    h('p', { class: 'hint' }, t('desk.inquiryRequired')),
  );
}

function pruefvermerkBody(content: Content, akte: Akte, answer: Answer, locked: boolean, a: DeskActions): HTMLElement {
  const kind = akte.kind;
  if (kind.type === 'werbungskosten') {
    return h(
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
  }
  if (kind.type === 'steuerpflicht') {
    const d = kind.decision;
    return h(
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
  }
  return h('ol', { class: 'decisions' }, kind.decisions.map((d) => decisionRow(content, d, answer, locked, a)));
}

/** Left inside of the folder: the Prüfvermerk scrolls in itself, the stamp field below stays visible (SPEC 7.2). */
function pruefvermerk(content: Content, akte: Akte, answer: Answer, ui: DeskUi, marking: boolean, a: DeskActions): HTMLElement {
  const locked = answer.stamp !== undefined;
  return h(
    'section',
    { class: 'paper pruefvermerk', 'aria-label': t('aria.pruefvermerk'), 'data-akte': akte.id, 'data-key': 'pruefvermerk', tabindex: -1 },
    h(
      'div',
      { class: 'pv-scroll' },
      h('header', {}, h('h2', {}, t('desk.pruefvermerk')), h('p', {}, akteHeading(akte))),
      pruefvermerkBody(content, akte, answer, locked, a),
      markPanel(answer, marking, locked, a),
      ui.inquiryOpen && !locked ? inquiryPanel(akte, ui.inquiryChoice, a) : null,
    ),
    h(
      'div',
      {
        class: `stamp-field${answer.stamp ? ' stamped' : ''}${ui.carrying && !locked ? ' ready' : ''}${ui.carrying && ui.inquiryOpen && !ui.inquiryChoice ? ' waiting' : ''}`,
        'data-key': 'stamp-field',
        tabindex: ui.carrying && !locked ? 0 : null,
        role: 'group',
        onclick: () => a.pressStamp(),
        'aria-label': t('desk.stampField'),
      },
      answer.stamp
        ? h('div', { class: `stamp-imprint ${answer.stamp}`, role: 'status' }, stampLabel(content, answer.stamp))
        : h('span', { class: 'stamp-field-label', 'aria-hidden': 'true' }, t('desk.stampField')),
    ),
  );
}

// ---------- Folder ----------

function folderAria(content: Content, akte: Akte, stamp: Stamp | undefined): string {
  const id = akteLabel(akte);
  const name = akte.taxpayer.name;
  return stamp ? t('aria.folderStamped', { id, name, stamp: stampLabel(content, stamp) }) : t('aria.folder', { id, name });
}

/** A closed folder: cardboard with a tab (file number), the taxpayer's name and, once stamped, a small imprint. */
function closedFolder(content: Content, akte: Akte, stamp: Stamp | undefined, attrs: Record<string, string | number | null>): HTMLElement {
  return h(
    'div',
    { ...attrs, class: `obj folder closed${stamp ? ' stamped' : ''} ${attrs.class ?? ''}`, role: 'button', tabindex: attrs.tabindex ?? 0, 'aria-label': folderAria(content, akte, stamp) },
    h('span', { class: 'folder-tab', 'aria-hidden': 'true' }, akteLabel(akte)),
    h('b', { class: 'folder-name', 'aria-hidden': 'true' }, akte.taxpayer.name),
    akte.taxpayer.job ? h('small', { 'aria-hidden': 'true' }, akte.taxpayer.job) : null,
    stamp ? h('span', { class: `folder-imprint ${stamp}`, 'aria-hidden': 'true' }, stampLabel(content, stamp)) : null,
  );
}

function openFolder(content: Content, akte: Akte, answer: Answer, ui: DeskUi, marking: boolean, table: TableUi, a: DeskActions, hooks: TableHooks): HTMLElement {
  const pocketPapers = akte.documents.flatMap((doc, i) => {
    if (table.papers[i]) return [];
    const el = paper(doc, i, { loose: false, akte, answer, ui, a, marking });
    el.style.transform = objTransform({ x: 2 + i * POCKET_STEP.x, y: 10 + i * POCKET_STEP.y }, paperRotation(paperSeed(akte.id, i)) / 2, `scale(${POCKET_SCALE})`);
    el.style.zIndex = String(i + 1);
    activatable(el, () => hooks.activate({ kind: 'paper', index: i }));
    grabbable(el, { kind: 'paper', index: i }, hooks, { arrows: false });
    return [el];
  });
  const el = h(
    'section',
    {
      class: `obj folder open${table.opening ? ' opening' : ''}`,
      'data-key': 'folder',
      'data-fx': `akte-${akte.id}`,
      'aria-label': folderAria(content, akte, answer.stamp),
    },
    h(
      'header',
      { class: 'folder-bar' },
      h('span', { class: 'folder-tab' }, akteLabel(akte)),
      h('span', { class: 'folder-name' }, akte.taxpayer.name),
      h('button', { class: 'close-akte', 'data-key': 'close-akte', onclick: hooks.closeAkte }, t('desk.closeAkte')),
    ),
    h(
      'div',
      { class: 'folder-body' },
      pruefvermerk(content, akte, answer, ui, marking, a),
      h('div', { class: 'pocket', role: 'group', 'aria-label': t('desk.pocket') }, pocketPapers, h('span', { class: 'pocket-label', 'aria-hidden': 'true' }, t('desk.pocket'))),
    ),
    table.opening ? h('div', { class: 'folder-cover', 'aria-hidden': 'true' }) : null,
  );
  grabbable(el, { kind: 'folder' }, hooks, { arrows: false, handle: '.folder-bar' });
  return el;
}

// ---------- Rails ----------

function inbox(content: Content, state: GameState, hooks: TableHooks): HTMLElement {
  const count = state.queue.length;
  const pile = state.queue
    .slice(0, 6)
    .map((id, k) => {
      const akte = getAkte(content, id);
      const top = k === 0;
      const el = closedFolder(content, akte, undefined, {
        class: top ? 'in-inbox top' : 'in-inbox',
        'data-key': top ? 'stack' : null,
        'data-fx': top ? `akte-${id}` : null,
        tabindex: top ? 0 : -1,
        'aria-hidden': top ? null : 'true',
      });
      if (!top) el.removeAttribute('role');
      place(el, { x: SLOTS.inbox.x + 4 + k * 3, y: SLOTS.inbox.y + 30 + k * 4 }, k % 2 ? 0.8 : -0.6, 20 - k);
      if (top) {
        activatable(el, () => hooks.activate({ kind: 'inbox' }));
        grabbable(el, { kind: 'inbox' }, hooks, { arrows: false });
      }
      return el;
    })
    .reverse();
  return h(
    'div',
    { class: 'inbox', role: 'group', 'aria-label': t('aria.inbox', { count }) },
    h('div', { class: 'slot inbox-slot', style: slotStyle(SLOTS.inbox) }, h('span', { class: 'slot-label', 'data-testid': 'inbox-count' }, t('desk.stack', { count }))),
    pile,
  );
}

const slotStyle = (r: { x: number; y: number; w: number; h: number }) => `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;

function rack(content: Content, state: GameState, ui: DeskUi, akte: Akte | null, a: DeskActions): HTMLElement {
  const stamped = state.current?.answer.stamp !== undefined;
  const stamps = dayInfo(content, state.day).stamps;
  const hasInquiry = akte?.kind.type === 'entscheidungen' && !!akte.kind.inquiry;
  return h(
    'div',
    { class: 'rack', style: slotStyle(SLOTS.rack) },
    h('h2', {}, t('desk.stamps')),
    stamps.map((s) =>
      h(
        'button',
        {
          class: `stamp-btn ${s}${ui.carrying === s ? ' carried' : ''}`,
          'data-key': `stamp-${s}`,
          'aria-pressed': String(ui.carrying === s),
          'aria-expanded': s === 'ergaenzung' && hasInquiry && !stamped ? String(ui.inquiryOpen && ui.carrying === s) : null,
          onclick: (e: Event) => a.stamp(s, (e as MouseEvent).detail === 0),
        },
        h('span', { class: 'stamp-handle', 'aria-hidden': 'true' }),
        h('span', { class: 'stamp-name' }, stampLabel(content, s)),
      ),
    ),
  );
}

function outbox(content: Content, state: GameState): HTMLElement {
  const filed = resultsOfDay(state, state.day);
  return h(
    'div',
    { class: 'outbox-zone', style: slotStyle(SLOTS.outbox) },
    h('h2', {}, t('desk.outbox'), filed.length ? h('b', { class: 'outbox-count' }, filed.length) : null),
    h(
      'div',
      { class: 'outbox-pile', 'aria-hidden': 'true' },
      filed.slice(-6).map((r, k, arr) => {
        const akte = getAkte(content, r.akteId);
        const el = closedFolder(content, akte, r.answer.stamp, { class: 'in-outbox', tabindex: -1, 'data-fx': k === arr.length - 1 ? `akte-${r.akteId}` : null });
        el.removeAttribute('role');
        return place(el, { x: 3 + (k % 3) * 2, y: 104 - k * 6 }, k % 2 ? 2 : -2, k + 1);
      }),
    ),
  );
}

/** Cork board in the right rail (SPEC 7.1, 7.6): new clues and an unseen answer show on it. */
function pinboardSpot(content: Content, state: GameState, a: DeskActions): HTMLElement {
  const ctx = boardContext(state);
  const fresh = newClues(content, ctx).length;
  const answered = unseenAnswers(content, ctx).length > 0;
  const open = visibleQuestions(content, ctx).filter((q) => !isAnswered(state.board, q)).length;
  return h(
    'button',
    {
      class: 'pinboard-spot',
      style: slotStyle(SLOTS.pinboard),
      'data-key': 'pinboard',
      'aria-label': t('aria.pinboard', { count: open }),
      'aria-keyshortcuts': 'P',
      onclick: a.openPinboard,
    },
    h('span', { class: 'cork-label' }, t('pinboard.label')),
    h('span', { class: 'cork-notes', 'aria-hidden': 'true' }, visibleQuestions(content, ctx).slice(0, 3).map((q) => h('span', { class: `cork-note${isAnswered(state.board, q) ? ' done' : ''}` }))),
    fresh ? h('span', { class: 'cork-count' }, t('pinboard.newClues', { count: fresh })) : null,
    answered ? h('span', { class: 'cork-new' }, t('pinboard.new')) : null,
  );
}

/** Handle of the drawer at the front edge of the desk: there from day 1 (SPEC 7.7). */
function drawerHandle(a: DeskActions): HTMLElement {
  return h(
    'button',
    { class: 'drawer-handle', style: slotStyle(SLOTS.drawer), 'data-key': 'drawer', 'aria-label': t('aria.drawer'), onclick: a.drawer },
    h('span', { class: 'drawer-grip', 'aria-hidden': 'true' }),
    h('span', { class: 'drawer-label' }, t('drawer.label')),
  );
}

function phone(): HTMLElement {
  return h('div', { class: 'desk-phone', style: slotStyle(SLOTS.phone), 'aria-hidden': 'true' }, h('span', { class: 'phone' }));
}

// ---------- Tools ----------

export interface ToolEnv {
  content: Content;
  calendar: CalendarContent;
  state: GameState;
  ui: DeskUi;
  table: TableUi;
  a: DeskActions;
  hooks: TableHooks;
  /** The open codex on the desk (kept across renders), or null. */
  deskBook: HTMLElement | null;
}

/** Rail spots of the closed tools. */
export const TOOL_SLOT: Record<ToolId, Spot> = {
  codex: { x: SLOTS.codex.x + 22, y: SLOTS.codex.y + 14 },
  calendar: { x: SLOTS.calendar.x + 18, y: SLOTS.calendar.y + 20 },
  calculator: { x: SLOTS.calculator.x + 24, y: SLOTS.calculator.y + 10 },
};

function closedTool(tool: ToolId, env: ToolEnv): HTMLElement {
  const { hooks } = env;
  let el: HTMLElement;
  const attrs = { class: `obj tool closed tool-${tool}`, 'data-fx': `tool-${tool}` };
  if (tool === 'codex') {
    el = h('div', attrs, closedBook(env.content, env.state.day, env.state.codex, () => hooks.activate({ kind: 'tool', tool })));
    el.querySelector<HTMLElement>('.codex-book')!.dataset.grab = 'true';
  } else if (tool === 'calendar') {
    el = closedCalendar(env.table.calendar, { ...attrs, 'data-key': 'calendar-tool' });
    activatable(el, () => hooks.activate({ kind: 'tool', tool }));
  } else {
    el = h(
      'div',
      { ...attrs, 'data-key': 'calc-tool', role: 'button', tabindex: 0, 'aria-label': t('aria.calculator') },
      h('span', { class: 'mini-display', 'aria-hidden': 'true' }),
      h('span', { class: 'mini-keys', 'aria-hidden': 'true' }),
    );
    activatable(el, () => hooks.activate({ kind: 'tool', tool }));
  }
  place(el, TOOL_SLOT[tool], 0);
  grabbable(el, { kind: 'tool', tool }, hooks, { arrows: false });
  return el;
}

function openTool(tool: ToolId, at: Placed, env: ToolEnv): HTMLElement | null {
  const { hooks } = env;
  let el: HTMLElement | null;
  if (tool === 'codex') {
    el = env.deskBook;
    if (!el) return null;
  } else if (tool === 'calendar') {
    el = openCalendar(env.calendar, env.table.calendar, hooks.calendar, { class: 'obj tool open tool-calendar', 'data-key': 'calendar-desk', 'data-fx': 'tool-calendar' });
  } else {
    el = h(
      'div',
      { class: 'obj tool open tool-calculator', 'data-fx': 'tool-calculator' },
      renderCalculator(env.ui.calc, env.a.calc),
      h('button', { class: 'put-back', 'data-key': 'calc-putback', onclick: () => hooks.putBack('calculator') }, t('desk.putBack')),
    );
  }
  place(el, at, TOOL_ROTATION[tool], at.z);
  if (tool !== 'codex' || !el.dataset.grabbable) {
    grabbable(el, { kind: 'tool', tool }, hooks, { arrows: tool !== 'codex' });
    el.dataset.grabbable = 'true';
  }
  return el;
}

// ---------- The stage ----------

export interface DeskEnv extends ToolEnv {
  /** Live region for short messages (kept across renders). */
  live: HTMLElement;
  /** The carried stamp following the pointer (kept across renders). */
  ghost: HTMLElement;
}

export function deskView(env: DeskEnv): HTMLElement {
  const { content, state, ui, table, a, hooks } = env;
  const akte = state.current ? getAkte(content, state.current.akteId) : null;
  const answer = state.current?.answer;
  const tools = (['codex', 'calendar', 'calculator'] as const).filter((x) => x === 'codex' || state.tools.includes(x));

  const objects: HTMLElement[] = [];
  const marking = markOpen(state, ui);
  if (akte && answer) {
    if (table.folderOpen) {
      const f = openFolder(content, akte, answer, ui, marking, table, a, hooks);
      objects.push(place(f, table.folder ?? { x: PAD.x + 12, y: PAD.y + 12 }, FOLDER_ROTATION, table.folder?.z ?? 0));
      akte.documents.forEach((doc, i) => {
        const at = table.papers[i];
        if (!at) return;
        const el = paper(doc, i, { loose: true, akte, answer, ui, a, marking, pinnable: hasNeedles(content, state) });
        activatable(el, (kbd) => hooks.activate({ kind: 'paper', index: i }, kbd));
        el.addEventListener('dblclick', (e) => {
          if (!(e.target as HTMLElement).closest('button')) hooks.zoom(el);
        });
        objects.push(place(grabbable(el, { kind: 'paper', index: i }, hooks), at, paperRotation(paperSeed(akte.id, i)), at.z));
      });
    } else {
      // The closed folder with the button on its cover for the outbox (SPEC 7.2).
      const f = closedFolder(content, akte, answer.stamp, { 'data-key': 'folder', class: 'on-desk' });
      f.classList.remove('obj');
      activatable(f, () => hooks.activate({ kind: 'folder' }));
      const lid = h(
        'div',
        { class: 'obj desk-folder', 'data-fx': `akte-${akte.id}` },
        f,
        h('button', { class: 'lid-outbox', 'data-key': 'folder-outbox', onclick: a.file }, t('desk.outboxButton')),
      );
      objects.push(place(grabbable(lid, { kind: 'folder' }, hooks), table.folder ?? { x: PAD.x + 40, y: PAD.y + 40 }, -1, table.folder?.z ?? 0));
    }
  }
  for (const e of dayInfo(content, state.day).storyEvents.map((ev, i) => ({ ev, i }))) {
    if (e.ev.type !== 'newspaper') continue;
    const key = `newspaper-${e.i}`;
    const at = table.newspapers[key];
    if (!at) continue;
    const el = newspaperSheet(e.ev, { tabindex: 0, 'data-key': key, 'data-fx': key, class: 'obj paper doc newspaper loose' });
    el.addEventListener('dblclick', () => hooks.zoom(el));
    activatable(el, (kbd) => hooks.activate({ kind: 'newspaper', key }, kbd));
    objects.push(place(grabbable(el, { kind: 'newspaper', key }, hooks), at, paperRotation(`zeitung#${e.ev.headline}`), at.z));
  }
  for (const tool of tools) {
    const at = table.tools[tool];
    if (at) {
      const el = openTool(tool, at, env);
      if (el) objects.push(el);
    }
  }

  const stage = h(
    'div',
    { class: 'stage', style: `width:${STAGE_W}px;height:${STAGE_H}px` },
    h('div', { class: 'rail left', style: slotStyle(LEFT_RAIL) }),
    h('div', { class: 'rail right', style: slotStyle(RIGHT_RAIL), role: 'region', 'aria-label': t('aria.tools') }),
    h(
      'div',
      { class: 'pad', style: slotStyle(PAD), role: 'region', 'aria-label': t('aria.worksurface') },
      akte ? null : h('p', { class: 'empty-desk' }, t('desk.emptyDesk')),
    ),
    h('span', { class: 'day-label' }, t('desk.day', { day: state.day })),
    inbox(content, state, hooks),
    tools.map((tool) => (table.tools[tool] ? h('div', { class: `slot tool-slot slot-${tool}`, style: slotStyle(SLOTS[tool]), 'aria-hidden': 'true' }) : closedTool(tool, env))),
    hasPinboard(state) ? pinboardSpot(content, state, a) : null,
    phone(),
    outbox(content, state),
    drawerHandle(a),
    // After the objects: Tab goes from the Prüfvermerk and the papers on to the stamps.
    objects,
    rack(content, state, ui, akte, a),
    env.ghost,
    env.live,
  );
  return h('main', { class: 'screen desk' }, stage);
}
