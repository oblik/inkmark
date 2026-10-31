import { pathToFileURL } from 'node:url';
import type { Issue } from '../src/types.ts';
import { withPage } from './browser.ts';
import { isUrl, rel, resolveFrom } from './load.ts';
import type { LoadedScene } from './load.ts';

interface Found {
  path: string;
  selector: string;
}

function collect(scene: unknown): Found[] {
  const out: Found[] = [];
  const sc = scene as { steps?: unknown; marks?: unknown } | null;
  const short = !Array.isArray(sc?.steps) && Array.isArray(sc?.marks);
  const steps = short ? [{ marks: sc!.marks }] : sc?.steps;
  if (!Array.isArray(steps)) return out;
  const visit = (path: string, t: unknown) => {
    if (t && typeof t === 'object' && typeof (t as { selector?: unknown }).selector === 'string') {
      out.push({ path: `${path}.selector`, selector: (t as { selector: string }).selector });
    }
  };
  steps.forEach((step, si) => {
    const marks = (step as { marks?: unknown })?.marks;
    if (!Array.isArray(marks)) return;
    marks.forEach((m, mi) => {
      const p = short ? `marks[${mi}]` : `steps[${si}].marks[${mi}]`;
      for (const k of ['target', 'from', 'to', 'at']) visit(`${p}.${k}`, (m as Record<string, unknown>)?.[k]);
    });
  });
  return out;
}

/**
 * Opens the background in a headless browser and checks every selector in the scene.
 * Returns errors. Returns a warning-like error list of length 0 when there is nothing to check.
 * Throws when the browser cannot start.
 */
export async function checkSelectors(loaded: LoadedScene, scenePath: string): Promise<Issue[]> {
  const bg = loaded.scene?.background;
  if (!bg || (bg.type !== 'html' && bg.type !== 'svg')) return [];
  const found = collect(loaded.scene);
  if (!found.length) return [];
  const w = Number(bg.width);
  const h = Number(bg.height);
  if (!(w > 0) || !(h > 0)) return [];
  const url = bg.src ? (isUrl(bg.src) ? bg.src : pathToFileURL(resolveFrom(loaded.dir, bg.src)).href) : undefined;
  if (!url && typeof bg.content !== 'string') return [];

  const unique = [...new Set(found.map((f) => f.selector))];
  const counts = await withPage(w, h, async (page) => {
    if (url) await page.goto(url);
    else await page.setContent(bg.content!);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    return page.evaluate((list) => {
      const res: Record<string, number> = {};
      for (const s of list) {
        try {
          res[s] = document.querySelectorAll(s).length;
        } catch {
          res[s] = -1;
        }
      }
      return res;
    }, unique);
  });

  const errors: Issue[] = [];
  for (const f of found) {
    const n = counts[f.selector];
    if (n === -1) {
      errors.push({ path: f.path, message: `Selector "${f.selector}" is not valid CSS. Fix it, or run "inkmark targets ${rel(scenePath)}" to list selectors.` });
    } else if (n === 0) {
      errors.push({ path: f.path, message: `Selector "${f.selector}" matches no element. Run "inkmark targets ${rel(scenePath)}" to list selectors.` });
    }
  }
  return errors;
}

/** Used by preview, play and render. Throws the first problem as a one-line error. */
export async function preflightSelectors(loaded: LoadedScene, scenePath: string): Promise<void> {
  let errors: Issue[];
  try {
    errors = await checkSelectors(loaded, scenePath);
  } catch {
    return; // no browser here: the capture step reports it
  }
  if (errors.length) throw new Error(`${errors[0].path}: ${errors[0].message}`);
}
