import { z } from 'zod';

/** Schema exactly mirroring content/*.json. Types are inferred from it. */

export const StampSchema = z.enum(['bescheid', 'ergaenzung']);
export const PositionVerdictSchema = z.enum(['anerkennen', 'streichen', 'offen']);

export const RuleSchema = z.object({
  id: z.string().min(1),
  day: z.number().int().positive(),
  title: z.string().min(1),
  text: z.string().min(1),
  source: z.string().min(1),
  sourceUrl: z.string().url(),
});

export const StoryEventSchema = z.object({
  type: z.enum(['note', 'dialog']),
  from: z.string().min(1),
  text: z.string().min(1),
});

export const DaySchema = z.object({
  day: z.number().int().positive(),
  intro: z.string().min(1),
  stamps: z.array(StampSchema).min(1),
  cases: z.array(z.string().min(1)),
  storyEvents: z.array(StoryEventSchema),
});

export const DocumentSchema = z.object({
  kind: z.enum(['erklaerung', 'beleg']),
  title: z.string().min(1),
  lines: z.array(z.tuple([z.string(), z.string()])),
  stamp: z.string().min(1).optional(),
});

export const PositionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  amount: z.number().nonnegative(),
  correct: PositionVerdictSchema,
  rules: z.array(z.string().min(1)),
  explanation: z.string(),
});

export const DecisionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correct: z.string().min(1),
  rules: z.array(z.string().min(1)),
  explanation: z.string(),
});

export const TaxpayerSchema = z.object({
  name: z.string().min(1),
  job: z.string().min(1),
  employer: z.string().min(1).optional(),
});

export const RepresentativeSchema = z.object({
  name: z.string().min(1),
  stampVisible: z.boolean(),
});

export const FollowUpSchema = z.object({
  arrivesOnDay: z.number().int().positive(),
  documents: z.array(DocumentSchema).min(1),
  positions: z.array(PositionSchema).min(1),
  correctStamp: StampSchema,
});

const CaseBase = {
  id: z.string().min(1),
  story: z.boolean().optional(),
  taxpayer: TaxpayerSchema,
  representative: RepresentativeSchema.optional(),
  documents: z.array(DocumentSchema).min(1),
  correctStamp: StampSchema,
  followUp: FollowUpSchema.optional(),
};

export const WerbungskostenCaseSchema = z.object({
  ...CaseBase,
  type: z.literal('werbungskosten'),
  positions: z.array(PositionSchema).min(1),
});

export const SteuerpflichtCaseSchema = z.object({
  ...CaseBase,
  type: z.literal('steuerpflicht'),
  decision: DecisionSchema,
});

export const CaseSchema = z.discriminatedUnion('type', [WerbungskostenCaseSchema, SteuerpflichtCaseSchema]);

export const TextsSchema = z.object({
  optionLabels: z.record(z.string(), z.string().min(1)),
  stampLabels: z.strictObject({ bescheid: z.string().min(1), ergaenzung: z.string().min(1) }),
  unnecessaryDelay: z.string().min(1),
  warning: z.object({
    minErrors: z.number().int().positive(),
    from: z.string().min(1),
    text: z.string().min(1),
  }),
  emptyDay: z.string().min(1),
});

export const ContentSchema = z.object({
  meta: z.object({
    version: z.string(),
    veranlagungsjahr: z.number().int(),
    hinweis: z.string(),
  }),
  texts: TextsSchema,
  rules: z.array(RuleSchema).min(1),
  days: z.array(DaySchema).min(1),
  cases: z.array(CaseSchema).min(1),
});
