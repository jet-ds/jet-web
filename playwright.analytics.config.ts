import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'analytics.spec.ts',
  outputDir: 'test-results/playwright-analytics',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  failOnFlakyTests: true,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4323',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'cross-env VERCEL_ENV=production npm run build && exec tsx scripts/serve-analytics-fixture.ts',
    env: {
      ASTRO_PREVIEW_BACKGROUND: '1',
      VERCEL_ENV: 'production',
    },
    url: 'http://localhost:4323',
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
