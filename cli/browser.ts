import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Browser, Page } from 'playwright-core';

export type { Browser, Page };

// playwright-core is an optional peer dependency: only the CLI needs it, not the browser library.
async function loadChromium() {
  try {
    return (await import('playwright-core')).chromium;
  } catch {
    throw new Error('The inkmark CLI needs playwright-core. Install it with: npm install --save-dev playwright-core');
  }
}

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
  const chromium = await loadChromium();
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
  options: { deviceScaleFactor?: number; colorScheme?: 'light' | 'dark' } = {},
): Promise<T> {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: Math.round(width), height: Math.round(height) },
      deviceScaleFactor: options.deviceScaleFactor ?? 1,
      colorScheme: options.colorScheme,
    });
    const page = await context.newPage();
    return await fn(page, browser);
  } finally {
    await browser.close();
  }
}
