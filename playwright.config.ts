import { defineConfig } from '@playwright/test';

/**
 * End-to-end offline tests run against the real production build in Chromium.
 * Set CHROMIUM_PATH to use a specific browser binary (e.g. in CI sandboxes).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: process.env.CHROMIUM_PATH ? ['--no-sandbox', '--no-zygote'] : [],
    },
  },
});
