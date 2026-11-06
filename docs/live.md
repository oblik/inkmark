# Live mode

Live mode draws Inkmark marks on elements of a real web page. It needs no scene, no background and no player.

## Install

1. With npm: `npm install @oblik/inkmark`. Then `import { annotate } from '@oblik/inkmark'`.
2. With a script tag: load `inkmark.iife.js`. It sets the global `Inkmark`. Use `Inkmark.annotate`.
3. Labels use the font Permanent Marker. Load it on your page, or set `font.src` in a style.

## Quick start

```js
import { annotate } from '@oblik/inkmark';

const mark = annotate('#price', 'circle');
await mark.show();   // draws the mark
await mark.hide();   // fades it out
mark.remove();       // removes it for good
```

## The API

1. `annotate(target, mark, options?)` makes one mark. It returns an `Annotation`.
2. `target` is a CSS selector (the first match is used) or a DOM element.
3. `mark` is a type name (`'circle'`) or an object (`{ type: 'underline', color: 'accent' }`).
4. `show()` draws the mark. It returns a promise that ends when the drawing ends. A second call does nothing.
5. `hide()` fades the mark out. `show()` can draw it again.
6. `remove()` removes the mark and frees its listeners.
7. `shown` is `true` after `show()` and `false` after `hide()`. `element` is the marked element.
8. `annotateGroup(list, options?)` shows many marks one after the other. See [Groups](#groups).

## Mark types

1. `annotate('#price', 'circle')` draws a loop around the element. Options: `pad`, `loops` (1 or 2).
2. `annotate('#card', 'box')` draws a rectangle. Option: `pad`.
3. `annotate('#title', 'underline')` draws a line below. Options: `offset`, `double`.
4. `annotate('#lead', 'highlight')` draws a marker band behind the text. Option: `opacity`.
5. `annotate('#old', 'strike')` draws a line through the text. Option: `crossed`.
6. `annotate('#item', { type: 'bracket', sides: ['left'] })` draws brackets. Options: `sides`, `pad`.
7. `annotate('#cta', { type: 'arrow', from: 'left' })` draws an arrow that points at the element. `from` is a side (`'top'`, `'right'`, `'bottom'`, `'left'`, default `'left'`) or another element or selector. Options: `bend`, `head`.
8. `annotate('#plan', { type: 'label', text: 'Best value', side: 'right' })` writes a short text next to the element. Options: `side` (a side or `'auto'`), `maxWidth`, `size`.

All types also accept `color` (a color token), `duration` and `delay` (seconds), and `seed` (changes the hand-drawn look).

## Colors

Use color tokens, not hex values: `ink` (red, the default), `accent` (blue) and `highlight` (yellow). Example: `{ type: 'box', color: 'accent' }`.

## Options

Pass options as the third argument of `annotate`.

| Option | Default | What it does |
| --- | --- | --- |
| `style` | `"marker"` | A built-in style name (for example `"marker"`, `"chalk"`, `"modern"`) or a partial style. A partial style can use `extends`. |
| `styles` | none | Your own styles by name. |
| `scheme` | `"auto"` | `"light"`, `"dark"` or `"auto"`. See [Light and dark](#light-and-dark). |
| `overlay` | off | `true` or `{ opacity, color }`. Dims the page except around the element while the mark is shown. |
| `animate` | `true` | `false` makes the mark appear at once. |

## Groups

```js
const g = annotateGroup([a, b, c], { overlay: true, gap: 0.3 });
await g.show();   // a, then b, then c
await g.hide();
g.remove();       // removes the group and all its marks
```

1. A group shows its marks in order, with `gap` seconds between them. The default gap comes from the style.
2. With `overlay: true` the page is dimmed. The hole follows the mark that is drawing now. When the last mark is done, the dim fades out after the style hold. The marks stay.
3. A label in a spotlight gets a halo, so it stays easy to read.
4. Do not set `overlay` on the single marks of a group. Set it on the group.

## Spotlight

Set `overlay: true` on a mark or a group. Use `overlay: { opacity: 0.7, color: 'shade' }` to tune it. Use it for one key thing at a time.

## Light and dark

1. With `scheme: 'auto'`, Inkmark reads the `color-scheme` of the `<html>` element.
2. If it is only `dark` or only `light`, Inkmark uses that. Otherwise it uses `prefers-color-scheme`.
3. Inkmark watches the `<html>` and `<body>` attributes and the system setting. The colors switch at once, with no redraw.
4. Set `scheme: 'light'` or `scheme: 'dark'` to fix the scheme.

## Scrolling, resizing and animation

1. Marks follow their element when the page scrolls, when a scroll box scrolls and when the window resizes.
2. If the element changes size, the mark is drawn again in the same look.
3. If the element is hidden, removed from the page or scrolled out of its scroll box, the mark hides.
4. With `prefers-reduced-motion: reduce`, marks appear and vanish at once. The library does this for you.
5. Show marks when the element comes into view:

```js
const mark = annotate('#price', 'circle');
new IntersectionObserver(([e], io) => {
  if (e.isIntersecting) { void mark.show(); io.disconnect(); }
}).observe(mark.element);
```

## Limits

1. Marks sit in a fixed layer on top of the page (`z-index` 2147483000). Page elements cannot cover them.
2. The layer ignores the mouse. You can click through the marks.
3. A selector must match when you call `annotate`. It throws an error if nothing matches.
4. Marks do not follow an element that moves by itself with no scroll, resize or size change (for example a CSS animation).
5. Marks do not enter iframes. Mark the iframe element itself.
6. Highlights use a blend mode on the page. On very busy backgrounds they look less clean.
7. A mark is clipped by the scroll boxes around its element.
8. The mark `scribble` is not available in live mode.
