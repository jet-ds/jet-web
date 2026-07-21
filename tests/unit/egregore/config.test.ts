import { describe, expect, it } from 'vitest';
import {
  EGREGORE_CONTEXT,
  EGREGORE_MODEL,
  EGREGORE_PATHS,
} from '../../../src/features/egregore/config';

describe('Egregore configuration', () => {
  it('pins the approved E2B web artifact', () => {
    expect(EGREGORE_MODEL.packageVersion).toBe('0.14.0');
    expect(EGREGORE_MODEL.url).toContain('9262660a1676eed6d0c477ab1a86344430854664');
    expect(EGREGORE_MODEL.bytes).toBe(2_008_432_640);
    expect(EGREGORE_MODEL.sha256).toBe('3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5');
    expect(EGREGORE_MODEL.maxRedirects).toBe(5);
    expect(EGREGORE_MODEL.trustedOrigins).toEqual([
      { hostname: 'huggingface.co', allowSubdomains: false },
      { hostname: 'cdn.hf.co', allowSubdomains: true },
      { hostname: 'xethub.hf.co', allowSubdomains: true },
    ]);
  });

  it('reserves context headroom', () => {
    expect(EGREGORE_CONTEXT.knowledgeLimit).toBe(9_011);
    expect(EGREGORE_CONTEXT.maxContextTokens).toBe(16_384);
    expect(Object.entries(EGREGORE_CONTEXT)
      .filter(([key]) => key !== 'maxContextTokens')
      .reduce((sum, [, value]) => sum + value, 0)).toBe(16_384);
  });

  it('uses same-origin corpus and runtime paths without duplicating the public license route', () => {
    expect(EGREGORE_PATHS).toEqual({
      manifest: '/assistant/corpus/manifest.json',
      content: '/assistant/corpus/content.json',
      index: '/assistant/corpus/index.json',
      liteRtWasm: '/assistant/runtime/litert-lm/0.14.0/',
      liteRtLicense: '/assistant/runtime/litert-lm/0.14.0/LICENSE.txt',
    });
    expect('licenses' in EGREGORE_PATHS).toBe(false);
  });
});
