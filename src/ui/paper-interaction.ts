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
  dialog.focus();
}
