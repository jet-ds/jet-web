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

test('explains the visitor-facing data choices and local-first boundaries', async ({
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

  await expect(main).toContainText(/approximate region/iu);
  await expect(main).toContainText(/wait\s+for\s+your\s+Allow/iu);
  await expect(main).toContainText(
    /location\s+is\s+unavailable,\s+it\s+will\s+also\s+wait\s+for\s+a\s+choice/iu,
  );
  await expect(main).toContainText(/Reject/iu);
  await expect(main).toContainText(/Allow/iu);
  await expect(main).toContainText(/only\s+your\s+resulting\s+preference/iu);
  await expect(main).toContainText(/not\s+raw\s+location\s+data/iu);
  await expect(main).toContainText(/analytics preference and cookies/iu);
  await expect(main).toContainText(/theme and interface preferences/iu);
  await expect(main).toContainText(/Egregore model and session data/iu);
  await expect(main).toContainText(/about 2 GB/iu);
  await expect(main).toContainText(
    /Opening\s+its\s+page\s+does\s+not\s+download\s+the\s+model/iu,
  );
  await expect(main).toContainText(
    /Load\s+Egregore.*downloads\s+the\s+model.*Hugging\s+Face/isu,
  );
  await expect(main).toContainText(
    /not\s+sent\s+to\s+a\s+hosted\s+inference\s+service/iu,
  );
  await expect(main).toContainText(
    /New\s+session\s+control\s+can\s+clear\s+your\s+current\s+conversation/iu,
  );
  await expect(main).toContainText(/Remove downloaded model/iu);

  for (const internalTerm of [
    /analytics=(?:off|on)/iu,
    /physical\s+device/iu,
    /this Mac/iu,
    /\bstrict\b/iu,
    /\bstandard\b/iu,
    /\bCI\b/u,
    /middleware/iu,
    /Partytown/iu,
    /ClientRouter/iu,
    /localStorage/iu,
    /sessionStorage/iu,
    /Cache Storage/iu,
  ]) {
    await expect(main).not.toContainText(internalTerm);
  }

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
      page.locator('footer ul').getByRole('link', { name: 'Privacy' }),
    ).toHaveAttribute('href', '/privacy/');
    await expect(
      page.locator('footer').getByRole('button', { name: /settings/iu }),
    ).toHaveCount(0);
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
