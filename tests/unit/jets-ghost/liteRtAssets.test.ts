import { readFile, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { JETS_GHOST_PATHS } from '../../../src/features/jets-ghost/config';
import {
  LITERT_LM_WASM_ASSETS,
  getLiteRtAssetContentType,
  resolveLiteRtAssetPath,
} from '../../../src/features/jets-ghost/runtime/liteRtAssets.server';
import {
  GET,
  getStaticPaths,
  prerender,
} from '../../../src/pages/assistant/runtime/litert-lm/0.14.0/[asset]';

const readFileAsync = promisify(readFile);

const expectedAssets = [
  'litertlm_wasm_internal.js',
  'litertlm_wasm_internal.wasm',
  'litertlm_wasm_asyncify_internal.js',
  'litertlm_wasm_asyncify_internal.wasm',
  'litertlm_wasm_compat_internal.js',
  'litertlm_wasm_compat_internal.wasm',
  'litertlm_wasm_compat_asyncify_internal.js',
  'litertlm_wasm_compat_asyncify_internal.wasm',
] as const;

describe('LiteRT-LM same-origin assets', () => {
  it('pins the installed package and exact public WASM allowlist', () => {
    const packageDirectory = dirname(dirname(resolveLiteRtAssetPath(expectedAssets[0])));
    const packageJson = JSON.parse(
      readFileSync(join(packageDirectory, 'package.json'), 'utf8'),
    ) as { version: string };

    expect(packageJson.version).toBe('0.14.0');
    expect(LITERT_LM_WASM_ASSETS).toEqual(expectedAssets);
    expect(JETS_GHOST_PATHS.liteRtWasm).toBe('/assistant/runtime/litert-lm/0.14.0/');
  });

  it('prerenders only the allowlisted package assets', () => {
    expect(prerender).toBe(true);
    expect(getStaticPaths()).toEqual(expectedAssets.map((asset) => ({
      params: { asset },
    })));
  });

  it.each(expectedAssets)('emits %s byte-for-byte with the correct content type', async (asset) => {
    const installedBytes = await readFileAsync(resolveLiteRtAssetPath(asset));
    const response = await GET({ params: { asset } });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(getLiteRtAssetContentType(asset));
    expect(Buffer.from(await response.arrayBuffer()).equals(installedBytes)).toBe(true);
  });

  it.each(['unknown.wasm', '../litertlm_wasm_internal.wasm', 'nested/file.js']) (
    'rejects unknown or path-traversal asset %s',
    async (asset) => {
      expect(() => resolveLiteRtAssetPath(asset)).toThrow('LITERT_ASSET_NOT_ALLOWED');

      const response = await GET({ params: { asset } });

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('');
    },
  );

  it('configures immutable caching alongside the permanent legacy redirect', () => {
    const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      redirects?: unknown[];
      headers?: Array<{
        source: string;
        headers: Array<{ key: string; value: string }>;
      }>;
    };

    expect(vercelConfig.redirects).toContainEqual({
      source: '/tools/chatbot/',
      destination: '/chatbot/',
      permanent: true,
    });
    expect(vercelConfig.headers).toContainEqual({
      source: '/assistant/runtime/litert-lm/0.14.0/:asset',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    });
  });
});
