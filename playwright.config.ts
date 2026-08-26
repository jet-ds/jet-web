import { defineConfig, devices } from '@playwright/test';

const forceFreshServer = process.env.PLAYWRIGHT_FORCE_FRESH_SERVER === '1';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/playwright',
  fullyParallel: false,
  workers: process.env.CI ? 2 : 3,
  forbidOnly: Boolean(process.env.CI),
  failOnFlakyTests: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'npm run build && exec node node_modules/astro/bin/astro.mjs preview --host 127.0.0.1',
    env: {
      ASTRO_PREVIEW_BACKGROUND: '1',
      PUBLIC_EGREGORE_E2E: '1',
    },
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI && !forceFreshServer,
  },
  projects: [
    {
      name: 'chromium',
      grepInvert: /@mobile/u,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      grepInvert: /@desktop/u,
      use: { ...devices['Pixel 7'] },
    },
  ],
});
