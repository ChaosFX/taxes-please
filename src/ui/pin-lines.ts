import type { Document } from '../core/types';
import { h } from './dom';
import { t } from './text';

/*
 * Pinning lines of a paper (SPEC 4, „Anheften“): every line shows a needle on
 * hover and focus, a click on the office stamp pins the representative.
 *
 * Keyboard without extra tab stops: the lines are focusable only by script
 * (tabindex -1). N on a focused paper goes to its first line; arrow up and down
 * move between the lines (and the office stamp); N, Enter or Space pins the
 * focused line; Escape goes back to the paper.
 */

export type PinPlace = { document: string; line: string } | { field: 'representative' };

export interface PinLinesOpts {
  /** Prefix of the `data-key` of the lines, so focus survives a re-render. */
  key: string;
  /** The office stamp stands for a representative with a visible stamp. */
  stampPinnable: boolean;
  onPin(place: PinPlace): void;
}

const isPinKey = (e: KeyboardEvent) => !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'n' || e.key === 'N');

/** Makes the lines (and the office stamp) of a built paper pinnable. `paper` holds `doc` as rows of its tbody. */
export function makePinnable(paper: HTMLElement, doc: Document, opts: PinLinesOpts): void {
  const items: HTMLElement[] = [];
  paper.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row, i) => {
    const line = doc.lines[i];
    if (!line) return;
    const [label] = line;
    row.classList.add('pinnable');
    row.tabIndex = -1;
    row.dataset.key = `${opts.key}-${i}`;
    row.dataset.pin = 'line';
    const needle = h('button', {
      class: 'pin-needle',
      tabindex: -1,
      'aria-label': t('aria.pinnableLine', { label }),
      title: t('aria.pinnableLine', { label }),
      onclick: (e: Event) => {
        e.stopPropagation();
        opts.onPin({ document: doc.title, line: label });
      },
    });
    row.lastElementChild?.append(needle);
    row.addEventListener('keydown', (e) => {
      if (e.target !== row) return;
      if (isPinKey(e) || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        opts.onPin({ document: doc.title, line: label });
      }
    });
    items.push(row);
  });

  const stamp = paper.querySelector<HTMLElement>('.office-stamp');
  if (stamp && doc.stamp && opts.stampPinnable) {
    const btn = h(
      'button',
      {
        class: 'office-stamp pinnable-stamp',
        tabindex: -1,
        'data-key': `${opts.key}-stamp`,
        'aria-label': t('aria.pinnableStamp', { stamp: doc.stamp }),
        title: t('aria.pinnableStamp', { stamp: doc.stamp }),
        onclick: (e: Event) => {
          e.stopPropagation();
          opts.onPin({ field: 'representative' });
        },
      },
      doc.stamp,
    );
    btn.addEventListener('keydown', (e) => {
      if (isPinKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        opts.onPin({ field: 'representative' });
      }
    });
    stamp.replaceWith(btn);
    items.push(btn);
  }
  if (!items.length) return;

  paper.setAttribute('aria-keyshortcuts', 'N');
  paper.addEventListener('keydown', (e) => {
    if (e.target === paper && isPinKey(e)) {
      e.preventDefault();
      items[0]!.focus();
      return;
    }
    const i = items.indexOf(e.target as HTMLElement);
    if (i < 0) return;
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (step) {
      e.preventDefault();
      e.stopPropagation();
      items[Math.min(items.length - 1, Math.max(0, i + step))]!.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      paper.focus();
    }
  });
}
