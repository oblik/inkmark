// Default player controls: a slab of step dots and a play/pause button.
// This is UI chrome only. It never runs in the PNG or MP4 output.

export interface ControlsOptions {
  ids: string[];
  onSeek(index: number): void;
  onToggle(): void;
}

export interface ControlsState {
  index: number;
  /** 0..1 fill of the current dot. */
  fill: number;
  playing: boolean;
}

export interface Controls {
  el: HTMLElement;
  set(state: ControlsState): void;
  destroy(): void;
}

const CSS = `
.ik-steps{
  --ik-ctl-ink:#1c1c1a;--ik-ctl-ink-2:#1c1c1a;--ik-ctl-surface:#efefec;
  --ik-ctl-edge:rgba(0,0,0,.08);--ik-ctl-font:system-ui,sans-serif;
  display:flex;align-items:center;gap:8px;width:fit-content;max-width:100%;margin:12px auto;
  font:14px/1.2 var(--ik-ctl-font);color:var(--ik-ctl-ink);
}
.ik-player[data-ik-scheme="dark"] .ik-steps{
  --ik-ctl-ink:#f2f2ee;--ik-ctl-ink-2:#f2f2ee;--ik-ctl-surface:#2b2b29;--ik-ctl-edge:rgba(255,255,255,.1);
}
.ik-steps-slab,.ik-steps-play{
  height:32px;background:var(--ik-ctl-surface);box-shadow:inset 0 0 0 1px var(--ik-ctl-edge);
  border-radius:16px;flex:none;
}
.ik-steps-slab{display:flex;align-items:center;gap:8px;padding:0 12px;min-width:0}
.ik-steps-dot{
  position:relative;flex:none;width:8px;height:8px;padding:0;margin:0;border:0;border-radius:4px;
  background:color-mix(in srgb,var(--ik-ctl-ink) 22%,var(--ik-ctl-surface));
  cursor:pointer;-webkit-tap-highlight-color:transparent;
  transition:width .48s cubic-bezier(.22,1,.36,1),background-color .25s ease-out;
}
.ik-steps-dot::after{content:"";position:absolute;inset:-8px;}
.ik-steps-dot.is-done{background:var(--ik-ctl-ink)}
.ik-steps-dot.is-current{width:32px}
.ik-steps-fill{
  position:absolute;inset:0;border-radius:inherit;background:var(--ik-ctl-ink);
  clip-path:inset(0 100% 0 0);pointer-events:none;
}
.ik-steps-play{
  position:relative;width:32px;padding:0;border:0;display:grid;place-items:center;cursor:pointer;
  color:var(--ik-ctl-ink-2);-webkit-tap-highlight-color:transparent;
  transition:transform .15s ease-out;
}
.ik-steps-play:active{transform:scale(.93)}
.ik-steps-play svg{width:16px;height:16px;fill:currentColor;display:block}
.ik-steps-dot:focus,.ik-steps-play:focus{outline:none}
.ik-steps-dot:focus-visible,.ik-steps-play:focus-visible{outline:2px solid var(--ik-ctl-ink);outline-offset:3px}
@media (prefers-reduced-motion:reduce){
  .ik-steps-dot,.ik-steps-play{transition:none}
}
`;

// Icon shapes: two quads (TL, TR, BR, BL) that morph between a play triangle and two pause bars.
const PLAY: number[][] = [
  [4.5, 2.5, 8.5, 4.94, 8.5, 11.06, 4.5, 13.5],
  [8.5, 4.94, 13.5, 8, 13.5, 8, 8.5, 11.06],
];
const PAUSE: number[][] = [
  [4, 3, 6.5, 3, 6.5, 13, 4, 13],
  [9.5, 3, 12, 3, 12, 13, 9.5, 13],
];

const SVG_NS = 'http://www.w3.org/2000/svg';
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function injectCss() {
  if (document.getElementById('ik-steps-css')) return;
  const s = document.createElement('style');
  s.id = 'ik-steps-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function createControls(opts: ControlsOptions): Controls {
  injectCss();
  const n = opts.ids.length;
  const root = document.createElement('div');
  root.className = 'ik-steps';
  root.setAttribute('role', 'group');

  const slab = document.createElement('div');
  slab.className = 'ik-steps-slab';
  const dots: HTMLButtonElement[] = [];
  const fills: HTMLElement[] = [];
  opts.ids.forEach((id, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ik-steps-dot';
    b.setAttribute('aria-label', `Step ${i + 1}: ${id}`);
    const f = document.createElement('span');
    f.className = 'ik-steps-fill';
    b.append(f);
    b.addEventListener('click', () => opts.onSeek(i));
    slab.append(b);
    dots.push(b);
    fills.push(f);
  });

  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'ik-steps-play';
  play.addEventListener('click', () => opts.onToggle());
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const polys = [0, 1].map(() => {
    const p = document.createElementNS(SVG_NS, 'polygon');
    svg.append(p);
    return p;
  });
  play.append(svg);
  root.append(slab, play);

  // Icon morph. The frame loop runs only during the 280 ms tween.
  let mix = 0; // 0 = play, 1 = pause
  let raf = 0;
  const draw = (m: number) => {
    polys.forEach((p, k) => {
      const pts = PLAY[k].map((v, j) => v + (PAUSE[k][j] - v) * m);
      p.setAttribute('points', pts.map((v) => +v.toFixed(2)).join(' '));
    });
  };
  const morphTo = (target: number) => {
    cancelAnimationFrame(raf);
    if (reduced()) { mix = target; draw(mix); return; }
    const from = mix;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 280);
      const e = 1 - Math.pow(1 - k, 3);
      mix = from + (target - from) * e;
      draw(mix);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  draw(0);

  let cur = -1;
  let curFill = -1;
  let playing: boolean | undefined;

  function pulse(from: number, to: number) {
    if (reduced() || from < 0) return;
    const dir = to > from ? 1 : -1;
    let k = 0;
    for (let i = from + dir; i !== to; i += dir) {
      dots[i].animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.3)', offset: 0.4 }, { transform: 'scale(1)' }],
        { duration: 320, delay: 60 + k * 70, easing: 'ease-out' },
      );
      k++;
    }
  }

  return {
    el: root,
    set(s) {
      const i = Math.max(0, Math.min(n - 1, s.index));
      if (i !== cur) {
        pulse(cur, i);
        dots.forEach((d, k) => {
          d.classList.toggle('is-done', k < i);
          d.classList.toggle('is-current', k === i);
          if (k === i) d.setAttribute('aria-current', 'step');
          else d.removeAttribute('aria-current');
          if (k !== i) fills[k].style.clipPath = '';
        });
        root.setAttribute('aria-label', `Step ${i + 1} of ${n}`);
        cur = i;
        curFill = -1;
      }
      const f = Math.max(0, Math.min(1, s.fill));
      if (f !== curFill) {
        fills[i].style.clipPath = `inset(0 ${(1 - f) * 100}% 0 0)`;
        curFill = f;
      }
      if (s.playing !== playing) {
        playing = s.playing;
        play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        morphTo(playing ? 1 : 0);
      }
    },
    destroy() {
      cancelAnimationFrame(raf);
      root.remove();
    },
  };
}
