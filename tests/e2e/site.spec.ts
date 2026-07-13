import { expect, test } from '@playwright/test';

const routes = [
  '/',
  '/about/',
  '/blog/',
  '/blog/how-to-install-claude-code-cli-2026/',
  '/works/',
  '/works/recursive-convergence-hypothesis/',
  '/tools/',
  '/contact/',
];

const defaultOpenGraphImage = {
  url: 'https://jetsanchez.com/images/og-default.jpg',
  width: '1920',
  height: '1080',
  alt: "Jet Sanchez's homepage hero with a blue and mustard Grainient background",
} as const;

for (const route of routes) {
  test(`${route} renders one main heading`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('h1')).toHaveCount(1);
    const expected = new URL(route, 'https://jetsanchez.com').toString();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', expected);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', expected);
  });
}

test('research exposes one DOI-backed action', async ({ page }) => {
  await page.goto('/works/recursive-convergence-hypothesis/');
  const action = page.getByRole('link', { name: 'View on SSRN' });
  await expect(action).toHaveAttribute('href', 'https://doi.org/10.2139/ssrn.5395309');
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveCount(0);
});

test('homepage serves the default social image and exact metadata', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('meta[property="og:image"]'))
    .toHaveAttribute('content', defaultOpenGraphImage.url);
  await expect(page.locator('meta[property="og:image:width"]'))
    .toHaveAttribute('content', defaultOpenGraphImage.width);
  await expect(page.locator('meta[property="og:image:height"]'))
    .toHaveAttribute('content', defaultOpenGraphImage.height);
  await expect(page.locator('meta[property="og:image:alt"]'))
    .toHaveAttribute('content', defaultOpenGraphImage.alt);
  await expect(page.locator('meta[name="twitter:image"]'))
    .toHaveAttribute('content', defaultOpenGraphImage.url);
  await expect(page.locator('meta[name="twitter:image:alt"]'))
    .toHaveAttribute('content', defaultOpenGraphImage.alt);

  const response = await request.get('/images/og-default.jpg');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/jpeg');
  expect((await response.body()).subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
});

test('theme choice persists across navigation', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: /switch to dark mode/i }).click();
  await page.goto('/about/');
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('machine-readable routes are available', async ({ request }) => {
  const rss = await request.get('/rss.xml', { maxRedirects: 0 });
  expect(rss.status()).toBe(200);
  expect(rss.headers().location).toBeUndefined();
  expect(await rss.text()).toContain('<rss');

  for (const path of ['/robots.txt', '/sitemap-index.xml']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers().location).toBeUndefined();
  }
});

test('about metadata and sitemap use one canonical URL', async ({ page, request }) => {
  const canonical = 'https://jetsanchez.com/about/';
  await page.goto('/about/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  const serialized = schemas.map((schema) => JSON.stringify(JSON.parse(schema))).join('\n');
  expect(serialized).toContain(`${canonical}#webpage`);
  expect(serialized).toContain(`"url":"${canonical}"`);
  const sitemap = await request.get('/sitemap-0.xml');
  const matches = (await sitemap.text()).match(/https:\/\/jetsanchez\.com\/about\//g) ?? [];
  expect(matches).toHaveLength(1);
});

test('retired routes stay retired and out of feeds', async ({ request }) => {
  for (const route of ['/blog/the-future-of-ai/', '/blog/building-with-astro/']) {
    expect((await request.get(route)).status()).toBe(404);
  }
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  const rss = await (await request.get('/rss.xml')).text();
  for (const slug of ['the-future-of-ai', 'building-with-astro']) {
    expect(sitemap).not.toContain(slug);
    expect(rss).not.toContain(slug);
  }
});

test('content pages expose parseable typed JSON-LD', async ({ page }) => {
  await page.goto('/works/recursive-convergence-hypothesis/');
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  const parsed = schemas.map((schema) => JSON.parse(schema) as { '@type'?: string });
  expect(parsed.some((schema) => schema['@type'] === 'ScholarlyArticle')).toBe(true);
});

test('draft routes are absent', async ({ request }) => {
  const response = await request.get('/blog/how-to-install-and-get-started-with-codex-cli-2026/');
  expect(response.status()).toBe(404);
});

test('nested routes mark the canonical navigation item active', async ({ page }) => {
  await page.goto('/blog/how-to-install-claude-code-cli-2026/');
  await expect(
    page.locator('#site-navigation-dock').getByRole('link', { name: 'Blog', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('navigation representations use canonical route identities', async ({ page, request }) => {
  const navigation = [
    ['Home', '/'],
    ['About', '/about/'],
    ['Blog', '/blog/'],
    ['Works', '/works/'],
    ['Tools', '/tools/'],
    ['Contact', '/contact/'],
  ] as const;

  await page.goto('/');
  for (const [name, href] of navigation) {
    await expect(page.getByRole('link', { name, exact: true }).first()).toHaveAttribute('href', href);
  }

  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  const structuredNavigation = schemas
    .map((schema) => JSON.parse(schema) as {
      '@type'?: string;
      hasPart?: Array<{ name?: string; url?: string }>;
    })
    .find((schema) => schema['@type'] === 'SiteNavigationElement');
  expect(structuredNavigation?.hasPart).toEqual(navigation.map(([name, href]) => ({
    '@type': 'WebPage',
    name,
    url: new URL(href, 'https://jetsanchez.com').toString(),
  })));

  const html = await (await request.get('/')).text();
  const noscript = /<noscript>([\s\S]*?)<\/noscript>/u.exec(html)?.[1];
  expect(noscript).toBeDefined();
  for (const [, href] of navigation) {
    expect(noscript).toContain(`href="${href}"`);
  }
});

test('sitemap and RSS emit slashful HTML route identities', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  const sitemapUrls = [...sitemap.matchAll(/<loc>(https:\/\/jetsanchez\.com\/[^<]*)<\/loc>/gu)]
    .map((match) => match[1]);
  expect(sitemapUrls.length).toBeGreaterThan(0);
  expect(sitemapUrls.every((url) => new URL(url).pathname.endsWith('/'))).toBe(true);

  const rss = await (await request.get('/rss.xml')).text();
  const itemLinks = [...rss.matchAll(/<link>(https:\/\/jetsanchez\.com\/blog\/[^<]*)<\/link>/gu)]
    .map((match) => match[1]);
  expect(itemLinks.length).toBeGreaterThan(0);
  expect(itemLinks.every((url) => new URL(url).pathname.endsWith('/'))).toBe(true);
});
