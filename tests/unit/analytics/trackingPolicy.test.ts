import { describe, expect, it } from 'vitest';
import { shouldEmitProductionAnalytics } from '../../../src/features/analytics/trackingPolicy';

describe('production analytics build policy', () => {
  it.each([
    { vercelEnv: 'production', expected: true },
    { vercelEnv: 'preview', expected: false },
    { vercelEnv: 'development', expected: false },
    { vercelEnv: undefined, expected: false },
  ])(
    'returns $expected when VERCEL_ENV is $vercelEnv',
    ({ vercelEnv, expected }) => {
      expect(shouldEmitProductionAnalytics({ vercelEnv })).toBe(expected);
    },
  );
});
