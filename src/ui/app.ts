import { createSound } from '../audio';
import * as core from '../core';
import type { CalendarContent, Content, EffectsLevel, GameState, Settings } from '../core';
import * as atmosphere from './atmosphere';
import { CodexBook, loadBookFonts, type BookEnv } from './codex';
import { deskView, markOpen, type DeskActions, type DeskEvent, type DeskUi } from './desk';
import { PencilMarks } from './pencil';
import { PinboardView, openDrawer } from './pinboard';
import { h } from './dom';
import { EFFECT_LEVELS, applyEffects, defaultSettings, loadSavedGame, loadSettings, saveSettings } from './settings';
import { fitPaperLines } from './paper-interaction';
import { fitStage, stageScale } from './stage';
import { Table } from './table';
import { t, type UiKey } from './text';
import { actEndView, introView, prologueView, startView, summaryView, type ScreenActions } from './views';

type Screen = 'start' | 'game';

const EFFECT_LABELS = {
  aus: 'settings.effectsAus',
  reduziert: 'settings.effectsReduziert',
  voll: 'settings.effectsVoll',
} as const satisfies Record<EffectsLevel, UiKey>;

/** Holds the core state, wires DOM events to core actions and re-renders. */
export function startApp(root: HTMLElement, content: Content, calendar: CalendarContent): void {
  // The codex measures its pages with the book font: have all its faces ready early.
  void loadBookFonts();
  const store = core.browserStorage();
  let screen: Screen = 'start';
  let state: GameState | null = null;
  let settings: Settings = loadSettings(store) ?? loadSavedGame(store, content)?.settings ?? defaultSettings();
  let settingsOpen = false;
  let stampFx = false;
  /** Element to focus after the next render instead of the previously focused one. */
  let focusNext: string | null = null;
  /** Day whose phone call has rung, so re-renders of the intro do not ring again. */
  let rungFor: number | null = null;
  /** Event at the desk whose call has rung (`day-index`). */
  let rungEvent: string | null = null;
  /** Screen of the prologue shown (not saved: a reload starts the prologue again). */
  let prologueStep = 0;
  const book = new CodexBook('reader');
  /** The small open codex on the desk (SPEC 6.1a); kept across renders while it lies there. */
  const deskBook = new CodexBook('desk');
  const deskUi: DeskUi = { akteId: null, pending: null, inquiryOpen: false, inquiryChoice: null, carrying: null, calc: core.CALC_INITIAL };
  /** Pencil loops on the chosen options of the Prüfvermerk (SPEC 7); a new loop scratches. */
  const pencil = new PencilMarks(() => sound.play('pencil'));
  /** A render asked for while an object is dragged waits for the drop. */
  let renderWaiting = false;

  applyEffects(settings.effects);
  const sound = createSound(settings.volume, settings.music);
  // Browsers only allow audio after a user gesture.
  const unlock = () => sound.unlock();
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });

  const update = (next: GameState) => {
    const changed = next !== state;
    state = next;
    if (changed) core.saveGame(store, state);
    render();
  };

  function setEffects(level: EffectsLevel) {
    settings = { ...settings, effects: level };
    applyEffects(level);
    saveSettings(store, settings);
    if (state) update({ ...state, settings });
    else render();
  }

  type Level = 'volume' | 'music';
  const applyLevel = (which: Level, v: number) => (which === 'volume' ? sound.setVolume(v) : sound.setMusic(v));

  /** While the slider moves only the sound follows; saving happens on `change`. */
  function setLevel(which: Level, v: number) {
    settings = { ...settings, [which]: v };
    applyLevel(which, v);
    saveSettings(store, settings);
    if (state) update({ ...state, settings });
  }

  function levelSlider(which: Level, label: UiKey): HTMLElement {
    const pct = Math.round(settings[which] * 100);
    return h(
      'label',
      { class: 'volume' },
      `${t(label)} `,
      h('input', {
        type: 'range',
        min: 0,
        max: 100,
        step: 5,
        value: pct,
        'data-key': which,
        'aria-valuetext': t('settings.percent', { value: pct }),
        oninput: (e: Event) => {
          const input = e.target as HTMLInputElement;
          input.setAttribute('aria-valuetext', t('settings.percent', { value: input.value }));
          applyLevel(which, Number(input.value) / 100);
        },
        onchange: (e: Event) => setLevel(which, Number((e.target as HTMLInputElement).value) / 100),
      }),
    );
  }

  const screenActions: ScreenActions = {
    newGame() {
      if (core.hasSave(store) && !window.confirm(t('title.confirmOverwrite'))) {
        return;
      }
      screen = 'game';
      prologueStep = 0;
      update(core.newGame(content, settings));
    },
    prologueNext: () => {
      if (!state || state.phase !== 'prologue') return;
      const count = core.prologueBefore(content, state.day)?.screens.length ?? 0;
      if (prologueStep + 1 < count) {
        prologueStep++;
        focusNext = 'prologue-next';
        render();
      } else screenActions.prologueSkip();
    },
    prologueSkip: () => {
      if (!state) return;
      prologueStep = 0;
      update(core.finishPrologue(content, state));
    },
    continueGame() {
      const saved = loadSavedGame(store, content);
      if (!saved) return;
      screen = 'game';
      update({ ...saved, settings });
    },
    beginWork: () => {
      if (!state) return;
      update(core.beginWork(state, content));
      // Notes kept in the drawer from the start of the day have gone there (SPEC 7.7).
      if (state.phase === 'desk' && core.dayInfo(content, state.day).storyEvents.some((e) => e.type === 'note' && e.keep === 'drawer' && core.atStart(e))) table.say('drawer.stored');
    },
    readRule: (ruleId) => openCodexAt(ruleId),
    advanceDay: () => {
      if (!state) return;
      update(core.advanceDay(content, state));
    },
    toStart() {
      screen = 'start';
      render();
    },
  };

  const codexEnv = (day: number): Omit<BookEnv, 'onClose'> => ({
    content,
    day,
    progress: state!.codex,
    effects: () => settings.effects,
    sound: (name) => sound.play(name),
    onSeen: () => {
      if (!state) return;
      // Saved at once, without re-rendering the desk.
      state = core.markDeliverySeen(state, day);
      core.saveGame(store, state);
      book.markSeen();
      deskBook.markSeen();
    },
  });

  /** Reading place of the codex: one for the book on the desk and the reader (SPEC 6.1a, 6.7). */
  function rememberPlace(lastRuleId: string): void {
    if (!state) return;
    state = core.rememberCodexPlace(state, lastRuleId);
    core.saveGame(store, state);
  }

  const table: Table = new Table({
    content,
    calendar,
    state: () => state,
    update,
    render: () => render(),
    effects: () => settings.effects,
    sound: (name) => sound.play(name),
    focus: (key) => (focusNext = key),
    mountBook: () =>
      deskBook.mount(
        { ...codexEnv(state!.day), onClose: () => undefined },
        { readMode: openCodex, putBack: () => table.putBack('codex') },
        { class: 'obj tool open tool-codex', 'data-key': 'codex-desk', 'data-fx': 'tool-codex' },
      ),
    unmountBook: () => {
      if (deskBook.isOpen) rememberPlace(deskBook.unmount());
    },
    openReader: openCodex,
    pressStamp: () => pressStamp(),
    putStampBack: () => putStampBack(),
  });

  const deskActions: DeskActions = {
    decide: (pid, v) => state && update(core.decidePosition(state, pid, v)),
    choose: (o) => state && update(core.chooseOption(state, o)),
    decideE: (id, v) => state && update(core.decide(state, id, v)),
    amount: (id, raw) => {
      if (!state) return;
      state = core.enterAmount(state, id, raw);
      core.saveGame(store, state);
    },
    stamp: (s, byKeyboard = false) => {
      if (!state) return;
      // A second click on the holder puts the stamp back (SPEC 7.3).
      if (deskUi.carrying === s) {
        putStampBack();
        return;
      }
      // Stamps go on the stamp field of an open folder.
      if (!state.current || !table.ui.folderOpen) {
        table.say('desk.noOpenAkte');
        return;
      }
      if (state.current.answer.stamp !== undefined) {
        table.say('desk.alreadyStamped');
        return;
      }
      deskUi.carrying = s;
      deskUi.inquiryChoice = null;
      deskUi.pending = null;
      // An Ergänzungsersuchen with inquiry first asks what to ask (SPEC 4): the choice opens now.
      deskUi.inquiryOpen = core.needsInquiry(content, state, s);
      table.carry(s, byKeyboard);
      table.say('desk.stampTaken');
      if (deskUi.inquiryOpen) {
        const akte = core.getAkte(content, state.current.akteId);
        const first = akte.kind.type === 'entscheidungen' ? akte.kind.inquiry?.options[0]?.id : undefined;
        focusNext = first ? `inq-${first}` : null;
      } else if (markOpen(state, deskUi)) {
        // The Gegenüberstellung opens above the stamp field; Enter there still presses the stamp.
        focusNext = 'mark-area';
      }
      render();
    },
    pressStamp,
    inquiry: (id) => {
      if (!state || !deskUi.carrying) return;
      deskUi.inquiryChoice = deskUi.inquiryChoice === id ? null : id;
      // Next by keyboard: the stamp field, where Enter presses the stamp.
      if (deskUi.inquiryChoice) focusNext = 'stamp-field';
      render();
    },
    markLine: (doc, line) => {
      if (!state?.current || !markOpen(state, deskUi)) return;
      const r = core.pickLine(deskUi.pending, { doc, line });
      deskUi.pending = r.pending;
      if (!r.pair) {
        render();
        return;
      }
      const akte = core.getAkte(content, state.current.akteId);
      const [p, q] = r.pair;
      update(core.addMark(content, state, { a: { document: akte.documents[p.doc]!.title, line: p.line }, b: { document: akte.documents[q.doc]!.title, line: q.line } }));
    },
    removeMark: (i) => state && update(core.removeMark(state, i)),
    clearMarks: () => {
      if (!state) return;
      focusNext = markOpen(state, deskUi) ? 'mark-area' : 'pruefvermerk';
      update(core.clearMarks(state));
    },
    calc: (key) => {
      deskUi.calc = core.calcPress(deskUi.calc, key);
      render();
    },
    file: () => table.file(),
    pin: (place) => {
      if (!state?.current) return;
      const ref = core.refOnAkte(content, state.current.akteId, place);
      const r = core.pinClue(content, state, ref);
      if (r.result === 'pinned') {
        update(r.state);
        table.say('pinboard.pinned', { text: core.clueValue(content, ref) });
      } else if (r.result === 'already') table.say('pinboard.alreadyPinned');
    },
    openPinboard: () => openPinboard(),
    drawer: () => {
      if (!state) return;
      if (!state.tools.includes('drawer')) {
        table.say('drawer.stuck');
        const el = root.querySelector<HTMLElement>('.drawer-handle');
        if (el && settings.effects === 'voll') {
          el.classList.remove('stuck');
          void el.offsetWidth;
          el.classList.add('stuck');
          el.addEventListener('animationend', () => el.classList.remove('stuck'), { once: true });
        }
        return;
      }
      putStampBack();
      openDrawer(core.drawerNotes(content, state), boardHost);
    },
  };

  /** Pinboard and drawer are dialogs: while open the desk is not re-rendered (like the reading mode). */
  const boardHost = {
    content,
    state: () => state,
    save: (next: GameState) => {
      state = next;
      core.saveGame(store, state);
    },
    effects: () => settings.effects,
    sound: (name: 'paper' | 'file') => sound.play(name),
    closed: (back: string) => {
      focusNext = back;
      render();
    },
  };
  const pinboard = new PinboardView(boardHost);

  function openPinboard(): void {
    if (!state || state.phase !== 'desk' || !core.hasPinboard(state) || pinboard.isOpen) return;
    putStampBack();
    pinboard.open('pinboard');
  }

  /** Puts the carried stamp back into the holder; the question choice closes again. */
  function putStampBack(): void {
    if (!deskUi.carrying) return;
    deskUi.carrying = null;
    deskUi.inquiryOpen = false;
    deskUi.inquiryChoice = null;
    // Pairs stay with the Akte; only a half-made pair goes (SPEC 4).
    deskUi.pending = null;
    table.carry(null);
    render();
  }

  /** The carried stamp onto the stamp field. With an inquiry only once a question is chosen (SPEC 4). */
  function pressStamp(): void {
    const s = deskUi.carrying;
    if (!state?.current || !s || !table.ui.folderOpen) return;
    if (deskUi.inquiryOpen && !deskUi.inquiryChoice) {
      const akte = core.getAkte(content, state.current.akteId);
      const first = akte.kind.type === 'entscheidungen' ? akte.kind.inquiry?.options[0]?.id : undefined;
      focusNext = first ? `inq-${first}` : null;
      render();
      return;
    }
    const next = core.applyStamp(content, state, s, deskUi.inquiryChoice ?? undefined);
    deskUi.carrying = null;
    deskUi.inquiryOpen = false;
    deskUi.inquiryChoice = null;
    deskUi.pending = null;
    table.carry(null);
    stampFx = next !== state;
    focusNext = 'close-akte';
    update(next);
  }

  /**
   * Opens the codex in reading mode (SPEC 6.2), at the place of the book on the
   * desk if it lies there. While it is open the desk is not re-rendered. Focus
   * returns to where it was.
   */
  function openCodex(): void {
    if (!state || state.phase !== 'desk' || book.isOpen) return;
    if (deskBook.isOpen) rememberPlace(deskBook.place());
    const back = (document.activeElement as HTMLElement | null)?.dataset.key ?? (deskBook.isOpen ? 'codex-read' : 'codex-book');
    const day = state.day;
    book.open({
      ...codexEnv(day),
      onClose: (lastRuleId) => {
        if (!state) return;
        deskBook.showRule(lastRuleId);
        focusNext = back;
        update(core.rememberCodexPlace(state, lastRuleId));
      },
    });
  }

  /** Opens the reading mode at a rule from the summary (SPEC 5); Escape returns to the button. */
  function openCodexAt(ruleId: string): void {
    if (!state || state.phase !== 'summary' || book.isOpen) return;
    const back = document.activeElement as HTMLElement | null;
    state = core.rememberCodexPlace(state, ruleId);
    core.saveGame(store, state);
    book.open({
      ...codexEnv(state.day),
      startRule: ruleId,
      // The summary stays as it is (open solutions too): saved without re-render, focus back on the rule.
      onClose: (lastRuleId) => {
        if (!state) return;
        state = core.rememberCodexPlace(state, lastRuleId);
        core.saveGame(store, state);
        back?.focus({ preventScroll: true });
      },
    });
  }

  // Escape closes an event at the desk and skips the prologue (SPEC 7.8).
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || screen !== 'game' || !state || document.querySelector('dialog[open]')) return;
    if (state.phase === 'prologue') {
      e.preventDefault();
      screenActions.prologueSkip();
      return;
    }
    const open = root.querySelector<HTMLElement>('.desk-event[data-event]');
    if (state.phase === 'desk' && open) {
      e.preventDefault();
      closeDeskEvent(Number(open.dataset.event));
    }
  });

  // Taste K opens the codex, P the pinboard on the desk, unless a text field has focus (SPEC 6.1, 7.6). Open dialogs handle their keys themselves.
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if ((k !== 'k' && k !== 'p') || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (book.isOpen || screen !== 'game' || state?.phase !== 'desk') return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
    if (document.querySelector('dialog[open], .desk-event')) return;
    if (k === 'p' && !core.hasPinboard(state)) return;
    e.preventDefault();
    if (k === 'k') openCodex();
    else openPinboard();
  });

  /**
   * The open calculator listens to the keyboard (SPEC 7, Tischrechner): digits,
   * operators, comma, Backspace and Delete wherever the focus is, except in a
   * text field (amount, codex search). Enter and Escape count only with the focus
   * in the calculator or on nothing that would use them itself. K and P stay free.
   */
  window.addEventListener('keydown', (e) => {
    if (screen !== 'game' || state?.phase !== 'desk' || !table.ui.tools.calculator) return;
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || book.isOpen || document.querySelector('dialog[open], .desk-event')) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const key = core.calcKeyFor(e.key, e.code);
    if (!key) return;
    const inCalc = !!target.closest('.calculator');
    const confirming = e.key === 'Enter' || e.key === 'Escape' || e.code === 'NumpadEnter';
    if (confirming && !inCalc && target.closest('button, a, summary, [tabindex], [role="button"]')) return;
    // Enter or Space on a focused key of the calculator presses that key.
    if (inCalc && e.key === 'Enter' && target.closest('button')) return;
    // Letters (c, x) only inside the calculator, so typing elsewhere does not calculate.
    if (/^[a-z]$/i.test(e.key) && !inCalc) return;
    e.preventDefault();
    deskActions.calc(key);
  });

  function settingsPanel(): HTMLElement {
    const details = h(
      'details',
      { class: 'settings', open: settingsOpen },
      h('summary', { 'data-key': 'settings' }, t('settings.heading')),
      h(
        'fieldset',
        {},
        h('legend', {}, t('settings.effects')),
        EFFECT_LEVELS.map((level) =>
          h(
            'label',
            {},
            h('input', {
              type: 'radio',
              name: 'effects',
              value: level,
              'data-key': `fx-${level}`,
              checked: settings.effects === level,
              onchange: () => setEffects(level),
            }),
            ` ${t(EFFECT_LABELS[level])}`,
          ),
        ),
      ),
      h(
        'fieldset',
        {},
        h('legend', {}, t('settings.sound')),
        levelSlider('volume', 'settings.volume'),
        levelSlider('music', 'settings.music'),
      ),
    );
    details.addEventListener('toggle', () => (settingsOpen = details.open));
    return details;
  }

  /** The half-made pair and the question choice belong to one Akte; the calculator to one day. */
  function syncDeskUi(s: GameState): void {
    const akteId = s.current?.akteId ?? null;
    if (akteId !== deskUi.akteId) {
      deskUi.akteId = akteId;
      deskUi.pending = null;
      deskUi.inquiryOpen = false;
      deskUi.inquiryChoice = null;
      deskUi.carrying = null;
      table.carry(null);
    }
    if (s.current?.answer.stamp !== undefined) {
      deskUi.pending = null;
      deskUi.inquiryOpen = false;
    }
    table.sync(s);
  }

  function view(): HTMLElement {
    if (screen === 'start' || !state) return startView(content, core.hasSave(store), screenActions);
    switch (state.phase) {
      case 'prologue':
        return prologueView(content, state, prologueStep, screenActions);
      case 'intro':
        deskUi.calc = core.CALC_INITIAL;
        return introView(content, state, screenActions);
      case 'desk':
        syncDeskUi(state);
        return deskView({ content, calendar, state, ui: deskUi, table: table.ui, a: deskActions, hooks: table, deskBook: deskBook.element, live: table.live, ghost: table.ghost, deskEvent: dueEvent() });
      case 'summary':
        return summaryView(content, state, screenActions);
      case 'actEnd':
        return actEndView(content, state, screenActions);
    }
  }

  /** Scrolls the Prüfvermerk (only it, never the stage) so `el` and, with the question choice, the whole choice are visible. */
  function revealInPruefvermerk(el: HTMLElement): void {
    const box = el.closest<HTMLElement>('.pv-scroll');
    if (!box) return;
    const show = el.closest<HTMLElement>('.inquiry') ?? el;
    const b = box.getBoundingClientRect();
    const r = show.getBoundingClientRect();
    // Screen pixels of the scaled stage to CSS pixels of the box.
    const k = stageScale();
    if (r.bottom > b.bottom) box.scrollTop += (r.bottom - b.bottom) / k + 8;
    else if (r.top < b.top) box.scrollTop -= (b.top - r.top) / k + 8;
  }

  /** Stamp hit: imprint scales in, the folder shakes slightly (effects „voll“ only). Transform only. */
  function playStampFx(): void {
    if (!stampFx) return;
    stampFx = false;
    sound.play('stamp');
    if (settings.effects === 'aus') return;
    root.querySelector('.stamp-imprint')?.classList.add('hit');
    if (settings.effects === 'voll') {
      const folder = root.querySelector<HTMLElement>('.folder.open');
      folder?.classList.add('shake');
      folder?.addEventListener('animationend', () => folder.classList.remove('shake'), { once: true });
    }
  }

  /** The first event due at the desk, as the view shows it (SPEC 4.4a, 4.5, 7.8). */
  function dueEvent(): DeskEvent | null {
    if (!state) return null;
    const index = core.dueDeskEvents(content, state)[0];
    if (index === undefined) return null;
    const event = core.dayInfo(content, state.day).storyEvents[index]!;
    // Nothing in the hand while an event is open (called while rendering: no render of its own).
    if (deskUi.carrying) {
      deskUi.carrying = null;
      deskUi.inquiryOpen = false;
      deskUi.inquiryChoice = null;
      table.carry(null);
    }
    return { event, index, close: () => closeDeskEvent(index) };
  }

  /** Closes an event at the desk: an unlock takes effect now, a kept note goes into the drawer. */
  function closeDeskEvent(index: number): void {
    if (!state) return;
    const e = core.dayInfo(content, state.day).storyEvents[index];
    const next = core.showDeskEvent(content, state, index);
    if (next === state) return;
    focusNext = core.dueDeskEvents(content, next).length ? 'event-continue' : 'stack';
    update(next);
    if (e?.type === 'note' && e.keep === 'drawer') table.say('drawer.stored');
  }

  /** A call at the desk rings once when it appears. */
  function ringAtDesk(): void {
    const el = root.querySelector<HTMLElement>('.desk-event[data-event]');
    if (!el || !state || !el.querySelector('.call')) return;
    const key = `${state.day}-${el.dataset.event}`;
    if (rungEvent === key) return;
    rungEvent = key;
    sound.play('phone');
  }

  /** A call rings once when its day begins (SPEC 7). */
  function ringIfCalled(): void {
    if (screen !== 'game' || state?.phase !== 'intro' || rungFor === state.day) return;
    if (!core.dayInfo(content, state.day).storyEvents.some((e) => e.type === 'call' && core.atStart(e))) return;
    rungFor = state.day;
    sound.play('phone');
  }

  /** Full re-render. Focus is restored via `data-key` so keyboard play keeps its place. */
  function render(): void {
    if (table.dragging) {
      renderWaiting = true;
      return;
    }
    renderWaiting = false;
    const active = document.activeElement as HTMLElement | null;
    const key = focusNext ?? active?.dataset.key;
    focusNext = null;
    root.replaceChildren(settingsPanel(), view());
    const stage = root.querySelector<HTMLElement>('.stage');
    if (stage) {
      fitStage(stage);
      stage.querySelectorAll<HTMLElement>('.paper.doc').forEach(fitPaperLines);
      table.afterRender(stage);
      deskBook.attached();
    }
    pencil.apply(root, screen === 'game' && state?.phase === 'desk' ? (state.current?.akteId ?? null) : null, settings.effects);
    let target = key ? root.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) : null;
    if (target && (target as HTMLButtonElement).disabled) target = null;
    target ??= root.querySelector<HTMLElement>('main button.primary:not([disabled]), main h1');
    // An event over the desk takes the focus (SPEC 7.8).
    const overlay = root.querySelector<HTMLElement>('.desk-event');
    if (overlay && !(target && overlay.contains(target))) target = overlay.querySelector<HTMLElement>('[data-key="event-continue"]');
    target?.focus({ preventScroll: true });
    // Inside the Prüfvermerk, which scrolls in itself, the focused control comes into view.
    if (target) revealInPruefvermerk(target);
    playStampFx();
    ringIfCalled();
    ringAtDesk();
  }

  // Web fonts change the size of papers (the newspaper): keep everything on the pad once they are there.
  document.fonts?.addEventListener('loadingdone', () => {
    const stage = root.querySelector<HTMLElement>('.stage');
    if (stage && !table.dragging) {
      stage.querySelectorAll<HTMLElement>('.paper.doc').forEach(fitPaperLines);
      table.afterRender(stage);
    }
  });
  window.addEventListener('resize', () => {
    const stage = root.querySelector<HTMLElement>('.stage');
    if (stage) fitStage(stage);
  });
  // A render asked for during a drag happens once the object is dropped.
  window.addEventListener('pointerup', () => queueMicrotask(() => renderWaiting && !table.dragging && render()));

  atmosphere.mount(root);
  atmosphere.setQuality(settings.effects);
  render();
}
