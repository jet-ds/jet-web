import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import playwrightConfig from '../../../playwright.config';
import productionPlaywrightConfig from '../../../playwright.production.config';
import releasePlaywrightConfig from '../../../playwright.release.config';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
};
const astroConfig = readFileSync('astro.config.mjs', 'utf8');

type CheckIgnore = (path: string) => boolean;

function assertGeneratedOutputIgnores(checkIgnore: CheckIgnore): void {
  for (const path of [
    'coverage/.build-purity-probe',
    'playwright-report/.build-purity-probe',
    'test-results/.build-purity-probe',
  ]) {
    expect(checkIgnore(path), `${path} must be ignored`).toBe(true);
  }
}

describe('static production boundary', () => {
  it('builds Astro without remote-writing embedding work', () => {
    expect(packageJson.scripts.build).toContain('astro build');
    expect(packageJson.scripts.build).not.toContain('embedding');
    expect(packageJson.scripts['build:embeddings']).toBeUndefined();
  });

  it('does not configure the Vercel server adapter', () => {
    expect(packageJson.dependencies['@astrojs/vercel']).toBeUndefined();
    expect(astroConfig).not.toContain("from '@astrojs/vercel'");
    expect(astroConfig).not.toContain('adapter:');
  });

  it('emits browser syntax for the declared support floor', () => {
    expect(astroConfig).toMatch(
      /target:\s*\[\s*'chrome111',\s*'safari16\.4',\s*'firefox128',?\s*\]/u,
    );
  });

  it('keeps the local assistant static while hosted-chat artifacts remain absent', () => {
    expect(existsSync('src/pages/api/chat.ts')).toBe(false);
    expect(existsSync('src/pages/chatbot.astro')).toBe(true);
    expect(existsSync('src/pages/tools/chatbot.astro')).toBe(false);
    expect(existsSync('src/config/chatbot-artifacts.json')).toBe(false);
    expect(existsSync('src/utils/artifact-loader.ts')).toBe(false);
    expect(readFileSync('.gitignore', 'utf8')).not.toContain(
      'src/config/chatbot-artifacts.json',
    );
  });

  it('publishes the maintained Egregore real-model qualification commands', () => {
    expect(packageJson.scripts['qualify:egregore:mac']).toContain(
      'EGREGORE_REAL_MODEL_MODE=qualification',
    );
    expect(packageJson.scripts['qualify:egregore:warm']).toContain(
      'EGREGORE_REAL_MODEL_MODE=warm-resume',
    );
    expect(packageJson.scripts['smoke:egregore']).toContain(
      'EGREGORE_REAL_MODEL_MODE=smoke',
    );
  });

  it('uses trailing-slash normalization with only the permanent legacy redirects', () => {
    const vercelConfig = existsSync('vercel.json')
      ? (JSON.parse(readFileSync('vercel.json', 'utf8')) as {
          trailingSlash?: boolean;
          redirects?: unknown[];
        })
      : undefined;
    expect(vercelConfig).toMatchObject({
      trailingSlash: true,
      redirects: [
        {
          source: '/tools/chatbot/',
          destination: '/chatbot/',
          permanent: true,
        },
        {
          source: '/licenses/jets-ghost/',
          destination: '/licenses/egregore/',
          permanent: true,
        },
      ],
    });
    expect(vercelConfig?.redirects).toHaveLength(2);
  });

  it('ignores generated verification output directories', () => {
    assertGeneratedOutputIgnores(
      (path) =>
        spawnSync('git', ['check-ignore', '--quiet', '--no-index', path], {
          cwd: process.cwd(),
        }).status === 0,
    );
  });

  it('isolates disposable Playwright output from preserved release evidence', () => {
    expect(playwrightConfig.outputDir).toBe('test-results/playwright');
    expect(productionPlaywrightConfig.outputDir).toBe(
      'test-results/playwright',
    );
  });

  it('keeps routine browser verification retry-free and exposes a fresh-server qualification switch', () => {
    expect(playwrightConfig.retries).toBe(0);
    expect(packageJson.scripts['verify:release-browsers']).toBe(
      'playwright test --config=playwright.release.config.ts',
    );

    const probe = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--eval',
        "import('./playwright.config.ts').then(({ default: config }) => console.log(JSON.stringify(config.webServer)))",
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          PLAYWRIGHT_FORCE_FRESH_SERVER: '1',
        },
      },
    );
    expect(probe.status, probe.stderr).toBe(0);
    expect(JSON.parse(probe.stdout)).toMatchObject({
      reuseExistingServer: false,
    });
  });

  it('qualifies the release candidate in current Chromium, Firefox, and WebKit', () => {
    expect(releasePlaywrightConfig.retries).toBe(0);
    expect(
      releasePlaywrightConfig.projects?.map(({ name, use }) => ({
        name,
        browser: (use as { defaultBrowserType?: string } | undefined)
          ?.defaultBrowserType,
      })),
    ).toEqual([
      { name: 'chromium', browser: 'chromium' },
      { name: 'firefox', browser: 'firefox' },
      { name: 'webkit', browser: 'webkit' },
    ]);
    expect(releasePlaywrightConfig.webServer).toMatchObject({
      command: 'npm run build && npm run preview -- --host 127.0.0.1',
      env: {
        ASTRO_PREVIEW_BACKGROUND: '0',
        PUBLIC_EGREGORE_E2E: '1',
      },
      reuseExistingServer: false,
    });
  });
});
