import { describe, expect, it } from 'vitest';
import { SITE } from '../../../src/config/site';

describe('site configuration', () => {
  it('uses the production HTTPS origin', () => {
    expect(SITE.siteUrl).toBe('https://jetsanchez.com');
  });
});
