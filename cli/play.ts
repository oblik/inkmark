import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildPage, preparePage } from './page.ts';

export async function playCommand(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { out: { type: 'string' }, autoplay: { type: 'boolean' }, loop: { type: 'boolean' } },
  });
  if (positionals.length !== 1) {
    console.error('Usage: marginalia play <scene> [--out file.html] [--autoplay] [--loop]');
    return 1;
  }
  const { loaded, data } = preparePage(positionals[0]);
  const out = resolve(values.out ?? join(loaded.dir, `${loaded.scene.id}.html`));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buildPage(data, { mode: 'player', autoplay: values.autoplay, loop: values.loop }));
  console.log(out);
  return 0;
}
