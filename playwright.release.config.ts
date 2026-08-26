import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/playwright',
  fullyParallel: false,
  workers: process.env.CI ? 2 : 3,
  forbidOnly: true,
  failOnFlakyTests: true,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    env: {
      ASTRO_PREVIEW_BACKGROUND: '0',
      PUBLIC_EGREGORE_E2E: '1',
    },
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      grepInvert: /@mobile/u,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      grepInvert: /@mobile/u,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      grepInvert: /@mobile/u,
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
