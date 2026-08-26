import { describe, expect, it, vi } from 'vitest';
import analyticsPolicyMiddleware, { config } from '../../../middleware';
import { ANALYTICS_POLICY_COOKIE } from '../../../src/features/analytics/regionalPolicy';

describe('analytics policy routing middleware', () => {
  it('matches only the static HTML document route families', () => {
    expect(config.matcher).toEqual([
      '/',
      '/about/:path*',
      '/blog/:path*',
      '/chatbot/:path*',
      '/contact/:path*',
      '/licenses/egregore/:path*',
      '/privacy/:path*',
      '/tools/:path*',
      '/works/:path*',
    ]);
  });

  it.each([
    { countryCode: 'DE', expected: 'strict' },
    { countryCode: 'US', expected: 'standard' },
    { countryCode: undefined, expected: 'strict' },
    { countryCode: 'ZZ', expected: 'strict' },
  ])(
    'sets only the coarse $expected policy for country $countryCode',
    async ({ countryCode, expected }) => {
      const headers = new Headers();
      if (countryCode !== undefined) {
        headers.set('x-vercel-ip-country', countryCode);
      }

      const response = analyticsPolicyMiddleware(
        new Request('https://jetsanchez.com/blog/', { headers }),
      );

      expect(response.headers.get('set-cookie')).toBe(
        `${ANALYTICS_POLICY_COOKIE}=${expected}; Max-Age=86400; Path=/; Secure; SameSite=Lax`,
      );
      expect([...response.headers]).not.toContainEqual([
        'x-vercel-ip-country',
        countryCode,
      ]);
    },
  );

  it('reads only the country header from the request boundary', () => {
    const get = vi.fn((name: string) =>
      name === 'x-vercel-ip-country' ? 'US' : null,
    );

    analyticsPolicyMiddleware({ headers: { get } } as unknown as Request);

    expect(get).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledWith('x-vercel-ip-country');
  });
});
