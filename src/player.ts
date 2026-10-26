import type { Scene } from './types.ts';
import { mountScene, type MountOptions, type SceneHandle } from './mount.ts';
import { injectCss } from './stage.ts';

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
      // Auto-play is off under reduced motion. Use Next and Back.
      if (mode === 'auto' || reduced()) return;
      stop();
      if (atEnd && idx === n - 1) { setPos(0, false); }
      runTo(duration, 'auto');
    },
    pause() { stop(); update(); },
    onStep(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    destroy() {
      stop();
      detachKeys();
      controls?.remove();
      handle.destroy();
    },
  };

  let controls: HTMLElement | undefined;
  let update = () => {};
  if (options.controls !== false) {
    controls = document.createElement('div');
    controls.className = 'mg-controls';
    const mk = (cls: string, label: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `mg-btn ${cls}`;
      b.textContent = label;
      b.addEventListener('click', onClick);
      return b;
    };
    const back = mk('mg-btn-back', 'Back', () => player.back());
    const next = mk('mg-btn-next', 'Next', () => player.next());
    const play = mk('mg-btn-play', 'Play', () => (mode === 'auto' ? player.pause() : player.play()));
    const count = document.createElement('span');
    count.className = 'mg-count';
    count.setAttribute('aria-live', 'polite');
    controls.append(back, next, play, count);
    handle.stage.parentElement!.after(controls);
    update = () => {
      const shown = idx === 0 && !atEnd && mode === 'idle' ? 0 : idx + 1;
      count.textContent = `${shown} / ${n}`;
      back.disabled = idx === 0 && !atEnd && mode !== 'auto';
      next.disabled = !options.loop && idx === n - 1 && (atEnd || mode === 'auto');
      play.textContent = mode === 'auto' ? 'Pause' : 'Play';
      play.setAttribute('aria-pressed', String(mode === 'auto'));
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
