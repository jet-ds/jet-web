// @vitest-environment node

import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

describe('retrieval browser dependency boundary', () => {
  it('bundles the rank-and-pack entrypoint for a browser without Node built-ins', async () => {
    const result = await build({
      entryPoints: ['src/features/egregore/selection/rankAndPack.ts'],
      bundle: true,
      format: 'esm',
      logLevel: 'silent',
      platform: 'browser',
      write: false,
    });

    expect(result.outputFiles).toHaveLength(1);
    expect(result.outputFiles[0].text).not.toContain('node:crypto');
  });
});
