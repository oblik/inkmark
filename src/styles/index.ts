import type { Style, StyleInput } from '../types.ts';
import marker from './marker.json' with { type: 'json' };
import sketch from './sketch.json' with { type: 'json' };

export const builtInStyles: Record<string, StyleInput> = {
  marker: marker as StyleInput,
  sketch: sketch as StyleInput,
};

export const DEFAULT_STYLE = 'marker';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function merge<T>(base: T, patch: unknown): T {
  if (!isObject(base) || !isObject(patch)) return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'extends' || value === undefined) continue;
    out[key] = merge(out[key], value);
  }
  return out as T;
}

/**
 * Turns a style name or a partial style into a full style.
 * `registry` adds project styles next to the built-in ones.
 * Throws when a name is unknown or `extends` makes a loop.
 */
export function resolveStyle(
  input: string | StyleInput | undefined,
  registry: Record<string, StyleInput> = {},
): Style {
  const all = { ...builtInStyles, ...registry };
  const seen = new Set<string>();

  function build(item: string | StyleInput): Style {
    let source: StyleInput;
    if (typeof item === 'string') {
      if (seen.has(item)) throw new Error(`Style "${item}" extends itself.`);
      seen.add(item);
      const found = all[item];
      if (!found) throw new Error(`Unknown style "${item}". Use one of: ${Object.keys(all).join(', ')}.`);
      source = found;
    } else {
      source = item;
    }
    const baseName = source.extends ?? (source === all[DEFAULT_STYLE] ? undefined : DEFAULT_STYLE);
    const base = baseName ? build(baseName) : ({} as Style);
    return merge(base, source);
  }

  return build(input ?? DEFAULT_STYLE);
}
