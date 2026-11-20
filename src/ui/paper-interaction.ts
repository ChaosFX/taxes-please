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

/** Scale of a lifted paper per effects level. */
const LIFT_SCALE: Record<EffectsLevel, number> = { aus: 1, reduziert: 1.02, voll: 1.05 };
/** Largest tilt while dragging (degrees, effects „voll“). */
const MAX_TILT = 6;
/** Distance kept from the clipping edge of the pad (px). */
const EDGE_MARGIN = 1;

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
 * Axis-aligned extent, relative to the box centre, of a w×h box grown by
 * `e`, rotated by each of `angles` (degrees) and scaled about its centre.
 */
export function outline(w: number, h: number, e: Overhang, angles: number[], scale = 1) {
  const corners = [
    [-w / 2 - e.left, -h / 2 - e.top],
    [w / 2 + e.right, -h / 2 - e.top],
    [w / 2 + e.right, h / 2 + e.bottom],
    [-w / 2 - e.left, h / 2 + e.bottom],
  ] as const;
  const ext = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const deg of angles) {
    const r = (deg * Math.PI) / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    for (const [x, y] of corners) {
      const rx = (x * cos - y * sin) * scale;
      const ry = (x * sin + y * cos) * scale;
      ext.minX = Math.min(ext.minX, rx);
      ext.maxX = Math.max(ext.maxX, rx);
      ext.minY = Math.min(ext.minY, ry);
      ext.maxY = Math.max(ext.maxY, ry);
    }
  }
  return ext;
}

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

  /**
   * Range for the paper's translation so that its rotated outline, including
   * parts drawn outside it (paper clip), stays inside the visible area of the
   * pad. `scale` and `tilt` cover the lifted state while dragging.
   */
  const boundsFor = (scale = 1, tilt = 0) => {
    const surface = o.surface();
    if (!surface) return { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity };
    const s = surface.getBoundingClientRect();
    // `overflow: hidden` clips at the padding box, i.e. inside the border.
    const clip = {
      left: s.left + surface.clientLeft + EDGE_MARGIN,
      top: s.top + surface.clientTop + EDGE_MARGIN,
      right: s.left + surface.clientLeft + surface.clientWidth - EDGE_MARGIN,
      bottom: s.top + surface.clientTop + surface.clientHeight - EDGE_MARGIN,
    };
    // Untransformed layout box of the paper, relative to the viewport.
    const parent = el.offsetParent as HTMLElement | null;
    const pr = parent?.getBoundingClientRect();
    const left = el.offsetLeft + (pr ? pr.left + parent!.clientLeft : 0);
    const top = el.offsetTop + (pr ? pr.top + parent!.clientTop : 0);
    const w = el.offsetWidth;
    const hgt = el.offsetHeight;
    const e = overhang(el);
    const angles = tilt ? [o.rotation - tilt, o.rotation, o.rotation + tilt] : [o.rotation];
    const ext = outline(w, hgt, e, angles, scale);
    // The transform origin is the centre of the layout box.
    const cx = left + w / 2;
    const cy = top + hgt / 2;
    const range = (lo: number, hi: number) => (lo <= hi ? [lo, hi] : [(lo + hi) / 2, (lo + hi) / 2]);
    const [minX, maxX] = range(clip.left - (cx + ext.minX), clip.right - (cx + ext.maxX)) as [number, number];
    const [minY, maxY] = range(clip.top - (cy + ext.minY), clip.bottom - (cy + ext.maxY)) as [number, number];
    return { minX, maxX, minY, maxY };
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
      bounds: boundsFor(LIFT_SCALE[o.effects()], o.effects() === 'voll' ? MAX_TILT : 0),
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
    el.style.transform = transform(drag.pos, o.rotation, LIFT_SCALE[fx]);
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
    const target = fx === 'voll' ? clamp((e.clientX - drag.lastX) * 0.5, -MAX_TILT, MAX_TILT) : 0;
    drag.tilt = drag.tilt * 0.7 + target * 0.3;
    drag.lastX = e.clientX;
    el.style.transform = transform(drag.pos, o.rotation + drag.tilt, LIFT_SCALE[fx]);
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
