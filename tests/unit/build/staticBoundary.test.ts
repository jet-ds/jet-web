import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import playwrightConfig from '../../../playwright.config';
import productionPlaywrightConfig from '../../../playwright.production.config';

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

  it('keeps the local assistant static while hosted-chat artifacts remain absent', () => {
    expect(existsSync('src/pages/api/chat.ts')).toBe(false);
    expect(existsSync('src/pages/chatbot.astro')).toBe(true);
    expect(existsSync('src/pages/tools/chatbot.astro')).toBe(false);
    expect(existsSync('src/config/chatbot-artifacts.json')).toBe(false);
    expect(existsSync('src/utils/artifact-loader.ts')).toBe(false);
    expect(readFileSync('.gitignore', 'utf8')).not.toContain('src/config/chatbot-artifacts.json');
  });

  it('uses exact trailing-slash normalization with the permanent legacy redirect', () => {
    const vercelConfig = existsSync('vercel.json')
      ? JSON.parse(readFileSync('vercel.json', 'utf8')) as unknown
      : undefined;
    expect(vercelConfig).toEqual({
      $schema: 'https://openapi.vercel.sh/vercel.json',
      trailingSlash: true,
      headers: [
        ...['content', 'index', 'manifest'].map((file) => ({
          source: `/assistant/corpus/${file}.json`,
          headers: [
            {
              key: 'X-Robots-Tag',
              value: 'noindex, nofollow',
            },
          ],
        })),
        {
          source: '/assistant/runtime/litert-lm/0.14.0/:asset',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
            },
          ],
        },
      ],
      redirects: [
        {
          source: '/tools/chatbot/',
          destination: '/chatbot/',
          permanent: true,
        },
      ],
    });
  });

  it('filters only qualification routes from the sitemap without hiding lookalikes', () => {
    expect(astroConfig).toContain("const pathname = new URL(page).pathname.replace(/\\/$/, '') || '/';");
    expect(astroConfig).toContain("pathname !== '/chatbot'");
    expect(astroConfig).toContain("pathname !== '/tools'");
    expect(astroConfig).toContain("!pathname.startsWith('/tools/')");
    expect(astroConfig).not.toContain("page.includes('/chatbot')");
    expect(astroConfig).not.toContain("page.includes('/tools')");
    expect(astroConfig).not.toContain("pathname.startsWith('/tools')");
  });

  it('ignores generated verification output directories', () => {
    assertGeneratedOutputIgnores((path) => spawnSync(
      'git',
      ['check-ignore', '--quiet', '--no-index', path],
      { cwd: process.cwd() },
    ).status === 0);
  });

  it('isolates disposable Playwright output from preserved release evidence', () => {
    expect(playwrightConfig.outputDir).toBe('test-results/playwright');
    expect(productionPlaywrightConfig.outputDir).toBe('test-results/playwright');
  });

});
