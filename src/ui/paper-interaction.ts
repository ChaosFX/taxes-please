import type { EffectsLevel } from '../core';

export interface PaperPos {
  x: number;
  y: number;
  z: number;
}

/** Positions of dragged papers, kept across re-renders. Cleared when a new Akte lands on the desk. */
export class DeskLayout {
  private positions = new Map<string, PaperPos>();
  private akteId: string | null = null;
  private topZ = 1;

  forAkte(akteId: string | null): void {
    if (akteId !== this.akteId) {
      this.positions.clear();
      this.akteId = akteId;
      this.topZ = 1;
    }
  }

  get(key: string): PaperPos {
    return this.positions.get(key) ?? { x: 0, y: 0, z: 0 };
  }

  set(key: string, pos: PaperPos): void {
    this.positions.set(key, pos);
  }

  bringToFront(key: string): number {
    const z = ++this.topZ;
    this.set(key, { ...this.get(key), z });
    return z;
  }
}

/** Stable pseudo-random rotation of 1 to 2 degrees, either direction, from a string. */
export function paperRotation(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const u = ((h >>> 0) % 1000) / 1000;
  const deg = 1 + u;
  return h & 1 ? deg : -deg;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function transform(pos: { x: number; y: number }, rot: number, scale = 1): string {
  return `translate(${pos.x}px, ${pos.y}px) rotate(${rot}deg) scale(${scale})`;
}

export interface DraggableOptions {
  key: string;
  layout: DeskLayout;
  rotation: number;
  surface: () => HTMLElement | null;
  effects: () => EffectsLevel;
  onZoom: (el: HTMLElement) => void;
  /** Called when the paper is picked up (e.g. paper rustle). */
  onLift?: () => void;
}

/**
 * Makes a paper draggable with Pointer Events (mouse, pen, touch) and usable by
 * keyboard: Enter/Space zooms, arrow keys move. Only `transform` changes.
 */
export function makeDraggable(el: HTMLElement, o: DraggableOptions): void {
  const start = o.layout.get(o.key);
  el.style.transform = transform(start, o.rotation);
  if (start.z) el.style.zIndex = String(start.z);

  let drag: {
    id: number;
    startX: number;
    startY: number;
    origin: { x: number; y: number };
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
    lastX: number;
    tilt: number;
    pos: { x: number; y: number };
  } | null = null;

  const boundsFor = () => {
    const surface = o.surface();
    if (!surface) return { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity };
    const s = surface.getBoundingClientRect();
    // Untransformed layout box of the paper, relative to the viewport.
    const parent = el.offsetParent as HTMLElement | null;
    const pr = parent?.getBoundingClientRect();
    const left = el.offsetLeft + (pr ? pr.left + parent!.clientLeft : 0);
    const top = el.offsetTop + (pr ? pr.top + parent!.clientTop : 0);
    const w = el.offsetWidth;
    const hgt = el.offsetHeight;
    const slackX = w * 0.1;
    const slackY = hgt * 0.1;
    return {
      minX: s.left - left - slackX,
      maxX: s.right - left - w + slackX,
      minY: s.top - top - slackY,
      maxY: s.bottom - top - hgt + slackY,
    };
  };

  // Layout can change between renders (window size, codex); keep the paper on the pad.
  requestAnimationFrame(() => {
    if (!el.isConnected || drag) return;
    const cur = o.layout.get(o.key);
    const b = boundsFor();
    const pos = { x: clamp(cur.x, b.minX, b.maxX), y: clamp(cur.y, b.minY, b.maxY) };
    if (pos.x !== cur.x || pos.y !== cur.y) {
      o.layout.set(o.key, { ...cur, ...pos });
      el.style.transform = transform(pos, o.rotation);
    }
  });

  const front = () => {
    el.style.zIndex = String(o.layout.bringToFront(o.key));
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || drag) return;
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    const origin = o.layout.get(o.key);
    drag = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origin,
      bounds: boundsFor(),
      lastX: e.clientX,
      tilt: 0,
      pos: { x: origin.x, y: origin.y },
    };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events in tests have no capturable pointer */
    }
    front();
    o.onLift?.();
    el.classList.remove('dropping');
    el.classList.add('lifted');
    const fx = o.effects();
    el.style.transform = transform(drag.pos, o.rotation, fx === 'aus' ? 1 : fx === 'reduziert' ? 1.02 : 1.05);
    e.preventDefault();
  });

  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const b = drag.bounds;
    drag.pos = {
      x: clamp(drag.origin.x + e.clientX - drag.startX, b.minX, b.maxX),
      y: clamp(drag.origin.y + e.clientY - drag.startY, b.minY, b.maxY),
    };
    const fx = o.effects();
    // Tilt follows horizontal speed, smoothed; only with full effects.
    const target = fx === 'voll' ? clamp((e.clientX - drag.lastX) * 0.5, -6, 6) : 0;
    drag.tilt = drag.tilt * 0.7 + target * 0.3;
    drag.lastX = e.clientX;
    el.style.transform = transform(drag.pos, o.rotation + drag.tilt, fx === 'aus' ? 1 : fx === 'reduziert' ? 1.02 : 1.05);
  });

  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    o.layout.set(o.key, { ...o.layout.get(o.key), x: drag.pos.x, y: drag.pos.y });
    const pos = drag.pos;
    drag = null;
    el.classList.remove('lifted');
    if (o.effects() !== 'aus') el.classList.add('dropping');
    el.style.transform = transform(pos, o.rotation);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('transitionend', () => el.classList.remove('dropping'));

  el.addEventListener('dblclick', (e) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    o.onZoom(el);
  });

  el.addEventListener('keydown', (e) => {
    if (e.target !== el) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      o.onZoom(el);
      return;
    }
    const step = e.shiftKey ? 64 : 16;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    const cur = o.layout.get(o.key);
    const b = boundsFor();
    const pos = { x: clamp(cur.x + d[0]!, b.minX, b.maxX), y: clamp(cur.y + d[1]!, b.minY, b.maxY) };
    front();
    o.layout.set(o.key, { ...o.layout.get(o.key), ...pos });
    el.style.transform = transform(pos, o.rotation);
  });
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
  copy.classList.remove('lifted', 'dropping');
  copy.classList.add('zoomed');
  copy.querySelectorAll('[data-key]').forEach((n) => n.removeAttribute('data-key'));

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
