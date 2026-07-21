import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/deployment',
  outputDir: 'test-results/playwright',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  preserveOutput: 'never',
  reporter: 'list',
  use: {
    baseURL: process.env.PRODUCTION_ORIGIN ?? 'https://jetsanchez.com',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
