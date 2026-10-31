import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { withCapture } from './capture.ts';
import { rel } from './load.ts';
import { parseScheme, preparePage } from './page.ts';
import { preflightSelectors } from './selectors.ts';

export async function previewCommand(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { out: { type: 'string' }, scale: { type: 'string' }, scheme: { type: 'string' } },
  });
  if (positionals.length !== 1) {
    console.error('Usage: inkmark preview <scene> [--out dir] [--scale 1] [--scheme light|dark]');
    return 1;
  }
  const scale = values.scale === undefined ? 1 : Number(values.scale);
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('--scale must be a positive number.');
  const { loaded, data } = preparePage(positionals[0]);
  data.scheme = parseScheme(values.scheme);
  await preflightSelectors(loaded, positionals[0]);
  const dir = resolve(values.out ?? join(loaded.dir, 'out'));
  mkdirSync(dir, { recursive: true });
  await withCapture(data, async (page, info) => {
    for (let i = 0; i < info.steps.length; i++) {
      await page.evaluate(`window.__mg.seekStep(${i}, 'drawEnd')`);
      // A scene with only `marks` has one step: the file is named after the scene.
      const name = loaded.scene.steps ? `${loaded.scene.id}-${info.steps[i].id}` : loaded.scene.id;
      const file = join(dir, `${name}.png`);
      await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, width: data.width, height: data.height } });
      console.log(rel(file));
    }
  }, { scale });
  return 0;
}
