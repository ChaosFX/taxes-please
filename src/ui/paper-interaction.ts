/*
 * Paper helpers for the desk: a stable small rotation per paper, the overhang of
 * paper clips (to keep them on the pad) and the zoom for reading.
 */

/** Stable pseudo-random rotation of 1 to 2 degrees, either direction, from a string. */
export function paperRotation(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const u = ((h >>> 0) % 1000) / 1000;
  const deg = 1 + u;
  return h & 1 ? deg : -deg;
}

interface Overhang {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** How far `::before`/`::after` (e.g. the paper clip) reach outside the paper's box. */
export function overhang(el: HTMLElement): Overhang {
  const out = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const pseudo of ['::before', '::after']) {
    const cs = getComputedStyle(el, pseudo);
    if (cs.content === 'none' || cs.position !== 'absolute') continue;
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const v = parseFloat(cs[side]);
      // Pseudo-elements may be rotated a little; 2px covers a few degrees.
      if (Number.isFinite(v) && v < 0) out[side] = Math.max(out[side], -v + 2);
    }
  }
  return out;
}

/** Words of a text as they may break: at spaces and after hyphens and dashes. */
const words = (text: string) => text.split(/\s+|(?<=[-–])/).filter(Boolean);

/**
 * Fits the lines of a paper into its width (SPEC 7, Papier). The two columns
 * size themselves by their content, so no word breaks while all words fit. If
 * the widest label word and the widest value word (or amount) do not fit side
 * by side, the lines get about 8 % smaller (`tight`), then the gap between the
 * columns narrower (`narrow`). If that is still not enough, the width is shared
 * so that as few words as possible break, the value column keeping at least its
 * widest amount; only a word wider than its column breaks (`squeeze`, the last
 * resort). Measured on the layout, so any transform does not matter: on the
 * desk, in the zoom and on copies alike.
 */
export function fitPaperLines(paper: HTMLElement): void {
  const table = paper.querySelector<HTMLTableElement>('table.lines');
  const first = table?.rows[0];
  if (!table || !first || first.cells.length < 2) return;
  const [th, td] = [first.cells[0]!, first.cells[1]!];
  paper.classList.remove('tight', 'narrow', 'squeeze');
  th.style.width = td.style.width = '';
  const cs = getComputedStyle(paper);
  const inner = paper.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if (inner <= 0) return;
  /** Narrowest widths of both columns without breaking a word. */
  const needs = (): [number, number] => {
    table.style.width = 'min-content';
    const out: [number, number] = [th.offsetWidth, td.offsetWidth];
    table.style.width = '';
    return out;
  };
  let [label, value] = needs();
  for (const step of ['tight', 'narrow']) {
    if (label + value <= inner + 0.5) return;
    paper.classList.add(step);
    [label, value] = needs();
  }
  if (label + value <= inner + 0.5) return;
  paper.classList.add('squeeze');

  // Courier is monospaced: a word is as wide as its number of characters.
  const probe = document.createElement('span');
  probe.textContent = '0'.repeat(10);
  td.append(probe);
  const char = probe.offsetWidth / 10;
  probe.remove();
  const pad = (c: HTMLElement) => parseFloat(getComputedStyle(c).paddingLeft) + parseFloat(getComputedStyle(c).paddingRight);
  const [labelPad, valuePad] = [pad(th), pad(td)];
  const rows = [...table.rows].map((r) => [r.cells[0]?.textContent ?? '', r.cells[1]?.textContent ?? '', r.cells[1]?.classList.contains('amount') ?? false] as const);
  const amount = Math.max(0, ...rows.filter((r) => r[2]).map((r) => Math.ceil(r[1].length * char) + 1 + valuePad));
  /** Words that would break with the label column `w` wide. */
  const breaks = (w: number) => {
    const fit = (text: string, room: number) => words(text).filter((x) => x.length * char > room + 0.5).length;
    return rows.reduce((n, [l, v, isAmount]) => n + fit(l, w - labelPad) + (isAmount ? 0 : fit(v, inner - w - valuePad)), 0);
  };
  const most = inner - amount;
  const candidates = [Math.round((inner * label) / (label + value)), label, inner - value].map((w) => Math.max(0, Math.min(w, most)));
  const labelWidth = candidates.reduce((best, w) => (breaks(w) < breaks(best) ? w : best));
  th.style.width = `${labelWidth}px`;
  td.style.width = `${inner - labelWidth}px`;
}

/**
 * Shows a readable, enlarged copy of a paper in a modal dialog.
 * Double click, Enter, Space or Escape puts it back and returns focus.
 */
export function openZoom(paper: HTMLElement): void {
  if (document.querySelector('dialog.zoom')) return;
  const copy = paper.cloneNode(true) as HTMLElement;
  copy.removeAttribute('style');
  copy.removeAttribute('tabindex');
  copy.removeAttribute('data-key');
  copy.removeAttribute('data-fx');
  copy.removeAttribute('inert');
  copy.classList.remove('lifted', 'obj', 'loose', 'in-pocket');
  copy.classList.add('zoomed');
  copy.querySelectorAll('[data-key]').forEach((n) => n.removeAttribute('data-key'));
  // The copy is for reading; its buttons (e.g. in mark mode) do nothing.
  copy.querySelectorAll('button').forEach((b) => {
    b.disabled = true;
    b.tabIndex = -1;
  });

  const dialog = document.createElement('dialog');
  dialog.className = 'zoom';
  dialog.setAttribute('aria-label', paper.getAttribute('aria-label') ?? '');
  dialog.tabIndex = -1;
  dialog.append(copy);

  const close = () => dialog.close();
  dialog.addEventListener('dblclick', close);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close(); // click on the backdrop
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      close();
    }
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    const key = paper.dataset.key;
    const target = (key && document.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)) || paper;
    target.focus({ preventScroll: true });
  });

  document.body.append(dialog);
  dialog.showModal();
  // Larger and wider than on the desk: the lines may fit without help now.
  fitPaperLines(copy);
  dialog.focus();
}
