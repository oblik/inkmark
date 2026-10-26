import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import type { Box, Issue, Point, Scene, StyleInput } from '../src/types.ts';
import { builtInStyles } from '../src/styles/index.ts';

export interface LoadedScene {
  scene: Scene;
  /** Absolute path of the scene file. */
  file: string;
  /** Folder of the scene file. Relative paths in the scene start here. */
  dir: string;
  /** Anchors from the inline map or the anchors file. Undefined when there are none. */
  anchors?: Record<string, Point | Box>;
  /** Project styles by the name used in the scene (built-in styles are not listed). */
  styles: Record<string, StyleInput>;
  /** Problems found while loading side files (missing anchors file, bad style file). */
  problems: Issue[];
}

export const isUrl = (s: string) => /^(https?:|data:|file:)/i.test(s);

export function readJson(file: string): unknown {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new Error(`Cannot read "${file}". Check the path.`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`"${file}" is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const looksLikePath = (s: string) => s.includes('/') || s.includes('\\') || s.endsWith('.json');

/** Loads a style file and every style file it extends. Registers them under their absolute path. */
function loadStyleFile(file: string, styles: Record<string, StyleInput>, depth = 0): void {
  if (styles[file] || depth > 10) return;
  const data = readJson(file);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error(`Style file "${file}" must contain a JSON object.`);
  }
  const style = { ...(data as StyleInput) };
  if (typeof style.extends === 'string' && !(style.extends in builtInStyles) && looksLikePath(style.extends)) {
    const base = resolve(dirname(file), style.extends);
    loadStyleFile(base, styles, depth + 1);
    style.extends = base;
  }
  styles[file] = style;
}

export function loadScene(path: string): LoadedScene {
  const file = resolve(path);
  const dir = dirname(file);
  const scene = readJson(file) as Scene;
  const styles: Record<string, StyleInput> = {};
  const problems: Issue[] = [];
  let anchors: Record<string, Point | Box> | undefined;

  const bg = scene?.background;
  if (bg && typeof bg === 'object') {
    if (bg.anchors && typeof bg.anchors === 'object') anchors = bg.anchors;
    else if (typeof bg.anchors === 'string') {
      const af = resolve(dir, bg.anchors);
      try {
        const data = readJson(af) as { anchors?: Record<string, Point | Box> };
        if (data && typeof data.anchors === 'object' && data.anchors) anchors = data.anchors;
        else problems.push({ path: 'background.anchors', message: `Anchors file "${bg.anchors}" must have the form { "anchors": { ... } }. Fix the file.` });
      } catch (e) {
        problems.push({ path: 'background.anchors', message: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  if (typeof scene?.style === 'string' && !(scene.style in builtInStyles) && looksLikePath(scene.style)) {
    const sf = resolve(dir, scene.style);
    try {
      loadStyleFile(sf, styles);
      // The scene names the style by the text in the file; map that text to the loaded style.
      styles[scene.style] = { extends: sf };
    } catch (e) {
      problems.push({ path: 'style', message: e instanceof Error ? e.message : String(e) });
    }
  }

  return { scene, file, dir, anchors, styles, problems };
}

/** Resolves a path from a scene to an absolute path. URLs stay as they are. */
export function resolveFrom(dir: string, p: string): string {
  if (isUrl(p) || isAbsolute(p)) return p;
  return resolve(dir, p);
}
