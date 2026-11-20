import { evaluate } from './evaluate';
import { getAkte } from './loader';
import type { Answer, CaseResult, Content, Day, PlayerVerdict, Settings, Stamp } from './types';

export type Phase = 'intro' | 'desk' | 'summary' | 'finished';

export interface PendingFollowUp {
  akteId: string;
  day: number;
}

export interface GameState {
  version: 1;
  day: number;
  phase: Phase;
  /** Akten still on the stack today, in order. */
  queue: string[];
  /** Akte on the desk with the player's current input. */
  current: { akteId: string; answer: Answer } | null;
  results: CaseResult[];
  pendingFollowUps: PendingFollowUp[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = { effects: 'voll', volume: 0.7 };

/** The day as defined in the content. Every playable day is in the content. */
export function dayInfo(content: Content, day: number): Day {
  const defined = content.days.find((d) => d.day === day);
  if (!defined) throw new Error(`Tag ${day} fehlt im Inhalt`);
  return defined;
}

export function planDay(content: Content, day: number, pending: PendingFollowUp[]): string[] {
  const regular = content.days.find((d) => d.day === day)?.cases ?? [];
  return [...regular, ...pending.filter((p) => p.day === day).map((p) => p.akteId)];
}

/** Next day in the content after `after`, or null at the end. Days with an empty stack are still played. */
export function nextPlayableDay(content: Content, after: number): number | null {
  const candidates = content.days.map((d) => d.day).filter((d) => d > after);
  return candidates.length ? Math.min(...candidates) : null;
}

function startDay(content: Content, state: GameState, day: number): GameState {
  return {
    ...state,
    day,
    phase: 'intro',
    queue: planDay(content, day, state.pendingFollowUps),
    current: null,
    pendingFollowUps: state.pendingFollowUps.filter((p) => p.day !== day),
  };
}

export function newGame(content: Content, settings: Settings = DEFAULT_SETTINGS): GameState {
  const first = Math.min(...content.days.map((d) => d.day));
  const empty: GameState = {
    version: 1,
    day: first,
    phase: 'intro',
    queue: [],
    current: null,
    results: [],
    pendingFollowUps: [],
    settings,
  };
  return startDay(content, empty, first);
}

/** Leaves the day intro and goes to the desk. */
export function beginWork(state: GameState): GameState {
  if (state.phase !== 'intro') return state;
  return { ...state, phase: state.queue.length === 0 && !state.current ? 'summary' : 'desk' };
}

/** Takes the next Akte from the stack. Only possible when the desk is empty. */
export function drawNext(state: GameState): GameState {
  if (state.phase !== 'desk' || state.current || state.queue.length === 0) return state;
  const [akteId, ...rest] = state.queue as [string, ...string[]];
  return { ...state, queue: rest, current: { akteId, answer: { positions: {} } } };
}

function editable(state: GameState): state is GameState & { current: NonNullable<GameState['current']> } {
  return state.phase === 'desk' && state.current !== null && state.current.answer.stamp === undefined;
}

/** Sets or clears (`undefined`) the verdict on a position. Locked once stamped. */
export function decidePosition(state: GameState, positionId: string, verdict: PlayerVerdict | undefined): GameState {
  if (!editable(state)) return state;
  const positions = { ...state.current.answer.positions, [positionId]: verdict };
  if (verdict === undefined) delete positions[positionId];
  return { ...state, current: { ...state.current, answer: { ...state.current.answer, positions } } };
}

export function chooseOption(state: GameState, option: string | undefined): GameState {
  if (!editable(state)) return state;
  return { ...state, current: { ...state.current, answer: { ...state.current.answer, option } } };
}

/** Stamps the current Akte. A stamp is final. Only stamps available today are accepted. */
export function applyStamp(content: Content, state: GameState, stamp: Stamp): GameState {
  if (!editable(state)) return state;
  if (!dayInfo(content, state.day).stamps.includes(stamp)) return state;
  return { ...state, current: { ...state.current, answer: { ...state.current.answer, stamp } } };
}

/** Puts the stamped Akte into the outbox, evaluates it and schedules a follow-up if earned. */
export function fileCurrent(content: Content, state: GameState): GameState {
  const cur = state.current;
  if (state.phase !== 'desk' || !cur || cur.answer.stamp === undefined) return state;
  const akte = getAkte(content, cur.akteId);
  const result: CaseResult = { akteId: cur.akteId, day: state.day, answer: cur.answer, errors: evaluate(akte, cur.answer) };

  let pendingFollowUps = state.pendingFollowUps;
  const source = content.cases.find((k) => k.id === akte.sourceCaseId);
  if (!akte.isFollowUp && source?.followUp && cur.answer.stamp === 'ergaenzung') {
    pendingFollowUps = [...pendingFollowUps, { akteId: `${source.id}/folge`, day: source.followUp.arrivesOnDay }];
  }

  return {
    ...state,
    current: null,
    results: [...state.results, result],
    pendingFollowUps,
    phase: state.queue.length === 0 ? 'summary' : 'desk',
  };
}

/** From the day summary to the next day, or to the end of the prototype. */
export function advanceDay(content: Content, state: GameState): GameState {
  if (state.phase !== 'summary') return state;
  const next = nextPlayableDay(content, state.day);
  if (next === null) return { ...state, phase: 'finished' };
  return startDay(content, state, next);
}

export function resultsOfDay(state: GameState, day: number): CaseResult[] {
  return state.results.filter((r) => r.day === day);
}

export function errorsOfDay(state: GameState, day: number): number {
  return resultsOfDay(state, day).reduce((n, r) => n + r.errors.length, 0);
}

/** Errors for every content day up to the current one, including days with an empty stack. */
export function errorsPerDay(content: Content, state: GameState): Record<number, number> {
  const out: Record<number, number> = {};
  for (const d of content.days) if (d.day <= state.day) out[d.day] = errorsOfDay(state, d.day);
  return out;
}

/** True when the day's errors reach `texts.warning.minErrors`. */
export function needsReprimand(content: Content, state: GameState, day: number): boolean {
  return errorsOfDay(state, day) >= content.texts.warning.minErrors;
}
