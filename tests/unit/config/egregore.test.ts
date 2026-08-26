import { describe, expect, it } from 'vitest';
import { EGREGORE_IDENTITY } from '../../../src/config/egregore';

describe('Egregore identity', () => {
  it('owns the maintained product name and stable public paths', () => {
    expect(EGREGORE_IDENTITY).toEqual({
      name: 'Egregore',
      canonicalPath: '/chatbot/',
      licensePath: '/licenses/egregore/',
      legacyLicensePath: '/licenses/jets-ghost/',
    });
  });
});
