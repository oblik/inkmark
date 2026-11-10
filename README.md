# Inkmark

Inkmark draws hand-drawn marks (circles, arrows, labels) over an image, a web page or a chart. It plays them step by step. One JSON scene gives a web player, one PNG per step and an MP4.

See the live demo and examples at [inkmark.oblik.studio](https://inkmark.oblik.studio).

## Use it without the player

You can mark elements on any live page. You need no scene and no background.

```js
import { annotate } from '@oblik/inkmark';

await annotate('#price', 'circle').show();
await annotate('#plan', { type: 'label', text: 'Best value', side: 'right' }).show();
```

The script-tag build has the same API as `Inkmark.annotate`. Marks follow their element on scroll and resize, and they follow light and dark. See [docs/live.md](docs/live.md).

A scene can also play with no controls: `createPlayer(el, scene, { controls: false, autoplay: true })`.

## A static picture

For one picture with no steps, write `marks` instead of `steps`. `drawScene` draws every mark at once, like a screenshot. It has no animation and no controls.

```js
import { drawScene } from '@oblik/inkmark';

await drawScene(document.querySelector('#box'), {
  inkmark: '1.0',
  id: 'pricing',
  background: { type: 'image', src: 'pricing.png', width: 1280, height: 800 },
  marks: [{ id: 'c1', type: 'circle', target: { box: [100, 120, 300, 80] } }],
});
```

`drawScene` also works with a scene that has steps. It shows the last step, finished. The CLI `preview` command writes the same picture as a PNG. In live mode, use `annotate(el, mark, { animate: false })`.

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

```sh
npm install @oblik/inkmark
```

For a script tag, use `dist/inkmark.iife.js`. It gives a global `Inkmark` (`Inkmark.annotate`, `Inkmark.createPlayer`).

To work on the library itself:

```sh
npm install
npm run build   # builds the library into dist/
npm run dev     # test pages: /sandbox.html and /sandbox-live.html
```

## Quick start in the browser

```js
import { createPlayer } from '@oblik/inkmark';
import '@fontsource/permanent-marker'; // the default label font

const scene = await (await fetch('pricing.json')).json();
const player = await createPlayer(document.querySelector('#box'), scene, {
  baseUrl: '/scenes/',
});
```

The player shows a row of step dots and a Play button. Click a dot to go to that step. Load the label font on your page (the default is Permanent Marker), or set `font.src` in a style. Use `controls: false`, `autoplay: true`, `loop: true` or `keyboard: false` to change this. Use `mountScene` for a paused scene without controls.

## CLI

Run commands with `npx inkmark <command>`. The commands that use a browser also need `playwright-core` (`npm install --save-dev playwright-core`). In a clone of this repo, use `npm run inkmark -- <command>`.

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

Ten styles are built in. Set `"style": "chalk"` in a scene, or `style: 'chalk'` in code.

| Style | Look |
| --- | --- |
| `marker` | Thick red felt marker. The default. |
| `sketch` | Thin, sketchy pen. |
| `highlighter` | Wide, see-through neon strokes. |
| `pencil` | Thin gray pencil with grain. |
| `pen` | Fine blue ballpoint. |
| `chalk` | Grainy chalk. White on dark pages. |
| `whiteboard` | Blue and red dry-erase marker. |
| `modern` | Clean, even lines and a sans-serif font. |
| `blueprint` | Neat blue technical lines. |
| `comic` | Bold black ink and comic capitals. |

Each style has its own font. Install and import it on your page, for example `import '@fontsource/cabin-sketch/700.css'` for `chalk`. The `fonts` export lists 19 free handwritten fonts. See [docs/styles.md](docs/styles.md#fonts).

Marks name color tokens such as `ink` and `accent`. They never use hex values.

To use your own colors and font, extend a built-in style and change only what you need. See [docs/styles.md](docs/styles.md) and [examples/brand.json](examples/brand.json).

## Overlay

Set `"overlay": true` on the scene or on a step to dim the background and leave holes around the targets of the step. It fades in with the first mark. Details: [docs/scenes.md](docs/scenes.md#overlay).

## Light and dark

Pass `scheme: 'light' | 'dark' | 'auto'` to `mountScene` or `createPlayer`, or set `scheme` in a scene. In the dark scheme a style uses its `dark.colors`. The CLI takes `--scheme light|dark`. Details: [docs/scenes.md](docs/scenes.md#color-scheme).

## Requirements

1. Node 22.18 or newer.
2. ffmpeg, for MP4 output.
3. A Chromium browser, for `grid`, `preview`, `render` and html or svg targets in the CLI.

## Security

Treat a scene like code: only load scenes and backgrounds you trust.

1. An `html` background loads in a same-origin frame, so its scripts run with the rights of your page. Inkmark needs this to measure the page.
2. An `svg` background is cleaned before it goes into the page: scripts, `on*` handlers and `javascript:` links are removed.
3. Do not load scenes that your users can edit without your own checks.

## License

MIT
