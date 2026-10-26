import { createTimeline, type Timeline } from 'animejs';
import type { MarkType, Step, StepTime, Style } from './types.ts';
import type { MarkNodes } from './stage.ts';

export interface PlannedMark {
  id: string;
  type: MarkType;
  with?: string;
  delay?: number;
  duration?: number;
  nodes: MarkNodes;
}

export interface PlannedStep {
  step: Step;
  marks: PlannedMark[];
}

export interface BuiltTimeline {
  timeline: Timeline;
  steps: StepTime[];
  duration: number;
}

const FADE_MS = 300;

/** All marks of a step in order, then the hold. Every time is in ms. */
export function buildTimeline(planned: PlannedStep[], style: Style): BuiltTimeline {
  const tl = createTimeline({ autoplay: false, defaults: { ease: style.timing.easing } });
  const times: StepTime[] = [];
  const earlier: SVGGElement[] = [];
  const t = style.timing;
  let start = 0;

  for (const { step, marks } of planned) {
    tl.label(step.id, start);
    let cursor = start;
    if (step.clear && earlier.length) {
      tl.add(earlier.slice(), { opacity: [1, 0], duration: FADE_MS, ease: 'linear' }, start);
      cursor = start + FADE_MS;
    }
    const begins = new Map<string, number>();
    let first = true;
    let drawEnd = cursor;
    for (const m of marks) {
      const dur = Math.max(1, Math.round((m.duration ?? defaultDuration(m, style)) * 1000));
      let at: number;
      if (m.with && begins.has(m.with)) at = begins.get(m.with)!;
      else at = first ? cursor : drawEnd + Math.round(t.gap * 1000);
      first = false;
      at += Math.round((m.delay ?? 0) * 1000);
      begins.set(m.id, at);
      drawEnd = Math.max(drawEnd, at + dur);

      const totalW = m.nodes.segments.reduce((a, s) => a + s.weight, 0) || 1;
      let offset = 0;
      for (const seg of m.nodes.segments) {
        const segDur = Math.max(1, Math.round((dur * seg.weight) / totalW));
        tl.add(seg.targets as never, { draw: ['0 0', '0 1'], duration: segDur }, at + offset);
        offset += segDur;
      }
      const n = m.nodes.chars.length;
      if (n) {
        const per = dur / n;
        m.nodes.chars.forEach((ch, i) => {
          tl.add(ch, { fillOpacity: [0, 1], duration: Math.max(1, Math.round(per * 0.9)), ease: 'linear' }, at + Math.round(per * i));
        });
      }
    }
    const holdMs = Math.round((step.hold ?? t.hold) * 1000);
    const end = drawEnd + holdMs;
    // A timer fills the hold, so the timeline lasts until the end of the last hold.
    if (holdMs > 0) tl.add({ duration: holdMs }, drawEnd);
    times.push({ id: step.id, start, drawEnd, end });
    for (const m of marks) earlier.push(m.nodes.group);
    start = end;
  }
  return { timeline: tl, steps: times, duration: start };
}

function defaultDuration(m: PlannedMark, style: Style): number {
  const base = style.timing.durations[m.type];
  if (m.type === 'label') {
    const chars = m.nodes.chars.length;
    return Math.max(base * 0.5, chars * style.timing.labelPerChar);
  }
  return base;
}
