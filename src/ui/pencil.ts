import type { EffectsLevel } from '../core';

/*
 * Pencil marks in the Prüfvermerk (SPEC 7, Feedback): the chosen option gets a
 * hand-drawn loop. With effects „voll“ it draws itself in about 200 ms, with
 * „reduziert“ it fades in, with „aus“ it is just there. Changing one's mind
 * strikes the old loop through quickly („voll“) or drops it at once. The loop
 * is decoration only (`aria-hidden`); `aria-pressed` stays the state.
 */

const SVG = 'http://www.w3.org/2000/svg';

/** One stroke around the label, a little past its start, as drawn by hand. Wide and narrow buttons get their own shape. */
const LOOP = {
  wide: { box: '0 0 120 44', ring: 'M 14 33 C 4 22, 22 5, 60 4 C 98 3, 117 12, 116 23 C 115 35, 90 41, 58 41 C 26 41, 5 35, 5 23 C 5 13, 20 7, 40 6' },
  narrow: { box: '0 0 60 44', ring: 'M 10 31 C 2 20, 13 5, 30 4 C 48 3, 57 12, 56 23 C 55 35, 44 41, 29 41 C 14 41, 3 34, 4 22 C 5 12, 15 7, 24 6' },
};
const STRIKE = { wide: 'M 8 38 C 40 28, 80 16, 114 6', narrow: 'M 6 38 C 20 28, 40 16, 56 6' };

function loop(shape: keyof typeof LOOP, strike: boolean): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'pencil-ring');
  svg.setAttribute('viewBox', LOOP[shape].box);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = (d: string, cls: string) => {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', cls);
    p.setAttribute('pathLength', '1');
    svg.append(p);
  };
  path(LOOP[shape].ring, 'ring');
  if (strike) path(STRIKE[shape], 'strike');
  return svg;
}

/** Buttons of the Prüfvermerk whose state is a choice: options, verdicts, questions. */
const CHOICES = '.pruefvermerk button[aria-pressed][data-key]';

export class PencilMarks {
  /** Keys of the buttons pressed at the last render, for the Akte `akteId`. */
  private pressed = new Set<string>();
  private akteId: string | null = null;

  constructor(private readonly onDraw: () => void) {}

  /** After each render: loops on pressed buttons; new ones draw, dropped ones strike through. */
  apply(root: HTMLElement, akteId: string | null, effects: EffectsLevel): void {
    const same = akteId !== null && akteId === this.akteId;
    const now = new Set<string>();
    let drawn = false;
    for (const b of root.querySelectorAll<HTMLElement>(CHOICES)) {
      const key = b.dataset.key!;
      const shape = b.offsetWidth < 2 * b.offsetHeight ? 'narrow' : 'wide';
      if (b.getAttribute('aria-pressed') === 'true') {
        now.add(key);
        b.append(loop(shape, false));
        if (same && !this.pressed.has(key)) {
          drawn = true;
          if (effects !== 'aus') b.classList.add(effects === 'voll' ? 'ring-draw' : 'ring-fade');
        }
      } else if (same && this.pressed.has(key) && effects === 'voll') {
        const gone = loop(shape, true);
        gone.classList.add('ring-gone');
        gone.addEventListener('animationend', (e) => e.animationName === 'ring-out' && gone.remove());
        b.append(gone);
      }
    }
    if (drawn) this.onDraw();
    this.pressed = now;
    this.akteId = akteId;
  }
}
