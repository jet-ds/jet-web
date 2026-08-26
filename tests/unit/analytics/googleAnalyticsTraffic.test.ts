import { describe, expect, it } from 'vitest';
import { classifyGoogleAnalyticsRequest } from '../../support/googleAnalyticsTraffic';

describe('Google Analytics request classification', () => {
  it.each([
    {
      url: 'https://www.googletagmanager.com/gtag/js?id=G-INVENTED',
      expected: 'library',
    },
    {
      url: 'https://www.google-analytics.com/g/collect?v=2',
      expected: 'collection',
    },
    {
      url: 'https://google-analytics.com/collect?v=2',
      expected: 'collection',
    },
    {
      url: 'https://analytics.google.com/g/collect?v=2',
      expected: 'collection',
    },
    {
      url: 'https://region1.google-analytics.com/g/collect?v=2',
      expected: 'collection',
    },
    {
      url: 'https://stats.g.doubleclick.net/g/collect?v=2',
      expected: 'collection',
    },
    {
      url: 'https://www.googletagmanager.com/unknown',
      expected: 'other-analytics',
    },
    {
      url: 'https://region1.google-analytics.com/unknown',
      expected: 'other-analytics',
    },
    { url: 'https://www.google.com/collect', expected: null },
    { url: 'http://localhost:4323/gtag/js', expected: null },
  ] as const)('classifies $url as $expected', ({ url, expected }) => {
    expect(classifyGoogleAnalyticsRequest(url)).toBe(expected);
  });
});
