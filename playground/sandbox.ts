import '@fontsource-variable/caveat';
import { createPlayer, mountScene, type Scene, type StyleInput } from '../src/index.ts';

const card = `<!doctype html><html><head><style>
  html,body{margin:0}
  body{width:600px;height:400px;background:#fafaf7;font:16px/1.4 Helvetica,Arial,sans-serif;color:#1d1d1f;position:relative}
  .card{position:absolute;left:150px;top:50px;width:360px;padding:22px 24px;background:#fff;border:1px solid #ddd;border-radius:12px}
  h1{margin:0 0 6px;font-size:22px}
  .lead{margin:0 0 12px;color:#555}
  .price{font-size:34px;font-weight:700}
  .old{color:#999;margin-left:8px;font-size:18px}
  ul{margin:12px 0;padding-left:20px}
  .cta{display:inline-block;padding:10px 18px;background:#1d1d1f;color:#fff;border-radius:8px}
</style></head><body><div class="card">
  <h1>Northwind Pro</h1>
  <p class="lead">Plan trips with your whole team in one place.</p>
  <div><span class="price" id="price">$24</span><span class="old">$39</span> per month</div>
  <ul class="features"><li class="f1">Shared itineraries</li><li class="f2">Offline maps</li></ul>
  <span class="cta" id="cta">Start free trial</span>
</div></body></html>`;

const chart = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" width="600" height="300">
  <rect width="600" height="300" fill="#fff"/>
  <g fill="#9bb7d4"><rect id="b1" x="70" y="170" width="70" height="90"/><rect id="b2" x="170" y="130" width="70" height="130"/>
  <rect id="b3" x="270" y="80" width="70" height="180"/><rect id="b4" x="370" y="110" width="70" height="150"/><rect id="b5" x="470" y="150" width="70" height="110"/></g>
  <line x1="50" y1="260" x2="560" y2="260" stroke="#333" stroke-width="2"/>
  <g font-family="Helvetica,Arial,sans-serif" font-size="16" fill="#333" text-anchor="middle">
    <text id="x3" x="305" y="284">Mar</text><text x="105" y="284">Jan</text><text x="205" y="284">Feb</text>
  </g>
  <text id="title" x="50" y="40" font-family="Helvetica,Arial,sans-serif" font-size="22" font-weight="700" fill="#222">Weekly signups</text>
</svg>`;

const htmlScene: Scene = {
  marginalia: '1.0',
  id: 'sandbox-html',
  background: {
    type: 'html', content: card, width: 600, height: 400,
    anchors: { tip: [330, 200] },
  },
  frame: { width: 900, height: 600, fit: 'contain' },
  steps: [
    { id: 'price', marks: [
      { id: 'c1', type: 'circle', target: { selector: '#price' }, pad: 6 },
      { id: 'a1', type: 'arrow', from: { point: [545, 90] }, to: { mark: 'c1' }, bend: 0.3 },
      { id: 'l1', type: 'label', text: 'Lowest price yet', at: { mark: 'a1', end: 'start' } },
    ] },
    { id: 'copy', marks: [
      { id: 'h1', type: 'highlight', target: { selector: '.lead' } },
      { id: 'u1', type: 'underline', target: { selector: '.f1' }, double: true },
      { id: 'br1', type: 'bracket', target: { selector: '.features' }, sides: ['left', 'right'] },
    ] },
    { id: 'old', marks: [
      { id: 's1', type: 'strike', target: { selector: '.old' } },
      { id: 'b1', type: 'box', target: { selector: '#cta' }, pad: 6 },
      { id: 'l2', type: 'label', text: 'Free for 14 days, no card needed', at: { selector: '#cta' }, side: 'auto' },
      { id: 'sc1', type: 'scribble', points: [[60, 330], [90, 310], [75, 345], [110, 320], [100, 355]], thickness: 5 },
    ] },
    { id: 'clear', clear: true, marks: [
      { id: 'x1', type: 'strike', target: { box: [150, 100, 120, 24] }, crossed: true },
      { id: 'c2', type: 'circle', target: { anchor: 'tip' }, loops: 2, with: 'x1' },
    ] },
  ],
};

const svgScene: Scene = {
  marginalia: '1.0',
  id: 'sandbox-svg',
  background: { type: 'svg', content: chart, width: 600, height: 300, anchors: { peak: [305, 80], bars: [70, 80, 470, 180] } },
  frame: { width: 900, height: 450 },
  steps: [
    { id: 'peak', marks: [
      { id: 'c1', type: 'circle', target: { anchor: 'peak' }, pad: 10 },
      { id: 'a1', type: 'arrow', from: { point: [480, 60] }, to: { mark: 'c1' }, bend: -0.3 },
      { id: 'l1', type: 'label', text: 'Peak week', at: { mark: 'a1', end: 'start' } },
    ] },
    { id: 'axis', marks: [
      { id: 'u1', type: 'underline', target: { selector: '#x3' } },
      { id: 'b1', type: 'box', target: { selector: '#b5' } },
      { id: 'h1', type: 'highlight', target: { selector: '#title' } },
    ] },
  ],
};

const pen = new URLSearchParams(location.search).get('pen');
const style: StyleInput | undefined = pen ? { pen: pen as 'rough' | 'freehand' } : undefined;

const w = window as unknown as Record<string, unknown>;
w.sandbox = { createPlayer, mountScene, htmlScene, svgScene };
const players = await Promise.all([
  createPlayer(document.getElementById('html-scene')!, htmlScene, { style }),
  createPlayer(document.getElementById('svg-scene')!, svgScene, { style }),
]);
w.players = players;
w.ready = true;
