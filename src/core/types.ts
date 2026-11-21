import type { z } from 'zod';
import type {
  AmountDecisionSchema,
  CaseSchema,
  ChoiceDecisionSchema,
  ContentSchema,
  DaySchema,
  DecisionSchema,
  DiscrepancySchema,
  DocumentSchema,
  EDecisionSchema,
  InquirySchema,
  LineRefSchema,
  OptionSchema,
  PositionSchema,
  PositionVerdictSchema,
  RepresentativeSchema,
  RuleSchema,
  StampSchema,
  StoryEventSchema,
  TaxpayerSchema,
  TextsSchema,
  ToolSchema,
  TraceSchema,
} from './schema';

export type Stamp = z.infer<typeof StampSchema>;
export type PositionVerdict = z.infer<typeof PositionVerdictSchema>;
/** What the player can click on a position. `offen` is never a button. */
export type PlayerVerdict = Exclude<PositionVerdict, 'offen'>;
export type Rule = z.infer<typeof RuleSchema>;
export type StoryEvent = z.infer<typeof StoryEventSchema>;
export type Tool = z.infer<typeof ToolSchema>;
export type Trace = z.infer<typeof TraceSchema>;
export type Day = z.infer<typeof DaySchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type Option = z.infer<typeof OptionSchema>;
export type ChoiceDecision = z.infer<typeof ChoiceDecisionSchema>;
export type AmountDecision = z.infer<typeof AmountDecisionSchema>;
/** One decision of an `entscheidungen` Akte. */
export type EDecision = z.infer<typeof EDecisionSchema>;
export type LineRef = z.infer<typeof LineRefSchema>;
export type Discrepancy = z.infer<typeof DiscrepancySchema>;
export type Inquiry = z.infer<typeof InquirySchema>;
export type Taxpayer = z.infer<typeof TaxpayerSchema>;
export type Representative = z.infer<typeof RepresentativeSchema>;
export type Case = z.infer<typeof CaseSchema>;
export type Content = z.infer<typeof ContentSchema>;
export type Texts = z.infer<typeof TextsSchema>;

export const isAmountDecision = (d: EDecision): d is AmountDecision => 'answerType' in d;

export type AkteKind =
  | { type: 'werbungskosten'; positions: Position[] }
  | { type: 'steuerpflicht'; decision: Decision }
  | { type: 'entscheidungen'; decisions: EDecision[]; discrepancies: Discrepancy[]; inquiry?: Inquiry };

/**
 * A file on the desk. Either a case from the content as-is, or the follow-up
 * of a case, normalised to the same shape so the UI and evaluation treat both alike.
 */
export interface Akte {
  /** Unique id; follow-ups get `<caseId>/folge`. */
  id: string;
  sourceCaseId: string;
  isFollowUp: boolean;
  story: boolean;
  taxpayer: Taxpayer;
  representative?: Representative;
  documents: Document[];
  correctStamp: Stamp;
  kind: AkteKind;
}

/** Two lines in two papers of the same Akte that the player marked as contradicting each other. */
export interface Mark {
  a: LineRef;
  b: LineRef;
}

/**
 * The player's input for one Akte. Fields added after 0.2 are optional so
 * saves from 0.2 stay valid.
 */
export interface Answer {
  positions: Record<string, PlayerVerdict | undefined>;
  option?: string;
  /** Chosen option value per choice decision (`entscheidungen`). */
  decisions?: Record<string, string>;
  /** Amount per amount decision, exactly as typed; parsed with `parseAmount`. */
  amounts?: Record<string, string>;
  marks?: Mark[];
  /** Id of the question chosen for the Ergänzungsersuchen. */
  inquiry?: string;
  stamp?: Stamp;
}

export type CaseErrorKind =
  | 'position-falsch'
  | 'position-offen-entschieden'
  | 'position-nicht-entschieden'
  | 'option-falsch'
  | 'option-fehlt'
  | 'entscheidung-falsch'
  | 'entscheidung-offen-entschieden'
  | 'entscheidung-fehlt'
  | 'betrag-falsch'
  | 'betrag-fehlt'
  | 'widerspruch-fehlt'
  | 'widerspruch-falsch'
  | 'nachfrage-falsch'
  | 'stempel-falsch'
  | 'unnoetige-verzoegerung';

/**
 * Structured error. Core produces no display text; the UI builds it from
 * labels in `content.texts`, the Akte and ui.json.
 */
export interface CaseError {
  kind: CaseErrorKind;
  positionId?: string;
  /** Decision of an `entscheidungen` Akte. */
  decisionId?: string;
  /** What the player gave (verdict, option value, typed amount, question id or stamp), if anything. */
  given?: string;
  /** What the content defines as correct. */
  expected?: string;
  /** Amounts in whole cents; `givenCents` is missing when the input was empty or unreadable. */
  givenCents?: number;
  expectedCents?: number;
  /** Discrepancy from the data that was not marked. */
  discrepancyId?: string;
  /** Marked pair that is no discrepancy in the data. */
  mark?: Mark;
}

export interface CaseResult {
  akteId: string;
  day: number;
  answer: Answer;
  errors: CaseError[];
}

export type EffectsLevel = 'aus' | 'reduziert' | 'voll';

export interface Settings {
  effects: EffectsLevel;
  volume: number;
  /** Background music, 0..1, independent of `volume`. */
  music: number;
}
