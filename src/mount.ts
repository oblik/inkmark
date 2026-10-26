import type { Box, Point, Scene, Style, StyleInput, StepTime } from './types.ts';
import type { Timeline } from 'animejs';
import { resolveStyle } from './styles/index.ts';
import { markSeed } from './seed.ts';
import { createStage, resolveUrl } from './stage.ts';
import { createResolver, toFramePoint, toFrameBox, type MarkRecord } from './targets.ts';
import { renderStrokes } from './geometry/pen.ts';
import { buildGeometry } from './geometry/index.ts';
import { buildTimeline, type PlannedStep } from './timeline.ts';

export interface MountOptions {
  baseUrl?: string;
  styles?: Record<string, StyleInput>;
  style?: StyleInput;
  fit?: 'width' | 'none';
}

export interface SceneHandle {
  timeline: Timeline;
  steps: StepTime[];
  duration: number;
  stage: HTMLElement;
  seek(ms: number): void;
  seekStep(index: number, at?: 'start' | 'drawEnd' | 'end'): void;
  destroy(): void;
}

let uidCounter = 0;
const fontsDone = new Set<string>();

function firstFamily(family: string): string {
  return family.split(',')[0].trim().replace(/^["']|["']$/g, '');
}

function injectFont(style: Style, baseUrl?: string) {
  const src = style.font.src;
  if (!src) return;
  const family = firstFamily(style.font.family);
  const url = resolveUrl(src, baseUrl);
  const key = `${family}|${url}`;
  if (fontsDone.has(key)) return;
  fontsDone.add(key);
  const el = document.createElement('style');
  el.setAttribute('data-marginalia-font', family);
  el.textContent = `@font-face{font-family:"${family}";src:url("${url}");font-weight:100 900;font-display:block}`;
  document.head.appendChild(el);
}

async function loadSceneStyle(scene: Scene, options: MountOptions): Promise<Style> {
  const registry: Record<string, StyleInput> = { ...options.styles };
  let base = scene.style;
  if (typeof base === 'string' && !registry[base] && /[/.]/.test(base)) {
    const res = await fetch(resolveUrl(base, options.baseUrl));
    if (!res.ok) throw new Error(`Could not load the style file "${base}" (${res.status}).`);
    base = (await res.json()) as StyleInput;
  }
  // An `extends` in the override swaps the base style the scene named. Scene tweaks stay.
  const swap = options.style?.extends;
  registry.__scene =
    typeof base === 'string' ? { extends: swap ?? base }
    : swap ? { ...base, extends: swap }
    : (base ?? {});
  return resolveStyle(options.style ? { ...options.style, extends: '__scene' } : '__scene', registry);
}

export async function mountScene(container: HTMLElement, scene: Scene, options: MountOptions = {}): Promise<SceneHandle> {
  const style = await loadSceneStyle(scene, options);
  injectFont(style, options.baseUrl);

  const labels = scene.steps.flatMap((s) => s.marks).filter((m) => m.type === 'label');
  const fontSpec = `${style.font.weight ?? 400} ${style.font.size}px ${style.font.family}`;
  if (labels.length) {
    const sample = labels.map((m) => (m.type === 'label' ? m.text : '')).join('');
    await document.fonts.load(fontSpec, sample).catch(() => []);
    await document.fonts.ready;
  }

  const color = (name: string | undefined, fallback: string): string => style.colors[name ?? fallback] ?? name ?? style.colors[fallback] ?? '#000';
  const paper = style.colors[style.defaults.paper] ?? '#fff';
  const stage = await createStage(container, scene, { baseUrl: options.baseUrl, fit: options.fit, frameColor: paper });

  // Anchors
  let anchors: Record<string, Point | Box> = {};
  const a = scene.background.anchors;
  if (typeof a === 'string') {
    const res = await fetch(resolveUrl(a, options.baseUrl));
    if (!res.ok) throw new Error(`Could not load the anchor file "${a}" (${res.status}).`);
    anchors = ((await res.json()) as { anchors: Record<string, Point | Box> }).anchors ?? {};
  } else if (a) anchors = a;

  const records = new Map<string, MarkRecord>();
  const region = createResolver({
    map: stage.map,
    anchors,
    selectorBox: stage.selectorBox,
    mark: (id) => records.get(id),
  });

  const canvas = document.createElement('canvas').getContext('2d')!;
  const measure = (text: string, size: number) => {
    canvas.font = `${style.font.weight ?? 400} ${size}px ${style.font.family}`;
    return canvas.measureText(text).width;
  };

  let textCache: Box[] | undefined;
  const obstacles = () => {
    textCache ??= stage.textBoxes().map((b) => toFrameBox(stage.map, b));
    const marks: Box[] = [];
    for (const r of records.values()) if (r.geometry.layer === 'marks') marks.push(r.geometry.bounds.box);
    return { marks, text: textCache };
  };

  const uid = `mg${++uidCounter}`;
  const planned: PlannedStep[] = [];
  for (const step of scene.steps) {
    const marks: PlannedStep['marks'] = [];
    for (const mark of step.marks) {
      const seed = markSeed(mark.id, mark.seed);
      const ctx = {
        style, frame: stage.frameSize, seed, region, measure, obstacles,
        arrowOf: (id: string) => records.get(id)?.geometry.arrow,
      };
      const scribblePts = mark.type === 'scribble' ? mark.points.map((p) => toFramePoint(stage.map, p)) : undefined;
      const geometry = buildGeometry(mark, ctx, scribblePts);
      records.set(mark.id, { id: mark.id, geometry });
      const parts = renderStrokes(geometry.strokes, style, seed, geometry.width);
      const token =
        mark.type === 'highlight' ? color(mark.color, style.defaults.highlight)
        : mark.type === 'label' ? color(mark.color, style.defaults.label)
        : color(mark.color, style.defaults.stroke);
      const nodes = stage.addMark(mark.id, geometry, parts, token, style, uid);
      marks.push({ id: mark.id, type: mark.type, with: mark.with, delay: mark.delay, duration: mark.duration, nodes });
    }
    planned.push({ step, marks });
  }

  const built = buildTimeline(planned, style);
  const { timeline, steps, duration } = built;
  timeline.pause();
  timeline.seek(0);

  const seek = (ms: number) => { timeline.seek(Math.max(0, Math.min(duration, ms))); };
  return {
    timeline, steps, duration, stage: stage.frame, seek,
    seekStep(index, at = 'drawEnd') {
      const s = steps[Math.max(0, Math.min(steps.length - 1, index))];
      if (s) seek(at === 'start' ? s.start : at === 'end' ? s.end : s.drawEnd);
    },
    destroy() {
      timeline.pause();
      stage.destroy();
    },
  };
}
