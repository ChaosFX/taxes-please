import { createSound } from '../audio';
import * as core from '../core';
import type { Content, EffectsLevel, GameState, Settings } from '../core';
import * as atmosphere from './atmosphere';
import type { CodexUiState } from './codex';
import { h } from './dom';
import { DeskLayout, makeDraggable, openZoom, paperRotation } from './paper-interaction';
import { EFFECT_LEVELS, applyEffects, defaultSettings, loadSavedGame, loadSettings, saveSettings } from './settings';
import { t, type UiKey } from './text';
import { deskView, finishedView, introView, startView, summaryView, type Actions, type PaperHook } from './views';

type Screen = 'start' | 'game';

const EFFECT_LABELS = {
  aus: 'settings.effectsAus',
  reduziert: 'settings.effectsReduziert',
  voll: 'settings.effectsVoll',
} as const satisfies Record<EffectsLevel, UiKey>;

/** Holds the core state, wires DOM events to core actions and re-renders. */
export function startApp(root: HTMLElement, content: Content): void {
  const store = core.browserStorage();
  let screen: Screen = 'start';
  let state: GameState | null = null;
  let settings: Settings = loadSettings(store) ?? loadSavedGame(store)?.settings ?? defaultSettings();
  let settingsOpen = false;
  let stampFx = false;
  const codexUi: CodexUiState = { open: true, query: '' };
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

  const actions: Actions = {
    newGame() {
      if (core.hasSave(store) && !window.confirm(t('title.confirmOverwrite'))) {
        return;
      }
      screen = 'game';
      codexUi.query = '';
      update(core.newGame(content, settings));
    },
    continueGame() {
      const saved = loadSavedGame(store);
      if (!saved) return;
      screen = 'game';
      update({ ...saved, settings });
    },
    beginWork: () => state && update(core.beginWork(state)),
    drawNext: () => {
      if (!state) return;
      const next = core.drawNext(state);
      if (next !== state) sound.play('paper');
      update(next);
    },
    decide: (pid, v) => state && update(core.decidePosition(state, pid, v)),
    choose: (o) => state && update(core.chooseOption(state, o)),
    stamp: (s) => {
      if (!state) return;
      const next = core.applyStamp(content, state, s);
      stampFx = next !== state;
      update(next);
    },
    file: () => {
      if (!state) return;
      const next = core.fileCurrent(content, state);
      if (next !== state) sound.play('file');
      update(next);
    },
    advanceDay: () => {
      if (!state) return;
      codexUi.query = '';
      update(core.advanceDay(content, state));
    },
    toggleCodex() {
      codexUi.open = !codexUi.open;
      render();
    },
    toStart() {
      screen = 'start';
      render();
    },
  };

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

  function view(): HTMLElement {
    if (screen === 'start' || !state) return startView(content, core.hasSave(store), actions);
    switch (state.phase) {
      case 'intro':
        return introView(content, state, actions);
      case 'desk':
        layout.forAkte(state.current?.akteId ?? null);
        return deskView(content, state, codexUi, actions, paperHook);
      case 'summary':
        return summaryView(content, state, actions);
      case 'finished':
        return finishedView(content, state, actions);
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

  /** Full re-render. Focus is restored via `data-key` so keyboard play keeps its place. */
  function render(): void {
    const active = document.activeElement as HTMLElement | null;
    const key = active?.dataset.key;
    const codexScroll = root.querySelector('.codex-list')?.scrollTop ?? 0;
    root.replaceChildren(settingsPanel(), view());
    const list = root.querySelector('.codex-list');
    if (list) list.scrollTop = codexScroll;
    let target = key ? root.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) : null;
    if (target && (target as HTMLButtonElement).disabled) target = null;
    target ??= root.querySelector<HTMLElement>('main button.primary:not([disabled]), main h1');
    target?.focus({ preventScroll: true });
    playStampFx();
  }

  atmosphere.mount(root);
  atmosphere.setQuality(settings.effects);
  render();
}
