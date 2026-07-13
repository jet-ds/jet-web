import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/deployment',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PRODUCTION_ORIGIN ?? 'https://jetsanchez.com',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
