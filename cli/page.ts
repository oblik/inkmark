import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Scene, Style } from '../src/types.ts';
import { resolveStyle } from '../src/styles/index.ts';
import { isUrl, loadScene, resolveFrom } from './load.ts';
import type { LoadedScene } from './load.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export interface PageData {
  scene: Scene;
  style: Style;
  /** Pixel size of the output frame. */
  width: number;
  height: number;
  fontCss: string;
  bundle: string;
}

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml',
};

function readLocal(dir: string, src: string, what: string): Buffer {
  const file = resolveFrom(dir, src);
  try {
    return readFileSync(file.startsWith('file:') ? fileURLToPath(file) : file);
  } catch {
    throw new Error(`Cannot read ${what} "${src}". Check the path.`);
  }
}

function inlineBackground(scene: Scene, dir: string): void {
  const bg = scene.background;
  if (!bg.src || bg.content !== undefined) return;
  if (/^(https?:)/i.test(bg.src)) {
    console.error(`Warning: background "${bg.src}" is a web address. The output needs the network.`);
    return;
  }
  if (bg.src.startsWith('data:')) return;
  const data = readLocal(dir, bg.src, 'background');
  if (bg.type === 'image') {
    const mime = MIME[extname(bg.src).toLowerCase()] ?? 'application/octet-stream';
    bg.src = `data:${mime};base64,${data.toString('base64')}`;
  } else {
    bg.content = data.toString('utf8');
    delete bg.src;
  }
}

// Finds an installed @fontsource package. Looks in the project, then in this repo.
function findPackage(name: string, from: string[]): string | undefined {
  for (const start of from) {
    let dir = start;
    for (;;) {
      const p = join(dir, 'node_modules', name);
      if (existsSync(join(p, 'package.json'))) return p;
      const up = dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  return undefined;
}

function firstFamily(family: string): string {
  return family.split(',')[0].trim().replace(/^["']|["']$/g, '');
}

function fontFace(family: string, data: Buffer, mime: string, weight: string): string {
  return `@font-face{font-family:"${family}";src:url(data:${mime};base64,${data.toString('base64')});font-weight:${weight};font-style:normal;font-display:block}`;
}

/** Builds the @font-face CSS for the label font. Returns '' (with a warning) when none is found. */
export function labelFontCss(style: Style, dir: string): string {
  const family = firstFamily(style.font.family);
  if (style.font.src) {
    if (isUrl(style.font.src) && !style.font.src.startsWith('file:')) {
      console.error(`Warning: font "${style.font.src}" is a web address. The output needs the network.`);
      return '';
    }
    const ext = extname(style.font.src).toLowerCase();
    const mime = ext === '.woff2' ? 'font/woff2' : ext === '.woff' ? 'font/woff' : ext === '.otf' ? 'font/otf' : 'font/ttf';
    return fontFace(family, readLocal(dir, style.font.src, 'font'), mime, '100 900');
  }
  const variable = /\bvariable$/i.test(family);
  const slug = family.replace(/\s+variable$/i, '').toLowerCase().replace(/\s+/g, '-');
  const weight = style.font.weight ?? 400;
  const roots = [process.cwd(), dir, root];
  const tries = variable ? [['@fontsource-variable/', true], ['@fontsource/', false]] : [['@fontsource/', false], ['@fontsource-variable/', true]];
  for (const [prefix, isVar] of tries as [string, boolean][]) {
    const pkg = findPackage(prefix + slug, roots);
    if (!pkg) continue;
    const names = isVar
      ? [`${slug}-latin-wght-normal.woff2`]
      : [`${slug}-latin-${weight}-normal.woff2`, `${slug}-latin-400-normal.woff2`];
    for (const n of names) {
      const f = join(pkg, 'files', n);
      if (existsSync(f)) return fontFace(family, readFileSync(f), 'font/woff2', isVar ? '100 900' : String(weight));
    }
  }
  console.error(`Warning: no font file for "${family}". Labels use a fallback font. Set style.font.src to a font file.`);
  return '';
}

export function loadBundle(): string {
  const file = join(root, 'dist', 'inkmark.iife.js');
  if (!existsSync(file)) {
    console.error('Run npm run build first.');
    process.exit(1);
  }
  return readFileSync(file, 'utf8');
}

/** Reads a scene file and returns everything a page needs. Throws on bad input. */
export function preparePage(scenePath: string): { loaded: LoadedScene; data: PageData } {
  const loaded = loadScene(scenePath);
  const { scene, dir } = loaded;
  if (loaded.problems.length) throw new Error(loaded.problems.map((p) => p.message).join(' '));
  if (!scene || !scene.background || !Array.isArray(scene.steps)) throw new Error(`"${scenePath}" is not a scene. Run "inkmark validate" first.`);
  const bundle = loadBundle();
  const copy = structuredClone(scene);
  const style = resolveStyle(copy.style, loaded.styles);
  const fontCss = labelFontCss(style, dir);
  const inlineStyle: Style = { ...style, font: { ...style.font } };
  delete inlineStyle.font.src;
  copy.style = inlineStyle;
  if (loaded.anchors) copy.background.anchors = loaded.anchors;
  inlineBackground(copy, dir);
  const width = copy.frame?.width ?? copy.background.width;
  const height = copy.frame?.height ?? copy.background.height;
  return { loaded, data: { scene: copy, style: inlineStyle, width, height, fontCss, bundle } };
}

const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, (c) => (c === '\u2028' ? '\\u2028' : '\\u2029'));
const safeScript = (code: string) => code.replace(/<\/script/gi, '<\\/script');

export interface PageOptions {
  mode: 'capture' | 'player';
  autoplay?: boolean;
  loop?: boolean;
  /** Extra HTML attributes for the root element (used by the HyperFrames engine). */
  rootAttrs?: string;
  /** Extra script that runs after the scene is mounted. `handle` is in scope. */
  afterMount?: string;
}

/** One self-contained HTML string. No network requests. */
export function buildPage(d: PageData, o: PageOptions): string {
  const font = d.fontCss ? `<style>${d.fontCss}</style>` : '';
  if (o.mode === 'player') {
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(d.scene.id)}</title>
<style>html,body{margin:0}body{background:#ececec;color:#222;font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}
#player{width:min(${d.width}px,calc(100vw - 32px));margin:16px}</style>${font}
</head><body><div id="player"></div>
<script>${safeScript(d.bundle)}</script>
<script>
(async () => {
  const scene = ${json(d.scene)};
  const p = await Inkmark.createPlayer(document.getElementById('player'), scene, { controls: true, keyboard: true, autoplay: ${!!o.autoplay}, loop: ${!!o.loop} });
  window.__player = p;
  window.__ready = true;
})().catch((e) => { window.__error = String(e && e.message || e); document.body.textContent = window.__error; });
</script></body></html>`;
  }
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(d.scene.id)}</title>
<style>html,body{margin:0;width:${d.width}px;height:${d.height}px;overflow:hidden}</style>${font}
</head><body><div id="root" ${o.rootAttrs ?? ''} style="width:${d.width}px;height:${d.height}px"><div id="ik"></div></div>
<script>${safeScript(d.bundle)}</script>
<script>
(async () => {
  const scene = ${json(d.scene)};
  const handle = await Inkmark.mountScene(document.getElementById('ik'), scene, { fit: 'none' });
  document.body.style.background = getComputedStyle(handle.stage).backgroundColor;
  await document.fonts.ready;
  window.__mg = handle;
  ${o.afterMount ?? ''}
  window.__ready = true;
})().catch((e) => { window.__error = String(e && e.message || e); });
</script></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
