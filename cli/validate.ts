import { existsSync } from 'node:fs';
import { validate } from '../src/validate.ts';
import type { Issue } from '../src/types.ts';
import { isUrl, loadScene, resolveFrom } from './load.ts';

export async function validateCommand(positionals: string[]): Promise<number> {
  const path = positionals[0];
  if (!path) throw new Error('Usage: marginalia validate <scene.json>');
  const loaded = loadScene(path);
  const result = validate(loaded.scene, { styles: loaded.styles, anchors: loaded.anchors });
  const errors: Issue[] = [...loaded.problems, ...result.errors];
  // Remove the "could not be checked" warning when the CLI did check the anchors.
  const warnings = result.warnings.filter((w) => !(loaded.anchors && /could not be checked/.test(w.message)));

  const src = loaded.scene?.background?.src;
  if (typeof src === 'string' && !isUrl(src) && !existsSync(resolveFrom(loaded.dir, src))) {
    errors.push({ path: 'background.src', message: `File "${src}" does not exist next to the scene. Fix the path.` });
  }

  for (const e of errors) console.log(`error   ${e.path}: ${e.message}`);
  for (const w of warnings) console.log(`warning ${w.path}: ${w.message}`);
  if (errors.length === 0) console.log(`OK: scene "${loaded.scene.id}" is valid (${warnings.length} warning${warnings.length === 1 ? '' : 's'}).`);
  return errors.length ? 1 : 0;
}
