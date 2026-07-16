import { expect, test, type Locator, type Page } from '@playwright/test';

const routes = [
  '/',
  '/about/',
  '/blog/',
  '/blog/how-to-install-claude-code-cli-2026/',
  '/works/',
  '/works/recursive-convergence-hypothesis/',
  '/chatbot/',
  '/tools/',
  '/licenses/jets-ghost/',
  '/contact/',
];

type JsonLdSchema = {
  '@type'?: string;
  '@id'?: string;
  url?: string;
  mainEntity?: { '@id'?: string };
  mainEntityOfPage?: { '@id'?: string };
  isPartOf?: { '@id'?: string; url?: string };
  hasPart?: Array<{ '@type'?: string; name?: string; url?: string }>;
  applicationCategory?: string;
  operatingSystem?: string;
  offers?: { '@type'?: string; price?: string; priceCurrency?: string };
  identifier?: string;
  sameAs?: string[];
};

async function readSchemas(page: Page): Promise<JsonLdSchema[]> {
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  return schemas.map((schema) => JSON.parse(schema) as JsonLdSchema);
}

async function expectSharedAction(
  action: Locator,
  variant: string,
  density: string,
  minimumHeight: number,
) {
  await expect(action).toHaveClass(/(^|\s)action(\s|$)/u);
  await expect(action).toHaveAttribute('data-action-variant', variant);
  await expect(action).toHaveAttribute('data-action-density', density);
  const bounds = await action.boundingBox();
  expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(minimumHeight);
}

const defaultOpenGraphImage = {
  url: 'https://jetsanchez.com/images/og-default.jpg',
  width: '1920',
  height: '1080',
  alt: "Jet Sanchez's homepage hero with a blue and mustard Grainient background",
} as const;

function isCanonicalInternalHref(rawHref: string): boolean {
  const href = rawHref.trim();
  if (href === '' || href.startsWith('#')) return true;
  if (/^[a-z][a-z\d+.-]*:/iu.test(href) || href.startsWith('//')) return true;

  const pathname = href.split(/[?#]/u, 1)[0];
  const finalSegment = pathname.replace(/\/+$/u, '').split('/').at(-1) ?? '';
  return pathname === '/' || finalSegment.includes('.') || (
    pathname.startsWith('/') && pathname.endsWith('/')
  );
}

for (const route of routes) {
  test(`${route} renders one main heading`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test(`${route} keeps canonical metadata and WebPage JSON-LD aligned`, async ({ page }) => {
    await page.goto(route);
    const expected = new URL(route, 'https://jetsanchez.com').toString();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', expected);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', expected);
    await expect(page.locator('meta[name="twitter:url"]')).toHaveAttribute('content', expected);

    const schemas = await readSchemas(page);
    if (route === '/') {
      expect(schemas.find((schema) => schema['@type'] === 'WebSite')).toMatchObject({
        '@id': 'https://jetsanchez.com/#website',
        url: expected,
      });
      expect(schemas.some((schema) => schema['@type'] === 'WebPage')).toBe(false);
    } else {
      expect(schemas.find((schema) => schema['@type'] === 'WebPage')).toMatchObject({
        '@id': `${expected}#webpage`,
        url: expected,
        isPartOf: {
          '@id': 'https://jetsanchez.com/#website',
          url: 'https://jetsanchez.com/',
        },
      });
    }
  });

  test(`${route} uses the sole site-name suffix separator`, async ({ page }) => {
    await page.goto(route);
    const title = await page.title();

    expect(title).toMatch(/ \| Jet Sanchez$/u);
    expect(title.match(/ \| Jet Sanchez/gu)).toHaveLength(1);
    expect(title).not.toMatch(/(?: — | - )Jet Sanchez$/u);
  });
}

test("Jet's Ghost exposes canonical qualification metadata", async ({ page }) => {
  const canonical = 'https://jetsanchez.com/chatbot/';
  const softwareId = `${canonical}#softwareapplication`;

  await page.goto('/chatbot/');
  await expect(page).toHaveTitle("Jet's Ghost: Local-First AI Assistant | Jet Sanchez");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    "Chat with Jet's published writing, research, and projects using a local-first AI assistant in compatible WebGPU browsers.",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');

  const schemas = await readSchemas(page);
  expect(schemas.find((schema) => schema['@type'] === 'WebPage')).toMatchObject({
    '@id': `${canonical}#webpage`,
    url: canonical,
    mainEntity: { '@id': softwareId },
  });
  expect(schemas.find((schema) => schema['@type'] === 'SoftwareApplication')).toMatchObject({
    '@id': softwareId,
    url: canonical,
    applicationCategory: 'ChatApplication',
    operatingSystem: 'Web browser with WebGPU',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  });
});

test('Tools remains a dormant noindexed route', async ({ page }) => {
  await page.goto('/tools/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.locator('main h1')).toHaveText('Tools');
  await expect(page.locator('main')).toContainText('reserved for future standalone utilities');
  await expect(page.locator('main a')).toHaveCount(0);
});

test('research exposes one DOI-backed action', async ({ page }) => {
  await page.goto('/works/recursive-convergence-hypothesis/');
  const action = page.getByRole('link', { name: 'View on SSRN' });
  await expect(action).toHaveAttribute('href', 'https://doi.org/10.2139/ssrn.5395309');
  await expectSharedAction(action, 'accent', 'compact', 44);
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveCount(0);
});

test('Astro and React actions share one variant and density taxonomy', async ({ page }) => {
  await page.goto('/about/');
  const socialAction = page.getByRole('main').locator('a[href="https://github.com/jet-ds"]');
  await expectSharedAction(socialAction, 'soft', 'compact', 44);

  await page.goto('/chatbot/');
  const ghostAction = page.getByRole('button', { name: 'Check compatibility' });
  await expectSharedAction(ghostAction, 'brand', 'immersive', 48);
  await expect(ghostAction).toHaveCSS('border-radius', '12px');
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

test('RSS is served as XML without a redirect', async ({ request }) => {
  const rss = await request.get('/rss.xml', { maxRedirects: 0 });
  expect(rss.status()).toBe(200);
  expect(rss.headers().location).toBeUndefined();
  expect(rss.headers()['content-type']).toContain('xml');
  expect(await rss.text()).toContain('<rss');
});

test('robots allows crawling and names the canonical sitemap index', async ({ request }) => {
  const response = await request.get('/robots.txt', { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers().location).toBeUndefined();
  const robots = await response.text();
  expect(robots).toMatch(/^User-agent: \*$/mu);
  expect(robots).toMatch(/^Allow: \/$/mu);
  expect(robots).toMatch(/^Sitemap: https:\/\/jetsanchez\.com\/sitemap-index\.xml$/mu);
});

test('sitemap index points to a valid canonical XML sitemap', async ({ request }) => {
  const indexResponse = await request.get('/sitemap-index.xml', { maxRedirects: 0 });
  expect(indexResponse.status()).toBe(200);
  expect(indexResponse.headers().location).toBeUndefined();
  expect(indexResponse.headers()['content-type']).toContain('xml');
  const index = await indexResponse.text();
  expect(index).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  expect(index).toContain('<loc>https://jetsanchez.com/sitemap-0.xml</loc>');

  const sitemapResponse = await request.get('/sitemap-0.xml', { maxRedirects: 0 });
  expect(sitemapResponse.status()).toBe(200);
  expect(sitemapResponse.headers().location).toBeUndefined();
  expect(sitemapResponse.headers()['content-type']).toContain('xml');
  expect(await sitemapResponse.text()).toContain(
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  );
});

test('about metadata and sitemap use one canonical URL', async ({ page, request }) => {
  const canonical = 'https://jetsanchez.com/about/';
  await page.goto('/about/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
  await expect(page.locator('meta[name="twitter:url"]')).toHaveAttribute('content', canonical);
  const schemas = await readSchemas(page);
  expect(schemas.find((schema) => schema['@type'] === 'WebPage')).toMatchObject({
    '@id': `${canonical}#webpage`,
    url: canonical,
  });
  expect(schemas.find((schema) => schema['@type'] === 'Person')).toMatchObject({
    url: 'https://jetsanchez.com/',
    mainEntityOfPage: { '@id': `${canonical}#webpage` },
  });
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
  const researchCanonical = 'https://jetsanchez.com/works/recursive-convergence-hypothesis/';
  const doi = 'https://doi.org/10.2139/ssrn.5395309';
  await page.goto('/works/recursive-convergence-hypothesis/');
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
  let schemas = await readSchemas(page);
  expect(schemas.find((schema) => schema['@type'] === 'ScholarlyArticle')).toMatchObject({
    url: researchCanonical,
    identifier: doi,
    sameAs: [doi],
    mainEntityOfPage: { '@id': `${researchCanonical}#webpage` },
  });

  const blogCanonical = 'https://jetsanchez.com/blog/how-to-install-claude-code-cli-2026/';
  await page.goto('/blog/how-to-install-claude-code-cli-2026/');
  schemas = await readSchemas(page);
  expect(schemas.find((schema) => schema['@type'] === 'BlogPosting')).toMatchObject({
    url: blogCanonical,
    mainEntityOfPage: { '@id': `${blogCanonical}#webpage` },
  });
});

test('content pages use deliberate SEO titles without replacing their headings', async ({ page }) => {
  const cases = [
    {
      route: '/blog/how-to-install-claude-code-cli-2026/',
      seoTitle: 'How to Install Claude Code CLI in 2026 | Jet Sanchez',
      heading: 'How to Install and Get Started With Claude Code CLI in 2026',
    },
    {
      route: '/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters/',
      seoTitle: 'Vibe Coding vs Agentic Coding: Key Differences | Jet Sanchez',
      heading: 'Vibe Coding vs Agentic Coding: Why the Distinction Matters',
    },
    {
      route: '/works/recursive-convergence-hypothesis/',
      seoTitle: 'Recursive Convergence Hypothesis: AI Sentience | Jet Sanchez',
      heading: 'The Recursive Convergence Hypothesis: Emergent Sentience as a Structural Attractor of Recursive ASI',
    },
  ] as const;

  for (const { route, seoTitle, heading } of cases) {
    await page.goto(route);
    await expect(page).toHaveTitle(seoTitle);
    await expect(page.locator('main h1')).toHaveText(heading);
    expect(seoTitle.length).toBeLessThanOrEqual(60);
  }
});

test('custom blog images expose their verified intrinsic OpenGraph dimensions', async ({ page }) => {
  for (const route of [
    '/blog/how-to-install-claude-code-cli-2026/',
    '/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters/',
  ]) {
    await page.goto(route);
    await expect(page.locator('meta[property="og:image:width"]'))
      .toHaveAttribute('content', '1920');
    await expect(page.locator('meta[property="og:image:height"]'))
      .toHaveAttribute('content', '1080');
  }
});

test('listing and contact pages expose useful page-specific descriptions', async ({ page }) => {
  const cases = [
    [
      '/blog/',
      "Explore Jet Sanchez's articles on AI, agentic software development, local-first tools, technical workflows, and the systems shaping modern work.",
    ],
    [
      '/works/',
      "Explore Jet Sanchez's research papers, software projects, and applied AI experiments spanning agentic systems, AI governance, and emerging technology.",
    ],
    [
      '/contact/',
      'Contact Jet Sanchez for AI research, marketing engineering, SEO and GEO strategy, systems design, speaking, or collaboration opportunities.',
    ],
  ] as const;

  for (const [route, description] of cases) {
    await page.goto(route);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', description);
  }
});

test('rendered internal human-page links use trailing-slash identities', async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    const hrefs = await page.locator('a[href]').evaluateAll((links) => links.map(
      (link) => link.getAttribute('href') ?? '',
    ));
    expect(hrefs.filter((href) => !isCanonicalInternalHref(href)), route).toEqual([]);
  }
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
    ["Jet's Ghost", '/chatbot/'],
    ['Contact', '/contact/'],
  ] as const;

  await page.goto('/');
  const dock = page.locator('#site-navigation-dock');
  for (const [name, href] of navigation) {
    await expect(dock.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
  }
  await expect(dock.getByRole('link', { name: 'Tools', exact: true })).toHaveCount(0);

  const schemas = await readSchemas(page);
  const structuredNavigation = schemas
    .find((schema) => schema['@type'] === 'SiteNavigationElement');
  expect(structuredNavigation?.hasPart).toEqual(navigation.map(([name, href]) => ({
    '@type': 'WebPage',
    name,
    url: new URL(href, 'https://jetsanchez.com').toString(),
  })));

  const html = await (await request.get('/')).text();
  const noscript = /<noscript>([\s\S]*?)<\/noscript>/u.exec(html)?.[1];
  expect(noscript).toBeDefined();
  for (const [name, href] of navigation) {
    expect(noscript).toContain(`href="${href}"`);
    expect(noscript).toContain(`>${name.replaceAll("'", '&#39;')}</a>`);
  }
  expect(noscript).not.toContain('href="/tools/"');
  expect(noscript).not.toContain('>Tools</a>');
});

test('qualification and dormant routes stay out of the sitemap', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  const sitemapUrls = [...sitemap.matchAll(/<loc>(https:\/\/jetsanchez\.com\/[^<]*)<\/loc>/gu)]
    .map((match) => match[1]);
  expect(sitemapUrls.length).toBeGreaterThan(0);
  expect(sitemapUrls.every((url) => new URL(url).pathname.endsWith('/'))).toBe(true);
  expect(sitemapUrls).not.toContain('https://jetsanchez.com/chatbot/');
  expect(sitemapUrls.every((url) => {
    const pathname = new URL(url).pathname;
    return pathname !== '/tools/' && !pathname.startsWith('/tools/');
  })).toBe(true);
});

test('assistant corpus JSON stays out of the sitemap while the HTML license page remains', async ({ request }) => {
  const paths = [
    '/assistant/corpus/manifest.json',
    '/assistant/corpus/content.json',
    '/assistant/corpus/index.json',
  ] as const;

  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  for (const path of paths) expect(sitemap).not.toContain(path);
  expect(sitemap).toContain('https://jetsanchez.com/licenses/jets-ghost/');
});

test('RSS emits only slashful public blog item URLs', async ({ request }) => {
  const rss = await (await request.get('/rss.xml')).text();
  const itemLinks = [...rss.matchAll(/<item>[\s\S]*?<link>(https:\/\/jetsanchez\.com\/[^<]*)<\/link>[\s\S]*?<\/item>/gu)]
    .map((match) => match[1]);
  expect(itemLinks.length).toBeGreaterThan(0);
  expect(itemLinks.every((url) => {
    const pathname = new URL(url).pathname;
    return pathname.startsWith('/blog/') && pathname.endsWith('/');
  })).toBe(true);
  for (const excluded of [
    'https://jetsanchez.com/chatbot/',
    'https://jetsanchez.com/tools/',
    'https://jetsanchez.com/blog/the-future-of-ai/',
    'https://jetsanchez.com/blog/building-with-astro/',
    'https://jetsanchez.com/blog/how-to-install-and-get-started-with-codex-cli-2026/',
  ]) {
    expect(itemLinks).not.toContain(excluded);
  }
});
