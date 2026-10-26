import type { Page } from 'playwright-core';
import { withPage } from './browser.ts';
import { buildPage } from './page.ts';
import type { PageData } from './page.ts';
import type { StepTime } from '../src/types.ts';

export interface CaptureInfo {
  duration: number;
  steps: StepTime[];
}

/** Opens the capture page in headless Chromium and waits until the scene is mounted. */
export async function withCapture<T>(
  data: PageData,
  fn: (page: Page, info: CaptureInfo) => Promise<T>,
  options: { scale?: number; even?: boolean } = {},
): Promise<T> {
  const even = (n: number) => (options.even ? Math.ceil(n / 2) * 2 : n);
  const html = buildPage(data, { mode: 'capture' });
  return withPage(even(data.width), even(data.height), async (page) => {
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForFunction('window.__ready === true || window.__error', null, { timeout: 30000, polling: 50 });
    const err = await page.evaluate('window.__error');
    if (err) throw new Error(String(err));
    const info = (await page.evaluate('({ duration: window.__mg.duration, steps: window.__mg.steps })')) as CaptureInfo;
    return fn(page, info);
  }, { deviceScaleFactor: options.scale ?? 1 });
}
