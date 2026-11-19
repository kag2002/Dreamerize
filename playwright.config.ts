import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // Single worker avoids WebGL GPU resource contention on headless macOS
  retries: process.env.CI ? 2 : 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    channel: 'chrome',
    headless: true,
    launchOptions: {
      args: [
        '--headless=new',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--use-gl=angle',
        '--autoplay-policy=no-user-gesture-required',
        '--no-sandbox',
      ],
    },
  },
  webServer: {
    command: 'export PATH="/Users/lethienkhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH" && pnpm dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'tier1-feature-coverage',
      testMatch: /tier1-feature-coverage\/.*\.spec\.ts/,
    },
    {
      name: 'tier2-boundaries-corners',
      testMatch: /tier2-boundaries-corners\/.*\.spec\.ts/,
    },
    {
      name: 'tier3-combinations',
      testMatch: /tier3-combinations\/.*\.spec\.ts/,
    },
    {
      name: 'tier4-scenarios',
      testMatch: /tier4-scenarios\/.*\.spec\.ts/,
    },
  ],
});
