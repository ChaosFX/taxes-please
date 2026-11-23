import { FOLLOW_UP_SUFFIX, getAkte } from './loader';
import { atStart } from './timeline';
import type { Clue, Content, Question, StoryEvent } from './types';

/*
 * The pinboard (SPEC 3 „Fragen“, 7.6, 9) and the drawer (SPEC 7.7). Pure
 * functions, no DOM, no story: who asks, what is asked, which places answer and
 * how much is given comes from the content only.
 *
 * Saved is only what the player did (`BoardState`). The hand, the questions on
 * the wall and which of them are answered are computed from content and save.
 */

/** A place in an Akte: a line of a paper, or the office stamp of the representative. */
export type ClueRef =
  | { case: string; document: string; line: string; followUp?: true }
  | { case: string; field: 'representative'; followUp?: true };

/** What the player did at the pinboard (save, SPEC 9). */
export interface BoardState {
  /** Per question id the keys of the clues the player placed on it (given clues are not listed). */
  placed: Record<string, string[]>;
  /** Places pinned by the player that still lie in the hand. */
  pinned: ClueRef[];
  /** Clue keys the player has seen in the hand (for the mark „neu“). */
  seenClues: string[];
  /** Answered questions the player has seen at the wall. */
  seenAnswers: string[];
  /** Clues laid on a question they do not belong to. No effect in this version. */
  misses: number;
}

export const EMPTY_BOARD: BoardState = { placed: {}, pinned: [], seenClues: [], seenAnswers: [], misses: 0 };

/** The part of the game state the pinboard reads. */
export interface BoardContext {
  day: number;
  board: BoardState;
  /** Ids of the Akten in the outbox (results), follow-ups with `/folge`. */
  filed: readonly string[];
}

/** A question with the day it belongs to. */
export interface DayQuestion extends Question {
  day: number;
}

/** Stable key of a place: `case|document|line` or `case|@field`; follow-ups carry `/folge` at the case. */
export function clueKey(ref: ClueRef | Clue): string {
  const c = 'followUp' in ref && ref.followUp ? ref.case + FOLLOW_UP_SUFFIX : ref.case;
  return 'field' in ref ? `${c}|@${ref.field}` : `${c}|${ref.document}|${ref.line}`;
}

/** The place of a clue, without `given` and `source`. */
export function refOf(clue: Clue): ClueRef {
  return 'field' in clue ? { case: clue.case, field: 'representative' } : { case: clue.case, document: clue.document, line: clue.line };
}

/** All questions of the content, by day, in content order within a day. */
export function allQuestions(content: Content): DayQuestion[] {
  return [...content.days].sort((a, b) => a.day - b.day).flatMap((d) => (d.questions ?? []).map((q) => ({ ...q, day: d.day })));
}

/** A clue hangs at the question: given from the start, or placed by the player. */
export function isPlaced(board: BoardState, q: Question, clue: Clue): boolean {
  return clue.given === true || (board.placed[q.id] ?? []).includes(clueKey(clue));
}

/** A question is answered when all its clues hang at it (given ones count). */
export function isAnswered(board: BoardState, q: Question): boolean {
  return q.clues.every((c) => isPlaced(board, q, c));
}

/**
 * Questions on the wall on `day`: from the start of their day, with `after`
 * once the question before is answered (and itself on the wall). Order: as they
 * came up – by day, a follow-up question after the one it follows.
 */
export function visibleQuestions(content: Content, ctx: Pick<BoardContext, 'day' | 'board'>): DayQuestion[] {
  const all = allQuestions(content);
  const byId = new Map(all.map((q) => [q.id, q]));
  const memo = new Map<string, boolean>();
  const visible = (q: DayQuestion, depth = 0): boolean => {
    if (memo.has(q.id)) return memo.get(q.id)!;
    let v = q.day <= ctx.day;
    if (v && q.after !== undefined) {
      const prev = byId.get(q.after);
      v = !!prev && depth < all.length && visible(prev, depth + 1) && isAnswered(ctx.board, prev);
    }
    memo.set(q.id, v);
    return v;
  };
  const shown = all.filter((q) => visible(q));
  // A follow-up comes right after the question it follows (and after that one's earlier follow-ups).
  const out: DayQuestion[] = [];
  const add = (q: DayQuestion) => {
    if (out.includes(q)) return;
    out.push(q);
    for (const next of shown) if (next.after === q.id) add(next);
  };
  for (const q of shown) if (q.after === undefined || !shown.some((p) => p.id === q.after)) add(q);
  return out;
}

/**
 * Needle and carbon copies come with the first question on the wall that has a
 * clue with `source: "pin"` (open or answered, SPEC 7.6). A question once on the
 * wall stays there, so they stay too. Derived from the content, no switch of its own.
 */
export function needlesActive(content: Content, ctx: Pick<BoardContext, 'day' | 'board'>): boolean {
  return visibleQuestions(content, ctx).some((q) => q.clues.some((c) => c.source === 'pin'));
}

/** One question as it hangs on the wall. */
export interface WallQuestion {
  question: DayQuestion;
  answered: boolean;
  /** Clues hanging at it, given ones first, then in the order the player placed them. */
  hanging: Clue[];
  have: number;
  total: number;
}

/** A column of the wall: questions of one `group` (null: without group). */
export interface WallColumn {
  group: string | null;
  questions: WallQuestion[];
}

/**
 * The wall as the game lays it out (SPEC 7.6): columns by `group` in the order
 * the groups came up, questions within a column as they came up. Not saved.
 */
export function wall(content: Content, ctx: Pick<BoardContext, 'day' | 'board'>): WallColumn[] {
  const cols: WallColumn[] = [];
  for (const q of visibleQuestions(content, ctx)) {
    const group = q.group ?? null;
    let col = cols.find((c) => c.group === group);
    if (!col) cols.push((col = { group, questions: [] }));
    const order = ctx.board.placed[q.id] ?? [];
    const hanging = q.clues
      .filter((c) => isPlaced(ctx.board, q, c))
      .sort((a, b) => Number(!a.given) - Number(!b.given) || order.indexOf(clueKey(a)) - order.indexOf(clueKey(b)));
    col.questions.push({ question: q, answered: isAnswered(ctx.board, q), hanging, have: hanging.length, total: q.clues.length });
  }
  return cols;
}

/** Questions answered so far, among those on the wall. */
export function answeredQuestions(content: Content, ctx: Pick<BoardContext, 'day' | 'board'>): DayQuestion[] {
  return visibleQuestions(content, ctx).filter((q) => isAnswered(ctx.board, q));
}

/** Questions of a day that come up on their own at the start of it (no `after`): shown as notes. */
export function newQuestionsOfDay(content: Content, day: number): DayQuestion[] {
  return allQuestions(content).filter((q) => q.day === day && q.after === undefined);
}

/** A card in the hand. `auto`: it came by filing its Akte; else the player pinned it. */
export interface HandCard {
  ref: ClueRef;
  key: string;
  auto: boolean;
}

const caseFiled = (filed: readonly string[], caseId: string) => filed.includes(caseId);

/**
 * Clues a question still waits for (not given, not placed) that the hand
 * offers by itself: `auto` clues whose Akte lies in the outbox.
 */
function autoClues(q: Question, ctx: BoardContext): Clue[] {
  return q.clues.filter((c) => !isPlaced(ctx.board, q, c) && c.source !== 'pin' && caseFiled(ctx.filed, c.case));
}

/**
 * The hand: `auto` clues of open questions on the wall whose Akte is filed,
 * then the places the player pinned. Every place only once.
 */
export function hand(content: Content, ctx: BoardContext): HandCard[] {
  const out: HandCard[] = [];
  const keys = new Set<string>();
  for (const q of visibleQuestions(content, ctx)) {
    if (isAnswered(ctx.board, q)) continue;
    for (const c of autoClues(q, ctx)) {
      const key = clueKey(c);
      if (keys.has(key)) continue;
      keys.add(key);
      out.push({ ref: refOf(c), key, auto: true });
    }
  }
  for (const ref of ctx.board.pinned) {
    const key = clueKey(ref);
    if (keys.has(key)) continue;
    keys.add(key);
    out.push({ ref, key, auto: false });
  }
  return out;
}

/** Cards in the hand the player has not seen yet. */
export function newClues(content: Content, ctx: BoardContext): HandCard[] {
  return hand(content, ctx).filter((c) => !ctx.board.seenClues.includes(c.key));
}

/** Answered questions on the wall the player has not looked at yet. */
export function unseenAnswers(content: Content, ctx: BoardContext): DayQuestion[] {
  return answeredQuestions(content, ctx).filter((q) => !ctx.board.seenAnswers.includes(q.id));
}

/** Everything in the hand and every answer on the wall counts as seen. */
export function markBoardSeen(content: Content, ctx: BoardContext): BoardState {
  const b = ctx.board;
  const clues = hand(content, ctx).map((c) => c.key).filter((k) => !b.seenClues.includes(k));
  const answers = answeredQuestions(content, ctx).map((q) => q.id).filter((id) => !b.seenAnswers.includes(id));
  if (!clues.length && !answers.length) return b;
  return { ...b, seenClues: [...b.seenClues, ...clues], seenAnswers: [...b.seenAnswers, ...answers] };
}

/** Cards that come into the hand going from `before` to `after` (e.g. by filing an Akte). */
export function cluesGained(content: Content, before: BoardContext, after: BoardContext): HandCard[] {
  const had = new Set(hand(content, before).map((c) => c.key));
  return hand(content, after).filter((c) => !had.has(c.key));
}

// ---------- Places in the content ----------

/** True if the place exists in the content: a line of a paper, or a visible office stamp. */
export function refExists(content: Content, ref: ClueRef): boolean {
  const k = content.cases.find((x) => x.id === ref.case);
  if (!k) return false;
  const docs = ref.followUp ? k.followUp?.documents : k.documents;
  if (!docs) return false;
  if ('field' in ref) return ref.field === 'representative' && !!k.representative?.stampVisible && docs.some((d) => d.stamp);
  return docs.some((d) => d.title === ref.document && d.lines.some(([l]) => l === ref.line));
}

/** What a card shows: the value of the line, or the name of the representative. */
export function clueValue(content: Content, ref: ClueRef): string {
  const k = content.cases.find((x) => x.id === ref.case);
  if (!k) return '';
  if ('field' in ref) return k.representative?.name ?? '';
  const docs = ref.followUp ? (k.followUp?.documents ?? []) : k.documents;
  return docs.find((d) => d.title === ref.document)?.lines.find(([l]) => l === ref.line)?.[1] ?? '';
}

// ---------- Actions ----------

export type PinResult = 'pinned' | 'already' | 'invalid';

/**
 * Pins a place into the hand (SPEC 4, Anheften). Refused if it is not in the
 * content, or if it already lies in the hand.
 */
export function pin(content: Content, ctx: BoardContext, ref: ClueRef): { board: BoardState; result: PinResult } {
  if (!refExists(content, ref)) return { board: ctx.board, result: 'invalid' };
  const key = clueKey(ref);
  const clean: ClueRef = 'field' in ref ? { case: ref.case, field: 'representative' } : { case: ref.case, document: ref.document, line: ref.line };
  if (ref.followUp) clean.followUp = true;
  if (hand(content, ctx).some((c) => c.key === key)) return { board: ctx.board, result: 'already' };
  // Placed already, and no question on the wall still waits for it.
  const placedSomewhere = Object.values(ctx.board.placed).some((keys) => keys.includes(key));
  const stillWanted = visibleQuestions(content, ctx).some((q) => q.clues.some((c) => clueKey(c) === key && !isPlaced(ctx.board, q, c)));
  if (placedSomewhere && !stillWanted) return { board: ctx.board, result: 'already' };
  return { board: { ...ctx.board, pinned: [...ctx.board.pinned, clean] }, result: 'pinned' };
}

/** Lays a pinned card away (SPEC 4). Cards that came by filing stay. */
export function discard(ctx: BoardContext, key: string): BoardState {
  if (!ctx.board.pinned.some((r) => clueKey(r) === key)) return ctx.board;
  return { ...ctx.board, pinned: ctx.board.pinned.filter((r) => clueKey(r) !== key) };
}

export type PlaceResult = 'placed' | 'answered' | 'wrong' | 'invalid';

/**
 * Lays a card from the hand on a question (SPEC 7.6). It fits if the question
 * waits for exactly this place: then it hangs there, and the question may be
 * answered. Else `misses` goes up by one and the card stays in the hand.
 */
export function place(content: Content, ctx: BoardContext, key: string, questionId: string): { board: BoardState; result: PlaceResult } {
  const card = hand(content, ctx).find((c) => c.key === key);
  const q = visibleQuestions(content, ctx).find((x) => x.id === questionId);
  if (!card || !q || isAnswered(ctx.board, q)) return { board: ctx.board, result: 'invalid' };
  const fits = q.clues.some((c) => clueKey(c) === key && !isPlaced(ctx.board, q, c));
  if (!fits) return { board: { ...ctx.board, misses: ctx.board.misses + 1 }, result: 'wrong' };

  const placed = { ...ctx.board.placed, [q.id]: [...(ctx.board.placed[q.id] ?? []), key] };
  let board: BoardState = { ...ctx.board, placed };
  // A pinned card stays in the hand only while another question on the wall still waits for it.
  const next = { ...ctx, board };
  const stillWanted = visibleQuestions(content, next).some((o) => !isAnswered(board, o) && o.clues.some((c) => clueKey(c) === key && !isPlaced(board, o, c)));
  if (!stillWanted) board = { ...board, pinned: board.pinned.filter((r) => clueKey(r) !== key) };
  return { board, result: isAnswered(board, q) ? 'answered' : 'placed' };
}

// ---------- Copies and drawer ----------

/** Carbon copies of filed Akten (SPEC 7.6): per day, in the order they were filed. */
export interface CopyDay {
  day: number;
  akten: string[];
}

export function copies(results: readonly { akteId: string; day: number }[]): CopyDay[] {
  const out: CopyDay[] = [];
  for (const r of results) {
    let d = out.find((x) => x.day === r.day);
    if (!d) out.push((d = { day: r.day, akten: [] }));
    if (!d.akten.includes(r.akteId)) d.akten.push(r.akteId);
  }
  return out.sort((a, b) => a.day - b.day);
}

/** The ref of a line on the papers of an Akte on the desk or a copy (follow-ups marked). */
export function refOnAkte(content: Content, akteId: string, place: { document: string; line: string } | { field: 'representative' }): ClueRef {
  const akte = getAkte(content, akteId);
  const base = 'field' in place ? { case: akte.sourceCaseId, field: 'representative' as const } : { case: akte.sourceCaseId, document: place.document, line: place.line };
  return akte.isFollowUp ? { ...base, followUp: true } : base;
}

export type KeptNote = Extract<StoryEvent, { type: 'note' }> & { day: number };

/** Notes kept in the drawer up to `day`, in the order they came (SPEC 7.7). Needs no save of its own. */
export function drawerNotes(content: Content, state: { day: number; eventsShown?: Record<number, number[]> }): KeptNote[] {
  return [...content.days]
    .sort((a, b) => a.day - b.day)
    .filter((d) => d.day <= state.day)
    .flatMap((d) =>
      d.storyEvents.flatMap((e, i) => {
        // A note of today shown later in the day goes in only once it has been shown (SPEC 7.7, 7.8).
        const there = d.day < state.day || atStart(e) || (state.eventsShown?.[d.day] ?? []).includes(i);
        return e.type === 'note' && e.keep === 'drawer' && there ? [{ ...e, day: d.day }] : [];
      }),
    );
}

// ---------- Save ----------

const isRef = (v: unknown): v is ClueRef => {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.case !== 'string') return false;
  if (r.followUp !== undefined && r.followUp !== true) return false;
  return r.field === 'representative' ? r.document === undefined : typeof r.document === 'string' && typeof r.line === 'string';
};
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/**
 * The board of a save (SPEC 9). Missing: an empty board. Entries whose question
 * or place is no longer in the content fall away silently.
 */
export function boardFromSave(content: Content, raw: unknown): BoardState {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY_BOARD };
  const r = raw as Record<string, unknown>;
  const questions = new Map(allQuestions(content).map((q) => [q.id, q]));
  const placed: Record<string, string[]> = {};
  if (typeof r.placed === 'object' && r.placed !== null) {
    for (const [id, keys] of Object.entries(r.placed)) {
      const q = questions.get(id);
      if (!q) continue;
      const known = new Set(q.clues.filter((c) => !c.given).map(clueKey));
      const kept = [...new Set(strings(keys).filter((k) => known.has(k)))];
      if (kept.length) placed[id] = kept;
    }
  }
  const seenPinned = new Set<string>();
  const pinned = (Array.isArray(r.pinned) ? r.pinned : []).filter(isRef).flatMap((ref) => {
    const key = clueKey(ref);
    if (!refExists(content, ref) || seenPinned.has(key)) return [];
    seenPinned.add(key);
    const clean: ClueRef = 'field' in ref ? { case: ref.case, field: 'representative' } : { case: ref.case, document: ref.document, line: ref.line };
    return [ref.followUp ? { ...clean, followUp: true as const } : clean];
  });
  const misses = typeof r.misses === 'number' && Number.isInteger(r.misses) && r.misses >= 0 ? r.misses : 0;
  return {
    placed,
    pinned,
    seenClues: [...new Set(strings(r.seenClues))],
    seenAnswers: [...new Set(strings(r.seenAnswers).filter((id) => questions.has(id)))],
    misses,
  };
}

/** Context for the board functions from a game state. */
export function boardContext(state: { day: number; board: BoardState; results: readonly { akteId: string }[] }): BoardContext {
  return { day: state.day, board: state.board, filed: state.results.map((r) => r.akteId) };
}

