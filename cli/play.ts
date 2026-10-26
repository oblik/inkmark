import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { rel } from './load.ts';
import { buildPage, parseScheme, preparePage } from './page.ts';
import { preflightSelectors } from './selectors.ts';

export async function playCommand(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { out: { type: 'string' }, autoplay: { type: 'boolean' }, loop: { type: 'boolean' }, scheme: { type: 'string' } },
  });
  if (positionals.length !== 1) {
    console.error('Usage: inkmark play <scene> [--out file.html] [--autoplay] [--loop] [--scheme light|dark]');
    return 1;
  }
  const { loaded, data } = preparePage(positionals[0]);
  data.scheme = parseScheme(values.scheme);
  await preflightSelectors(loaded, positionals[0]);
  const out = resolve(values.out ?? join(loaded.dir, `${loaded.scene.id}.html`));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buildPage(data, { mode: 'player', autoplay: values.autoplay, loop: values.loop }));
  console.log(rel(out));
  return 0;
}
