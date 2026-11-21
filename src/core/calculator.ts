/**
 * Desk calculator (SPEC 7), as a pure state machine. It works like a simple
 * desk calculator: operations run in the order they are typed (`2 + 3 × 4 = 20`).
 * Results are rounded to 12 significant digits so `0,1 + 0,2` shows `0,3`.
 */

export type CalcOp = '+' | '-' | '*' | '/';
export type CalcKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | CalcOp | '=' | 'C' | 'back';

export interface CalcState {
  /** Number shown, in JS notation (`4236.7`); while typing it may end with `.`. */
  value: string;
  acc: number | null;
  op: CalcOp | null;
  /** True while the player types a number (digits are appended). */
  typing: boolean;
  /** Division by zero or overflow; only C leaves it (or starting a new number). */
  error: boolean;
}

export const CALC_INITIAL: CalcState = { value: '0', acc: null, op: null, typing: false, error: false };

const MAX_DIGITS = 12;
const LIMIT = 1e12;

function compute(a: number, op: CalcOp, b: number): number | null {
  let r: number;
  switch (op) {
    case '+':
      r = a + b;
      break;
    case '-':
      r = a - b;
      break;
    case '*':
      r = a * b;
      break;
    case '/':
      if (b === 0) return null;
      r = a / b;
      break;
  }
  r = Number(r.toPrecision(12));
  if (!Number.isFinite(r) || Math.abs(r) >= LIMIT) return null;
  return Object.is(r, -0) ? 0 : r;
}

/** Plain decimal notation without exponent, at most 12 decimals, no trailing zeros. */
function plain(n: number): string {
  const s = String(n);
  if (!/e/i.test(s)) return s;
  return n.toFixed(12).replace(/\.?0+$/, '');
}

const ERROR: CalcState = { ...CALC_INITIAL, error: true };

export function calcPress(state: CalcState, key: CalcKey): CalcState {
  if (key === 'C') return CALC_INITIAL;
  let s = state;
  if (s.error) {
    if (!/^[0-9,]$/.test(key)) return s;
    s = CALC_INITIAL;
  }

  if (/^[0-9]$/.test(key)) {
    if (!s.typing) return { ...s, value: key, typing: true };
    if (s.value.replace(/\D/g, '').length >= MAX_DIGITS) return s;
    return { ...s, value: s.value === '0' ? key : s.value + key };
  }
  if (key === ',') {
    if (!s.typing) return { ...s, value: '0.', typing: true };
    return s.value.includes('.') ? s : { ...s, value: `${s.value}.` };
  }
  if (key === 'back') {
    if (!s.typing) return s;
    const v = s.value.slice(0, -1);
    return { ...s, value: v === '' || v === '-' ? '0' : v };
  }

  const current = Number(s.value);
  if (key === '=') {
    if (s.op === null || s.acc === null) return { ...s, typing: false };
    const r = compute(s.acc, s.op, current);
    return r === null ? ERROR : { value: plain(r), acc: null, op: null, typing: false, error: false };
  }

  // Operator: finish a pending operation first, then remember the new one.
  const op = key as CalcOp;
  if (s.op !== null && s.acc !== null && s.typing) {
    const r = compute(s.acc, s.op, current);
    if (r === null) return ERROR;
    return { value: plain(r), acc: r, op, typing: false, error: false };
  }
  if (s.op !== null && !s.typing) return { ...s, op };
  return { ...s, acc: current, op, typing: false };
}

/** Number shown in Austrian format (`4.236,7`, `−12`), or `null` for the error display. */
export function calcDisplay(state: CalcState): string | null {
  if (state.error) return null;
  const negative = state.value.startsWith('-');
  const [int, frac] = state.value.replace('-', '').split('.') as [string, string | undefined];
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '−' : ''}${grouped}${frac !== undefined ? `,${frac}` : ''}`;
}

/** Keyboard key to calculator key; `null` if the key does nothing. */
export function calcKeyFor(key: string): CalcKey | null {
  if (/^[0-9]$/.test(key)) return key as CalcKey;
  const map: Record<string, CalcKey> = {
    ',': ',',
    '.': ',',
    '+': '+',
    '-': '-',
    '*': '*',
    x: '*',
    '/': '/',
    ':': '/',
    '=': '=',
    Enter: '=',
    Escape: 'C',
    Delete: 'C',
    c: 'C',
    C: 'C',
    Backspace: 'back',
  };
  return map[key] ?? null;
}

/** Presses a sequence of keys from the initial state. Convenience for tests. */
export function calculate(keys: CalcKey[]): string | null {
  return calcDisplay(keys.reduce(calcPress, CALC_INITIAL));
}
