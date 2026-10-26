import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { withPage } from './browser.ts';
import { isUrl, loadScene, resolveFrom } from './load.ts';

export interface TargetsOptions {
  json?: boolean;
  width?: number;
  height?: number;
}

interface Row {
  selector: string;
  text: string;
  box: [number, number, number, number];
}

// Runs inside the page. Keep it free of outside references.
function collect(): { rows: Row[] } {
  const rows: Row[] = [];
  const esc = (s: string) => CSS.escape(s);
  const unique = (sel: string) => {
    try {
      return document.querySelectorAll(sel).length === 1;
    } catch {
      return false;
    }
  };
  const cssFor = (el: Element): string => {
    if (el.id && unique(`#${esc(el.id)}`)) return `#${esc(el.id)}`;
    const tag = el.tagName.toLowerCase();
    for (const a of Array.from(el.attributes)) {
      if (a.name.startsWith('data-') && a.value) {
        const s = `[${a.name}="${a.value.replace(/"/g, '\\"')}"]`;
        if (unique(s)) return s;
        if (unique(tag + s)) return tag + s;
      }
    }
    if (unique(tag)) return tag;
    const classes = Array.from(el.classList).slice(0, 2);
    for (let n = 1; n <= classes.length; n++) {
      const s = tag + classes.slice(0, n).map((c) => `.${esc(c)}`).join('');
      if (unique(s)) return s;
    }
    const part = (e: Element) => {
      const t = e.tagName.toLowerCase();
      const same = e.parentElement ? Array.from(e.parentElement.children).filter((c) => c.tagName === e.tagName) : [e];
      return same.length > 1 ? `${t}:nth-of-type(${same.indexOf(e) + 1})` : t;
    };
    const parts: string[] = [];
    let cur: Element | null = el;
    while (cur && cur !== document.documentElement) {
      if (cur.id && unique(`#${esc(cur.id)}`)) {
        parts.unshift(`#${esc(cur.id)}`);
        break;
      }
      parts.unshift(part(cur));
      const sel = parts.join(' > ');
      if (unique(sel)) return sel;
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  };

  const meaningful = 'h1,h2,h3,h4,h5,h6,p,li,button,a[href],input,select,textarea,img,label,summary,[role=button],[id],text,svg *[id]';
  const seen = new Set<Element>();
  const all = Array.from(document.querySelectorAll('*')).filter((el) => {
    if (el.matches(meaningful)) return true;
    return Array.from(el.attributes).some((a) => a.name.startsWith('data-'));
  });
  for (const el of all) {
    if (seen.has(el)) continue;
    seen.add(el);
    const tag = el.tagName.toLowerCase();
    if (['html', 'head', 'body', 'script', 'style', 'meta', 'link', 'title', 'defs', 'svg'].includes(tag) && !el.id) continue;
    if (tag === 'html' || tag === 'head' || tag === 'script' || tag === 'style' || tag === 'meta' || tag === 'link' || tag === 'title' || tag === 'defs') continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const box: Row['box'] = [Math.round(r.left + scrollX), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)];
    let text = (el as HTMLElement).innerText ?? el.textContent ?? '';
    if (!text && el instanceof HTMLInputElement) text = el.value || el.placeholder || '';
    if (!text && el instanceof HTMLImageElement) text = el.alt || '';
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length > 40) text = `${text.slice(0, 39)}…`;
    rows.push({ selector: cssFor(el), text, box });
  }
  rows.sort((a, b) => a.box[1] - b.box[1] || a.box[0] - b.box[0]);
  return { rows };
}

function svgSize(text: string): [number, number] {
  const num = (name: string) => {
    const m = new RegExp(`<svg[^>]*\\s${name}="([\\d.]+)(?:px)?"`, 'i').exec(text);
    return m ? Number(m[1]) : 0;
  };
  let w = num('width');
  let h = num('height');
  if (!w || !h) {
    const vb = /viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/i.exec(text);
    if (vb) {
      w = Number(vb[1]);
      h = Number(vb[2]);
    }
  }
  return [w || 800, h || 600];
}

const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));

export async function targetsCommand(positionals: string[], opts: TargetsOptions): Promise<number> {
  const input = positionals[0];
  if (!input) throw new Error('Usage: marginalia targets <background-or-scene> [--json] [--width --height]');

  let type: string;
  let url: string | undefined;
  let content: string | undefined;
  let width = opts.width;
  let height = opts.height;
  let anchors: Record<string, unknown> | undefined;
  let imageHint = '';

  if (extname(input).toLowerCase() === '.json') {
    const loaded = loadScene(input);
    const bg = loaded.scene.background;
    if (!bg) throw new Error('The scene has no background.');
    type = bg.type;
    width ??= bg.width;
    height ??= bg.height;
    anchors = loaded.anchors;
    if (bg.src) url = isUrl(bg.src) ? bg.src : pathToFileURL(resolveFrom(loaded.dir, bg.src)).href;
    else content = bg.content;
    imageHint = bg.src ?? '';
  } else {
    const ext = extname(input).toLowerCase();
    type = ext === '.svg' ? 'svg' : ext === '.html' || ext === '.htm' ? 'html' : 'image';
    url = pathToFileURL(resolve(input)).href;
    imageHint = input;
  }

  if (type === 'image') {
    console.log(`Image background: no elements to list. Run: marginalia grid ${imageHint || '<image>'}`);
    if (anchors) printAnchors(anchors, opts.json);
    return 0;
  }

  if (!width || !height) {
    if (type === 'svg') {
      const text = content ?? (url?.startsWith('file:') ? readFileSync(new URL(url), 'utf8') : '');
      [width, height] = text ? svgSize(text) : [800, 600];
    } else {
      width = 1280;
      height = 800;
    }
  }

  const rows = await withPage(width, height, async (page) => {
    if (url) await page.goto(url);
    else await page.setContent(content ?? '');
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    return (await page.evaluate(collect)).rows;
  });

  if (opts.json) {
    console.log(JSON.stringify({ width, height, targets: rows, ...(anchors ? { anchors } : {}) }, null, 2));
    return 0;
  }

  console.log(`${type} ${width}x${height}, ${rows.length} targets`);
  const sw = Math.min(48, Math.max(8, ...rows.map((r) => r.selector.length)));
  const bw = Math.max(3, ...rows.map((r) => `[${r.box.join(', ')}]`.length));
  console.log(`${pad('selector', sw)}  ${pad('box [x, y, w, h]', bw)}  text`);
  for (const r of rows) console.log(`${pad(r.selector, sw)}  ${pad(`[${r.box.join(', ')}]`, bw)}  ${r.text}`);
  if (anchors) printAnchors(anchors, false);
  return 0;
}

function printAnchors(anchors: Record<string, unknown>, json?: boolean) {
  if (json) {
    console.log(JSON.stringify({ anchors }, null, 2));
    return;
  }
  console.log('\nanchors');
  const w = Math.max(...Object.keys(anchors).map((k) => k.length), 4);
  for (const [k, v] of Object.entries(anchors)) console.log(`${pad(k, w)}  [${(v as number[]).join(', ')}]`);
}
