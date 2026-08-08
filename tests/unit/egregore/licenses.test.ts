import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { EGREGORE_IDENTITY } from '../../../src/config/egregore';
import {
  EGREGORE_MODEL,
  EGREGORE_PATHS,
} from '../../../src/features/egregore/config';
import { EGREGORE_LICENSE_BUNDLE } from '../../../src/features/egregore/licenses.server';
import {
  LITERT_LM_WASM_ASSETS,
  resolveLiteRtAssetPath,
} from '../../../src/features/egregore/runtime/liteRtAssets.server';
import { GET as getLiteRtLicense } from '../../../src/pages/assistant/runtime/litert-lm/0.14.0/LICENSE.txt';
import { GET as getThirdPartyNotices } from '../../../src/pages/licenses/THIRD_PARTY_NOTICES.md';
import { GET as getApacheLicense } from '../../../src/pages/licenses/apache-2.0.txt';
import { GET as getMiniSearchLicense } from '../../../src/pages/licenses/minisearch-7.2.0-MIT.txt';
import { GET as getStemmerLicense } from '../../../src/pages/licenses/stemmer-2.0.1-MIT.txt';

const packagePins = {
  'node_modules/@litert-lm/core': {
    version: '0.14.0',
    integrity:
      'sha512-JQhvU6o6JY/Hyg5D59Xblp2H/Ynu4+a6omjekV3a+N2weh9pLnI3+ZP8AlkTbTjJjST893p3VuXd7O8dWelDCA==',
    tarballSha256:
      '07a56eac0b6a322764c6de908fa8cda83fa898ad15c256ae8a1e504df7189683',
  },
  'node_modules/@litertjs/wasm-utils': {
    version: '2.5.0',
    integrity:
      'sha512-zhMAqJRJ3ROi48flZxYx+K2MiMllJVuH7oeumpSIfQMBeOb6JyLV/7ltLbY6E+nERUAfNwzIBqjslWAeXcO6iQ==',
    tarballSha256:
      '31005ff8a5fb3b57e6deaa71302e7238f8943f096a1cadcc464e0213981010ae',
  },
  'node_modules/minisearch': {
    version: '7.2.0',
    integrity:
      'sha512-dqT2XBYUOZOiC5t2HRnwADjhNS2cecp9u+TJRiJ1Qp/f5qjkeT5APcGPjHw+bz89Ms8Jp+cG4AlE+QZ/QnDglg==',
    tarballSha256:
      'cb3b8126a3ea65d6b387787294f0792b0ea4a40b70f8f37688066a5638e0218a',
  },
  'node_modules/stemmer': {
    version: '2.0.1',
    integrity:
      'sha512-bkWvSX2JR4nSZFfs113kd4C6X13bBBrg4fBKv2pVdzpdQI2LA5pZcWzTFNdkYsiUNl13E4EzymSRjZ0D55jBYg==',
    tarballSha256:
      'e94a3698cc7c6efcd2a9f29e94868c64c03416e86a1eea355bb3e5b059608900',
  },
} as const;

const expectedAssets = {
  'litertlm_wasm_asyncify_internal.js': [
    299_492,
    '0923d5f9aec5d67d4727bc3a5d1f7c8b869888e6871af7aebf7f4409d85f205a',
  ],
  'litertlm_wasm_asyncify_internal.wasm': [
    31_087_784,
    'b5fc9badbc1269e11a0e584f8181dd344a89b20c9b23af588a8425b61fc0aa91',
  ],
  'litertlm_wasm_compat_asyncify_internal.js': [
    299_703,
    'e70290e04da1707ad5a0ab6b2d7710fe142cde2531f5d7af911ee0e6ca01121b',
  ],
  'litertlm_wasm_compat_asyncify_internal.wasm': [
    31_061_346,
    '6241ce86fe188a9d082e411bed3f9e48ed7f6ca489b2a593b789f7a7c007296e',
  ],
  'litertlm_wasm_compat_internal.js': [
    292_178,
    'cf05b41a3b9a61fe9dab3aa89466187e08cda08ca8a8ef12f6a2eeaf280208bd',
  ],
  'litertlm_wasm_compat_internal.wasm': [
    19_821_785,
    'ddae2e0bdadbd465adbf1c8a5243a466e2a225e2a0d54261c43fcfc81e3d9947',
  ],
  'litertlm_wasm_internal.js': [
    291_938,
    '7445e88c57cab3e645dff2136e9321d0a9e7be0616afbec1c928e7fdb5691d6f',
  ],
  'litertlm_wasm_internal.wasm': [
    19_848_204,
    '54c3c54b6fedc89267556ba73abeab2f6ec3cfdece8c6e9e0e2d71e9786f437b',
  ],
} as const;

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function invoke(handler: typeof getApacheLicense): Promise<Response> {
  return handler({} as Parameters<typeof handler>[0]);
}

describe('Egregore distributed license contract', () => {
  it('retains the exact authoritative license bytes', () => {
    const apache = readFileSync('LICENSES/Apache-2.0.txt', 'utf8');
    const minisearch = readFileSync(
      'LICENSES/minisearch-7.2.0-MIT.txt',
      'utf8',
    );
    const stemmer = readFileSync('LICENSES/stemmer-2.0.1-MIT.txt', 'utf8');

    expect(Buffer.byteLength(apache)).toBe(11_358);
    expect(sha256(apache)).toBe(
      'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30',
    );
    expect(sha256(minisearch)).toBe(
      '70d37354d6395629fb99edb28cb37a5d356ffa24a48cd02a5def5b83a300a899',
    );
    expect(sha256(stemmer)).toBe(
      '9966260ba3ea9d6a5f839297dca80ddc99735a34b4ae82811cac7b956d2e3afd',
    );
    expect(minisearch).toBe(
      readFileSync('node_modules/minisearch/LICENSE.txt', 'utf8'),
    );
    expect(stemmer).toBe(readFileSync('node_modules/stemmer/license', 'utf8'));
  });

  it('serves every public notice route from the distributed bundle', async () => {
    const routes = [
      [getThirdPartyNotices, EGREGORE_LICENSE_BUNDLE.notices],
      [getApacheLicense, EGREGORE_LICENSE_BUNDLE.apache],
      [getMiniSearchLicense, EGREGORE_LICENSE_BUNDLE.minisearch],
      [getStemmerLicense, EGREGORE_LICENSE_BUNDLE.stemmer],
      [getLiteRtLicense, EGREGORE_LICENSE_BUNDLE.apache],
    ] as const;

    for (const [handler, expected] of routes) {
      const response = await invoke(handler);
      expect(response.headers.get('content-type')).toBe(
        'text/plain; charset=utf-8',
      );
      expect(await response.text()).toBe(expected);
    }
  });

  it('pins the exact model, package graph, and served LiteRT-LM asset bytes', () => {
    expect(EGREGORE_MODEL).toMatchObject({
      repositoryRevision: '9262660a1676eed6d0c477ab1a86344430854664',
      filename: 'gemma-4-E2B-it-web.litertlm',
      bytes: 2_008_432_640,
      sha256:
        '3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5',
    });
    expect(EGREGORE_MODEL.url).toBe(
      'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/9262660a1676eed6d0c477ab1a86344430854664/gemma-4-E2B-it-web.litertlm',
    );
    expect(EGREGORE_IDENTITY.licensePath).toBe('/licenses/egregore/');
    expect('licenses' in EGREGORE_PATHS).toBe(false);
    expect(EGREGORE_PATHS.liteRtLicense).toBe(
      '/assistant/runtime/litert-lm/0.14.0/LICENSE.txt',
    );

    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
      packages: Record<string, { version?: string; integrity?: string }>;
    };
    const notices = EGREGORE_LICENSE_BUNDLE.notices;
    expect(notices).toMatch(/^# Egregore third-party notices$/mu);
    expect(notices).toContain('currently used by Egregore');
    expect(notices).toContain('unchanged from the 2.1.0 release record');
    for (const [path, expected] of Object.entries(packagePins)) {
      expect(lock.packages[path]).toMatchObject({
        version: expected.version,
        integrity: expected.integrity,
      });
      expect(notices).toContain(expected.version);
      expect(notices).toContain(expected.integrity);
      expect(notices).toContain(expected.tarballSha256);
    }

    expect(new Set(LITERT_LM_WASM_ASSETS)).toEqual(
      new Set(Object.keys(expectedAssets)),
    );
    for (const [asset, [bytes, digest]] of Object.entries(expectedAssets)) {
      const path = resolveLiteRtAssetPath(asset);
      expect(statSync(path).size, asset).toBe(bytes);
      expect(sha256(readFileSync(path)), asset).toBe(digest);
      expect(notices).toContain(asset);
      expect(notices).toContain(bytes.toLocaleString('en-US'));
      expect(notices).toContain(digest);
    }
  });

  it('publishes only the evidence-backed current notice statements', () => {
    const notices = EGREGORE_LICENSE_BUNDLE.notices;
    for (const statement of [
      'Copyright 2025 Google LLC',
      'Copyright 2026 Google LLC',
      'Copyright 2026 The ODML Authors.',
      'Copyright 2022 Luca Ongaro',
      'Copyright (c) 2014 Titus Wormer <tituswormer@gmail.com>',
      'No upstream `NOTICE` file was present',
      'No upstream `NOTICE` text is invented',
    ]) {
      expect(notices).toContain(statement);
    }
  });
});
