import { parseAmount, toCents } from './amount';
import { OFFEN } from './schema';
import { isAmountDecision, type Akte, type Answer, type CaseError, type LineRef, type Mark } from './types';

const sameLine = (x: LineRef, y: LineRef) => x.document === y.document && x.line === y.line;

/** True when two pairs name the same two lines, in either order. */
export function samePair(m: Mark, n: Mark): boolean {
  return (sameLine(m.a, n.a) && sameLine(m.b, n.b)) || (sameLine(m.a, n.b) && sameLine(m.b, n.a));
}

/**
 * Pure evaluation of one Akte (SPEC 5). Each wrong or undecided position or
 * decision (unless it is `offen`), each wrong or empty amount and each wrong
 * stamp is one error. An Ergänzungsersuchen on a complete Akte is the stamp
 * error `unnoetige-verzoegerung`. Discrepancies count only when the Akte has
 * some and the player asked for documents; a wrong question counts once.
 * Returns structured data only, no display text.
 */
export function evaluate(akte: Akte, answer: Answer): CaseError[] {
  const errors: CaseError[] = [];
  const kind = akte.kind;

  if (kind.type === 'werbungskosten') {
    for (const p of kind.positions) {
      const given = answer.positions[p.id];
      if (p.correct === 'offen') {
        if (given !== undefined) errors.push({ kind: 'position-offen-entschieden', positionId: p.id, given, expected: p.correct });
      } else if (given === undefined) {
        errors.push({ kind: 'position-nicht-entschieden', positionId: p.id, expected: p.correct });
      } else if (given !== p.correct) {
        errors.push({ kind: 'position-falsch', positionId: p.id, given, expected: p.correct });
      }
    }
  } else if (kind.type === 'steuerpflicht') {
    const d = kind.decision;
    if (answer.option === undefined) {
      errors.push({ kind: 'option-fehlt', expected: d.correct });
    } else if (answer.option !== d.correct) {
      errors.push({ kind: 'option-falsch', given: answer.option, expected: d.correct });
    }
  } else {
    for (const d of kind.decisions) {
      if (isAmountDecision(d)) {
        const raw = answer.amounts?.[d.id];
        const given = raw === undefined ? null : parseAmount(raw);
        const expectedCents = toCents(d.correct);
        if (given === null) {
          errors.push({ kind: 'betrag-fehlt', decisionId: d.id, given: raw, expectedCents });
        } else if (given !== expectedCents) {
          errors.push({ kind: 'betrag-falsch', decisionId: d.id, given: raw, givenCents: given, expectedCents });
        }
        continue;
      }
      const given = answer.decisions?.[d.id];
      if (d.correct === OFFEN) {
        if (given !== undefined) errors.push({ kind: 'entscheidung-offen-entschieden', decisionId: d.id, given, expected: d.correct });
      } else if (given === undefined) {
        errors.push({ kind: 'entscheidung-fehlt', decisionId: d.id, expected: d.correct });
      } else if (given !== d.correct) {
        errors.push({ kind: 'entscheidung-falsch', decisionId: d.id, given, expected: d.correct });
      }
    }

    if (kind.discrepancies.length > 0 && answer.stamp === 'ergaenzung') {
      const marks = answer.marks ?? [];
      for (const w of kind.discrepancies) {
        if (!marks.some((m) => samePair(m, w))) errors.push({ kind: 'widerspruch-fehlt', discrepancyId: w.id });
      }
      for (const m of marks) {
        if (!kind.discrepancies.some((w) => samePair(m, w))) errors.push({ kind: 'widerspruch-falsch', mark: m });
      }
    }

    if (kind.inquiry && answer.inquiry !== undefined && answer.inquiry !== kind.inquiry.correct) {
      errors.push({ kind: 'nachfrage-falsch', given: answer.inquiry, expected: kind.inquiry.correct });
    }
  }

  if (answer.stamp !== akte.correctStamp) {
    const k = answer.stamp === 'ergaenzung' && akte.correctStamp === 'bescheid' ? 'unnoetige-verzoegerung' : 'stempel-falsch';
    errors.push({ kind: k, given: answer.stamp, expected: akte.correctStamp });
  }

  return errors;
}

/** The answer that the content defines as correct. Used by tests and the review. */
export function correctAnswer(akte: Akte): Answer {
  const answer: Answer = { positions: {}, stamp: akte.correctStamp };
  const kind = akte.kind;
  if (kind.type === 'werbungskosten') {
    for (const p of kind.positions) if (p.correct !== 'offen') answer.positions[p.id] = p.correct;
  } else if (kind.type === 'steuerpflicht') {
    answer.option = kind.decision.correct;
  } else {
    answer.decisions = {};
    answer.amounts = {};
    for (const d of kind.decisions) {
      if (isAmountDecision(d)) answer.amounts[d.id] = String(d.correct);
      else if (d.correct !== OFFEN) answer.decisions[d.id] = d.correct;
    }
    if (akte.correctStamp === 'ergaenzung') {
      answer.marks = kind.discrepancies.map((w) => ({ a: w.a, b: w.b }));
      if (kind.inquiry) answer.inquiry = kind.inquiry.correct;
    }
  }
  return answer;
}
