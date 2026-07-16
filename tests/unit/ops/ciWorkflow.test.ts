import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflowSource = readFileSync(
  resolve(process.cwd(), '.github/workflows/verify.yml'),
  'utf8',
);

describe('durable verification workflow', () => {
  it('runs on pull requests, main pushes, manual dispatch, and the Manila nightly schedule', () => {
    expect(workflowSource).toMatch(/\n  pull_request:\s*\n/);
    expect(workflowSource).toMatch(/\n  push:\s*\n\s+branches: \[main\]/);
    expect(workflowSource).toMatch(/\n  workflow_dispatch:\s*\n/);
    expect(workflowSource).toMatch(
      /\n  schedule:\s*\n(?:\s+#.*\n)*\s+- cron: '17 18 \* \* \*'/,
    );
  });

  it('isolates nightly concurrency and never cancels an active nightly', () => {
    expect(workflowSource).toContain(
      "group: ${{ github.workflow }}-${{ github.event_name == 'schedule' && 'nightly' || github.ref }}",
    );
    expect(workflowSource).toContain(
      "cancel-in-progress: ${{ github.event_name != 'schedule' }}",
    );
  });

  it('keeps both required Node 24 jobs and the browser dependency ordering', () => {
    expect(workflowSource).toMatch(/\n  verify:\s*\n/);
    expect(workflowSource).toMatch(/\n  browser:\s*\n\s+needs: verify/);
    expect(workflowSource.match(/node-version: 24/g)).toHaveLength(2);
    expect(workflowSource.match(/- run: npm ci/g)).toHaveLength(2);
    expect(workflowSource).toContain('- run: npm run verify');
    expect(workflowSource).toContain(
      '- run: npx playwright install --with-deps chromium',
    );
    expect(workflowSource).toContain('- run: npm run verify:browser');
  });

  it('keeps the approximately 2 GB real-model gate out of routine and nightly CI', () => {
    expect(workflowSource).not.toContain('qualify:jets-ghost');
    expect(workflowSource).not.toContain('RUN_REAL_MODEL');
    expect(workflowSource).not.toContain('REAL_MODEL_BASE_URL');
  });
});
