import { expect, test } from '@playwright/test';

const expectedNoindexValue = process.env.EXPECTED_JETS_GHOST_NOINDEX;
if (expectedNoindexValue !== '0' && expectedNoindexValue !== '1') {
  throw new Error('EXPECTED_JETS_GHOST_NOINDEX must be exactly 0 or 1');
}
const expectedNoindex = expectedNoindexValue === '1';

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

  const legacySlashless = await request.get('/tools/chatbot', { maxRedirects: 0 });
  expect(legacySlashless.status()).toBe(308);
  expect(legacySlashless.headers().location).toBe('/tools/chatbot/');

  const legacySlashful = await request.get('/tools/chatbot/', { maxRedirects: 0 });
  expect(legacySlashful.status()).toBe(308);
  expect(legacySlashful.headers().location).toBe('/chatbot/');

  const toolsSlashless = await request.get('/tools', { maxRedirects: 0 });
  expect(toolsSlashless.status()).toBe(308);
  expect(toolsSlashless.headers().location).toBe('/tools/');

  const toolsTerminal = await request.get('/tools/', { maxRedirects: 0 });
  expect(toolsTerminal.status()).toBe(200);
  expect(toolsTerminal.headers().location).toBeUndefined();
  expect(await toolsTerminal.text())
    .toContain('<meta name="robots" content="noindex, nofollow">');

  const toolsLookalike = await request.get('/toolshed/', { maxRedirects: 0 });
  expect(toolsLookalike.status()).toBe(404);
  expect(toolsLookalike.headers().location).toBeUndefined();

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

test('deployment exposes the target-gated canonical Ghost identity', async ({ page, request }) => {
  const canonical = 'https://jetsanchez.com/chatbot/';
  const response = await page.goto('/chatbot/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    expectedNoindex ? 'noindex, nofollow' : 'index, follow',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);

  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  const parsed = schemas.map((schema) => JSON.parse(schema) as {
    '@type'?: string;
    '@id'?: string;
    url?: string;
    hasPart?: Array<{ '@type'?: string; name?: string; url?: string }>;
  });
  expect(parsed.find((schema) => schema['@type'] === 'WebPage')).toMatchObject({
    '@id': `${canonical}#webpage`,
    url: canonical,
  });
  expect(parsed.find((schema) => schema['@type'] === 'SoftwareApplication')).toMatchObject({
    '@id': `${canonical}#softwareapplication`,
    url: canonical,
  });

  const dock = page.locator('#site-navigation-dock');
  await expect(dock.getByRole('link', { name: "Jet's Ghost", exact: true }))
    .toHaveAttribute('href', '/chatbot/');
  await expect(dock.getByRole('link', { name: 'Tools', exact: true })).toHaveCount(0);

  const structuredNavigation = parsed.find(
    (schema) => schema['@type'] === 'SiteNavigationElement',
  );
  expect(structuredNavigation?.hasPart).toContainEqual({
    '@type': 'WebPage',
    name: "Jet's Ghost",
    url: canonical,
  });
  expect(structuredNavigation?.hasPart?.some(({ name }) => name === 'Tools')).toBe(false);

  const html = await (await request.get('/chatbot/', { maxRedirects: 0 })).text();
  const noscript = [...html.matchAll(/<noscript>([\s\S]*?)<\/noscript>/gu)]
    .map((match) => match[1])
    .join('\n');
  expect(noscript).toContain('href="/chatbot/"');
  expect(noscript).toContain("Jet&#39;s Ghost");
  expect(noscript).not.toContain('href="/tools/"');
  expect(noscript).not.toContain('>Tools</a>');

  const sitemap = await (await request.get('/sitemap-0.xml', { maxRedirects: 0 })).text();
  const memberships = sitemap.match(/https:\/\/jetsanchez\.com\/chatbot\//g) ?? [];
  expect(memberships).toHaveLength(expectedNoindex ? 0 : 1);
  expect(sitemap).not.toContain('https://jetsanchez.com/tools/');
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

test('production HTTP-noindexes assistant corpus JSON only', async ({ request }) => {
  const corpusPaths = [
    '/assistant/corpus/manifest.json',
    '/assistant/corpus/content.json',
    '/assistant/corpus/index.json',
  ] as const;

  for (const path of corpusPaths) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
  }

  const sitemap = await (await request.get('/sitemap-0.xml', { maxRedirects: 0 })).text();
  for (const path of corpusPaths) expect(sitemap).not.toContain(path);
  expect(sitemap).toContain('https://jetsanchez.com/licenses/jets-ghost/');
});
