/**
 * Reading typed amounts (SPEC 4 and 5). Everything is compared in whole cents,
 * never as floating point numbers.
 */

/** Euro amount from the content (at most two decimals, checked by the schema) in whole cents. */
export function toCents(euro: number): number {
  return Math.round(euro * 100);
}

/** Cents back to euro for `formatEuro`. */
export const fromCents = (cents: number): number => cents / 100;

const GROUPED = /^\d{1,3}(\.\d{3})+$/;
const PLAIN = /^\d+$/;

/**
 * Parses an amount as a player types it and returns whole cents, or `null` if
 * the input is empty or not a valid amount.
 *
 * Accepted: `4236,7`, `4.236,70`, `4236.70`, `4 236,70`, `4236`, `4.236,70 €`.
 * - Spaces (also non-breaking) and a leading or trailing `€` are ignored.
 * - Comma is the decimal separator; dots before it group thousands in threes.
 * - Without a comma, a single dot followed by one or two digits is a decimal
 *   point (`4236.70`); dots followed by three digits group thousands (`4.236`).
 * - Rejected: negative amounts, more than two decimals, letters, wrong grouping.
 */
export function parseAmount(input: string): number | null {
  const s = input.replace(/[\s  ]/g, '').replace(/^€|€$/g, '');
  if (s === '') return null;

  let intPart: string;
  let frac = '';
  const comma = s.split(',');
  if (comma.length > 2) return null;
  if (comma.length === 2) {
    intPart = comma[0]!;
    frac = comma[1]!;
    if (intPart.includes('.') && !GROUPED.test(intPart)) return null;
    intPart = intPart.replaceAll('.', '');
  } else {
    const dot = s.split('.');
    if (dot.length === 2 && /^\d{1,2}$/.test(dot[1]!)) {
      intPart = dot[0]!;
      frac = dot[1]!;
    } else if (dot.length === 1 || GROUPED.test(s)) {
      intPart = s.replaceAll('.', '');
    } else {
      return null;
    }
  }

  if (intPart === '') intPart = '0';
  if (!PLAIN.test(intPart) || !/^\d{0,2}$/.test(frac)) return null;
  if (comma.length === 2 && frac === '' && comma[0] === '') return null; // just ","
  const cents = Number(intPart) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}
