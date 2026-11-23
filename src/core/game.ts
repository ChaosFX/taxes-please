import * as board from './board';
import { EMPTY_BOARD, type BoardState, type ClueRef } from './board';
import { DEFAULT_CODEX, type CodexProgress } from './codex';
import { samePair, evaluate } from './evaluate';
import { getAkte } from './loader';
import type { Answer, CaseResult, Content, Day, Mark, PlayerVerdict, Settings, Stamp, Tool } from './types';

/** `actEnd`: the end screen of an act („Ende von Akt {act}“, SPEC 4.8). */
export type Phase = 'intro' | 'desk' | 'summary' | 'actEnd';

export interface PendingFollowUp {
  akteId: string;
  day: number;
}

/** Save format. 1 is the prototype (0.2, days 1 to 4); 2 adds tools and act ends. */
export const STATE_VERSION = 2;

export interface GameState {
  version: typeof STATE_VERSION;
  day: number;
  phase: Phase;
  /** Akten still on the stack today, in order. */
  queue: string[];
  /** Akte on the desk with the player's current input. */
  current: { akteId: string; answer: Answer } | null;
  results: CaseResult[];
  pendingFollowUps: PendingFollowUp[];
  /** Tools unlocked so far (`unlock` events), in order. */
  tools: Tool[];
  /** Act shown on the end screen while `phase` is `actEnd`. */
  act?: number;
  settings: Settings;
  /** Reading progress in the codex (SPEC 6.7, 9). Saves without it get DEFAULT_CODEX. */
  codex: CodexProgress;
  /** What the player did at the pinboard (SPEC 9). Saves without it get an empty board. */
  board: BoardState;
}

export const DEFAULT_SETTINGS: Settings = { effects: 'voll', volume: 0.7, music: 0.5 };

/** The day as defined in the content. Every playable day is in the content. */
export function dayInfo(content: Content, day: number): Day {
  const defined = content.days.find((d) => d.day === day);
  if (!defined) throw new Error(`Tag ${day} fehlt im Inhalt`);
  return defined;
}

/** Stack of a day: follow-ups first, then the day's Akten in content order (SPEC 4.6). */
export function planDay(content: Content, day: number, pending: PendingFollowUp[]): string[] {
  const regular = content.days.find((d) => d.day === day)?.cases ?? [];
  return [...pending.filter((p) => p.day === day).map((p) => p.akteId), ...regular];
}

/** Next day in the content after `after`, or null at the end. Days with an empty stack are still played. */
export function nextPlayableDay(content: Content, after: number): number | null {
  const candidates = content.days.map((d) => d.day).filter((d) => d > after);
  return candidates.length ? Math.min(...candidates) : null;
}

/** Tools unlocked on the days up to and including `day`. */
export function toolsUntil(content: Content, day: number): Tool[] {
  const out: Tool[] = [];
  for (const d of [...content.days].sort((a, b) => a.day - b.day)) {
    if (d.day > day) break;
    for (const e of d.storyEvents) if (e.type === 'unlock' && !out.includes(e.feature)) out.push(e.feature);
  }
  return out;
}

export function startDay(content: Content, state: GameState, day: number): GameState {
  const tools = [...state.tools];
  for (const e of dayInfo(content, day).storyEvents) if (e.type === 'unlock' && !tools.includes(e.feature)) tools.push(e.feature);
  const { act: _act, ...rest } = state;
  return {
    ...rest,
    day,
    phase: 'intro',
    queue: planDay(content, day, state.pendingFollowUps),
    current: null,
    pendingFollowUps: state.pendingFollowUps.filter((p) => p.day !== day),
    tools,
  };
}

export function newGame(content: Content, settings: Settings = DEFAULT_SETTINGS): GameState {
  const first = Math.min(...content.days.map((d) => d.day));
  const empty: GameState = {
    version: STATE_VERSION,
    day: first,
    phase: 'intro',
    queue: [],
    current: null,
    results: [],
    pendingFollowUps: [],
    tools: [],
    settings,
    codex: { ...DEFAULT_CODEX },
    board: EMPTY_BOARD,
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

type Editable = GameState & { current: NonNullable<GameState['current']> };

function editable(state: GameState): state is Editable {
  return state.phase === 'desk' && state.current !== null && state.current.answer.stamp === undefined;
}

function withAnswer(state: Editable, patch: Partial<Answer>): GameState {
  return { ...state, current: { ...state.current, answer: { ...state.current.answer, ...patch } } };
}

/** Sets or clears (`undefined`) the verdict on a position. Locked once stamped. */
export function decidePosition(state: GameState, positionId: string, verdict: PlayerVerdict | undefined): GameState {
  if (!editable(state)) return state;
  const positions = { ...state.current.answer.positions, [positionId]: verdict };
  if (verdict === undefined) delete positions[positionId];
  return withAnswer(state, { positions });
}

export function chooseOption(state: GameState, option: string | undefined): GameState {
  if (!editable(state)) return state;
  return withAnswer(state, { option });
}

/** Sets or clears (`undefined`) the chosen option of a decision in an `entscheidungen` Akte. */
export function decide(state: GameState, decisionId: string, value: string | undefined): GameState {
  if (!editable(state)) return state;
  const decisions = { ...state.current.answer.decisions };
  if (value === undefined) delete decisions[decisionId];
  else decisions[decisionId] = value;
  return withAnswer(state, { decisions });
}

/** Stores the amount as typed; an empty field removes it. Parsing happens in the evaluation. */
export function enterAmount(state: GameState, decisionId: string, raw: string): GameState {
  if (!editable(state)) return state;
  const amounts = { ...state.current.answer.amounts };
  if (raw.trim() === '') delete amounts[decisionId];
  else amounts[decisionId] = raw;
  return withAnswer(state, { amounts });
}

/**
 * Marks two lines in two different papers of the Akte on the desk as a
 * discrepancy. Marking the same pair again removes it.
 */
export function toggleMark(content: Content, state: GameState, mark: Mark): GameState {
  if (!editable(state)) return state;
  if (mark.a.document === mark.b.document) return state;
  const akte = getAkte(content, state.current.akteId);
  const exists = (r: Mark['a']) => akte.documents.some((d) => d.title === r.document && d.lines.some(([l]) => l === r.line));
  if (!exists(mark.a) || !exists(mark.b)) return state;
  const marks = state.current.answer.marks ?? [];
  const i = marks.findIndex((m) => samePair(m, mark));
  return withAnswer(state, { marks: i >= 0 ? marks.filter((_, j) => j !== i) : [...marks, mark] });
}

export function removeMark(state: GameState, index: number): GameState {
  if (!editable(state)) return state;
  return withAnswer(state, { marks: (state.current.answer.marks ?? []).filter((_, j) => j !== index) });
}

export function clearMarks(state: GameState): GameState {
  if (!editable(state)) return state;
  return withAnswer(state, { marks: [] });
}

/** True if stamping `stamp` on the Akte on the desk first needs the choice of a question (SPEC 4.4). */
export function needsInquiry(content: Content, state: GameState, stamp: Stamp): boolean {
  if (stamp !== 'ergaenzung' || !state.current) return false;
  const akte = getAkte(content, state.current.akteId);
  return akte.kind.type === 'entscheidungen' && akte.kind.inquiry !== undefined;
}

/**
 * Stamps the current Akte. A stamp is final. Only stamps available today are
 * accepted. An Ergänzungsersuchen on an Akte with `inquiry` needs the id of one
 * of its questions; without it nothing happens.
 */
export function applyStamp(content: Content, state: GameState, stamp: Stamp, inquiry?: string): GameState {
  if (!editable(state)) return state;
  if (!dayInfo(content, state.day).stamps.includes(stamp)) return state;
  if (needsInquiry(content, state, stamp)) {
    const akte = getAkte(content, state.current.akteId);
    const options = akte.kind.type === 'entscheidungen' ? (akte.kind.inquiry?.options ?? []) : [];
    if (!options.some((o) => o.id === inquiry)) return state;
    return withAnswer(state, { stamp, inquiry });
  }
  return withAnswer(state, { stamp });
}

/** Puts the stamped Akte into the outbox, evaluates it and schedules a follow-up if earned. */
export function fileCurrent(content: Content, state: GameState): GameState {
  const cur = state.current;
  if (state.phase !== 'desk' || !cur || cur.answer.stamp === undefined) return state;
  const akte = getAkte(content, cur.akteId);
  const result: CaseResult = { akteId: cur.akteId, day: state.day, answer: cur.answer, errors: evaluate(akte, cur.answer) };

  let pendingFollowUps = state.pendingFollowUps;
  const source = content.cases.find((k) => k.id === akte.sourceCaseId);
  // The follow-up comes after every Ergänzungsersuchen, also after a wrong question (SPEC 4.6).
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

/** Act whose end screen follows the summary of `day`, if any. */
export function actEndingOn(content: Content, day: number): number | null {
  for (const e of dayInfo(content, day).storyEvents) if (e.type === 'actSummary') return e.act;
  return null;
}

/**
 * From the day summary to the next day. After a day with `actSummary` the end
 * screen of the act comes first. Without a next day the game ends on an act
 * screen (the act of the content when the day names none).
 */
export function advanceDay(content: Content, state: GameState): GameState {
  if (state.phase !== 'summary') return state;
  const act = actEndingOn(content, state.day);
  const next = nextPlayableDay(content, state.day);
  if (act !== null || next === null) return { ...state, phase: 'actEnd', act: act ?? content.meta.akt };
  return startDay(content, state, next);
}

/** From an act's end screen to the next day; stays there if there is none. */
export function continueAfterAct(content: Content, state: GameState): GameState {
  if (state.phase !== 'actEnd') return state;
  const next = nextPlayableDay(content, state.day);
  return next === null ? state : startDay(content, state, next);
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

/** Remembers the rule read last when the codex closes (empty: the register). */
export function rememberCodexPlace(state: GameState, lastRuleId: string): GameState {
  if (state.codex.lastRuleId === lastRuleId) return state;
  return { ...state, codex: { ...state.codex, lastRuleId } };
}

/** Today's delivery has been seen; `seenDay` never goes back. */
export function markDeliverySeen(state: GameState, day: number): GameState {
  if (state.codex.seenDay >= day) return state;
  return { ...state, codex: { ...state.codex, seenDay: day } };
}

// ---------- Pinboard (SPEC 4, 7.6) ----------

/** The pinboard is on the desk from `unlock: pinboard` on. */
export const hasPinboard = (state: GameState): boolean => state.tools.includes('pinboard');

/** Pins a place into the hand. Only with the pinboard on the desk. */
export function pinClue(content: Content, state: GameState, ref: ClueRef): { state: GameState; result: board.PinResult } {
  if (!hasPinboard(state)) return { state, result: 'invalid' };
  const r = board.pin(content, board.boardContext(state), ref);
  return { state: r.board === state.board ? state : { ...state, board: r.board }, result: r.result };
}

/** Lays a card from the hand on a question. Never touches errors or results (SPEC 5). */
export function placeClue(content: Content, state: GameState, key: string, questionId: string): { state: GameState; result: board.PlaceResult } {
  if (!hasPinboard(state)) return { state, result: 'invalid' };
  const r = board.place(content, board.boardContext(state), key, questionId);
  return { state: r.board === state.board ? state : { ...state, board: r.board }, result: r.result };
}

export function discardClue(state: GameState, key: string): GameState {
  const b = board.discard(board.boardContext(state), key);
  return b === state.board ? state : { ...state, board: b };
}

/** Everything in the hand and on the wall has been seen (the pinboard was open). */
export function seeBoard(content: Content, state: GameState): GameState {
  const b = board.markBoardSeen(content, board.boardContext(state));
  return b === state.board ? state : { ...state, board: b };
}
