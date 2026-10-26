import { svg } from 'animejs';
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
.mg-root{position:relative;display:block;max-width:100%;overflow:hidden}
.mg-stage{position:absolute;left:0;top:0;overflow:hidden;transform-origin:0 0}
.mg-bg{position:absolute;transform-origin:0 0}
.mg-bg>*{display:block;border:0;pointer-events:none}
.mg-overlay{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
.mg-controls{display:flex;align-items:center;gap:8px;margin-top:12px;font:14px/1.2 system-ui,sans-serif}
.mg-btn{font:inherit;padding:6px 14px;border:1px solid currentColor;border-radius:6px;background:transparent;color:inherit;cursor:pointer}
.mg-btn:disabled{opacity:.4;cursor:default}
.mg-count{margin-left:auto;font-variant-numeric:tabular-nums}
`;

let cssInjected = false;
export function injectCss(): void {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  const s = document.createElement('style');
  s.setAttribute('data-marginalia', '');
  s.textContent = CSS;
  document.head.prepend(s);
}

function svgEl<K extends string>(name: K, attrs: Record<string, string | number> = {}): SVGElement {
  const e = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export interface MarkNodes {
  group: SVGGElement;
  /** Sequential draw-on segments. `targets` are drawable proxies. */
  segments: { targets: unknown[]; weight: number }[];
  /** Label characters, in order. */
  chars: SVGTSpanElement[];
}

export interface Stage {
  root: HTMLElement;
  frame: HTMLElement;
  frameSize: { width: number; height: number };
  map: FitMap;
  /** Box of a selector match in background space. */
  selectorBox(selector: string): Box | null;
  /** Boxes of text in the background, in background space. Empty for images. */
  textBoxes(): Box[];
  addMark(id: string, geom: MarkGeometry, parts: PenPart[], color: string, style: Style, uid: string): MarkNodes;
  destroy(): void;
}

export interface StageOptions {
  baseUrl?: string;
  fit?: 'width' | 'none';
  frameColor: string;
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
  root.className = 'mg-root';
  const frame = document.createElement('div');
  frame.className = 'mg-stage';
  frame.style.width = `${frameSize.width}px`;
  frame.style.height = `${frameSize.height}px`;
  frame.style.background = scene.frame?.color ?? opts.frameColor;
  root.appendChild(frame);

  const bgBox = document.createElement('div');
  bgBox.className = 'mg-bg';
  Object.assign(bgBox.style, {
    left: `${map.ox}px`, top: `${map.oy}px`, width: `${bg.width}px`, height: `${bg.height}px`,
    transform: `scale(${map.scale})`,
  });
  frame.appendChild(bgBox);

  const overlay = svgEl('svg', {
    class: 'mg-overlay', width: frameSize.width, height: frameSize.height,
    viewBox: `0 0 ${frameSize.width} ${frameSize.height}`,
  }) as SVGSVGElement;
  const defs = svgEl('defs');
  const gHighlight = svgEl('g', { class: 'mg-layer-highlight' });
  gHighlight.style.mixBlendMode = 'multiply';
  const gMarks = svgEl('g', { class: 'mg-layer-marks' });
  overlay.append(defs, gHighlight, gMarks);
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
    const win = doc.defaultView!;
    const REPLACED = 'img,svg,canvas,video,input,button,select,textarea,picture,iframe,object';
    const painted = (el: Element) => {
      const c = win.getComputedStyle(el);
      if (c.backgroundImage !== 'none') return true;
      if (!/^(transparent|rgba\(0, 0, 0, 0\))$/.test(c.backgroundColor)) return true;
      return ['Top', 'Right', 'Bottom', 'Left'].some(
        (k) => parseFloat(c.getPropertyValue(`border-${k.toLowerCase()}-width`)) > 0 && c.getPropertyValue(`border-${k.toLowerCase()}-style`) !== 'none',
      );
    };
    // Box of the text inside an element. null when the element should keep its own box.
    const textBox = (el: Element): Box | null => {
      if (el.matches(REPLACED) || el.querySelector(REPLACED) || painted(el)) return null;
      for (const d of el.querySelectorAll('*')) if (painted(d)) return null;
      const rects: Box[] = [];
      const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent?.trim()) continue;
        const range = doc.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) rects.push([r.left, r.top, r.width, r.height]);
      }
      if (!rects.length) return null;
      const x0 = Math.min(...rects.map((r) => r[0]));
      const y0 = Math.min(...rects.map((r) => r[1]));
      const x1 = Math.max(...rects.map((r) => r[0] + r[2]));
      const y1 = Math.max(...rects.map((r) => r[1] + r[3]));
      return [x0, y0, x1 - x0, y1 - y0];
    };
    selectorBox = (sel) => {
      const el = doc.querySelector(sel);
      if (!el) return null;
      const t = textBox(el);
      if (t) return t;
      const r = el.getBoundingClientRect();
      return [r.left, r.top, r.width, r.height];
    };
  } else {
    let markup = bg.content;
    if (markup === undefined) {
      if (!bg.src) throw new Error('An svg background needs "src" or "content".');
      const res = await fetch(resolveUrl(bg.src, opts.baseUrl));
      if (!res.ok) throw new Error(`Could not load the svg background (${res.status}).`);
      markup = await res.text();
    }
    bgBox.innerHTML = markup;
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

  function addMark(id: string, geom: MarkGeometry, parts: PenPart[], color: string, style: Style, uid: string): MarkNodes {
    const group = svgEl('g', { 'data-mark': id }) as SVGGElement;
    (geom.layer === 'highlight' ? gHighlight : gMarks).appendChild(group);
    const nodes: MarkNodes = { group, segments: [], chars: [] };
    const draw = (el: SVGElement) => svg.createDrawable(el as unknown as SVGGeometryElement)[0];

    if (geom.band) {
      const p = svgEl('path', {
        d: geom.band.d, fill: 'none', stroke: color, 'stroke-width': geom.band.width,
        'stroke-linecap': 'butt', opacity: geom.band.opacity,
      });
      group.appendChild(p);
      nodes.segments.push({ targets: [draw(p)], weight: 1 });
    }
    parts.forEach((part, i) => {
      if (part.kind === 'stroke') {
        const targets = part.paths.map((d) => {
          const p = svgEl('path', {
            d, fill: 'none', stroke: color, 'stroke-width': geom.width,
            'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          });
          group.appendChild(p);
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
        defs.appendChild(mask);
        group.appendChild(svgEl('path', { d: part.outline, fill: color, mask: `url(#${maskId})` }));
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
        for (const ch of line.text) {
          const ts = svgEl('tspan', { 'fill-opacity': 0 }) as SVGTSpanElement;
          ts.textContent = ch;
          text.appendChild(ts);
          nodes.chars.push(ts);
        }
        group.appendChild(text);
      }
    }
    return nodes;
  }

  return {
    root, frame, frameSize, map, selectorBox, textBoxes, addMark,
    destroy() {
      observer?.disconnect();
      root.remove();
    },
  };
}

export type { Point };
