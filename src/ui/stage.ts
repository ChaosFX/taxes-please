import type { EffectsLevel } from '../core';
import { overhang } from './paper-interaction';

/*
 * The desk as a stage (SPEC 7.1): one fixed logical size, scaled as a whole into
 * the window. Everything on it is positioned in logical pixels; pointer
 * coordinates are divided by the scale (`toStage`).
 *
 * Every object (folder, paper, tool, newspaper) is an absolutely positioned
 * element with `transform: translate(x, y) rotate(r)` and its transform origin at
 * the middle of its top edge. Its spot is kept in the table state across renders.
 */

/** Logical size of the stage: 16:9, so it fills a 1280 × 720 or 1920 × 1080 window. */
export const STAGE_W = 1440;
export const STAGE_H = 810;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Left rail (inbox and tools), green pad, right rail (pinboard, phone, stamps, outbox). */
export const LEFT_RAIL: Rect = { x: 0, y: 0, w: 200, h: STAGE_H };
/** The pad ends above the front edge of the desk, where the drawer has its handle (SPEC 7.1). */
export const PAD: Rect = { x: 212, y: 14, w: 1026, h: 742 };
export const RIGHT_RAIL: Rect = { x: 1250, y: 0, w: 190, h: STAGE_H };

/** Places in the rails. */
export const SLOTS = {
  inbox: { x: 16, y: 40, w: 168, h: 158 },
  codex: { x: 16, y: 222, w: 168, h: 200 },
  calendar: { x: 16, y: 444, w: 168, h: 136 },
  calculator: { x: 16, y: 602, w: 168, h: 190 },
  /** Cork board at the top of the right rail, from `unlock: pinboard` (SPEC 7.1, 7.6). */
  pinboard: { x: 1262, y: 14, w: 166, h: 150 },
  phone: { x: 1268, y: 172, w: 154, h: 62 },
  rack: { x: 1262, y: 242, w: 166, h: 272 },
  outbox: { x: 1262, y: 528, w: 166, h: 266 },
  /** Handle of the drawer at the front edge of the desk, below the pad (SPEC 7.7). */
  drawer: { x: 625, y: 764, w: 200, h: 38 },
} as const satisfies Record<string, Rect>;

/** What can be dropped somewhere. */
export type Thing = 'folder' | 'paper' | 'codex' | 'calendar' | 'calculator' | 'newspaper';
export type ZoneName = 'pocket' | 'inbox' | 'tools' | 'pad' | 'rack' | 'outbox' | 'pinboard' | 'drawer';

export interface Zone {
  name: ZoneName;
  /** Fixed rectangle, or null when it moves with an object (the pocket of the open folder). */
  rect: Rect | null;
  accepts: readonly Thing[];
}

/**
 * The drop areas of the desk (SPEC 7.1), in hit-test order: the first zone
 * under the pointer decides. Pinboard and drawer take nothing that is dragged:
 * they open with a click (SPEC 7.6, 7.7).
 */
export const ZONES: readonly Zone[] = [
  { name: 'pocket', rect: null, accepts: ['paper'] },
  { name: 'inbox', rect: SLOTS.inbox, accepts: [] },
  { name: 'tools', rect: { x: 0, y: 206, w: LEFT_RAIL.w, h: STAGE_H - 206 }, accepts: ['codex', 'calendar', 'calculator'] },
  { name: 'pad', rect: PAD, accepts: ['folder', 'paper', 'codex', 'calendar', 'calculator', 'newspaper'] },
  { name: 'rack', rect: SLOTS.rack, accepts: [] },
  { name: 'outbox', rect: SLOTS.outbox, accepts: ['folder'] },
  { name: 'pinboard', rect: SLOTS.pinboard, accepts: [] },
  { name: 'drawer', rect: SLOTS.drawer, accepts: [] },
];

export const inRect = (p: Point, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** The zone under `p`; `dynamic` gives the rectangles of moving zones. */
export function zoneAt(p: Point, dynamic: Partial<Record<ZoneName, Rect | null>> = {}): Zone | null {
  for (const z of ZONES) {
    const r = z.rect ?? dynamic[z.name] ?? null;
    if (r && inRect(p, r)) return z;
  }
  return null;
}

// ---------- Scale ----------

let scale = 1;
export const stageScale = () => scale;

/** Scales the stage to the window, centred, without scrolling. */
export function fitStage(stage: HTMLElement): void {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  scale = Math.min(vw / STAGE_W, vh / STAGE_H);
  const left = Math.max(0, (vw - STAGE_W * scale) / 2);
  const top = Math.max(0, (vh - STAGE_H * scale) / 2);
  stage.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
}

/** Pointer position in stage coordinates. */
export function toStage(stage: HTMLElement, e: { clientX: number; clientY: number }): Point {
  const r = stage.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
}

/** Visual rectangle of an element in stage coordinates. */
export function rectOn(stage: HTMLElement, el: Element): Rect {
  const r = el.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  return { x: (r.left - s.left) / scale, y: (r.top - s.top) / scale, w: r.width / scale, h: r.height / scale };
}

// ---------- Placing objects ----------

export interface Spot {
  x: number;
  y: number;
}

export const objTransform = (p: Spot, rot: number, extra = '') => `translate(${p.x}px, ${p.y}px) rotate(${rot}deg)${extra ? ` ${extra}` : ''}`;

/** Extent of a w×h box (plus overhang such as a paper clip) rotated about the middle of its top edge. */
function extent(w: number, h: number, rot: number, el: HTMLElement | null) {
  const e = el ? overhang(el) : { top: 0, right: 0, bottom: 0, left: 0 };
  const r = (rot * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const corners = [
    [-w / 2 - e.left, -e.top],
    [w / 2 + e.right, -e.top],
    [w / 2 + e.right, h + e.bottom],
    [-w / 2 - e.left, h + e.bottom],
  ] as const;
  const out = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const [x, y] of corners) {
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    out.minX = Math.min(out.minX, rx);
    out.maxX = Math.max(out.maxX, rx);
    out.minY = Math.min(out.minY, ry);
    out.maxY = Math.max(out.maxY, ry);
  }
  return out;
}

/** Margin kept to the edge of the pad. */
export const PAD_MARGIN = 6;

/**
 * Top-left spot nearest to `p` at which the element, rotated by `rot`, lies
 * wholly on the pad (SPEC 7: nothing hangs over the edge).
 */
export function clampToPad(el: HTMLElement, p: Spot, rot: number, size?: { w: number; h: number }): Spot {
  const w = size?.w ?? el.offsetWidth;
  const h = size?.h ?? el.offsetHeight;
  const ext = extent(w, h, rot, el.isConnected ? el : null);
  const lo = { x: PAD.x + PAD_MARGIN - w / 2 - ext.minX, y: PAD.y + PAD_MARGIN - ext.minY };
  const hi = { x: PAD.x + PAD.w - PAD_MARGIN - w / 2 - ext.maxX, y: PAD.y + PAD.h - PAD_MARGIN - ext.maxY };
  const fit = (v: number, a: number, b: number) => (a <= b ? Math.min(b, Math.max(a, v)) : (a + b) / 2);
  return { x: fit(p.x, lo.x, hi.x), y: fit(p.y, lo.y, hi.y) };
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** First candidate spot where a w×h box lies on the pad without covering `taken`; else `fallback`. */
export function freeSpot(w: number, h: number, candidates: Spot[], taken: Rect[], fallback: Spot): Spot {
  const gap = 8;
  const fits = (c: Spot) =>
    c.x >= PAD.x + PAD_MARGIN && c.y >= PAD.y + PAD_MARGIN && c.x + w <= PAD.x + PAD.w - PAD_MARGIN && c.y + h <= PAD.y + PAD.h - PAD_MARGIN;
  for (const c of candidates) {
    const box = { x: c.x - gap, y: c.y - gap, w: w + 2 * gap, h: h + 2 * gap };
    if (fits(c) && !taken.some((t) => overlaps(box, t))) return c;
  }
  return fallback;
}

/** Candidate spots scanning the pad in rows, for `freeSpot`. */
export function padGrid(w: number, h: number, step = 24): Spot[] {
  const out: Spot[] = [];
  const right = PAD.x + PAD.w - PAD_MARGIN - 2 - w;
  const bottom = PAD.y + PAD.h - PAD_MARGIN - 2 - h;
  const ys: number[] = [];
  for (let y = PAD.y + PAD_MARGIN + 4; y <= bottom; y += step) ys.push(y);
  if (ys.length && ys[ys.length - 1] !== bottom && bottom >= PAD.y) ys.push(bottom);
  for (const y of ys) {
    for (let x = PAD.x + PAD_MARGIN + 4; x <= right; x += step) out.push({ x, y });
    // Flush with the right edge as well, so wide things fit side by side.
    out.push({ x: right, y });
  }
  return out;
}

// ---------- Dragging ----------

/** Scale of a lifted object per effects level. */
const LIFT_SCALE: Record<EffectsLevel, number> = { aus: 1, reduziert: 1.02, voll: 1.04 };
const MAX_TILT = 6;
/** Movement (logical px) before a press becomes a drag. */
const DRAG_THRESHOLD = 5;

export interface DragSpec {
  stage: HTMLElement;
  el: HTMLElement;
  /** Spot of the element on the stage at the press. */
  from: Spot;
  rotation: number;
  effects: () => EffectsLevel;
  /**
   * Called once when the press becomes a drag. May move the element to the
   * stage (out of the pocket) and return its new spot on the stage.
   */
  onLift?: () => Spot | void;
  /** Pointer released after a drag: `at` is the pointer, `spot` where the element is now. */
  onDrop: (at: Point, spot: Spot) => void;
}

/**
 * Starts tracking a press on an object. Listeners sit on `window`, not as
 * pointer capture on the element, because the element may change its parent
 * while it is dragged (SPEC 7.1). A press without movement stays a click.
 */
export function pressObject(e: PointerEvent, spec: DragSpec): void {
  if (e.button !== 0 || !e.isPrimary) return;
  const p0 = toStage(spec.stage, e);
  let from = spec.from;
  let moved = false;
  let spot = from;
  let tilt = 0;
  let lastX = e.clientX;
  const el = spec.el;

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return;
    const p = toStage(spec.stage, ev);
    if (!moved) {
      if (Math.hypot(p.x - p0.x, p.y - p0.y) < DRAG_THRESHOLD) return;
      moved = true;
      const lifted = spec.onLift?.();
      if (lifted) from = lifted;
      el.classList.add('lifted');
    }
    ev.preventDefault();
    const w = el.offsetWidth;
    // The pointer may leave the stage; the object stays reachable on it.
    spot = {
      x: Math.min(STAGE_W - w / 2, Math.max(-w / 2, from.x + p.x - p0.x)),
      y: Math.min(STAGE_H - 20, Math.max(-10, from.y + p.y - p0.y)),
    };
    const fx = spec.effects();
    const target = fx === 'voll' ? Math.max(-MAX_TILT, Math.min(MAX_TILT, (ev.clientX - lastX) * 0.5)) : 0;
    tilt = tilt * 0.7 + target * 0.3;
    lastX = ev.clientX;
    el.style.transform = objTransform(spot, spec.rotation + tilt, `scale(${LIFT_SCALE[fx]})`);
  };
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (!moved) return;
    el.classList.remove('lifted');
    swallowClick();
    spec.onDrop(toStage(spec.stage, ev), spot);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

/** After a drag the browser may still send a click to the element under the pointer: it is dropped. */
export function swallowClick(): void {
  const stop = (ev: Event) => {
    ev.stopPropagation();
    ev.preventDefault();
  };
  window.addEventListener('click', stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
}

// ---------- Motion: FLIP over a re-render (transform and opacity only) ----------

export type Motion = 'settle' | 'glide' | 'fly' | 'open';

const DURATION: Record<Motion, number> = { settle: 170, glide: 280, fly: 300, open: 420 };
const FADE_MS = 120;

/** Visual boxes of the elements with `data-fx` before a re-render. */
export function captureFx(root: ParentNode, keys?: readonly string[]): Map<string, DOMRect> {
  const out = new Map<string, DOMRect>();
  for (const el of root.querySelectorAll<HTMLElement>('[data-fx]')) {
    const k = el.dataset.fx!;
    if (!keys || keys.includes(k)) out.set(k, el.getBoundingClientRect());
  }
  return out;
}

/**
 * Animates elements from where they were (`before`) to where they are now.
 * „voll“: they move there; „reduziert“: they fade in at the new place within
 * 120 ms; „aus“: nothing. `order` staggers the start (fly back to the pocket).
 */
export function playFx(root: ParentNode, before: Map<string, DOMRect>, fx: EffectsLevel, motion: Motion, order: string[] = []): Promise<void> {
  if (fx === 'aus' || before.size === 0) return Promise.resolve();
  const runs: Promise<unknown>[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('[data-fx]')) {
    const old = before.get(el.dataset.fx!);
    if (!old || typeof el.animate !== 'function') continue;
    const now = el.getBoundingClientRect();
    if (now.width === 0) continue;
    const dx = (old.left + old.width / 2 - (now.left + now.width / 2)) / scale;
    const dy = (old.top - now.top) / scale;
    const sx = old.width / now.width;
    const sy = old.height / now.height;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) continue;
    const delay = Math.max(0, order.indexOf(el.dataset.fx!)) * 60;
    if (fx === 'reduziert') {
      runs.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'linear' }).finished);
      continue;
    }
    // The leading translate moves the box in its parent; the trailing scale keeps the top middle in place.
    const base = el.style.transform || 'translate(0px, 0px)';
    runs.push(
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) ${base} scale(${sx}, ${sy})` },
          { transform: `translate(0px, 0px) ${base} scale(1, 1)` },
        ],
        { duration: DURATION[motion], delay, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' },
      ).finished,
    );
  }
  return Promise.all(runs).then(
    () => undefined,
    () => undefined,
  );
}
