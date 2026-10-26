// Live mode: draw Inkmark marks over elements of a real page. No scene, no player.
// Marks sit in one fixed layer. They follow their element on scroll and resize.
import { animate, createTimer } from 'animejs';
import type {
  ArrowMark, BoxMark, BracketMark, Box, CircleMark, HighlightMark, LabelMark, Mark, MarkType,
  OverlayInput, Point, Side, StrikeMark, Style, StyleInput, UnderlineMark,
} from './types.ts';
import type { GeometryContext, Region } from './geometry/types.ts';
import { resolveStyle, styleForScheme } from './styles/index.ts';
import { markSeed } from './seed.ts';
import { elementBox, addMarkNodes, type MarkNodes } from './stage.ts';
import { renderStrokes } from './geometry/pen.ts';
import { buildGeometry } from './geometry/index.ts';
import { createDim, pickOverlay, setHoles, type OverlayNode } from './overlay.ts';
import { buildTimeline, type PlannedMark } from './timeline.ts';
import { injectFont } from './mount.ts';

export type LiveTarget = Element | string;

type Strip<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type LiveMark =
  | Exclude<MarkType, 'label' | 'scribble'>
  | Strip<CircleMark | BoxMark | UnderlineMark | HighlightMark | StrikeMark | BracketMark, 'id' | 'target' | 'with'>
  | Omit<LabelMark, 'id' | 'at' | 'with'>
  | (Omit<ArrowMark, 'id' | 'from' | 'to' | 'with'> & { from?: LiveTarget | Side });

export interface AnnotateOptions {
  /** A built-in style name or a partial style. Default "marker". */
  style?: string | StyleInput;
  /** Project styles by name. */
  styles?: Record<string, StyleInput>;
  /** Default "auto": follow the page. */
  scheme?: 'light' | 'dark' | 'auto';
  /** Spotlight around the element while the mark is shown. */
  overlay?: boolean | OverlayInput;
  /** Default true. false, or reduced motion: the mark appears at once. */
  animate?: boolean;
}

export interface GroupOptions {
  overlay?: boolean | OverlayInput;
  /** Seconds between marks. Default: the style gap. */
  gap?: number;
}

export interface Annotation {
  readonly element: Element;
  readonly shown: boolean;
  show(): Promise<void>;
  hide(): Promise<void>;
  remove(): void;
}

export interface AnnotationGroup {
  show(): Promise<void>;
  hide(): Promise<void>;
  remove(): void;
}

const SIDES = ['top', 'right', 'bottom', 'left'];
const Z = 2147483000;
// Free room around the element in the local drawing space, for labels and arrows.
const ROOM = 700;
const HIDE_MS = 250;

interface Dim {
  node: OverlayNode;
  style: () => Style;
  holes: () => Box[];
  last: string;
  fading?: { stop(): void };
}

interface Impl {
  api: Annotation;
  el: Element;
  type: MarkType;
  n: number;
  halo: boolean;
  active: boolean;
  forceRebuild: boolean;
  box(): Box | null;
  applyScheme(): void;
  update(): void;
  remove(): void;
  schemeStyle(): Style;
  scheme(): 'light' | 'dark';
  firstStyle: Style;
}

const impls = new WeakMap<Annotation, Impl>();
const items = new Set<Impl>();
const dims = new Set<Dim>();
const schemeHooks = new Set<() => void>();
let counter = 0;

interface Layer {
  hl: HTMLElement;
  main: HTMLElement;
  hlG: SVGElement;
  dimG: SVGElement;
  marksG: SVGElement;
  defs: SVGElement;
  ro: ResizeObserver | undefined;
  mo: MutationObserver;
  mq: MediaQueryList | undefined;
  stop(): void;
}
let layer: Layer | undefined;
let raf = 0;

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (name: string, attrs: Record<string, string | number> = {}): SVGElement => {
  const e = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const safe = (token: string) => token.replace(/[^\w-]/g, '_');
const r1 = (n: number) => Math.round(n);

function schedule() {
  if (raf || !layer) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    for (const i of items) if (i.active) i.update();
    refreshDims();
  });
}

function viewport() {
  const el = layer!.main;
  return { width: el.clientWidth || innerWidth, height: el.clientHeight || innerHeight };
}

function refreshDims() {
  if (!layer) return;
  const vp = viewport();
  for (const d of dims) {
    const key = `${vp.width}x${vp.height}|${d.holes().map((b) => b.map(r1).join(',')).join(';')}`;
    if (key === d.last) continue;
    d.last = key;
    d.node.el.setAttribute('width', String(vp.width));
    d.node.el.setAttribute('height', String(vp.height));
    setHoles(d.node.mask, vp, d.holes(), d.style());
  }
}

function readScheme(mode: 'light' | 'dark' | 'auto'): 'light' | 'dark' {
  if (mode !== 'auto') return mode;
  const parts = getComputedStyle(document.documentElement).colorScheme.split(/\s+/);
  const dark = parts.includes('dark');
  const light = parts.includes('light');
  if (dark && !light) return 'dark';
  if (light && !dark) return 'light';
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function ensureLayer(): Layer {
  if (layer) return layer;
  if (!document.body) throw new Error('Inkmark live mode needs document.body. Call show() after the page has loaded.');
  const mkDiv = (cls: string, z: number) => {
    const d = document.createElement('div');
    d.className = cls;
    d.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:${z};overflow:hidden`;
    const s = svgEl('svg', { width: '100%', height: '100%' });
    s.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
    d.appendChild(s);
    return { d, s };
  };
  // Highlights sit in their own layer under the marks. Only a layer of its own can blend with the page.
  const hl = mkDiv('ik-live-hl', Z - 1);
  hl.d.setAttribute('aria-hidden', 'true');
  const main = mkDiv('ik-live', Z);
  const defs = svgEl('defs');
  const dimG = svgEl('g', { class: 'ik-layer-dim' });
  const marksG = svgEl('g', { class: 'ik-layer-marks' });
  main.s.append(defs, dimG, marksG);
  const hlG = svgEl('g', { class: 'ik-layer-highlight' });
  hl.s.appendChild(hlG);
  document.body.append(hl.d, main.d);

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : undefined;
  const onScheme = () => { for (const f of schemeHooks) f(); schedule(); };
  const mo = new MutationObserver(onScheme);
  mo.observe(document.documentElement, { attributes: true });
  mo.observe(document.body, { attributes: true });
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined;
  mq?.addEventListener('change', onScheme);
  addEventListener('scroll', schedule, { capture: true, passive: true });
  addEventListener('resize', schedule);
  addEventListener('load', schedule);
  visualViewport?.addEventListener('resize', schedule);
  visualViewport?.addEventListener('scroll', schedule);
  document.fonts?.addEventListener('loadingdone', schedule);

  layer = {
    hl: hl.d, main: main.d, hlG, dimG, marksG, defs, ro, mo, mq,
    stop() {
      ro?.disconnect();
      mo.disconnect();
      mq?.removeEventListener('change', onScheme);
      removeEventListener('scroll', schedule, { capture: true });
      removeEventListener('resize', schedule);
      removeEventListener('load', schedule);
      visualViewport?.removeEventListener('resize', schedule);
      visualViewport?.removeEventListener('scroll', schedule);
      document.fonts?.removeEventListener('loadingdone', schedule);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      hl.d.remove();
      main.d.remove();
    },
  };
  return layer;
}

function releaseLayer() {
  if (layer && !items.size && !dims.size) {
    layer.stop();
    layer = undefined;
  }
}

function resolveEl(t: LiveTarget, what: string): Element {
  if (typeof t !== 'string') return t;
  const el = document.querySelector(t);
  if (!el) throw new Error(`${what}: the selector "${t}" matches no element.`);
  return el;
}

function inter(a: Box, b: Box): Box {
  const x = Math.max(a[0], b[0]);
  const y = Math.max(a[1], b[1]);
  return [x, y, Math.min(a[0] + a[2], b[0] + b[2]) - x, Math.min(a[1] + a[3], b[1] + b[3]) - y];
}

/** The area scroll containers leave visible for this element, or null when nothing clips it. */
function scrollClip(el: Element): Box | null {
  let clip: Box | null = null;
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
    const r = p.getBoundingClientRect();
    const b: Box = [r.left + p.clientLeft, r.top + p.clientTop, p.clientWidth, p.clientHeight];
    clip = clip ? inter(clip, b) : b;
  }
  return clip;
}

interface Placed { box: Box; clip: Box | null }

/** Box of an element in the viewport, or null when the element is hidden, detached or clipped away. */
function place(el: Element): Placed | null {
  if (!el.isConnected) return null;
  if ('checkVisibility' in el && !(el as Element & { checkVisibility(o?: object): boolean }).checkVisibility({ visibilityProperty: true })) return null;
  const box = elementBox(el);
  if (box[2] <= 0 || box[3] <= 0) return null;
  const clip = scrollClip(el);
  if (clip) {
    const i = inter(clip, box);
    if (i[2] <= 0 || i[3] <= 0) return null;
  }
  return { box, clip };
}

interface Fade { done: Promise<void>; stop(): void }

function fade(el: SVGElement, to: number, ms: number): Fade {
  const from = parseFloat(getComputedStyle(el).opacity);
  let end!: () => void;
  const done = new Promise<void>((res) => { end = res; });
  const a = animate(el, { opacity: [Number.isFinite(from) ? from : 1 - to, to], duration: ms, ease: 'linear', onComplete: () => end() });
  return { done, stop() { a.pause(); end(); } };
}

function fadeDim(d: Dim, to: number, ms: number): Promise<void> {
  d.fading?.stop();
  const f = fade(d.node.el, to, ms);
  d.fading = f;
  return f.done;
}

function wait(ms: number): Promise<void> {
  return new Promise((res) => { createTimer({ duration: Math.max(1, ms), onComplete: () => res() }); });
}

function normalize(mark: LiveMark): { type: MarkType; rest: Record<string, unknown> } {
  if (typeof mark === 'string') return { type: mark, rest: {} };
  const { type, ...rest } = mark as { type: MarkType } & Record<string, unknown>;
  return { type, rest };
}

export function annotate(target: LiveTarget, mark: LiveMark, options: AnnotateOptions = {}): Annotation {
  const el = resolveEl(target, 'annotate');
  const { type, rest } = normalize(mark);
  if (type === 'scribble') throw new Error('annotate: "scribble" is not a live mark. Use circle, box, underline, highlight, strike, bracket, arrow or label.');
  if (type === 'label' && typeof rest.text !== 'string') throw new Error('annotate: a label needs "text".');

  const n = ++counter;
  const uid = `ikl${n}`;
  const baseStyle = resolveStyle(options.style, options.styles);
  injectFont(baseStyle);
  const allowAnimate = options.animate !== false;
  const id = typeof target === 'string' ? `${target}|${type}` : `live-${type}-${n}`;
  const seed = markSeed(id, rest.seed as number | undefined);

  let arrowFrom: Element | Side = 'left';
  if (type === 'arrow' && rest.from !== undefined) {
    const f = rest.from as LiveTarget | Side;
    arrowFrom = typeof f === 'string' && SIDES.includes(f) ? (f as Side) : resolveEl(f as LiveTarget, 'annotate');
  }

  let scheme: 'light' | 'dark' = 'light';
  let sStyle = baseStyle;
  let halo = false;
  let shown = false;
  let removed = false;
  let pending: (() => void) | undefined;
  let waiting = false;
  let tl: ReturnType<typeof buildTimeline> | undefined;
  let showPromise: Promise<void> = Promise.resolve();
  let finishShow: (() => void) | undefined;
  let fontReady: Promise<unknown> | undefined;

  let built: { key: string; nodes: MarkNodes; origin: Point } | undefined;
  let groupFade: Fade | undefined;
  let ownDim: Dim | undefined;
  const clipId = `${uid}-clip`;
  let clipRect: SVGElement | undefined;
  let outerM: SVGElement | undefined;
  let outerH: SVGElement | undefined;
  let innerM: SVGElement | undefined;
  let innerH: SVGElement | undefined;
  let lastBox: Box | null = null;
  let lastHole: Box[] = [];

  const colorOf = (token: string | undefined, fallback: string): string => {
    const name = token ?? fallback;
    return baseStyle.colors[name] !== undefined ? `var(--ik-a${n}-${safe(name)})` : name;
  };
  const tokenFor = () =>
    type === 'highlight' ? colorOf(rest.color as string | undefined, baseStyle.defaults.highlight)
    : type === 'label' ? colorOf(rest.color as string | undefined, baseStyle.defaults.label)
    : colorOf(rest.color as string | undefined, baseStyle.defaults.stroke);

  const canvas = document.createElement('canvas').getContext('2d')!;
  const measure = (text: string, size: number) => {
    canvas.font = `${baseStyle.font.weight ?? 400} ${size}px ${baseStyle.font.family}`;
    return canvas.measureText(text).width;
  };

  function setVars() {
    const l = layer;
    if (!l) return;
    for (const [token, value] of Object.entries(sStyle.colors)) {
      l.main.style.setProperty(`--ik-a${n}-${safe(token)}`, value);
      l.hl.style.setProperty(`--ik-a${n}-${safe(token)}`, value);
    }
  }

  function dimSpec() {
    return pickOverlay(options.overlay, undefined, undefined, sStyle, sStyle.colors);
  }

  function applyScheme() {
    const next = readScheme(options.scheme ?? 'auto');
    sStyle = styleForScheme(baseStyle, next);
    scheme = next;
    setVars();
    if (built && type === 'highlight') {
      const band = built.nodes.group.firstElementChild;
      const op = (rest.opacity as number | undefined) ?? 0.5;
      band?.setAttribute('opacity', String(next === 'dark' ? op * 0.9 : op));
    }
    if (layer) {
      // Multiply keeps dark text readable on a light page. It hides the band on a dark page.
      const anyLight = [...items, impl].some((i) => i.type === 'highlight' && i.scheme() === 'light');
      layer.hl.style.mixBlendMode = anyLight ? 'multiply' : 'normal';
    }
    if (ownDim) {
      const spec = dimSpec();
      if (spec) {
        ownDim.node.opacity = spec.opacity;
        ownDim.node.el.style.fill = colorOf(sStyle.overlay.color, 'shade');
        if (shown && parseFloat(ownDim.node.el.style.opacity || '0') > 0) ownDim.node.el.style.opacity = String(spec.opacity);
      }
    }
  }

  function ensureNodes() {
    const l = ensureLayer();
    if (outerM) return;
    const mk = (parent: SVGElement) => {
      const o = svgEl('g', { 'clip-path': `url(#${clipId})` });
      const i = svgEl('g');
      o.appendChild(i);
      parent.appendChild(o);
      return [o, i] as const;
    };
    [outerM, innerM] = mk(l.marksG);
    [outerH, innerH] = mk(l.hlG);
    const cp = svgEl('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
    clipRect = svgEl('rect', { x: 0, y: 0, width: 0, height: 0 });
    cp.appendChild(clipRect);
    l.defs.appendChild(cp);
  }

  function dropBuilt() {
    if (!built) return;
    built.nodes.group.remove();
    for (const m of layer?.defs.querySelectorAll(`[id^="${uid}-"]`) ?? []) if (m.id !== clipId) m.remove();
    built = undefined;
  }

  function setDrawn() {
    if (!built) return;
    const { group, segments, chars } = built.nodes;
    group.style.opacity = '1';
    for (const s of segments) for (const t of s.targets) (t as Element).setAttribute('draw', '0 1');
    for (const c of chars) { c.style.fillOpacity = '1'; c.setAttribute('fill-opacity', '1'); }
    if (chars.length) group.style.visibility = 'visible';
  }

  function setHidden() {
    if (built) built.nodes.group.style.opacity = '0';
  }

  /** Lay out the mark for the element's place now. Rebuild the geometry when the size changed. */
  function layout(): boolean {
    const p = place(el);
    const from = typeof arrowFrom === 'string' ? null : place(arrowFrom);
    if (!p || (type === 'arrow' && typeof arrowFrom !== 'string' && !from)) {
      lastBox = null;
      if (outerM) { outerM.style.display = 'none'; outerH!.style.display = 'none'; }
      return false;
    }
    ensureNodes();
    lastBox = p.box;
    const [bx, by, bw, bh] = p.box;
    const origin: Point = [bx - ROOM, by - ROOM];
    const fromLocal = from ? ([from.box[0] - origin[0], from.box[1] - origin[1], from.box[2], from.box[3]] as Box) : null;
    const key = [r1(bw), r1(bh), fromLocal?.map(r1).join(','), typeof arrowFrom === 'string' ? arrowFrom : '', halo].join('|');
    if (!built || built.key !== key || forceRebuild) {
      forceRebuild = false;
      const wasDrawn = built && shown && !tl;
      if (tl) { tl.timeline.pause(); tl = undefined; settle(); }
      dropBuilt();
      const frame = { width: bw + ROOM * 2, height: bh + ROOM * 2 };
      const local: Box = [ROOM, ROOM, bw, bh];
      const rect = (box: Box): Region => ({ box, shape: 'rect', isPoint: false });
      const region = (t: { anchor?: string }): Region => {
        if (t.anchor === 'from') {
          if (fromLocal) return rect(fromLocal);
          const len = Math.max(90, baseStyle.stroke.width * 16);
          const [x, y, w, h] = local;
          const pt: Point =
            arrowFrom === 'left' ? [x - len, y + h / 2]
            : arrowFrom === 'right' ? [x + w + len, y + h / 2]
            : arrowFrom === 'top' ? [x + w / 2, y - len]
            : [x + w / 2, y + h + len];
          return { box: [pt[0], pt[1], 0, 0], shape: 'rect', isPoint: true };
        }
        return rect(local);
      };
      const ctx: GeometryContext = {
        style: baseStyle, frame, seed, measure,
        region: region as GeometryContext['region'],
        obstacles: () => ({ marks: [], text: [] }),
        arrowOf: () => undefined,
      };
      const { from: _from, ...opts } = rest;
      const spec = (
        type === 'label' ? { ...opts, type, id, at: { anchor: 'el' } }
        : type === 'arrow' ? { ...opts, type, id, from: { anchor: 'from' }, to: { anchor: 'el' } }
        : { ...opts, type, id, target: { anchor: 'el' } }
      ) as unknown as Mark;
      const geometry = buildGeometry(spec, ctx);
      const parts = renderStrokes(geometry.strokes, baseStyle, seed, geometry.width);
      const nodes = addMarkNodes(
        { highlight: innerH!, marks: innerM!, defs: layer!.defs }, frame, false,
        id, geometry, parts, tokenFor(), baseStyle, uid, halo ? colorOf(baseStyle.defaults.paper, 'paper') : undefined,
      );
      built = { key, nodes, origin };
      applyScheme();
      if (wasDrawn || (shown && !tl && !waiting)) setDrawn(); else setHidden();
    }
    built.origin = origin;
    const t = `translate(${origin[0]} ${origin[1]})`;
    innerM!.setAttribute('transform', t);
    innerH!.setAttribute('transform', t);
    outerM!.style.display = '';
    outerH!.style.display = '';
    const c = p.clip;
    if (c) {
      for (const [k, v] of Object.entries({ x: c[0], y: c[1], width: c[2], height: c[3] })) clipRect!.setAttribute(k, String(v));
      outerM!.setAttribute('clip-path', `url(#${clipId})`);
      outerH!.setAttribute('clip-path', `url(#${clipId})`);
    } else {
      outerM!.removeAttribute('clip-path');
      outerH!.removeAttribute('clip-path');
    }
    return true;
  }
  let forceRebuild = false;

  function settle() {
    const f = finishShow;
    finishShow = undefined;
    f?.();
  }

  function makeDim(): Dim | undefined {
    const spec = dimSpec();
    if (!spec) return undefined;
    const l = ensureLayer();
    const node = createDim(l.dimG, l.defs, `ikd${n}`, viewport(), [], spec, sStyle);
    node.el.removeAttribute('opacity');
    node.el.style.opacity = '0';
    node.el.style.fill = colorOf(sStyle.overlay.color, 'shade');
    const d: Dim = { node, style: () => sStyle, holes: () => (lastBox ? [lastBox] : []), last: '' };
    dims.add(d);
    return d;
  }

  function startDraw() {
    waiting = false;
    if (!built) return;
    groupFade?.stop();
    ownDim?.fading?.stop();
    ownDim ??= makeDim();
    const done = () => { tl = undefined; setDrawn(); settle(); };
    if (!allowAnimate || reduced()) {
      setDrawn();
      if (ownDim) ownDim.node.el.style.opacity = String(ownDim.node.opacity);
      refreshDims();
      settle();
      return;
    }
    built.nodes.group.style.opacity = '1';
    const planned: PlannedMark = {
      id, type, with: undefined, delay: rest.delay as number | undefined, duration: rest.duration as number | undefined, nodes: built.nodes,
    };
    tl = buildTimeline([{ step: { id: 'live', hold: 0, marks: [] }, marks: [planned], overlay: ownDim?.node }], baseStyle);
    tl.timeline.pause();
    tl.timeline.seek(0);
    tl.sync();
    tl.timeline.onComplete = done;
    refreshDims();
    tl.timeline.play();
  }

  const impl: Impl = {
    api: undefined as unknown as Annotation,
    el, type, n,
    get halo() { return halo; },
    set halo(v: boolean) { if (v !== halo) { halo = v; forceRebuild = true; schedule(); } },
    active: false,
    get forceRebuild() { return forceRebuild; },
    set forceRebuild(v: boolean) { forceRebuild = v; },
    box: () => (layout() ? lastBox : null),
    applyScheme,
    update() {
      const ok = layout();
      if (ok && waiting) startDraw();
    },
    remove,
    schemeStyle: () => sStyle,
    scheme: () => scheme,
    firstStyle: baseStyle,
  };

  function ensureFont(): Promise<unknown> {
    if (fontReady) return fontReady;
    if (type !== 'label') return (fontReady = Promise.resolve());
    const spec = `${baseStyle.font.weight ?? 400} ${(rest.size as number | undefined) ?? baseStyle.font.size}px ${baseStyle.font.family}`;
    return (fontReady = (async () => {
      await document.fonts.load(spec, String(rest.text)).catch(() => []);
      await document.fonts.ready;
    })());
  }

  function remove() {
    if (removed) return;
    removed = true;
    shown = false;
    impl.active = false;
    tl?.timeline.pause();
    tl = undefined;
    settle();
    dropBuilt();
    outerM?.remove();
    outerH?.remove();
    layer?.defs.querySelector(`#${clipId}`)?.remove();
    if (ownDim) {
      dims.delete(ownDim);
      ownDim.node.el.remove();
      ownDim.node.mask.remove();
    }
    layer?.ro?.unobserve(el);
    if (typeof arrowFrom !== 'string') layer?.ro?.unobserve(arrowFrom);
    items.delete(impl);
    schemeHooks.delete(applyScheme);
    releaseLayer();
  }

  const api: Annotation = {
    element: el,
    get shown() { return shown; },
    show() {
      if (removed) return Promise.resolve();
      if (shown) return showPromise;
      shown = true;
      showPromise = (async () => {
        await ensureFont();
        if (removed || !shown) return;
        const l = ensureLayer();
        if (!items.has(impl)) {
          items.add(impl);
          schemeHooks.add(applyScheme);
          l.ro?.observe(el);
          if (typeof arrowFrom !== 'string') l.ro?.observe(arrowFrom);
        }
        impl.active = true;
        applyScheme();
        const done = new Promise<void>((res) => { finishShow = res; });
        waiting = true;
        if (layout()) startDraw();
        await done;
      })();
      return showPromise;
    },
    async hide() {
      if (removed || !shown) return;
      shown = false;
      waiting = false;
      if (tl) { tl.timeline.pause(); tl = undefined; }
      settle();
      impl.active = false;
      const jobs: Promise<void>[] = [];
      groupFade?.stop();
      groupFade = undefined;
      const instant = !allowAnimate || reduced();
      if (built) {
        if (instant) setHidden();
        else { groupFade = fade(built.nodes.group, 0, HIDE_MS); jobs.push(groupFade.done); }
      }
      if (ownDim) {
        if (instant) { ownDim.fading?.stop(); ownDim.node.el.style.opacity = '0'; }
        else jobs.push(fadeDim(ownDim, 0, HIDE_MS));
      }
      await Promise.all(jobs);
    },
    remove,
  };
  impl.api = api;
  impls.set(api, impl);
  return api;
}

export function annotateGroup(list: Annotation[], options: GroupOptions = {}): AnnotationGroup {
  const members = list.map((a) => {
    const i = impls.get(a);
    if (!i) throw new Error('annotateGroup: every item must come from annotate().');
    return i;
  });
  if (!members.length) throw new Error('annotateGroup: the list is empty.');
  const first = members[0];
  const spotlight = !!options.overlay;
  if (spotlight) for (const m of members) m.halo = true;

  let gShown = false;
  let run = 0;
  let current: Impl | undefined;
  let holeOf: Impl | undefined;
  let dim: Dim | undefined;
  let running: Promise<void> = Promise.resolve();

  const gap = () => (options.gap ?? first.firstStyle.timing.gap) * 1000;
  const spec = () => pickOverlay(options.overlay, undefined, undefined, first.schemeStyle(), first.schemeStyle().colors);

  function ensureDim() {
    if (dim || !spotlight) return;
    const l = ensureLayer();
    const s = spec()!;
    const st = first.schemeStyle();
    const node = createDim(l.dimG, l.defs, `ikg${++counter}`, viewport(), [], s, st);
    node.el.removeAttribute('opacity');
    node.el.style.opacity = '0';
    node.el.style.fill = `var(--ik-a${first.n}-${safe(st.overlay.color)})`;
    dim = {
      node, style: () => first.schemeStyle(),
      holes: () => {
        const b = holeOf?.box();
        return b ? [b] : [];
      },
      last: '',
    };
    dims.add(dim);
  }

  const hook = () => {
    const s = spec();
    if (dim && s && gShown) { dim.node.opacity = s.opacity; dim.node.el.style.opacity = String(s.opacity); }
  };
  schemeHooks.add(hook);

  return {
    show() {
      if (gShown) return running;
      gShown = true;
      const token = ++run;
      running = (async () => {
        ensureDim();
        for (let i = 0; i < members.length; i++) {
          if (token !== run) return;
          const m = members[i];
          current = m;
          holeOf = m;
          if (dim) {
            refreshDims();
            if (i === 0) {
              const to = spec()!.opacity;
              if (reduced()) dim.node.el.style.opacity = String(to);
              else void fadeDim(dim, to, dim.node.fadeMs);
            }
          }
          await m.api.show();
          if (i < members.length - 1 && token === run && !reduced()) await wait(gap());
        }
        current = undefined;
      })();
      return running;
    },
    async hide() {
      if (!gShown) return;
      gShown = false;
      run++;
      holeOf = undefined;
      current = undefined;
      const jobs = members.map((m) => m.api.hide());
      if (dim) {
        if (reduced()) { dim.fading?.stop(); dim.node.el.style.opacity = '0'; }
        else jobs.push(fadeDim(dim, 0, HIDE_MS));
      }
      await Promise.all(jobs);
    },
    remove() {
      run++;
      gShown = false;
      schemeHooks.delete(hook);
      if (dim) {
        dims.delete(dim);
        dim.node.el.remove();
        dim.node.mask.remove();
        dim = undefined;
      }
      for (const m of members) m.api.remove();
      releaseLayer();
    },
  };
}
