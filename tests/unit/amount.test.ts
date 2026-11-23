import { describe, expect, it } from 'vitest';
import { parseAmount, toCents } from '../../src/core/amount';
import { calcDisplay, calcKeyFor, calcPress, calculate, CALC_INITIAL, type CalcKey } from '../../src/core/calculator';
import { formatEuro } from '../../src/core/format';

describe('parseAmount', () => {
  it.each(['4236,7', '4.236,70', '4236.70', '4 236,70', '4 236,70', '4236,70 €', '€ 4.236,70', ' 4236,70 '])('„%s“ → 4.236,70 €', (s) => {
    expect(parseAmount(s)).toBe(423670);
  });

  it.each([
    ['0', 0],
    ['0,00', 0],
    [',5', 50],
    ['4236', 423600],
    ['4236,', 423600],
    ['4.236', 423600],
    ['1.234.567,89', 123456789],
    ['1.234.567', 123456700],
    ['12.5', 1250],
    ['15000', 1500000],
  ])('„%s“ → %i Cent', (s, cents) => expect(parseAmount(s)).toBe(cents));

  it.each([
    ['', 'leer'],
    ['   ', 'nur Leerzeichen'],
    ['abc', 'Buchstaben'],
    ['12a', 'Buchstabe am Ende'],
    ['4.236,705', 'drei Nachkommastellen'],
    ['4236.705', 'drei Nachkommastellen mit Punkt'],
    ['-5', 'negativ'],
    ['−5,00', 'negativ mit Minuszeichen'],
    ['1,2,3', 'zwei Kommas'],
    ['12.34.5', 'falsche Gruppierung'],
    ['1.23,00', 'falsche Gruppierung vor Komma'],
    [',', 'nur Komma'],
    ['€', 'nur Eurozeichen'],
    ['1e3', 'Exponent'],
  ])('„%s“ ist ungültig (%s)', (s) => expect(parseAmount(s)).toBeNull());

  it('toCents rundet Gleitkommafehler weg', () => {
    expect(toCents(4236.7)).toBe(423670);
    expect(toCents(1806.7)).toBe(180670);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it('formatEuro und parseAmount passen zusammen', () => {
    for (const cents of [0, 5, 423670, 123456789]) expect(parseAmount(formatEuro(cents / 100))).toBe(cents);
  });
});

describe('Tischrechner', () => {
  /** Keys as a string: digits, `,`, `+-*\/`, `=`, `C`; `<` is backspace. */
  const run = (keys: string) => calculate([...keys].map((k) => (k === '<' ? 'back' : k)) as CalcKey[]);

  it.each([
    ['', '0'],
    ['12+7=', '19'],
    ['12-20=', '−8'],
    ['6*7=', '42'],
    ['7/2=', '3,5'],
    ['1000*12=', '12.000'],
    ['4236,7+1,3=', '4.238'],
    ['0,1+0,2=', '0,3'],
    ['1/3=', '0,333333333333'],
    ['2+3*4=', '20'],
    ['18000/12=', '1.500'],
    ['9000/8/2=', '562,5'],
    ['1500*12-18000=', '0'],
    [',5*4=', '2'],
    ['4236,', '4.236,'],
    ['4236,70', '4.236,70'],
    ['5+*3=', '15'],
    ['5+=', '10'],
    ['12<3', '13'],
    ['12+3C', '0'],
    ['1,2,3', '1,23'],
    ['3=', '3'],
  ])('%s → %s', (keys, shown) => expect(run(keys)).toBe(shown));

  it('Division durch null zeigt den Fehler, C setzt zurück', () => {
    const s = (['5', '/', '0', '='] as CalcKey[]).reduce(calcPress, CALC_INITIAL);
    expect(calcDisplay(s)).toBeNull();
    expect(calcDisplay(calcPress(s, '+'))).toBeNull();
    expect(calcDisplay(calcPress(s, '7'))).toBe('7');
    expect(calcPress(s, 'C')).toEqual(CALC_INITIAL);
  });

  it('nach einem Ergebnis beginnt eine Ziffer eine neue Zahl, ein Operator rechnet weiter', () => {
    expect(run('2+3=4')).toBe('4');
    expect(run('2+3=*2=')).toBe('10');
  });

  it('höchstens zwölf Ziffern, Überlauf ist ein Fehler', () => {
    expect(run('1234567890123')).toBe('123.456.789.012');
    expect(run('999999999999*10=')).toBeNull();
  });

  it('Backspace löscht die letzte Ziffer oder das Komma, nach = oder Operator nichts', () => {
    expect(run('123<')).toBe('12');
    expect(run('12,<')).toBe('12');
    expect(run('12,5<<')).toBe('12');
    expect(run('7<')).toBe('0');
    expect(run('12+<')).toBe('12');
    expect(run('12+3=<')).toBe('15');
    expect(run('12+34<=')).toBe('15');
  });

  it.each([
    // [event.key, event.code, Rechnertaste]
    ['7', 'Digit7', '7'],
    ['0', 'Digit0', '0'],
    ['+', 'BracketRight', '+'],
    ['+', 'Equal', '+'],
    ['-', 'Slash', '-'],
    ['-', 'Minus', '-'],
    ['*', 'BracketRight', '*'],
    ['/', 'Digit7', '/'],
    ['=', 'Digit0', '='],
    ['Enter', 'Enter', '='],
    [',', 'Comma', ','],
    ['.', 'Period', ','],
    ['Escape', 'Escape', 'C'],
    ['Delete', 'Delete', 'C'],
    ['Backspace', 'Backspace', 'back'],
    // Keypad with Num Lock on …
    ['7', 'Numpad7', '7'],
    ['+', 'NumpadAdd', '+'],
    ['-', 'NumpadSubtract', '-'],
    ['*', 'NumpadMultiply', '*'],
    ['/', 'NumpadDivide', '/'],
    ['Enter', 'NumpadEnter', '='],
    [',', 'NumpadDecimal', ','],
    ['.', 'NumpadDecimal', ','],
    // … and off: the key is an arrow or Delete, the code still says which key it is.
    ['ArrowUp', 'Numpad8', '8'],
    ['Insert', 'Numpad0', '0'],
    ['Delete', 'NumpadDecimal', ','],
  ])('Taste %s (%s) → %s', (key, code, calc) => expect(calcKeyFor(key, code)).toBe(calc));

  it('Tasten ohne Bedeutung, K und P bleiben frei', () => {
    expect(calcKeyFor('a', 'KeyA')).toBeNull();
    expect(calcKeyFor('k', 'KeyK')).toBeNull();
    expect(calcKeyFor('p', 'KeyP')).toBeNull();
    expect(calcKeyFor('ArrowUp', 'ArrowUp')).toBeNull();
    expect(calcKeyFor('7')).toBe('7');
  });
});
