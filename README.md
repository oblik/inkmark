# Inkmark

Inkmark draws hand-drawn marks (circles, arrows, labels) over an image, a web page or a chart. It plays them step by step. One JSON scene gives a web player, one PNG per step and an MP4.

## Example scene

```json
{
  "inkmark": "1.0",
  "id": "pricing",
  "background": { "type": "image", "src": "pricing.png", "width": 1280, "height": 800 },
  "steps": [
    {
      "id": "plan",
      "marks": [
        { "id": "c1", "type": "circle", "target": { "box": [100, 120, 300, 80] } },
        { "id": "l1", "type": "label", "text": "Start here", "at": { "mark": "c1" }, "side": "right" }
      ]
    }
  ]
}
```

## Install

The package is not published yet. Use it from a local clone.

```sh
npm install
npm run build   # builds the library into dist/
npm run dev     # starts the demo
```

## Quick start in the browser

```js
import { createPlayer } from 'inkmark';

const scene = await (await fetch('pricing.json')).json();
const player = await createPlayer(document.querySelector('#box'), scene, {
  baseUrl: '/scenes/',
});
```

The player shows Back, Next and Play controls. Use `controls: false`, `autoplay: true`, `loop: true` or `keyboard: false` to change this. Use `mountScene` for a paused scene without controls.

## CLI

Run commands with `node cli/index.ts <command>` or `npm run inkmark -- <command>`.

| Command | What it does |
| --- | --- |
| `targets <bg or scene>` | Lists elements (html, svg) or anchors you can point at. Use `--json` for JSON. |
| `grid <image>` | Writes a copy of the image with a labeled grid. Use `--step 50`. |
| `validate <scene>` | Checks the scene. Prints errors and warnings. Exit code 1 on errors. |
| `preview <scene>` | Writes one PNG per step, named `<scene-id>-<step-id>.png`. Use `--out dir`, `--scale 1`. |
| `play <scene>` | Writes one self-contained HTML player. Use `--out file.html`, `--autoplay`, `--loop`. |
| `render <scene>` | Writes an MP4. Use `--out file.mp4`, `--fps 30`, `--lead 0.4`, `--engine builtin\|hyperframes`. |

The built-in engine uses headless Chromium and ffmpeg. HyperFrames is optional. Use it only if you install it. Inkmark turns its telemetry off.

## Marks

| Mark | Key options |
| --- | --- |
| `circle` | `target`, `pad`, `loops` (1 or 2) |
| `box` | `target`, `pad` |
| `underline` | `target`, `offset`, `double` |
| `highlight` | `target`, `opacity` |
| `strike` | `target`, `crossed` |
| `bracket` | `target`, `sides`, `pad` |
| `arrow` | `from`, `to`, `bend`, `head` |
| `label` | `text`, `at`, `side`, `maxWidth`, `size` |
| `scribble` | `points`, `thickness` |

Every mark also has `id`, `with`, `duration`, `delay`, `color` and `seed`. See [docs/scenes.md](docs/scenes.md).

## Targets

A target says where a mark goes. Use one key:

1. `{ "selector": "#price" }` is a CSS selector. It works on html and svg backgrounds.
2. `{ "anchor": "peak" }` is a name from the background anchor map. Charts can export one.
3. `{ "box": [x, y, w, h] }` is a box in background pixels.
4. `{ "point": [x, y] }` is a point in background pixels.
5. `{ "mark": "c1" }` is another mark. For an arrow, add `"end": "start"` or `"end": "end"`.

Use the most exact source. A selector or an anchor is exact. A box or a point is a guess you read from the picture. For an image, run `grid` and read the coordinates from the grid copy.

## Styles

Two styles are built in. `marker` is a thick marker pen. `sketch` is a thin sketchy pen. Marks name color tokens such as `ink` and `accent`. They never use hex values.

To use your own colors and font, extend a built-in style and change only what you need. See [docs/styles.md](docs/styles.md) and [examples/brand.json](examples/brand.json).

## Overlay

Set `"overlay": true` on the scene or on a step to dim the background and leave holes around the targets of the step. It fades in with the first mark. Details: [docs/scenes.md](docs/scenes.md#overlay).

## Light and dark

Pass `scheme: 'light' | 'dark' | 'auto'` to `mountScene` or `createPlayer`, or set `scheme` in a scene. In the dark scheme a style uses its `dark.colors`. The CLI takes `--scheme light|dark`. Details: [docs/scenes.md](docs/scenes.md#color-scheme).

## Requirements

1. Node 22.18 or newer.
2. ffmpeg, for MP4 output.
3. A Chromium browser, for `grid`, `preview`, `render` and html or svg targets in the CLI.

## License

MIT
