import type { Scene } from './types.ts';
import { mountScene, type MountOptions, type SceneHandle } from './mount.ts';
import { injectCss } from './stage.ts';
import { createControls, type Controls } from './controls.ts';

export interface PlayerOptions extends MountOptions {
  controls?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  keyboard?: boolean;
}

export interface Player extends SceneHandle {
  next(): void;
  back(): void;
  play(): void;
  pause(): void;
  readonly current: number;
  onStep(cb: (index: number) => void): () => void;
}

export async function createPlayer(container: HTMLElement, scene: Scene, options: PlayerOptions = {}): Promise<Player> {
  injectCss();
  const handle = await mountScene(container, scene, options);
  const { timeline, steps, duration } = handle;
  const n = steps.length;
  const listeners = new Set<(i: number) => void>();

  // Mode: idle, 'step' (Next is playing to a stop time) or 'auto' (auto-play through holds).
  let mode: 'idle' | 'step' | 'auto' = 'idle';
  let stopAt = 0;
  let idx = 0;
  let atEnd = false; // idx is at its drawEnd. false: at its start.

  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const emit = () => { for (const cb of listeners) cb(idx); };
  const stepAt = (ms: number) => {
    let i = 0;
    for (let k = 0; k < n; k++) if (ms >= steps[k].start) i = k;
    return i;
  };
  function setPos(i: number, end: boolean) {
    const changed = i !== idx;
    idx = i; atEnd = end;
    handle.seek(end ? steps[i].drawEnd : steps[i].start);
    if (changed) emit();
    update();
  }
  function stop() {
    if (mode !== 'idle') timeline.pause();
    mode = 'idle';
  }
  function runTo(t: number, m: 'step' | 'auto') {
    mode = m; stopAt = t;
    timeline.play();
    update();
  }

  timeline.onUpdate = () => {
    if (mode === 'idle') return;
    const t = timeline.currentTime;
    if (mode === 'auto') {
      const i = stepAt(t);
      if (i !== idx) { idx = i; emit(); }
      atEnd = false;
      if (t >= duration - 1) {
        if (options.loop) { handle.seek(0); idx = 0; emit(); timeline.play(); }
        else { stop(); setPos(n - 1, true); }
      }
    } else if (t >= stopAt) {
      stop();
      setPos(idx, true);
    }
    update();
  };

  // Dot click: show the step from its start, play its draw, stop at drawEnd.
  function goTo(i: number) {
    stop();
    if (reduced()) { setPos(i, true); return; }
    setPos(i, false);
    runTo(steps[i].drawEnd, 'step');
  }

  const player: Player = {
    ...handle,
    seek(ms) {
      stop();
      handle.seek(ms);
      const i = stepAt(ms);
      const changed = i !== idx;
      idx = i;
      atEnd = ms >= steps[i].drawEnd;
      if (changed) emit();
      update();
    },
    seekStep(index, at = 'drawEnd') {
      const s = steps[Math.max(0, Math.min(n - 1, index))];
      if (s) player.seek(at === 'start' ? s.start : at === 'end' ? s.end : s.drawEnd);
    },
    get current() { return idx; },
    next() {
      if (mode === 'step') { stop(); setPos(idx, true); return; }
      if (mode === 'auto') { stop(); setPos(idx, true); return; }
      let target = idx;
      if (atEnd) {
        if (idx + 1 >= n) {
          if (options.loop) { setPos(0, false); target = 0; } else { update(); return; }
        } else { target = idx + 1; setPos(target, false); }
      }
      if (reduced()) { setPos(target, true); return; }
      idx = target;
      runTo(steps[target].drawEnd, 'step');
    },
    back() {
      stop();
      if (idx > 0) setPos(idx - 1, true);
      else setPos(0, false);
    },
    play() {
      if (mode === 'auto') return;
      stop();
      // Reduced motion: no timer. Jump to the next finished step.
      if (reduced()) {
        if (atEnd && idx === n - 1) setPos(0, true);
        else setPos(atEnd ? idx + 1 : idx, true);
        return;
      }
      if (atEnd && idx === n - 1) { setPos(0, false); }
      runTo(duration, 'auto');
    },
    pause() { stop(); update(); },
    onStep(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    destroy() {
      stop();
      detachKeys();
      controls?.destroy();
      handle.destroy();
    },
  };

  let controls: Controls | undefined;
  let update = () => {};
  if (options.controls !== false) {
    controls = createControls({
      ids: steps.map((s) => s.id),
      onSeek: (i) => goTo(i),
      onToggle: () => (mode === 'auto' ? player.pause() : player.play()),
    });
    handle.stage.parentElement!.after(controls.el);
    update = () => {
      const s = steps[idx];
      const span = s.drawEnd - s.start;
      const fill = span > 0 ? (timeline.currentTime - s.start) / span : 1;
      controls!.set({ index: idx, fill, playing: mode === 'auto' });
    };
  }

  let detachKeys = () => {};
  if (options.keyboard !== false) {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); player.next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); player.back(); }
      else if (e.key === ' ' && !(t && t.tagName === 'BUTTON')) { e.preventDefault(); mode === 'auto' ? player.pause() : player.play(); }
    };
    document.addEventListener('keydown', onKey);
    detachKeys = () => document.removeEventListener('keydown', onKey);
  }

  update();
  if (options.autoplay) player.play();
  return player;
}
