import { createSound } from '../audio';
import * as core from '../core';
import type { Content, EffectsLevel, GameState, Settings } from '../core';
import * as atmosphere from './atmosphere';
import { CodexBook, loadBookFonts } from './codex';
import { deskView, type DeskActions, type DeskUi, type PaperHook } from './desk';
import { h } from './dom';
import { DeskLayout, makeDraggable, openZoom, paperRotation } from './paper-interaction';
import { EFFECT_LEVELS, applyEffects, defaultSettings, loadSavedGame, loadSettings, saveSettings } from './settings';
import { t, type UiKey } from './text';
import { actEndView, introView, startView, summaryView, type ScreenActions } from './views';

type Screen = 'start' | 'game';

const EFFECT_LABELS = {
  aus: 'settings.effectsAus',
  reduziert: 'settings.effectsReduziert',
  voll: 'settings.effectsVoll',
} as const satisfies Record<EffectsLevel, UiKey>;

/** Holds the core state, wires DOM events to core actions and re-renders. */
export function startApp(root: HTMLElement, content: Content): void {
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
  const book = new CodexBook();
  const deskUi: DeskUi = { akteId: null, markMode: false, pending: null, inquiryOpen: false, calc: core.CALC_INITIAL };
  const layout = new DeskLayout();

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
      update(core.newGame(content, settings));
    },
    continueGame() {
      const saved = loadSavedGame(store, content);
      if (!saved) return;
      screen = 'game';
      update({ ...saved, settings });
    },
    beginWork: () => state && update(core.beginWork(state)),
    advanceDay: () => {
      if (!state) return;
      update(core.advanceDay(content, state));
    },
    toStart() {
      screen = 'start';
      render();
    },
  };

  const deskActions: DeskActions = {
    drawNext: () => {
      if (!state) return;
      const next = core.drawNext(state);
      if (next !== state) sound.play('paper');
      update(next);
    },
    decide: (pid, v) => state && update(core.decidePosition(state, pid, v)),
    choose: (o) => state && update(core.chooseOption(state, o)),
    decideE: (id, v) => state && update(core.decide(state, id, v)),
    amount: (id, raw) => {
      if (!state) return;
      state = core.enterAmount(state, id, raw);
      core.saveGame(store, state);
    },
    stamp: (s) => {
      if (!state) return;
      // An Ergänzungsersuchen with inquiry first asks what to ask (SPEC 4.4); pressing it again closes the choice.
      if (core.needsInquiry(content, state, s)) {
        deskUi.inquiryOpen = !deskUi.inquiryOpen;
        if (deskUi.inquiryOpen) {
          const akte = core.getAkte(content, state.current!.akteId);
          const first = akte.kind.type === 'entscheidungen' ? akte.kind.inquiry?.options[0]?.id : undefined;
          focusNext = first ? `inq-${first}` : null;
        }
        render();
        return;
      }
      deskUi.inquiryOpen = false;
      const next = core.applyStamp(content, state, s);
      stampFx = next !== state;
      update(next);
    },
    inquiry: (id) => {
      if (!state) return;
      const next = core.applyStamp(content, state, 'ergaenzung', id);
      deskUi.inquiryOpen = false;
      stampFx = next !== state;
      focusNext = 'outbox';
      update(next);
    },
    toggleMarkMode: () => {
      deskUi.markMode = !deskUi.markMode;
      deskUi.pending = null;
      render();
    },
    markLine: (doc, line) => {
      if (!state?.current) return;
      const p = deskUi.pending;
      if (!p || p.doc === doc) {
        deskUi.pending = p && p.line === line ? null : { doc, line };
        render();
        return;
      }
      const akte = core.getAkte(content, state.current.akteId);
      deskUi.pending = null;
      update(core.toggleMark(content, state, { a: { document: akte.documents[p.doc]!.title, line: p.line }, b: { document: akte.documents[doc]!.title, line } }));
    },
    removeMark: (i) => state && update(core.removeMark(state, i)),
    clearMarks: () => {
      if (!state) return;
      focusNext = 'mark-mode';
      update(core.clearMarks(state));
    },
    calc: (key) => {
      deskUi.calc = core.calcPress(deskUi.calc, key);
      render();
    },
    file: () => {
      if (!state) return;
      const next = core.fileCurrent(content, state);
      if (next !== state) sound.play('file');
      update(next);
    },
    openCodex,
  };

  /** Opens the codex as a book (SPEC 6). While it is open the desk is not re-rendered. */
  function openCodex(): void {
    if (!state || state.phase !== 'desk' || book.isOpen) return;
    const day = state.day;
    book.open({
      content,
      day,
      progress: state.codex,
      effects: () => settings.effects,
      sound: (name) => sound.play(name),
      onSeen: () => {
        if (!state) return;
        // Saved at once, without re-rendering the desk behind the dialog.
        state = core.markDeliverySeen(state, day);
        core.saveGame(store, state);
      },
      onClose: (lastRuleId) => {
        if (!state) return;
        focusNext = 'codex-book';
        update(core.rememberCodexPlace(state, lastRuleId));
      },
    });
  }

  // Taste K opens the codex on the desk, unless a text field has focus (SPEC 6.1). The open book handles K itself.
  window.addEventListener('keydown', (e) => {
    if ((e.key !== 'k' && e.key !== 'K') || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (book.isOpen || screen !== 'game' || state?.phase !== 'desk') return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault();
    openCodex();
  });

  const paperHook: PaperHook = (el, key, seed) =>
    makeDraggable(el, {
      key,
      layout,
      rotation: paperRotation(seed),
      surface: () => root.querySelector('.worksurface'),
      effects: () => settings.effects,
      onZoom: openZoom,
      onLift: () => sound.play('paper'),
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

  /** Mark mode, pending line and the question choice belong to one Akte; the calculator to one day. */
  function syncDeskUi(s: GameState): void {
    const akteId = s.current?.akteId ?? null;
    if (akteId !== deskUi.akteId) {
      deskUi.akteId = akteId;
      deskUi.markMode = false;
      deskUi.pending = null;
      deskUi.inquiryOpen = false;
    }
    if (s.current?.answer.stamp !== undefined) {
      deskUi.markMode = false;
      deskUi.pending = null;
      deskUi.inquiryOpen = false;
    }
    layout.forAkte(akteId, s.day);
  }

  function view(): HTMLElement {
    if (screen === 'start' || !state) return startView(content, core.hasSave(store), screenActions);
    switch (state.phase) {
      case 'intro':
        deskUi.calc = core.CALC_INITIAL;
        return introView(content, state, screenActions);
      case 'desk':
        syncDeskUi(state);
        return deskView(content, state, deskUi, deskActions, paperHook);
      case 'summary':
        return summaryView(content, state, screenActions);
      case 'actEnd':
        return actEndView(content, state, screenActions);
    }
  }

  /** Stamp hit: imprint scales in, the work surface shakes slightly. Transform only. */
  function playStampFx(): void {
    if (!stampFx) return;
    stampFx = false;
    sound.play('stamp');
    if (settings.effects === 'aus') return;
    root.querySelector('.stamp-imprint')?.classList.add('hit');
    if (settings.effects === 'voll') {
      const surface = root.querySelector<HTMLElement>('.worksurface');
      surface?.classList.add('shake');
      surface?.addEventListener('animationend', () => surface.classList.remove('shake'), { once: true });
    }
  }

  /** A call rings once when its day begins (SPEC 7). */
  function ringIfCalled(): void {
    if (screen !== 'game' || state?.phase !== 'intro' || rungFor === state.day) return;
    if (!core.dayInfo(content, state.day).storyEvents.some((e) => e.type === 'call')) return;
    rungFor = state.day;
    sound.play('phone');
  }

  /** Full re-render. Focus is restored via `data-key` so keyboard play keeps its place. */
  function render(): void {
    const active = document.activeElement as HTMLElement | null;
    const key = focusNext ?? active?.dataset.key;
    focusNext = null;
    root.replaceChildren(settingsPanel(), view());
    let target = key ? root.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) : null;
    if (target && (target as HTMLButtonElement).disabled) target = null;
    target ??= root.querySelector<HTMLElement>('main button.primary:not([disabled]), main h1');
    target?.focus({ preventScroll: true });
    playStampFx();
    ringIfCalled();
  }

  atmosphere.mount(root);
  atmosphere.setQuality(settings.effects);
  render();
}
