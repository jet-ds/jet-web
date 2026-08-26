import { expect, test, type Locator, type Page } from '@playwright/test';
import { classifyGoogleAnalyticsRequest } from '../support/googleAnalyticsTraffic';
import { publishedContent } from '../support/publishedContent';

async function interceptGoogleAnalytics(page: Page): Promise<string[]> {
  const requests: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const requestKind = classifyGoogleAnalyticsRequest(url);
    if (requestKind === null) {
      await route.continue();
      return;
    }
    requests.push(url.href);
    await route.fulfill(
      requestKind === 'library'
        ? { status: 200, contentType: 'application/javascript', body: '' }
        : { status: 204 },
    );
  });
  return requests;
}

async function visitBlogArticleWithTableOfContents(page: Page): Promise<void> {
  for (const { route } of publishedContent().filter(
    ({ kind }) => kind === 'blog',
  )) {
    await page.goto(route);
    if ((await page.locator('[data-article-toc] a[href^="#"]').count()) > 0)
      return;
  }
  throw new Error(
    'Expected at least one published Blog article with a table of contents',
  );
}

async function selectRepresentedHeading(page: Page): Promise<{
  id: string;
  text: string;
}> {
  const target = await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    const maxScroll =
      document.documentElement.scrollHeight - window.innerHeight;
    const headings = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-article-toc-content] h2[id], [data-article-toc-content] h3[id]',
      ),
    ].filter((heading) =>
      document.querySelector(`[data-article-toc] a[href="#${heading.id}"]`),
    );
    const candidate = headings
      .map((heading, index) => ({
        heading,
        index,
        top: window.scrollY + heading.getBoundingClientRect().top,
      }))
      .filter(({ index, top }) => index > 0 && top >= 0 && top < maxScroll)
      .at(-1);
    if (candidate === undefined) return null;
    window.scrollTo({ top: candidate.top });
    return {
      id: candidate.heading.id,
      text: candidate.heading.textContent?.trim() ?? '',
    };
  });
  if (target === null || target.text === '')
    throw new Error('Expected a scrollable represented article heading');
  return target;
}

async function expectActiveHeading(
  page: Page,
  target: { id: string; text: string },
): Promise<void> {
  const links = page.locator(`[data-article-toc] a[href="#${target.id}"]`);
  await expect
    .poll(async () => {
      const states = await links.evaluateAll((anchors) =>
        anchors.map((anchor) => anchor.getAttribute('aria-current')),
      );
      return states.length > 0 && states.every((state) => state === 'location');
    })
    .toBe(true);
  await expect(page.locator('[data-article-toc-current]')).toHaveText(
    target.text,
  );
}

function boxesDoNotOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

test(
  'compact navigation keeps its disclosure visually separated from the dock',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/chatbot/');
    const disclosure = page.getByRole('button', { name: 'Close navigation' });
    const dock = page.locator('[data-navigation-role="dock"]');
    await expect(dock).toBeVisible();
    const readSpacing = () =>
      disclosure.evaluate((element) => {
        const dockElement = document.querySelector(
          '[data-navigation-role="dock"]',
        );
        if (
          !(element instanceof HTMLElement) ||
          !(dockElement instanceof HTMLElement)
        )
          throw new Error('Compact navigation geometry is unavailable');
        const disclosureBounds = element.getBoundingClientRect();
        const dockBounds = dockElement.getBoundingClientRect();
        const disclosureWidth = element.offsetWidth;
        const disclosureHeight = element.offsetHeight;
        const visualDisclosureBounds = {
          x:
            disclosureBounds.x + (disclosureBounds.width - disclosureWidth) / 2,
          y:
            disclosureBounds.y +
            (disclosureBounds.height - disclosureHeight) / 2,
          width: disclosureWidth,
          height: disclosureHeight,
        };
        const spacingProbe = document.createElement('span');
        spacingProbe.style.position = 'fixed';
        spacingProbe.style.width = 'var(--space-2xs)';
        document.body.append(spacingProbe);
        const intendedGap = Number.parseFloat(
          getComputedStyle(spacingProbe).width,
        );
        spacingProbe.remove();
        return {
          disclosureBounds: visualDisclosureBounds,
          dockBounds: {
            x: dockBounds.x,
            y: dockBounds.y,
            width: dockBounds.width,
            height: dockBounds.height,
          },
          gap:
            dockBounds.top -
            (visualDisclosureBounds.y + visualDisclosureBounds.height),
          intendedGap,
        };
      });
    await expect
      .poll(async () => {
        const spacing = await readSpacing();
        return (
          boxesDoNotOverlap(spacing.disclosureBounds, spacing.dockBounds) &&
          spacing.gap > 0 &&
          spacing.gap >= spacing.intendedGap - 1
        );
      })
      .toBe(true);
    const spacing = await readSpacing();
    expect(
      boxesDoNotOverlap(spacing.disclosureBounds, spacing.dockBounds),
    ).toBe(true);
    expect(spacing.gap).toBeGreaterThan(0);
    expect(spacing.gap).toBeGreaterThanOrEqual(spacing.intendedGap - 1);
  },
);

test('collection hubs keep their responsive two-column card geometry', async ({
  page,
}) => {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  for (const route of ['/blog/', '/works/']) {
    await page.goto(route);
    const cards = page.locator('main [data-content-card]');
    expect(await cards.count()).toBeGreaterThan(0);
    const media = cards.first().locator('[data-content-card-media]');
    const mediaBox = await media.boundingBox();
    expect(mediaBox).not.toBeNull();
    expect((mediaBox?.width ?? 0) / (mediaBox?.height ?? 1)).toBeCloseTo(
      16 / 9,
      2,
    );
    const cardBoxes = await cards.evaluateAll((elements) =>
      elements.slice(0, 2).map((element) => {
        const bounds = element.getBoundingClientRect();
        return { x: bounds.x, y: bounds.y };
      }),
    );
    expect(cardBoxes).toHaveLength(2);
    if ((viewport?.width ?? 0) >= 768) {
      expect(Math.abs(cardBoxes[0].y - cardBoxes[1].y)).toBeLessThanOrEqual(1);
      expect(cardBoxes[1].x).toBeGreaterThan(cardBoxes[0].x);
    } else {
      expect(Math.abs(cardBoxes[0].x - cardBoxes[1].x)).toBeLessThanOrEqual(1);
      expect(cardBoxes[1].y).toBeGreaterThan(cardBoxes[0].y);
    }

    const overflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  }
});

test(
  'desktop article navigation stays sticky and tracks the reading position',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await visitBlogArticleWithTableOfContents(page);

    const stickyAside = page.locator('aside:has([data-article-toc])');
    await expect(stickyAside).toHaveCSS('position', 'sticky');
    const target = await selectRepresentedHeading(page);
    await expectActiveHeading(page, target);

    const stickyGeometry = await stickyAside.evaluate((element) => ({
      actual: element.getBoundingClientRect().top,
      declared: Number.parseFloat(getComputedStyle(element).top),
    }));
    expect(
      Math.abs(stickyGeometry.actual - stickyGeometry.declared),
    ).toBeLessThanOrEqual(1);

    const back = page.getByRole('link', { name: 'Back to blog' });
    await back.focus();
    await expect(back.locator('[data-link-role="icon"]')).toHaveCSS(
      'text-decoration-line',
      'none',
    );
    await expect(back.locator('[data-link-role="label"]')).toHaveCSS(
      'text-decoration-line',
      'underline',
    );

    await page.setViewportSize({ width: 844, height: 390 });
    const compactTarget = await selectRepresentedHeading(page);
    await expectActiveHeading(page, compactTarget);
  },
);

test(
  'mobile article navigation clears the dock and preserves fragment focus',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 160));
    const dockDisclosure = page.getByRole('button', {
      name: 'Open navigation',
    });
    await expect(dockDisclosure).toBeVisible();
    await expect(dockDisclosure).toHaveAttribute('aria-expanded', 'false');

    await visitBlogArticleWithTableOfContents(page);
    await expect(dockDisclosure).toBeVisible();
    await expect(dockDisclosure).toHaveAttribute('aria-expanded', 'false');

    const toggle = page.getByRole('button', { name: /On this page/u });
    const panelId = await toggle.getAttribute('aria-controls');
    expect(panelId).not.toBeNull();
    const panel = page.locator(`#${panelId ?? ''}`);
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(panel).toBeVisible();

    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    const dockDisclosureBox = await dockDisclosure.boundingBox();
    expect(dockDisclosureBox).not.toBeNull();
    if (panelBox !== null && dockDisclosureBox !== null)
      expect(boxesDoNotOverlap(panelBox, dockDisclosureBox)).toBe(true);

    const headingLink = panel.getByRole('link').first();
    await page.keyboard.press('Tab');
    await expect(headingLink).toBeFocused();
    const href = await headingLink.getAttribute('href');
    expect(href).toMatch(/^#[^\s]+$/u);
    await page.keyboard.press('Enter');
    await expect(panel).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${href}$`, 'u'));
    await expect
      .poll(() =>
        page.evaluate(() => (document.activeElement as HTMLElement | null)?.id),
      )
      .toBe(href?.slice(1));
  },
);

test('theme and active navigation state persist across document navigation', async ({
  page,
}) => {
  const blog = publishedContent().find(({ kind }) => kind === 'blog');
  expect(blog).toBeDefined();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: /switch to dark mode/iu }).click();
  await page.goto(blog?.route ?? '/blog/');
  await expect(page.locator('html')).toHaveClass(/\bdark\b/u);
  await expect(
    page
      .locator('[data-navigation-role="dock"]')
      .getByRole('link', { name: 'Blog', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('theme-aware Work imagery is ready before its first theme switch', async ({
  page,
}) => {
  const work = publishedContent().find(
    ({ kind, image }) => kind === 'work' && image?.darkUrl !== undefined,
  );
  expect(work).toBeDefined();
  if (work?.image === undefined) return;
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await page.goto(work.route);

  let visibleImage: Locator = page.getByRole('img', {
    name: work.image.alt,
    exact: true,
  });
  await expect
    .poll(() =>
      visibleImage.evaluate(
        (element) =>
          element instanceof HTMLImageElement &&
          element.complete &&
          element.naturalWidth > 0,
      ),
    )
    .toBe(true);
  const lightSource = await visibleImage.getAttribute('src');
  await page.getByRole('button', { name: /switch to dark mode/iu }).click();
  visibleImage = page.getByRole('img', {
    name: work.image.alt,
    exact: true,
  });
  await expect
    .poll(() =>
      visibleImage.evaluate(
        (element) =>
          element instanceof HTMLImageElement &&
          element.complete &&
          element.naturalWidth > 0,
      ),
    )
    .toBe(true);
  const darkSource = await visibleImage.getAttribute('src');
  expect(lightSource).not.toBeNull();
  expect(darkSource).not.toBeNull();
  expect(darkSource).not.toBe(lightSource);
});

test('non-Production documents send no analytics traffic on direct or ClientRouter navigation', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.set(window, '__nonProductionPageLoadCount', 0);
    document.addEventListener('astro:page-load', () => {
      const current = Reflect.get(window, '__nonProductionPageLoadCount');
      Reflect.set(
        window,
        '__nonProductionPageLoadCount',
        typeof current === 'number' ? current + 1 : 1,
      );
    });
  });
  const analyticsRequests = await interceptGoogleAnalytics(page);
  const pageLoadCount = () =>
    page.evaluate(() => Reflect.get(window, '__nonProductionPageLoadCount'));

  await page.goto('/');
  await expect.poll(pageLoadCount).toBe(1);
  await page.waitForTimeout(300);
  expect(analyticsRequests).toEqual([]);

  await page.getByRole('link', { name: 'About', exact: true }).first().click();
  await expect(page).toHaveURL(/\/about\/$/u);
  await expect.poll(pageLoadCount).toBe(2);
  await page.waitForTimeout(300);

  expect(analyticsRequests).toEqual([]);
});
