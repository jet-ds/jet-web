import { expect, test, type Locator, type Page } from '@playwright/test';
import { SITE } from '../../src/config/site';
import { ANALYTICS_OPT_OUT_COOKIE } from '../../src/features/analytics/trackingPolicy';

const ANALYTICS_LIBRARY_STUB = String.raw`
  (() => {
    const queue = self.dataLayer = self.dataLayer || [];
    const observe = (entry) => {
      let command = null;
      if (entry && entry[0] === 'config') command = 'config';
      if (entry && entry[0] === 'event' && entry[1] === 'page_view') {
        command = 'page_view';
      }
      if (command === null) return;
      fetch('/__analytics-observation?command=' + command);
      if (command === 'page_view') {
        fetch('https://www.google-analytics.com/g/collect?event=page_view');
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

type AnalyticsObservations = {
  libraryRequests: string[];
  commands: string[];
  collectionRequests: string[];
  unexpectedGoogleRequests: string[];
};

function isAnalyticsHost(hostname: string): boolean {
  return (
    hostname === 'www.googletagmanager.com' ||
    hostname === 'analytics.google.com' ||
    hostname === 'google-analytics.com' ||
    hostname.endsWith('.google-analytics.com') ||
    hostname === 'stats.g.doubleclick.net'
  );
}

function isAnalyticsLibrary(url: URL): boolean {
  return (
    url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js'
  );
}

function isAnalyticsCollection(url: URL): boolean {
  return (
    (url.hostname === 'analytics.google.com' ||
      url.hostname === 'google-analytics.com' ||
      url.hostname.endsWith('.google-analytics.com') ||
      url.hostname === 'stats.g.doubleclick.net') &&
    /^\/(?:g\/)?collect$/u.test(url.pathname)
  );
}

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
    Reflect.set(window, '__analyticsPartytownReadyCount', 0);
    document.addEventListener('pt0', () => {
      const current = Reflect.get(window, '__analyticsPartytownReadyCount');
      Reflect.set(
        window,
        '__analyticsPartytownReadyCount',
        typeof current === 'number' ? current + 1 : 1,
      );
    });
  });

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/__analytics-observation') {
      const command = url.searchParams.get('command');
      if (command !== null) observations.commands.push(command);
      await route.fulfill({ status: 204 });
      return;
    }

    if (!isAnalyticsHost(url.hostname)) {
      await route.continue();
      return;
    }

    if (isAnalyticsLibrary(url)) {
      observations.libraryRequests.push(url.href);
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: ANALYTICS_LIBRARY_STUB,
      });
      return;
    }

    if (isAnalyticsCollection(url)) {
      observations.collectionRequests.push(url.href);
      await route.fulfill({ status: 204 });
      return;
    }

    observations.unexpectedGoogleRequests.push(url.href);
    await route.fulfill({ status: 204 });
  });

  return observations;
}

async function followClientRouterLink(
  page: Page,
  link: Locator,
  expectedPath: RegExp,
): Promise<void> {
  const readyCount = await partytownReadyCount(page);
  await link.click();
  await expect(page).toHaveURL(expectedPath);
  await expect.poll(() => partytownReadyCount(page)).toBe(readyCount + 1);
}

async function partytownReadyCount(page: Page): Promise<number> {
  const count = await page.evaluate(() =>
    Reflect.get(window, '__analyticsPartytownReadyCount'),
  );
  if (typeof count !== 'number') {
    throw new TypeError('Partytown readiness counter was not initialized');
  }
  return count;
}

async function analyticsDisabled(page: Page): Promise<boolean | undefined> {
  return page.evaluate(
    (measurementId) =>
      Reflect.get(window, `ga-disable-${measurementId}`) as boolean | undefined,
    SITE.ga4MeasurementId,
  );
}

test('enabled Production emits one config and page view on a direct visit', async ({
  page,
}) => {
  const observations = await interceptAnalyticsTraffic(page);

  await page.goto('/');

  await expect.poll(() => observations.libraryRequests.length).toBe(1);
  await expect
    .poll(() => [...observations.commands])
    .toEqual(['config', 'page_view']);
  await expect.poll(() => observations.collectionRequests.length).toBe(1);
  expect(observations.unexpectedGoogleRequests).toEqual([]);
  expect(await analyticsDisabled(page)).toBe(false);
});

test('device opt-out persists, clears across routes, and never duplicates page views', async ({
  context,
  page,
}) => {
  const observations = await interceptAnalyticsTraffic(page);

  await page.goto('/blog/?analytics=off&campaign=task-12#preserved');
  await expect(page).toHaveURL(
    'http://localhost:4323/blog/?campaign=task-12#preserved',
  );
  await expect.poll(() => observations.libraryRequests.length).toBe(1);
  await expect.poll(() => partytownReadyCount(page)).toBe(1);
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
    link.setAttribute(
      'href',
      '/contact/?analytics=on&campaign=task-12#preserved',
    );
  });
  await followClientRouterLink(
    page,
    contact,
    /\/contact\/\?campaign=task-12#preserved$/u,
  );

  await expect
    .poll(() => [...observations.commands])
    .toEqual(['config', 'page_view']);
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
  await followClientRouterLink(
    page,
    page.getByRole('link', { name: 'Blog', exact: true }).first(),
    /\/blog\/$/u,
  );
  await followClientRouterLink(
    page,
    page.getByRole('link', { name: 'Works', exact: true }).first(),
    /\/works\/$/u,
  );

  await expect
    .poll(() => [...observations.commands])
    .toEqual([
      'config',
      'page_view',
      'config',
      'page_view',
      'config',
      'page_view',
      'config',
      'page_view',
    ]);
  await expect.poll(() => observations.collectionRequests.length).toBe(4);
  expect(observations.unexpectedGoogleRequests).toEqual([]);
});
