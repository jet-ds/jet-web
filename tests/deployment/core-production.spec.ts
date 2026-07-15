import { expect, test } from '@playwright/test';

test('production preserves core containment and canonical redirects', async ({ request }) => {
  const apiRedirect = await request.post('/api/chat', { maxRedirects: 0 });
  expect(apiRedirect.status()).toBe(308);
  expect(new URL(apiRedirect.headers().location, 'https://jetsanchez.com').toString())
    .toBe('https://jetsanchez.com/api/chat/');

  const apiTerminal = await request.post('/api/chat/', { maxRedirects: 0 });
  expect(apiTerminal.status()).toBe(404);
  expect(apiTerminal.headers().location).toBeUndefined();

  const chatbot = await request.get('/chatbot', { maxRedirects: 0 });
  expect(chatbot.status()).toBe(308);
  expect(chatbot.headers().location).toBe('/chatbot/');

  const chatbotTerminal = await request.get('/chatbot/', { maxRedirects: 0 });
  expect(chatbotTerminal.status()).toBe(200);
  expect(chatbotTerminal.headers().location).toBeUndefined();
  expect(await chatbotTerminal.text())
    .toContain('<meta name="robots" content="noindex, nofollow">');

  const legacySlashless = await request.get('/tools/chatbot', { maxRedirects: 0 });
  expect(legacySlashless.status()).toBe(308);
  expect(legacySlashless.headers().location).toBe('/tools/chatbot/');

  const legacySlashful = await request.get('/tools/chatbot/', { maxRedirects: 0 });
  expect(legacySlashful.status()).toBe(308);
  expect(legacySlashful.headers().location).toBe('/chatbot/');

  const runtimeAsset = await request.get(
    '/assistant/runtime/litert-lm/0.14.0/litertlm_wasm_internal.wasm',
    { maxRedirects: 0 },
  );
  expect(runtimeAsset.status()).toBe(200);
  expect(runtimeAsset.headers()['cache-control'])
    .toBe('public, max-age=31536000, immutable');

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
