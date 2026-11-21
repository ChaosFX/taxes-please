import { fromCents, parseAmount } from '../core/amount';
import { formatEuro } from '../core/format';
import { optionValue } from '../core/loader';
import { OFFEN } from '../core/schema';
import type { Akte, ChoiceDecision, Content, LineRef, Mark, PlayerVerdict, PositionVerdict, Stamp } from '../core/types';
import { t, type UiKey } from './text';

/** Labels: game texts come from content.texts or the Akte, interface texts from ui.json. */

export const stampLabel = (c: Content, s: Stamp) => c.texts.stampLabels[s];
export const optionLabel = (c: Content, o: string) => c.texts.optionLabels[o] ?? o;

const VERDICT_KEYS = { anerkennen: 'verdict.anerkennen', streichen: 'verdict.streichen' } as const satisfies Record<PlayerVerdict, UiKey>;
export const playerVerdictLabel = (v: string) => (v in VERDICT_KEYS ? t(VERDICT_KEYS[v as PlayerVerdict]) : v);

/** `offen` is shown together with the stamp it calls for. */
export const offenLabel = (c: Content) => t('verdict.offen', { stamp: stampLabel(c, 'ergaenzung') });
export const verdictLabel = (c: Content, v: PositionVerdict) => (v === OFFEN ? offenLabel(c) : playerVerdictLabel(v));

/** Display name of an option value of a decision: from the option object or `texts.optionLabels`. */
export function choiceLabel(c: Content, d: ChoiceDecision, value: string): string {
  if (value === OFFEN) return offenLabel(c);
  const o = d.options.find((x) => optionValue(x) === value);
  return o && typeof o !== 'string' ? o.label : optionLabel(c, value);
}

/** Follow-up Akten carry `/folge` in their id; shown as „(Nachreichung)“. */
export const akteLabel = (akte: Akte) => (akte.isFollowUp ? t('desk.followUpId', { id: akte.sourceCaseId }) : akte.id);

export function akteHeading(akte: Akte): string {
  const { name, job } = akte.taxpayer;
  return job ? t('desk.akte', { id: akteLabel(akte), name, job }) : t('desk.akteNoJob', { id: akteLabel(akte), name });
}

export const lineText = (r: LineRef) => t('desk.markSide', { document: r.document, line: r.line });
export const pairText = (m: Mark) => t('desk.markPair', { a: lineText(m.a), b: lineText(m.b) });

/** Typed amount as shown: formatted when readable, as typed otherwise, `–` when empty. */
export function amountText(raw: string | undefined): string {
  if (raw === undefined || raw.trim() === '') return t('evaluation.notGiven');
  const cents = parseAmount(raw);
  return cents === null ? raw : formatEuro(fromCents(cents));
}
