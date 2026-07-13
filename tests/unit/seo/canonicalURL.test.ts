import { describe, expect, it } from 'vitest';
import { getCanonicalURL } from '../../../src/utils/seo';

describe('getCanonicalURL', () => {
  it.each([
    ['/', 'https://jetsanchez.com/'],
    ['/about', 'https://jetsanchez.com/about/'],
    ['/about/', 'https://jetsanchez.com/about/'],
    ['/blog/example///', 'https://jetsanchez.com/blog/example/'],
    ['/blog//example///', 'https://jetsanchez.com/blog/example/'],
    ['/rss.xml', 'https://jetsanchez.com/rss.xml'],
    ['/robots.txt', 'https://jetsanchez.com/robots.txt'],
    ['/sitemap-index.xml', 'https://jetsanchez.com/sitemap-index.xml'],
    [
      '/assistant/runtime/litert-lm/0.14.0/runtime.wasm',
      'https://jetsanchez.com/assistant/runtime/litert-lm/0.14.0/runtime.wasm',
    ],
    ['/api/chat', 'https://jetsanchez.com/api/chat'],
  ])('normalizes %s to %s', (path, expected) => {
    expect(getCanonicalURL(path)).toBe(expected);
  });

  it('strips query and hash state before canonicalizing', () => {
    expect(getCanonicalURL('/about?ref=campaign#profile')).toBe(
      'https://jetsanchez.com/about/',
    );
    expect(getCanonicalURL('/rss.xml///?ref=campaign#feed')).toBe(
      'https://jetsanchez.com/rss.xml',
    );
  });

  it('normalizes same-origin absolute input without allowing origin drift', () => {
    expect(getCanonicalURL('https://jetsanchez.com/about?ref=campaign')).toBe(
      'https://jetsanchez.com/about/',
    );
    expect(() => getCanonicalURL('https://example.com/about')).toThrow(
      'Cross-origin canonical URL is not allowed',
    );
  });
});
