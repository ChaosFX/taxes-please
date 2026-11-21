/** Formats an amount as `1.200,00 €` (Austrian grouping, euro sign after the number). */
export function formatEuro(amount: number): string {
  const negative = amount < 0;
  const [int, frac] = Math.abs(amount).toFixed(2).split('.') as [string, string];
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '−' : ''}${grouped},${frac} €`;
}

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** Act numbers are shown as Roman numerals („Akt I“). */
export function romanNumeral(n: number): string {
  let out = '';
  let rest = Math.floor(n);
  for (const [value, sign] of ROMAN) {
    while (rest >= value) {
      out += sign;
      rest -= value;
    }
  }
  return out;
}
