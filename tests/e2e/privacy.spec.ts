import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

function sitemapLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
    ([, location]) => location,
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

async function expectNoSeriousAxeViolations(page: Page, state: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter(
    ({ impact }) => impact === 'serious' || impact === 'critical',
  );
  expect(serious, `${state} has serious or critical axe violations`).toEqual(
    [],
  );
}

test('publishes a canonical, indexable combined Privacy and Cookies notice', async ({
  page,
}) => {
  const response = await page.goto('/privacy/');

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('Privacy and Cookies | Jet Sanchez');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://jetsanchez.com/privacy/',
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'index, follow',
  );
  await expect(
    page.getByRole('heading', { level: 1, name: 'Privacy and Cookies' }),
  ).toBeVisible();
  await expect(page.getByText('Effective August 26, 2026')).toBeVisible();
});

test('discloses the site storage and data-processing boundaries', async ({
  page,
}) => {
  await page.goto('/privacy/');
  const main = page.getByRole('main');

  for (const heading of [
    'Who runs this site',
    'Hosting and media delivery',
    'Analytics',
    'Cookies and browser storage',
    'Egregore',
    'External links',
    'Retention',
    'Your choices and rights',
    'Changes to this notice',
  ]) {
    await expect(
      main.getByRole('heading', { level: 2, name: heading }),
    ).toBeVisible();
  }

  await expect(main).toContainText(/production deployment/iu);
  await expect(main).toContainText(/local development, local previews, CI/iu);
  await expect(main).toContainText(/approximate request\s+country/iu);
  await expect(main).toContainText(/strict or\s+standard/iu);
  await expect(main).toContainText(/EEA,\s+the UK,\s+Switzerland/iu);
  await expect(main).toContainText(/unknown or\s+missing/iu);
  await expect(main).toContainText(/not a\s+legal-status determination/iu);
  await expect(main).toContainText(/Reject/iu);
  await expect(main).toContainText(/Allow/iu);
  await expect(main).toContainText(
    /not the IP\s+address, city, or coordinates/iu,
  );
  await expect(main).toContainText(/analytics=off/iu);
  await expect(main).toContainText(/browser profile/iu);
  await expect(main).toContainText(/do not identify a physical\s+device/iu);
  await expect(main).toContainText(/localStorage so it persists/iu);
  await expect(main).toContainText(/sessionStorage for the current tab/iu);
  await expect(main).toContainText(/about 2 GB/iu);
  await expect(main).toContainText(/Cache Storage/iu);
  await expect(main).toContainText(/storage estimate/iu);
  await expect(main).toContainText(/Questions, assembled prompts/iu);
  await expect(main).toContainText(/stay in this browser's current session/iu);
  await expect(main).toContainText(/Remove downloaded model/iu);

  await expect(
    main.getByRole('link', { name: /Google Privacy Policy/iu }),
  ).toHaveAttribute('href', 'https://policies.google.com/privacy');
  await expect(
    main.getByRole('link', { name: /Vercel Privacy Notice/iu }),
  ).toHaveAttribute('href', 'https://vercel.com/legal/privacy-notice');
  await expect(
    main.getByRole('link', {
      name: /Egregore model and open-source licenses/iu,
    }),
  ).toHaveAttribute('href', '/licenses/egregore/');
});

test('keeps Privacy out of primary navigation while linking it globally from the footer', async ({
  page,
}) => {
  for (const route of ['/', '/about/', '/blog/', '/works/', '/contact/']) {
    await page.goto(route);
    await expect(
      page.locator('footer').getByRole('link', { name: 'Privacy' }),
    ).toHaveAttribute('href', '/privacy/');
    await expect(
      page
        .locator('[data-navigation-role="dock"]')
        .getByRole('link', { name: 'Privacy' }),
    ).toHaveCount(0);
  }
});

test('includes the canonical Privacy route exactly once in the sitemap', async ({
  request,
}) => {
  const sitemap = await publishedSitemapXml(request);
  expect(
    sitemap.match(/<loc>https:\/\/jetsanchez\.com\/privacy\/<\/loc>/gu) ?? [],
  ).toHaveLength(1);
});

test('keeps the notice readable and axe-clean in both themes', async ({
  page,
}) => {
  for (const theme of ['light', 'dark'] as const) {
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem('theme', selectedTheme);
    }, theme);
    await page.goto('/privacy/');

    await expectNoSeriousAxeViolations(page, `Privacy in ${theme} theme`);
    const geometry = await page.evaluate(() => {
      const article = document.querySelector('main article');
      if (!(article instanceof HTMLElement)) {
        throw new Error('Privacy article is missing');
      }
      return {
        articleWidth: article.getBoundingClientRect().width,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.articleWidth).toBeGreaterThanOrEqual(
      Math.min(640, geometry.clientWidth * 0.8),
    );
    expect(geometry.articleWidth).toBeLessThanOrEqual(768);
  }
});
