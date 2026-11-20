import type { Akte, Answer, CaseError } from './types';

/**
 * Pure evaluation of one Akte. Each wrong or undecided position (unless it is
 * `offen`), each wrong or missing option and each wrong stamp is one error.
 * An Ergänzungsersuchen on a complete Akte is the stamp error of kind
 * `unnoetige-verzoegerung`. Returns structured data only, no display text.
 */
export function evaluate(akte: Akte, answer: Answer): CaseError[] {
  const errors: CaseError[] = [];

  if (akte.kind.type === 'werbungskosten') {
    for (const p of akte.kind.positions) {
      const given = answer.positions[p.id];
      if (p.correct === 'offen') {
        if (given !== undefined) errors.push({ kind: 'position-offen-entschieden', positionId: p.id, given, expected: p.correct });
      } else if (given === undefined) {
        errors.push({ kind: 'position-nicht-entschieden', positionId: p.id, expected: p.correct });
      } else if (given !== p.correct) {
        errors.push({ kind: 'position-falsch', positionId: p.id, given, expected: p.correct });
      }
    }
  } else {
    const d = akte.kind.decision;
    if (answer.option === undefined) {
      errors.push({ kind: 'option-fehlt', expected: d.correct });
    } else if (answer.option !== d.correct) {
      errors.push({ kind: 'option-falsch', given: answer.option, expected: d.correct });
    }
  }

  if (answer.stamp !== akte.correctStamp) {
    const kind = answer.stamp === 'ergaenzung' && akte.correctStamp === 'bescheid' ? 'unnoetige-verzoegerung' : 'stempel-falsch';
    errors.push({ kind, given: answer.stamp, expected: akte.correctStamp });
  }

  return errors;
}

/** The answer that the content defines as correct. Used by tests and the review. */
export function correctAnswer(akte: Akte): Answer {
  const positions: Answer['positions'] = {};
  let option: string | undefined;
  if (akte.kind.type === 'werbungskosten') {
    for (const p of akte.kind.positions) if (p.correct !== 'offen') positions[p.id] = p.correct;
  } else {
    option = akte.kind.decision.correct;
  }
  return { positions, option, stamp: akte.correctStamp };
}
