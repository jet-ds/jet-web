import { expect, test } from '@playwright/test';

test('production preserves core containment and canonical redirects', async ({ request }) => {
  const api = await request.post('/api/chat', { maxRedirects: 0 });
  expect(api.status()).toBe(404);

  const chatbot = await request.get('/chatbot', { maxRedirects: 0 });
  expect(chatbot.status()).toBe(308);
  expect(chatbot.headers().location).toBe('/tools/chatbot/');

  const about = await request.get('/about', { maxRedirects: 0 });
  expect(about.status()).toBe(308);
  expect(about.headers().location).toBe('/about/');
});

test('production About has one canonical indexable identity', async ({ page, request }) => {
  const canonical = 'https://jetsanchez.com/about/';
  const response = await page.goto('/about/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);

  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  const webpage = schemas
    .map((schema) => JSON.parse(schema) as { '@type'?: string; '@id'?: string; url?: string })
    .find((schema) => schema['@type'] === 'WebPage');
  expect(webpage).toMatchObject({
    '@type': 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
  });

  const sitemap = await (await request.get('/sitemap-0.xml', { maxRedirects: 0 })).text();
  expect(sitemap.match(/https:\/\/jetsanchez\.com\/about\//g) ?? []).toHaveLength(1);
});

test('production retired routes are direct 404s and absent from feeds', async ({ request }) => {
  const slugs = ['the-future-of-ai', 'building-with-astro'];
  for (const slug of slugs) {
    const response = await request.get(`/blog/${slug}/`, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
    expect(response.headers().location).toBeUndefined();
  }

  const sitemap = await (await request.get('/sitemap-0.xml', { maxRedirects: 0 })).text();
  const rss = await (await request.get('/rss.xml', { maxRedirects: 0 })).text();
  for (const slug of slugs) {
    expect(sitemap).not.toContain(slug);
    expect(rss).not.toContain(slug);
  }
});

test('production machine endpoints retain extension-bearing paths', async ({ request }) => {
  for (const path of ['/rss.xml', '/robots.txt', '/sitemap-index.xml']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers().location).toBeUndefined();
  }
});
