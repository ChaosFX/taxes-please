import * as core from '../core';
import type { Clue, ClueRef, Content, Document, EffectsLevel, GameState, KeptNote, WallQuestion } from '../core';
import { h } from './dom';
import { akteHeading, akteLabel } from './labels';
import { openZoom, paperRotation } from './paper-interaction';
import { makePinnable, type PinPlace } from './pin-lines';
import { swallowClick } from './stage';
import { t, type UiKey, type UiParams } from './text';

/*
 * The pinboard view (SPEC 7.6) and the drawer (SPEC 7.7): dialogs over the desk
 * like the reading mode of the codex. While one is open the desk is not
 * re-rendered; the game state is saved at once and the desk renders on close.
 *
 * Nothing here knows a person or a story: questions, clues and answers come
 * from the content through `core`.
 */

export interface BoardHost {
  content: Content;
  state(): GameState | null;
  /** New state: saved at once, the desk is not re-rendered while the dialog is open. */
  save(next: GameState): void;
  effects(): EffectsLevel;
  sound(name: 'paper' | 'file'): void;
  /** The dialog has closed: render the desk, focus `back`. */
  closed(back: string): void;
}

/** Drag threshold in screen pixels. */
const DRAG_THRESHOLD = 5;

/** Card title and line of a place, as on the desk. */
export function cardParts(content: Content, ref: ClueRef): { title: string; line: string; value: string } {
  const akte = core.getAkte(content, ref.followUp ? ref.case + core.FOLLOW_UP_SUFFIX : ref.case);
  return {
    title: t('pinboard.cardTitle', { id: akteLabel(akte), name: akte.taxpayer.name }),
    line: 'field' in ref ? t('pinboard.cardStamp') : t('pinboard.cardLine', { document: ref.document, line: ref.line }),
    value: core.clueValue(content, ref),
  };
}

/** A clue card: Akte and name, paper and line, value. */
function card(content: Content, ref: ClueRef, attrs: Record<string, string | number | boolean | null> = {}, ...extra: (HTMLElement | null)[]): HTMLElement {
  const p = cardParts(content, ref);
  return h(
    'div',
    { class: 'clue-card', ...attrs },
    h('span', { class: 'clue-title' }, p.title),
    h('span', { class: 'clue-line' }, p.line),
    h('b', { class: 'clue-value' }, p.value),
    ...extra,
  );
}

/** A paper of a filed Akte (carbon copy) with pinnable lines. */
function copyPaper(doc: Document, i: number, akteId: string, stampPinnable: boolean, onPin: (p: PinPlace) => void): HTMLElement {
  const el = h(
    'article',
    {
      class: `paper doc copy-paper ${doc.kind}${doc.stamp ? ' has-stamp' : ''}`,
      tabindex: 0,
      'data-key': `copy-paper-${i}`,
      'aria-label': doc.title,
      'aria-roledescription': t('aria.paper'),
      style: `rotate:${paperRotation(`${akteId}#${i}`) / 2}deg`,
    },
    h('h3', {}, doc.title),
    h('table', {}, h('tbody', {}, doc.lines.map(([label, value]) => h('tr', {}, h('th', { scope: 'row' }, label), h('td', {}, value))))),
    doc.stamp ? h('div', { class: 'office-stamp', 'aria-label': t('aria.officeStamp', { stamp: doc.stamp }) }, doc.stamp) : null,
  );
  makePinnable(el, doc, { key: `copy-line-${i}`, stampPinnable, onPin });
  el.addEventListener('dblclick', (e) => {
    if (!(e.target as HTMLElement).closest('button')) openZoom(el);
  });
  el.addEventListener('keydown', (e) => {
    if (e.target === el && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openZoom(el);
    }
  });
  return el;
}

export class PinboardView {
  private dialog: HTMLDialogElement | null = null;
  private live!: HTMLElement;
  private body!: HTMLElement;
  /** Card chosen to be laid on a question (click or Enter), by key. */
  private selected: string | null = null;
  /** Akte whose carbon copy is open, or null. */
  private copy: string | null = null;
  /** Clues seen before this opening: the others carry „neu“. */
  private seenAtOpen = new Set<string>();
  /** Answers that already played their entrance. */
  private shownAnswers = new Set<string>();
  private dragging = false;
  private back = 'pinboard';

  constructor(private readonly host: BoardHost) {}

  get isOpen(): boolean {
    return this.dialog !== null;
  }

  open(back = 'pinboard'): void {
    const s = this.host.state();
    if (this.dialog || !s) return;
    this.back = back;
    this.selected = null;
    this.copy = null;
    this.seenAtOpen = new Set(s.board.seenClues);
    this.shownAnswers = new Set(s.board.seenAnswers);
    // The hand has been open once: its cards are no longer new on the desk.
    this.host.save(core.seeBoard(this.host.content, s));

    this.live = h('p', { class: 'pb-live', role: 'status', 'aria-live': 'polite' });
    this.body = h('div', { class: 'pb-body' });
    const closeBtn = h('button', { class: 'pb-close', 'data-key': 'pb-close', 'aria-keyshortcuts': 'P' }, t('pinboard.close'));
    closeBtn.addEventListener('click', () => this.close());
    const dialog = h(
      'dialog',
      { class: 'pinboard-dialog', 'aria-modal': 'true', 'aria-labelledby': 'pb-heading' },
      h('div', { class: 'pb-shell' }, h('header', { class: 'pb-bar' }, h('h2', { id: 'pb-heading' }, t('pinboard.label')), this.live, closeBtn), this.body),
    );
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.escape();
    });
    dialog.addEventListener('keydown', (e) => this.onKey(e));
    this.dialog = dialog;
    document.body.append(dialog);
    dialog.showModal();
    this.host.sound('paper');
    this.render('pb-close');
  }

  close(): void {
    if (!this.dialog) return;
    const s = this.host.state();
    if (s) this.host.save(core.seeBoard(this.host.content, s));
    this.dialog.close();
    this.dialog.remove();
    this.dialog = null;
    this.host.sound('file');
    this.host.closed(this.back);
  }

  private say(key: UiKey, params: UiParams = {}): void {
    this.live.textContent = '';
    requestAnimationFrame(() => (this.live.textContent = t(key, params)));
  }

  private escape(): void {
    if (this.dragging) return;
    if (this.copy) {
      const back = `copy-${this.copy}`;
      this.copy = null;
      this.render(back);
    } else if (this.selected) {
      const back = `card-${this.selected}`;
      this.selected = null;
      this.render(back);
    } else this.close();
  }

  private onKey(e: KeyboardEvent): void {
    // Keys of the pinboard never reach the desk below.
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      this.escape();
      return;
    }
    if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
      e.preventDefault();
      this.close();
    }
  }

  // ---------- Rendering ----------

  /** Rebuilds the content of the dialog; focus goes to `focusKey` or stays on the same `data-key`. */
  private render(focusKey?: string): void {
    const s = this.host.state();
    if (!this.dialog || !s) return;
    const key = focusKey ?? (document.activeElement as HTMLElement | null)?.dataset.key;
    const ctx = core.boardContext(s);
    const parts = [h('div', { class: 'pb-main' }, this.wallView(ctx), this.archiveView(s)), this.handView(ctx)];
    if (this.copy) parts.push(this.copyView(this.copy));
    this.body.replaceChildren(...parts);
    this.dialog.setAttribute('aria-label', t('aria.pinboard', { count: core.visibleQuestions(this.host.content, ctx).filter((q) => !core.isAnswered(s.board, q)).length }));
    const target = (key && this.dialog.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)) || this.dialog.querySelector<HTMLElement>('[data-key="pb-close"]');
    target?.focus({ preventScroll: false });
  }

  private wallView(ctx: core.BoardContext): HTMLElement {
    const cols = core.wall(this.host.content, ctx);
    return h(
      'section',
      { class: 'pb-wall' },
      cols.length === 0
        ? h('p', { class: 'pb-empty' }, t('pinboard.empty'))
        : cols.map((col) =>
            h(
              'div',
              { class: 'pb-column' },
              col.group ? h('h3', { class: 'pb-group' }, col.group) : null,
              col.questions.map((wq) => this.questionRow(wq)),
            ),
          ),
    );
  }

  private questionRow(wq: WallQuestion): HTMLElement {
    const q = wq.question;
    const content = this.host.content;
    const target = this.selected !== null && !wq.answered;
    const note = h(
      'div',
      {
        class: `question${wq.answered ? ' answered' : ''}${target ? ' target' : ''}`,
        role: 'button',
        tabindex: 0,
        'data-key': `q-${q.id}`,
        'data-question': q.id,
        'aria-disabled': wq.answered || this.selected === null ? 'true' : null,
        'aria-label': wq.answered ? t('aria.questionAnswered', { text: q.text }) : t('aria.question', { text: q.text }),
      },
      h('small', { class: 'q-from' }, q.from ? t('pinboard.questionFrom', { from: q.from }) : t('pinboard.questionOwn')),
      h('p', { class: 'q-text' }, q.text),
      wq.answered
        ? h('span', { class: 'q-state' }, t('pinboard.answered'))
        : h('span', { class: 'q-state' }, t('pinboard.progress', { have: wq.have, total: wq.total })),
    );
    const act = () => {
      if (this.selected && !wq.answered) this.place(this.selected, q.id);
    };
    note.addEventListener('click', act);
    note.addEventListener('keydown', (e) => {
      if (e.target === note && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        act();
      }
    });
    const hanging = h(
      'div',
      { class: 'q-hanging' },
      wq.hanging.map((c: Clue) =>
        card(content, core.refOf(c), { class: 'clue-card hanging' }, c.given && q.from ? h('span', { class: 'clue-given' }, t('pinboard.given', { from: q.from })) : null),
      ),
    );
    let answer: HTMLElement | null = null;
    if (wq.answered) {
      const fresh = !this.shownAnswers.has(q.id);
      this.shownAnswers.add(q.id);
      answer = h(
        'div',
        { class: `q-answer${fresh ? ' fresh' : ''}`, 'data-answer': q.id },
        h('b', {}, t('pinboard.answer'), q.answer.from ? h('span', { class: 'answer-from' }, q.answer.from) : null),
        h('p', { class: q.answer.from ? 'said' : null }, q.answer.text),
      );
    }
    return h('div', { class: 'q-row' }, note, hanging, answer);
  }

  private handView(ctx: core.BoardContext): HTMLElement {
    const cards = core.hand(this.host.content, ctx);
    if (this.selected && !cards.some((c) => c.key === this.selected)) this.selected = null;
    return h(
      'section',
      { class: 'pb-hand', 'aria-label': t('aria.hand', { count: cards.length }) },
      h('h3', {}, t('pinboard.hand'), h('span', { class: 'hint' }, t('pinboard.placeHint'))),
      h(
        'div',
        { class: 'pb-cards' },
        cards.length === 0
          ? h('p', { class: 'pb-empty' }, t('pinboard.handEmpty'))
          : cards.map((c) => {
              const p = cardParts(this.host.content, c.ref);
              const el = card(
                this.host.content,
                c.ref,
                {
                  class: `clue-card in-hand${this.selected === c.key ? ' selected' : ''}`,
                  role: 'button',
                  tabindex: 0,
                  'data-key': `card-${c.key}`,
                  'data-clue': c.key,
                  'aria-pressed': String(this.selected === c.key),
                  'aria-label': t('aria.pinCard', { text: [p.title, p.line, p.value].join(', ') }),
                },
                this.seenAtOpen.has(c.key) ? null : h('span', { class: 'clue-new' }, t('pinboard.new')),
                c.auto ? null : h('button', { class: 'clue-discard', 'data-key': `discard-${c.key}`, onclick: () => this.discard(c.key) }, t('pinboard.discard')),
              );
              this.cardEvents(el, c.key);
              return el;
            }),
      ),
    );
  }

  private archiveView(s: GameState): HTMLElement {
    const days = core.copies(s.results);
    return h(
      'aside',
      { class: 'pb-archive', 'aria-labelledby': 'pb-archive-heading' },
      h('h3', { id: 'pb-archive-heading' }, t('pinboard.archive')),
      days.length === 0
        ? h('p', { class: 'pb-empty' }, t('pinboard.archiveEmpty'))
        : days.map((d) =>
            h(
              'section',
              { class: 'pb-archive-day' },
              h('h4', {}, t('pinboard.archiveDay', { day: d.day })),
              h(
                'ul',
                {},
                d.akten.map((id) => {
                  const akte = core.getAkte(this.host.content, id);
                  return h(
                    'li',
                    {},
                    h(
                      'button',
                      {
                        class: 'pb-copy-btn',
                        'data-key': `copy-${id}`,
                        'aria-label': t('aria.copy', { id: akteLabel(akte), name: akte.taxpayer.name }),
                        onclick: () => {
                          this.copy = id;
                          this.render('copy-close');
                        },
                      },
                      h('span', { class: 'copy-id' }, akteLabel(akte)),
                      h('span', { class: 'copy-name' }, akte.taxpayer.name),
                    ),
                  );
                }),
              ),
            ),
          ),
    );
  }

  private copyView(akteId: string): HTMLElement {
    const akte = core.getAkte(this.host.content, akteId);
    const close = h('button', { class: 'pb-copy-close', 'data-key': 'copy-close' }, t('pinboard.copyClose'));
    close.addEventListener('click', () => this.escape());
    const stampPinnable = !!akte.representative?.stampVisible;
    return h(
      'section',
      { class: 'pb-copy', role: 'group', 'aria-labelledby': 'pb-copy-heading' },
      h('header', {}, h('h3', { id: 'pb-copy-heading' }, t('pinboard.copy'), h('span', {}, akteHeading(akte))), close),
      h(
        'div',
        { class: 'pb-copy-papers' },
        akte.documents.map((doc, i) => copyPaper(doc, i, akte.id, stampPinnable, (place) => this.pin(akteId, place))),
      ),
    );
  }

  // ---------- Actions ----------

  private pin(akteId: string, place: PinPlace): void {
    const s = this.host.state();
    if (!s) return;
    const ref = core.refOnAkte(this.host.content, akteId, place);
    const r = core.pinClue(this.host.content, s, ref);
    if (r.result === 'pinned') {
      this.host.save(r.state);
      this.say('pinboard.pinned', { text: core.clueValue(this.host.content, ref) });
      this.render();
    } else if (r.result === 'already') this.say('pinboard.alreadyPinned');
  }

  private discard(key: string): void {
    const s = this.host.state();
    if (!s) return;
    this.host.save(core.discardClue(s, key));
    this.render('pb-close');
  }

  private place(key: string, questionId: string): void {
    const s = this.host.state();
    if (!s) return;
    const r = core.placeClue(this.host.content, s, key, questionId);
    if (r.result === 'invalid') return;
    if (r.result === 'wrong') {
      this.host.save(r.state);
      this.say('pinboard.wrong');
      this.shake(questionId);
      return;
    }
    this.selected = null;
    this.host.save(r.state);
    this.host.sound('paper');
    this.say(r.result === 'answered' ? 'pinboard.solvedNotice' : 'pinboard.placed');
    const next = core.hand(this.host.content, core.boardContext(r.state))[0];
    this.render(next ? `card-${next.key}` : `q-${questionId}`);
  }

  /** The question wobbles (effects „voll“ only); the card stays in the hand. */
  private shake(questionId: string): void {
    const el = this.dialog?.querySelector<HTMLElement>(`[data-question="${CSS.escape(questionId)}"]`);
    if (!el || this.host.effects() !== 'voll') return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
  }

  private select(key: string, viaKeyboard: boolean): void {
    this.selected = this.selected === key ? null : key;
    const firstOpen = this.dialog?.querySelector<HTMLElement>('.question:not(.answered)')?.dataset.key;
    this.render(this.selected && viaKeyboard && firstOpen ? firstOpen : `card-${key}`);
  }

  /** Click or Enter selects; a press that moves drags the card over the wall (listeners on `window`). */
  private cardEvents(el: HTMLElement, key: string): void {
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      this.select(key, false);
    });
    el.addEventListener('keydown', (e) => {
      if (e.target === el && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        this.select(key, true);
      }
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !e.isPrimary || (e.target as HTMLElement).closest('button')) return;
      const x0 = e.clientX;
      const y0 = e.clientY;
      let ghost: HTMLElement | null = null;
      let over: HTMLElement | null = null;
      const under = (ev: PointerEvent) =>
        document
          .elementsFromPoint(ev.clientX, ev.clientY)
          .map((n) => n.closest<HTMLElement>('.question'))
          .find((n): n is HTMLElement => !!n && !n.classList.contains('answered')) ?? null;
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        if (!ghost) {
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < DRAG_THRESHOLD) return;
          const r = el.getBoundingClientRect();
          ghost = el.cloneNode(true) as HTMLElement;
          ghost.classList.add('clue-ghost');
          ghost.removeAttribute('data-key');
          ghost.setAttribute('aria-hidden', 'true');
          ghost.style.width = `${r.width}px`;
          this.dialog?.append(ghost);
          el.classList.add('lifting');
          this.dragging = true;
        }
        ev.preventDefault();
        ghost.style.transform = `translate(${ev.clientX - 60}px, ${ev.clientY - 24}px)`;
        const u = under(ev);
        if (u !== over) {
          over?.classList.remove('over');
          over = u;
          over?.classList.add('over');
        }
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        if (!ghost) return;
        ghost.remove();
        el.classList.remove('lifting');
        over?.classList.remove('over');
        this.dragging = false;
        swallowClick();
        const target = ev.type === 'pointerup' ? under(ev) : null;
        if (target?.dataset.question) this.place(key, target.dataset.question);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }
}

// ---------- Drawer (SPEC 7.7) ----------

/** The drawer view: notes kept with `keep: "drawer"`, to read and zoom. No own save. */
export function openDrawer(notes: KeptNote[], host: Pick<BoardHost, 'sound' | 'closed'>): void {
  if (document.querySelector('dialog.drawer-dialog')) return;
  const closeBtn = h('button', { class: 'drawer-close', 'data-key': 'drawer-close' }, t('drawer.close'));
  const dialog = h(
    'dialog',
    { class: 'drawer-dialog', 'aria-modal': 'true', 'aria-labelledby': 'drawer-heading' },
    h(
      'div',
      { class: 'drawer-box' },
      h('header', {}, h('h2', { id: 'drawer-heading' }, t('drawer.title')), closeBtn),
      notes.length === 0
        ? h('p', { class: 'pb-empty' }, t('drawer.empty'))
        : h(
            'div',
            { class: 'drawer-notes' },
            notes.map((n, i) => {
              const el = h(
                'article',
                { class: 'paper drawer-note', tabindex: 0, 'data-key': `drawer-note-${i}`, 'aria-label': n.title ?? n.from, style: `rotate:${paperRotation(`lade#${i}`) / 2}deg` },
                n.title ? h('h3', {}, n.title) : null,
                h('p', {}, n.text),
                h('p', { class: 'note-from' }, t('intro.noteFrom', { from: n.from })),
              );
              el.addEventListener('dblclick', () => openZoom(el));
              el.addEventListener('keydown', (e) => {
                if (e.target === el && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  openZoom(el);
                }
              });
              return el;
            }),
          ),
    ),
  );
  const close = () => {
    dialog.close();
    dialog.remove();
    host.sound('file');
    host.closed('drawer');
  };
  closeBtn.addEventListener('click', close);
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dialog.addEventListener('keydown', (e) => e.stopPropagation());
  document.body.append(dialog);
  dialog.showModal();
  host.sound('paper');
  closeBtn.focus();
}
