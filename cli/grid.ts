import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rel } from './load.ts';
import { withPage } from './browser.ts';

export interface GridOptions {
  step: number;
  out?: string;
  width?: number;
  height?: number;
}

/** Draws the grid on a canvas laid over the image, then screenshots the page. */
export async function gridCommand(positionals: string[], opts: GridOptions): Promise<number> {
  const input = positionals[0];
  if (!input) throw new Error('Usage: inkmark grid <image> [--step 50] [--out file]');
  const file = resolve(input);
  if (!existsSync(file)) throw new Error(`Cannot read image "${rel(file)}". Check the path.`);
  const ext = extname(file).toLowerCase();
  const step = opts.step;
  if (!Number.isFinite(step) || step < 5) throw new Error('--step must be a number of 5 or more.');
  const out = opts.out ? resolve(opts.out) : join(dirname(file), `${basename(file, extname(file))}.grid.png`);

  let dataUrl: string;
  let width: number;
  let height: number;

  if (ext === '.svg' || ext === '.html' || ext === '.htm') {
    width = opts.width ?? 1280;
    height = opts.height ?? 800;
    const shot = await withPage(width, height, async (page) => {
      await page.goto(pathToFileURL(file).href);
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      return page.screenshot();
    });
    dataUrl = `data:image/png;base64,${shot.toString('base64')}`;
  } else {
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/png';
    dataUrl = `data:${mime};base64,${readFileSync(file).toString('base64')}`;
    width = 0;
    height = 0;
  }

  const png = await withPage(width || 800, height || 600, async (page) => {
    await page.setContent('<!doctype html><body style="margin:0"><div id="r" style="position:relative;display:inline-block"><img id="i"><canvas id="c" style="position:absolute;left:0;top:0"></canvas></div></body>');
    const size = await page.evaluate(
      ([url, stepPx]) =>
        new Promise<{ w: number; h: number }>((done, fail) => {
          const img = document.getElementById('i') as HTMLImageElement;
          img.onerror = () => fail(new Error('Cannot load the image.'));
          img.onload = () => {
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            img.style.display = 'block';
            const canvas = document.getElementById('c') as HTMLCanvasElement;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            const major = 100;
            // Thin lines. A light line plus a dark line keeps the grid visible on any image.
            const line = (pos: number, vertical: boolean, color: string, lw: number) => {
              ctx.strokeStyle = color;
              ctx.lineWidth = lw;
              ctx.beginPath();
              const p = pos + 0.5;
              if (vertical) {
                ctx.moveTo(p, 0);
                ctx.lineTo(p, h);
              } else {
                ctx.moveTo(0, p);
                ctx.lineTo(w, p);
              }
              ctx.stroke();
            };
            for (let v = 0; v <= 1; v++) {
              const vertical = v === 0;
              const max = vertical ? w : h;
              for (let p = 0; p <= max; p += stepPx) {
                const isMajor = p % major === 0;
                if (isMajor) {
                  line(p, vertical, 'rgba(255,255,255,0.7)', 3);
                  line(p, vertical, 'rgba(200,30,60,0.85)', 1);
                } else {
                  line(p, vertical, 'rgba(255,255,255,0.35)', 2);
                  line(p, vertical, 'rgba(60,60,60,0.35)', 1);
                }
              }
            }
            const fontPx = Math.max(11, Math.round(Math.min(w, h) / 70));
            ctx.font = `600 ${fontPx}px ui-monospace, Menlo, monospace`;
            ctx.textBaseline = 'top';
            const tag = (text: string, x: number, y: number) => {
              const pad = 2;
              const tw = ctx.measureText(text).width;
              const bx = Math.min(Math.max(0, x), w - tw - pad * 2);
              const by = Math.min(Math.max(0, y), h - fontPx - pad * 2);
              ctx.fillStyle = 'rgba(255,255,255,0.92)';
              ctx.fillRect(bx, by, tw + pad * 2, fontPx + pad * 2);
              ctx.strokeStyle = 'rgba(200,30,60,0.9)';
              ctx.lineWidth = 1;
              ctx.strokeRect(bx + 0.5, by + 0.5, tw + pad * 2 - 1, fontPx + pad * 2 - 1);
              ctx.fillStyle = '#111';
              ctx.fillText(text, bx + pad, by + pad);
            };
            for (let x = 0; x <= w; x += major) {
              tag(String(x), x + 2, 2);
              tag(String(x), x + 2, h - fontPx - 6);
            }
            for (let y = 0; y <= h; y += major) {
              tag(String(y), 2, y + 2);
              tag(String(y), w - 40, y + 2);
            }
            // Cross labels inside the image, so the middle is easy to read too.
            const cross = major * 5;
            for (let x = cross; x < w; x += cross) {
              for (let y = cross; y < h; y += cross) tag(`${x},${y}`, x + 3, y + 3);
            }
            done({ w, h });
          };
          img.src = url;
        }),
      [dataUrl, step] as [string, number],
    );
    await page.setViewportSize({ width: size.w, height: size.h });
    return page.screenshot({ clip: { x: 0, y: 0, width: size.w, height: size.h } });
  });

  writeFileSync(out, png);
  console.log(rel(out));
  return 0;
}
