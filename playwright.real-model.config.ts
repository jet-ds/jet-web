import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.REAL_MODEL_BASE_URL;

export default defineConfig({
  testDir: './tests/manual',
  outputDir: 'test-results/playwright',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30 * 60_000,
  preserveOutput: 'never',
  reporter: 'list',
  use: {
    baseURL: externalBaseUrl ?? 'http://127.0.0.1:4322',
    headless: false,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: externalBaseUrl ? undefined : {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4322',
    url: 'http://127.0.0.1:4322',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{
    name: 'chrome-real-model',
    use: { ...devices['Desktop Chrome'], channel: 'chrome' },
  }],
});
