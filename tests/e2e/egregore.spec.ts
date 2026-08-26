import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test,
  type Locator,
  type Page,
  type Request,
} from '@playwright/test';
import { isPartytownBlobScript } from '../manual/requestPrivacy';

const EGREGORE_PATH = '/chatbot/';
const CORPUS_PATHS = [
  '/assistant/corpus/manifest.json',
  '/assistant/corpus/content.json',
  '/assistant/corpus/index.json',
] as const;
const RUNTIME_ROOT = '/assistant/runtime/litert-lm/0.14.0/';
const REMOTE_MARKDOWN_IMAGE_URL = 'https://egregore.invalid/remote.png';
const PROMPT_SENTINEL = 'EGREGORE_PROMPT_SENTINEL_7f9e2d';
const SOURCE_SENTINEL = 'EGREGORE_SOURCE_SENTINEL_4a6c1b';

type FakeScenario =
  | 'default'
  | 'published-corpus'
  | 'markdown-safety'
  | 'load-failure'
  | 'crossfade'
  | 'loading'
  | 'long-stream'
  | 'late-event';

interface FetchRecord {
  url: string;
  method: string;
  credentials: RequestCredentials | null;
  headers: Array<[string, string]>;
  body: string | null;
}

interface RuntimeCall {
  method: string;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function fakePath(scenario: FakeScenario = 'default'): string {
  const slowStream = ['long-stream', 'late-event'].includes(scenario)
    ? '&stream=slow'
    : '';
  return `${EGREGORE_PATH}?runtime=fake&scenario=${scenario}${slowStream}`;
}

async function runtimeAuditReady(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __EGREGORE_E2E__?: { readonly calls: readonly unknown[] };
        }
      ).__EGREGORE_E2E__ !== undefined,
  );
}

async function runtimeMethods(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const auditedWindow = window as typeof window & {
      __EGREGORE_E2E__?: { readonly calls: readonly RuntimeCall[] };
    };
    return (
      auditedWindow.__EGREGORE_E2E__?.calls.map(({ method }) => method) ?? []
    );
  });
}

async function startFakeAssistant(
  page: Page,
  scenario: FakeScenario = 'default',
  modality: 'pointer' | 'keyboard' = 'pointer',
): Promise<Locator> {
  await page.goto(fakePath(scenario));
  await expect.poll(() => runtimeAuditReady(page)).toBe(true);
  await page.getByRole('button', { name: 'Check compatibility' }).click();
  const load = page.getByRole('button', { name: /Load Egregore/u });
  await expect(load).toBeVisible();
  if (modality === 'keyboard') {
    await load.focus();
    await load.press('Enter');
  } else {
    await load.click();
  }
  const composer = page.getByRole('textbox', { name: 'Ask Egregore' });
  await expect(composer).toBeEnabled();
  return composer;
}

async function submitQuestionAndWait(
  page: Page,
  question: string,
  modality: 'pointer' | 'keyboard' = 'pointer',
): Promise<void> {
  const articles = page.getByLabel('Conversation').locator('article');
  const priorCount = await articles.count();
  const composer = page.getByRole('textbox', { name: 'Ask Egregore' });
  await composer.fill(question);
  if (modality === 'keyboard') await composer.press('Enter');
  else await page.getByRole('button', { name: 'Send message' }).click();
  await expect(articles).toHaveCount(priorCount + 2);
  await expect(composer).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Stop response' })).toHaveCount(
    0,
  );
}

async function installFetchAudit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const auditedWindow = window as typeof window & {
      __EGREGORE_FETCHES__?: FetchRecord[];
    };
    const nativeFetch = window.fetch.bind(window);
    auditedWindow.__EGREGORE_FETCHES__ = [];
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      const headers = new Headers(init?.headers ?? request?.headers);
      let body: string | null = null;
      if (typeof init?.body === 'string') body = init.body;
      else if (init?.body instanceof URLSearchParams)
        body = init.body.toString();
      auditedWindow.__EGREGORE_FETCHES__?.push({
        url: new URL(
          request?.url ?? String(input),
          window.location.href,
        ).toString(),
        method: init?.method ?? request?.method ?? 'GET',
        credentials: init?.credentials ?? request?.credentials ?? null,
        headers: [...headers.entries()],
        body,
      });
      return nativeFetch(input, init);
    };
  });
}

async function auditedFetches(page: Page): Promise<FetchRecord[]> {
  return page.evaluate(() => {
    const auditedWindow = window as typeof window & {
      __EGREGORE_FETCHES__?: FetchRecord[];
    };
    return (
      auditedWindow.__EGREGORE_FETCHES__?.map((record) => ({
        ...record,
      })) ?? []
    );
  });
}

async function serializeTraffic(
  page: Page,
  browserRequests: readonly Request[],
): Promise<string> {
  return JSON.stringify({
    fetches: await auditedFetches(page),
    browserRequests: await Promise.all(
      browserRequests.map(async (request) => ({
        url: request.url(),
        method: request.method(),
        headers: await request.allHeaders(),
        body: request.postData(),
      })),
    ),
  });
}

async function declaredApplicationResources(page: Page): Promise<Set<string>> {
  const resources = await page.locator('head link[href]').evaluateAll((links) =>
    links.flatMap((link) => {
      if (!(link instanceof HTMLLinkElement)) return [];
      const metadataRelations = ['icon', 'apple-touch-icon', 'manifest'];
      if (
        !metadataRelations.some((relation) => link.relList.contains(relation))
      ) {
        return [];
      }
      const url = new URL(link.href, document.baseURI);
      return url.origin === window.location.origin ? [url.href] : [];
    }),
  );
  return new Set(resources);
}

function expectNoPrivateTraffic(serializedTraffic: string): void {
  expect(serializedTraffic).not.toContain(PROMPT_SENTINEL);
  expect(serializedTraffic).not.toContain(SOURCE_SENTINEL);
  expect(serializedTraffic).not.toMatch(
    /huggingface|cdn\.jsdelivr\.net|\.litertlm/iu,
  );
}

async function installSchedulerReleaseAudit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const auditedWindow = window as typeof window & {
      __EGREGORE_CHUNK_RELEASES__?: number;
    };
    auditedWindow.__EGREGORE_CHUNK_RELEASES__ = 0;
    window.addEventListener('egregore:e2e-scheduler-release', (event) => {
      if (
        event instanceof CustomEvent &&
        (event.detail as { phase?: unknown } | null)?.phase === 'chunk'
      ) {
        auditedWindow.__EGREGORE_CHUNK_RELEASES__ =
          (auditedWindow.__EGREGORE_CHUNK_RELEASES__ ?? 0) + 1;
      }
    });
  });
}

async function chunkReleaseCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __EGREGORE_CHUNK_RELEASES__?: number;
        }
      ).__EGREGORE_CHUNK_RELEASES__ ?? 0,
  );
}

function expectNoApplicationCredentials(
  headers: Record<string, string> | Array<[string, string]>,
  allowBrowserCookie: boolean,
): void {
  const entries = Array.isArray(headers) ? headers : Object.entries(headers);
  for (const [rawName, value] of entries) {
    const name = rawName.toLowerCase();
    expect(name, `Application credential header: ${rawName}`).not.toMatch(
      /^(?:authorization|proxy-authorization|x-|api[-_]?key$|apikey$|auth(?:entication)?[-_]?token$|access[-_]?token$|id[-_]?token$|credential$)/u,
    );
    expect(`${name}:${value}`, `Credential value in ${rawName}`).not.toMatch(
      /(?:^|\s)(?:bearer|basic)\s+|api[-_]?key|auth[-_]?token|access[-_]?token/iu,
    );
    if (!allowBrowserCookie) expect(name).not.toBe('cookie');
  }
}

function isAssistantResourceRequest(request: Request): boolean {
  const url = new URL(request.url());
  return (
    CORPUS_PATHS.includes(url.pathname as (typeof CORPUS_PATHS)[number]) ||
    url.pathname.startsWith(RUNTIME_ROOT) ||
    /huggingface|\.litertlm|litert[-_.]?lm/iu.test(url.href)
  );
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

function boxesDoNotOverlap(first: Box, second: Box): boolean {
  return (
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

function expectInsideViewport(box: Box, width: number, height: number): void {
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
}

function emittedLiteRtChunkPaths(): string[] {
  const assetDirectory = join(process.cwd(), 'dist', '_astro');
  return readdirSync(assetDirectory)
    .filter((name) => name.endsWith('.js'))
    .filter((name) =>
      readFileSync(join(assetDirectory, name), 'utf8').includes(
        'cdn.jsdelivr.net/npm/@litert-lm/core',
      ),
    )
    .map((name) => `/_astro/${name}`);
}

async function expectNoSeriousAxeViolations(page: Page, state: string) {
  const lifecycle = page.locator('[data-egregore-role="lifecycle"]');
  if ((await lifecycle.count()) > 0) {
    await expect
      .poll(() =>
        lifecycle.evaluate(
          (element) =>
            element
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === 'running').length,
        ),
      )
      .toBe(0);
  }
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter(
    ({ impact }) => impact === 'serious' || impact === 'critical',
  );
  expect(serious, `${state} has serious or critical axe violations`).toEqual(
    [],
  );
}

test(
  'keeps model-authored remote Markdown inert after an authorized response',
  { tag: '@desktop' },
  async ({ page }) => {
    let remoteImageRequests = 0;
    await page.route(REMOTE_MARKDOWN_IMAGE_URL, async (route) => {
      remoteImageRequests += 1;
      await route.abort();
    });
    const composer = await startFakeAssistant(page, 'markdown-safety');
    await submitQuestionAndWait(page, 'Render the safe response.');
    const response = page.getByLabel('Conversation').locator('article').last();
    await expect(response.locator('img')).toHaveCount(0);
    await expect(composer).toBeEnabled();
    expect(remoteImageRequests).toBe(0);
    await expectNoSeriousAxeViolations(page, 'safe Markdown response');
  },
);

test(
  'keeps the complete local runtime flow consent-gated, allowlisted, and private',
  { tag: '@desktop' },
  async ({ page }) => {
    await installFetchAudit(page);
    const browserRequests: Request[] = [];
    page.on('request', (request) => browserRequests.push(request));
    await page.goto(fakePath('published-corpus'));
    await expect.poll(() => runtimeAuditReady(page)).toBe(true);
    await expect(
      page.getByRole('button', { name: 'Check compatibility' }),
    ).toBeVisible();

    const runtimeChunks = emittedLiteRtChunkPaths();
    expect(runtimeChunks.length).toBeGreaterThan(0);
    expect(await runtimeMethods(page)).toEqual([]);
    const assistantRequests = () =>
      browserRequests.filter(
        (request) =>
          isAssistantResourceRequest(request) ||
          runtimeChunks.includes(new URL(request.url()).pathname),
      );
    expect(assistantRequests()).toEqual([]);
    expect(await auditedFetches(page)).toEqual([]);

    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await expect(
      page.getByRole('button', { name: /Load Egregore/u }),
    ).toBeVisible();
    const compatibilityMethods = await runtimeMethods(page);
    expect(compatibilityMethods).toContain('checkCapabilities');
    expect(
      compatibilityMethods.some((method) =>
        [
          'repository.load',
          'runtime.load',
          'engine.create',
          'conversation.create',
          'generate',
        ].includes(method),
      ),
    ).toBe(false);
    expect(assistantRequests()).toEqual([]);
    expect(await auditedFetches(page)).toEqual([]);

    await page.getByRole('button', { name: /Load Egregore/u }).click();
    await expect(
      page.getByRole('textbox', { name: 'Ask Egregore' }),
    ).toBeEnabled();

    const methodsAfterLoad = await runtimeMethods(page);
    for (const loadMethod of [
      'repository.load',
      'runtime.load',
      'engine.create',
    ]) {
      expect(methodsAfterLoad).toContain(loadMethod);
    }
    for (const promptOnlyMethod of [
      'conversation.create',
      'getConversationTokenCount',
      'generate',
    ]) {
      expect(methodsAfterLoad).not.toContain(promptOnlyMethod);
    }

    const fetchesAfterLoad = await auditedFetches(page);
    const corpusFetches = fetchesAfterLoad.filter(({ url }) =>
      CORPUS_PATHS.includes(
        new URL(url).pathname as (typeof CORPUS_PATHS)[number],
      ),
    );
    expect(
      new Set(corpusFetches.map(({ url }) => new URL(url).pathname)),
    ).toEqual(new Set(CORPUS_PATHS));
    for (const request of corpusFetches) {
      expect(request).toMatchObject({
        method: 'GET',
        credentials: 'omit',
        headers: [],
        body: null,
      });
      expectNoApplicationCredentials(request.headers, false);
    }
    expectNoPrivateTraffic(await serializeTraffic(page, browserRequests));
    expect(fetchesAfterLoad.some(({ url }) => url.includes(RUNTIME_ROOT))).toBe(
      false,
    );
    expect(
      browserRequests.some((request) =>
        runtimeChunks.includes(new URL(request.url()).pathname),
      ),
    ).toBe(false);

    await submitQuestionAndWait(page, PROMPT_SENTINEL);

    const fetchesAfterPrompt = await auditedFetches(page);
    expectNoPrivateTraffic(await serializeTraffic(page, browserRequests));
    expect(
      fetchesAfterPrompt.some(({ url }) => url.includes(RUNTIME_ROOT)),
    ).toBe(false);
    expect(
      browserRequests.some((request) =>
        runtimeChunks.includes(new URL(request.url()).pathname),
      ),
    ).toBe(false);

    const applicationOrigin = new URL(page.url()).origin;
    const declaredResources = await declaredApplicationResources(page);
    for (const request of browserRequests) {
      const url = new URL(request.url());
      const isDocument =
        url.origin === applicationOrigin && url.pathname === EGREGORE_PATH;
      const isCorpus =
        url.origin === applicationOrigin &&
        CORPUS_PATHS.includes(url.pathname as (typeof CORPUS_PATHS)[number]);
      const isApplicationAsset =
        url.origin === applicationOrigin && url.pathname.startsWith('/_astro/');
      const isDeclaredApplicationResource = declaredResources.has(url.href);
      const isLocalGeneratedScript = isPartytownBlobScript(
        request,
        url,
        applicationOrigin,
      );
      const isFont =
        (url.hostname === 'fonts.googleapis.com' && url.pathname === '/css2') ||
        (url.hostname === 'fonts.gstatic.com' &&
          request.resourceType() === 'font');
      const isPartytown =
        url.origin === applicationOrigin &&
        url.pathname.startsWith('/~partytown/');
      const isExternalAnalytics =
        [
          'www.google-analytics.com',
          'analytics.google.com',
          'region1.google-analytics.com',
          'www.googletagmanager.com',
        ].includes(url.hostname) &&
        /\/(?:g\/)?collect$|\/gtag\/js$/u.test(url.pathname);
      const isAnalytics = isPartytown || isExternalAnalytics;
      expect(
        isDocument ||
          isCorpus ||
          isApplicationAsset ||
          isDeclaredApplicationResource ||
          isLocalGeneratedScript ||
          isFont ||
          isAnalytics,
        `Nonallowlisted request: ${request.url()}`,
      ).toBe(true);
      if (!isAnalytics) {
        expect(request.method()).toBe('GET');
        expect(request.postData()).toBeNull();
      }
      expectNoApplicationCredentials(
        await request.allHeaders(),
        isDocument || isApplicationAsset || isAnalytics,
      );
    }

    const runtimeMethodsAfterPrompt = await runtimeMethods(page);
    for (const authorizedMethod of [
      'repository.load',
      'runtime.load',
      'engine.create',
      'conversation.create',
      'getConversationTokenCount',
      'generate',
    ]) {
      expect(runtimeMethodsAfterPrompt).toContain(authorizedMethod);
    }
  },
);

test(
  'keeps the complete Egregore lifecycle usable and nonoverlapping across the 767px handoff',
  { tag: '@desktop' },
  async ({ page }) => {
    for (const width of [767, 768]) {
      const height = 900;
      await page.setViewportSize({ width, height });
      await page.goto(fakePath('default'));
      await expectNoSeriousAxeViolations(page, `${width}px introduction`);
      await expect.poll(() => runtimeAuditReady(page)).toBe(true);
      await page.getByRole('button', { name: 'Check compatibility' }).click();
      const load = page.getByRole('button', { name: /Load Egregore/u });
      await load.focus();
      await load.press('Enter');

      const composer = page.getByRole('textbox', { name: 'Ask Egregore' });
      await expect(composer).toBeEnabled();
      await expect(composer).toBeFocused();
      await submitQuestionAndWait(
        page,
        'Describe one published idea.',
        'keyboard',
      );
      await expect(composer).toBeFocused();

      const disclosure = page.getByRole('button', { name: /^\d+ sources?$/u });
      await disclosure.focus();
      await disclosure.press('Enter');
      const sources = page.getByRole('region', {
        name: 'Sources for this response',
      });
      await expect(sources).toBeVisible();
      await sources.scrollIntoViewIfNeeded();
      const sourceLink = sources.getByRole('link').first();
      await expect(sourceLink).toHaveAttribute('target', '_blank');
      await expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer');

      const surfaces = {
        shell: await boxOf(page.locator('[data-egregore-role="shell"]')),
        lifecycle: await boxOf(
          page.locator('[data-egregore-role="lifecycle"]'),
        ),
        composer: await boxOf(page.locator('[data-egregore-role="composer"]')),
        sources: await boxOf(sources),
        dock: await boxOf(page.locator('[data-navigation-role="dock"]')),
      };
      for (const box of Object.values(surfaces))
        expectInsideViewport(box, width, height);
      for (const [firstName, secondName] of [
        ['lifecycle', 'sources'],
        ['lifecycle', 'composer'],
        ['lifecycle', 'dock'],
        ['sources', 'composer'],
        ['sources', 'dock'],
        ['composer', 'dock'],
      ] as const) {
        expect(
          boxesDoNotOverlap(surfaces[firstName], surfaces[secondName]),
          `${firstName} must not overlap ${secondName} at ${width}px`,
        ).toBe(true);
      }
      await expectNoSeriousAxeViolations(page, `${width}px response`);

      const newSession = page.getByRole('button', {
        name: /New session|Start a new session/u,
      });
      await newSession.focus();
      await newSession.press('Enter');
      await expect(
        page.getByLabel('Conversation').locator('article'),
      ).toHaveCount(0);
      await expect(composer).toHaveValue('');
      await page.getByRole('button', { name: /Unload/u }).click();
      await expect(
        page.getByRole('button', { name: 'Check compatibility' }),
      ).toBeFocused();
    }
  },
);

test(
  'recovers accessibly from one representative local-model load failure',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.goto(fakePath('load-failure'));
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    const load = page.getByRole('button', { name: /Load Egregore/u });
    await load.focus();
    await load.press('Enter');

    const recovery = page.getByRole('button', { name: 'Return to load' });
    await expect(recovery).toBeFocused();
    const descriptionId = await recovery.getAttribute('aria-describedby');
    expect(descriptionId).not.toBeNull();
    const error = page.locator(`#${descriptionId ?? ''}`);
    await expect(error).toBeVisible();
    await expect(error).not.toBeEmpty();
    await expectNoSeriousAxeViolations(page, 'recoverable load error');

    await recovery.press('Enter');
    await expect(load).toBeFocused();
    await expect(load).toBeEnabled();
  },
);

test(
  'retains an explicit mobile dock choice through route, history, and breakpoint changes',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto(fakePath());
    const disclosure = page.locator(
      'button[aria-controls="site-navigation-dock"]',
    );
    await disclosure.click();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');

    await page
      .getByRole('link', {
        name: 'Open Egregore model and open-source licenses',
      })
      .click();
    await expect(page).toHaveURL(/\/licenses\/egregore\/$/u);
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await page.reload();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await page.goBack();
    await expect(page).toHaveURL(/\/chatbot\//u);
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await page.goForward();
    await expect(page).toHaveURL(/\/licenses\/egregore\/$/u);
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');

    const compactViewport = page.viewportSize();
    expect(compactViewport).not.toBeNull();
    await page.setViewportSize({ width: 768, height: 680 });
    await expect(
      page.getByRole('button', { name: /navigation/iu }),
    ).toHaveCount(0);
    await page.setViewportSize({
      width: compactViewport?.width ?? 412,
      height: compactViewport?.height ?? 915,
    });
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  },
);

test(
  'reduced motion settles lifecycle changes without active animation',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(fakePath('crossfade'));
    const shell = page.locator('[data-egregore-role="shell"]');
    const expectSettled = async () => {
      await expect
        .poll(() =>
          shell.evaluate(
            (element) =>
              element
                .getAnimations({ subtree: true })
                .filter((animation) => animation.playState === 'running')
                .length,
          ),
        )
        .toBe(0);
    };
    await expectSettled();
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    const load = page.getByRole('button', { name: /Load Egregore/u });
    await expect(load).toBeVisible();
    await expectSettled();
    await load.click();
    const composer = page.getByRole('textbox', { name: 'Ask Egregore' });
    await expect(composer).toBeEnabled();
    await expectSettled();
  },
);

test(
  'Cancel and reload requests one document reload during model loading',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.goto(fakePath('loading'));
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await page.getByRole('button', { name: /Load Egregore/u }).click();
    await expect(page.getByTestId('loading-stack')).toBeVisible();
    let reloadAttempts = 0;
    await page.route('**/chatbot/**', async (route) => {
      if (route.request().resourceType() === 'document') {
        reloadAttempts += 1;
        await route.abort('aborted');
      } else await route.continue();
    });
    await page
      .getByRole('button', { name: 'Cancel and reload' })
      .click()
      .catch(() => undefined);
    await expect.poll(() => reloadAttempts).toBe(1);
  },
);

test(
  'manual scroll-away pauses sticky follow until Jump to latest',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 480 });
    const composer = await startFakeAssistant(page, 'long-stream');
    await composer.fill('Describe one published idea.');
    await composer.press('Enter');
    const scroller = page.locator('[data-egregore-role="conversation"]');
    const assistant = scroller.locator('article').last();
    await expect(assistant).not.toBeEmpty();
    await expect
      .poll(() =>
        scroller.evaluate(
          (element) =>
            element.scrollHeight - element.scrollTop - element.clientHeight < 1,
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        scroller.evaluate(
          (element) => element.scrollHeight - element.clientHeight,
        ),
      )
      .toBeGreaterThan(0);

    await scroller.evaluate((element) => {
      element.scrollTop = Math.max(
        0,
        element.scrollHeight - element.clientHeight * 1.5,
      );
      element.dispatchEvent(new Event('scroll'));
    });
    const awayPosition = await scroller.evaluate(
      (element) => element.scrollTop,
    );
    const contentBefore = await assistant.textContent();
    await expect.poll(() => assistant.textContent()).not.toBe(contentBefore);
    await expect(
      page.getByRole('button', { name: 'Jump to latest' }),
    ).toBeVisible();
    expect(await scroller.evaluate((element) => element.scrollTop)).toBe(
      awayPosition,
    );

    await page.getByRole('button', { name: 'Jump to latest' }).click();
    await expect
      .poll(() =>
        scroller.evaluate(
          (element) =>
            element.scrollHeight - element.scrollTop - element.clientHeight < 1,
        ),
      )
      .toBe(true);
  },
);

test(
  'ClientRouter navigation isolates a new session and suppresses late output',
  { tag: '@desktop' },
  async ({ page }) => {
    await installSchedulerReleaseAudit(page);
    const firstQuestion = 'Describe one published idea.';
    const composer = await startFakeAssistant(page, 'late-event');
    const releasesBeforeGeneration = await chunkReleaseCount(page);
    await composer.fill(firstQuestion);
    await composer.press('Enter');
    await expect(
      page.getByLabel('Conversation').locator('article'),
    ).toHaveCount(2);

    await page
      .locator('[data-navigation-role="dock"]')
      .getByRole('link', { name: 'About' })
      .click();
    await expect(page.getByRole('heading', { name: /About/iu })).toBeVisible();
    await expect
      .poll(() => chunkReleaseCount(page))
      .toBeGreaterThan(releasesBeforeGeneration);
    await expect(page.getByLabel('Conversation')).toHaveCount(0);
    await expect(page.locator('[data-egregore-role="lifecycle"]')).toHaveCount(
      0,
    );

    await page
      .locator('[data-navigation-role="dock"]')
      .getByRole('link', { name: 'Egregore' })
      .click();
    await expect(
      page.getByRole('button', { name: 'Check compatibility' }),
    ).toBeVisible();
    await expect(page.getByText(firstQuestion, { exact: true })).toHaveCount(0);
    await startFakeAssistant(page);
    await submitQuestionAndWait(page, 'Start a separate session.');
    await expect(
      page.getByText('Start a separate session.', { exact: true }),
    ).toBeVisible();
  },
);
