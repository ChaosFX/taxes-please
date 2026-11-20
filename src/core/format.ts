/** Formats an amount as `1.200,00 €` (Austrian grouping, euro sign after the number). */
export function formatEuro(amount: number): string {
  const negative = amount < 0;
  const [int, frac] = Math.abs(amount).toFixed(2).split('.') as [string, string];
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '−' : ''}${grouped},${frac} €`;
}
