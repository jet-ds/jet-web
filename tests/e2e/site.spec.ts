import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { SOCIAL_LINKS } from '../../src/config/site';

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

test('Egregore exposes canonical qualification metadata', async ({ page }) => {
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
    'noindex, nofollow',
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

test('content card covers navigate through their dominant action everywhere', async ({
  page,
}) => {
  const cases = [
    {
      route: '/',
      imageName:
        'Retro computer with a human arm and a floating brain against a split purple and orange background',
      destination:
        '/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters/',
    },
    {
      route: '/',
      imageName:
        'Digital Squad Timesheet weekly dashboard for Jet Sanchez showing a populated July work week',
      destination: '/works/digital-squad-timesheet/',
    },
    {
      route: '/blog/',
      imageName:
        'Retro computer with a human arm and a floating brain against a split purple and orange background',
      destination:
        '/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters/',
    },
    {
      route: '/works/',
      imageName:
        'Digital Squad Timesheet weekly dashboard for Jet Sanchez showing a populated July work week',
      destination: '/works/digital-squad-timesheet/',
    },
  ] as const;

  for (const { route, imageName, destination } of cases) {
    await page.goto(route);
    const cover = page.getByRole('img', { name: imageName });
    await expect(cover).toBeVisible();
    await cover.click();
    await expect(page).toHaveURL(destination);
  }
});

test('homepage content cards include their padded perimeter in the dominant action', async ({
  page,
}) => {
  await page.goto('/');

  const primaryAction = page.locator(
    'main a[href="/works/digital-squad-timesheet/"]',
  );
  await primaryAction.scrollIntoViewIfNeeded();
  const card = primaryAction.locator('..');
  const cardBounds = await card.boundingBox();
  if (!cardBounds)
    throw new Error('Missing Digital Squad Timesheet homepage card');

  await page.mouse.click(cardBounds.x + 4, cardBounds.y + 4);
  await expect(page).toHaveURL('/works/digital-squad-timesheet/');
});

test('homepage content cards use deliberate human-facing card copy', async ({
  page,
}) => {
  const cases = [
    {
      href: '/blog/how-to-install-claude-code-cli-2026/',
      title: 'How to Install Claude Code CLI in 2026',
      description:
        "Install Claude Code CLI, configure plugins and skills, and start using Anthropic's coding agent.",
    },
    {
      href: '/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters/',
      title: 'Vibe Coding vs Agentic Coding',
      description:
        'Vibe coding explores ideas; agentic coding makes them survivable. Learn how these workflows differ.',
    },
    {
      href: '/works/digital-squad-timesheet/',
      title: 'Digital Squad Timesheet',
      description:
        'A weekly operations platform for time logging, project context, team visibility, and reporting.',
    },
    {
      href: '/works/recursive-convergence-hypothesis/',
      title: 'The Recursive Convergence Hypothesis',
      description:
        'A framework for how ASI may converge on synthetic sentience through recursive self-improvement.',
    },
  ] as const;

  await page.goto('/');

  for (const { href, title, description } of cases) {
    const teaser = page.locator(`main a[href="${href}"]`);
    await expect(
      teaser.getByRole('heading', { name: title, exact: true }),
    ).toBeVisible();

    const summary = teaser.locator('p');
    await expect(summary).toHaveText(description);
    const metrics = await summary.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        height: element.getBoundingClientRect().height,
        scrollHeight: element.scrollHeight,
        lineHeight: Number.parseFloat(styles.lineHeight),
        lineClamp: styles.webkitLineClamp,
      };
    });

    expect(metrics.lineClamp).toBe('4');
    expect(metrics.height).toBeLessThanOrEqual(metrics.lineHeight * 4 + 1);
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.height + 1);
  }
});

test('blog cards omit repeated single-author attribution while article pages retain it', async ({
  page,
}) => {
  const postRoutes = [
    '/blog/how-to-install-claude-code-cli-2026/',
    '/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters/',
  ] as const;

  for (const collectionRoute of ['/', '/blog/']) {
    await page.goto(collectionRoute);

    for (const postRoute of postRoutes) {
      const card = page.locator(`main a[href="${postRoute}"]`);
      await expect(card).toBeVisible();
      await expect(card).not.toContainText('Jet Sanchez');
    }
  }

  await page.goto(postRoutes[0]);
  await expect(page.locator('main')).toContainText('By Jet Sanchez');
});

test('image-backed Home and Works cards keep media and normalized metadata aligned', async ({
  page,
}) => {
  for (const route of ['/', '/works/']) {
    await page.goto(route);
    const timesheet = page.locator(
      'main a[href="/works/digital-squad-timesheet/"]',
    );
    const research = page.locator(
      'main a[href="/works/recursive-convergence-hypothesis/"]',
    );

    const geometry = await Promise.all(
      [timesheet, research].map((card) =>
        card.evaluate((element) => {
          const media = element.querySelector('[data-content-card-media]');
          const title = element.querySelector('[data-content-card-title]');
          const metadata = element.querySelector(
            '[data-content-card-metadata]',
          );
          if (!media || !title || !metadata)
            throw new Error('Incomplete shared content card');
          return {
            mediaTop: media.getBoundingClientRect().top,
            mediaHeight: media.getBoundingClientRect().height,
            titleHeight: title.getBoundingClientRect().height,
            metadataHeight: metadata.getBoundingClientRect().height,
            metadataTop: metadata.getBoundingClientRect().top,
          };
        }),
      ),
    );

    if ((page.viewportSize()?.width ?? 0) >= 768) {
      expect(
        Math.abs(geometry[0].mediaTop - geometry[1].mediaTop),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(geometry[0].metadataTop - geometry[1].metadataTop),
      ).toBeLessThanOrEqual(1);
    }
    expect(
      Math.abs(geometry[0].mediaHeight - geometry[1].mediaHeight),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(geometry[0].titleHeight - geometry[1].titleHeight),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(geometry[0].metadataHeight - geometry[1].metadataHeight),
    ).toBeLessThanOrEqual(1);
  }
});

test('image-backed content cards clip media and expose a visible keyboard boundary', async ({
  page,
}) => {
  const cases = [
    {
      route: '/blog/',
      href: '/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters/',
    },
    {
      route: '/works/',
      href: '/works/digital-squad-timesheet/',
    },
  ] as const;

  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });

    for (const { route, href } of cases) {
      await page.goto(route);
      const action = page.locator(`main a[href="${href}"]`).first();
      const image = action.getByRole('img');
      await expect(action).toBeVisible();
      await expect(image).toBeVisible();

      // Page navigation preserves the pointer position, which can leave the next
      // card hovered before its resting state is sampled.
      await page.mouse.move(width - 1, 1);
      await expect
        .poll(() =>
          image.evaluate((element) => getComputedStyle(element).transform),
        )
        .toBe('none');

      const rest = await action.evaluate((element) => {
        let surface = element.parentElement;
        while (surface !== null) {
          const style = getComputedStyle(surface);
          if (
            style.overflow === 'hidden' &&
            Number.parseFloat(style.borderRadius) > 0
          )
            break;
          surface = surface.parentElement;
        }
        if (surface === null)
          throw new Error('Clipped content-card surface missing');
        const media = surface.querySelector('[data-content-card-media]');
        const imageElement = media?.querySelector('img');
        if (!media || !imageElement)
          throw new Error('Content-card media boundary missing');
        const surfaceStyle = getComputedStyle(surface);
        return {
          borderRadius: Number.parseFloat(surfaceStyle.borderRadius),
          overflow: surfaceStyle.overflow,
          transform: getComputedStyle(imageElement).transform,
        };
      });
      expect(rest.borderRadius).toBe(8);
      expect(rest.overflow).toBe('hidden');

      await action.hover();
      await expect
        .poll(() =>
          image.evaluate((element) => getComputedStyle(element).transform),
        )
        .not.toBe(rest.transform);

      await page.reload();
      const keyboardAction = page.locator(`main a[href="${href}"]`).first();
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await page.keyboard.press('Tab');
        if (
          await keyboardAction.evaluate(
            (element) => element === document.activeElement,
          )
        )
          break;
      }
      await expect(keyboardAction).toBeFocused();
      const focus = await keyboardAction.evaluate((element) => {
        let surface = element.parentElement;
        while (surface !== null) {
          const style = getComputedStyle(surface);
          if (
            style.overflow === 'hidden' &&
            Number.parseFloat(style.borderRadius) > 0
          )
            break;
          surface = surface.parentElement;
        }
        if (surface === null)
          throw new Error('Clipped content-card surface missing');
        const style = getComputedStyle(surface);
        return {
          outlineOffset: Number.parseFloat(style.outlineOffset),
          outlineStyle: style.outlineStyle,
          outlineWidth: Number.parseFloat(style.outlineWidth),
          overflow: style.overflow,
        };
      });
      expect(focus.outlineStyle).toBe('solid');
      expect(focus.outlineWidth).toBe(2);
      expect(focus.outlineOffset).toBe(2);
      expect(focus.overflow).toBe('hidden');
    }
  }
});

test('work collection cards keep secondary actions visible inside the card boundary', async ({
  page,
}) => {
  await page.goto('/works/');

  const researchCard = page.locator('[data-filter-item]').filter({
    hasText: 'The Recursive Convergence Hypothesis',
  });
  const action = researchCard.getByRole('link', { name: 'View on SSRN' });

  await expect(action).toBeVisible();

  const bounds = await researchCard.evaluate((card) => {
    const cardRect = card.getBoundingClientRect();
    const actionElement = Array.from(card.querySelectorAll('a')).find((link) =>
      link.textContent?.includes('View on SSRN'),
    );
    if (!actionElement) throw new Error('Missing View on SSRN action');
    const actionRect = actionElement.getBoundingClientRect();

    return {
      actionBottom: actionRect.bottom,
      cardBottom: cardRect.bottom,
    };
  });

  expect(bounds.actionBottom).toBeLessThanOrEqual(bounds.cardBottom);
});

test('work collection summaries fit within four complete visible lines', async ({
  page,
}) => {
  await page.goto('/works/');

  const researchCard = page.locator('[data-filter-item]').filter({
    hasText: 'The Recursive Convergence Hypothesis',
  });
  const description = researchCard.locator('p');

  await expect(description).toHaveText(
    'A framework for how ASI may converge on synthetic sentience through recursive self-improvement.',
  );

  const metrics = await description.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      height: element.getBoundingClientRect().height,
      scrollHeight: element.scrollHeight,
      lineHeight: Number.parseFloat(styles.lineHeight),
      lineClamp: styles.webkitLineClamp,
    };
  });

  expect(metrics.lineClamp).toBe('4');
  expect(metrics.height).toBeLessThanOrEqual(metrics.lineHeight * 4 + 1);
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.height + 1);
});

test('project cards summarize additional technologies with an explicit accessible count', async ({
  page,
}) => {
  await page.goto('/works/');

  const timesheetCard = page.locator('[data-filter-item]').filter({
    hasText: 'Digital Squad Timesheet',
  });
  await expect(
    timesheetCard.getByText('Next.js, React, TypeScript +11', { exact: true }),
  ).toBeVisible();
  await expect(
    timesheetCard.getByText(
      'Next.js, React, TypeScript, plus 11 more technologies',
      { exact: true },
    ),
  ).toHaveCount(1);
  await expect(timesheetCard).not.toContainText('TypeScript...');
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

test('research exposes one DOI-backed action', async ({ page }) => {
  await page.goto('/works/recursive-convergence-hypothesis/');
  const action = page.getByRole('link', { name: 'View on SSRN' });
  await expect(action).toHaveAttribute(
    'href',
    'https://doi.org/10.2139/ssrn.5395309',
  );
  await expectSharedAction(action, 'accent', 'compact', 44);
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveCount(0);
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

test('draft Works stay unavailable and out of public discovery surfaces', async ({
  request,
}) => {
  const slug = 'broad-reach-uneven-depth';
  const route = await request.get(`/works/${slug}/`);
  const home = await (await request.get('/')).text();
  const works = await (await request.get('/works/')).text();
  const sitemap = await (await request.get('/sitemap-0.xml')).text();

  expect(route.status()).toBe(404);
  expect(home).not.toContain(slug);
  expect(works).not.toContain(slug);
  expect(sitemap).not.toContain(slug);
});

test('content pages expose parseable typed JSON-LD', async ({ page }) => {
  const researchCanonical =
    'https://jetsanchez.com/works/recursive-convergence-hypothesis/';
  const doi = 'https://doi.org/10.2139/ssrn.5395309';
  await page.goto('/works/recursive-convergence-hypothesis/');
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    'content',
    'article',
  );
  let schemas = await readSchemas(page);
  expect(
    schemas.find((schema) => schema['@type'] === 'ScholarlyArticle'),
  ).toMatchObject({
    url: researchCanonical,
    identifier: doi,
    sameAs: [doi],
    mainEntityOfPage: { '@id': `${researchCanonical}#webpage` },
  });

  const blogCanonical =
    'https://jetsanchez.com/blog/how-to-install-claude-code-cli-2026/';
  await page.goto('/blog/how-to-install-claude-code-cli-2026/');
  schemas = await readSchemas(page);
  expect(
    schemas.find((schema) => schema['@type'] === 'BlogPosting'),
  ).toMatchObject({
    url: blogCanonical,
    mainEntityOfPage: { '@id': `${blogCanonical}#webpage` },
  });
});

test('content pages use deliberate SEO titles without replacing their headings', async ({
  page,
}) => {
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
      heading:
        'The Recursive Convergence Hypothesis: Emergent Sentience as a Structural Attractor of Recursive ASI',
    },
    {
      route: '/works/digital-squad-timesheet/',
      seoTitle: 'Digital Squad Timesheet: Operations Platform | Jet Sanchez',
      heading: 'Digital Squad Timesheet',
    },
  ] as const;

  for (const { route, seoTitle, heading } of cases) {
    await page.goto(route);
    await expect(page).toHaveTitle(seoTitle);
    await expect(page.locator('main h1')).toHaveText(heading);
    expect(seoTitle.length).toBeLessThanOrEqual(60);
  }
});

test('content pages expose deliberate search descriptions and faithful entity summaries', async ({
  page,
}) => {
  const cases = [
    {
      route: '/blog/how-to-install-claude-code-cli-2026/',
      seoDescription:
        "Complete guide to installing Claude Code CLI, setting up plugins, leveraging skills, and getting productive with Anthropic's agentic coding tool.",
      entityType: 'BlogPosting',
      entityDescription:
        "Complete guide to installing Claude Code CLI, setting up plugins, leveraging skills, and getting productive with Anthropic's agentic coding tool.",
    },
    {
      route: '/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters/',
      seoDescription:
        'Vibe coding is exploratory. Agentic coding is survivable. Learn why intent, cognition, and workflow maturity now define modern software.',
      entityType: 'BlogPosting',
      entityDescription:
        'Vibe coding is exploratory. Agentic coding is survivable. Learn why intent, cognition, and workflow maturity now define modern software.',
    },
    {
      route: '/works/recursive-convergence-hypothesis/',
      seoDescription:
        'A theoretical framework proposing that recursive ASI may develop emergent sentience through self-improvement, agent modeling, and epistemic optimization.',
      entityType: 'ScholarlyArticle',
      entityDescription:
        'A theoretical framework proposing that recursive artificial superintelligence systems may develop emergent sentience as a structural outcome of epistemic optimization and world modeling, even without explicit design intentions.',
    },
    {
      route: '/works/digital-squad-timesheet/',
      seoDescription:
        'A task-based weekly operations platform for Digital Squad, combining time logging, project context, team visibility, and reporting in one focused workflow.',
      entityType: 'CreativeWork',
      entityDescription:
        'A task-based weekly operations platform for Digital Squad, combining time logging, project context, team visibility, and reporting in one focused workflow.',
    },
  ] as const;

  for (const {
    route,
    seoDescription,
    entityType,
    entityDescription,
  } of cases) {
    await page.goto(route);
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
    expect(
      schemas.find((schema) => schema['@type'] === entityType)?.description,
    ).toBe(entityDescription);
  }
});

test('custom blog images expose their verified intrinsic OpenGraph dimensions', async ({
  page,
}) => {
  for (const route of [
    '/blog/how-to-install-claude-code-cli-2026/',
    '/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters/',
  ]) {
    await page.goto(route);
    await expect(
      page.locator('meta[property="og:image:width"]'),
    ).toHaveAttribute('content', '1920');
    await expect(
      page.locator('meta[property="og:image:height"]'),
    ).toHaveAttribute('content', '1080');
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
  expect(crawlRoutes).not.toContain('/chatbot/');
  expect(crawlRoutes).not.toContain('/tools/');

  for (const route of [...crawlRoutes, '/chatbot/', '/tools/']) {
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

test('qualification and dormant routes stay out of the sitemap', async ({
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
  expect(sitemapUrls).not.toContain('https://jetsanchez.com/chatbot/');
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
