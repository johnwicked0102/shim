import AxeBuilder from '@axe-core/playwright';
import { chromium, expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { startServer, stopServer } from './static-server.mjs';

const ROOT = resolve(process.cwd());
const OUT = join(ROOT, 'e2e', '.builds', 'a11y');

test('no WCAG A/AA violations in light and dark themes', async () => {
  execSync(`npx vite build --outDir ${OUT} --emptyOutDir`, { cwd: ROOT, stdio: 'pipe' });
  const server = await startServer(OUT, 4399);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: process.env.CHROMIUM_PATH ? ['--no-sandbox', '--no-zygote'] : [],
  });
  try {
    for (const colorScheme of ['light', 'dark'] as const) {
      for (const width of [1280, 390]) {
        const ctx = await browser.newContext({ colorScheme, viewport: { width, height: 900 } });
        const page = await ctx.newPage();
        await page.goto('http://127.0.0.1:4399/');
        await page.getByTestId('input').fill('Apple\nBanana');
        await page.waitForTimeout(400);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
        expect(summary, `${colorScheme} @ ${width}px`).toEqual([]);
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    await stopServer(server);
  }
});
