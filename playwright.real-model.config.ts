import { defineConfig, devices } from '@playwright/test';
import { resolveQualificationRunContract } from './tests/manual/qualificationContract';

const externalBaseUrl = process.env.REAL_MODEL_BASE_URL;

if (process.env.RUN_REAL_MODEL === '1') {
  resolveQualificationRunContract({
    mode: process.env.EGREGORE_REAL_MODEL_MODE,
    cdpEndpoint: process.env.EGREGORE_CDP_ENDPOINT,
    removeDownloadedModel:
      process.env.EGREGORE_REMOVE_MODEL_AFTER_QUALIFICATION === '1',
  });
}

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
  webServer: externalBaseUrl
    ? undefined
    : {
        command:
          'cross-env PUBLIC_EGREGORE_QUALIFICATION=1 npm run build && npm run preview -- --host 127.0.0.1 --port 4322',
        url: 'http://127.0.0.1:4322',
        reuseExistingServer: false,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chrome-real-model',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
