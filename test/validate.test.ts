import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../src/validate.ts';

function scene(): any {
  return {
    inkmark: '1.0',
    id: 's',
    background: { type: 'image', src: 'a.png', width: 1000, height: 800 },
    steps: [
      {
        id: 'step-1',
        marks: [
          { id: 'm1', type: 'circle', target: { box: [10, 10, 100, 50] } },
          { id: 'm2', type: 'arrow', from: { point: [500, 400] }, to: { mark: 'm1' } },
          { id: 'm3', type: 'label', text: 'Hello', at: { mark: 'm2', end: 'start' } },
        ],
      },
    ],
  };
}

const firstError = (s: unknown, o?: Parameters<typeof validate>[1]) => validate(s, o).errors[0];

test('valid scene passes with no issues', () => {
  const r = validate(scene());
  assert.deepEqual(r, { ok: true, errors: [], warnings: [] });
});

test('bad input does not throw', () => {
  assert.equal(validate(null).ok, false);
  assert.equal(validate('x').ok, false);
  assert.equal(validate({ steps: 5 }).ok, false);
});

test('duplicate ids fail', () => {
  const s = scene();
  s.steps[0].marks[1].id = 'm1';
  assert.match(firstError(s).message, /used twice/);
});

test('mark reference must be earlier', () => {
  const s = scene();
  s.steps[0].marks[0] = { id: 'm1', type: 'circle', target: { mark: 'm3' } };
  assert.equal(firstError(s).path, 'steps[0].marks[0].target.mark');
});

test('"end" only works on arrows', () => {
  const s = scene();
  s.steps[0].marks[2].at = { mark: 'm1', end: 'start' };
  assert.match(firstError(s).message, /only when the target mark is an arrow/);
});

test('"with" must point to an earlier mark in the same step', () => {
  const s = scene();
  s.steps.push({ id: 'step-2', marks: [{ id: 'm4', type: 'box', with: 'm1', target: { box: [0, 0, 10, 10] } }] });
  assert.equal(firstError(s).path, 'steps[1].marks[0].with');
});

test('box outside the background fails', () => {
  const s = scene();
  s.steps[0].marks[0].target = { box: [950, 10, 100, 50] };
  assert.match(firstError(s).message, /outside the background/);
});

test('hex color and unknown token fail', () => {
  const s = scene();
  s.steps[0].marks[0].color = '#ff0000';
  assert.match(firstError(s).message, /add the color to the style/);
  s.steps[0].marks[0].color = 'nope';
  assert.match(firstError(s).message, /not a color token/);
});

test('selector on image and unknown anchor fail', () => {
  const s = scene();
  s.steps[0].marks[0].target = { selector: 'h1' };
  assert.match(firstError(s).message, /only on html or svg/);
  s.steps[0].marks[0].target = { anchor: 'peak' };
  assert.match(firstError(s).message, /needs an anchor map/);
  assert.match(firstError(s, { anchors: { other: [1, 1] } }).message, /not in the anchor map/);
});

test('scribble needs two points and unknown style fails', () => {
  const s = scene();
  s.steps[0].marks[0] = { id: 'm1', type: 'scribble', points: [[1, 1]] };
  assert.equal(firstError(s).path, 'steps[0].marks[0].points');
  s.style = 'missing';
  assert.ok(validate(s).errors.some((e) => e.path === 'style'));
});

test('warnings: many marks, long label, box with anchors', () => {
  const s = scene();
  s.steps[0].marks.push({ id: 'm4', type: 'label', text: 'x'.repeat(41), at: { point: [5, 5] } });
  const r = validate(s, { anchors: { a: [1, 1] } });
  assert.equal(r.ok, true);
  const text = r.warnings.map((w) => w.message).join('\n');
  assert.match(text, /4 marks/);
  assert.match(text, /41 characters/);
  assert.match(text, /anchor map exists/);
});

test('ids must be safe for file names', () => {
  const s = scene();
  s.steps[0].id = 'Step One';
  assert.match(firstError(s).message, /letters, digits, dashes and underscores/);
});

test('color warning counts distinct effective colors', () => {
  const s = scene();
  // ink + ink + ink: no warning
  assert.equal(validate(s).warnings.length, 0);
  s.steps[0].marks.push({ id: 'm4', type: 'highlight', target: { box: [0, 0, 10, 10] } });
  // ink + highlight: 2 colors, no warning
  assert.ok(!validate(s).warnings.some((w) => /annotation colors/.test(w.message)));
  s.steps[0].marks.push({ id: 'm5', type: 'box', target: { box: [0, 0, 10, 10] }, color: 'accent' });
  // ink + highlight + accent: 3 colors, warning
  assert.ok(validate(s).warnings.some((w) => /3 annotation colors/.test(w.message)));
});

test('overlay and scheme are checked', () => {
  const ok = scene();
  ok.overlay = { opacity: 0.5, color: 'shade' };
  ok.steps[0].overlay = true;
  ok.scheme = 'dark';
  assert.equal(validate(ok).ok, true);

  const bad = scene();
  bad.overlay = { opacity: 2, color: 'nope' };
  bad.scheme = 'blue';
  const paths = validate(bad).errors.map((e) => e.path).sort();
  assert.deepEqual(paths, ['overlay.color', 'overlay.opacity', 'scheme']);
});
