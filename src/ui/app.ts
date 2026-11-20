import * as core from '../core';
import type { Content, GameState, Settings } from '../core';
import * as atmosphere from './atmosphere';
import type { CodexUiState } from './codex';
import { deskView, finishedView, introView, startView, summaryView, type Actions } from './views';

type Screen = 'start' | 'game';

function defaultSettings(): Settings {
  let reduced = false;
  try {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    /* ignore */
  }
  return { ...core.DEFAULT_SETTINGS, effects: reduced ? 'reduziert' : core.DEFAULT_SETTINGS.effects };
}

/** Holds the core state, wires DOM events to core actions and re-renders. */
export function startApp(root: HTMLElement, content: Content): void {
  const store = core.browserStorage();
  let screen: Screen = 'start';
  let state: GameState | null = null;
  const codexUi: CodexUiState = { open: true, query: '' };

  const update = (next: GameState) => {
    const changed = next !== state;
    state = next;
    if (changed) core.saveGame(store, state);
    render();
  };

  const actions: Actions = {
    newGame() {
      if (core.hasSave(store) && !window.confirm('Es gibt einen Spielstand. Neues Spiel beginnen und den alten überschreiben?')) {
        return;
      }
      screen = 'game';
      codexUi.query = '';
      update(core.newGame(content, state?.settings ?? core.loadGame(store)?.settings ?? defaultSettings()));
    },
    continueGame() {
      const saved = core.loadGame(store);
      if (!saved) return;
      screen = 'game';
      state = saved;
      render();
    },
    beginWork: () => state && update(core.beginWork(state)),
    drawNext: () => state && update(core.drawNext(state)),
    decide: (pid, v) => state && update(core.decidePosition(state, pid, v)),
    choose: (o) => state && update(core.chooseOption(state, o)),
    stamp: (s) => state && update(core.applyStamp(content, state, s)),
    file: () => state && update(core.fileCurrent(content, state)),
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

  function view(): HTMLElement {
    if (screen === 'start' || !state) return startView(content, core.hasSave(store), actions);
    switch (state.phase) {
      case 'intro':
        return introView(content, state, actions);
      case 'desk':
        return deskView(content, state, codexUi, actions);
      case 'summary':
        return summaryView(content, state, actions);
      case 'finished':
        return finishedView(content, state, actions);
    }
  }

  /** Full re-render. Focus is restored via `data-key` so keyboard play keeps its place. */
  function render(): void {
    const active = document.activeElement as HTMLElement | null;
    const key = active?.dataset.key;
    const codexScroll = root.querySelector('.codex-list')?.scrollTop ?? 0;
    root.replaceChildren(view());
    const list = root.querySelector('.codex-list');
    if (list) list.scrollTop = codexScroll;
    let target = key ? root.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) : null;
    if (target && (target as HTMLButtonElement).disabled) target = null;
    target ??= root.querySelector<HTMLElement>('main button.primary:not([disabled]), main h1');
    target?.focus({ preventScroll: true });
  }

  atmosphere.mount(root);
  render();
}
