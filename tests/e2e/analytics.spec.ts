import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { SITE } from '../../src/config/site';
import { ANALYTICS_OPT_OUT_COOKIE } from '../../src/features/analytics/trackingPolicy';
import {
  ANALYTICS_CONSENT_COOKIE,
  ANALYTICS_POLICY_COOKIE,
} from '../../src/features/analytics/regionalPolicy';
import { classifyGoogleAnalyticsRequest } from '../support/googleAnalyticsTraffic';

const ANALYTICS_LIBRARY_STUB = String.raw`
  (() => {
    const queue = self.dataLayer = self.dataLayer || [];
    let configuredMeasurementId = null;
    const publish = (payload) => {
      fetch('/__analytics-observation?payload=' + encodeURIComponent(JSON.stringify(payload)));
    };
    const collect = (source, options) => {
      const query = new URLSearchParams({
        source,
        tid: configuredMeasurementId || '',
        page_location: options && options.page_location || self.location.href,
      });
      fetch('https://www.google-analytics.com/g/collect?' + query);
    };
    const observe = (entry) => {
      if (!entry) return;
      if (entry[0] === 'js') {
        publish({ command: 'js' });
        return;
      }
      if (entry[0] === 'config') {
        configuredMeasurementId = entry[1];
        const options = entry[2];
        publish({
          command: 'config',
          measurementId: configuredMeasurementId,
          options,
        });
        if (!options || options.send_page_view !== false) {
          collect('automatic', options);
        }
        return;
      }
      if (entry && entry[0] === 'event' && entry[1] === 'page_view') {
        const options = entry[2];
        publish({
          command: 'page_view',
          measurementId: configuredMeasurementId,
          options,
        });
        collect('manual', options);
      }
    };
    for (const entry of queue) observe(entry);
    const push = queue.push.bind(queue);
    queue.push = (...entries) => {
      for (const entry of entries) observe(entry);
      return push(...entries);
    };
  })();
`;

type PageViewSnapshot = {
  page_location: string;
  page_path: string;
  page_title: string;
};

type AnalyticsCommand =
  | {
      command: 'js';
    }
  | {
      command: 'config';
      measurementId: string;
      options: { send_page_view: boolean };
    }
  | {
      command: 'page_view';
      measurementId: string;
      options: PageViewSnapshot;
    };

type AnalyticsObservations = {
  libraryRequests: URL[];
  commands: AnalyticsCommand[];
  collectionRequests: URL[];
  unexpectedGoogleRequests: URL[];
};

async function interceptAnalyticsTraffic(
  page: Page,
): Promise<AnalyticsObservations> {
  const observations: AnalyticsObservations = {
    libraryRequests: [],
    commands: [],
    collectionRequests: [],
    unexpectedGoogleRequests: [],
  };

  await page.addInitScript(() => {
    Reflect.set(window, '__analyticsPageLoadCount', 0);
    document.addEventListener('astro:page-load', () => {
      const current = Reflect.get(window, '__analyticsPageLoadCount');
      Reflect.set(
        window,
        '__analyticsPageLoadCount',
        typeof current === 'number' ? current + 1 : 1,
      );
    });
  });

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/__analytics-observation') {
      const payload = url.searchParams.get('payload');
      if (payload !== null) {
        observations.commands.push(JSON.parse(payload) as AnalyticsCommand);
      }
      await route.fulfill({ status: 204 });
      return;
    }

    const requestKind = classifyGoogleAnalyticsRequest(url);
    if (requestKind === null) {
      await route.continue();
      return;
    }

    if (requestKind === 'library') {
      observations.libraryRequests.push(url);
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: ANALYTICS_LIBRARY_STUB,
      });
      return;
    }

    if (requestKind === 'collection') {
      observations.collectionRequests.push(url);
      await route.fulfill({ status: 204 });
      return;
    }

    observations.unexpectedGoogleRequests.push(url);
    await route.fulfill({ status: 204 });
  });

  return observations;
}

async function followClientRouterLink(
  page: Page,
  link: Locator,
  expectedPath: RegExp,
): Promise<void> {
  const completedPageCount = await pageLoadCount(page);
  await link.click();
  await expect(page).toHaveURL(expectedPath);
  await expect.poll(() => pageLoadCount(page)).toBe(completedPageCount + 1);
}

async function pageLoadCount(page: Page): Promise<number> {
  const count = await page.evaluate(() =>
    Reflect.get(window, '__analyticsPageLoadCount'),
  );
  if (typeof count !== 'number') {
    throw new TypeError('Astro page-load counter was not initialized');
  }
  return count;
}

async function readPageViewSnapshot(page: Page): Promise<PageViewSnapshot> {
  return page.evaluate(() => ({
    page_location: window.location.href,
    page_path: window.location.pathname,
    page_title: document.title,
  }));
}

async function analyticsDisabled(page: Page): Promise<boolean | undefined> {
  return page.evaluate(
    (measurementId) =>
      Reflect.get(window, `ga-disable-${measurementId}`) as boolean | undefined,
    SITE.ga4MeasurementId,
  );
}

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-vercel-ip-country': 'US' });
});

test('the same standard response exposes policy and emits one normal page view', async ({
  context,
  page,
}) => {
  const observations = await interceptAnalyticsTraffic(page);

  await page.goto('/');

  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.dataset.analyticsPolicy),
    )
    .toBe('standard');
  expect(
    (await context.cookies()).find(
      ({ name }) => name === ANALYTICS_POLICY_COOKIE,
    ),
  ).toMatchObject({
    name: ANALYTICS_POLICY_COOKIE,
    value: 'standard',
    path: '/',
    secure: true,
    sameSite: 'Lax',
  });
  await expect.poll(() => observations.libraryRequests.length).toBe(1);
  const pageView = await readPageViewSnapshot(page);
  await expect
    .poll(() => [...observations.commands])
    .toEqual([
      { command: 'js' },
      {
        command: 'config',
        measurementId: SITE.ga4MeasurementId,
        options: { send_page_view: false },
      },
      {
        command: 'page_view',
        measurementId: SITE.ga4MeasurementId,
        options: pageView,
      },
    ]);
  await expect.poll(() => observations.collectionRequests.length).toBe(1);
  expect(observations.collectionRequests[0].searchParams.get('source')).toBe(
    'manual',
  );
  expect(observations.collectionRequests[0].searchParams.get('tid')).toBe(
    SITE.ga4MeasurementId,
  );
  expect(observations.unexpectedGoogleRequests).toEqual([]);
  expect(await analyticsDisabled(page)).toBe(false);
});

test('strict and unknown regions make no Google request before a choice', async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ 'x-vercel-ip-country': 'ZZ' });
  const observations = await interceptAnalyticsTraffic(page);

  await page.goto('/');

  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.dataset.analyticsPolicy),
    )
    .toBe('strict');
  await expect(
    page.getByRole('region', { name: 'Analytics choices' }),
  ).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations.filter(
      ({ impact }) => impact === 'serious' || impact === 'critical',
    ),
  ).toEqual([]);
  expect(observations.libraryRequests).toEqual([]);
  expect(observations.commands).toEqual([]);
  expect(observations.collectionRequests).toEqual([]);
  expect(observations.unexpectedGoogleRequests).toEqual([]);
  expect(await analyticsDisabled(page)).toBe(true);
});

test('a genuinely missing country signal fails closed before consent', async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({});
  const observations = await interceptAnalyticsTraffic(page);

  await page.goto('/');

  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.dataset.analyticsPolicy),
    )
    .toBe('strict');
  await expect(
    page.getByRole('region', { name: 'Analytics choices' }),
  ).toBeVisible();
  expect(observations.libraryRequests).toEqual([]);
  expect(observations.commands).toEqual([]);
  expect(observations.collectionRequests).toEqual([]);
  expect(observations.unexpectedGoogleRequests).toEqual([]);
  expect(await analyticsDisabled(page)).toBe(true);
});

test('strict consent remains usable at representative mobile and desktop widths', async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ 'x-vercel-ip-country': 'DE' });
  await interceptAnalyticsTraffic(page);

  for (const viewportWidth of [320, 1280]) {
    await page.setViewportSize({ width: viewportWidth, height: 700 });
    await page.goto('/');

    const panel = page.getByRole('region', { name: 'Analytics choices' });
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox?.x).toBeGreaterThanOrEqual(0);
    expect((panelBox?.x ?? 0) + (panelBox?.width ?? 0)).toBeLessThanOrEqual(
      viewportWidth,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewportWidth);

    for (const button of [
      page.getByRole('button', { name: 'Reject analytics' }),
      page.getByRole('button', { name: 'Allow analytics' }),
    ]) {
      const buttonBox = await button.boundingBox();
      expect(buttonBox?.width).toBeGreaterThanOrEqual(44);
      expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test('reject records the preference and keeps strict-region analytics absent', async ({
  context,
  page,
}) => {
  await page.setExtraHTTPHeaders({ 'x-vercel-ip-country': 'DE' });
  const observations = await interceptAnalyticsTraffic(page);

  await page.goto('/');
  await page.getByRole('button', { name: 'Reject analytics' }).click();

  await expect(
    page.getByRole('region', { name: 'Analytics choices' }),
  ).toBeHidden();
  expect(
    (await context.cookies()).find(
      ({ name }) => name === ANALYTICS_CONSENT_COOKIE,
    ),
  ).toMatchObject({
    name: ANALYTICS_CONSENT_COOKIE,
    value: 'reject',
    path: '/',
    secure: true,
    sameSite: 'Lax',
  });
  await page.reload();
  expect(observations.libraryRequests).toEqual([]);
  expect(observations.commands).toEqual([]);
  expect(observations.collectionRequests).toEqual([]);
  expect(await analyticsDisabled(page)).toBe(true);
});

test('allow reloads once and starts the normal strict-region analytics sequence', async ({
  context,
  page,
}) => {
  await page.setExtraHTTPHeaders({ 'x-vercel-ip-country': 'DE' });
  const observations = await interceptAnalyticsTraffic(page);
  const documentRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      request.isNavigationRequest() &&
      request.frame() === page.mainFrame() &&
      url.pathname === '/'
    ) {
      documentRequests.push(request.url());
    }
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Allow analytics' }).click();
  await expect.poll(() => documentRequests.length).toBe(2);
  await page.waitForLoadState('load');

  expect(
    (await context.cookies()).find(
      ({ name }) => name === ANALYTICS_CONSENT_COOKIE,
    ),
  ).toMatchObject({
    name: ANALYTICS_CONSENT_COOKIE,
    value: 'allow',
    path: '/',
    secure: true,
    sameSite: 'Lax',
  });
  await expect.poll(() => observations.libraryRequests.length).toBe(1);
  await expect.poll(() => observations.commands.length).toBe(3);
  await expect.poll(() => observations.collectionRequests.length).toBe(1);
  expect(observations.commands.map(({ command }) => command)).toEqual([
    'js',
    'config',
    'page_view',
  ]);
  expect(documentRequests).toHaveLength(2);
  expect(
    await page.evaluate(() => {
      const [navigation] = performance.getEntriesByType(
        'navigation',
      ) as PerformanceNavigationTiming[];
      return navigation?.type;
    }),
  ).toBe('reload');
  expect(observations.unexpectedGoogleRequests).toEqual([]);
  expect(await analyticsDisabled(page)).toBe(false);
});

test('the Privacy page settings can dismiss, reopen, reject, and restore focus', async ({
  page,
}) => {
  const observations = await interceptAnalyticsTraffic(page);

  await page.goto('/privacy/');
  await expect.poll(() => observations.collectionRequests.length).toBe(1);
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'Privacy' })).toBeVisible();
  await expect(
    footer.getByRole('button', { name: /analytics preferences/iu }),
  ).toHaveCount(0);
  const settings = page.getByRole('button', {
    name: 'Manage analytics preferences',
  });
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await settings.click();
  await expect(settings).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByRole('region', { name: 'Analytics choices' }),
  ).toBeVisible();
  const reject = page.getByRole('button', { name: 'Reject analytics' });
  await expect(reject).toBeFocused();
  await page.getByRole('button', { name: 'Close analytics settings' }).click();
  await expect(
    page.getByRole('region', { name: 'Analytics choices' }),
  ).toBeHidden();
  await expect(settings).toBeFocused();
  await expect(settings).toHaveAttribute('aria-expanded', 'false');

  await settings.click();
  await reject.click();
  await expect(settings).toBeFocused();
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await followClientRouterLink(
    page,
    page.getByRole('link', { name: 'About', exact: true }).first(),
    /\/about\/$/u,
  );

  expect(observations.collectionRequests).toHaveLength(1);
  expect(await analyticsDisabled(page)).toBe(true);
});

test('the optional browser-profile fallback persists, clears across routes, and never duplicates page views', async ({
  context,
  page,
}) => {
  const observations = await interceptAnalyticsTraffic(page);

  await page.goto('/blog/?analytics=off&ref=preserved#retained');
  await expect(page).toHaveURL(
    'http://localhost:4323/blog/?ref=preserved#retained',
  );
  expect(observations.libraryRequests).toEqual([]);
  expect(await analyticsDisabled(page)).toBe(true);

  const optOutCookie = (await context.cookies()).find(
    ({ name }) => name === ANALYTICS_OPT_OUT_COOKIE,
  );
  expect(optOutCookie).toMatchObject({
    name: ANALYTICS_OPT_OUT_COOKIE,
    value: '1',
    path: '/',
    secure: true,
    sameSite: 'Lax',
  });
  const nowInSeconds = Date.now() / 1_000;
  expect(optOutCookie?.expires).toBeGreaterThan(nowInSeconds + 31_535_900);
  expect(optOutCookie?.expires).toBeLessThan(nowInSeconds + 31_536_100);

  await followClientRouterLink(
    page,
    page.getByRole('link', { name: 'Home', exact: true }).first(),
    /\/$/u,
  );
  expect(await analyticsDisabled(page)).toBe(true);
  expect(observations.commands).toEqual([]);
  expect(observations.collectionRequests).toEqual([]);

  const contact = page
    .getByRole('link', { name: 'Contact', exact: true })
    .first();
  await contact.evaluate((link) => {
    link.setAttribute('href', '/contact/?analytics=on&ref=preserved#retained');
  });
  await followClientRouterLink(
    page,
    contact,
    /\/contact\/\?ref=preserved#retained$/u,
  );

  const contactView = await readPageViewSnapshot(page);
  await expect
    .poll(() => [...observations.commands])
    .toEqual([
      {
        command: 'js',
      },
      {
        command: 'config',
        measurementId: SITE.ga4MeasurementId,
        options: { send_page_view: false },
      },
      {
        command: 'page_view',
        measurementId: SITE.ga4MeasurementId,
        options: contactView,
      },
    ]);
  await expect.poll(() => observations.collectionRequests.length).toBe(1);
  expect(await analyticsDisabled(page)).toBe(false);
  expect(
    (await context.cookies()).some(
      ({ name }) => name === ANALYTICS_OPT_OUT_COOKIE,
    ),
  ).toBe(false);

  await followClientRouterLink(
    page,
    page.getByRole('link', { name: 'About', exact: true }).first(),
    /\/about\/$/u,
  );
  const aboutView = await readPageViewSnapshot(page);

  await expect
    .poll(() => [...observations.commands])
    .toEqual([
      {
        command: 'js',
      },
      {
        command: 'config',
        measurementId: SITE.ga4MeasurementId,
        options: { send_page_view: false },
      },
      {
        command: 'page_view',
        measurementId: SITE.ga4MeasurementId,
        options: contactView,
      },
      {
        command: 'js',
      },
      {
        command: 'config',
        measurementId: SITE.ga4MeasurementId,
        options: { send_page_view: false },
      },
      {
        command: 'page_view',
        measurementId: SITE.ga4MeasurementId,
        options: aboutView,
      },
    ]);
  await expect.poll(() => observations.collectionRequests.length).toBe(2);
  expect(observations.libraryRequests).toHaveLength(2);
  expect(observations.unexpectedGoogleRequests).toEqual([]);
});
