import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  JETS_GHOST_MODEL,
  JETS_GHOST_PATHS,
} from '../../../src/features/jets-ghost/config';
import {
  LITERT_LM_WASM_ASSETS,
  resolveLiteRtAssetPath,
} from '../../../src/features/jets-ghost/runtime/liteRtAssets.server';

const repositoryFiles = [
  'THIRD_PARTY_NOTICES.md',
  'LICENSES/Apache-2.0.txt',
  'LICENSES/minisearch-7.2.0-MIT.txt',
  'LICENSES/stemmer-2.0.1-MIT.txt',
  'docs/verification/jets-ghost-licenses.md',
  'src/features/jets-ghost/licenses.server.ts',
  'src/pages/licenses/jets-ghost.astro',
  'src/pages/licenses/THIRD_PARTY_NOTICES.md.ts',
  'src/pages/licenses/apache-2.0.txt.ts',
  'src/pages/licenses/minisearch-7.2.0-MIT.txt.ts',
  'src/pages/licenses/stemmer-2.0.1-MIT.txt.ts',
  'src/pages/assistant/runtime/litert-lm/0.14.0/LICENSE.txt.ts',
] as const;

const packagePins = {
  'node_modules/@litert-lm/core': {
    version: '0.14.0',
    integrity: 'sha512-JQhvU6o6JY/Hyg5D59Xblp2H/Ynu4+a6omjekV3a+N2weh9pLnI3+ZP8AlkTbTjJjST893p3VuXd7O8dWelDCA==',
    tarballSha256: '07a56eac0b6a322764c6de908fa8cda83fa898ad15c256ae8a1e504df7189683',
  },
  'node_modules/@litertjs/wasm-utils': {
    version: '2.5.0',
    integrity: 'sha512-zhMAqJRJ3ROi48flZxYx+K2MiMllJVuH7oeumpSIfQMBeOb6JyLV/7ltLbY6E+nERUAfNwzIBqjslWAeXcO6iQ==',
    tarballSha256: '31005ff8a5fb3b57e6deaa71302e7238f8943f096a1cadcc464e0213981010ae',
  },
  'node_modules/minisearch': {
    version: '7.2.0',
    integrity: 'sha512-dqT2XBYUOZOiC5t2HRnwADjhNS2cecp9u+TJRiJ1Qp/f5qjkeT5APcGPjHw+bz89Ms8Jp+cG4AlE+QZ/QnDglg==',
    tarballSha256: 'cb3b8126a3ea65d6b387787294f0792b0ea4a40b70f8f37688066a5638e0218a',
  },
  'node_modules/stemmer': {
    version: '2.0.1',
    integrity: 'sha512-bkWvSX2JR4nSZFfs113kd4C6X13bBBrg4fBKv2pVdzpdQI2LA5pZcWzTFNdkYsiUNl13E4EzymSRjZ0D55jBYg==',
    tarballSha256: 'e94a3698cc7c6efcd2a9f29e94868c64c03416e86a1eea355bb3e5b059608900',
  },
} as const;

const expectedAssets = {
  'litertlm_wasm_asyncify_internal.js': [299_492, '0923d5f9aec5d67d4727bc3a5d1f7c8b869888e6871af7aebf7f4409d85f205a'],
  'litertlm_wasm_asyncify_internal.wasm': [31_087_784, 'b5fc9badbc1269e11a0e584f8181dd344a89b20c9b23af588a8425b61fc0aa91'],
  'litertlm_wasm_compat_asyncify_internal.js': [299_703, 'e70290e04da1707ad5a0ab6b2d7710fe142cde2531f5d7af911ee0e6ca01121b'],
  'litertlm_wasm_compat_asyncify_internal.wasm': [31_061_346, '6241ce86fe188a9d082e411bed3f9e48ed7f6ca489b2a593b789f7a7c007296e'],
  'litertlm_wasm_compat_internal.js': [292_178, 'cf05b41a3b9a61fe9dab3aa89466187e08cda08ca8a8ef12f6a2eeaf280208bd'],
  'litertlm_wasm_compat_internal.wasm': [19_821_785, 'ddae2e0bdadbd465adbf1c8a5243a466e2a225e2a0d54261c43fcfc81e3d9947'],
  'litertlm_wasm_internal.js': [291_938, '7445e88c57cab3e645dff2136e9321d0a9e7be0616afbec1c928e7fdb5691d6f'],
  'litertlm_wasm_internal.wasm': [19_848_204, '54c3c54b6fedc89267556ba73abeab2f6ec3cfdece8c6e9e0e2d71e9786f437b'],
} as const;

function readRequired(path: string): string {
  expect(existsSync(path), `${path} is required`).toBe(true);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe("Jet's Ghost exact license bundle", () => {
  it('ships every repository and public-surface source file', () => {
    for (const path of repositoryFiles) {
      expect(existsSync(path), path).toBe(true);
    }
  });

  it('retains the exact authoritative license bytes', () => {
    const apache = readRequired('LICENSES/Apache-2.0.txt');
    const minisearch = readRequired('LICENSES/minisearch-7.2.0-MIT.txt');
    const stemmer = readRequired('LICENSES/stemmer-2.0.1-MIT.txt');

    expect(Buffer.byteLength(apache)).toBe(11_358);
    expect(sha256(apache)).toBe('cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30');
    expect(sha256(minisearch)).toBe('70d37354d6395629fb99edb28cb37a5d356ffa24a48cd02a5def5b83a300a899');
    expect(sha256(stemmer)).toBe('9966260ba3ea9d6a5f839297dca80ddc99735a34b4ae82811cac7b956d2e3afd');
    expect(minisearch).toBe(readFileSync('node_modules/minisearch/LICENSE.txt', 'utf8'));
    expect(stemmer).toBe(readFileSync('node_modules/stemmer/license', 'utf8'));
  });

  it('pins the exact model, package graph, and served LiteRT-LM asset bytes', () => {
    expect(JETS_GHOST_MODEL).toMatchObject({
      repositoryRevision: '9262660a1676eed6d0c477ab1a86344430854664',
      filename: 'gemma-4-E2B-it-web.litertlm',
      bytes: 2_008_432_640,
      sha256: '3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5',
    });
    expect(JETS_GHOST_MODEL.url).toBe(
      'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/9262660a1676eed6d0c477ab1a86344430854664/gemma-4-E2B-it-web.litertlm',
    );
    expect(JETS_GHOST_PATHS.licenses).toBe('/licenses/jets-ghost/');
    expect(JETS_GHOST_PATHS.liteRtLicense).toBe(
      '/assistant/runtime/litert-lm/0.14.0/LICENSE.txt',
    );

    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
      packages: Record<string, { version?: string; integrity?: string }>;
    };
    const notices = readRequired('THIRD_PARTY_NOTICES.md');
    for (const [path, expected] of Object.entries(packagePins)) {
      expect(lock.packages[path]).toMatchObject({
        version: expected.version,
        integrity: expected.integrity,
      });
      expect(notices).toContain(expected.version);
      expect(notices).toContain(expected.integrity);
      expect(notices).toContain(expected.tarballSha256);
    }

    expect(new Set(LITERT_LM_WASM_ASSETS)).toEqual(new Set(Object.keys(expectedAssets)));
    for (const [asset, [bytes, digest]] of Object.entries(expectedAssets)) {
      const path = resolveLiteRtAssetPath(asset);
      expect(statSync(path).size, asset).toBe(bytes);
      expect(sha256(readFileSync(path)), asset).toBe(digest);
      expect(notices).toContain(asset);
      expect(notices).toContain(bytes.toLocaleString('en-US'));
      expect(notices).toContain(digest);
    }
  });

  it('retains only the evidence-backed copyright and notice statements', () => {
    const notices = readRequired('THIRD_PARTY_NOTICES.md');
    for (const statement of [
      'Copyright 2025 Google LLC',
      'Copyright 2026 Google LLC',
      'Copyright 2026 The ODML Authors.',
      'Copyright 2022 Luca Ongaro',
      'Copyright (c) 2014 Titus Wormer <tituswormer@gmail.com>',
    ]) {
      expect(notices).toContain(statement);
    }
    expect(notices).toContain('No upstream `NOTICE` file was present');
    expect(notices).toContain('No upstream `NOTICE` text is invented');
    expect(notices).not.toContain('Google DeepMind copyright');
    expect(notices).not.toContain('powered by Gemma');
  });

  it('separates obligations, upstream defects, hypothetical risk, and actual blockers', () => {
    const review = readRequired('docs/verification/jets-ghost-licenses.md');
    for (const heading of [
      '## Confirmed license obligations',
      '## Distribution determinations',
      '## Verified upstream packaging and provenance defects',
      '## Hypothetical undisclosed transitive-license risk',
      '## Actual release blockers',
    ]) {
      expect(review).toContain(heading);
    }
    expect(review).toContain('not legal advice');
    expect(review).toContain('does not by itself block distribution');
    expect(review).toContain('No presently identified license blocks distribution');
    expect(review).toContain('Apache License 2.0 section 4(a)');
    expect(review).toContain('project delivery gates, not established license requirements');
    expect(review).toContain('triggers re-audit rather than proving a legal prohibition');
    expect(review).toContain(
      'legacy Gemma Terms special Notice and clickwrap wording do not apply to Gemma 4',
    );
    expect(review).toContain(
      'advice-worthy residual ambiguity, not an identified prohibition',
    );
    for (const determination of [
      'Direct Hugging Face download',
      'Ordinary browser caching',
      'Bundling the eight runtime assets',
      'Descriptive public model naming',
      'Future model mirroring',
    ]) {
      expect(review).toContain(determination);
    }
    expect(review).toContain('Apache License 2.0 section 2');
    expect(review).toContain('section 4 conditions');
    expect(review).toContain('section 6');
    expect(review).toContain(
      'does not require separate permission beyond the Apache grant',
    );
    expect(review).toContain(
      'A future mirror triggers a fresh audit, not a current prohibition',
    );
    for (const source of [
      'https://ai.google.dev/gemma/terms',
      'https://ai.google.dev/gemma/prohibited_use_policy',
      'https://registry.npmjs.org/%40litert-lm%2Fcore/0.14.0',
      'https://registry.npmjs.org/@litert-lm/core/-/core-0.14.0.tgz',
      'https://registry.npmjs.org/%40litertjs%2Fwasm-utils/2.5.0',
      'https://registry.npmjs.org/@litertjs/wasm-utils/-/wasm-utils-2.5.0.tgz',
      'https://registry.npmjs.org/minisearch/7.2.0',
      'https://registry.npmjs.org/minisearch/-/minisearch-7.2.0.tgz',
      'https://github.com/lucaong/minisearch/blob/3d239d1c3ae7aef1bf5d8945dd7b5f0709f646f5/LICENSE.txt',
      'https://registry.npmjs.org/stemmer/2.0.1',
      'https://registry.npmjs.org/stemmer/-/stemmer-2.0.1.tgz',
      'https://github.com/words/stemmer/blob/74966c2bc432fc0f7873142268badded3368f405/license',
    ]) {
      expect(review).toContain(source);
    }
    expect(review).not.toMatch(/\bnoindex\b|search indexing|Search Console/iu);
    expect(review).not.toContain('missing SBOM is a release blocker');
  });

  it('links the exact model and complete public license surface before load', () => {
    const readme = readRequired('README.md');
    const experience = readRequired('src/features/jets-ghost/JetsGhostExperience.tsx');
    const licensePage = readRequired('src/pages/licenses/jets-ghost.astro');

    expect(readme).toContain('Gemma 4 E2B');
    expect(readme).toContain('9262660a1676eed6d0c477ab1a86344430854664');
    expect(readme).toContain('gemma-4-E2B-it-web.litertlm');
    expect(readme).toContain('2,008,432,640 bytes');
    expect(readme).toContain('3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5');
    expect(readme).toContain('./THIRD_PARTY_NOTICES.md');
    expect(readme).toContain('https://jetsanchez.com/licenses/jets-ghost/');
    expect(readme).toContain('directly from Hugging Face');

    expect(experience).toContain(
      'Jet&apos;s Ghost runs frontier local AI in this browser, grounded in Jet&apos;s published works. Starting it downloads about 2 GB and may use substantial GPU memory.',
    );
    expect(experience).toContain('href={JETS_GHOST_PATHS.licenses}');
    expect(experience).toContain('jet-web {appVersion}');
    expect(experience).toContain(
      'aria-label="Open Jet&apos;s Ghost model and open-source licenses"',
    );
    expect(experience).not.toContain('Model:');
    expect(experience).not.toContain('Gemma 4 E2B');
    expect(experience).not.toContain(
      'The load action downloads the pinned',
    );

    expect(licensePage).toContain(
      'title="Jet\'s Ghost model and open-source licenses"',
    );
    expect(licensePage).toContain(
      "Jet's Ghost model and open-source licenses",
    );
    expect(licensePage).toMatch(
      /<h1[^>]*>\s*Jet's Ghost model and open-source licenses\s*<\/h1>/,
    );
    expect(licensePage).not.toContain('title="Model and open-source licenses"');
    expect(licensePage).toContain('href="/chatbot/"');
    expect(licensePage).toContain("Back to Jet's Ghost");
    expect(licensePage).toContain('<span class="text-accent-base">←</span>');
    expect(licensePage).not.toContain('uppercase tracking-wide');
    expect(licensePage).toContain('Read third-party notices');
    expect(licensePage).not.toContain('Read THIRD_PARTY_NOTICES.md');
    expect(licensePage).toContain('Gemma 4 E2B');
    expect(licensePage).toContain(
      "import Link from '../../components/ui/Link.astro';",
    );
    for (const href of [
      '/licenses/apache-2.0.txt',
      '/licenses/minisearch-7.2.0-MIT.txt',
      '/licenses/stemmer-2.0.1-MIT.txt',
      '/assistant/runtime/litert-lm/0.14.0/LICENSE.txt',
    ]) {
      expect(licensePage).toMatch(
        new RegExp(`<Link[^>]*href="${href.replaceAll('.', '\\.')}"`),
      );
    }
    expect(licensePage).toContain('href="/licenses/THIRD_PARTY_NOTICES.md"');
    expect(licensePage).not.toContain('underline underline-offset-4');
    expect(licensePage).toContain(
      "import Card from '../../components/ui/Card.astro';",
    );
    expect(licensePage.match(/<Card\s+surface="subtle"/g)).toHaveLength(4);
    expect(licensePage).not.toContain(
      'rounded-xl border border-border-default bg-bg-subtle p-card',
    );
    expect(licensePage).toContain('space-y-xl');
    expect(licensePage).toContain('space-y-s');
    expect(licensePage).toContain('mb-l');
    expect(licensePage).not.toMatch(/\b(?:sm|md|lg|xl):(?:p|m|gap|space-|inset)/);
  });
});
