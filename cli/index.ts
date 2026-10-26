import { parseArgs } from 'node:util';
import { gridCommand } from './grid.ts';
import { playCommand } from './play.ts';
import { previewCommand } from './preview.ts';
import { renderCommand } from './render.ts';
import { targetsCommand } from './targets.ts';
import { validateCommand } from './validate.ts';

const HELP = `inkmark: hand-drawn annotations over an image, page or chart.

Usage: inkmark <command> [options]

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
  --no-browser         validate: skip the selector check in the browser.
  -h, --help           Show this help.

Run "inkmark <command> --help" for the options of one command.
`;

const COMMAND_HELP: Record<string, string> = {
  targets: `Usage: inkmark targets <background-or-scene> [--json] [--width px --height px]
List elements you can point at: selectors, text and boxes for html and svg, anchors for charts.
Give a scene file to use its background size. A bare html file uses 1280x800 unless you set --width and --height.`,
  grid: `Usage: inkmark grid <image> [--step 50] [--out file]
Write <name>.grid.png next to the image, with lines every --step px and labels every 100 px.
For .svg and .html files also give --width and --height.`,
  validate: `Usage: inkmark validate <scene.json> [--no-browser]
Check a scene. One line per problem. Exit code 1 when there are errors.
For html and svg backgrounds it also checks every selector in a headless browser. --no-browser skips that.`,
  preview: `Usage: inkmark preview <scene> [--out dir] [--scale 1]
Write one PNG per step. --out sets the folder (default: "out" next to the scene). --scale sets the pixel ratio.`,
  play: `Usage: inkmark play <scene> [--out file.html] [--autoplay] [--loop]
Write one self-contained HTML player.`,
  render: `Usage: inkmark render <scene> [--out file.mp4] [--fps 30] [--lead 0.4] [--engine builtin|hyperframes]
Write an MP4. Needs ffmpeg (or set FFMPEG_PATH). --lead is seconds of the empty background at the start.`,
};

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  if (!command || command === '-h' || command === '--help' || command === 'help') {
    console.log(HELP);
    return command ? 0 : 1;
  }
  const rest = argv.slice(1);
  if (COMMAND_HELP[command] && (rest.includes('--help') || rest.includes('-h'))) {
    console.log(COMMAND_HELP[command]);
    return 0;
  }
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
      'no-browser': { type: 'boolean' },
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
      return validateCommand(positionals, { browser: !values['no-browser'] });
    case 'grid':
      return gridCommand(positionals, { step: num(values.step, 'step') ?? 50, out: values.out, width, height });
    case 'targets':
      return targetsCommand(positionals, { json: values.json, width, height });
    default:
      console.error(`Unknown command "${command}". Run "inkmark --help".`);
      return 1;
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e) => {
    let msg = e instanceof Error ? e.message : String(e);
    if (e instanceof Error && String((e as { code?: string }).code).startsWith('ERR_PARSE_ARGS')) {
      msg = `${msg.split(/\.\s/)[0].replace(/\.$/, '')}. Run "inkmark ${process.argv[2] ?? ''} --help".`;
    }
    console.error(`Error: ${msg.split(process.cwd() + '/').join('')}`);
    process.exitCode = 1;
  },
);
