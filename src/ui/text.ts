import { z } from 'zod';

/**
 * Interface texts from `content/ui.json` (SPEC 3, „Oberflächentexte“).
 * The code only names keys; `t('area.key', { name: value })` returns the text.
 *
 * The key space is defined here once. The schema is built from it, and so is
 * the `UiKey` type, so an unknown key is a compile error and a key missing in
 * ui.json stops the start with a clear message.
 */
const KEYS = {
  title: ['heading', 'year', 'newGame', 'continue', 'confirmOverwrite'],
  intro: ['day', 'noteFrom', 'speaker', 'begin', 'newspaper', 'call', 'unlockCalculator'],
  desk: ['day', 'stack', 'pruefvermerk', 'akte', 'followUpId', 'colPosition', 'colAmount', 'colDecision', 'emptyDesk', 'stamps', 'outbox', 'outboxButton', 'stampFirst', 'amountLabel', 'amountPlaceholder', 'inquiryHeading', 'inquiryRequired', 'markMode', 'markHint', 'markCount', 'markClear', 'akteNoJob', 'markPair', 'markSide', 'markRemove'],
  verdict: ['anerkennen', 'streichen', 'offen'],
  codex: ['open', 'close', 'day', 'locked', 'new', 'simplified', 'sourceSeparator', 'searchPlaceholder', 'hits', 'hint', 'coverTitle', 'coverSubtitle', 'coverStand', 'runningHeadLeft', 'runningHeadRight', 'deliveryHeading', 'register', 'tabRegister', 'lockedSheet', 'nextPage', 'prevPage', 'noHits', 'searchClear'],
  evaluation: ['heading', 'noErrors', 'errorsToday', 'speaker', 'markOk', 'markWrong', 'result', 'followUpName', 'correct', 'wrong', 'errorStamp', 'errorDetail', 'notGiven', 'solution', 'positionHeading', 'questionHeading', 'correctStamp', 'ruleSeparator', 'closeDay', 'amountGiven', 'inquiryGiven', 'discrepancyHeading', 'errorAbout', 'inquiryCorrect', 'inquiryAnswer'],
  end: ['heading', 'colDay', 'colErrors', 'toStart'],
  calculator: ['heading', 'clear', 'equals', 'decimal', 'error', 'add', 'subtract', 'multiply', 'divide'],
  settings: ['heading', 'effects', 'effectsAus', 'effectsReduziert', 'effectsVoll', 'sound', 'volume', 'music', 'percent'],
  error: ['heading'],
  aria: ['codex', 'codexSearch', 'bookmarks', 'lockedPage', 'paper', 'officeStamp', 'pruefvermerk', 'worksurface', 'tools', 'calculator', 'amountInput', 'markableLine', 'calcDisplay', 'calcAdd', 'calcSubtract', 'calcMultiply', 'calcDivide', 'calcDecimal', 'calcClear', 'calcEquals', 'markRemove', 'codexPage', 'codexBook'],
} as const;

type Keys = typeof KEYS;
export type UiKey = { [A in keyof Keys]: `${A}.${Keys[A][number]}` }[keyof Keys];
export type UiParams = Record<string, string | number>;

const area = (keys: readonly string[]) => z.strictObject(Object.fromEntries(keys.map((k) => [k, z.string()])));
const UiSchema = z.strictObject({
  version: z.string(),
  ...Object.fromEntries(Object.entries(KEYS).map(([a, keys]) => [a, area(keys)])),
});

export class UiTextError extends Error {
  constructor(public readonly problems: string[]) {
    super(`ui.json ungültig:\n- ${problems.join('\n- ')}`);
    this.name = 'UiTextError';
  }
}

/** Validates ui.json. Throws UiTextError listing every problem. */
export function parseUiTexts(raw: unknown): Map<UiKey, string> {
  const parsed = UiSchema.safeParse(raw);
  if (!parsed.success) {
    throw new UiTextError(
      parsed.error.issues.map((issue) => {
        const path = issue.path.join('.') || '(Wurzel)';
        if (issue.code === 'unrecognized_keys') return `${path}: unbekannter Schlüssel ${issue.keys.join(', ')}`;
        if (issue.code === 'invalid_type' && issue.input === undefined) return `${path}: fehlt`;
        if (issue.code === 'invalid_type') return `${path}: hat den falschen Typ (erwartet ${issue.expected})`;
        return `${path}: ${issue.message}`;
      }),
    );
  }
  const out = new Map<UiKey, string>();
  for (const [a, keys] of Object.entries(KEYS)) {
    const texts = parsed.data[a as keyof typeof parsed.data] as unknown as Record<string, string>;
    for (const k of keys) out.set(`${a}.${k}` as UiKey, texts[k]!);
  }
  return out;
}

let texts: Map<UiKey, string> | null = null;

/** Sets the texts used by `t`. Throws UiTextError if ui.json is invalid. */
export function initTexts(raw: unknown): void {
  texts = parseUiTexts(raw);
}

export const textsReady = (): boolean => texts !== null;

/** The text for `key`, with `{name}` placeholders filled from `params`. */
export function t(key: UiKey, params: UiParams = {}): string {
  if (!texts) throw new Error(`Oberflächentexte nicht geladen (${key})`);
  const s = texts.get(key)!;
  return s.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}
