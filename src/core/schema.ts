import { z } from 'zod';

/** Schema exactly mirroring content/*.json (SPEC 3). Types are inferred from it. */

export const StampSchema = z.enum(['bescheid', 'ergaenzung']);
export const PositionVerdictSchema = z.enum(['anerkennen', 'streichen', 'offen']);
/** Correct value of a decision that no option answers; to be clarified by Ergänzungsersuchen. */
export const OFFEN = 'offen';

export const RuleSchema = z.object({
  id: z.string().min(1),
  day: z.number().int().positive(),
  title: z.string().min(1),
  text: z.string().min(1),
  source: z.string().min(1),
  sourceUrl: z.string().url(),
  hint: z.literal(true).optional(),
});

const text = z.string().min(1);

export const ToolSchema = z.enum(['calculator', 'calendar', 'pinboard', 'drawer', 'marking']);

export const EventEffectsSchema = z.strictObject({
  time: z.number().int(),
  rating: z.number().int(),
  gerri: z.number().int(),
  home: z.number().int(),
});

/** A text that is still a draft (SPEC 3); no effect in the game, listed by `npm run content:report`. */
const provisional = z.literal(true).optional();

export const StoryEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('note'), from: text, text, title: text.optional(), keep: z.literal('drawer').optional(), provisional }),
  z.strictObject({ type: z.literal('dialog'), from: text, text, provisional }),
  z.strictObject({ type: z.literal('newspaper'), from: text, headline: text, text, provisional }),
  z.strictObject({ type: z.literal('call'), from: text, text, provisional }),
  z.strictObject({ type: z.literal('unlock'), feature: ToolSchema, provisional }),
  z.strictObject({
    type: z.literal('event'),
    id: text,
    text,
    provisional,
    options: z
      .array(z.object({ text, effects: EventEffectsSchema, sets: z.array(text) }))
      .min(1),
  }),
  z.strictObject({ type: z.literal('actSummary'), act: z.number().int().positive(), provisional }),
]);

/** Where a clue is found: a line of a paper, or the office stamp of the representative (SPEC 3, Fragen). */
export const ClueSchema = z.union([
  z.strictObject({ case: text, document: text, line: text, given: z.literal(true).optional(), source: z.enum(['auto', 'pin']).optional() }),
  z.strictObject({ case: text, field: text, given: z.literal(true).optional(), source: z.enum(['auto', 'pin']).optional() }),
]);

/** An open question on the pinboard (SPEC 3, 7.6). */
export const QuestionSchema = z.strictObject({
  id: text,
  text,
  from: text.optional(),
  group: text.optional(),
  after: text.optional(),
  clues: z.array(ClueSchema).min(1),
  answer: z.strictObject({ text, from: text.optional() }),
  provisional,
});

export const DaySchema = z.object({
  day: z.number().int().positive(),
  intro: text,
  stamps: z.array(StampSchema).min(1),
  cases: z.array(text),
  storyEvents: z.array(StoryEventSchema),
  questions: z.array(QuestionSchema).optional(),
});

export const DocumentSchema = z.object({
  kind: z.enum(['erklaerung', 'beleg']),
  title: text,
  lines: z.array(z.tuple([z.string(), z.string()])),
  stamp: text.optional(),
});

export const PositionSchema = z.object({
  id: text,
  label: text,
  amount: z.number().nonnegative(),
  correct: PositionVerdictSchema,
  rules: z.array(text),
  explanation: z.string(),
});

/** Single question of a `steuerpflicht` Akte. */
export const DecisionSchema = z.object({
  question: text,
  options: z.array(text).min(2),
  correct: text,
  rules: z.array(text),
  explanation: z.string(),
});

/** Amount in euro with at most two decimals (compared in whole cents). */
const euro = z
  .number()
  .nonnegative()
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, { message: 'höchstens zwei Nachkommastellen' });

/** An option is a key into `texts.optionLabels`, or carries its label itself. */
export const OptionSchema = z.union([text, z.strictObject({ value: text, label: text })]);

const DecisionBase = {
  id: text,
  label: text,
  rules: z.array(text).min(1),
  explanation: text,
  amount: euro.optional(),
};

export const ChoiceDecisionSchema = z.strictObject({
  ...DecisionBase,
  options: z.array(OptionSchema).min(2),
  correct: text,
});

export const AmountDecisionSchema = z.strictObject({
  ...DecisionBase,
  answerType: z.literal('amount'),
  correct: euro,
});

/** One line of an `entscheidungen` Akte: either a choice or an amount to type in. */
export const EDecisionSchema = z.union([AmountDecisionSchema, ChoiceDecisionSchema]);

export const LineRefSchema = z.strictObject({ document: text, line: text });

export const DiscrepancySchema = z.object({
  id: text,
  decision: text,
  a: LineRefSchema,
  b: LineRefSchema,
  explanation: text,
});

export const InquirySchema = z.object({
  decision: text,
  prompt: text,
  options: z.array(z.object({ id: text, label: text, answer: text })).min(2),
  correct: text,
});

export const TaxpayerSchema = z.object({
  name: text,
  job: text.optional(),
  employer: text.optional(),
});

export const RepresentativeSchema = z.object({
  name: text,
  stampVisible: z.boolean(),
});

const FollowUpBase = {
  arrivesOnDay: z.number().int().positive(),
  documents: z.array(DocumentSchema).min(1),
  correctStamp: StampSchema,
};

export const FollowUpSchema = z.object({ ...FollowUpBase, positions: z.array(PositionSchema).min(1) });
export const EFollowUpSchema = z.object({ ...FollowUpBase, decisions: z.array(EDecisionSchema).min(1) });

const CaseBase = {
  id: text,
  story: z.boolean().optional(),
  variantOf: text.optional(),
  taxpayer: TaxpayerSchema,
  representative: RepresentativeSchema.optional(),
  documents: z.array(DocumentSchema).min(1),
  correctStamp: StampSchema,
};

export const WerbungskostenCaseSchema = z.object({
  ...CaseBase,
  type: z.literal('werbungskosten'),
  positions: z.array(PositionSchema).min(1),
  followUp: FollowUpSchema.optional(),
});

export const SteuerpflichtCaseSchema = z.object({
  ...CaseBase,
  type: z.literal('steuerpflicht'),
  decision: DecisionSchema,
  followUp: FollowUpSchema.optional(),
});

export const EntscheidungenCaseSchema = z.object({
  ...CaseBase,
  type: z.literal('entscheidungen'),
  decisions: z.array(EDecisionSchema).min(1),
  discrepancies: z.array(DiscrepancySchema).optional(),
  inquiry: InquirySchema.optional(),
  followUp: EFollowUpSchema.optional(),
});

export const CaseSchema = z.discriminatedUnion('type', [WerbungskostenCaseSchema, SteuerpflichtCaseSchema, EntscheidungenCaseSchema]);

export const TextsSchema = z.object({
  optionLabels: z.record(z.string(), text),
  stampLabels: z.strictObject({ bescheid: text, ergaenzung: text }),
  unnecessaryDelay: text,
  warning: z.object({
    minErrors: z.number().int().positive(),
    from: text,
    text,
  }),
  emptyDay: text,
  /** Required as soon as an Akte has an `inquiry` (checked in the loader). */
  wrongInquiry: text.optional(),
  /** Required as soon as an Akte has `discrepancies` (checked in the loader). */
  missedDiscrepancy: text.optional(),
  falseDiscrepancy: text.optional(),
});

export const MetaSchema = z.object({
  version: z.string(),
  akt: z.number().int().positive(),
  veranlagungsjahr: z.number().int(),
  hinweis: z.string(),
  /** Month the desk calendar opens with in this act (SPEC 3). */
  kalenderStart: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Monat im Format JJJJ-MM')
    .optional(),
});

export const ContentSchema = z.object({
  meta: MetaSchema,
  texts: TextsSchema,
  rules: z.array(RuleSchema).min(1),
  days: z.array(DaySchema).min(1),
  cases: z.array(CaseSchema).min(1),
});

// ---------- content/kalender.json (SPEC 3, Tischkalender) ----------

const holidayName = z.string().trim().min(1, 'Name ist leer');

/** Days per month in a leap year, so 02-29 is a valid fixed date. */
const MAX_DAY = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const MonthDay = z
  .string()
  .regex(/^\d{2}-\d{2}$/, 'Datum im Format MM-TT')
  .refine((s) => {
    const [m, d] = s.split('-').map(Number) as [number, number];
    return m >= 1 && m <= 12 && d >= 1 && d <= MAX_DAY[m - 1]!;
  }, 'kein gültiges Datum (Monat 1 bis 12, Tag im Monat)');

export const CalendarSchema = z.object({
  meta: z.object({ version: z.string(), quelle: z.string(), hinweis: z.string() }),
  holidays: z.object({
    fixed: z.array(z.strictObject({ date: MonthDay, name: holidayName })),
    easter: z.array(z.strictObject({ offset: z.number().int(), name: holidayName })),
  }),
});

export type CalendarContent = z.infer<typeof CalendarSchema>;
