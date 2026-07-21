import { describe, expect, it } from 'vitest';
import { EGREGORE_IDENTITY } from '../../../src/config/egregore';
import { NAV_ITEMS } from '../../../src/config/site';

describe('Egregore identity', () => {
  it('owns the maintained product name and stable public paths', () => {
    expect(EGREGORE_IDENTITY).toEqual({
      name: 'Egregore',
      canonicalPath: '/chatbot/',
      licensePath: '/licenses/egregore/',
      legacyLicensePath: '/licenses/jets-ghost/',
    });
  });

  it('projects into navigation without changing the canonical route', () => {
    expect(NAV_ITEMS.find(({ href }) => href === EGREGORE_IDENTITY.canonicalPath))
      .toMatchObject({ id: 'egregore', label: 'Egregore', href: '/chatbot/' });
  });
});
