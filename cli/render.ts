import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { withCapture } from './capture.ts';
import { findFfmpeg, startEncoder } from './ffmpeg.ts';
import { rel } from './load.ts';
import { buildPage, parseScheme, preparePage } from './page.ts';
import { preflightSelectors } from './selectors.ts';
import type { PageData } from './page.ts';
import { launchBrowser } from './browser.ts';

const HF_VERSION = '0.8.204';
const HF_ENV = {
  HYPERFRAMES_NO_TELEMETRY: '1',
  DO_NOT_TRACK: '1',
  HYPERFRAMES_NO_UPDATE_CHECK: '1',
  HYPERFRAMES_SKIP_SKILLS: '1',
};

const positive = (v: string | undefined, name: string, fallback: number, allowZero = false) => {
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || (n === 0 && !allowZero)) throw new Error(`--${name} must be a ${allowZero ? 'non-negative' : 'positive'} number.`);
  return n;
};

function progress(done: number, total: number) {
  if (!process.stderr.isTTY) return;
  const pct = Math.round((done / total) * 100);
  process.stderr.write(`\rRendering frame ${done}/${total} (${pct}%)`);
}

async function renderBuiltin(data: PageData, ffmpeg: string, out: string, fps: number, lead: number): Promise<void> {
  await withCapture(data, async (page, info) => {
    const total = Math.round((lead + info.duration / 1000) * fps);
    const enc = startEncoder(ffmpeg, fps, out);
    const clip = { x: 0, y: 0, width: Math.ceil(data.width / 2) * 2, height: Math.ceil(data.height / 2) * 2 };
    // Frames inside a hold, or in the lead, look the same. Take one screenshot for each.
    const still = (ms: number): string | undefined => {
      if (ms <= 0) return 'lead';
      const s = info.steps.find((st) => ms >= st.drawEnd && ms <= st.end);
      return s ? s.id : ms >= info.duration ? 'end' : undefined;
    };
    let lastKey: string | undefined;
    let last: Buffer | undefined;
    try {
      for (let i = 0; i < total; i++) {
        const ms = (i / fps - lead) * 1000;
        const key = still(ms);
        if (key === undefined || key !== lastKey || !last) {
          await page.evaluate(`window.__mg.seek(${Math.max(0, ms)})`);
          last = await page.screenshot({ type: 'png', clip });
        }
        lastKey = key;
        await enc.write(last);
        if (i % 5 === 0 || i === total - 1) progress(i + 1, total);
      }
    } catch (e) {
      enc.proc.kill();
      throw e;
    }
    await enc.finish();
    if (process.stderr.isTTY) process.stderr.write('\n');
  }, { even: true });
}

function findHyperframes(from: string): string | undefined {
  try {
    const req = createRequire(join(from, 'noop.js'));
    return req.resolve('hyperframes/package.json');
  } catch {
    return undefined;
  }
}

async function renderHyperframes(data: PageData, ffmpeg: string, out: string, fps: number, lead: number, sceneDir: string): Promise<void> {
  const pkg = findHyperframes(process.cwd()) ?? findHyperframes(sceneDir);
  if (!pkg) {
    throw new Error(`HyperFrames is not installed. Install it with: npm install --save-dev hyperframes@${HF_VERSION}`);
  }
  const bin = join(dirname(pkg), 'dist', 'cli.js');
  const total = await withCapture(data, async (_p, info) => Math.round((lead + info.duration / 1000) * fps));
  const seconds = total / fps;
  const tmp = mkdtempSync(join(tmpdir(), 'inkmark-hf-'));
  try {
    const attrs = `data-composition-id="main" data-no-timeline data-start="0" data-duration="${seconds}" data-width="${data.width}" data-height="${data.height}"`;
    const after = `window.__hfAnime = [{ seek(ms) { handle.seek(ms - ${lead * 1000}); }, pause() {} }];`;
    writeFileSync(join(tmp, 'index.html'), buildPage(data, { mode: 'capture', rootAttrs: attrs, afterMount: after }));
    const browser = await launchBrowser();
    const browserPath = browser.browserType().executablePath();
    await browser.close();
    const code = await new Promise<number>((res) => {
      const cmd = existsSync(bin) ? process.execPath : 'npx';
      const args = existsSync(bin) ? [bin] : ['hyperframes'];
      const p = spawn(cmd, [...args, 'render', '-c', './index.html', '-o', out, '-f', String(fps), '--quiet'], {
        cwd: tmp,
        stdio: 'inherit',
        env: { ...process.env, ...HF_ENV, HYPERFRAMES_FFMPEG_PATH: ffmpeg, HYPERFRAMES_BROWSER_PATH: browserPath },
      });
      p.on('close', (c) => res(c ?? 1));
    });
    if (code !== 0) throw new Error(`HyperFrames failed (exit code ${code}).`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export async function renderCommand(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { out: { type: 'string' }, fps: { type: 'string' }, lead: { type: 'string' }, engine: { type: 'string' }, scheme: { type: 'string' } },
  });
  if (positionals.length !== 1) {
    console.error('Usage: inkmark render <scene> [--out file.mp4] [--fps 30] [--lead 0.4] [--engine builtin|hyperframes] [--scheme light|dark]');
    return 1;
  }
  const fps = positive(values.fps, 'fps', 30);
  const lead = positive(values.lead, 'lead', 0.4, true);
  const engine = values.engine ?? 'builtin';
  if (engine !== 'builtin' && engine !== 'hyperframes') throw new Error('--engine must be "builtin" or "hyperframes".');
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    console.error('ffmpeg not found. Install it (for example "brew install ffmpeg") or set FFMPEG_PATH.');
    return 1;
  }
  const { loaded, data } = preparePage(positionals[0]);
  data.scheme = parseScheme(values.scheme);
  await preflightSelectors(loaded, positionals[0]);
  const out = resolve(values.out ?? join(loaded.dir, `${loaded.scene.id}.mp4`));
  mkdirSync(dirname(out), { recursive: true });
  if (engine === 'hyperframes') await renderHyperframes(data, ffmpeg, out, fps, lead, loaded.dir);
  else await renderBuiltin(data, ffmpeg, out, fps, lead);
  console.log(rel(out));
  return 0;
}
