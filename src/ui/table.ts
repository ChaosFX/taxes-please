import type { SoundName } from '../audio';
import * as core from '../core';
import type { CalendarContent, Content, EffectsLevel, GameState } from '../core';
import { pickDay, turnMonth } from './calendar';
import { FOLDER_ROTATION, TOOL_ROTATION, TOOL_SLOT, paperSeed, type Grab, type Placed, type TableHooks, type TableUi, type ToolId } from './desk';
import { h } from './dom';
import { openZoom, paperRotation } from './paper-interaction';
import {
  PAD,
  captureFx,
  clampToPad,
  freeSpot,
  padGrid,
  playFx,
  pressObject,
  rectOn,
  swallowClick,
  toStage,
  zoneAt,
  type Motion,
  type Point,
  type Rect,
  type Spot,
} from './stage';
import { t, type UiKey, type UiParams } from './text';

/** What the table needs from the app. */
export interface TableHost {
  content: Content;
  calendar: CalendarContent;
  state(): GameState | null;
  /** New core state: saved and rendered. */
  update(next: GameState): void;
  render(): void;
  effects(): EffectsLevel;
  sound(name: SoundName): void;
  /** Element to focus after the next render (by `data-key`). */
  focus(key: string): void;
  /** Mounts the small open codex for the desk (or returns it if already there). */
  mountBook(): HTMLElement;
  /** Takes the codex off the desk and remembers the rule read last. */
  unmountBook(): void;
  /** Opens the reading mode (SPEC 6.2). */
  openReader(): void;
  /** Presses the carried stamp onto the stamp field. */
  pressStamp(): void;
  /** Puts the carried stamp back into the holder. */
  putStampBack(): void;
}

/** Sizes used to find a free spot before an element exists. */
const TOOL_SIZE: Record<ToolId, { w: number; h: number }> = {
  codex: { w: 480, h: 360 },
  calendar: { w: 300, h: 340 },
  calculator: { w: 236, h: 340 },
};
/** Typical open folder, to find a free spot for it. */
const FOLDER_SIZE = { w: 520, h: 520 };
const NEWSPAPER_SPOT: Spot = { x: PAD.x + PAD.w - 400, y: PAD.y + PAD.h - 430 };
const MESSAGE_MS = 3200;

/**
 * The hands on the desk (SPEC 7.1 to 7.5): what a drag, a click or a key does
 * with folders, papers, tools and the newspaper. Holds where things lie
 * (`ui`); the core state stays in the app.
 */
export class Table implements TableHooks {
  readonly ui: TableUi;
  /** Live region for short messages on the stage, kept across renders. */
  readonly live: HTMLElement;
  /** The stamp in the hand: follows the pointer while carried (kept across renders). */
  readonly ghost: HTMLElement;
  /** Stamp carried, or null. */
  carrying: string | null = null;
  /** Taken by keyboard: the stamp hovers over the stamp field until the pointer moves. */
  private ghostAtField = false;
  /** True while an object is dragged: renders wait until it is dropped. */
  dragging = false;
  /** True while papers fly back and the folder closes. */
  busy = false;
  private day: number | null = null;
  private akteId: string | null = null;
  /** Folder about to be opened by the player: its spot, so `sync` opens it there. */
  private opening: { id: string; at: Spot | null } | null = null;
  private topZ = 10;
  /** Set by every render; lets `move` skip a second render. */
  private rendered = false;
  private messageTimer: ReturnType<typeof setTimeout> | undefined;
  readonly calendar: TableHooks['calendar'];

  constructor(private readonly host: TableHost) {
    this.ui = { folderOpen: false, folder: null, papers: {}, tools: {}, newspapers: {}, calendar: { ...core.calendarStart(host.content.meta), sel: [] }, opening: false };
    this.live = h('div', { class: 'desk-message', role: 'status', 'aria-live': 'polite' });
    this.ghost = h('div', { class: 'stamp-ghost', 'aria-hidden': 'true' }, h('span', { class: 'stamp-handle' }));
    this.watchStamp();
    // The view hands these on as plain callbacks.
    this.press = this.press.bind(this);
    this.activate = this.activate.bind(this);
    this.nudge = this.nudge.bind(this);
    this.zoom = this.zoom.bind(this);
    this.closeAkte = this.closeAkte.bind(this);
    this.putBack = this.putBack.bind(this);
    this.readMode = this.readMode.bind(this);
    this.file = this.file.bind(this);
    this.calendar = {
      month: (by) => {
        this.ui.calendar = turnMonth(this.ui.calendar, by);
        this.host.focus(by < 0 ? 'cal-prev' : 'cal-next');
        this.host.render();
      },
      pick: (d) => {
        this.ui.calendar = pickDay(this.ui.calendar, d);
        this.host.focus(`cal-${d.year}-${d.month}-${d.day}`);
        this.host.render();
      },
      putBack: () => this.putBack('calendar'),
    };
  }

  // ---------- Keeping the table in step with the game ----------

  /**
   * Called before every desk render. A new day clears the desk: tools closed,
   * papers in the pocket, calendar on its start month (SPEC 7.4, 7.5). A new
   * Akte starts with all papers in the pocket.
   */
  sync(state: GameState): void {
    if (state.day !== this.day) {
      this.day = state.day;
      this.akteId = null;
      if (this.ui.tools.codex) this.host.unmountBook();
      this.ui.tools = {};
      this.ui.folder = null;
      this.ui.folderOpen = false;
      this.ui.papers = {};
      this.ui.calendar = { ...core.calendarStart(this.host.content.meta), sel: [] };
      this.ui.newspapers = {};
      core.dayInfo(this.host.content, state.day).storyEvents.forEach((e, i) => {
        if (e.type === 'newspaper') this.ui.newspapers[`newspaper-${i}`] = { ...NEWSPAPER_SPOT, z: 2 };
      });
      this.topZ = 10;
    }
    const id = state.current?.akteId ?? null;
    if (id !== this.akteId) {
      this.akteId = id;
      this.ui.papers = {};
      const opened = this.opening?.id === id ? this.opening : null;
      this.opening = null;
      this.ui.folderOpen = !!opened;
      this.ui.opening = !!opened;
      this.ui.folder = opened ? { ...(opened.at ?? { x: PAD.x + 14, y: PAD.y + 14 }), z: this.raiseZ() } : id ? { x: PAD.x + 40, y: PAD.y + 40, z: this.raiseZ() } : null;
    }
  }

  /** After a render: keeps everything on the pad within its edges, starts the open book. */
  afterRender(stage: HTMLElement | null): void {
    this.ui.opening = false;
    this.rendered = true;
    if (!stage) return;
    const fit = (el: HTMLElement | null, at: Placed | null | undefined, rot: number) => {
      if (!el || !at) return;
      const p = clampToPad(el, at, rot);
      if (Math.abs(p.x - at.x) > 0.5 || Math.abs(p.y - at.y) > 0.5) {
        at.x = p.x;
        at.y = p.y;
        el.style.transform = el.style.transform.replace(/translate\([^)]*\)/, `translate(${p.x}px, ${p.y}px)`);
      }
    };
    fit(stage.querySelector<HTMLElement>('.folder.open, .desk-folder'), this.ui.folder, this.ui.folderOpen ? FOLDER_ROTATION : -1);
    for (const [i, at] of Object.entries(this.ui.papers)) fit(stage.querySelector(`[data-key="paper-${i}"]`), at, this.paperRot(Number(i)));
    for (const [tool, at] of Object.entries(this.ui.tools)) fit(stage.querySelector(`[data-fx="tool-${tool}"]`), at, TOOL_ROTATION[tool as ToolId]);
    for (const [k, at] of Object.entries(this.ui.newspapers)) fit(stage.querySelector(`[data-key="${k}"]`), at, 0);
    stage.classList.toggle('carrying', !!this.carrying);
    if (this.carrying && this.ghostAtField) this.ghostToField(stage);
  }

  // ---------- The stamp in the hand (SPEC 7.3) ----------

  /** Shows (or hides with null) the carried stamp. `byKeyboard`: it hovers over the stamp field. */
  carry(stamp: string | null, byKeyboard = false): void {
    if (!stamp && this.carrying) this.hush();
    this.carrying = stamp;
    this.ghost.className = `stamp-ghost${stamp ? ` on ${stamp}` : ''}`;
    this.ghostAtField = byKeyboard;
  }

  private ghostToField(stage: HTMLElement): void {
    const field = stage.querySelector('.folder.open .stamp-field');
    if (!field) return;
    const r = rectOn(stage, field);
    this.placeGhost({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  }

  /** The rubber of the stamp is at the pointer. */
  private placeGhost(p: Point): void {
    this.ghost.style.transform = `translate(${p.x - 28}px, ${p.y - 74}px)`;
  }

  /**
   * While a stamp is carried: it follows the pointer; a click on the stamp field
   * presses it, a click on a question chooses it, a click on the holder is handled
   * there; a click anywhere else, a right click or Escape put it back.
   */
  private watchStamp(): void {
    window.addEventListener('pointermove', (e) => {
      const stage = this.stage();
      if (!this.carrying || !stage) return;
      this.ghostAtField = false;
      this.placeGhost(toStage(stage, e));
    });
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.carrying) return;
        const target = e.target as HTMLElement;
        if (target.closest('.settings, dialog')) return;
        if (e.button === 2) return; // the contextmenu event puts it back
        // The holder, the questions and the stamp field handle their own clicks.
        if (target.closest('.rack .stamp-btn, .inquiry .option, .folder.open .stamp-field')) return;
        e.preventDefault();
        e.stopPropagation();
        swallowClick();
        this.host.putStampBack();
      },
      { capture: true },
    );
    window.addEventListener('contextmenu', (e) => {
      if (!this.carrying) return;
      e.preventDefault();
      this.host.putStampBack();
    });
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.carrying || document.querySelector('dialog[open]')) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.host.putStampBack();
          return;
        }
        // Enter presses the stamp, unless it chooses a question or confirms a typed amount.
        const target = e.target as HTMLElement;
        if (e.key === 'Enter' && !target.closest('.inquiry .option, input, textarea, select')) {
          e.preventDefault();
          e.stopPropagation();
          this.host.pressStamp();
        }
      },
      { capture: true },
    );
  }

  private raiseZ(): number {
    return ++this.topZ;
  }

  private paperRot(i: number): number {
    return paperRotation(paperSeed(this.akteId ?? '', i));
  }

  private stage(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.stage');
  }

  // ---------- Messages ----------

  /** A short message in the live region of the stage (SPEC 7.1). */
  say(key: UiKey, params: UiParams = {}): void {
    const live = this.live;
    live.textContent = '';
    live.classList.remove('show');
    // A fresh text node, so the same message is read again.
    requestAnimationFrame(() => {
      live.textContent = t(key, params);
      live.classList.add('show');
    });
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => live.classList.remove('show'), MESSAGE_MS);
  }

  /** Clears the message at once (its reason is gone). */
  hush(): void {
    clearTimeout(this.messageTimer);
    this.live.classList.remove('show');
    this.live.textContent = '';
  }

  // ---------- Animated changes ----------

  /** Changes the table (and maybe the game) so that the elements with `keys` move to their new place. */
  private move(keys: string[], motion: Motion, change: () => void, order: string[] = []): Promise<void> {
    const stage = this.stage();
    const before = stage ? captureFx(stage, keys) : new Map<string, DOMRect>();
    this.rendered = false;
    change();
    // `change` may already have rendered (a new core state); once is enough, so one-off effects survive.
    if (!this.rendered) this.host.render();
    const after = this.stage();
    return after ? playFx(after, before, this.host.effects(), motion, order) : Promise.resolve();
  }

  private fxKeyOf(what: Grab): string | null {
    switch (what.kind) {
      case 'inbox': {
        const next = this.host.state()?.queue[0];
        return next ? `akte-${next}` : null;
      }
      case 'folder':
        return this.akteKey();
      case 'paper':
        return `paper-${this.akteId}-${what.index}`;
      case 'tool':
        return `tool-${what.tool}`;
      case 'newspaper':
        return what.key;
    }
  }

  private akteKey(): string | null {
    const s = this.host.state();
    const id = s?.current?.akteId ?? s?.queue[0];
    return id ? `akte-${id}` : null;
  }

  /** The object goes back to where it was, with a message if there is a reason. */
  private reject(what: Grab, message?: UiKey): void {
    if (message) this.say(message);
    const key = this.fxKeyOf(what);
    void this.move(key ? [key] : [], 'glide', () => undefined);
  }

  // ---------- Hooks from the view ----------

  press(e: PointerEvent, what: Grab): void {
    const stage = this.stage();
    const el = e.currentTarget as HTMLElement | null;
    // While a stamp is carried nothing can be dragged (SPEC 7.3).
    if (!stage || !el || this.busy || this.dragging || this.carrying) return;
    // Grabbed while still gliding: it is where it is going.
    for (const a of el.getAnimations()) a.finish();
    const from = this.spotOf(what, el, stage);
    const rotation = this.rotationOf(what);
    pressObject(e, {
      stage,
      el,
      from,
      rotation,
      effects: this.host.effects,
      onLift: () => {
        this.dragging = true;
        el.style.zIndex = '';
        if (what.kind === 'paper' || what.kind === 'folder' || what.kind === 'inbox' || what.kind === 'newspaper') this.host.sound('paper');
        // Out of the pocket onto the stage: the paper keeps its place on screen and grows to full size.
        if (what.kind === 'paper' && !this.ui.papers[what.index]) {
          const r = rectOn(stage, el);
          stage.append(el);
          el.inert = false;
          el.classList.remove('in-pocket');
          el.classList.add('loose');
          return { x: r.x + r.w / 2 - el.offsetWidth / 2, y: r.y };
        }
        return undefined;
      },
      onDrop: (at, spot) => {
        this.dragging = false;
        this.drop(what, el, at, spot);
      },
    });
  }

  activate(what: Grab, viaKeyboard = false): void {
    if (this.busy) return;
    switch (what.kind) {
      case 'inbox':
        this.openFromInbox(null);
        return;
      case 'folder':
        this.reopen();
        return;
      case 'paper': {
        if (!this.ui.papers[what.index]) {
          this.pullOut(what.index);
          return;
        }
        if (viaKeyboard) {
          const el = this.stage()?.querySelector<HTMLElement>(`[data-key="paper-${what.index}"]`);
          if (el) openZoom(el);
          return;
        }
        this.raise(what);
        return;
      }
      case 'tool':
        if (!this.ui.tools[what.tool]) this.openTool(what.tool, null);
        return;
      case 'newspaper': {
        const el = viaKeyboard ? this.stage()?.querySelector<HTMLElement>(`[data-key="${what.key}"]`) : null;
        if (el) openZoom(el);
        else this.raise(what);
        return;
      }
    }
  }

  nudge(what: Grab, dx: number, dy: number): void {
    const at = this.placedOf(what);
    const el = document.activeElement as HTMLElement | null;
    if (!at || !el) return;
    const p = clampToPad(el, { x: at.x + dx, y: at.y + dy }, this.rotationOf(what));
    at.x = p.x;
    at.y = p.y;
    at.z = this.raiseZ();
    this.host.render();
  }

  zoom(el: HTMLElement): void {
    openZoom(el);
  }

  closeAkte(): void {
    if (!this.ui.folderOpen || this.busy) return;
    this.busy = true;
    const loose = Object.keys(this.ui.papers).map(Number);
    const keys = loose.map((i) => `paper-${this.akteId}-${i}`);
    const fx = this.host.effects();
    this.host.sound('paper');
    void this.move(keys, 'fly', () => (this.ui.papers = {}), keys).then(() => {
      // Then the cover closes; the closed folder stays where the open one lay.
      const key = this.akteKey();
      void this.move(key ? [key] : [], 'settle', () => {
        this.ui.folderOpen = false;
        if (this.ui.folder) this.ui.folder = { ...this.ui.folder, x: this.ui.folder.x + 24, y: this.ui.folder.y + 24 };
        this.busy = false;
        // Stamped: on to the button for the outbox (SPEC 7.2); else the cover, to open it again.
        this.host.focus(this.host.state()?.current?.answer.stamp ? 'folder-outbox' : 'folder');
      });
    });
    // With effects off everything above is synchronous.
    if (fx === 'aus') this.busy = false;
  }

  putBack(tool: ToolId): void {
    if (!this.ui.tools[tool]) return;
    void this.move([`tool-${tool}`], 'glide', () => {
      if (tool === 'codex') this.host.unmountBook();
      delete this.ui.tools[tool];
      this.host.focus(tool === 'codex' ? 'codex-book' : tool === 'calendar' ? 'calendar-tool' : 'calc-tool');
    });
  }

  readMode(): void {
    this.host.openReader();
  }

  // ---------- Actions ----------

  /** Folder from the inbox onto the pad; refused while an Akte lies on the desk (SPEC 7.2). */
  private openFromInbox(at: Spot | null): void {
    const s = this.host.state();
    if (!s || s.phase !== 'desk' || s.queue.length === 0) return;
    if (s.current) {
      this.reject({ kind: 'inbox' }, 'desk.oneAkteOnly');
      return;
    }
    const id = s.queue[0]!;
    const stage = this.stage();
    if (!at && stage) {
      // Click: the folder goes to a free spot, preferably on the left, so it does not cover open tools.
      const grid = padGrid(FOLDER_SIZE.w, FOLDER_SIZE.h, 32);
      at = freeSpot(FOLDER_SIZE.w, FOLDER_SIZE.h, grid, this.takenRects(stage), { x: PAD.x + 14, y: PAD.y + 14 });
    }
    void this.move([`akte-${id}`], 'open', () => {
      this.opening = { id, at };
      this.host.sound('paper');
      this.host.focus('pruefvermerk');
      this.host.update(core.drawNext(s));
    });
  }

  /** A closed folder on the desk opens again where it lies. */
  private reopen(): void {
    if (this.ui.folderOpen || !this.host.state()?.current) return;
    const key = this.akteKey();
    void this.move(key ? [key] : [], 'open', () => {
      this.ui.folderOpen = true;
      this.ui.opening = true;
      if (this.ui.folder) this.ui.folder = { ...this.ui.folder, x: this.ui.folder.x - 24, y: this.ui.folder.y - 24, z: this.raiseZ() };
      this.host.sound('paper');
      this.host.focus('pruefvermerk');
    });
  }

  /**
   * Puts the stamped, closed folder into the outbox (SPEC 7.2). An open folder or
   * one without stamp is refused with a message and stays where it is.
   */
  file(): void {
    const s = this.host.state();
    if (!s?.current || this.busy) return;
    if (this.ui.folderOpen) {
      this.reject({ kind: 'folder' }, 'desk.closeFirst');
      return;
    }
    if (s.current.answer.stamp === undefined) {
      this.reject({ kind: 'folder' }, 'desk.stampFirst');
      return;
    }
    const key = `akte-${s.current.akteId}`;
    void this.move([key], 'glide', () => {
      this.host.sound('file');
      this.host.focus('stack');
      const next = core.fileCurrent(this.host.content, s);
      this.host.update(next);
      // Filing may bring a clue for a question on the pinboard (SPEC 4).
      if (core.hasPinboard(next)) {
        const gained = core.cluesGained(this.host.content, core.boardContext(s), core.boardContext(next));
        if (gained[0]) this.say('pinboard.newClue', { text: core.clueValue(this.host.content, gained[0].ref) });
      }
    });
  }

  /** Click or Enter on a paper in the pocket: it goes to a free spot next to the folder (SPEC 7.2). */
  private pullOut(i: number): void {
    const stage = this.stage();
    if (!stage || !this.ui.folderOpen) return;
    const el = stage.querySelector<HTMLElement>(`[data-key="paper-${i}"]`);
    const folder = stage.querySelector<HTMLElement>('.folder.open');
    if (!el || !folder) return;
    const w = el.offsetWidth;
    const hgt = Math.min(el.offsetHeight, 420);
    const f = rectOn(stage, folder);
    const taken = this.takenRects(stage);
    const near: Spot[] = [
      { x: f.x + f.w + 12, y: f.y + 6 },
      { x: f.x + f.w + 12 + w + 14, y: f.y + 6 },
      { x: f.x + f.w + 12, y: f.y + 6 + hgt + 14 },
      { x: f.x + f.w + 12 + w + 14, y: f.y + 6 + hgt + 14 },
      { x: f.x - w - 12, y: f.y + 6 },
      { x: f.x + 6, y: f.y + f.h + 12 },
      { x: f.x + w + 20, y: f.y + f.h + 12 },
    ];
    const count = Object.keys(this.ui.papers).length;
    const fallback = { x: f.x + f.w + 12 + count * 26, y: f.y + 6 + count * 34 };
    const spot = freeSpot(w, hgt, [...near, ...padGrid(w, hgt, 32)], taken, fallback);
    void this.move([`paper-${this.akteId}-${i}`], 'glide', () => {
      this.ui.papers[i] = { ...clampToPad(el, spot, this.paperRot(i), { w, h: el.offsetHeight }), z: this.raiseZ() };
      this.host.sound('paper');
      this.host.focus(`paper-${i}`);
    });
  }

  /**
   * Boxes of everything lying on the pad, to find a free spot. Taken from the
   * stored spots, not from the screen, so an object still gliding counts where it
   * is going. The morning paper lies underneath: it may be covered.
   */
  private takenRects(stage: HTMLElement): Rect[] {
    const out: Rect[] = [];
    const add = (sel: string, at: Spot | null | undefined) => {
      const el = at ? stage.querySelector<HTMLElement>(sel) : null;
      if (el && at) out.push({ x: at.x, y: at.y, w: el.offsetWidth, h: el.offsetHeight });
    };
    add('.folder.open, .desk-folder', this.ui.folder);
    for (const [i, at] of Object.entries(this.ui.papers)) add(`[data-key="paper-${i}"]`, at);
    for (const [tool, at] of Object.entries(this.ui.tools)) add(`[data-fx="tool-${tool}"]`, at);
    return out;
  }

  private openTool(tool: ToolId, at: Spot | null): void {
    const s = this.host.state();
    if (!s || s.phase !== 'desk') return;
    const stage = this.stage();
    const size = TOOL_SIZE[tool];
    let spot = at;
    if (!spot && stage) {
      // Click: the tool glides to a free spot, preferably on the right of the pad.
      const grid = padGrid(size.w, size.h, 32).sort((a, b) => b.x - a.x || a.y - b.y);
      spot = freeSpot(size.w, size.h, grid, this.takenRects(stage), { x: PAD.x + PAD.w - size.w - 10, y: PAD.y + 10 });
    }
    void this.move([`tool-${tool}`], 'glide', () => {
      if (tool === 'codex') this.host.mountBook();
      this.ui.tools[tool] = { ...(spot ?? { x: PAD.x + 10, y: PAD.y + 10 }), z: this.raiseZ() };
      this.host.focus(tool === 'codex' ? 'codex-desk' : tool === 'calendar' ? 'calendar-desk' : 'calc');
    });
  }

  private raise(what: Grab): void {
    const at = this.placedOf(what);
    if (!at) return;
    at.z = this.raiseZ();
    const el = this.stage()?.querySelector<HTMLElement>(`[data-fx="${this.fxKeyOf(what)}"]`);
    if (el) el.style.zIndex = String(at.z);
  }

  // ---------- Dropping (SPEC 7.1): the zone under the pointer decides ----------

  private drop(what: Grab, el: HTMLElement, at: Point, spot: Spot): void {
    const stage = this.stage();
    const pocket = this.ui.folderOpen && stage ? stage.querySelector('.folder.open .pocket') : null;
    const zone = zoneAt(at, { pocket: pocket && stage ? rectOn(stage, pocket) : null });
    const rot = this.rotationOf(what);
    const onPad = () => ({ ...clampToPad(el, spot, rot), z: this.raiseZ() });
    const settle = (change: () => void) => void this.move([this.fxKeyOf(what)!], 'settle', change);

    switch (what.kind) {
      case 'inbox':
        if (zone?.name === 'pad') this.openFromInbox({ x: at.x - 120, y: at.y - 20 });
        else this.reject(what);
        return;
      case 'folder':
        if (zone?.name === 'pad') {
          const p = onPad();
          settle(() => (this.ui.folder = p));
        } else if (zone?.name === 'outbox') {
          this.file();
        } else this.reject(what);
        return;
      case 'paper':
        if (zone?.name === 'pocket') {
          settle(() => delete this.ui.papers[what.index]);
        } else if (zone?.name === 'pad') {
          const p = onPad();
          settle(() => (this.ui.papers[what.index] = p));
        } else this.reject(what);
        return;
      case 'tool':
        if (this.ui.tools[what.tool]) {
          if (zone?.name === 'tools') this.putBack(what.tool);
          else if (zone?.name === 'pad') {
            const p = onPad();
            settle(() => (this.ui.tools[what.tool] = p));
          } else this.reject(what);
        } else if (zone?.name === 'pad') {
          // Opened where it was let go; the open tool is larger, so it is anchored at the pointer.
          this.openTool(what.tool, { x: at.x - TOOL_SIZE[what.tool].w / 2, y: at.y - 30 });
        } else this.reject(what);
        return;
      case 'newspaper':
        if (zone?.name === 'pad') {
          const p = onPad();
          settle(() => (this.ui.newspapers[what.key] = p));
        } else this.reject(what);
        return;
    }
  }

  // ---------- Where things are ----------

  private placedOf(what: Grab): Placed | null {
    switch (what.kind) {
      case 'folder':
        return this.ui.folder;
      case 'paper':
        return this.ui.papers[what.index] ?? null;
      case 'tool':
        return this.ui.tools[what.tool] ?? null;
      case 'newspaper':
        return this.ui.newspapers[what.key] ?? null;
      case 'inbox':
        return null;
    }
  }

  private rotationOf(what: Grab): number {
    switch (what.kind) {
      case 'paper':
        return this.ui.papers[what.index] ? this.paperRot(what.index) : 0;
      case 'folder':
        return this.ui.folderOpen ? FOLDER_ROTATION : -1;
      case 'tool':
        return this.ui.tools[what.tool] ? TOOL_ROTATION[what.tool] : 0;
      case 'newspaper': {
        const ev = this.host.state() && core.dayInfo(this.host.content, this.host.state()!.day).storyEvents[Number(what.key.split('-')[1])];
        return ev?.type === 'newspaper' ? paperRotation(`zeitung#${ev.headline}`) : 0;
      }
      case 'inbox':
        return -0.6;
    }
  }

  /** Spot of an object at a press: its place on the pad, or where it sits in a rail. */
  private spotOf(what: Grab, el: HTMLElement, stage: HTMLElement): Spot {
    const placed = this.placedOf(what);
    if (placed) return placed;
    if (what.kind === 'tool') return TOOL_SLOT[what.tool];
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(el.style.transform);
    if (m && el.parentElement === stage) return { x: Number(m[1]), y: Number(m[2]) };
    const r = rectOn(stage, el);
    return { x: r.x, y: r.y };
  }
}
