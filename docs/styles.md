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

`marker` is the default.

| Style | Pen | Stroke width | Colors |
| --- | --- | --- | --- |
| `marker` | `freehand` | 6 | `ink` red, `accent` blue, `highlight` yellow, `paper` white, `shade` near black |
| `sketch` | `rough` | 2.5 | same as `marker` |

`marker` uses the Permanent Marker font at 34 pixels. Defaults: stroke and label use `ink`, highlight uses `highlight`, paper uses `paper`. `sketch` extends `marker` and changes only the pen and stroke.

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
