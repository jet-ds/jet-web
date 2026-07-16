import { describe, expect, it } from 'vitest';
import {
  JETS_GHOST_CONTEXT,
  JETS_GHOST_MODEL,
  JETS_GHOST_PATHS,
} from '../../../src/features/jets-ghost/config';

describe("Jet's Ghost configuration", () => {
  it('pins the approved E2B web artifact', () => {
    expect(JETS_GHOST_MODEL.packageVersion).toBe('0.14.0');
    expect(JETS_GHOST_MODEL.url).toContain('9262660a1676eed6d0c477ab1a86344430854664');
    expect(JETS_GHOST_MODEL.bytes).toBe(2_008_432_640);
    expect(JETS_GHOST_MODEL.sha256).toBe('3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5');
    expect(JETS_GHOST_MODEL.maxRedirects).toBe(5);
    expect(JETS_GHOST_MODEL.trustedOrigins).toEqual([
      { hostname: 'huggingface.co', allowSubdomains: false },
      { hostname: 'cdn.hf.co', allowSubdomains: true },
      { hostname: 'xethub.hf.co', allowSubdomains: true },
    ]);
  });

  it('reserves context headroom', () => {
    expect(JETS_GHOST_CONTEXT.knowledgeLimit).toBe(9_011);
    expect(JETS_GHOST_CONTEXT.maxContextTokens).toBe(16_384);
    expect(Object.entries(JETS_GHOST_CONTEXT)
      .filter(([key]) => key !== 'maxContextTokens')
      .reduce((sum, [, value]) => sum + value, 0)).toBe(16_384);
  });

  it('uses same-origin corpus, runtime, and license paths', () => {
    expect(JETS_GHOST_PATHS).toEqual({
      manifest: '/assistant/corpus/manifest.json',
      content: '/assistant/corpus/content.json',
      index: '/assistant/corpus/index.json',
      liteRtWasm: '/assistant/runtime/litert-lm/0.14.0/',
      liteRtLicense: '/assistant/runtime/litert-lm/0.14.0/LICENSE.txt',
      licenses: '/licenses/jets-ghost/',
    });
  });
});
