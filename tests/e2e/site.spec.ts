import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { SITE, SOCIAL_LINKS } from '../../src/config/site';
import {
  publishedAssistantSources,
  publishedContent,
  type PublishedContent,
} from '../support/publishedContent';

const routes = [
  '/',
  '/about/',
  '/blog/',
  '/blog/how-to-install-claude-code-cli-2026/',
  '/works/',
  '/works/digital-squad-timesheet/',
  '/works/recursive-convergence-hypothesis/',
  '/chatbot/',
  '/tools/',
  '/licenses/egregore/',
  '/contact/',
];

type JsonLdSchema = {
  '@type'?: string;
  '@id'?: string;
  name?: string;
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
  description?: string;
  author?: { '@id'?: string; name?: string };
  reviewRating?: {
    '@type'?: string;
    ratingValue?: number;
    bestRating?: number;
    worstRating?: number;
  };
  itemReviewed?: { '@type'?: string; name?: string };
  datePublished?: string;
  dateModified?: string;
};

type CorpusContent = {
  documents: Array<{ id: string; canonicalUrl: string }>;
};

async function readSchemas(page: Page): Promise<JsonLdSchema[]> {
  const schemas = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
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
  expect(bounds?.width ?? 0).toBeGreaterThanOrEqual(minimumHeight);
  expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(minimumHeight);
}

async function expectRenderedActionInteraction(page: Page, action: Locator) {
  await page.mouse.move(0, 0);
  const restBackground = await action.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );

  await action.hover();
  await expect
    .poll(() =>
      action.evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .not.toBe(restBackground);

  await action.focus();
  await expect(action).toBeFocused();
  const focus = await action.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineOffset: Number.parseFloat(style.outlineOffset),
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(focus).toEqual({
    outlineOffset: 2,
    outlineStyle: 'solid',
    outlineWidth: 2,
  });
}

async function expectOutsideTextLinkRecipe(element: Locator) {
  await expect(element).toBeVisible();
  await expect(element).not.toHaveClass(/(^|\s)text-link(\s|$)/u);
}

async function applyTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((nextTheme) => {
    if (!document.querySelector('#browser-contract-no-transitions')) {
      const style = document.createElement('style');
      style.id = 'browser-contract-no-transitions';
      style.textContent =
        '*, *::before, *::after { transition: none !important; }';
      document.head.append(style);
    }
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }, theme);
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
  return (
    pathname === '/' ||
    finalSegment.includes('.') ||
    (pathname.startsWith('/') && pathname.endsWith('/'))
  );
}

function sitemapLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
    ([, location]) => new URL(location).pathname,
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
  return (
    await page
      .locator('main [data-content-card] > a[href]')
      .evaluateAll((anchors) =>
        anchors.flatMap((anchor) => {
          const href = anchor.getAttribute('href');
          return href === null ? [] : [href];
        }),
      )
  ).sort();
}

async function publicHtmlRoutes(request: APIRequestContext): Promise<string[]> {
  const indexResponse = await request.get('/sitemap-index.xml');
  expect(indexResponse.ok()).toBe(true);

  const publicRoutes = new Set<string>();
  for (const sitemapPath of sitemapLocations(await indexResponse.text())) {
    const sitemapResponse = await request.get(sitemapPath);
    expect(sitemapResponse.ok()).toBe(true);
    for (const route of sitemapLocations(await sitemapResponse.text()))
      publicRoutes.add(route);
  }

  return [...publicRoutes].sort();
}

for (const route of routes) {
  test(`${route} renders one main heading`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test(`${route} keeps canonical metadata and WebPage JSON-LD aligned`, async ({
    page,
  }) => {
    await page.goto(route);
    const expected = new URL(route, 'https://jetsanchez.com').toString();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      expected,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      expected,
    );
    await expect(page.locator('meta[name="twitter:url"]')).toHaveAttribute(
      'content',
      expected,
    );

    const schemas = await readSchemas(page);
    if (route === '/') {
      expect(
        schemas.find((schema) => schema['@type'] === 'WebSite'),
      ).toMatchObject({
        '@id': 'https://jetsanchez.com/#website',
        url: expected,
      });
      expect(schemas.some((schema) => schema['@type'] === 'WebPage')).toBe(
        false,
      );
    } else {
      expect(
        schemas.find((schema) => schema['@type'] === 'WebPage'),
      ).toMatchObject({
        '@id': `${expected}#webpage`,
        url: expected,
        isPartOf: {
          '@id': 'https://jetsanchez.com/#website',
          url: 'https://jetsanchez.com/',
        },
      });
    }
  });

  test(`${route} uses the sole site-name suffix separator`, async ({
    page,
  }) => {
    await page.goto(route);
    const title = await page.title();

    expect(title).toMatch(/ \| Jet Sanchez$/u);
    expect(title.match(/ \| Jet Sanchez/gu)).toHaveLength(1);
    expect(title).not.toMatch(/(?: — | - )Jet Sanchez$/u);
  });
}

test('Egregore exposes canonical public metadata', async ({ page }) => {
  const canonical = 'https://jetsanchez.com/chatbot/';
  const softwareId = `${canonical}#softwareapplication`;

  await page.goto('/chatbot/');
  await expect(page).toHaveTitle(
    'Egregore: Local-First AI Assistant | Jet Sanchez',
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    "Chat with Jet's published writing, research, and projects using a local-first AI assistant in compatible WebGPU browsers.",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'index, follow',
  );

  const schemas = await readSchemas(page);
  expect(schemas.find((schema) => schema['@type'] === 'WebPage')).toMatchObject(
    {
      '@id': `${canonical}#webpage`,
      url: canonical,
      mainEntity: { '@id': softwareId },
    },
  );
  expect(
    schemas.find((schema) => schema['@type'] === 'SoftwareApplication'),
  ).toMatchObject({
    '@id': softwareId,
    name: 'Egregore',
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

test('compact immersive navigation keeps the disclosure visually separated from the dock', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto('/chatbot/');

  const dock = page.locator('#site-navigation-dock');
  const disclosure = page.getByRole('button', { name: 'Close navigation' });
  await expect(dock).toBeVisible();
  await expect(disclosure).toBeVisible();

  const visualGap = await disclosure.evaluate((element) => {
    if (!(element instanceof HTMLElement)) {
      throw new Error('Navigation disclosure is not an HTML element');
    }
    const disclosureBounds = element.getBoundingClientRect();
    const dockBounds = document
      .querySelector('#site-navigation-dock')
      ?.getBoundingClientRect();
    if (!dockBounds) throw new Error('Navigation dock bounds unavailable');

    const disclosureCenter = disclosureBounds.top + disclosureBounds.height / 2;
    const disclosureRadius = element.offsetHeight / 2;
    return dockBounds.top - (disclosureCenter + disclosureRadius);
  });

  expect(visualGap).toBeGreaterThanOrEqual(7);
  expect(visualGap).toBeLessThanOrEqual(10);
});

test('collection cards expose one complete shared anatomy and destination', async ({
  page,
}) => {
  for (const route of ['/', '/blog/', '/works/']) {
    await page.goto(route);
    const cards = page.locator('main [data-content-card]');
    expect(await cards.count()).toBeGreaterThan(0);

    for (const card of await cards.all()) {
      const action = card.locator(':scope > a[href]');
      await expect(action).toHaveCount(1);
      await expect(card.locator('a[href]')).toHaveCount(1);
      await expect(action).toHaveAttribute('href', /^\/(?:blog|works)\/.+\/$/u);

      const media = action.locator('[data-content-card-media]');
      const image = media.getByRole('img');
      const title = action.locator('[data-content-card-title]');
      const summary = action.locator('[data-content-card-summary]');
      const facts = action.locator(
        '[data-content-card-facts] > [data-content-card-fact]',
      );

      await expect(media).toBeVisible();
      await expect(image).toHaveAttribute('alt', /\S/u);
      await expect(title).toBeVisible();
      await expect(title).not.toBeEmpty();
      await expect(summary).toBeVisible();
      await expect(summary).not.toBeEmpty();
      expect(await facts.count()).toBeGreaterThan(0);
      for (const fact of await facts.all()) {
        await expect(fact).toBeVisible();
        await expect(fact).not.toBeEmpty();
      }

      const anatomy = await action.evaluate((element) => {
        const selectors = [
          '[data-content-card-media]',
          '[data-content-card-title]',
          '[data-content-card-summary]',
          '[data-content-card-facts]',
        ];
        const regions = selectors.map((selector) =>
          element.querySelector<HTMLElement>(selector),
        );
        if (regions.some((region) => region === null)) {
          throw new Error('Content card anatomy is incomplete');
        }

        return regions.map((region) => {
          const target = region as HTMLElement;
          const style = getComputedStyle(target);
          return {
            clientHeight: target.clientHeight,
            clientWidth: target.clientWidth,
            lineClamp: style.webkitLineClamp,
            scrollHeight: target.scrollHeight,
            scrollWidth: target.scrollWidth,
            top: target.getBoundingClientRect().top,
          };
        });
      });

      expect(anatomy.map(({ top }) => top)).toEqual(
        [...anatomy.map(({ top }) => top)].sort((left, right) => left - right),
      );
      for (const region of anatomy.slice(1)) {
        expect(region.lineClamp).toMatch(/^(?:none|0)$/u);
        expect(region.scrollHeight).toBeLessThanOrEqual(
          region.clientHeight + 1,
        );
        expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth + 1);
      }

      const mediaBounds = await media.boundingBox();
      if (mediaBounds === null) throw new Error('Card media has no geometry');
      expect(mediaBounds.width / mediaBounds.height).toBeCloseTo(16 / 9, 2);
    }

    const firstAction = cards.first().locator(':scope > a[href]');
    const destination = await firstAction.getAttribute('href');
    if (destination === null) throw new Error('Card destination is missing');
    await firstAction.locator('[data-content-card-media]').click();
    await expect(page).toHaveURL(destination);
  }
});

test('blog cards omit repeated single-author attribution while article pages retain it', async ({
  page,
}) => {
  for (const collectionRoute of ['/', '/blog/']) {
    await page.goto(collectionRoute);

    const cards = page.locator('main [data-content-card] > a[href^="/blog/"]');
    const cardText = await cards.allTextContents();
    expect(cardText.length).toBeGreaterThan(0);
    for (const text of cardText) {
      expect(text).not.toContain('Jet Sanchez');
    }
  }

  const posts = publishedContent().filter((item) => item.kind === 'blog');
  for (const post of posts) {
    await page.goto(post.route);
    await expect(
      page
        .locator('main article > header')
        .getByText(`By ${post.author}`, { exact: true }),
    ).toBeVisible();
  }
});

test('collection hubs keep the standardized responsive card geometry', async ({
  page,
}) => {
  for (const width of [320, 430, 767, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });

    for (const route of ['/blog/', '/works/']) {
      await page.goto(route);
      const cards = page.locator('main [data-content-card]');
      const first = await cards.nth(0).boundingBox();
      const media = await cards
        .nth(0)
        .locator('[data-content-card-media]')
        .boundingBox();
      if (first === null || media === null) {
        throw new Error(`Collection card geometry is unavailable on ${route}`);
      }

      const columns = await cards.first().evaluate((element) => {
        let ancestor = element.parentElement;
        while (
          ancestor !== null &&
          getComputedStyle(ancestor).display !== 'grid'
        ) {
          ancestor = ancestor.parentElement;
        }
        if (ancestor === null)
          throw new Error('Collection grid is unavailable');
        return getComputedStyle(ancestor).gridTemplateColumns.split(' ').length;
      });
      expect(columns).toBe(width >= 768 ? 2 : 1);

      expect(media.width / media.height).toBeCloseTo(16 / 9, 2);
      if (width === 1440) {
        expect(media.width).toBeGreaterThanOrEqual(528);
        expect(media.width).toBeLessThanOrEqual(536);
        expect(media.height).toBeGreaterThanOrEqual(296);
        expect(media.height).toBeLessThanOrEqual(302);
      }

      const overflow = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(
        overflow.clientWidth + 1,
      );
    }
  }
});

test('Timesheet presents its complete technology stack as a semantic section after Overview', async ({
  page,
}) => {
  await page.goto('/works/digital-squad-timesheet/');

  const content = page.locator('main article.prose');
  const headings = await content.locator('h2').allTextContents();
  const overviewIndex = headings.indexOf('Overview');
  const technologyIndex = headings.indexOf('Technology stack');
  const productDesignIndex = headings.indexOf('Product design');

  expect(overviewIndex).toBeGreaterThanOrEqual(0);
  expect(technologyIndex).toBe(overviewIndex + 1);
  expect(productDesignIndex).toBe(technologyIndex + 1);

  const technologyList = content
    .getByRole('heading', { level: 2, name: 'Technology stack' })
    .locator('xpath=following-sibling::ul[1]');
  await expect(technologyList).toBeVisible();
  await expect(technologyList.getByRole('listitem')).toHaveText([
    'Application and interface: Next.js, React, TypeScript, Tailwind CSS, Base UI',
    'Data and authentication: PostgreSQL, Supabase, Drizzle ORM',
    'Analytics and reporting: PostHog, Recharts',
    'Quality and delivery: Zod, Vitest, Playwright, Vercel',
  ]);
});

test('Tools remains a dormant noindexed route', async ({ page }) => {
  await page.goto('/tools/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow',
  );
  await expect(page.locator('main h1')).toHaveText('Tools');
  await expect(page.locator('main')).toContainText(
    'reserved for future standalone utilities',
  );
  await expect(page.locator('main a')).toHaveCount(0);
});

test('published research exposes DOI-backed shared actions without download controls', async ({
  page,
}) => {
  const research = publishedContent().filter(
    ({ entityType, identifier }) =>
      entityType === 'ScholarlyArticle' && identifier !== undefined,
  );
  expect(research.length).toBeGreaterThan(0);

  for (const item of research) {
    await page.goto(item.route);
    const link = item.links?.find(({ url }) => url === item.identifier);
    if (link === undefined) {
      throw new Error(`Missing DOI action for ${item.route}`);
    }
    const action = page.getByRole('link', {
      name: link.label,
      exact: true,
    });
    await expect(action).toHaveAttribute('href', item.identifier ?? '');
    await expectSharedAction(action, 'accent', 'compact', 44);
    await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveCount(
      0,
    );
  }
});

test('Astro and React actions share rendered roles, hover, focus, and density', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.goto('/');
  const contactAction = page.getByRole('link', {
    name: 'Contact me',
    exact: true,
  });
  const learnAction = page.getByRole('link', {
    name: 'Learn more',
    exact: true,
  });
  await expectSharedAction(contactAction, 'accent', 'immersive', 48);
  await expectSharedAction(learnAction, 'soft', 'immersive', 48);
  await expectRenderedActionInteraction(page, contactAction);
  await expectRenderedActionInteraction(page, learnAction);

  await page.goto('/about/');
  const socialAction = page
    .getByRole('main')
    .locator('a[href="https://github.com/jet-ds"]');
  await expectSharedAction(socialAction, 'soft', 'compact', 44);
  await expectRenderedActionInteraction(page, socialAction);

  await page.goto('/chatbot/');
  const ghostAction = page.getByRole('button', { name: 'Check compatibility' });
  await expectSharedAction(ghostAction, 'brand', 'immersive', 48);
  await expect(ghostAction).toHaveCSS('border-radius', '12px');
  await expectRenderedActionInteraction(page, ghostAction);
});

test('About and Contact expose the current social destinations through shared actions', async ({
  page,
}) => {
  const destinations = [
    ['GitHub', SOCIAL_LINKS.github, 'Code, experiments, and open-source work'],
    ['LinkedIn', SOCIAL_LINKS.linkedin, 'Professional profile and updates'],
    ['SSRN', SOCIAL_LINKS.ssrn, 'Research papers and publications'],
    [
      'Google Scholar',
      SOCIAL_LINKS.scholar,
      'Academic citations and research profile',
    ],
  ] as const;

  await page.goto('/about/');
  for (const [name, href] of destinations) {
    const action = page
      .getByRole('main')
      .getByRole('link', { name: new RegExp(`^${name}`) });
    await expect(action).toHaveAttribute('href', href);
    await expectSharedAction(action, 'soft', 'compact', 44);
  }

  await page.goto('/contact/');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'Email',
    'Links',
  ]);
  await expect(page.getByText('Response Time', { exact: true })).toHaveCount(0);
  for (const [name, href, description] of destinations) {
    const destination = page
      .getByRole('main')
      .getByRole('link', { name: new RegExp(`^${name}`) });
    await expect(destination).toHaveAttribute('href', href);
    await expect(destination).toContainText(description);
  }
  await expectSharedAction(
    page
      .getByRole('main')
      .getByRole('link', { name: 'Send email', exact: true }),
    'accent',
    'default',
    44,
  );
});

test('subtle information cards share one responsive surface in both themes', async ({
  page,
}) => {
  const cases = [
    ['/licenses/egregore/', 'Gemma 4 E2B LiteRT-LM'],
    ['/about/', 'Background'],
    ['/contact/', 'Email'],
  ] as const;

  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark'] as const) {
      const surfaces: Array<{
        backgroundColor: string;
        borderColor: string;
        borderRadius: number;
        padding: string[];
      }> = [];

      for (const [route, heading] of cases) {
        await page.goto(route);
        await applyTheme(page, theme);
        const surface = await page
          .getByRole('heading', { name: heading, exact: true })
          .evaluate((element) => {
            let candidate = element.parentElement;
            while (candidate !== null) {
              const style = getComputedStyle(candidate);
              if (
                Number.parseFloat(style.borderTopWidth) > 0 &&
                Number.parseFloat(style.borderRadius) > 0 &&
                style.backgroundColor !== 'rgba(0, 0, 0, 0)'
              ) {
                return {
                  backgroundColor: style.backgroundColor,
                  borderColor: style.borderColor,
                  borderRadius: Number.parseFloat(style.borderRadius),
                  padding: [
                    style.paddingTop,
                    style.paddingRight,
                    style.paddingBottom,
                    style.paddingLeft,
                  ],
                };
              }
              candidate = candidate.parentElement;
            }
            throw new Error('No rendered information-card surface found');
          });
        surfaces.push(surface);
      }

      expect(
        new Set(surfaces.map(({ backgroundColor }) => backgroundColor)).size,
      ).toBe(1);
      expect(new Set(surfaces.map(({ borderColor }) => borderColor)).size).toBe(
        1,
      );
      expect(new Set(surfaces.map(({ borderRadius }) => borderRadius))).toEqual(
        new Set([12]),
      );
      expect(
        new Set(surfaces.map(({ padding }) => padding.join(','))).size,
      ).toBe(1);
    }
  }
});

test('About portrait remains an unfiltered clipped image surface at narrow and wide widths', async ({
  page,
}) => {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/about/');

    const image = page.getByRole('img', { name: 'Jet Sanchez', exact: true });
    await expect(image).toBeVisible();
    const metrics = await image.evaluate((imageElement) => {
      let surface = imageElement.parentElement;
      while (surface !== null) {
        const style = getComputedStyle(surface);
        if (
          style.overflow === 'hidden' &&
          Number.parseFloat(style.borderRadius) > 0 &&
          Number.parseFloat(style.borderTopWidth) > 0
        )
          break;
        surface = surface.parentElement;
      }
      if (surface === null)
        throw new Error('About portrait surface is missing');
      const surfaceStyle = getComputedStyle(surface);
      const imageStyle = getComputedStyle(imageElement);
      const surfaceBounds = surface.getBoundingClientRect();
      const imageBounds = imageElement.getBoundingClientRect();
      return {
        borderRadius: Number.parseFloat(surfaceStyle.borderRadius),
        clippedWithinSurface:
          imageBounds.left >= surfaceBounds.left - 0.5 &&
          imageBounds.top >= surfaceBounds.top - 0.5 &&
          imageBounds.right <= surfaceBounds.right + 0.5 &&
          imageBounds.bottom <= surfaceBounds.bottom + 0.5,
        filter: imageStyle.filter,
        opacity: imageStyle.opacity,
        overflow: surfaceStyle.overflow,
        padding: [
          surfaceStyle.paddingTop,
          surfaceStyle.paddingRight,
          surfaceStyle.paddingBottom,
          surfaceStyle.paddingLeft,
        ],
      };
    });

    expect(metrics.borderRadius).toBe(12);
    expect(metrics.clippedWithinSurface).toBe(true);
    expect(metrics.filter).toBe('none');
    expect(metrics.opacity).toBe('1');
    expect(metrics.overflow).toBe('hidden');
    expect(metrics.padding).toEqual(['0px', '0px', '0px', '0px']);
  }
});

test('inline prose and article back links share one rendered interaction model', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(
    '/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters/',
  );

  const blogBack = page.getByRole('link', { name: 'Back to blog' });
  const proseLink = page
    .getByRole('main')
    .getByRole('link', { name: 'Claude Code', exact: true });
  const rest = await blogBack.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      fontWeight: style.fontWeight,
      textDecorationLine: style.textDecorationLine,
      textUnderlineOffset: style.textUnderlineOffset,
      transitionDuration: style.transitionDuration,
    };
  });
  expect(rest.fontWeight).toBe('500');
  expect(rest.textDecorationLine).toBe('none');
  expect(rest.textUnderlineOffset).toBe('4px');
  expect(rest.transitionDuration).toBe('0s');

  for (const link of [blogBack, proseLink]) {
    await expect(link).toHaveCSS('color', rest.color);
    await expect(link).toHaveCSS('font-weight', rest.fontWeight);
    await expect(link).toHaveCSS(
      'text-decoration-line',
      rest.textDecorationLine,
    );
    await expect(link).toHaveCSS(
      'text-underline-offset',
      rest.textUnderlineOffset,
    );
    await link.focus();
    await expect(link).toHaveCSS('text-decoration-line', 'underline');
    await expect(link).toHaveCSS('outline-style', 'solid');
    await expect(link).toHaveCSS('outline-offset', '2px');
  }

  for (const [route, name] of [
    ['/works/recursive-convergence-hypothesis/', 'Back to works'],
    ['/licenses/egregore/', 'Back to Egregore'],
  ] as const) {
    await page.goto(route);
    const backLink = page.getByRole('link', {
      name: new RegExp(`${name}$`, 'u'),
    });
    await expect(backLink).toHaveCSS('color', rest.color);
    await expect(backLink).toHaveCSS('font-weight', rest.fontWeight);
    await expect(backLink).toHaveCSS(
      'text-decoration-line',
      rest.textDecorationLine,
    );
    await expect(backLink).toHaveCSS(
      'text-underline-offset',
      rest.textUnderlineOffset,
    );
    await backLink.focus();
    await expect(backLink).toHaveCSS('text-decoration-line', 'underline');
    await expect(backLink).toHaveCSS('outline-style', 'solid');
    await expect(backLink).toHaveCSS('outline-offset', '2px');
  }

  const footerLink = page
    .getByRole('contentinfo')
    .getByRole('link', { name: 'Home', exact: true });
  await expect(footerLink).toHaveCSS('font-weight', '400');
  await expect(footerLink).toHaveCSS('text-decoration-line', 'none');
});

test('specialized navigation and actions stay outside the inline prose link recipe', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/blog/how-to-install-claude-code-cli-2026/');

  const tableOfContentsLink = page
    .getByRole('navigation', { name: 'Table of Contents' })
    .getByRole('link')
    .first();
  const postNavigationLink = page
    .getByRole('navigation', { name: 'Post navigation' })
    .getByRole('link')
    .first();

  await expectOutsideTextLinkRecipe(tableOfContentsLink);
  await expect(tableOfContentsLink).toHaveAttribute('href', /^#/u);
  await expectOutsideTextLinkRecipe(postNavigationLink);
  await expect(postNavigationLink).toHaveCSS('border-top-width', '1px');

  await page.goto('/');
  const action = page.getByRole('link', { name: 'Contact me', exact: true });
  await expectOutsideTextLinkRecipe(action);
  await expect(action).toHaveAttribute('data-action-variant', 'accent');
});

test('homepage serves the default social image and exact metadata', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    defaultOpenGraphImage.url,
  );
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
    'content',
    defaultOpenGraphImage.width,
  );
  await expect(
    page.locator('meta[property="og:image:height"]'),
  ).toHaveAttribute('content', defaultOpenGraphImage.height);
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    'content',
    defaultOpenGraphImage.alt,
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    'content',
    defaultOpenGraphImage.url,
  );
  await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute(
    'content',
    defaultOpenGraphImage.alt,
  );

  const response = await request.get('/images/og-default.jpg');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/jpeg');
  expect((await response.body()).subarray(0, 2)).toEqual(
    Buffer.from([0xff, 0xd8]),
  );
});

test('theme choice persists across navigation', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: /switch to dark mode/i }).click();
  await page.goto('/about/');
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('theme-aware Works covers are ready before the first switch on every presentation surface', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));

  const alt =
    'Digital Squad Timesheet weekly dashboard for Jet Sanchez showing a populated July work week';
  for (const route of ['/', '/works/', '/works/digital-squad-timesheet/']) {
    await page.goto(route);

    const themeImages = page.locator(`img[alt="${alt}"]`);
    await expect(themeImages).toHaveCount(2);
    const accessibleImage = page.getByRole('img', { name: alt, exact: true });
    await expect(accessibleImage).toHaveCount(1);
    await expect(accessibleImage).toHaveAttribute(
      'src',
      /digital-squad-timesheet-dashboard-light/u,
    );

    await expect
      .poll(async () =>
        themeImages.evaluateAll((images) =>
          images.map((image) => {
            const element = image as HTMLImageElement;
            return element.complete && element.naturalWidth > 0;
          }),
        ),
      )
      .toEqual([true, true]);

    const resources = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) => url.includes('digital-squad-timesheet-dashboard')),
    );
    expect(
      resources.some((url) => url.includes('-light-')),
      route,
    ).toBe(true);
    expect(
      resources.some((url) => url.includes('-dark-')),
      route,
    ).toBe(true);

    await page.getByRole('button', { name: /switch to dark mode/i }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(accessibleImage).toHaveCount(1);
    await expect(accessibleImage).toHaveAttribute(
      'src',
      /digital-squad-timesheet-dashboard-dark/u,
    );
  }
});

test('RSS is served as XML without a redirect', async ({ request }) => {
  const rss = await request.get('/rss.xml', { maxRedirects: 0 });
  expect(rss.status()).toBe(200);
  expect(rss.headers().location).toBeUndefined();
  expect(rss.headers()['content-type']).toContain('xml');
  expect(await rss.text()).toContain('<rss');
});

test('robots allows crawling and names the canonical sitemap index', async ({
  request,
}) => {
  const response = await request.get('/robots.txt', { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers().location).toBeUndefined();
  const robots = await response.text();
  expect(robots).toMatch(/^User-agent: \*$/mu);
  expect(robots).toMatch(/^Allow: \/$/mu);
  expect(robots).toMatch(
    /^Sitemap: https:\/\/jetsanchez\.com\/sitemap-index\.xml$/mu,
  );
});

test('sitemap index points to a valid canonical XML sitemap', async ({
  request,
}) => {
  const indexResponse = await request.get('/sitemap-index.xml', {
    maxRedirects: 0,
  });
  expect(indexResponse.status()).toBe(200);
  expect(indexResponse.headers().location).toBeUndefined();
  expect(indexResponse.headers()['content-type']).toContain('xml');
  const index = await indexResponse.text();
  expect(index).toContain(
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  );
  expect(index).toContain('<loc>https://jetsanchez.com/sitemap-0.xml</loc>');

  const sitemapResponse = await request.get('/sitemap-0.xml', {
    maxRedirects: 0,
  });
  expect(sitemapResponse.status()).toBe(200);
  expect(sitemapResponse.headers().location).toBeUndefined();
  expect(sitemapResponse.headers()['content-type']).toContain('xml');
  expect(await sitemapResponse.text()).toContain(
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  );
});

test('about metadata and sitemap use one canonical URL', async ({
  page,
  request,
}) => {
  const canonical = 'https://jetsanchez.com/about/';
  await page.goto('/about/');
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
  await expect(page.locator('meta[name="twitter:url"]')).toHaveAttribute(
    'content',
    canonical,
  );
  const schemas = await readSchemas(page);
  expect(schemas.find((schema) => schema['@type'] === 'WebPage')).toMatchObject(
    {
      '@id': `${canonical}#webpage`,
      url: canonical,
    },
  );
  expect(schemas.find((schema) => schema['@type'] === 'Person')).toMatchObject({
    url: 'https://jetsanchez.com/',
    mainEntityOfPage: { '@id': `${canonical}#webpage` },
  });
  const sitemap = await request.get('/sitemap-0.xml');
  const matches =
    (await sitemap.text()).match(/https:\/\/jetsanchez\.com\/about\//g) ?? [];
  expect(matches).toHaveLength(1);
});

test('About renders the approved public profile', async ({ page }) => {
  await page.goto('/about/');

  await expect(page.getByRole('heading', { name: 'Background' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText(
    'I am a marketing engineer working at the intersection of AI research, applied AI, and systems design.',
  );
  await expect(page.getByRole('main')).toContainText(
    'At Digital Squad, I lead AI research & development and drive content strategy and SEO',
  );
  await expect(
    page.getByRole('heading', { name: 'Research Areas' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Technical Focus' }),
  ).toBeVisible();
});

test('the canonical profile has no standalone profile route', async ({
  request,
}) => {
  expect((await request.get('/profile/jet-sanchez/')).status()).toBe(404);
});

test('content discovery surfaces exactly match tracked publication state', async ({
  page,
  request,
}) => {
  const content = publishedContent();
  const homepageContent = [
    ...content
      .filter(({ kind }) => kind === 'blog')
      .sort((left, right) => right.date.getTime() - left.date.getTime())
      .slice(0, 3),
    ...content
      .filter(({ kind, featured }) => kind === 'work' && featured)
      .sort((left, right) => right.date.getTime() - left.date.getTime())
      .slice(0, 3),
  ];

  expect(await contentCardRoutes(page, '/')).toEqual(
    homepageContent.map(({ route }) => route).sort(),
  );
  expect(await contentCardRoutes(page, '/blog/')).toEqual(
    content
      .filter(({ kind }) => kind === 'blog')
      .map(({ route }) => route)
      .sort(),
  );
  expect(await contentCardRoutes(page, '/works/')).toEqual(
    content
      .filter(({ kind }) => kind === 'work')
      .map(({ route }) => route)
      .sort(),
  );

  const sitemapContentRoutes = (await publicHtmlRoutes(request)).filter(
    (route) =>
      ['/blog/', '/works/'].some(
        (collectionRoot) =>
          route.startsWith(collectionRoot) && route !== collectionRoot,
      ),
  );
  expect(sitemapContentRoutes).toEqual(
    content.map(({ route }) => route).sort(),
  );

  const rssResponse = await request.get('/rss.xml');
  expect(rssResponse.ok()).toBe(true);
  expect(rssItemLinks(await rssResponse.text())).toEqual(
    content
      .filter(({ kind }) => kind === 'blog')
      .map(({ route }) => new URL(route, SITE.siteUrl).toString())
      .sort(),
  );
});

test('assistant corpus identities exactly match tracked eligibility', async ({
  request,
}) => {
  const response = await request.get('/assistant/corpus/content.json');
  expect(response.ok()).toBe(true);
  const corpus = (await response.json()) as CorpusContent;
  const actual = corpus.documents
    .map(({ id, canonicalUrl }) => ({ id, canonicalUrl }))
    .sort((left, right) => left.id.localeCompare(right.id, 'en'));
  const expected = publishedAssistantSources().map(({ id, route }) => ({
    id,
    canonicalUrl: new URL(route, SITE.siteUrl).toString(),
  }));

  expect(actual).toEqual(expected);
});

test('retired routes stay retired and out of feeds', async ({ request }) => {
  for (const route of [
    '/blog/the-future-of-ai/',
    '/blog/building-with-astro/',
  ]) {
    expect((await request.get(route)).status()).toBe(404);
  }
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  const rss = await (await request.get('/rss.xml')).text();
  for (const slug of ['the-future-of-ai', 'building-with-astro']) {
    expect(sitemap).not.toContain(slug);
    expect(rss).not.toContain(slug);
  }
});

test('review posts expose the author rating and a linked Review entity', async ({
  page,
}) => {
  const reviewPosts = publishedContent().filter(
    (
      item,
    ): item is PublishedContent & {
      review: NonNullable<PublishedContent['review']>;
    } => item.kind === 'blog' && item.review !== undefined,
  );

  expect(reviewPosts.length).toBeGreaterThan(0);

  for (const post of reviewPosts) {
    const { review, route } = post;
    const canonical = new URL(route, 'https://jetsanchez.com').toString();

    await page.goto(route);
    await expect(
      page.getByLabel(
        `Jet’s rating: ${review.ratingValue} out of ${review.bestRating} stars`,
      ),
    ).toContainText(`${review.ratingValue}/${review.bestRating}`);

    const schemas = await readSchemas(page);
    expect(
      schemas.find((schema) => schema['@type'] === 'BlogPosting'),
    ).toMatchObject({
      '@id': `${canonical}#blogposting`,
      url: canonical,
    });
    expect(
      schemas.find((schema) => schema['@type'] === 'Review'),
    ).toMatchObject({
      '@id': `${canonical}#review`,
      url: canonical,
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.ratingValue,
        bestRating: review.bestRating,
        worstRating: 1,
      },
      itemReviewed: {
        '@type': 'Movie',
        name: review.itemName,
      },
      isPartOf: { '@id': `${canonical}#blogposting` },
    });
  }
});

test('content pages use deliberate SEO titles without replacing their headings', async ({
  page,
}) => {
  for (const contentItem of publishedContent()) {
    const seoTitle = `${contentItem.seoTitle ?? contentItem.title} | Jet Sanchez`;
    const heading = contentItem.title;
    const { route } = contentItem;
    await page.goto(route);
    await expect(page).toHaveTitle(seoTitle);
    await expect(page.locator('main h1')).toHaveText(heading);
  }
});

test('content pages expose deliberate search descriptions and faithful entity summaries', async ({
  page,
}) => {
  for (const contentItem of publishedContent()) {
    const seoDescription =
      contentItem.seoDescription ?? contentItem.description;
    const entityDescription = contentItem.description;
    const { entityType, route } = contentItem;
    await page.goto(route);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
      'content',
      contentItem.openGraphType,
    );
    await expect(
      page.locator(`main time[datetime="${contentItem.date.toISOString()}"]`),
    ).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      seoDescription,
    );
    await expect(
      page.locator('meta[property="og:description"]'),
    ).toHaveAttribute('content', seoDescription);
    await expect(
      page.locator('meta[name="twitter:description"]'),
    ).toHaveAttribute('content', seoDescription);

    const schemas = await readSchemas(page);
    expect(
      schemas.find((schema) => schema['@type'] === 'WebPage')?.description,
    ).toBe(seoDescription);
    const canonical = new URL(route, 'https://jetsanchez.com').toString();
    const entity = schemas.find((schema) => schema['@type'] === entityType);
    expect(entity).toMatchObject({
      url: canonical,
      description: entityDescription,
      mainEntityOfPage: { '@id': `${canonical}#webpage` },
      datePublished: contentItem.date.toISOString(),
    });
    expect(entity?.dateModified).toBe(contentItem.dateModified?.toISOString());
    if (contentItem.identifier !== undefined) {
      expect(entity).toMatchObject({
        identifier: contentItem.identifier,
        sameAs: [contentItem.identifier],
      });
    }
    for (const link of contentItem.links ?? []) {
      await expect(
        page.getByRole('link', { name: link.label, exact: true }),
      ).toHaveAttribute('href', link.url);
    }
  }
});

test('custom blog images expose their verified intrinsic OpenGraph dimensions', async ({
  page,
}) => {
  const imageBackedBlogs = publishedContent().filter(
    ({ kind, image }) => kind === 'blog' && image !== undefined,
  );
  for (const { route, image } of imageBackedBlogs) {
    await page.goto(route);
    await expect(
      page.locator('meta[property="og:image:width"]'),
    ).toHaveAttribute('content', String(image?.width));
    await expect(
      page.locator('meta[property="og:image:height"]'),
    ).toHaveAttribute('content', String(image?.height));
  }
});

test('listing and contact pages expose useful page-specific descriptions', async ({
  page,
}) => {
  const cases = [
    {
      route: '/blog/',
      heading: 'Blog',
      subheading:
        'Explore my articles on AI, agentic software development, local-first tools, technical workflows, and the systems shaping modern work.',
      description:
        "Explore Jet Sanchez's articles on AI, agentic software development, local-first tools, technical workflows, and the systems shaping modern work.",
    },
    {
      route: '/works/',
      heading: 'Works',
      subheading:
        'Explore my research papers, software projects, and applied AI experiments spanning agentic systems, AI governance, and emerging technology.',
      description:
        "Explore Jet Sanchez's research papers, software projects, and applied AI experiments spanning agentic systems, AI governance, and emerging technology.",
    },
    {
      route: '/contact/',
      heading: 'Get in Touch',
      subheading: "I'd love to hear from you. Here's how you can reach me.",
      description:
        'Contact Jet Sanchez for AI research, marketing engineering, SEO and GEO strategy, systems design, speaking, or collaboration opportunities.',
    },
  ] as const;

  for (const { route, heading, subheading, description } of cases) {
    await page.goto(route);
    await expect(
      page.getByRole('heading', { level: 1, name: heading, exact: true }),
    ).toBeVisible();
    await expect(page.locator('main h1 + p')).toHaveText(subheading);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      description,
    );
  }
});

test('rendered internal human-page links use trailing-slash identities', async ({
  page,
  request,
}) => {
  const crawlRoutes = await publicHtmlRoutes(request);
  expect(crawlRoutes).toContain('/chatbot/');
  expect(crawlRoutes).not.toContain('/tools/');

  for (const route of [...crawlRoutes, '/tools/']) {
    await page.goto(route);
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((links) =>
        links.map((link) => link.getAttribute('href') ?? ''),
      );
    expect(
      hrefs.filter((href) => !isCanonicalInternalHref(href)),
      route,
    ).toEqual([]);
  }
});

test('nested routes mark the canonical navigation item active', async ({
  page,
}) => {
  await page.goto('/blog/how-to-install-claude-code-cli-2026/');
  await expect(
    page
      .locator('#site-navigation-dock')
      .getByRole('link', { name: 'Blog', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('navigation representations use canonical route identities', async ({
  page,
  request,
}) => {
  const navigation = [
    ['Home', '/'],
    ['About', '/about/'],
    ['Blog', '/blog/'],
    ['Works', '/works/'],
    ['Egregore', '/chatbot/'],
    ['Contact', '/contact/'],
  ] as const;

  await page.goto('/');
  const dock = page.locator('#site-navigation-dock');
  for (const [name, href] of navigation) {
    await expect(dock.getByRole('link', { name, exact: true })).toHaveAttribute(
      'href',
      href,
    );
  }
  await expect(
    dock.getByRole('link', { name: 'Tools', exact: true }),
  ).toHaveCount(0);

  const footer = page.getByRole('contentinfo');
  for (const [name, href] of navigation) {
    await expect(
      footer.getByRole('link', { name, exact: true }),
    ).toHaveAttribute('href', href);
  }
  await expect(
    footer.getByRole('link', { name: 'Tools', exact: true }),
  ).toHaveCount(0);

  const schemas = await readSchemas(page);
  const structuredNavigation = schemas.find(
    (schema) => schema['@type'] === 'SiteNavigationElement',
  );
  expect(structuredNavigation?.hasPart).toEqual(
    navigation.map(([name, href]) => ({
      '@type': 'WebPage',
      name,
      url: new URL(href, 'https://jetsanchez.com').toString(),
    })),
  );

  const html = await (await request.get('/')).text();
  const noscript = /<noscript>([\s\S]*?)<\/noscript>/u.exec(html)?.[1];
  expect(noscript).toBeDefined();
  const normalizedNoscript = (noscript ?? '')
    .replace(/\s+/gu, ' ')
    .replace(/>\s+/gu, '>')
    .replace(/\s+</gu, '<');
  for (const [name, href] of navigation) {
    expect(normalizedNoscript).toContain(`href="${href}"`);
    expect(normalizedNoscript).toContain(
      `>${name.replaceAll("'", '&#39;')}</a>`,
    );
  }
  expect(normalizedNoscript).not.toContain('href="/tools/"');
  expect(normalizedNoscript).not.toContain('>Tools</a>');
});

test('third-party notice local destinations resolve in the built site', async ({
  request,
}) => {
  const response = await request.get('/licenses/THIRD_PARTY_NOTICES.md');
  expect(response.ok()).toBe(true);
  const notice = await response.text();
  const localDestinations = [...notice.matchAll(/\]\(([^)]+)\)/gu)]
    .map(([, destination]) => destination)
    .filter(
      (destination) =>
        destination.startsWith('/') ||
        destination.startsWith('./') ||
        destination.startsWith('../'),
    )
    .map(
      (destination) =>
        new URL(
          destination,
          'https://jetsanchez.com/licenses/THIRD_PARTY_NOTICES.md',
        ).pathname,
    );

  const licenseDestinations = localDestinations.filter((pathname) =>
    pathname.startsWith('/licenses/'),
  );

  expect(licenseDestinations).toEqual([
    '/licenses/apache-2.0.txt',
    '/licenses/apache-2.0.txt',
    '/licenses/minisearch-7.2.0-MIT.txt',
    '/licenses/stemmer-2.0.1-MIT.txt',
  ]);

  for (const destination of localDestinations) {
    const destinationResponse = await request.get(destination);
    expect(destinationResponse.ok(), destination).toBe(true);
  }
});

test('Egregore is canonical while dormant routes stay out of the sitemap', async ({
  request,
}) => {
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  const sitemapUrls = [
    ...sitemap.matchAll(/<loc>(https:\/\/jetsanchez\.com\/[^<]*)<\/loc>/gu),
  ].map((match) => match[1]);
  expect(sitemapUrls.length).toBeGreaterThan(0);
  expect(sitemapUrls.every((url) => new URL(url).pathname.endsWith('/'))).toBe(
    true,
  );
  expect(
    sitemapUrls.filter((url) => url === 'https://jetsanchez.com/chatbot/'),
  ).toHaveLength(1);
  expect(
    sitemapUrls.every((url) => {
      const pathname = new URL(url).pathname;
      return pathname !== '/tools/' && !pathname.startsWith('/tools/');
    }),
  ).toBe(true);
});

test('assistant corpus JSON stays out of the sitemap while the HTML license page remains', async ({
  request,
}) => {
  const paths = [
    '/assistant/corpus/manifest.json',
    '/assistant/corpus/content.json',
    '/assistant/corpus/index.json',
  ] as const;

  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  for (const path of paths) expect(sitemap).not.toContain(path);
  expect(sitemap).toContain('https://jetsanchez.com/licenses/egregore/');
  expect(sitemap).not.toContain('https://jetsanchez.com/licenses/jets-ghost/');
});

test('RSS emits only slashful public blog item URLs', async ({ request }) => {
  const rss = await (await request.get('/rss.xml')).text();
  const itemLinks = [
    ...rss.matchAll(
      /<item>[\s\S]*?<link>(https:\/\/jetsanchez\.com\/[^<]*)<\/link>[\s\S]*?<\/item>/gu,
    ),
  ].map((match) => match[1]);
  expect(itemLinks.length).toBeGreaterThan(0);
  expect(
    itemLinks.every((url) => {
      const pathname = new URL(url).pathname;
      return pathname.startsWith('/blog/') && pathname.endsWith('/');
    }),
  ).toBe(true);
  for (const excluded of [
    'https://jetsanchez.com/chatbot/',
    'https://jetsanchez.com/tools/',
    'https://jetsanchez.com/blog/the-future-of-ai/',
    'https://jetsanchez.com/blog/building-with-astro/',
  ]) {
    expect(itemLinks).not.toContain(excluded);
  }
});
