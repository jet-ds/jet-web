import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkCache, fetchArtifacts } from '../../../src/utils/artifact-loader';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
};
const astroConfig = readFileSync('astro.config.mjs', 'utf8');
const artifactLoader = readFileSync('src/utils/artifact-loader.ts', 'utf8');

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

  it('removes active hosted-chat routes and keeps generated artifacts absent', () => {
    expect(existsSync('src/pages/api/chat.ts')).toBe(false);
    expect(existsSync('src/pages/chatbot.astro')).toBe(false);
    expect(existsSync('src/config/chatbot-artifacts.json')).toBe(false);
    expect(readFileSync('.gitignore', 'utf8')).not.toContain('src/config/chatbot-artifacts.json');
  });

  it('uses the exact interim permanent chatbot redirect', () => {
    const vercelConfig = existsSync('vercel.json')
      ? JSON.parse(readFileSync('vercel.json', 'utf8')) as unknown
      : undefined;
    expect(vercelConfig).toEqual({
      $schema: 'https://openapi.vercel.sh/vercel.json',
      redirects: [
        {
          source: '/chatbot',
          destination: '/tools/chatbot',
          permanent: true,
        },
      ],
    });
  });

  it('ignores generated verification output directories', () => {
    assertGeneratedOutputIgnores((path) => spawnSync(
      'git',
      ['check-ignore', '--quiet', '--no-index', path],
      { cwd: process.cwd() },
    ).status === 0);
  });

  it('keeps the orphaned artifact loader inert without hosted config, cache, or fetch access', async () => {
    expect(artifactLoader).not.toContain('chatbot-artifacts.json');
    expect(artifactLoader).not.toContain("from 'idb'");
    expect(artifactLoader).not.toMatch(/\bfetch\s*\(/u);
    await expect(checkCache()).resolves.toBeNull();

    const legacyCache = {
      buildHash: 'retired',
      timestamp: 0,
      embeddings: new ArrayBuffer(0),
      manifest: {} as never,
      chunks: [],
    };
    await expect(fetchArtifacts(legacyCache)).rejects.toMatchObject({
      name: 'ChatbotError',
      type: 'artifacts-fetch-failed',
      message: 'Hosted chatbot artifacts are retired.',
      recoverable: false,
    });
  });
});
