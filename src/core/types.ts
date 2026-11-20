import type { z } from 'zod';
import type {
  CaseSchema,
  ContentSchema,
  DaySchema,
  DecisionSchema,
  DocumentSchema,
  FollowUpSchema,
  PositionSchema,
  PositionVerdictSchema,
  RepresentativeSchema,
  RuleSchema,
  StampSchema,
  StoryEventSchema,
  TaxpayerSchema,
  TextsSchema,
} from './schema';

export type Stamp = z.infer<typeof StampSchema>;
export type PositionVerdict = z.infer<typeof PositionVerdictSchema>;
/** What the player can click on a position. `offen` is never a button. */
export type PlayerVerdict = Exclude<PositionVerdict, 'offen'>;
export type Rule = z.infer<typeof RuleSchema>;
export type StoryEvent = z.infer<typeof StoryEventSchema>;
export type Day = z.infer<typeof DaySchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type Taxpayer = z.infer<typeof TaxpayerSchema>;
export type Representative = z.infer<typeof RepresentativeSchema>;
export type FollowUp = z.infer<typeof FollowUpSchema>;
export type Case = z.infer<typeof CaseSchema>;
export type Content = z.infer<typeof ContentSchema>;
export type Texts = z.infer<typeof TextsSchema>;

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
  kind:
    | { type: 'werbungskosten'; positions: Position[] }
    | { type: 'steuerpflicht'; decision: Decision };
}

/** The player's input for one Akte. */
export interface Answer {
  positions: Record<string, PlayerVerdict | undefined>;
  option?: string;
  stamp?: Stamp;
}

export type CaseErrorKind =
  | 'position-falsch'
  | 'position-offen-entschieden'
  | 'position-nicht-entschieden'
  | 'option-falsch'
  | 'option-fehlt'
  | 'stempel-falsch'
  | 'unnoetige-verzoegerung';

/**
 * Structured error. Core produces no display text; the UI builds it from
 * labels in `content.texts` and the position labels.
 */
export interface CaseError {
  kind: CaseErrorKind;
  positionId?: string;
  /** What the player gave (verdict, option or stamp), if anything. */
  given?: string;
  /** What the content defines as correct. */
  expected?: string;
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
}
