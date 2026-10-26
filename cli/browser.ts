import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import type { Browser, Page } from 'playwright-core';

export type { Browser, Page };

function cachedChromium(): string[] {
  const roots = [join(homedir(), 'Library', 'Caches', 'ms-playwright'), join(homedir(), '.cache', 'ms-playwright')];
  const found: { version: number; exe: string }[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      const m = /^chromium-(\d+)$/.exec(name);
      if (!m) continue;
      const base = join(root, name);
      const candidates = [
        join(base, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
        join(base, 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
        join(base, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
        join(base, 'chrome-linux64', 'chrome'),
        join(base, 'chrome-linux', 'chrome'),
      ];
      const exe = candidates.find(existsSync);
      if (exe) found.push({ version: Number(m[1]), exe });
    }
  }
  return found.sort((a, b) => b.version - a.version).map((f) => f.exe);
}

/** Starts headless Chromium. Tries the default build, then a cached build, then Chrome. */
export async function launchBrowser(): Promise<Browser> {
  const attempts: (() => Promise<Browser>)[] = [
    () => chromium.launch(),
    ...cachedChromium().map((executablePath) => () => chromium.launch({ executablePath })),
    () => chromium.launch({ channel: 'chrome' }),
  ];
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch {
      // try the next one
    }
  }
  throw new Error('No Chromium browser found. Run "npx playwright-core install chromium" or install Google Chrome.');
}

/** Opens a page with the given viewport, runs `fn`, and always closes the browser. */
export async function withPage<T>(
  width: number,
  height: number,
  fn: (page: Page, browser: Browser) => Promise<T>,
  options: { deviceScaleFactor?: number } = {},
): Promise<T> {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: Math.round(width), height: Math.round(height) },
      deviceScaleFactor: options.deviceScaleFactor ?? 1,
    });
    const page = await context.newPage();
    return await fn(page, browser);
  } finally {
    await browser.close();
  }
}
