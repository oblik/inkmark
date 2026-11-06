import { createDrawable } from 'animejs/svg';
import type { Box, Point, Scene, Style } from './types.ts';
import type { MarkGeometry } from './geometry/types.ts';
import type { PenPart } from './geometry/pen.ts';
import { type FitMap, fitBackground } from './targets.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function resolveUrl(src: string, baseUrl?: string): string {
  const base = baseUrl ? new URL(baseUrl, document.baseURI) : new URL(document.baseURI);
  return new URL(src, base).href;
}

const CSS = `
.ik-root{position:relative;display:block;max-width:100%;overflow:hidden}
.ik-stage{position:absolute;left:0;top:0;overflow:hidden;transform-origin:0 0}
.ik-bg{position:absolute;transform-origin:0 0}
.ik-bg>*{display:block;border:0;pointer-events:none}
.ik-overlay{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
`;

let cssInjected = false;
export function injectCss(): void {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  const s = document.createElement('style');
  s.setAttribute('data-inkmark', '');
  s.textContent = CSS;
  document.head.prepend(s);
}

function svgEl<K extends string>(name: K, attrs: Record<string, string | number> = {}): SVGElement {
  const e = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

const REPLACED = 'img,svg,canvas,video,input,button,select,textarea,picture,iframe,object';

function painted(el: Element): boolean {
  const c = el.ownerDocument.defaultView!.getComputedStyle(el);
  if (c.backgroundImage !== 'none') return true;
  if (!/^(transparent|rgba\(0, 0, 0, 0\))$/.test(c.backgroundColor)) return true;
  return ['Top', 'Right', 'Bottom', 'Left'].some(
    (k) => parseFloat(c.getPropertyValue(`border-${k.toLowerCase()}-width`)) > 0 && c.getPropertyValue(`border-${k.toLowerCase()}-style`) !== 'none',
  );
}

type Edges = [left: number, top: number, right: number, bottom: number];

/** The area that is not cut off by `overflow` on `from` and its parents, up to and with `stop`. */
function clipOf(from: Element, stop: Element, cache: Map<Element, Edges>): Edges {
  const hit = cache.get(from);
  if (hit) return hit;
  const parent = from === stop ? null : from.parentElement;
  let [x0, y0, x1, y1]: Edges = parent ? clipOf(parent, stop, cache) : [-Infinity, -Infinity, Infinity, Infinity];
  const c = from.ownerDocument.defaultView!.getComputedStyle(from);
  if (c.overflowX !== 'visible' || c.overflowY !== 'visible') {
    const r = from.getBoundingClientRect();
    if (c.overflowX !== 'visible') { x0 = Math.max(x0, r.left); x1 = Math.min(x1, r.right); }
    if (c.overflowY !== 'visible') { y0 = Math.max(y0, r.top); y1 = Math.min(y1, r.bottom); }
  }
  const edges: Edges = [x0, y0, x1, y1];
  cache.set(from, edges);
  return edges;
}

// Box of the text inside an element. null when the element should keep its own box.
function textBox(el: Element): Box | null {
  const doc = el.ownerDocument;
  if (el.matches(REPLACED) || el.querySelector(REPLACED) || painted(el)) return null;
  for (const d of el.querySelectorAll('*')) if (painted(d)) return null;
  const rects: Box[] = [];
  const clips = new Map<Element, Edges>();
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim()) continue;
    const [cx0, cy0, cx1, cy1] = clipOf(n.parentElement!, el, clips);
    const range = doc.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      // Only the visible part counts: rolling counters and cut-off text hide the rest.
      const x0 = Math.max(r.left, cx0), y0 = Math.max(r.top, cy0);
      const x1 = Math.min(r.right, cx1), y1 = Math.min(r.bottom, cy1);
      if (x1 - x0 > 1 && y1 - y0 > 1) rects.push([x0, y0, x1 - x0, y1 - y0]);
    }
  }
  if (!rects.length) return null;
  const x0 = Math.min(...rects.map((r) => r[0]));
  const y0 = Math.min(...rects.map((r) => r[1]));
  const x1 = Math.max(...rects.map((r) => r[0] + r[2]));
  const y1 = Math.max(...rects.map((r) => r[1] + r[3]));
  return [x0, y0, x1 - x0, y1 - y0];
}

/** Box of an element in its own viewport. Text-only elements get a box around the text. */
export function elementBox(el: Element): Box {
  const t = textBox(el);
  if (t) return t;
  const r = el.getBoundingClientRect();
  return [r.left, r.top, r.width, r.height];
}

export interface MarkNodes {
  group: SVGGElement;
  /** The highlight band path, if the mark has one. */
  band?: SVGPathElement;
  /** Sequential draw-on segments. `targets` are drawable proxies. */
  segments: { targets: unknown[]; weight: number }[];
  /** Label characters, in order. */
  chars: SVGTSpanElement[];
}

// Grain: noise shakes the edges a little and punches small holes in the ink.
// Chalk has big, many holes. Pencil has fine, few holes.
const GRAIN = {
  chalk: { freq: 0.75, shake: 2.6, alpha: '4.2 0 0 0 -1.35' },
  pencil: { freq: 1.6, shake: 1, alpha: '3.4 0 0 0 -0.75' },
};

/** Adds a grain filter for one mark to `defs`. Its region is the mark bounds plus room. */
function grainFilter(defs: SVGElement, id: string, kind: keyof typeof GRAIN, geom: MarkGeometry): string {
  const g = GRAIN[kind];
  const [x, y, w, h] = geom.bounds.box;
  const pad = geom.width * 2 + (geom.text ? geom.text.fontSize * 0.5 : 0) + 24;
  const f = svgEl('filter', {
    id, filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB',
    x: Math.floor(x - pad), y: Math.floor(y - pad), width: Math.ceil(w + pad * 2), height: Math.ceil(h + pad * 2),
  });
  f.append(
    svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: g.freq, numOctaves: 2, seed: 7, result: 'noise' }),
    svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'noise', scale: g.shake, xChannelSelector: 'R', yChannelSelector: 'G', result: 'shaken' }),
    svgEl('feColorMatrix', { in: 'noise', type: 'matrix', values: `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${g.alpha}`, result: 'grain' }),
    svgEl('feComposite', { in: 'shaken', in2: 'grain', operator: 'in' }),
  );
  defs.appendChild(f);
  return id;
}

export function addMarkNodes(
layers: { highlight: SVGElement; marks: SVGElement; defs: SVGElement },
frameSize: { width: number; height: number },
dark: boolean,
id: string, geom: MarkGeometry, parts: PenPart[], color: string, style: Style, uid: string, halo?: string,
): MarkNodes {
  const group = svgEl('g', { 'data-mark': id }) as SVGGElement;
  (geom.layer === 'highlight' ? layers.highlight : layers.marks).appendChild(group);
  const nodes: MarkNodes = { group, segments: [], chars: [] };
  const draw = (el: SVGElement) => createDrawable(el as unknown as SVGGeometryElement)[0];
  // `group` opacity is animated (fades). Texture and stroke opacity go on inner groups.
  const texture = style.stroke.texture;
  const body = texture === 'chalk' || texture === 'pencil'
    ? group.appendChild(svgEl('g', { filter: `url(#${grainFilter(layers.defs, `${uid}-${id}-grain`, texture, geom)})` }))
    : group;
  const opacity = style.stroke.opacity ?? 1;
  const ink = opacity < 1 && parts.length ? body.appendChild(svgEl('g', { opacity })) : body;

  if (geom.band) {
    const p = svgEl('path', {
      d: geom.band.d, fill: 'none', stroke: color, 'stroke-width': geom.band.width,
      'stroke-linecap': 'butt', opacity: dark ? geom.band.opacity * 0.9 : geom.band.opacity,
    });
    body.appendChild(p);
    nodes.band = p as SVGPathElement;
    nodes.segments.push({ targets: [draw(p)], weight: 1 });
  }
  parts.forEach((part, i) => {
    if (part.kind === 'stroke') {
      const targets = part.paths.map((d) => {
        const p = svgEl('path', {
          d, fill: 'none', stroke: color, 'stroke-width': geom.width,
          'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        });
        ink.appendChild(p);
        return draw(p);
      });
      nodes.segments.push({ targets, weight: part.weight });
    } else {
      const maskId = `${uid}-${id}-${i}`;
      const mask = svgEl('mask', { id: maskId, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: frameSize.width, height: frameSize.height });
      const c = svgEl('path', {
        d: part.center, fill: 'none', stroke: '#fff', 'stroke-width': part.maskWidth,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      });
      mask.appendChild(c);
      layers.defs.appendChild(mask);
      ink.appendChild(svgEl('path', { d: part.outline, fill: color, mask: `url(#${maskId})` }));
      nodes.segments.push({ targets: [draw(c)], weight: part.weight });
    }
  });

  if (geom.text) {
    const t = geom.text;
    for (const line of t.lines) {
      const text = svgEl('text', { x: line.x, y: line.y, fill: color });
      text.style.fontFamily = style.font.family;
      text.style.fontSize = `${t.fontSize}px`;
      text.style.fontWeight = String(style.font.weight ?? 400);
      text.style.whiteSpace = 'pre';
      if (halo) {
        // Paper-colored outline behind the letters, 0.12 em wide outside the glyphs.
        text.setAttribute('stroke', halo);
        text.setAttribute('stroke-width', String(t.fontSize * 0.24));
        text.setAttribute('stroke-linejoin', 'round');
        text.style.paintOrder = 'stroke';
      }
      for (const ch of line.text) {
        const ts = svgEl('tspan', { 'fill-opacity': 0 }) as SVGTSpanElement;
        ts.textContent = ch;
        text.appendChild(ts);
        nodes.chars.push(ts);
      }
      body.appendChild(text);
    }
    // Hidden until the timeline starts the label. Hidden also means no screen reader and no selection.
    group.style.visibility = 'hidden';
  }
  return nodes;
}

export interface Stage {
  root: HTMLElement;
  frame: HTMLElement;
  overlay: SVGSVGElement;
  frameSize: { width: number; height: number };
  map: FitMap;
  /** Box of a selector match in background space. */
  selectorBox(selector: string): Box | null;
  /** Boxes of text in the background, in background space. Empty for images. */
  textBoxes(): Box[];
  /** Layer and defs for the spotlight dim layers. */
  dimLayer: SVGElement;
  defs: SVGElement;
  addMark(id: string, geom: MarkGeometry, parts: PenPart[], color: string, style: Style, uid: string, halo?: string): MarkNodes;
  destroy(): void;
}

export interface StageOptions {
  baseUrl?: string;
  fit?: 'width' | 'none';
  frameColor: string;
  scheme: 'light' | 'dark';
}

const UNSAFE_TAGS = 'script,iframe,embed,object,frame,frameset,meta,link,base';
const UNSAFE_URL = /^\s*(javascript|vbscript|data\s*:\s*text\/html)/i;

// Removes what can run code: script-like elements, `on*` handlers, javascript: links,
// and animations that change a link or a handler.
function cleanSvg(root: DocumentFragment): void {
  root.querySelectorAll(UNSAFE_TAGS).forEach((n) => n.remove());
  for (const el of root.querySelectorAll('*')) {
    const tag = el.localName.toLowerCase();
    const animated = (el.getAttribute('attributeName') ?? '').toLowerCase();
    if ((tag === 'set' || tag === 'animate') && (animated.startsWith('on') || animated.endsWith('href'))) {
      el.remove();
      continue;
    }
    for (const { name, value } of [...el.attributes]) {
      const n = name.toLowerCase();
      if (n.startsWith('on') || ((n.endsWith('href') || n === 'src' || n === 'action' || n === 'formaction') && UNSAFE_URL.test(value))) {
        el.removeAttribute(name);
      }
    }
  }
}

function waitFor(target: EventTarget, ok = 'load'): Promise<void> {
  return new Promise((res, rej) => {
    target.addEventListener(ok, () => res(), { once: true });
    target.addEventListener('error', () => rej(new Error('The background failed to load.')), { once: true });
  });
}

export async function createStage(container: HTMLElement, scene: Scene, opts: StageOptions): Promise<Stage> {
  injectCss();
  const bg = scene.background;
  const frameSize = { width: scene.frame?.width ?? bg.width, height: scene.frame?.height ?? bg.height };
  const map = fitBackground(bg, { ...frameSize, fit: scene.frame?.fit });

  const root = document.createElement('div');
  root.className = 'ik-root';
  const frame = document.createElement('div');
  frame.className = 'ik-stage';
  frame.style.colorScheme = opts.scheme;
  frame.style.width = `${frameSize.width}px`;
  frame.style.height = `${frameSize.height}px`;
  frame.style.background = scene.frame?.color ?? opts.frameColor;
  root.appendChild(frame);

  const bgBox = document.createElement('div');
  bgBox.className = 'ik-bg';
  Object.assign(bgBox.style, {
    left: `${map.ox}px`, top: `${map.oy}px`, width: `${bg.width}px`, height: `${bg.height}px`,
    transform: `scale(${map.scale})`,
  });
  frame.appendChild(bgBox);

  const overlay = svgEl('svg', {
    class: 'ik-overlay', width: frameSize.width, height: frameSize.height,
    viewBox: `0 0 ${frameSize.width} ${frameSize.height}`,
  }) as SVGSVGElement;
  const defs = svgEl('defs');
  const gDim = svgEl('g', { class: 'ik-layer-dim' });
  const gHighlight = svgEl('g', { class: 'ik-layer-highlight' });
  // Multiply keeps dark text readable on a light page but vanishes on a dark one.
  // On dark pages the band is a plain, fainter layer, so light text stays readable.
  const dark = opts.scheme === 'dark';
  if (!dark) gHighlight.style.mixBlendMode = 'multiply';
  const gMarks = svgEl('g', { class: 'ik-layer-marks' });
  overlay.append(defs, gDim, gHighlight, gMarks);
  frame.appendChild(overlay);

  // Layout size first so measuring works.
  const fit = opts.fit ?? 'width';
  let scale = 1;
  const applyScale = () => {
    const cw = container.clientWidth;
    scale = fit === 'width' && cw > 0 ? Math.min(1, cw / frameSize.width) : 1;
    frame.style.transform = scale === 1 ? '' : `scale(${scale})`;
    root.style.width = `${frameSize.width * scale}px`;
    root.style.height = `${frameSize.height * scale}px`;
  };
  container.appendChild(root);
  applyScale();
  let observer: ResizeObserver | undefined;
  if (fit === 'width' && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(applyScale);
    observer.observe(container);
  }

  let selectorBox: Stage['selectorBox'] = () => null;
  let textBoxes: Stage['textBoxes'] = () => [];
  if (bg.type === 'image') {
    const img = document.createElement('img');
    img.alt = '';
    img.width = bg.width;
    img.height = bg.height;
    img.style.width = `${bg.width}px`;
    img.style.height = `${bg.height}px`;
    if (!bg.src) throw new Error('An image background needs "src".');
    const loaded = waitFor(img);
    img.src = resolveUrl(bg.src, opts.baseUrl);
    bgBox.appendChild(img);
    await loaded;
  } else if (bg.type === 'html') {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('tabindex', '-1');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.colorScheme = opts.scheme;
    iframe.style.width = `${bg.width}px`;
    iframe.style.height = `${bg.height}px`;
    const loaded = waitFor(iframe);
    if (bg.content !== undefined) iframe.srcdoc = bg.content;
    else if (bg.src) iframe.src = resolveUrl(bg.src, opts.baseUrl);
    else throw new Error('An html background needs "src" or "content".');
    bgBox.appendChild(iframe);
    await loaded;
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('The html background must be same-origin.');
    // `prefers-color-scheme` in the page follows the browser, not us. These two follow the scene:
    // `light-dark()` and a `[data-ik-scheme]` selector.
    doc.documentElement.style.colorScheme = opts.scheme;
    doc.documentElement.dataset.ikScheme = opts.scheme;
    await doc.fonts?.ready;
    textBoxes = () => {
      const out: Box[] = [];
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent?.trim()) continue;
        const range = doc.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) out.push([r.left, r.top, r.width, r.height]);
      }
      return out;
    };
    selectorBox = (sel) => {
      const el = doc.querySelector(sel);
      return el ? elementBox(el) : null;
    };
  } else {
    let markup = bg.content;
    if (markup === undefined) {
      if (!bg.src) throw new Error('An svg background needs "src" or "content".');
      const res = await fetch(resolveUrl(bg.src, opts.baseUrl));
      if (!res.ok) throw new Error(`Could not load the svg background (${res.status}).`);
      markup = await res.text();
    }
    // Parse in an inert template, clean it, then insert. An svg file must not run code in the page.
    const tpl = document.createElement('template');
    tpl.innerHTML = markup;
    cleanSvg(tpl.content);
    bgBox.replaceChildren(tpl.content);
    const el = bgBox.querySelector('svg');
    if (!el) throw new Error('The svg background has no <svg> element.');
    if (!el.getAttribute('viewBox')) {
      const w = parseFloat(el.getAttribute('width') ?? '') || bg.width;
      const h = parseFloat(el.getAttribute('height') ?? '') || bg.height;
      el.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }
    el.setAttribute('width', String(bg.width));
    el.setAttribute('height', String(bg.height));
    el.style.display = 'block';
    textBoxes = () => {
      const b = bgBox.getBoundingClientRect();
      const k = b.width / bg.width || 1;
      return [...bgBox.querySelectorAll('text')].map((t) => {
        const r = t.getBoundingClientRect();
        return [(r.left - b.left) / k, (r.top - b.top) / k, r.width / k, r.height / k] as Box;
      });
    };
    selectorBox = (sel) => {
      const found = bgBox.querySelector(sel);
      if (!found) return null;
      const r = found.getBoundingClientRect();
      const b = bgBox.getBoundingClientRect();
      const k = b.width / bg.width || 1;
      return [(r.left - b.left) / k, (r.top - b.top) / k, r.width / k, r.height / k];
    };
  }

  const addMark: Stage['addMark'] = (id, geom, parts, color, style, uid, halo) =>
    addMarkNodes({ highlight: gHighlight, marks: gMarks, defs }, frameSize, dark, id, geom, parts, color, style, uid, halo);

  return {
    root, frame, overlay, dimLayer: gDim, defs, frameSize, map, selectorBox, textBoxes, addMark,
    destroy() {
      observer?.disconnect();
      root.remove();
    },
  };
}

export type { Point };
