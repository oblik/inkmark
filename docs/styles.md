# Styles

A style is a set of tokens: colors, pen, stroke, font and timing. A scene picks one style. Marks name color tokens from it.

## Tokens

| Token | Meaning |
| --- | --- |
| `name` | Name of the style. |
| `pen` | `freehand` is a marker pen. `rough` is a thin sketchy pen. |
| `colors` | Color tokens. Name to color value. Marks use the names. |
| `defaults` | Token names used when a mark sets no `color`: `stroke`, `highlight`, `label`, `paper`. |
| `stroke.width` | Stroke width in output pixels. |
| `stroke.roughness`, `stroke.bowing` | How shaky and how curved the line is. |
| `stroke.thinning` | How much the freehand pen thins at speed. |
| `stroke.highlightWidth` | Width of a highlight band in pixels. |
| `stroke.opacity` | 0 to 1. Makes strokes see-through. Labels stay solid. Default 1. |
| `stroke.texture` | `none`, `chalk` or `pencil`. Adds grain to strokes and labels. Default `none`. |
| `font.family` | CSS font family for labels. |
| `font.size`, `font.weight`, `font.lineHeight` | Label text. Size is in pixels. |
| `font.src` | URL of a font file to load. |
| `overlay.opacity`, `overlay.color` | Strength and color token of the spotlight dim layer (0.6, `shade`). |
| `overlay.pad`, `overlay.radius` | Space around a hole and its corner radius in pixels (10, 12). |
| `overlay.fade` | Seconds the dim layer takes to fade in and out (0.3). |
| `dark.colors` | Color values used in the dark scheme. Merged over `colors`. |
| `timing.durations` | Draw time in seconds for each mark type. |
| `timing.labelPerChar` | Seconds per character for labels. |
| `timing.hold` | Default step hold in seconds. |
| `timing.gap` | Seconds between marks in one step. |
| `timing.easing` | Anime.js easing name. |

## Built-in styles

`marker` is the default. All styles extend `marker`, so they have the same color token names: `ink`, `accent`, `highlight`, `paper` and `shade`. Each style has its own light and dark colors.

| Style | Pen | Stroke | Font | Colors (ink, accent) |
| --- | --- | --- | --- | --- |
| `marker` | `freehand` | 6 | Permanent Marker | red, blue |
| `sketch` | `rough` | 2.5 | Permanent Marker | red, blue |
| `highlighter` | `freehand` | 12, opacity 0.6 | Caveat Brush | pink, blue |
| `pencil` | `rough` | 1.8, `pencil` grain | Shadows Into Light | graphite, red |
| `pen` | `freehand` | 3 | Nanum Pen Script | blue, pink |
| `chalk` | `rough` | 4, `chalk` grain | Cabin Sketch 700 | blue, pink. Dark: white, pink |
| `whiteboard` | `freehand` | 5 | Kalam 700 | blue, red |
| `modern` | `freehand` | 4, no wobble | Geist, then the system sans-serif | indigo, red |
| `blueprint` | `rough` | 2 | Architects Daughter | blue, orange |
| `comic` | `freehand` | 7 | Bangers | black, red. Dark: white, red |

Defaults: stroke and label use `ink`, highlight uses `highlight`, paper uses `paper`.

Styles with the `rough` pen load Rough.js the first time they draw, so pages that use only `freehand` styles never download it. The script-tag build includes it.

## Fonts

The library does not include font files. Each style names a font. Install the font package and import it on your page:

```sh
npm install @fontsource/cabin-sketch
```

```js
import '@fontsource/cabin-sketch/700.css';
```

If the font is missing, labels use the next font in the family list, then the browser's cursive font. The CLI finds installed `@fontsource` packages by itself.

These free fonts (SIL Open Font License) work well for labels. The `fonts` export has the same list with the family, package, weight and a good size:

| Font | Package | Look |
| --- | --- | --- |
| Permanent Marker | `@fontsource/permanent-marker` | Thick felt marker. The default. |
| Caveat | `@fontsource-variable/caveat` | Quick, neat handwriting. |
| Caveat Brush | `@fontsource/caveat-brush` | Brush pen. |
| Kalam | `@fontsource/kalam` | Whiteboard marker. |
| Patrick Hand | `@fontsource/patrick-hand` | Clean print handwriting. |
| Gochi Hand | `@fontsource/gochi-hand` | Round, friendly marker. |
| Shadows Into Light | `@fontsource/shadows-into-light` | Thin pencil. |
| Reenie Beanie | `@fontsource/reenie-beanie` | Loose ballpoint scrawl. |
| Rock Salt | `@fontsource/rock-salt` | Rough, energetic marker. Wide. |
| Gloria Hallelujah | `@fontsource/gloria-hallelujah` | Playful notebook writing. |
| Architects Daughter | `@fontsource/architects-daughter` | Neat technical lettering. |
| Cabin Sketch | `@fontsource/cabin-sketch` | Hatched chalk letters. |
| Covered By Your Grace | `@fontsource/covered-by-your-grace` | Tall, bold felt pen. |
| Nanum Pen Script | `@fontsource/nanum-pen-script` | Fine pen, narrow. |
| Indie Flower | `@fontsource/indie-flower` | Soft, round handwriting. |
| Sedgwick Ave | `@fontsource/sedgwick-ave` | Graffiti marker. |
| Just Another Hand | `@fontsource/just-another-hand` | Tall, narrow capitals. |
| Schoolbell | `@fontsource/schoolbell` | School chalkboard. |
| Bangers | `@fontsource/bangers` | Comic book capitals. |

To use a font with any style, set the family and a size:

```js
import { fonts } from 'inkmark';
const f = fonts.find((x) => x.name === 'Rock Salt');
createPlayer(el, scene, { style: { font: { family: f.family, size: f.size, weight: f.weight } } });
```

## Dark scheme

Add `dark.colors` to a style. In the dark scheme these values replace the same names in `colors`. Names you leave out keep their light value.

```json
{ "extends": "marker", "dark": { "colors": { "ink": "#FF8A8E" } } }
```

`marker` has dark values for `ink`, `accent`, `highlight`, `paper` and `shade`. On a dark page the highlight band is a plain, fainter layer. On a light page it uses a multiply blend. The `shade` token is the dim color of the overlay.

## Rules

1. Marks name color tokens. They never use hex values. The validator gives an error for a hex value.
2. To use a new color, add it to the style `colors`. Then name it in the mark.
3. Use 2 annotation colors or fewer in one scene. The validator gives a warning for more.

## Make your own style

A project style extends a built-in style. Write only the tokens that change. Pick one of three ways.

### 1. A style file

Write `brand.json` (a copy is in `examples/brand.json`):

```json
{
  "extends": "marker",
  "name": "acme",
  "colors": {
    "ink": "#D6336C",
    "accent": "#0B7285",
    "highlight": "#FFE066",
    "paper": "#FFFDF7"
  },
  "font": { "family": "\"Kalam\", cursive", "size": 38, "weight": 400 }
}
```

Use it in a scene. The path starts at the scene file:

```json
{
  "inkmark": "1.0",
  "id": "branded",
  "background": { "type": "image", "src": "app.png", "width": 1280, "height": 800 },
  "style": "./brand.json",
  "steps": [
    {
      "id": "one",
      "marks": [
        { "id": "c1", "type": "circle", "target": { "box": [100, 100, 200, 60] }, "color": "accent" }
      ]
    }
  ]
}
```

The CLI (`validate`, `preview`, `play`, `render`) loads the file by itself.

### 2. In JavaScript

Register the style by name:

```js
const player = await createPlayer(el, scene, {
  styles: { brand: { extends: 'marker', colors: { ink: '#D6336C' } } },
});
```

Then use `"style": "brand"` in the scene.

### 3. A one-off override

Apply a change on top of the scene style. Nothing changes in the scene file:

```js
const player = await createPlayer(el, scene, {
  style: { colors: { ink: '#0B7285' } },
});
```

## Use another handwritten font

Set `font.family` to the CSS family name. Set `font.src` to a font file the browser can load.

```json
{
  "extends": "marker",
  "font": {
    "family": "\"Reenie Beanie\", cursive",
    "src": "./fonts/reenie-beanie.woff2",
    "size": 46
  }
}
```

Choose a font with clear letters. Test it with `preview` and read every label. Wait for the font to load before you draw. The CLI and the player do this for you.
