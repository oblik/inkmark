---
name: marginalia
description: Use when a brief asks for hand-drawn marks (circles, arrows, labels) over a screenshot, web page or chart, as a web player, PNG steps or an MP4.
---

# Marginalia

Marginalia turns one JSON scene into a web player, one PNG per step or an MP4. You write only the scene JSON. You write no code and no SVG.

Run commands with `node cli/index.ts <command>`.

## The loop

1. Read the brief. Split it into steps. One idea per step.
2. Get targets from the most exact source (see below).
3. Write the scene JSON.
4. Run `validate <scene>`. Fix every error. Repeat until it passes. Read the warnings too.
5. Run `preview <scene>`. It writes `<scene-id>-<step-id>.png` for each step.
6. Open and LOOK at every PNG. Ask three questions:
   - Is the mark on the right thing?
   - Does a label cover content?
   - Can a viewer read it in the hold time?
7. Fix the scene and run `preview` again. Do at most 3 fix rounds. Then stop and ask a human.
8. Make the output the brief asks for: `play <scene>` for HTML, `render <scene>` for MP4.

## Targets: use the most exact source

1. `html` or `svg` background: run `targets <file>`. Use `{ "selector": "..." }`.
2. Chart with an anchor map: use `{ "anchor": "name" }`. Run `targets <scene>` to list names.
3. Image: run `grid <image>`. Open the `.grid.png`. Read x and y from the grid. Use `{ "box": [x, y, w, h] }` or `{ "point": [x, y] }`.
4. To point at another mark, use `{ "mark": "id" }`. For an arrow, add `"end": "start"` or `"end": "end"`.

## Scene template

```json
{
  "marginalia": "1.0",
  "id": "my-scene",
  "background": { "type": "image", "src": "screen.png", "width": 1280, "height": 800 },
  "steps": [
    {
      "id": "step-one",
      "marks": [
        { "id": "m1", "type": "circle", "target": { "box": [100, 120, 300, 80] } },
        { "id": "m2", "type": "label", "text": "Start here", "at": { "mark": "m1" }, "side": "right" }
      ]
    }
  ]
}
```

Marks: `circle`, `box`, `underline`, `highlight`, `strike`, `bracket`, `arrow`, `label`, `scribble`. Full fields are in `docs/scenes.md`.

## Readability limits

1. 3 marks or fewer in one step. Split the rest into new steps.
2. Labels of 40 characters or fewer. Use a few words.
3. 2 colors or fewer in one scene.
4. Name color tokens (`ink`, `accent`, `highlight`). Never write hex values.
5. Start a new idea with `"clear": true` to fade out old marks.
6. Raise `hold` (seconds) for steps with long labels. The default is 1.2.

## Common mistakes

1. Guessing a box on a page. Use a `selector` instead.
2. Guessing a point on a chart. Use an anchor instead.
3. Skipping the grid for an image. Read the grid first.
4. Putting a label on top of the thing it explains. Use `side` or move `at`.
5. Reusing an id. Step and mark ids must be unique.
6. Using `with` for a mark in another step. It must be in the same step.
7. Pointing a `mark` target at a later mark. Point to an earlier one.
8. Using `selector` on an image background. Use `box` or `point`.
9. Marking everything. Mark only what the viewer must see.
10. Not looking at the PNGs. `validate` cannot see a mark on the wrong thing.

## Commands

| Command | Use |
| --- | --- |
| `targets <bg or scene>` | List selectors or anchors. |
| `grid <image>` | Write a grid copy of an image. |
| `validate <scene>` | Check the scene. |
| `preview <scene>` | One PNG per step. Options: `--out dir`, `--scale 1`. |
| `play <scene>` | One HTML player. Options: `--out`, `--autoplay`, `--loop`. |
| `render <scene>` | MP4. Options: `--out`, `--fps 30`, `--lead 0.4`, `--engine builtin\|hyperframes`. |
