import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { SITE } from '../../src/config/site';
import { ANALYTICS_OPT_OUT_COOKIE } from '../../src/features/analytics/trackingPolicy';
import { establishDeploymentProtectionBypass } from '../support/deploymentProtection';
import { classifyGoogleAnalyticsRequest } from '../support/googleAnalyticsTraffic';
import {
  publishedAssistantSources,
  publishedContent,
  resolvedPublishedCollections,
} from '../support/publishedContent';

const deploymentOrigin = new URL(
  process.env.PRODUCTION_ORIGIN ?? 'https://jetsanchez.com',
).origin;

type JsonLdSchema = {
  '@type'?: string;
  '@id'?: string;
  url?: string;
  description?: string;
  mainEntityOfPage?: { '@id'?: string };
  identifier?: string;
  sameAs?: string[];
  datePublished?: string;
  dateModified?: string;
  reviewRating?: {
    ratingValue?: number;
    bestRating?: number;
  };
  itemReviewed?: {
    '@type'?: string;
    name?: string;
  };
};

type CorpusContent = {
  documents: Array<{ id: string; canonicalUrl: string }>;
};

function occurrences(value: string, target: string): number {
  return value.split(target).length - 1;
}

function sitemapLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
    ([, location]) => location,
  );
}

function rssItemLinks(xml: string): string[] {
  return [
    ...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>[\s\S]*?<\/item>/gu),
  ]
    .map(([, location]) => location)
    .sort();
}

async function contentCardRoutes(page: Page, route: string): Promise<string[]> {
  const response = await page.goto(route);
  expect(response?.status()).toBe(200);
  return page
    .locator('main article a[href^="/blog/"], main article a[href^="/works/"]')
    .evaluateAll((anchors) =>
      anchors.flatMap((anchor) => {
        const href = anchor.getAttribute('href');
        return href === null ? [] : [href];
      }),
    );
}

async function publishedSitemapXml(
  request: APIRequestContext,
): Promise<string> {
  const indexResponse = await request.get('/sitemap-index.xml');
  expect(indexResponse.ok()).toBe(true);

  const documents: string[] = [];
  for (const location of sitemapLocations(await indexResponse.text())) {
    const response = await request.get(new URL(location).pathname);
    expect(response.ok()).toBe(true);
    documents.push(await response.text());
  }
  return documents.join('\n');
}

test.beforeEach(async ({ context }) => {
  await establishDeploymentProtectionBypass(
    context,
    deploymentOrigin,
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  );
});

test('Production reads back the site-wide analytics device control', async ({
  context,
  page,
}) => {
  const analyticsRequests: URL[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const requestKind = classifyGoogleAnalyticsRequest(url);
    if (requestKind === null) {
      await route.continue();
      return;
    }
    analyticsRequests.push(url);
    await route.fulfill(
      requestKind === 'library'
        ? { status: 200, contentType: 'application/javascript', body: '' }
        : { status: 204 },
    );
  });

  await page.goto('/?analytics=off&campaign=deployment#preserved');
  await expect(page).toHaveURL(
    new URL('/?campaign=deployment#preserved', deploymentOrigin).toString(),
  );
  await expect
    .poll(
      () =>
        analyticsRequests.filter(
          ({ hostname, pathname }) =>
            hostname === 'www.googletagmanager.com' && pathname === '/gtag/js',
        ).length,
    )
    .toBeGreaterThanOrEqual(1);
  expect(
    await page.evaluate(
      (measurementId) => Reflect.get(window, `ga-disable-${measurementId}`),
      SITE.ga4MeasurementId,
    ),
  ).toBe(true);
  expect(
    (await context.cookies()).find(
      ({ name }) => name === ANALYTICS_OPT_OUT_COOKIE,
    ),
  ).toMatchObject({ value: '1', path: '/', secure: true, sameSite: 'Lax' });
  expect(
    analyticsRequests.filter(({ pathname }) =>
      /^\/(?:g\/)?collect$/u.test(pathname),
    ),
  ).toEqual([]);

  await page.goto('/about/?analytics=on&campaign=deployment#preserved');
  await expect(page).toHaveURL(
    new URL(
      '/about/?campaign=deployment#preserved',
      deploymentOrigin,
    ).toString(),
  );
  expect(
    await page.evaluate(
      (measurementId) => Reflect.get(window, `ga-disable-${measurementId}`),
      SITE.ga4MeasurementId,
    ),
  ).toBe(false);
  expect(
    (await context.cookies()).some(
      ({ name }) => name === ANALYTICS_OPT_OUT_COOKIE,
    ),
  ).toBe(false);
});

test('Production publishes every tracked published content contract', async ({
  page,
  context,
}) => {
  const request = context.request;
  const content = publishedContent();
  expect(content.length).toBeGreaterThan(0);

  const [rssResponse, corpusResponse] = await Promise.all([
    request.get('/rss.xml'),
    request.get('/assistant/corpus/content.json'),
  ]);
  for (const response of [rssResponse, corpusResponse]) {
    expect(response.ok()).toBe(true);
  }

  const rss = await rssResponse.text();
  const sitemap = await publishedSitemapXml(request);
  const corpus = (await corpusResponse.json()) as CorpusContent;

  const expectedAssistantSources = publishedAssistantSources().map(
    ({ id, route }) => ({
      id,
      canonicalUrl: new URL(route, SITE.siteUrl).toString(),
    }),
  );
  const deployedAssistantSources = corpus.documents
    .map(({ id, canonicalUrl }) => ({ id, canonicalUrl }))
    .sort((left, right) => left.id.localeCompare(right.id, 'en'));
  expect(deployedAssistantSources).toEqual(expectedAssistantSources);

  const collections = resolvedPublishedCollections();
  expect(await contentCardRoutes(page, '/')).toEqual(
    collections.homepage.map(({ href }) => href),
  );
  expect(await contentCardRoutes(page, '/blog/')).toEqual(
    collections.blog.map(({ href }) => href),
  );
  expect(await contentCardRoutes(page, '/works/')).toEqual(
    collections.works.map(({ href }) => href),
  );

  const expectedCanonicalUrls = content
    .map(({ route }) => new URL(route, SITE.siteUrl).toString())
    .sort();
  const sitemapContentUrls = sitemapLocations(sitemap)
    .filter((location) => {
      const pathname = new URL(location).pathname;
      return ['/blog/', '/works/'].some(
        (collectionRoot) =>
          pathname.startsWith(collectionRoot) && pathname !== collectionRoot,
      );
    })
    .sort();
  expect(sitemapContentUrls).toEqual(expectedCanonicalUrls);
  expect(rssItemLinks(rss)).toEqual(
    content
      .filter(({ kind }) => kind === 'blog')
      .map(({ route }) => new URL(route, SITE.siteUrl).toString())
      .sort(),
  );

  for (const item of content) {
    const canonical = new URL(item.route, SITE.siteUrl).toString();
    expect(occurrences(sitemap, `<loc>${canonical}</loc>`)).toBe(1);

    const response = await page.goto(item.route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'index, follow',
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      canonical,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      canonical,
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
      'content',
      item.openGraphType,
    );
    await expect(page).toHaveTitle(
      `${item.seoTitle ?? item.title} | Jet Sanchez`,
    );

    const seoDescription = item.seoDescription ?? item.description;
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      seoDescription,
    );
    await expect(
      page.locator(`main time[datetime="${item.date.toISOString()}"]`),
    ).toBeVisible();

    const schemas = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    ).map((schema) => JSON.parse(schema) as JsonLdSchema);
    const entity = schemas.find(
      (schema) => schema['@type'] === item.entityType,
    );
    expect(entity).toMatchObject({
      url: canonical,
      description: item.description,
      mainEntityOfPage: { '@id': `${canonical}#webpage` },
      datePublished: item.date.toISOString(),
    });
    expect(entity?.dateModified).toBe(item.dateModified?.toISOString());
    if (item.identifier !== undefined) {
      expect(entity).toMatchObject({
        identifier: item.identifier,
        sameAs: [item.identifier],
      });
    }

    for (const link of item.links ?? []) {
      await expect(
        page.getByRole('link', { name: link.label, exact: true }),
      ).toHaveAttribute('href', link.url);
    }

    if (item.image?.width !== undefined) {
      await expect(
        page.locator('meta[property="og:image:width"]'),
      ).toHaveAttribute('content', String(item.image.width));
    }
    if (item.image?.height !== undefined) {
      await expect(
        page.locator('meta[property="og:image:height"]'),
      ).toHaveAttribute('content', String(item.image.height));
    }
    if (item.review !== undefined) {
      expect(
        schemas.find((schema) => schema['@type'] === 'Review'),
      ).toMatchObject({
        url: canonical,
        reviewRating: {
          ratingValue: item.review.ratingValue,
          bestRating: item.review.bestRating,
        },
        itemReviewed: {
          '@type': 'Movie',
          name: item.review.itemName,
        },
      });
    }
  }
});

test('production preserves core containment and canonical redirects', async ({
  context,
}) => {
  const request = context.request;
  const apiRedirect = await request.post('/api/chat', { maxRedirects: 0 });
  expect(apiRedirect.status()).toBe(308);
  expect(
    new URL(
      apiRedirect.headers().location,
      'https://jetsanchez.com',
    ).toString(),
  ).toBe('https://jetsanchez.com/api/chat/');

  const apiTerminal = await request.post('/api/chat/', { maxRedirects: 0 });
  expect(apiTerminal.status()).toBe(404);
  expect(apiTerminal.headers().location).toBeUndefined();

  const chatbot = await request.get('/chatbot', { maxRedirects: 0 });
  expect(chatbot.status()).toBe(308);
  expect(chatbot.headers().location).toBe('/chatbot/');

  const chatbotTerminal = await request.get('/chatbot/', { maxRedirects: 0 });
  expect(chatbotTerminal.status()).toBe(200);
  expect(chatbotTerminal.headers().location).toBeUndefined();

  const legacySlashless = await request.get('/tools/chatbot', {
    maxRedirects: 0,
  });
  expect(legacySlashless.status()).toBe(308);
  expect(legacySlashless.headers().location).toBe('/tools/chatbot/');

  const legacySlashful = await request.get('/tools/chatbot/', {
    maxRedirects: 0,
  });
  expect(legacySlashful.status()).toBe(308);
  expect(legacySlashful.headers().location).toBe('/chatbot/');

  const canonicalLicenseSlashless = await request.get('/licenses/egregore', {
    maxRedirects: 0,
  });
  expect(canonicalLicenseSlashless.status()).toBe(308);
  expect(canonicalLicenseSlashless.headers().location).toBe(
    '/licenses/egregore/',
  );

  const canonicalLicense = await request.get('/licenses/egregore/', {
    maxRedirects: 0,
  });
  expect(canonicalLicense.status()).toBe(200);
  expect(canonicalLicense.headers().location).toBeUndefined();

  const legacyLicenseSlashless = await request.get('/licenses/jets-ghost', {
    maxRedirects: 0,
  });
  expect(legacyLicenseSlashless.status()).toBe(308);
  expect(legacyLicenseSlashless.headers().location).toBe(
    '/licenses/jets-ghost/',
  );

  const legacyLicenseSlashful = await request.get('/licenses/jets-ghost/', {
    maxRedirects: 0,
  });
  expect(legacyLicenseSlashful.status()).toBe(308);
  expect(legacyLicenseSlashful.headers().location).toBe('/licenses/egregore/');

  const toolsSlashless = await request.get('/tools', { maxRedirects: 0 });
  expect(toolsSlashless.status()).toBe(308);
  expect(toolsSlashless.headers().location).toBe('/tools/');

  const toolsTerminal = await request.get('/tools/', { maxRedirects: 0 });
  expect(toolsTerminal.status()).toBe(200);
  expect(toolsTerminal.headers().location).toBeUndefined();
  expect(await toolsTerminal.text()).toContain(
    '<meta name="robots" content="noindex, nofollow">',
  );

  const toolsLookalike = await request.get('/toolshed/', { maxRedirects: 0 });
  expect(toolsLookalike.status()).toBe(404);
  expect(toolsLookalike.headers().location).toBeUndefined();

  const runtimeAsset = await request.get(
    '/assistant/runtime/litert-lm/0.14.0/litertlm_wasm_internal.wasm',
    { maxRedirects: 0 },
  );
  expect(runtimeAsset.status()).toBe(200);
  expect(runtimeAsset.headers()['cache-control']).toBe(
    'public, max-age=31536000, immutable',
  );

  const about = await request.get('/about', { maxRedirects: 0 });
  expect(about.status()).toBe(308);
  expect(about.headers().location).toBe('/about/');
});

test('Production exposes the indexable canonical Egregore identity', async ({
  page,
  context,
}) => {
  const request = context.request;
  const canonical = 'https://jetsanchez.com/chatbot/';
  const response = await page.goto('/chatbot/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'index, follow',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    canonical,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    canonical,
  );

  const schemas = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const parsed = schemas.map(
    (schema) =>
      JSON.parse(schema) as {
        '@type'?: string;
        '@id'?: string;
        name?: string;
        url?: string;
        hasPart?: Array<{ '@type'?: string; name?: string; url?: string }>;
      },
  );
  expect(parsed.find((schema) => schema['@type'] === 'WebPage')).toMatchObject({
    '@id': `${canonical}#webpage`,
    url: canonical,
  });
  expect(
    parsed.find((schema) => schema['@type'] === 'SoftwareApplication'),
  ).toMatchObject({
    '@id': `${canonical}#softwareapplication`,
    name: 'Egregore',
    url: canonical,
  });

  const dock = page.locator('#site-navigation-dock');
  await expect(
    dock.getByRole('link', { name: 'Egregore', exact: true }),
  ).toHaveAttribute('href', '/chatbot/');
  await expect(
    dock.getByRole('link', { name: 'Tools', exact: true }),
  ).toHaveCount(0);

  const structuredNavigation = parsed.find(
    (schema) => schema['@type'] === 'SiteNavigationElement',
  );
  expect(structuredNavigation?.hasPart).toContainEqual({
    '@type': 'WebPage',
    name: 'Egregore',
    url: canonical,
  });
  expect(
    structuredNavigation?.hasPart?.some(({ name }) => name === 'Tools'),
  ).toBe(false);

  const html = await (
    await request.get('/chatbot/', { maxRedirects: 0 })
  ).text();
  const noscript = [...html.matchAll(/<noscript>([\s\S]*?)<\/noscript>/gu)]
    .map((match) => match[1])
    .join('\n');
  expect(noscript).toContain('href="/chatbot/"');
  expect(noscript).toContain('Egregore');
  expect(noscript).not.toContain('href="/tools/"');
  expect(noscript).not.toContain('>Tools</a>');

  const sitemap = await (
    await request.get('/sitemap-0.xml', { maxRedirects: 0 })
  ).text();
  const memberships =
    sitemap.match(/https:\/\/jetsanchez\.com\/chatbot\//g) ?? [];
  expect(memberships).toHaveLength(1);
  expect(sitemap).not.toContain('https://jetsanchez.com/tools/');
});

test('deployment exposes one canonical Egregore license document', async ({
  page,
  context,
}) => {
  const canonical = 'https://jetsanchez.com/licenses/egregore/';
  const response = await page.goto('/licenses/egregore/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Egregore model and open-source licenses/iu);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'index, follow',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    canonical,
  );

  const sitemap = await (
    await context.request.get('/sitemap-0.xml', { maxRedirects: 0 })
  ).text();
  expect(
    sitemap.match(/https:\/\/jetsanchez\.com\/licenses\/egregore\//gu) ?? [],
  ).toHaveLength(1);
  expect(sitemap).not.toContain('https://jetsanchez.com/licenses/jets-ghost/');
});

test('production About has one canonical indexable identity', async ({
  page,
  context,
}) => {
  const request = context.request;
  const canonical = 'https://jetsanchez.com/about/';
  const response = await page.goto('/about/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'index, follow',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    canonical,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    canonical,
  );

  const schemas = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const webpage = schemas
    .map(
      (schema) =>
        JSON.parse(schema) as {
          '@type'?: string;
          '@id'?: string;
          url?: string;
        },
    )
    .find((schema) => schema['@type'] === 'WebPage');
  expect(webpage).toMatchObject({
    '@type': 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
  });

  const sitemap = await (
    await request.get('/sitemap-0.xml', { maxRedirects: 0 })
  ).text();
  expect(
    sitemap.match(/https:\/\/jetsanchez\.com\/about\//g) ?? [],
  ).toHaveLength(1);
});

test('production retired routes are direct 404s and absent from feeds', async ({
  context,
}) => {
  const request = context.request;
  const slugs = ['the-future-of-ai', 'building-with-astro'];
  for (const slug of slugs) {
    const response = await request.get(`/blog/${slug}/`, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
    expect(response.headers().location).toBeUndefined();
  }

  const sitemap = await (
    await request.get('/sitemap-0.xml', { maxRedirects: 0 })
  ).text();
  const rss = await (await request.get('/rss.xml', { maxRedirects: 0 })).text();
  for (const slug of slugs) {
    expect(sitemap).not.toContain(slug);
    expect(rss).not.toContain(slug);
  }
});

test('production machine endpoints retain extension-bearing paths', async ({
  context,
}) => {
  const request = context.request;
  for (const path of ['/rss.xml', '/robots.txt', '/sitemap-index.xml']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers().location).toBeUndefined();
  }
});

test('production HTTP-noindexes assistant corpus JSON only', async ({
  context,
}) => {
  const request = context.request;
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

  const sitemap = await (
    await request.get('/sitemap-0.xml', { maxRedirects: 0 })
  ).text();
  for (const path of corpusPaths) expect(sitemap).not.toContain(path);
  expect(sitemap).toContain('https://jetsanchez.com/licenses/egregore/');
  expect(sitemap).not.toContain('https://jetsanchez.com/licenses/jets-ghost/');
});
