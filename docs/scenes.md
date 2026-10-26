# Scene reference

A scene is one JSON file. It names a background and lists steps. Each step has marks. Format version: `1.0`.

Units: all sizes and coordinates are pixels in the background's own space. All times are seconds.

## Scene

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `inkmark` | `"1.0"` | none | Required. |
| `id` | text | none | Required. Used in output file names. |
| `background` | object | none | Required. See below. |
| `frame` | object | background size | Output size. |
| `style` | text or object | `"marker"` | A built-in name, a path to a style file, a name from `createPlayer` options, or an inline style. |
| `steps` | list | none | Required. At least one step. |

## Background

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `type` | `image`, `html` or `svg` | none | Required. |
| `src` | text | none | Path (relative to the scene file) or URL. |
| `content` | text | none | Inline HTML or SVG. Use instead of `src`. |
| `width`, `height` | number | none | Required. Real size in pixels. |
| `anchors` | object or text | none | Anchor map, or a path to a JSON file `{ "anchors": { ... } }`. |

Give `src` or `content`. An anchor is a point `[x, y]` or a box `[x, y, w, h]`.

## Frame

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `width`, `height` | number | background size | Output size in pixels. |
| `fit` | `contain` or `cover` | `contain` | How the background fits the frame. |
| `color` | text | style `paper` color | Color behind the background. |

Marks draw in frame pixels, so stroke width and font size stay the same for any background size. Labels can sit in the empty space around a `contain` background.

## Step

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | text | none | Required. Unique across steps and marks. |
| `marks` | list | none | Required. At least one. Use 3 or fewer. |
| `hold` | seconds | style `timing.hold` (1.2) | Time the finished step stays on screen. |
| `clear` | boolean | `false` | Fades out all earlier marks before this step draws. |

## Marks

Fields for every mark:

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | text | none | Required. Unique. |
| `type` | text | none | Required. One of the 9 types below. |
| `with` | mark id | none | Start together with an earlier mark of the same step. |
| `duration` | seconds | style `timing.durations` | Draw time. |
| `delay` | seconds | 0 | Wait before the mark starts. |
| `color` | token name | style default | A color token, never a hex value. |
| `seed` | number | hash of `id` | Changes the hand-drawn look. |

Fields for each type:

| Type | Field | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `circle` | `target` | target | none | Required. |
| | `pad` | pixels | 8 | Space between target and stroke. |
| | `loops` | 1 or 2 | 1 | |
| `box` | `target` | target | none | Required. |
| | `pad` | pixels | 8 | |
| `underline` | `target` | target | none | Required. |
| | `offset` | pixels | 4 | Distance below the target. |
| | `double` | boolean | `false` | Draws two lines. |
| `highlight` | `target` | target | none | Required. |
| | `opacity` | 0 to 1 | 0.5 | |
| `strike` | `target` | target | none | Required. |
| | `crossed` | boolean | `false` | Draws a cross. |
| `bracket` | `target` | target | none | Required. |
| | `sides` | list of `top`, `right`, `bottom`, `left` | `["left"]` | Which sides get a bracket. |
| | `pad` | pixels | 8 | |
| `arrow` | `from`, `to` | target | none | Required. |
| | `bend` | number | 0.2 | Curve of the shaft. |
| | `head` | number | 1 | Scale of the arrow head. |
| `label` | `text` | text | none | Required. 40 characters or fewer. |
| | `at` | target | none | Required. Anchor point of the label. |
| | `side` | `top`, `right`, `bottom`, `left`, `auto` | `auto` | Side of the target where the text sits. |
| | `maxWidth` | pixels | smaller of 45% of frame width and 12 times `size` | Wraps text at this width. |
| | `size` | pixels | style `font.size` | Font size. |
| `scribble` | `points` | list of `[x, y]` | none | Required. 2 or more points. |
| | `thickness` | pixels | style `stroke.width` | |

## Targets

A target is an object with exactly one of these keys:

| Key | Value | Notes |
| --- | --- | --- |
| `box` | `[x, y, w, h]` | Background pixels. Must be inside the background. |
| `point` | `[x, y]` | Background pixels. Must be inside the background. |
| `selector` | CSS selector | Only for `html` and `svg` backgrounds. |
| `anchor` | name | Must exist in the anchor map. |
| `mark` | mark id | An earlier mark. For an arrow, add `end`: `start` or `end`. |

Use the most exact source: selector or anchor first, then box or point.

For html and svg, `validate` opens the background in a browser and checks that every selector matches an element. Use `--no-browser` to skip this. Run `targets <scene>` to list selectors at the scene size.

Common visual mistakes:

1. Do not highlight a filled button. The colors change and the text can become unreadable. Use `box` or `underline`.
2. Do not use `circle` on a large card. The ellipse gets too big and cuts its neighbors. Use `box`.

## Timing model

1. Steps play in order. A step starts when the previous step ends.
2. Marks in a step draw one after the other. The gap between them is style `timing.gap` (0.15).
3. `with` starts a mark at the same time as an earlier mark of that step.
4. `delay` moves the start of a mark later.
5. The step is drawn when all marks are done. Then the `hold` time runs. The step ends after the hold.
6. A label draws its letters one by one. Its default time is `labelPerChar` times the text length. It is never shorter than half the style label duration.
7. `clear: true` fades out all earlier marks in 0.3 seconds. Then the step starts.
8. The scene length is the sum of all steps, with their holds.

## Player behavior

1. Next draws the current step and then pauses.
2. Next while a step is drawing jumps to the end of the drawing.
3. Back goes to the finished state of the previous step. It does not draw backward.
4. Auto-play plays through all holds. Use `loop` to start again.
5. With `prefers-reduced-motion`, Next and Back jump straight to the finished state.
6. Keyboard: use `keyboard: false` to turn it off.

## Validation

Run `node cli/index.ts validate <scene>`. Each message says what is wrong and how to fix it. The exit code is 1 when there are errors.

Errors (the scene does not work):

1. `inkmark` is not `"1.0"`, or `id` is empty.
2. The background is missing, has a wrong `type`, has no `width` or `height`, or has neither `src` nor `content`.
3. `frame` has a size that is not positive, or a wrong `fit`.
4. The style does not resolve (unknown name, or a loop of `extends`).
5. `steps` is empty, or a step has no marks.
6. A scene, step or mark id is empty, used twice, or has characters other than letters, digits, `-` and `_`.
7. A mark has an unknown `type`.
8. `with` does not point to an earlier mark of the same step.
9. `duration`, `delay` or `hold` is below 0 or not a number.
10. `color` is a hex, `rgb` or `hsl` value, or not a color token of the style.
11. A target has none or more than one key.
12. A `box`, `point` or scribble point is outside the background, or a box has no size.
13. A `selector` is used on an image background, or (CLI, html and svg) matches no element or is not valid CSS.
14. An `anchor` is not in the anchor map, or there is no anchor map.
15. A `mark` target points to itself or to a later mark. `end` is used on a mark that is not an arrow.
16. A label has no `text`. A scribble has fewer than 2 points. `loops` is not 1 or 2. `sides` or `side` has a wrong value.

Warnings (the scene works, but it may read badly):

1. A step has more than 3 marks. Split it.
2. A label has more than 40 characters. Shorten it.
3. The scene uses more than 2 annotation colors.
4. A mark has a field that its type does not use. The field is ignored.
5. An anchor map exists, but a target uses a box or a point. Use `anchor`.
6. The anchors are in a file and the check ran without it. Run the CLI to check them.

## Full example

```json
{
  "inkmark": "1.0",
  "id": "checkout",
  "background": { "type": "image", "src": "checkout.png", "width": 1280, "height": 800 },
  "frame": { "width": 1280, "height": 800, "fit": "contain" },
  "style": "marker",
  "steps": [
    {
      "id": "total",
      "hold": 1.5,
      "marks": [
        { "id": "c1", "type": "circle", "target": { "box": [900, 300, 240, 70] }, "pad": 12, "loops": 2 },
        { "id": "a1", "type": "arrow", "from": { "point": [700, 150] }, "to": { "mark": "c1" }, "with": "c1", "delay": 0.2 },
        { "id": "l1", "type": "label", "text": "Check the total", "at": { "point": [560, 130] }, "side": "left" }
      ]
    },
    {
      "id": "promo",
      "clear": true,
      "marks": [
        { "id": "h1", "type": "highlight", "target": { "box": [100, 420, 400, 50] }, "color": "accent", "opacity": 0.3 },
        { "id": "u1", "type": "underline", "target": { "box": [100, 500, 300, 40] }, "double": true, "color": "accent" }
      ]
    },
    {
      "id": "extras",
      "marks": [
        { "id": "s1", "type": "strike", "target": { "box": [100, 600, 260, 40] }, "crossed": true },
        { "id": "b1", "type": "bracket", "target": { "box": [100, 660, 500, 80] }, "sides": ["left", "right"] },
        { "id": "x1", "type": "scribble", "points": [[700, 600], [760, 640], [820, 600], [880, 640]], "thickness": 4 }
      ]
    }
  ]
}
```
