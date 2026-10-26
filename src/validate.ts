import type { Box, Issue, Point, Style, StyleInput, ValidationResult } from './types.ts';
import { resolveStyle } from './styles/index.ts';

export interface ValidateOptions {
  styles?: Record<string, StyleInput>;
  anchors?: Record<string, Point | Box>;
}

type Obj = Record<string, unknown>;

const MARK_TYPES = ['circle', 'box', 'underline', 'highlight', 'strike', 'bracket', 'arrow', 'label', 'scribble'];
const SIDES = ['top', 'right', 'bottom', 'left'];
const BASE_FIELDS = ['id', 'type', 'with', 'duration', 'delay', 'color', 'seed'];
const EXTRA_FIELDS: Record<string, string[]> = {
  circle: ['target', 'pad', 'loops'],
  box: ['target', 'pad'],
  underline: ['target', 'offset', 'double'],
  highlight: ['target', 'opacity'],
  strike: ['target', 'crossed'],
  bracket: ['target', 'sides', 'pad'],
  arrow: ['from', 'to', 'bend', 'head'],
  label: ['text', 'at', 'side', 'maxWidth', 'size'],
  scribble: ['points', 'thickness'],
};

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPos = (v: unknown): v is number => isNum(v) && v > 0;
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function validate(scene: unknown, options: ValidateOptions = {}): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const err = (path: string, message: string) => errors.push({ path, message });
  const warn = (path: string, message: string) => warnings.push({ path, message });

  if (!isObj(scene)) {
    err('$', 'The scene must be a JSON object. Wrap it in { }.');
    return { ok: false, errors, warnings };
  }

  if (scene.marginalia !== '1.0') err('marginalia', 'Field "marginalia" must be the text "1.0". Set it to "1.0".');
  if (!isStr(scene.id)) err('id', 'Field "id" must be a non-empty text. Add a short id such as "my-scene".');

  // Background
  let bgW = 0;
  let bgH = 0;
  let bgType = '';
  let anchors: Record<string, unknown> | undefined = options.anchors;
  let anchorsUnchecked = false;
  const bg = scene.background;
  if (!isObj(bg)) {
    err('background', 'Field "background" is missing. Add { "type", "src", "width", "height" }.');
  } else {
    if (bg.type === 'image' || bg.type === 'html' || bg.type === 'svg') bgType = bg.type;
    else err('background.type', 'Background "type" must be "image", "html" or "svg". Change it to one of these.');
    if (isPos(bg.width)) bgW = bg.width;
    else err('background.width', 'Background "width" must be a positive number in pixels. Set the real width.');
    if (isPos(bg.height)) bgH = bg.height;
    else err('background.height', 'Background "height" must be a positive number in pixels. Set the real height.');
    if (!isStr(bg.src) && !isStr(bg.content)) {
      err('background', 'Background needs "src" (a path or URL) or "content" (inline markup). Add one of them.');
    }
    if (isObj(bg.anchors)) anchors = { ...bg.anchors, ...options.anchors };
    else if (typeof bg.anchors === 'string') {
      if (!options.anchors) anchorsUnchecked = true;
    } else if (bg.anchors !== undefined) {
      err('background.anchors', 'Background "anchors" must be an object or a path to a JSON file. Fix the value.');
    }
  }

  // Frame
  if (scene.frame !== undefined) {
    if (!isObj(scene.frame)) err('frame', 'Field "frame" must be an object { "width", "height" }. Fix the value.');
    else {
      if (!isPos(scene.frame.width)) err('frame.width', 'Frame "width" must be a positive number. Set a size such as 1080.');
      if (!isPos(scene.frame.height)) err('frame.height', 'Frame "height" must be a positive number. Set a size such as 1920.');
      if (scene.frame.fit !== undefined && scene.frame.fit !== 'contain' && scene.frame.fit !== 'cover') {
        err('frame.fit', 'Frame "fit" must be "contain" or "cover". Change it.');
      }
    }
  }

  // Style
  let style: Style | undefined;
  try {
    style = resolveStyle(scene.style as string | StyleInput | undefined, options.styles);
  } catch (e) {
    const text = e instanceof Error ? e.message.replace(/\s+/g, ' ') : String(e);
    err('style', `Style does not resolve: ${text}`);
  }
  const tokens = style ? Object.keys(style.colors) : [];

  // Steps
  if (!Array.isArray(scene.steps) || scene.steps.length === 0) {
    err('steps', 'Field "steps" must be a list with at least one step. Add a step with marks.');
    return { ok: errors.length === 0, errors, warnings };
  }

  const hasAnchorMap = anchors !== undefined;
  const stepIds = new Set<string>();
  const markIds = new Map<string, { type: string; step: number }>();
  const colorsUsed = new Set<string>();
  let warnedAnchors = false;

  const checkNums = (path: string, arr: unknown, n: number): arr is number[] => {
    if (!Array.isArray(arr) || arr.length !== n || !arr.every(isNum)) {
      err(path, `Must be a list of ${n} finite numbers. Fix the values.`);
      return false;
    }
    return true;
  };

  const checkTarget = (path: string, t: unknown, ownId: string) => {
    if (!isObj(t)) {
      err(path, 'Target must be an object with one of: box, point, selector, anchor, mark. Add one.');
      return;
    }
    const keys = ['box', 'point', 'selector', 'anchor', 'mark'].filter((k) => t[k] !== undefined);
    if (keys.length !== 1) {
      err(path, 'Target must have exactly one of: box, point, selector, anchor, mark. Remove the others.');
      return;
    }
    const key = keys[0];
    if (key === 'box') {
      if (!checkNums(`${path}.box`, t.box, 4)) return;
      const [x, y, w, h] = t.box as number[];
      if (w <= 0 || h <= 0) err(`${path}.box`, 'Box width and height must be above 0. Fix the size.');
      else if (bgW && bgH && (x < 0 || y < 0 || x + w > bgW || y + h > bgH)) {
        err(`${path}.box`, `Box is outside the background (0..${bgW}, 0..${bgH}). Move it inside.`);
      }
      if (hasAnchorMap) warn(`${path}.box`, 'An anchor map exists. Use { "anchor": "name" } instead of a box for exact placement.');
    } else if (key === 'point') {
      if (!checkNums(`${path}.point`, t.point, 2)) return;
      const [x, y] = t.point as number[];
      if (bgW && bgH && (x < 0 || y < 0 || x > bgW || y > bgH)) {
        err(`${path}.point`, `Point is outside the background (0..${bgW}, 0..${bgH}). Move it inside.`);
      }
      if (hasAnchorMap) warn(`${path}.point`, 'An anchor map exists. Use { "anchor": "name" } instead of a point for exact placement.');
    } else if (key === 'selector') {
      if (!isStr(t.selector)) err(`${path}.selector`, 'Selector must be a non-empty CSS selector text. Fix the value.');
      else if (bgType === 'image') err(`${path}.selector`, 'Selector works only on html or svg backgrounds. Use box or point for an image.');
    } else if (key === 'anchor') {
      if (!isStr(t.anchor)) err(`${path}.anchor`, 'Anchor must be a name text. Fix the value.');
      else if (anchors) {
        if (!(t.anchor in anchors)) {
          err(`${path}.anchor`, `Anchor "${t.anchor}" is not in the anchor map. Use one of: ${Object.keys(anchors).slice(0, 8).join(', ') || '(none)'}.`);
        }
      } else if (anchorsUnchecked) {
        if (!warnedAnchors) {
          warnedAnchors = true;
          warn(`${path}.anchor`, 'Anchors are in a file and could not be checked here. Run the CLI validate command to check them.');
        }
      } else {
        err(`${path}.anchor`, 'Anchor target needs an anchor map. Add "background.anchors" with this name.');
      }
    } else if (key === 'mark') {
      if (!isStr(t.mark)) {
        err(`${path}.mark`, 'Mark reference must be a mark id text. Fix the value.');
        return;
      }
      const ref = markIds.get(t.mark);
      if (t.mark === ownId) err(`${path}.mark`, 'A mark cannot target itself. Point to an earlier mark.');
      else if (!ref) err(`${path}.mark`, `Mark "${t.mark}" does not exist before this mark. Point to a mark that comes earlier in the scene.`);
      if (t.end !== undefined) {
        if (t.end !== 'start' && t.end !== 'end') err(`${path}.end`, '"end" must be "start" or "end". Fix the value.');
        else if (ref && ref.type !== 'arrow') err(`${path}.end`, `"end" works only when the target mark is an arrow, but "${t.mark}" is a ${ref.type}. Remove "end".`);
      }
    }
  };

  const effectiveColor = (m: Obj): string | undefined => {
    if (isStr(m.color)) return m.color;
    if (!style) return undefined;
    if (m.type === 'highlight') return style.defaults.highlight;
    if (m.type === 'label') return style.defaults.label;
    return style.defaults.stroke;
  };

  (scene.steps as unknown[]).forEach((step, si) => {
    const sp = `steps[${si}]`;
    if (!isObj(step)) {
      err(sp, 'Step must be an object { "id", "marks" }. Fix the value.');
      return;
    }
    if (!isStr(step.id)) err(`${sp}.id`, 'Step "id" must be a non-empty text. Add a unique id.');
    else if (stepIds.has(step.id) || markIds.has(step.id)) err(`${sp}.id`, `Id "${step.id}" is used twice. Make every step and mark id unique.`);
    else stepIds.add(step.id);
    for (const k of ['hold'] as const) {
      if (step[k] !== undefined && !(isNum(step[k]) && (step[k] as number) >= 0)) err(`${sp}.${k}`, `Step "${k}" must be a number of seconds, 0 or more. Fix the value.`);
    }
    if (!Array.isArray(step.marks) || step.marks.length === 0) {
      err(`${sp}.marks`, 'Step "marks" must be a list with at least one mark. Add a mark.');
      return;
    }
    if (step.marks.length > 3) warn(`${sp}.marks`, `Step has ${step.marks.length} marks. Use 3 or fewer so a viewer can follow. Split it into more steps.`);

    const stepMarkIds = new Set<string>();
    step.marks.forEach((mark: unknown, mi: number) => {
      const mp = `${sp}.marks[${mi}]`;
      if (!isObj(mark)) {
        err(mp, 'Mark must be an object with "id" and "type". Fix the value.');
        return;
      }
      const type = mark.type;
      const knownType = typeof type === 'string' && MARK_TYPES.includes(type);
      if (!knownType) err(`${mp}.type`, `Unknown mark type. Use one of: ${MARK_TYPES.join(', ')}.`);
      let id = '';
      if (!isStr(mark.id)) err(`${mp}.id`, 'Mark "id" must be a non-empty text. Add a unique id.');
      else if (stepIds.has(mark.id) || markIds.has(mark.id)) err(`${mp}.id`, `Id "${mark.id}" is used twice. Make every step and mark id unique.`);
      else id = mark.id;

      if (mark.with !== undefined) {
        if (!isStr(mark.with)) err(`${mp}.with`, '"with" must be a mark id text. Fix the value.');
        else if (!stepMarkIds.has(mark.with)) err(`${mp}.with`, `"with" must point to an earlier mark in the same step, but "${mark.with}" is not one. Fix the id or the order.`);
      }
      for (const k of ['duration', 'delay'] as const) {
        if (mark[k] !== undefined && !(isNum(mark[k]) && (mark[k] as number) >= 0)) err(`${mp}.${k}`, `"${k}" must be a number of seconds, 0 or more. Fix the value.`);
      }
      if (mark.seed !== undefined && !isNum(mark.seed)) err(`${mp}.seed`, '"seed" must be a finite number. Fix the value.');
      for (const k of ['pad', 'offset', 'bend', 'head', 'opacity', 'maxWidth', 'size', 'thickness'] as const) {
        if (mark[k] !== undefined && !isNum(mark[k])) err(`${mp}.${k}`, `"${k}" must be a finite number. Fix the value.`);
      }

      if (mark.color !== undefined) {
        if (!isStr(mark.color)) err(`${mp}.color`, '"color" must be a style color token name. Fix the value.');
        else if (/^#|^rgb|^hsl/i.test(mark.color)) {
          err(`${mp}.color`, `"${mark.color}" is a color value. Use a token name instead and add the color to the style "colors".`);
        } else if (style && !tokens.includes(mark.color)) {
          err(`${mp}.color`, `"${mark.color}" is not a color token of the style. Use one of: ${tokens.join(', ')}.`);
        }
      }
      if (style) {
        const c = effectiveColor(mark);
        if (c) colorsUsed.add(c);
      }

      if (knownType) {
        const t = type as string;
        const allowed = [...BASE_FIELDS, ...EXTRA_FIELDS[t]];
        for (const k of Object.keys(mark)) {
          if (!allowed.includes(k)) warn(`${mp}.${k}`, `Unknown field "${k}" on a ${t} mark. It is ignored. Remove it or fix the spelling.`);
        }
        if (t === 'arrow') {
          checkTarget(`${mp}.from`, mark.from, id);
          checkTarget(`${mp}.to`, mark.to, id);
        } else if (t === 'label') {
          if (!isStr(mark.text)) err(`${mp}.text`, 'Label "text" must be a non-empty text. Add the words.');
          else if (mark.text.length > 40) warn(`${mp}.text`, `Label has ${mark.text.length} characters. Use 40 or fewer. Shorten it.`);
          checkTarget(`${mp}.at`, mark.at, id);
          if (mark.side !== undefined && mark.side !== 'auto' && !SIDES.includes(mark.side as string)) err(`${mp}.side`, '"side" must be top, right, bottom, left or auto. Fix the value.');
        } else if (t === 'scribble') {
          const pts = mark.points;
          if (!Array.isArray(pts) || pts.length < 2) err(`${mp}.points`, 'Scribble needs 2 or more points. Add points as [x, y] pairs.');
          else {
            pts.forEach((p: unknown, pi: number) => {
              if (!checkNums(`${mp}.points[${pi}]`, p, 2)) return;
              const [x, y] = p as number[];
              if (bgW && bgH && (x < 0 || y < 0 || x > bgW || y > bgH)) err(`${mp}.points[${pi}]`, `Point is outside the background (0..${bgW}, 0..${bgH}). Move it inside.`);
            });
          }
        } else {
          checkTarget(`${mp}.target`, mark.target, id);
          if (t === 'bracket' && mark.sides !== undefined) {
            if (!Array.isArray(mark.sides) || !mark.sides.every((s: unknown) => SIDES.includes(s as string))) err(`${mp}.sides`, '"sides" must be a list of top, right, bottom, left. Fix the value.');
          }
          if (t === 'circle' && mark.loops !== undefined && mark.loops !== 1 && mark.loops !== 2) err(`${mp}.loops`, '"loops" must be 1 or 2. Fix the value.');
        }
      }

      if (id) {
        markIds.set(id, { type: knownType ? (type as string) : '', step: si });
        stepMarkIds.add(id);
      }
    });
  });

  if (colorsUsed.size > 2) {
    warn('steps', `The scene uses ${colorsUsed.size} annotation colors (${[...colorsUsed].join(', ')}). Use 2 or fewer for a calm look.`);
  }

  return { ok: errors.length === 0, errors, warnings };
}
