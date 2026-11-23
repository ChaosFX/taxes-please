import {
  codexDays,
  codexOpenTarget,
  deliveries,
  deliveryUnseen,
  lockedDays,
  searchRules,
  toRoman,
  type CodexProgress,
  type SearchHit,
  type Span,
} from '../core/codex';
import type { Content, EffectsLevel, Rule } from '../core/types';
import { h } from './dom';
import { t } from './text';

/*
 * The codex as a book (SPEC 6). Closed it lies on the desk; open it is a modal
 * dialog with a double page (single page below 900 px).
 *
 * Page breaks: the blocks of the book (register lines, delivery heads, rules)
 * are laid out in a hidden CSS multi-column box whose columns have exactly the
 * size of a page body. The column each block lands in is its page; columns
 * avoid breaking a rule (`break-inside: avoid`) and start every delivery in a
 * new column. The blocks are then moved into real page elements, which sit side
 * by side on a strip that is moved with `translateX`. Pages that are not shown
 * are `inert` and hidden, so focus and screen readers stay on the visible pages.
 */

/** Below this window width the book shows a single page. */
export const SINGLE_PAGE_BELOW = 900;
const MAX_W = 1120;
const MAX_H = 760;
const FLIP_MS = 420;
const FADE_MS = 110;
/** Book on the desk (SPEC 6.1a): two pages of 230 × 300 inside 10 px boards; the cover opens in about 500 ms. */
const DESK_PAGE_W = 230;
const DESK_PAGE_H = 300;
const DESK_FS = 12.5;
const DESK_OPEN_MS = 500;

/** `reader`: the large book in a dialog (6.2). `desk`: the small open book lying on the desk (6.1a). */
export type BookMode = 'reader' | 'desk';

/** Buttons of the book on the desk. */
export interface DeskBookActions {
  readMode(): void;
  putBack(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Small inline SVG without text; `shapes` are [tag, attributes]. */
function svg(viewBox: string, cls: string, shapes: [string, Record<string, string>][]): SVGSVGElement {
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('viewBox', viewBox);
  el.setAttribute('class', cls);
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('focusable', 'false');
  for (const [tag, attrs] of shapes) {
    const s = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    el.append(s);
  }
  return el;
}

/** Pointing hand („Zeigefinger“) for hint rules. */
const manicule = (cls = 'manicule') =>
  svg('0 0 40 20', cls, [
    ['rect', { x: '1', y: '5', width: '7', height: '11', rx: '1.5' }],
    ['path', { d: 'M8 6.5h6l3-2.5h19a2.5 2.5 0 0 1 0 5H22v1.2h2.6a2.2 2.2 0 0 1 0 4.4H22v.6h1.8a2 2 0 0 1 0 4H14l-6-1.2z' }],
    ['path', { d: 'M22 9h-3M22 13.6h-3M22 17.4h-2', fill: 'none', 'stroke-width': '0.9' }],
  ]);

const lockIcon = () =>
  svg('0 0 12 14', 'lock', [
    ['path', { d: 'M3 6V4.2a3 3 0 0 1 6 0V6', fill: 'none', 'stroke-width': '1.6' }],
    ['rect', { x: '1.5', y: '6', width: '9', height: '7', rx: '1.2' }],
  ]);

const chevron = (dir: 'prev' | 'next') =>
  svg('0 0 16 16', 'chevron', [['path', { d: dir === 'next' ? 'M5 2l6 6-6 6' : 'M11 2L5 8l6 6', fill: 'none', 'stroke-width': '2' }]]);

const crossIcon = () => svg('0 0 16 16', 'cross', [['path', { d: 'M3.5 3.5l9 9M12.5 3.5l-9 9', fill: 'none', 'stroke-width': '1.8' }]]);

/** Fine ornamental rule below a delivery head. */
const ornament = () =>
  svg('0 0 200 12', 'ornament', [
    ['path', { d: 'M4 6h80M116 6h80', fill: 'none', 'stroke-width': '0.8' }],
    ['path', { d: 'M100 1.5l4.5 4.5-4.5 4.5-4.5-4.5z' }],
    ['circle', { cx: '88', cy: '6', r: '1.4' }],
    ['circle', { cx: '112', cy: '6', r: '1.4' }],
  ]);

/** Text with the found passages wrapped in <mark>. */
function marked(text: string, spans: readonly Span[]): (string | HTMLElement)[] {
  const out: (string | HTMLElement)[] = [];
  let at = 0;
  for (const [a, b] of spans) {
    if (a > at) out.push(text.slice(at, a));
    out.push(h('mark', { class: 'find' }, text.slice(a, b)));
    at = b;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

// ---------- Closed book on the desk (SPEC 6.1) ----------

/** The closed codex in the tool rail. Its block grows with the unlocked days; a slip „neu“ sticks out while today's delivery is unseen. Click or Enter lays it open on the desk (6.1a). */
export function closedBook(content: Content, day: number, progress: CodexProgress, onOpen: () => void): HTMLElement {
  const unlocked = codexDays(content.rules).filter((d) => d <= day).length;
  const unseen = deliveryUnseen(content.rules, day, progress);
  return h(
    'div',
    { class: 'codex-desk' },
    h(
      'button',
      {
        class: 'codex-book',
        'data-key': 'codex-book',
        'aria-label': t('codex.open'),
        'aria-description': t('aria.codexBook', { day }),
        style: `--days: ${unlocked}`,
        onclick: onOpen,
      },
      h('span', { class: 'book-edge', 'aria-hidden': 'true' }),
      h(
        'span',
        { class: 'cover' },
        h('span', { class: 'cover-spine', 'aria-hidden': 'true' }),
        h(
          'span',
          { class: 'cover-frame' },
          h('span', { class: 'cover-title' }, t('codex.coverTitle')),
          ornament(),
          h('span', { class: 'cover-subtitle' }, t('codex.coverSubtitle')),
          h('span', { class: 'cover-stand' }, t('codex.coverStand', { day })),
        ),
      ),
      unseen ? h('span', { class: 'new-slip' }, t('codex.new')) : null,
    ),
  );
}

// ---------- The open book ----------

export interface BookEnv {
  content: Content;
  day: number;
  progress: CodexProgress;
  effects: () => EffectsLevel;
  sound: (name: 'paper' | 'file') => void;
  /** A page of today's delivery has been shown for the first time. */
  onSeen: () => void;
  /** The book has closed; `lastRuleId` is the rule read last (empty: register). */
  onClose: (lastRuleId: string) => void;
  /** Opens at this rule instead of the usual place (jump from the summary, SPEC 5). */
  startRule?: string;
}

interface Page {
  el: HTMLElement;
  /** Front matter (register or hits) has roman numbers. */
  front: boolean;
  /** Delivery day of the page; null for front matter. */
  day: number | null;
  locked: boolean;
  blank: boolean;
}

/** Anchor that survives a new page layout: a rule, a delivery, a locked day or the front. */
type Anchor = { kind: 'front' } | { kind: 'rule'; id: string } | { kind: 'delivery'; day: number } | { kind: 'locked'; day: number };

/**
 * True if the content of a page body reaches below it. Measured on the last
 * block's border box: its bottom margin ends at a page break as in the columns.
 */
function overflows(body: HTMLElement): boolean {
  const last = body.lastElementChild;
  if (!last) return false;
  return last.getBoundingClientRect().bottom > body.getBoundingClientRect().bottom + 1;
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

/** Styles of the book font the pages use (regular, italic, semibold, bold); the family is `--book`. */
const BOOK_STYLES = ['400', 'italic 400', '600', '700'];
let bookFonts: Promise<unknown> | null = null;

/**
 * Loads every face of the book font once. Called at start, so the pages are measured
 * with the final metrics when the book opens (browsers load a face only on first use).
 */
export function loadBookFonts(): Promise<unknown> {
  if (!bookFonts) {
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    const family = fonts ? getComputedStyle(document.documentElement).getPropertyValue('--book').trim() : '';
    bookFonts = fonts && family ? Promise.all(BOOK_STYLES.map((st) => fonts.load(`${st} 16px ${family}`))).catch(() => undefined) : Promise.resolve();
  }
  return bookFonts;
}

export class CodexBook {
  private env: BookEnv | null = null;
  /** The dialog (reader) or the object on the desk; null while closed. */
  private host: HTMLElement | null = null;
  private dialog: HTMLDialogElement | null = null;
  private laidOut = false;
  private shell!: HTMLElement;
  private book!: HTMLElement;
  private viewport!: HTMLElement;
  private strip!: HTMLElement;
  private layer!: HTMLElement;
  private measureBox!: HTMLElement;
  private tabs!: HTMLElement;
  private ribbon!: HTMLElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;
  private search!: HTMLInputElement;
  private clearBtn!: HTMLButtonElement;
  private status!: HTMLElement;

  private pages: Page[] = [];
  private spread = 0;
  private single = false;
  private pageW = 0;
  private query = '';
  private hits: SearchHit[] = [];
  /** Page index of each rule and of the first page of each delivery / locked day. */
  private rulePage = new Map<string, number>();
  private deliveryPage = new Map<number, number>();
  private lockedPage = new Map<number, number>();
  /** Rule the ribbon marks (from the save; empty: register). */
  private ribbonRule = '';
  private seenReported = false;
  private running: Animation[] = [];
  private cleanup: (() => void)[] = [];
  private relayoutQueued = false;
  /** Where the reader jumped to (open, tab, register, hit); kept across a new layout until the next turn. */
  private target: Anchor | null = null;

  constructor(private readonly mode: BookMode = 'reader') {}

  /** Keys and ids of the book on the desk carry a prefix, so they never clash with the reader open above it. */
  private key(k: string): string {
    return this.mode === 'desk' ? `desk-${k}` : k;
  }

  get isOpen(): boolean {
    return this.host !== null;
  }

  /** The object on the desk (desk mode), or null. */
  get element(): HTMLElement | null {
    return this.mode === 'desk' ? this.host : null;
  }

  open(env: BookEnv): void {
    if (this.dialog) return;
    this.env = env;
    this.query = '';
    this.hits = [];
    this.seenReported = !deliveryUnseen(env.content.rules, env.day, env.progress);
    this.ribbonRule = env.progress.lastRuleId;
    this.build();
    this.host = this.dialog;
    document.body.append(this.dialog!);
    this.dialog!.showModal();
    this.layout(this.openAnchor());
    this.book.focus({ preventScroll: true });
    env.sound('paper');
    this.playOpen();

    const onResize = () => this.queueRelayout();
    window.addEventListener('resize', onResize);
    this.cleanup.push(() => window.removeEventListener('resize', onResize));
    this.watchFonts();
  }

  /**
   * Desk mode: builds the small open book and returns it. The caller puts it on
   * the desk; the same element is kept across re-renders. Pages are laid out
   * once it is in the document (`attached`).
   */
  mount(env: BookEnv, actions: DeskBookActions, attrs: Record<string, string>): HTMLElement {
    if (this.host) return this.host;
    this.env = env;
    this.query = '';
    this.hits = [];
    this.seenReported = !deliveryUnseen(env.content.rules, env.day, env.progress);
    this.ribbonRule = env.progress.lastRuleId;
    this.laidOut = false;
    this.buildBook();
    const readBtn = h('button', { class: 'book-tool', 'data-key': 'codex-read' }, t('codex.readMode'));
    const backBtn = h('button', { class: 'book-tool put-back', 'data-key': 'codex-putback' }, t('desk.putBack'));
    readBtn.addEventListener('click', actions.readMode);
    backBtn.addEventListener('click', actions.putBack);
    this.shell = h('div', { ...attrs, class: `${attrs.class ?? ''} desk-book`, tabindex: '0', role: 'group', 'aria-label': t('aria.codex') }, h('div', { class: 'book-tools' }, readBtn, backBtn), this.book);
    this.shell.dataset.mode = 'spread';
    this.shell.addEventListener('keydown', (e) => this.onDeskKey(e));
    this.host = this.shell;
    this.watchFonts();
    return this.shell;
  }

  /** Desk mode: lays the pages out the first time the book is in the document. */
  attached(): void {
    if (this.mode !== 'desk' || !this.host?.isConnected || this.laidOut) return;
    this.laidOut = true;
    this.layout(this.openAnchor());
    this.env!.sound('paper');
    this.playOpen();
  }

  /** Desk mode: takes the book off the desk. Returns the rule read last (empty: register). */
  unmount(): string {
    if (this.mode !== 'desk' || !this.host) return '';
    const last = this.laidOut ? this.currentRuleId() : (this.env?.progress.lastRuleId ?? '');
    this.finishAnimations();
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
    this.host.remove();
    this.host = null;
    this.env = null;
    this.laidOut = false;
    return last;
  }

  /** Rule read last on the open book (empty: register). */
  place(): string {
    return this.host && this.laidOut ? this.currentRuleId() : (this.env?.progress.lastRuleId ?? '');
  }

  /** Opens at a rule (or the register for an empty id) without turning; keeps the reading place in sync with the reader. */
  showRule(id: string): void {
    if (!this.host || !this.laidOut) {
      if (this.env) this.env = { ...this.env, progress: { ...this.env.progress, lastRuleId: id } };
      return;
    }
    this.finishAnimations();
    const anchor: Anchor = id && this.rulePage.has(id) ? { kind: 'rule', id } : { kind: 'front' };
    this.target = anchor;
    this.ribbonRule = id;
    this.spread = Math.min(this.spreadOf(this.pageOf(anchor)), this.spreadCount() - 1);
    this.show();
  }

  /** Today's delivery was seen in the reader: the desk book need not report it again. */
  markSeen(): void {
    this.seenReported = true;
  }

  private watchFonts(): void {
    // Web fonts change line breaks: lay out again once they are there. Firefox loads a face
    // only when text first uses it, so all faces of the book are asked for explicitly, and
    // any face that still arrives later (`loadingdone`) lays the book out again.
    const fonts = document.fonts;
    if (fonts) {
      Promise.all([fonts.ready, loadBookFonts()])
        .then(() => this.queueRelayout())
        .catch(() => undefined);
      const onFonts = () => this.queueRelayout();
      fonts.addEventListener('loadingdone', onFonts);
      this.cleanup.push(() => fonts.removeEventListener('loadingdone', onFonts));
    }
  }

  close(): void {
    const env = this.env;
    if (this.mode !== 'reader' || !this.dialog || !env) return;
    const last = this.currentRuleId();
    this.finishAnimations();
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
    this.dialog.close();
    this.dialog.remove();
    this.dialog = null;
    this.host = null;
    this.env = null;
    env.sound('file');
    env.onClose(last);
  }

  // ---------- Building the dialog ----------

  /** The book itself: boards, page strip, ribbon, corners. Shared by both modes. */
  private buildBook(): void {
    this.strip = h('div', { class: 'book-strip' });
    this.layer = h('div', { class: 'flip-layer', 'aria-hidden': 'true' });
    this.viewport = h('div', { class: 'book-viewport' }, this.strip, this.layer);
    this.measureBox = h('div', { class: 'book-measure', 'aria-hidden': 'true' });
    this.ribbon = h('div', { class: 'ribbon', 'aria-hidden': 'true' });
    this.prevBtn = h('button', { class: 'corner prev', 'data-key': this.key('codex-prev'), 'aria-label': t('codex.prevPage') }, chevron('prev'));
    this.nextBtn = h('button', { class: 'corner next', 'data-key': this.key('codex-next'), 'aria-label': t('codex.nextPage') }, chevron('next'));
    this.prevBtn.addEventListener('click', () => this.turn(-1));
    this.nextBtn.addEventListener('click', () => this.turn(1));
    const edgePrev = h('div', { class: 'edge prev', 'aria-hidden': 'true' });
    const edgeNext = h('div', { class: 'edge next', 'aria-hidden': 'true' });
    edgePrev.addEventListener('click', () => this.turn(-1));
    edgeNext.addEventListener('click', () => this.turn(1));
    this.book = h(
      'div',
      { class: 'book', tabindex: -1 },
      h('div', { class: 'book-board', 'aria-hidden': 'true' }),
      this.viewport,
      this.ribbon,
      edgePrev,
      edgeNext,
      this.prevBtn,
      this.nextBtn,
      this.measureBox,
    );
  }

  private build(): void {
    this.search = h('input', {
      type: 'search',
      class: 'codex-search',
      'data-key': 'codex-search',
      placeholder: t('codex.searchPlaceholder'),
      'aria-label': t('aria.codexSearch'),
      autocomplete: 'off',
      spellcheck: 'false',
    });
    this.search.addEventListener('input', () => this.setQuery(this.search.value));
    this.clearBtn = h('button', { class: 'search-clear', 'data-key': 'codex-search-clear', 'aria-label': t('codex.searchClear'), hidden: true }, crossIcon());
    this.clearBtn.addEventListener('click', () => {
      this.search.value = '';
      this.setQuery('');
      this.search.focus();
    });
    this.status = h('span', { class: 'book-status', role: 'status' });
    const closeBtn = h('button', { class: 'book-close', 'data-key': 'codex-close' }, t('codex.close'));
    closeBtn.addEventListener('click', () => this.close());

    const bar = h('div', { class: 'book-bar' }, h('div', { class: 'search-wrap' }, this.search, this.clearBtn), this.status, closeBtn);

    this.buildBook();
    this.tabs = h('nav', { class: 'register-tabs', 'aria-label': t('aria.bookmarks') });
    this.shell = h('div', { class: 'book-shell' }, bar, this.tabs, this.book);

    const dialog = h('dialog', { class: 'codex-dialog', 'aria-label': t('aria.codex'), 'aria-modal': 'true' }, this.shell);
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.close();
    });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target === this.shell) this.close();
    });
    dialog.addEventListener('keydown', (e) => this.onKey(e));
    this.addSwipe();
    this.dialog = dialog;
  }

  /** Desk mode: arrows, Page up and down, Home and End turn pages while focus is in the book. K stays with the desk. */
  private onDeskKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    const nav: Record<string, () => void> = {
      ArrowRight: () => this.turn(1),
      ArrowLeft: () => this.turn(-1),
      PageDown: () => this.turn(1),
      PageUp: () => this.turn(-1),
      Home: () => this.jump({ kind: 'front' }),
      End: () => {
        this.target = null;
        this.goSpread(this.spreadOf(this.lastReadablePage()));
      },
    };
    const action = nav[e.key];
    if (!action || !this.laidOut) return;
    e.preventDefault();
    e.stopPropagation();
    action();
  }

  private onKey(e: KeyboardEvent): void {
    // Keys the book handles never reach the desk (K would open it again at once).
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.key === 'Tab') {
      this.trapFocus(e);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const typing = isTyping(e.target);
    if ((e.key === 'k' || e.key === 'K') && !typing) {
      e.preventDefault();
      this.close();
      return;
    }
    const nav: Record<string, () => void> = {
      ArrowRight: () => this.turn(1),
      ArrowLeft: () => this.turn(-1),
      PageDown: () => this.turn(1),
      PageUp: () => this.turn(-1),
      Home: () => this.jump({ kind: 'front' }),
      End: () => {
        this.target = null;
        this.goSpread(this.spreadOf(this.lastReadablePage()));
      },
    };
    const action = nav[e.key];
    if (!action) return;
    // In the search field arrows, Home and End move the caret.
    if (typing && !(e.key === 'PageDown' || e.key === 'PageUp')) return;
    e.preventDefault();
    action();
  }

  /** Keeps Tab inside the dialog and off hidden pages. */
  private trapFocus(e: KeyboardEvent): void {
    if (!this.dialog) return;
    const focusables = [...this.dialog!.querySelectorAll<HTMLElement>('button, input, a[href], [tabindex="0"]')].filter(
      (el) => !el.closest('[inert]') && !(el as HTMLButtonElement).disabled && !el.hidden && el.getClientRects().length > 0,
    );
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement as HTMLElement | null;
    const inside = active ? focusables.includes(active) : false;
    if (e.shiftKey && (active === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  }

  private addSwipe(): void {
    let start: { x: number; y: number; id: number } | null = null;
    this.viewport.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    this.viewport.addEventListener('pointerup', (e) => {
      if (!start || start.id !== e.pointerId) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) this.turn(dx < 0 ? 1 : -1);
    });
    this.viewport.addEventListener('pointercancel', () => (start = null));
  }

  // ---------- Search ----------

  private setQuery(q: string): void {
    const env = this.env!;
    this.query = q;
    this.hits = searchRules(env.content.rules, env.day, q);
    this.clearBtn.hidden = q.trim() === '';
    this.status.textContent = q.trim() ? this.frontTitle() : '';
    this.layout({ kind: 'front' });
  }

  private hitFor(id: string): SearchHit | undefined {
    return this.hits.find((h) => h.id === id);
  }

  // ---------- Blocks ----------

  private ruleBlock(rule: Rule, today: number): HTMLElement {
    const hit = this.hitFor(rule.id);
    const fresh = rule.day === today;
    const foot = h(
      'p',
      { class: 'rule-foot' },
      h('span', { class: 'simplified' }, t('codex.simplified')),
      t('codex.sourceSeparator'),
      h('a', { href: rule.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, rule.source),
    );
    const title = h('h3', { class: 'rule-title', tabindex: -1, 'data-excerpt': '' }, marked(rule.title, hit?.titleSpans ?? []));
    const text = h('p', { class: 'rule-text', 'data-excerpt': '' }, marked(rule.text, hit?.textSpans ?? []));
    const main = rule.hint
      ? h('div', { class: 'rule-main' }, h('p', { class: 'hint-label' }, manicule(), t('codex.hint')), h('div', { class: 'hint-box' }, title, text, foot))
      : h('div', { class: 'rule-main' }, title, text, foot);
    return h(
      'article',
      { class: `blk rule${rule.hint ? ' hint-rule' : ''}${fresh ? ' fresh' : ''}`, id: this.key(`regel-${rule.id}`), 'data-rule': rule.id, 'data-day': rule.day },
      h(
        'div',
        { class: 'rule-margin' },
        h('span', { class: 'rule-id' }, hit?.byId ? h('mark', { class: 'find' }, rule.id) : rule.id),
        fresh ? h('span', { class: 'rule-new' }, t('codex.new')) : null,
      ),
      main,
    );
  }

  private bodyBlocks(): HTMLElement[] {
    const env = this.env!;
    const out: HTMLElement[] = [];
    for (const d of deliveries(env.content.rules, env.day)) {
      out.push(h('div', { class: 'blk delivery-head', 'data-delivery': d.day, 'data-day': d.day }, h('h2', {}, t('codex.deliveryHeading', { day: d.day })), ornament()));
      for (const r of d.rules) out.push(this.ruleBlock(r, env.day));
    }
    return out;
  }

  private leader(page: string): HTMLElement[] {
    return [h('span', { class: 'leader', 'aria-hidden': 'true' }), h('span', { class: 'toc-page' }, page)];
  }

  private registerBlocks(): HTMLElement[] {
    const env = this.env!;
    const out: HTMLElement[] = [h('h2', { class: 'blk front-title' }, this.frontTitle())];
    for (const d of deliveries(env.content.rules, env.day)) {
      const dp = this.deliveryPage.get(d.day)!;
      out.push(
        h(
          'button',
          { class: 'blk toc-group', 'data-key': this.key(`toc-day-${d.day}`), 'data-day': d.day, onclick: () => this.jump({ kind: 'delivery', day: d.day }) },
          h('span', { class: 'toc-label' }, t('codex.deliveryHeading', { day: d.day })),
          this.leader(this.folio(dp)),
        ),
      );
      for (const r of d.rules) {
        const p = this.rulePage.get(r.id)!;
        out.push(
          h(
            'button',
            { class: 'blk toc-line', 'data-key': this.key(`toc-${r.id}`), 'data-rule-id': r.id, onclick: () => this.goRule(r.id) },
            h('span', { class: 'toc-id' }, r.id),
            h('span', { class: 'toc-title' }, r.title, r.hint ? h('span', { class: 'toc-hint', role: 'img', 'aria-label': t('codex.hint') }, manicule('manicule small')) : null),
            this.leader(this.folio(p)),
          ),
        );
      }
    }
    for (const d of lockedDays(env.content.rules, env.day)) {
      out.push(h('p', { class: 'blk toc-locked' }, h('span', { class: 'toc-label' }, lockIcon(), t('codex.locked', { day: d })), this.leader(this.folio(this.lockedPage.get(d)!))));
    }
    return out;
  }

  /** Title of the front matter: the register, or the number of hits while searching. */
  private frontTitle(): string {
    if (!this.query.trim()) return t('codex.register');
    return this.hits.length ? t('codex.hits', { count: this.hits.length }) : t('codex.noHits');
  }

  private hitBlocks(): HTMLElement[] {
    const out: HTMLElement[] = [h('h2', { class: 'blk front-title' }, this.frontTitle())];
    for (const hit of this.hits) {
      out.push(
        h(
          'button',
          { class: 'blk search-hit', 'data-key': `hit-${hit.id}`, onclick: () => this.goRule(hit.id, true) },
          h(
            'span',
            { class: 'hit-head' },
            h('span', { class: 'toc-id' }, hit.id),
            h('span', { class: 'hit-title', 'data-excerpt': '' }, marked(hit.title, hit.titleSpans)),
            hit.hint ? h('span', { class: 'toc-hint', role: 'img', 'aria-label': t('codex.hint') }, manicule('manicule small')) : null,
          ),
          h('span', { class: 'hit-day' }, t('codex.deliveryHeading', { day: hit.day })),
          h(
            'span',
            { class: `hit-snippet${hit.snippetCutStart ? ' cut-start' : ''}${hit.snippetCutEnd ? ' cut-end' : ''}`, 'data-excerpt': '' },
            marked(hit.snippet, hit.snippetSpans),
          ),
        ),
      );
    }
    return out;
  }

  // ---------- Layout ----------

  /** Arabic folio of a page index (body), roman for the front. */
  private folio(index: number): string {
    const frontCount = this.pages.filter((p) => p.front).length;
    return index < frontCount ? toRoman(index + 1) : String(index - frontCount + 1);
  }

  private queueRelayout(): void {
    if (this.relayoutQueued || !this.host) return;
    if (this.mode === 'desk' && !this.laidOut) return;
    this.relayoutQueued = true;
    requestAnimationFrame(() => {
      this.relayoutQueued = false;
      if (this.host?.isConnected) this.layout(this.target ?? this.anchor());
    });
  }

  /** Book size from the window (SPEC 6.2): at most 1120 × 760, single page below 900 px. On the desk a fixed small double page (6.1a). */
  private sizeBook(): void {
    if (this.mode === 'desk') {
      this.single = false;
      this.pageW = DESK_PAGE_W;
      const s = this.shell.style;
      s.setProperty('--book-w', `${DESK_PAGE_W * 2 + 20}px`);
      s.setProperty('--book-h', `${DESK_PAGE_H + 20}px`);
      s.setProperty('--page-w', `${DESK_PAGE_W}px`);
      s.setProperty('--page-h', `${DESK_PAGE_H}px`);
      s.setProperty('--book-fs', `${DESK_FS}px`);
      return;
    }
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    this.single = vw < SINGLE_PAGE_BELOW;
    this.shell.dataset.mode = this.single ? 'single' : 'spread';
    const bar = (this.shell.querySelector('.book-bar') as HTMLElement).offsetHeight;
    const tabsW = this.single ? 0 : 84;
    const tabsH = this.single ? this.tabs.offsetHeight + 4 : 0;
    const board = 10;
    // Double page: the tabs stand right of the book and the same width is kept free on the left, so the book stays centred.
    const bookW = Math.floor(Math.min(this.single ? 640 : MAX_W, vw - (this.single ? 16 : 24 + 2 * tabsW)));
    const bookH = Math.floor(Math.min(MAX_H, vh - bar - tabsH - 28));
    const pageW = Math.floor((bookW - 2 * board) / (this.single ? 1 : 2));
    const pageH = bookH - 2 * board;
    this.pageW = pageW;
    const fs = Math.max(14, Math.min(17.5, pageW / 30));
    const s = this.shell.style;
    s.setProperty('--book-w', `${pageW * (this.single ? 1 : 2) + 2 * board}px`);
    s.setProperty('--book-h', `${bookH}px`);
    s.setProperty('--page-w', `${pageW}px`);
    s.setProperty('--page-h', `${pageH}px`);
    s.setProperty('--book-fs', `${fs.toFixed(2)}px`);
  }

  /**
   * Breaks `blocks` into pages: a hidden column box with the size of a page
   * body places them; the start column of each block is its page.
   */
  /**
   * Distributes blocks onto pages. Every delivery starts on a new page (SPEC 6.3); the
   * break is forced here, because not every browser honours `break-before: column`
   * in a multi-column box (Firefox puts two short deliveries on one page).
   */
  private paginate(blocks: HTMLElement[], side: 'left' | 'right'): HTMLElement[][] {
    const runs: HTMLElement[][] = [];
    for (const b of blocks) {
      if (runs.length === 0 || b.classList.contains('delivery-head')) runs.push([]);
      runs[runs.length - 1]!.push(b);
    }
    return runs.flatMap((run) => this.paginateRun(run, side));
  }

  /** Pages for blocks that may share pages, measured in a probe page with CSS columns. */
  private paginateRun(blocks: HTMLElement[], side: 'left' | 'right'): HTMLElement[][] {
    const probe = this.pageShell(side, false);
    this.measureBox.replaceChildren(probe);
    const body = probe.querySelector('.page-body') as HTMLElement;
    const w = body.clientWidth;
    const hgt = body.clientHeight;
    const gap = 48;
    const cols = h('div', { class: 'measure-cols' });
    cols.style.cssText = `width:${w}px;height:${hgt}px;column-width:${w}px;column-count:1;column-gap:${gap}px;column-fill:auto;`;
    cols.append(...blocks);
    // Inside the probe page, so the blocks get the page's type size and line height.
    body.replaceChildren(cols);
    // Every column has its own x position; blocks sharing it share a page. Grouping by
    // position needs no assumption about the column pitch the browser chose.
    const pages = new Map<number, HTMLElement[]>();
    for (const b of blocks) {
      const r = b.getClientRects()[0] ?? b.getBoundingClientRect();
      const x = Math.round(r.left);
      const near = [...pages.keys()].find((k) => Math.abs(k - x) <= 2) ?? x;
      if (!pages.has(near)) pages.set(near, []);
      pages.get(near)!.push(b);
    }
    this.measureBox.replaceChildren();
    return [...pages.keys()].sort((a, b) => a - b).map((k) => pages.get(k)!);
  }

  private pageShell(side: 'left' | 'right', fresh: boolean): HTMLElement {
    return h(
      'section',
      { class: `page ${side}${fresh ? ' fresh' : ''}` },
      h('header', { class: 'running-head', 'aria-hidden': 'true' }),
      h('div', { class: 'page-body' }),
      h('footer', { class: 'folio' }),
    );
  }

  /** Lays the whole book out again and shows the page of `anchor`. */
  private layout(anchor: Anchor): void {
    const env = this.env!;
    this.target = anchor;
    this.finishAnimations();
    this.sizeBook();
    this.renderTabs();
    this.sizeBook(); // the tab row height may change with the mode

    // Body first: the register needs its folios. Body folios count from 1 after the front
    // matter, so they do not depend on how long the front is (SPEC 6.3).
    const bodyPages = this.paginate(this.bodyBlocks(), 'right');
    const locked = lockedDays(env.content.rules, env.day);
    const index = (frontLen: number) => {
      this.rulePage.clear();
      this.deliveryPage.clear();
      this.lockedPage.clear();
      bodyPages.forEach((blocks, i) => {
        for (const b of blocks) {
          const d = b.dataset.delivery;
          if (d && !this.deliveryPage.has(Number(d))) this.deliveryPage.set(Number(d), frontLen + i);
          if (b.dataset.rule) this.rulePage.set(b.dataset.rule, frontLen + i);
        }
      });
      locked.forEach((d, i) => this.lockedPage.set(d, frontLen + bodyPages.length + i));
    };
    // With no front pages yet, `folio` of a body index is index + 1, which is its final folio.
    this.pages = [];
    index(0);
    const frontPages = this.paginate(this.query.trim() ? this.hitBlocks() : this.registerBlocks(), 'left');
    index(frontPages.length);

    // Build pages.
    const pages: Page[] = [];
    frontPages.forEach((blocks) => pages.push(this.makePage(blocks, { front: true, day: null, locked: false, blank: false })));
    let current: number | null = null;
    for (const blocks of bodyPages) {
      const d = blocks.find((b) => b.dataset.delivery)?.dataset.delivery ?? blocks[0]?.dataset.day;
      if (d) current = Number(d);
      pages.push(this.makePage(blocks, { front: false, day: current, locked: false, blank: false }));
    }
    for (const d of locked) pages.push(this.lockedSheet(d));
    if (!this.single && pages.length % 2 === 1) pages.push(this.makePage([], { front: false, day: null, locked: false, blank: true }));
    this.pages = pages;

    // Pages that still overflow get split after their last fitting block.
    this.splitOverflow();
    this.decoratePages();

    this.strip.replaceChildren(...this.pages.map((p) => p.el));
    this.pages.forEach((p, i) => (p.el.style.left = `${i * this.pageW}px`));
    this.spread = Math.min(this.spreadOf(this.pageOf(anchor)), this.spreadCount() - 1);
    this.show();
  }

  private makePage(blocks: HTMLElement[], info: Omit<Page, 'el'>): Page {
    const today = this.env!.day;
    const el = this.pageShell('right', info.day === today && !info.front);
    if (info.blank) el.classList.add('blank');
    (el.querySelector('.page-body') as HTMLElement).append(...blocks);
    return { el, ...info };
  }

  private lockedSheet(day: number): Page {
    const page = this.makePage([], { front: false, day, locked: true, blank: false });
    page.el.classList.add('locked');
    page.el.setAttribute('aria-description', t('aria.lockedPage'));
    (page.el.querySelector('.page-body') as HTMLElement).append(
      h('div', { class: 'locked-sheet', 'data-locked': day }, lockIcon(), h('p', { class: 'locked-print' }, t('codex.locked', { day })), h('p', { class: 'locked-note' }, t('codex.lockedSheet'))),
    );
    return page;
  }

  /** Safety net: a page whose blocks do not fit (rare rounding) passes its last blocks on to a new page. */
  private splitOverflow(): void {
    this.measureBox.replaceChildren();
    const probeStrip = h('div', { class: 'measure-strip' });
    this.measureBox.append(probeStrip);
    const out: Page[] = [];
    for (const p of this.pages) {
      probeStrip.replaceChildren(p.el);
      const body = p.el.querySelector('.page-body') as HTMLElement;
      out.push(p);
      if (p.locked || p.blank) continue;
      const moved: HTMLElement[] = [];
      while (overflows(body) && body.children.length > 1) {
        const last = body.lastElementChild as HTMLElement;
        last.remove();
        moved.unshift(last);
      }
      if (moved.length) out.push(this.makePage(moved, { front: p.front, day: p.day, locked: false, blank: false }));
      else if (overflows(body)) body.classList.add('overflowing');
    }
    probeStrip.remove();
    if (out.length !== this.pages.length) {
      // Indices moved: rebuild the lookup tables and, for an even spread, the filler page.
      const filtered = out.filter((p) => !p.blank);
      if (!this.single && filtered.length % 2 === 1) filtered.push(this.makePage([], { front: false, day: null, locked: false, blank: true }));
      this.pages = filtered;
      this.rulePage.clear();
      this.deliveryPage.clear();
      this.lockedPage.clear();
      this.pages.forEach((p, i) => {
        for (const b of p.el.querySelectorAll<HTMLElement>('[data-rule]')) if (!this.rulePage.has(b.dataset.rule!)) this.rulePage.set(b.dataset.rule!, i);
        for (const b of p.el.querySelectorAll<HTMLElement>('[data-delivery]')) this.deliveryPage.set(Number(b.dataset.delivery), i);
        const l = p.el.querySelector<HTMLElement>('[data-locked]');
        if (l) this.lockedPage.set(Number(l.dataset.locked), i);
      });
      this.refreshFolios();
    }
  }

  /** Page numbers in the register after pages moved. */
  private refreshFolios(): void {
    for (const p of this.pages) {
      if (!p.front) continue;
      for (const btn of p.el.querySelectorAll<HTMLElement>('.toc-line')) {
        const id = btn.dataset.ruleId!;
        btn.querySelector('.toc-page')!.textContent = this.folio(this.rulePage.get(id)!);
      }
      for (const btn of p.el.querySelectorAll<HTMLElement>('.toc-group')) {
        const d = Number(btn.dataset.day);
        btn.querySelector('.toc-page')!.textContent = this.folio(this.deliveryPage.get(d)!);
      }
    }
  }

  /** Sides, running heads, folios and region names. */
  private decoratePages(): void {
    this.pages.forEach((p, i) => {
      const side = this.single || i % 2 === 1 ? 'right' : 'left';
      p.el.classList.remove('left', 'right');
      p.el.classList.add(side);
      p.el.dataset.page = String(i);
      const head = p.el.querySelector('.running-head') as HTMLElement;
      const folio = p.el.querySelector('.folio') as HTMLElement;
      if (p.blank) {
        p.el.setAttribute('aria-hidden', 'true');
        head.replaceChildren();
        folio.replaceChildren();
        return;
      }
      const n = this.folio(i);
      p.el.setAttribute('role', 'region');
      p.el.setAttribute('aria-label', t('aria.codexPage', { n }));
      head.replaceChildren(
        h('span', { class: 'head-left' }, t('codex.runningHeadLeft')),
        h('span', { class: 'head-right' }, p.front ? this.frontTitle() : t('codex.runningHeadRight', { day: p.day ?? 0 })),
      );
      folio.replaceChildren(h('span', { class: p.front ? 'roman' : 'arabic' }, n));
    });
  }

  // ---------- Navigation ----------

  private spreadOf(page: number): number {
    return this.single ? page : Math.floor(page / 2);
  }

  private spreadCount(): number {
    return this.single ? this.pages.length : Math.ceil(this.pages.length / 2);
  }

  private visibleIndices(spread = this.spread): number[] {
    return this.single ? [spread] : [2 * spread, 2 * spread + 1].filter((i) => i < this.pages.length);
  }

  private lastReadablePage(): number {
    let last = 0;
    this.pages.forEach((p, i) => {
      if (!p.locked && !p.blank) last = i;
    });
    return last;
  }

  private pageOf(anchor: Anchor): number {
    switch (anchor.kind) {
      case 'front':
        return 0;
      case 'rule':
        return this.rulePage.get(anchor.id) ?? 0;
      case 'delivery':
        return this.deliveryPage.get(anchor.day) ?? 0;
      case 'locked':
        return this.lockedPage.get(anchor.day) ?? 0;
    }
  }

  private openAnchor(): Anchor {
    const env = this.env!;
    if (env.startRule && env.content.rules.some((r) => r.id === env.startRule && r.day <= env.day)) return { kind: 'rule', id: env.startRule };
    const target = codexOpenTarget(env.content.rules, env.day, env.progress);
    return target.kind === 'register' ? { kind: 'front' } : target;
  }

  /** What the reader looks at now, to keep the place across a new layout. */
  private anchor(): Anchor {
    const idx = this.visibleIndices();
    const pages = idx.map((i) => this.pages[i]!);
    if (pages.some((p) => p.front)) return { kind: 'front' };
    const rule = pages.flatMap((p) => [...p.el.querySelectorAll<HTMLElement>('[data-rule]')])[0];
    if (rule) return { kind: 'rule', id: rule.dataset.rule! };
    const lockedPage = pages.find((p) => p.locked);
    if (lockedPage?.day) return { kind: 'locked', day: lockedPage.day };
    return { kind: 'front' };
  }

  /** Rule read last: the first rule on the visible pages, else the last one before them; empty on the register. */
  private currentRuleId(): string {
    const env = this.env!;
    if (this.target?.kind === 'rule') return this.target.id;
    if (this.target?.kind === 'delivery') {
      const day = this.target.day;
      const first = deliveries(env.content.rules, env.day).find((d) => d.day === day)?.rules[0];
      if (first) return first.id;
    }
    const a = this.anchor();
    if (a.kind === 'rule') return a.id;
    if (a.kind === 'front') return '';
    const first = this.visibleIndices()[0] ?? 0;
    for (let i = first - 1; i >= 0; i--) {
      const rules = this.pages[i]!.el.querySelectorAll<HTMLElement>('[data-rule]');
      if (rules.length) return rules[rules.length - 1]!.dataset.rule!;
    }
    return '';
  }

  private turn(dir: 1 | -1): void {
    this.target = null;
    this.goSpread(this.spread + dir);
  }

  /** Jumps to an anchor and keeps it as the place to hold across a new layout. */
  private jump(anchor: Anchor): void {
    this.target = anchor;
    const spread = this.spreadOf(this.pageOf(anchor));
    if (spread === this.spread) this.flashAnchor(anchor);
    else this.goSpread(spread);
    this.updateTabs();
  }

  /** The place jumped to is already open: let its heading blink once, so the click visibly did something. */
  private flashAnchor(anchor: Anchor): void {
    if (this.env!.effects() === 'aus' || anchor.kind === 'rule') return;
    const page = this.pages[this.pageOf(anchor)]?.el;
    const el =
      anchor.kind === 'delivery'
        ? page?.querySelector<HTMLElement>(`[data-delivery="${anchor.day}"]`)
        : anchor.kind === 'locked'
          ? page?.querySelector<HTMLElement>('.locked-sheet')
          : page?.querySelector<HTMLElement>('.front-title');
    if (!el || typeof el.animate !== 'function') return;
    this.track(el.animate([{ opacity: 1 }, { opacity: 0.25 }, { opacity: 1 }], { duration: 420, easing: 'ease-in-out' }));
  }

  private goRule(id: string, fromSearch = false): void {
    const p = this.rulePage.get(id);
    if (p === undefined) return;
    this.jump({ kind: 'rule', id });
    const title = this.pages[p]!.el.querySelector<HTMLElement>(`[data-rule="${CSS.escape(id)}"] .rule-title`);
    title?.focus({ preventScroll: true });
    if (fromSearch) this.pages[p]!.el.querySelector(`[data-rule="${CSS.escape(id)}"]`)?.classList.add('found');
  }

  private goSpread(target: number): void {
    const next = Math.max(0, Math.min(target, this.spreadCount() - 1));
    if (next === this.spread) return;
    const dir = next > this.spread ? 1 : -1;
    const before = this.visibleIndices().map((i) => this.pages[i]!.el);
    this.spread = next;
    this.show();
    this.env!.sound('paper');
    this.playFlip(before, dir);
  }

  /** Shows the current spread: strip position, inert, buttons, tabs, ribbon, „seen“. */
  private show(): void {
    const env = this.env!;
    const visible = new Set(this.visibleIndices());
    this.strip.style.transform = `translateX(${-this.spread * this.pageW * (this.single ? 1 : 2)}px)`;
    this.pages.forEach((p, i) => {
      const on = visible.has(i);
      p.el.inert = !on;
      p.el.classList.toggle('shown', on);
    });
    this.prevBtn.disabled = this.spread === 0;
    this.nextBtn.disabled = this.spread >= this.spreadCount() - 1;
    for (const p of this.strip.querySelectorAll('.rule.found')) p.classList.remove('found');

    // Focus never stays on a page that is no longer visible.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('[inert]')) this.book.focus({ preventScroll: true });

    const shownDays = [...visible].map((i) => this.pages[i]!).filter((p) => !p.front && !p.locked).map((p) => p.day);
    if (!this.seenReported && shownDays.includes(env.day)) {
      this.seenReported = true;
      env.onSeen();
    }
    this.updateTabs();
    this.placeRibbon();
  }

  // ---------- Register tabs (SPEC 6.5) ----------

  private renderTabs(): void {
    if (this.mode === 'desk') return;
    const env = this.env!;
    const tabs: HTMLElement[] = [
      h('button', { class: 'tab tab-register', 'data-key': 'tab-register', onclick: () => this.jump({ kind: 'front' }) }, t('codex.tabRegister')),
    ];
    for (const d of codexDays(env.content.rules)) {
      if (d > env.day) {
        tabs.push(
          h(
            'button',
            { class: 'tab locked', 'data-key': `tab-${d}`, 'data-day': d, 'aria-disabled': 'true', 'aria-label': t('codex.locked', { day: d }) },
            lockIcon(),
            h('span', { class: 'tab-label' }, t('codex.day', { day: d })),
          ),
        );
      } else {
        tabs.push(
          h(
            'button',
            { class: 'tab', 'data-key': `tab-${d}`, 'data-day': d, onclick: () => this.jump({ kind: 'delivery', day: d }) },
            h('span', { class: 'tab-label' }, t('codex.day', { day: d })),
            d === env.day ? h('span', { class: 'tab-new' }, t('codex.new')) : null,
          ),
        );
      }
    }
    this.tabs.replaceChildren(...tabs);
  }

  private updateTabs(): void {
    if (this.mode === 'desk') return;
    const pages = this.visibleIndices().map((i) => this.pages[i]!);
    const front = pages[0]?.front ?? false;
    // The delivery jumped to, if it is on the spread; else the first one shown.
    const env = this.env!;
    const t = this.target;
    const targetDay = t?.kind === 'delivery' ? t.day : t?.kind === 'rule' ? env.content.rules.find((r) => r.id === t.id)?.day : undefined;
    const days = pages.filter((p) => !p.front && p.day !== null && !p.blank && !p.locked).map((p) => p.day!);
    // A delivery jumped to wins over the register sharing its spread (Tag 1 often faces the last register page).
    const jumped = targetDay !== undefined && days.includes(targetDay) && t?.kind !== 'front';
    const day = jumped ? targetDay : front ? null : (days[0] ?? null);
    for (const tab of this.tabs.querySelectorAll<HTMLElement>('.tab')) {
      const current = tab.classList.contains('tab-register') ? day === null && front : tab.dataset.day === String(day) && !tab.classList.contains('locked');
      if (current) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    const slip = this.tabs.querySelector('.tab-new');
    if (slip && this.seenReported) slip.remove();
  }

  // ---------- Ribbon (SPEC 6.5) ----------

  private placeRibbon(): void {
    const page = this.ribbonRule ? (this.rulePage.get(this.ribbonRule) ?? 0) : 0;
    const vis = this.visibleIndices();
    const on = vis.indexOf(page);
    this.ribbon.classList.toggle('lying', on !== -1);
    this.ribbon.classList.toggle('on-right', on === 1 || (this.single && on === 0));
    this.ribbon.classList.toggle('on-left', !this.single && on === 0);
  }

  // ---------- Motion (SPEC 6.2, 6.5): transform and opacity only ----------

  private finishAnimations(): void {
    for (const a of this.running) a.finish();
    this.running = [];
    this.layer?.replaceChildren();
  }

  /** A copy of a page for the animation: no ids, no keys, not focusable, not read. */
  private ghost(el: HTMLElement, x: number): HTMLElement {
    const c = el.cloneNode(true) as HTMLElement;
    for (const n of [c, ...c.querySelectorAll<HTMLElement>('[id], [data-key], [role], [aria-label]')]) {
      n.removeAttribute('id');
      n.removeAttribute('data-key');
      n.removeAttribute('role');
      n.removeAttribute('aria-label');
      n.removeAttribute('aria-description');
    }
    c.inert = true;
    c.classList.add('shown', 'ghost');
    c.style.left = `${x}px`;
    return c;
  }

  private track(a: Animation, done?: () => void): void {
    this.running.push(a);
    a.finished
      .then(() => {
        this.running = this.running.filter((x) => x !== a);
        done?.();
        if (this.running.length === 0) this.layer.replaceChildren();
      })
      .catch(() => undefined);
  }

  private playOpen(): void {
    const fx = this.env!.effects();
    if (fx === 'aus' || typeof this.book.animate !== 'function') return;
    if (fx === 'reduziert') {
      this.track(this.book.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-out' }));
      return;
    }
    const cover = h('div', { class: 'cover-leaf' }, h('div', { class: 'cover-leaf-front' }), h('div', { class: 'cover-leaf-back' }));
    cover.style.left = this.single ? '0px' : `${this.pageW}px`;
    this.layer.append(cover);
    this.track(
      cover.animate(
        [
          { transform: 'rotateY(0deg)', opacity: 1 },
          { transform: 'rotateY(-150deg)', opacity: 1, offset: 0.75 },
          { transform: 'rotateY(-180deg)', opacity: 0 },
        ],
        { duration: this.mode === 'desk' ? DESK_OPEN_MS : FLIP_MS, easing: 'cubic-bezier(.45,.05,.3,1)' },
      ),
    );
  }

  private playFlip(before: HTMLElement[], dir: 1 | -1): void {
    const fx = this.env!.effects();
    this.finishAnimations();
    if (fx === 'aus' || typeof this.layer.animate !== 'function' || before.length === 0) return;
    const after = this.visibleIndices().map((i) => this.pages[i]!.el);
    const w = this.pageW;

    if (fx === 'reduziert') {
      const ghosts = before.map((el, i) => this.ghost(el, i * w));
      this.layer.append(...ghosts);
      for (const g of ghosts) this.track(g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'linear' }));
      return;
    }

    const leaf = h('div', { class: 'leaf' });
    const shade = h('div', { class: 'turn-shadow' });
    if (this.single) {
      const front = this.ghost(dir === 1 ? before[0]! : after[0]!, 0);
      leaf.append(front, h('div', { class: 'leaf-shade' }));
      leaf.style.left = '0px';
      leaf.style.transformOrigin = 'left center';
      shade.style.left = '0px';
      this.layer.append(shade, leaf);
      const frames = [{ transform: 'rotateY(0deg)', opacity: 1 }, { transform: 'rotateY(-60deg)', opacity: 1, offset: 0.6 }, { transform: 'rotateY(-96deg)', opacity: 0 }];
      this.track(leaf.animate(dir === 1 ? frames : [...frames].reverse(), { duration: FLIP_MS, easing: 'cubic-bezier(.4,.1,.3,1)' }));
      this.track(shade.animate([{ opacity: 0 }, { opacity: 0.45, offset: 0.4 }, { opacity: 0 }], { duration: FLIP_MS }));
      return;
    }

    // Double page: the turning leaf carries the old outer page in front and the new facing page behind.
    const forward = dir === 1;
    const oldStay = forward ? before[0] : before[1];
    const oldTurn = forward ? before[1] : before[0];
    const newBack = forward ? after[0] : after[1];
    if (oldStay) this.layer.append(this.ghost(oldStay, forward ? 0 : w));
    const front = oldTurn ? this.ghost(oldTurn, 0) : h('div', { class: 'page blank shown ghost' });
    const back = newBack ? this.ghost(newBack, 0) : h('div', { class: 'page blank shown ghost' });
    back.classList.add('leaf-back');
    leaf.append(front, back, h('div', { class: 'leaf-shade' }));
    leaf.style.left = forward ? `${w}px` : '0px';
    leaf.style.transformOrigin = forward ? 'left center' : 'right center';
    shade.style.left = forward ? `${w}px` : '0px';
    this.layer.append(shade, leaf);
    const end = forward ? -180 : 180;
    this.track(
      leaf.animate([{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${end / 2}deg)`, offset: 0.5 }, { transform: `rotateY(${end}deg)` }], {
        duration: FLIP_MS,
        easing: 'cubic-bezier(.45,.05,.35,1)',
      }),
    );
    const leafShade = leaf.querySelector('.leaf-shade') as HTMLElement;
    this.track(leafShade.animate([{ opacity: 0 }, { opacity: 0.5, offset: 0.5 }, { opacity: 0 }], { duration: FLIP_MS }));
    this.track(shade.animate([{ opacity: 0.5 }, { opacity: 0 }], { duration: FLIP_MS, easing: 'ease-in' }));
  }
}
