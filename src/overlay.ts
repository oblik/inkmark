import type { Box, OverlayInput, Style } from './types.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface OverlaySpec {
  opacity: number;
  color: string;
}

export interface OverlayNode {
  el: SVGElement;
  mask: SVGElement;
  opacity: number;
  fadeMs: number;
}

/**
 * Spotlight settings of one step, or null for none.
 * The mount option wins over the step, and the step wins over the scene.
 */
export function pickOverlay(
  option: boolean | OverlayInput | undefined,
  step: boolean | OverlayInput | undefined,
  scene: boolean | OverlayInput | undefined,
  style: Style,
  colors: Record<string, string>,
): OverlaySpec | null {
  const v = option ?? step ?? scene;
  if (!v) return null;
  const input = v === true ? {} : v;
  const token = input.color ?? style.overlay.color;
  return {
    opacity: Math.min(1, Math.max(0, input.opacity ?? style.overlay.opacity)),
    color: colors[token] ?? token,
  };
}

const mk = (name: string, attrs: Record<string, string | number>) => {
  const e = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

/** Fills a dim mask: all white (dim) with a black rounded hole per box. */
export function setHoles(mask: SVGElement, frame: { width: number; height: number }, holes: Box[], style: Style): void {
  const { pad, radius } = style.overlay;
  mask.replaceChildren();
  mask.setAttribute('width', String(frame.width));
  mask.setAttribute('height', String(frame.height));
  mask.appendChild(mk('rect', { x: 0, y: 0, width: frame.width, height: frame.height, fill: '#fff' }));
  for (const [x, y, w, h] of holes) {
    const r = Math.min(radius, (w + pad * 2) / 2, (h + pad * 2) / 2);
    mask.appendChild(mk('rect', { x: x - pad, y: y - pad, width: w + pad * 2, height: h + pad * 2, rx: r, ry: r, fill: '#000' }));
  }
}

/** A dim layer with rounded holes. It starts invisible. The timeline fades it in. */
export function createDim(
  layer: SVGElement,
  defs: SVGElement,
  id: string,
  frame: { width: number; height: number },
  holes: Box[],
  spec: OverlaySpec,
  style: Style,
): OverlayNode {
  const mask = mk('mask', { id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: frame.width, height: frame.height });
  setHoles(mask, frame, holes, style);
  defs.appendChild(mask);
  const el = mk('rect', { x: 0, y: 0, width: frame.width, height: frame.height, fill: spec.color, mask: `url(#${id})`, opacity: 0 });
  layer.appendChild(el);
  return { el, mask, opacity: spec.opacity, fadeMs: Math.max(1, Math.round(style.overlay.fade * 1000)) };
}
