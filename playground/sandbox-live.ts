import '@fontsource/permanent-marker';
import { annotate, annotateGroup } from '../src/index.ts';

const marks = [
  annotate('#title', 'underline'),
  annotate('#price', 'circle'),
  annotate('#old', 'strike'),
  annotate('#plan', { type: 'box', color: 'accent' }),
  annotate('#cta', { type: 'arrow', from: 'left' }),
  annotate('#plan', { type: 'label', text: 'Best value', side: 'right' }),
  annotate('#lead', { type: 'highlight' }),
  annotate('#f-bracket', { type: 'bracket', sides: ['left'] }),
  annotate('#inbox', { type: 'circle', color: 'accent' }),
];

const group = annotateGroup(
  [
    annotate('#g-a', 'underline'),
    annotate('#g-b', { type: 'circle', color: 'accent' }),
    annotate('#g-c', { type: 'label', text: 'Done', side: 'bottom' }),
  ],
  { overlay: true },
);

const $ = (id: string) => document.getElementById(id)!;
$('show').onclick = () => { for (const m of marks) void m.show(); };
$('hide').onclick = () => { for (const m of marks) void m.hide(); };
$('group').onclick = () => void group.show();
$('unGroup').onclick = () => void group.hide();
$('scheme').onclick = () => {
  const dark = document.documentElement.style.colorScheme !== 'dark';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  $('scheme').textContent = `Switch: ${dark ? 'dark' : 'light'}`;
};
Object.assign(window, { marks, group });
