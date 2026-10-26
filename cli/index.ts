import { parseArgs } from 'node:util';
import { gridCommand } from './grid.ts';
import { playCommand } from './play.ts';
import { previewCommand } from './preview.ts';
import { renderCommand } from './render.ts';
import { targetsCommand } from './targets.ts';
import { validateCommand } from './validate.ts';

const HELP = `marginalia: hand-drawn annotations over an image, page or chart.

Usage: marginalia <command> [options]

Commands:
  targets <bg|scene>   List elements (html, svg) or anchors you can point at.
  grid <image>         Write <name>.grid.png with a labeled pixel grid.
  validate <scene>     Check a scene. Exit code 1 when there are errors.
  preview <scene>      Write one PNG per step.
  play <scene>         Write a self-contained HTML player.
  render <scene>       Write an MP4.

Options:
  --step <px>          grid: line spacing. Default 50.
  --out <file>         grid: output file.
  --width <px>         grid, targets: page width for html and svg.
  --height <px>        grid, targets: page height for html and svg.
  --json               targets: print JSON.
  -h, --help           Show this help.
`;

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  if (!command || command === '-h' || command === '--help' || command === 'help') {
    console.log(HELP);
    return command ? 0 : 1;
  }
  const rest = argv.slice(1);
  if (['preview', 'play', 'render'].includes(command)) {
    if (command === 'preview') return previewCommand(rest);
    if (command === 'play') return playCommand(rest);
    return renderCommand(rest);
  }
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      step: { type: 'string' },
      out: { type: 'string' },
      width: { type: 'string' },
      height: { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(HELP);
    return 0;
  }
  const num = (v: string | undefined, name: string) => {
    if (v === undefined) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`--${name} must be a positive number.`);
    return n;
  };
  const width = num(values.width, 'width');
  const height = num(values.height, 'height');
  switch (command) {
    case 'validate':
      return validateCommand(positionals);
    case 'grid':
      return gridCommand(positionals, { step: num(values.step, 'step') ?? 50, out: values.out, width, height });
    case 'targets':
      return targetsCommand(positionals, { json: values.json, width, height });
    default:
      console.error(`Unknown command "${command}". Run "marginalia --help".`);
      return 1;
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e) => {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  },
);
