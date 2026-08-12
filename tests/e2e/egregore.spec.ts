import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
  type Request,
} from '@playwright/test';

const EGREGORE_PATH = '/chatbot/';
const CORPUS_PATHS = [
  '/assistant/corpus/manifest.json',
  '/assistant/corpus/content.json',
  '/assistant/corpus/index.json',
] as const;
const RUNTIME_ROOT = '/assistant/runtime/litert-lm/0.14.0/';
const LITERT_ASSETS = new Set([
  'litertlm_wasm_internal.js',
  'litertlm_wasm_internal.wasm',
  'litertlm_wasm_asyncify_internal.js',
  'litertlm_wasm_asyncify_internal.wasm',
  'litertlm_wasm_compat_internal.js',
  'litertlm_wasm_compat_internal.wasm',
  'litertlm_wasm_compat_asyncify_internal.js',
  'litertlm_wasm_compat_asyncify_internal.wasm',
]);
const LONG_SOURCE_TITLE =
  'The Recursive Convergence Hypothesis: Emergent Sentience as a Structural Attractor of Recursive ASI';
const PROMPT_SENTINEL = 'EGREGORE_PROMPT_SENTINEL_7f9e2d';
const SOURCE_SENTINEL = 'EGREGORE_SOURCE_SENTINEL_4a6c1b';

type FakeScenario =
  | 'default'
  | 'published-corpus'
  | 'checking'
  | 'unsupported'
  | 'load-failure'
  | 'generation-failure'
  | 'reset-failure'
  | 'unload-failure'
  | 'loading'
  | 'unloading'
  | 'cached'
  | 'crossfade'
  | 'long-stream'
  | 'stop-recovery'
  | 'citations'
  | 'zero-citation'
  | 'exhaustion'
  | 'late-event';

interface RuntimeCall {
  method: string;
}

interface FetchRecord {
  url: string;
  method: string;
  credentials: RequestCredentials | null;
  headers: Array<[string, string]>;
  body: string | null;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LargeGhostLayerAuditEntry {
  currentMode: string | null;
  modes: string[];
  positions: string[];
  viewportCount: number;
}

function currentStatusLabel(page: Page): Locator {
  return page.getByTestId('lifecycle-visual-label').last();
}

function largeGhostViewport(page: Page): Locator {
  return page.getByTestId('animated-ghost-viewport');
}

function largeGhostLayers(page: Page): Locator {
  return page.getByTestId('animated-ghost-mode-layer');
}

async function expectOutsideTextLinkRecipe(element: Locator) {
  await expect(element).toBeVisible();
  await expect(element).not.toHaveClass(/(^|\s)text-link(\s|$)/u);
}

function fakePath(scenario: FakeScenario = 'default'): string {
  const legacySlowStream = [
    'long-stream',
    'stop-recovery',
    'late-event',
  ].includes(scenario)
    ? '&stream=slow'
    : '';
  return `${EGREGORE_PATH}?runtime=fake&scenario=${scenario}${legacySlowStream}`;
}

async function runtimeCalls(page: Page): Promise<RuntimeCall[]> {
  return page.evaluate(() => {
    const state = window as typeof window & {
      __EGREGORE_E2E__?: {
        readonly calls: readonly Readonly<RuntimeCall>[];
      };
    };
    return state.__EGREGORE_E2E__?.calls.map((call) => ({ ...call })) ?? [];
  });
}

async function runtimeMethods(page: Page): Promise<string[]> {
  return (await runtimeCalls(page)).map(({ method }) => method);
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

async function installLifecycleLabelAudit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = window as typeof window & { __EGREGORE_LABELS__?: string[] };
    state.__EGREGORE_LABELS__ = [];
    const record = () => {
      for (const element of document.querySelectorAll(
        '[data-testid="lifecycle-visual-label"]',
      )) {
        const label = element.textContent?.trim() ?? '';
        if (label !== '' && !state.__EGREGORE_LABELS__?.includes(label)) {
          state.__EGREGORE_LABELS__?.push(label);
        }
      }
    };
    new MutationObserver(record).observe(document, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
}

async function installLargeGhostLayerAudit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    interface AuditEntry {
      currentMode: string | null;
      modes: string[];
      positions: string[];
      viewportCount: number;
    }
    const auditedWindow = window as typeof window & {
      __EGREGORE_LAYER_AUDIT__?: AuditEntry[];
    };
    auditedWindow.__EGREGORE_LAYER_AUDIT__ = [];
    let previousSignature = '';
    const record = () => {
      const viewports = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="animated-ghost-viewport"]',
        ),
      ];
      const layers = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="animated-ghost-mode-layer"]',
        ),
      ];
      const modes = layers.map((layer) => layer.dataset.mode ?? '');
      const positions = layers.map((layer) => getComputedStyle(layer).position);
      const currentMode = viewports[0]?.dataset.mode ?? null;
      const signature = JSON.stringify({
        currentMode,
        modes,
        positions,
        viewportCount: viewports.length,
      });
      if (signature === previousSignature) return;
      previousSignature = signature;
      auditedWindow.__EGREGORE_LAYER_AUDIT__?.push({
        currentMode,
        modes,
        positions,
        viewportCount: viewports.length,
      });
    };
    new MutationObserver(record).observe(document, {
      childList: true,
      subtree: true,
    });
    document.addEventListener('DOMContentLoaded', record, { once: true });
  });
}

async function largeGhostLayerAudit(
  page: Page,
): Promise<LargeGhostLayerAuditEntry[]> {
  return page.evaluate(() => {
    const auditedWindow = window as typeof window & {
      __EGREGORE_LAYER_AUDIT__?: LargeGhostLayerAuditEntry[];
    };
    return (
      auditedWindow.__EGREGORE_LAYER_AUDIT__?.map((entry) => ({
        ...entry,
        modes: [...entry.modes],
        positions: [...entry.positions],
      })) ?? []
    );
  });
}

async function auditedFetches(page: Page): Promise<FetchRecord[]> {
  return page.evaluate(() => {
    const auditedWindow = window as typeof window & {
      __EGREGORE_FETCHES__?: FetchRecord[];
    };
    return (
      auditedWindow.__EGREGORE_FETCHES__?.map((record) => ({ ...record })) ?? []
    );
  });
}

async function startFakeAssistant(
  page: Page,
  scenario: FakeScenario = 'default',
  loadModality: 'pointer' | 'keyboard' = 'pointer',
): Promise<Locator> {
  await page.goto(fakePath(scenario));
  await expect.poll(() => runtimeAuditReady(page)).toBe(true);
  await page.getByRole('button', { name: 'Check compatibility' }).click();
  const load = page.getByRole('button', { name: /Load Egregore/ });
  await expect(load).toBeVisible();
  if (loadModality === 'keyboard') {
    await load.focus();
    await load.press('Enter');
  } else {
    await load.click();
  }
  const composer = page.getByRole('textbox', { name: 'Ask Egregore' });
  await expect(composer).toBeEnabled();
  await expect(currentStatusLabel(page)).toHaveText('Ready');
  return composer;
}

async function generatedResponseCount(page: Page): Promise<number> {
  return (await runtimeMethods(page)).filter((method) => method === 'generate')
    .length;
}

async function submitQuestion(
  page: Page,
  question: string,
  modality: 'pointer' | 'keyboard' = 'pointer',
): Promise<number> {
  const completedGenerationCount = await generatedResponseCount(page);
  const composer = page.getByRole('textbox', { name: 'Ask Egregore' });
  await composer.fill(question);
  if (modality === 'keyboard') await composer.press('Enter');
  else await page.getByRole('button', { name: 'Send message' }).click();
  return completedGenerationCount;
}

async function waitForCompletedResponse(
  page: Page,
  completedGenerationCount: number,
): Promise<void> {
  await expect
    .poll(
      async () =>
        (await runtimeMethods(page)).filter((method) => method === 'generate')
          .length,
    )
    .toBeGreaterThan(completedGenerationCount);
  await expect(
    page.getByRole('textbox', { name: 'Ask Egregore' }),
  ).toBeEnabled();
  await expect(currentStatusLabel(page)).toHaveText('Ready');
}

async function submitQuestionAndWait(
  page: Page,
  question: string,
  modality: 'pointer' | 'keyboard' = 'pointer',
): Promise<void> {
  const completedGenerationCount = await submitQuestion(
    page,
    question,
    modality,
  );
  await waitForCompletedResponse(page, completedGenerationCount);
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

function expectStableBox(before: Box, after: Box, tolerance = 1): void {
  for (const property of ['x', 'y', 'width', 'height'] as const) {
    expect(
      Math.abs(before[property] - after[property]),
      property,
    ).toBeLessThanOrEqual(tolerance);
  }
}

async function expectLifecycleLabelContained(
  page: Page,
  expectedLabel: string,
): Promise<void> {
  const label = currentStatusLabel(page);
  const status = page.getByTestId('lifecycle-visible-status');
  const header = page.locator('.egregore-header');
  await expect(label).toHaveText(expectedLabel);
  await page.waitForTimeout(220);
  await expect(page.getByTestId('lifecycle-visual-label')).toHaveCount(1);

  const [labelBox, statusBox, headerBox] = await Promise.all([
    boxOf(label),
    boxOf(status),
    boxOf(header),
  ]);
  expect(labelBox.y).toBeGreaterThanOrEqual(statusBox.y - 1);
  expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(
    statusBox.y + statusBox.height + 1,
  );
  expect(statusBox.y).toBeGreaterThanOrEqual(headerBox.y - 1);
  expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(
    headerBox.y + headerBox.height + 1,
  );
}

async function renderedContrastRatio(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const readColor = (color: string): [number, number, number, number] => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d');
      if (context === null)
        throw new Error('Canvas color conversion is unavailable');
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
      return [red, green, blue, alpha];
    };
    const backdropFor = (start: Element | null): [number, number, number] => {
      let current = start;
      while (current !== null) {
        const [red, green, blue, alpha] = readColor(
          getComputedStyle(current).backgroundColor,
        );
        if (alpha === 255) return [red, green, blue];
        current = current.parentElement;
      }
      return [255, 255, 255];
    };
    const blend = (
      foreground: [number, number, number],
      background: [number, number, number],
      alpha: number,
    ): [number, number, number] =>
      foreground.map(
        (channel, index) => channel * alpha + background[index] * (1 - alpha),
      ) as [number, number, number];
    const luminance = (color: [number, number, number]) => {
      const [red, green, blue] = color.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };

    const style = getComputedStyle(element);
    const [foregroundRed, foregroundGreen, foregroundBlue] = readColor(
      style.color,
    );
    const [surfaceRed, surfaceGreen, surfaceBlue] = readColor(
      style.backgroundColor,
    );
    const backdrop = backdropFor(element.parentElement);
    const opacity = Number.parseFloat(style.opacity);
    const foreground = blend(
      [foregroundRed, foregroundGreen, foregroundBlue],
      backdrop,
      opacity,
    );
    const background = blend(
      [surfaceRed, surfaceGreen, surfaceBlue],
      backdrop,
      opacity,
    );
    const lighter = Math.max(luminance(foreground), luminance(background));
    const darker = Math.min(luminance(foreground), luminance(background));
    return (lighter + 0.05) / (darker + 0.05);
  });
}

function expectStableVerticalCenter(
  before: Box,
  after: Box,
  tolerance = 1,
): void {
  expect(Math.abs(before.y - after.y), 'y').toBeLessThanOrEqual(tolerance);
  expect(Math.abs(before.height - after.height), 'height').toBeLessThanOrEqual(
    tolerance,
  );
  expect(
    Math.abs(before.x + before.width / 2 - (after.x + after.width / 2)),
    'center-x',
  ).toBeLessThanOrEqual(tolerance);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function expectNoApplicationCredentials(
  headers: Record<string, string> | Array<[string, string]>,
  options: { allowBrowserCookie: boolean },
): void {
  const entries = Array.isArray(headers) ? headers : Object.entries(headers);
  for (const [rawName, value] of entries) {
    const name = rawName.toLowerCase();
    expect(
      name,
      `Application-defined credential/custom header: ${rawName}`,
    ).not.toMatch(
      /^(?:authorization|proxy-authorization|x-|api[-_]?key$|apikey$|auth(?:entication)?[-_]?token$|access[-_]?token$|id[-_]?token$|credential$)/u,
    );
    expect(
      `${name}:${value}`,
      `Credential-bearing header value: ${rawName}`,
    ).not.toMatch(
      /(?:^|\s)(?:bearer|basic)\s+|api[-_]?key|auth[-_]?token|access[-_]?token/iu,
    );
    if (name === 'cookie' && !options.allowBrowserCookie) {
      expect(
        name,
        'Browser cookie is not allowed for this request class',
      ).not.toBe('cookie');
    }
  }
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

async function getJson(
  request: APIRequestContext,
  path: string,
): Promise<Record<string, unknown>> {
  const response = await request.get(path);
  expect(response.status()).toBe(200);
  return JSON.parse(await response.text()) as Record<string, unknown>;
}

async function installCorpusMismatch(
  page: Page,
  request: APIRequestContext,
  mismatch: 'version' | 'index',
): Promise<void> {
  const manifest = await getJson(request, CORPUS_PATHS[0]);
  if (mismatch === 'version') {
    const content = await getJson(request, CORPUS_PATHS[1]);
    content.corpusVersion = 'f'.repeat(64);
    const contentText = JSON.stringify(content);
    manifest.contentSha256 = sha256(contentText);
    await page.route(`**${CORPUS_PATHS[1]}`, (route) =>
      route.fulfill({
        body: contentText,
        contentType: 'application/json',
      }),
    );
  } else {
    const index = await getJson(request, CORPUS_PATHS[2]);
    const chunkCount =
      typeof index.chunkCount === 'number' ? index.chunkCount : 0;
    index.chunkCount = chunkCount + 1;
    const indexText = JSON.stringify(index);
    manifest.indexSha256 = sha256(indexText);
    await page.route(`**${CORPUS_PATHS[2]}`, (route) =>
      route.fulfill({
        body: indexText,
        contentType: 'application/json',
      }),
    );
  }
  await page.route(`**${CORPUS_PATHS[0]}`, (route) =>
    route.fulfill({
      body: JSON.stringify(manifest),
      contentType: 'application/json',
    }),
  );
}

test.describe('Egregore consent and local privacy', () => {
  test('does not construct or fetch assistant resources before explicit load consent', async ({
    page,
  }) => {
    const requests: Request[] = [];
    page.on('request', (request) => requests.push(request));

    await page.goto(EGREGORE_PATH);
    await expect(
      page.getByRole('button', { name: 'Check compatibility' }),
    ).toBeVisible();
    expect(await runtimeMethods(page)).toEqual([]);
    const liteRtChunks = emittedLiteRtChunkPaths();
    expect(liteRtChunks.length).toBeGreaterThan(0);
    expect(
      requests
        .map((request) => request.url())
        .filter(
          (url) =>
            CORPUS_PATHS.some((path) => url.includes(path)) ||
            url.includes(RUNTIME_ROOT) ||
            liteRtChunks.includes(new URL(url).pathname) ||
            /huggingface|\.litertlm|litert[-_.]?lm/i.test(url),
        ),
    ).toEqual([]);

    await page.addInitScript(() => {
      const state = window as typeof window & {
        __EGREGORE_CAPABILITY_CALLS__?: number;
      };
      state.__EGREGORE_CAPABILITY_CALLS__ = 0;
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: {
          requestAdapter: async () => {
            state.__EGREGORE_CAPABILITY_CALLS__ =
              (state.__EGREGORE_CAPABILITY_CALLS__ ?? 0) + 1;
            return {};
          },
        },
      });
    });
    requests.length = 0;
    await page.goto(EGREGORE_PATH);
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await expect(
      page.getByRole('button', { name: /Load Egregore/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { __EGREGORE_CAPABILITY_CALLS__?: number })
            .__EGREGORE_CAPABILITY_CALLS__,
      ),
    ).toBe(1);
    expect(await runtimeMethods(page)).toEqual(['checkCapabilities']);
    expect(
      requests
        .map((request) => request.url())
        .filter(
          (url) =>
            CORPUS_PATHS.some((path) => url.includes(path)) ||
            url.includes(RUNTIME_ROOT) ||
            liteRtChunks.includes(new URL(url).pathname) ||
            /huggingface|\.litertlm/i.test(url),
        ),
    ).toEqual([]);
  });

  test('allows only bodyless credential-free corpus fetches in the fake flow', async ({
    page,
  }) => {
    await installFetchAudit(page);
    const browserRequests: Request[] = [];
    page.on('request', (request) => browserRequests.push(request));
    await page.goto(fakePath('published-corpus'));
    const compatibilityButton = page.getByRole('button', {
      name: 'Check compatibility',
    });
    await expect(compatibilityButton).toBeVisible();
    browserRequests.length = 0;
    await page.evaluate(() => {
      const auditedWindow = window as typeof window & {
        __EGREGORE_FETCHES__?: FetchRecord[];
      };
      auditedWindow.__EGREGORE_FETCHES__ = [];
    });

    await compatibilityButton.click();
    expect(await auditedFetches(page)).toEqual([]);
    await page.getByRole('button', { name: /Load Egregore/ }).click();
    await expect(
      page.getByRole('textbox', { name: 'Ask Egregore' }),
    ).toBeEnabled();
    await expect(
      page.getByRole('button', { name: 'Remove downloaded model' }),
    ).toHaveCount(0);

    await submitQuestionAndWait(page, PROMPT_SENTINEL);

    const fetches = await auditedFetches(page);
    const corpusFetches = fetches.filter(({ url }) =>
      CORPUS_PATHS.includes(
        new URL(url).pathname as (typeof CORPUS_PATHS)[number],
      ),
    );
    expect(corpusFetches).toHaveLength(3);
    for (const record of corpusFetches) {
      expect(record.method).toBe('GET');
      expect(record.credentials).toBe('omit');
      expect(record.body).toBeNull();
      expect(record.headers).toEqual([]);
    }
    for (const record of fetches) {
      expectNoApplicationCredentials(record.headers, {
        allowBrowserCookie: false,
      });
    }

    const serialized = JSON.stringify({
      fetches,
      requests: await Promise.all(
        browserRequests.map(async (request) => ({
          url: request.url(),
          method: request.method(),
          headers: await request.allHeaders(),
          body: request.postData(),
        })),
      ),
    });
    expect(serialized).not.toContain(PROMPT_SENTINEL);
    expect(serialized).not.toContain(SOURCE_SENTINEL);
    expect(serialized).not.toMatch(
      /huggingface|cdn\.jsdelivr\.net|\.litertlm/i,
    );
    expect(fetches.some(({ url }) => url.includes(RUNTIME_ROOT))).toBe(false);
    expect(
      browserRequests.some((request) => request.url().includes(RUNTIME_ROOT)),
    ).toBe(false);

    const origin = new URL(page.url()).origin;
    for (const request of browserRequests) {
      const url = new URL(request.url());
      const isCorpus =
        url.origin === origin &&
        CORPUS_PATHS.includes(url.pathname as (typeof CORPUS_PATHS)[number]);
      const isApplicationAsset =
        url.origin === origin && url.pathname.startsWith('/_astro/');
      const isDeclaredFontAsset =
        (url.hostname === 'fonts.googleapis.com' && url.pathname === '/css2') ||
        (url.hostname === 'fonts.gstatic.com' &&
          url.pathname.startsWith('/l/font'));
      const runtimeAsset =
        url.origin === origin && url.pathname.startsWith(RUNTIME_ROOT)
          ? url.pathname.slice(RUNTIME_ROOT.length)
          : null;
      const isRuntimeAsset =
        runtimeAsset !== null &&
        !runtimeAsset.includes('/') &&
        LITERT_ASSETS.has(runtimeAsset);
      const isPartytownAnalytics =
        url.origin === origin && url.pathname === '/~partytown/proxytown';
      const isAnalytics =
        ([
          'www.google-analytics.com',
          'analytics.google.com',
          'region1.google-analytics.com',
          'www.googletagmanager.com',
        ].includes(url.hostname) &&
          /\/(?:g\/)?collect$|\/gtag\/js$/u.test(url.pathname)) ||
        isPartytownAnalytics;
      expect(
        isCorpus ||
          isApplicationAsset ||
          isDeclaredFontAsset ||
          isRuntimeAsset ||
          isAnalytics,
        `Nonallowlisted request: ${url.origin}${url.pathname}`,
      ).toBe(true);
      if (!isAnalytics) {
        expect(request.method()).toBe('GET');
        expect(request.postData()).toBeNull();
      }
      if (isPartytownAnalytics) {
        expect(request.method()).toBe('POST');
        const analyticsPayload = JSON.stringify({
          url: request.url(),
          headers: await request.allHeaders(),
          body: request.postData(),
        });
        expect(analyticsPayload).not.toContain(PROMPT_SENTINEL);
        expect(analyticsPayload).not.toContain(SOURCE_SENTINEL);
      }
      if (isCorpus || isApplicationAsset || isRuntimeAsset)
        expect(url.search).toBe('');
      const headers = await request.allHeaders();
      expectNoApplicationCredentials(headers, {
        allowBrowserCookie: isApplicationAsset || isAnalytics,
      });
    }
  });

  test('keeps lifecycle scenarios independent from the published corpus', async ({
    page,
  }) => {
    await installFetchAudit(page);
    await startFakeAssistant(page);
    await submitQuestionAndWait(
      page,
      'What does Jet write about agentic work?',
    );

    expect(
      (await auditedFetches(page)).filter(({ url }) =>
        CORPUS_PATHS.includes(
          new URL(url).pathname as (typeof CORPUS_PATHS)[number],
        ),
      ),
    ).toEqual([]);
  });
});

test.describe('Egregore compact navigation clearance', () => {
  test('keeps activation actions visible and clear of the open dock at phone height', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 680 });
    await page.goto(fakePath());

    const dock = page.locator('#site-navigation-dock');
    const disclosure = page.getByRole('button', { name: 'Close navigation' });
    const check = page.getByRole('button', { name: 'Check compatibility' });
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await expect(check).toBeVisible();

    const actionClearsNavigation = async (action: Locator) => {
      const [actionBox, dockBox, disclosureBox] = await Promise.all([
        boxOf(action),
        boxOf(dock),
        boxOf(disclosure),
      ]);
      expect(actionBox.y).toBeGreaterThanOrEqual(0);
      expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(680);
      expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(
        Math.min(dockBox.y, disclosureBox.y) - 8,
      );
    };

    await actionClearsNavigation(check);
    await check.click();

    const load = page.getByRole('button', { name: /Load Egregore/ });
    await expect(load).toBeVisible();
    await actionClearsNavigation(load);
    await expect(
      page.getByRole('button', {
        name: 'What does Jet write about agentic work?',
      }),
    ).toHaveCount(0);
  });

  test('keeps the reliability disclosure readable and clear of visible compact navigation before submit', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 680 });
    const composer = await startFakeAssistant(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '20px';
    });

    const reliability = page.getByTestId('composer-reliability-disclosure');
    const dock = page.locator('#site-navigation-dock');
    const disclosure = page.getByRole('button', { name: 'Close navigation' });
    await expect(reliability).toHaveText(
      'Egregore can make mistakes. Check cited sources.',
    );
    await expect(reliability).toBeVisible();

    const [reliabilityBox, composerBox, dockBox, disclosureBox] =
      await Promise.all([
        boxOf(reliability),
        boxOf(composer),
        boxOf(dock),
        boxOf(disclosure),
      ]);
    const metrics = await reliability.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        clientWidth: element.clientWidth,
        fontSize: Number.parseFloat(style.fontSize),
        lineHeight: Number.parseFloat(style.lineHeight),
        scrollHeight: element.scrollHeight,
        scrollWidth: element.scrollWidth,
        whiteSpace: style.whiteSpace,
      };
    });
    const composerFontSize = await composer.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );

    expect(metrics.whiteSpace).toBe('normal');
    expect(metrics.fontSize).toBeLessThan(composerFontSize);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.lineHeight);
    expect(reliabilityBox.x).toBeGreaterThanOrEqual(0);
    expect(reliabilityBox.x + reliabilityBox.width).toBeLessThanOrEqual(375);
    expect(composerBox.y + composerBox.height).toBeLessThanOrEqual(
      Math.min(dockBox.y, disclosureBox.y) - 8,
    );

    await composer.fill('What does Jet write about agentic work?');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(reliability).toHaveCount(0);
  });

  test('retains an explicit mobile dock choice through route, history, and breakpoint changes', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium');
    await page.setViewportSize({ width: 375, height: 680 });
    await page.goto(fakePath());

    await page.getByRole('button', { name: 'Close navigation' }).click();
    const disclosure = page.getByRole('button', { name: 'Open navigation' });
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');

    await page
      .getByRole('link', {
        name: 'Open Egregore model and open-source licenses',
      })
      .click();
    await expect(page).toHaveURL(/\/licenses\/egregore\/$/);
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');

    await page.reload();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await page.goBack();
    await expect(page).toHaveURL(/\/chatbot\//);
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await page.goForward();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');

    await page.setViewportSize({ width: 768, height: 680 });
    await expect(page.getByRole('button', { name: /navigation/i })).toHaveCount(
      0,
    );
    await expect(page.locator('#site-navigation-dock')).not.toHaveAttribute(
      'inert',
      '',
    );

    await page.setViewportSize({ width: 767, height: 680 });
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');

    await disclosure.click();
    await expect(
      page.getByRole('button', { name: 'Close navigation' }),
    ).toHaveAttribute('aria-expanded', 'true');
    await page
      .locator('#site-navigation-dock')
      .getByRole('link', { name: 'Home' })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('button', { name: 'Close navigation' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  test('moves clearance from the bottom dock to the header across tablet landscape and desktop', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium');
    const viewportHeight = 768;

    await page.setViewportSize({ width: 1023, height: viewportHeight });
    await page.goto(fakePath());
    const tabletDock = page.locator('#site-navigation-dock');
    const tabletCheck = page.getByRole('button', {
      name: 'Check compatibility',
    });
    await expect(tabletCheck).toBeVisible();
    const [tabletDockBox, tabletCheckBox] = await Promise.all([
      boxOf(tabletDock),
      boxOf(tabletCheck),
    ]);
    expect(tabletDockBox.y).toBeGreaterThan(viewportHeight / 2);
    expect(tabletCheckBox.y + tabletCheckBox.height).toBeLessThanOrEqual(
      tabletDockBox.y - 8,
    );

    const tabletComposer = await startFakeAssistant(page);
    await submitQuestionAndWait(
      page,
      'What does Jet write about agentic work?',
    );
    const [tabletComposerBox, tabletScrollerBox] = await Promise.all([
      boxOf(tabletComposer),
      boxOf(page.getByTestId('conversation-scroller')),
    ]);
    expect(tabletComposerBox.y + tabletComposerBox.height).toBeLessThanOrEqual(
      tabletDockBox.y - 8,
    );
    expect(tabletScrollerBox.y + tabletScrollerBox.height).toBeLessThanOrEqual(
      tabletComposerBox.y + 1,
    );

    await page.setViewportSize({ width: 1280, height: viewportHeight });
    await page.goto(fakePath());
    const desktopDock = page.locator('#site-navigation-dock');
    const desktopHeaderContent = page.getByTestId('egregore-identity');
    const desktopComposer = await startFakeAssistant(page);
    await submitQuestionAndWait(
      page,
      'What does Jet write about agentic work?',
    );
    const [
      desktopDockBox,
      desktopHeaderBox,
      desktopComposerBox,
      desktopScrollerBox,
    ] = await Promise.all([
      boxOf(desktopDock),
      boxOf(desktopHeaderContent),
      boxOf(desktopComposer),
      boxOf(page.getByTestId('conversation-scroller')),
    ]);
    expect(desktopDockBox.y + desktopDockBox.height).toBeLessThanOrEqual(
      desktopHeaderBox.y - 8,
    );
    expect(
      desktopComposerBox.y + desktopComposerBox.height,
    ).toBeLessThanOrEqual(viewportHeight);
    expect(desktopComposerBox.y + desktopComposerBox.height).toBeGreaterThan(
      tabletComposerBox.y + tabletComposerBox.height,
    );
    expect(
      desktopScrollerBox.y + desktopScrollerBox.height,
    ).toBeLessThanOrEqual(desktopComposerBox.y + 1);
  });
});

test.describe('Egregore supported lifecycle', () => {
  test('crossfades idle to scanning inside one fixed large-Ghost viewport', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium');
    await installLargeGhostLayerAudit(page);
    await page.goto(fakePath('checking'));
    await expect.poll(() => runtimeAuditReady(page)).toBe(true);

    const viewport = largeGhostViewport(page);
    const layers = largeGhostLayers(page);
    await expect(viewport).toHaveAttribute('data-mode', 'idle');
    await expect(layers).toHaveCount(1);
    const before = await boxOf(viewport);

    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await expect(viewport).toHaveAttribute('data-mode', 'scanning');
    const during = await boxOf(viewport);
    expectStableBox(before, during);
    await expect(
      page.locator(
        '[data-testid="animated-ghost-mode-layer"][data-mode="idle"]',
      ),
    ).toHaveCount(0);
    await expect(layers).toHaveCount(1);
    await expect(layers).toHaveAttribute('data-mode', 'scanning');
    expectStableBox(before, await boxOf(viewport));
    expect(await largeGhostLayerAudit(page)).toContainEqual({
      currentMode: 'scanning',
      modes: ['idle', 'scanning'],
      positions: ['absolute', 'absolute'],
      viewportCount: 1,
    });
  });

  test('crossfades button-driven ready and loading states across stable remounted screen branches', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium');
    await installLargeGhostLayerAudit(page);
    await page.goto(fakePath('crossfade'));
    await expect.poll(() => runtimeAuditReady(page)).toBe(true);
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    const load = page.getByRole('button', { name: /Load Egregore/ });
    await expect(load).toBeVisible();

    const viewport = largeGhostViewport(page);
    const layers = largeGhostLayers(page);
    await expect(viewport).toHaveAttribute('data-mode', 'ready');
    await expect(layers).toHaveCount(1);
    await expect(layers).toHaveAttribute('data-mode', 'ready');
    const readyBeforeLoad = await boxOf(viewport);

    await load.click();
    await expect(viewport).toHaveAttribute('data-mode', 'loading');
    const loading = await boxOf(viewport);
    expect(loading.width).toBe(readyBeforeLoad.width);
    expect(loading.height).toBe(readyBeforeLoad.height);
    await expect(
      page
        .getByTestId('loading-stack')
        .getByText('Loading on this device', { exact: true }),
    ).toBeVisible();
    await expect(currentStatusLabel(page)).toHaveText('Ready');
    await expect(viewport).toHaveAttribute('data-mode', 'ready');
    await expect(layers).toHaveCount(1);
    await expect(layers).toHaveAttribute('data-mode', 'ready');
    const readyAfterLoad = await boxOf(viewport);
    expect(readyAfterLoad.width).toBe(readyBeforeLoad.width);
    expect(readyAfterLoad.height).toBe(readyBeforeLoad.height);

    const audit = await largeGhostLayerAudit(page);
    expect(audit).toContainEqual(
      expect.objectContaining({
        currentMode: 'loading',
        modes: expect.arrayContaining(['ready', 'loading']),
        viewportCount: 1,
      }),
    );
    expect(audit).toContainEqual(
      expect.objectContaining({
        currentMode: 'ready',
        modes: expect.arrayContaining(['loading', 'ready']),
        viewportCount: 1,
      }),
    );
  });

  test('switches large-Ghost modes immediately with one layer for reduced motion', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installLargeGhostLayerAudit(page);
    await page.goto(fakePath('checking'));
    await expect.poll(() => runtimeAuditReady(page)).toBe(true);
    await page.getByRole('button', { name: 'Check compatibility' }).click();

    const layers = largeGhostLayers(page);
    await expect(largeGhostViewport(page)).toHaveAttribute(
      'data-mode',
      'scanning',
    );
    await expect(layers).toHaveCount(1);
    await expect(layers).toHaveAttribute('data-mode', 'scanning');
    expect(
      await layers.evaluate((element) => ({
        animationCount: element.getAnimations().length,
        opacity: getComputedStyle(element).opacity,
        transitionDuration: getComputedStyle(element).transitionDuration,
      })),
    ).toEqual({
      animationCount: 0,
      opacity: '1',
      transitionDuration: '0s',
    });
    expect(
      Math.max(
        ...(await largeGhostLayerAudit(page)).map(
          (entry) => entry.modes.length,
        ),
      ),
    ).toBeLessThanOrEqual(1);
  });

  test('supports compatibility, load, starter input, cited response, reset, and unload', async ({
    page,
  }) => {
    const composer = await startFakeAssistant(page, 'long-stream');
    await expect(composer).not.toBeFocused();
    const reliability = page.getByTestId('composer-reliability-disclosure');
    await expect(reliability).toHaveText(
      'Egregore can make mistakes. Check cited sources.',
    );

    const question = 'Summarize the recursive convergence hypothesis.';
    const compactViewport = await page.evaluate(() => window.innerWidth < 768);
    if (compactViewport) {
      await composer.fill(question);
    } else {
      await page.getByRole('button', { name: question }).click();
    }
    await expect(reliability).toBeVisible();
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue(question);

    const completedGenerationCount = await generatedResponseCount(page);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(composer).not.toBeFocused();
    await expect(reliability).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Stop response' }),
    ).toBeVisible();
    await waitForCompletedResponse(page, completedGenerationCount);

    const inlineCitation = page
      .getByRole('link', { name: /\[S\d+\]/u })
      .first();
    await expect(inlineCitation).toHaveAttribute(
      'href',
      /\/works\/recursive-convergence-hypothesis\/$/,
    );
    const disclosure = page.getByRole('button', { name: '1 source' });
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await disclosure.focus();
    await disclosure.press('Enter');
    await expect(
      page.getByRole('region', { name: 'Sources for this response' }),
    ).toBeVisible();

    const newSession = page.getByRole('button', {
      name: /New session|Start a new session/,
    });
    await newSession.focus();
    await newSession.press('Enter');
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue('');
    await expect(reliability).toBeVisible();

    await page.getByRole('button', { name: /Unload/ }).click();
    await expect(
      page.getByRole('button', { name: 'Check compatibility' }),
    ).toBeFocused();
  });

  test('keeps checking status text readable in light and dark themes', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium');

    for (const theme of ['light', 'dark'] as const) {
      await page.goto(EGREGORE_PATH);
      await page.evaluate(
        (selectedTheme) => localStorage.setItem('theme', selectedTheme),
        theme,
      );
      await page.goto(fakePath('checking'));
      await page.getByRole('button', { name: 'Check compatibility' }).click();

      const checking = page.getByRole('button', {
        name: 'Checking WebGPU and memory',
      });
      await expect(checking).toBeVisible();
      expect(
        await renderedContrastRatio(checking),
        `${theme} checking contrast`,
      ).toBeGreaterThanOrEqual(4.5);
      await expect(checking).toHaveAttribute('data-action-variant', 'neutral');
    }
  });

  test('keeps status left-aligned with identity while stable actions stay anchored', async ({
    page,
  }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile-chromium';
    await page.setViewportSize(
      mobile ? { width: 430, height: 932 } : { width: 1280, height: 800 },
    );
    const composer = await startFakeAssistant(page, 'long-stream');
    await page.clock.install();
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
    const header = page.locator('.egregore-header');
    const brand = header.locator(':scope > div').first();
    const identity = page.getByTestId('egregore-identity');
    const identityMetadata = identity.locator('p').nth(1);
    const actionGroup = page.getByTestId('egregore-header-actions');
    const newSession = page.getByRole('button', {
      name: /New session|Start a new session/,
    });
    const unload = page.getByRole('button', { name: /Unload/ });
    const status = page.getByTestId('lifecycle-visible-status');
    await expect(page.getByTestId('lifecycle-visual-label')).toHaveCount(1);
    const before = {
      brand: await boxOf(brand),
      metadata: await boxOf(identityMetadata),
      newSession: await boxOf(newSession),
      unload: await boxOf(unload),
      status: await boxOf(status),
    };
    if (mobile) {
      for (const action of [before.newSession, before.unload]) {
        expect(action.width).toBeGreaterThanOrEqual(44);
        expect(action.height).toBeGreaterThanOrEqual(44);
      }
    }

    const statusChrome = await status.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderWidth: style.borderWidth,
        boxShadow: style.boxShadow,
        borderRadius: style.borderRadius,
        padding: [
          style.paddingTop,
          style.paddingRight,
          style.paddingBottom,
          style.paddingLeft,
        ],
        minWidth: style.minWidth,
      };
    });
    expect(statusChrome.backgroundColor).toMatch(
      /transparent|rgba\(0, 0, 0, 0\)/,
    );
    expect(statusChrome.borderWidth).toBe('0px');
    expect(statusChrome.boxShadow).toBe('none');
    expect(statusChrome.borderRadius).toBe('0px');
    expect(statusChrome.padding).toEqual(['0px', '0px', '0px', '0px']);
    expect(['0px', 'auto']).toContain(statusChrome.minWidth);
    expect(before.status.x).toBeCloseTo(before.metadata.x, 0);
    await expect(identity.getByTestId('lifecycle-visible-status')).toHaveCount(
      1,
    );
    await expect(
      actionGroup.getByTestId('lifecycle-visible-status'),
    ).toHaveCount(0);

    await composer.fill('Summarize the recursive convergence hypothesis.');
    const completedGenerationCount = await generatedResponseCount(page);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(currentStatusLabel(page)).toHaveText('Responding');
    const respondingImmediate = {
      brand: await boxOf(brand),
      newSession: await boxOf(newSession),
      unload: await boxOf(unload),
      status: await boxOf(status),
      label: await boxOf(currentStatusLabel(page)),
    };
    await page.waitForTimeout(220);
    await expect(page.getByTestId('lifecycle-visual-label')).toHaveCount(1);
    const respondingSettled = {
      brand: await boxOf(brand),
      newSession: await boxOf(newSession),
      unload: await boxOf(unload),
      status: await boxOf(status),
      label: await boxOf(currentStatusLabel(page)),
    };
    expectStableBox(before.brand, respondingImmediate.brand);
    expectStableBox(before.newSession, respondingImmediate.newSession);
    expectStableBox(before.unload, respondingImmediate.unload);
    expectStableBox(respondingImmediate.brand, respondingSettled.brand);
    expectStableBox(
      respondingImmediate.newSession,
      respondingSettled.newSession,
    );
    expectStableBox(respondingImmediate.unload, respondingSettled.unload);
    expectStableBox(respondingImmediate.status, respondingSettled.status);
    expectStableBox(respondingImmediate.label, respondingSettled.label);
    expect(respondingImmediate.status.width).toBeGreaterThan(
      before.status.width,
    );
    expect(respondingImmediate.status.x).toBeCloseTo(before.status.x, 0);
    expect(
      respondingImmediate.status.x + respondingImmediate.status.width,
    ).toBeGreaterThan(before.status.x + before.status.width);
    await expect(newSession).toBeDisabled();
    await expect(unload).toBeEnabled();

    const statusLabels = page.getByTestId('lifecycle-visual-label');
    expect(await statusLabels.count()).toBeLessThanOrEqual(2);
    await page.clock.runFor(1_000);
    await waitForCompletedResponse(page, completedGenerationCount);
    await expect(newSession).toBeEnabled();
    await expect(unload).toBeEnabled();

    const announcement = page.getByTestId('lifecycle-announcement');
    await expect(announcement).toHaveAttribute('role', 'status');
    await expect(announcement).toHaveAttribute('aria-live', 'polite');
    await expect(status).not.toHaveAttribute('aria-live');
    await expect(
      page.locator('[aria-label="Conversation"] article').last(),
    ).not.toHaveAttribute('aria-live');
    expect([
      'Not running',
      'Checking',
      'Load ready',
      'Loading',
      'Ready',
      'Responding',
    ]).toContain(await currentStatusLabel(page).textContent());

    const metadata = page.getByTestId('composer-metadata');
    const hint = page.getByTestId('composer-keyboard-hint');
    await expect(page.getByTestId('composer-local-only')).toBeVisible();
    if (mobile) {
      expect(
        await hint.evaluate((element) => getComputedStyle(element).display),
      ).toBe('none');
      expect(
        await metadata.evaluate(
          (element) => getComputedStyle(element).justifyContent,
        ),
      ).toBe('flex-end');
    } else {
      await expect(hint).toBeVisible();
      expect(
        await metadata.evaluate(
          (element) => getComputedStyle(element).justifyContent,
        ),
      ).toBe('space-between');
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBe(0);
  });

  test('honors pointer, touch-origin Enter, and hardware keyboard focus policy', async ({
    page,
  }, testInfo) => {
    const composer = await startFakeAssistant(page, 'long-stream');
    await composer.fill('What does Jet write about agentic work?');
    const completedGenerationCount = await generatedResponseCount(page);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(composer).not.toBeFocused();
    await waitForCompletedResponse(page, completedGenerationCount);
    await expect(composer).not.toBeFocused();

    await page
      .getByRole('button', { name: /New session|Start a new session/ })
      .click();
    await expect(composer).not.toBeFocused();

    if (testInfo.project.name === 'mobile-chromium') {
      const composerBox = await boxOf(composer);
      await page.touchscreen.tap(
        composerBox.x + composerBox.width / 2,
        composerBox.y + composerBox.height / 2,
      );
      await composer.fill('Summarize the recursive convergence hypothesis.');
      const touchGenerationCount = await generatedResponseCount(page);
      await composer.press('Enter');
      await expect(composer).not.toBeFocused();
      await waitForCompletedResponse(page, touchGenerationCount);
      await expect(composer).not.toBeFocused();
    } else {
      await composer.focus();
      await composer.fill('Summarize the recursive convergence hypothesis.');
      const keyboardGenerationCount = await generatedResponseCount(page);
      await composer.press('Enter');
      await expect(composer).toBeFocused();
      await waitForCompletedResponse(page, keyboardGenerationCount);
      await expect(composer).toBeFocused();
      const newSession = page.getByRole('button', { name: 'New session' });
      await newSession.focus();
      await newSession.press('Enter');
      await expect(composer).toBeFocused();
      await expect(composer).toHaveValue('');
    }
  });

  test('drives the exact six compact labels without percentages or hidden sizing content', async ({
    page,
  }) => {
    await installLifecycleLabelAudit(page);
    const composer = await startFakeAssistant(page, 'long-stream');
    const completedGenerationCount = await submitQuestion(
      page,
      'What does Jet write about agentic work?',
    );
    await expect(currentStatusLabel(page)).toHaveText('Responding');
    await waitForCompletedResponse(page, completedGenerationCount);

    const labels = await page.evaluate(
      () =>
        (window as typeof window & { __EGREGORE_LABELS__?: string[] })
          .__EGREGORE_LABELS__ ?? [],
    );
    expect(labels).toEqual([
      'Not running',
      'Checking',
      'Load ready',
      'Loading',
      'Ready',
      'Responding',
    ]);
    expect(labels.every((label) => !label.includes('%'))).toBe(true);

    const status = page.getByTestId('lifecycle-visible-status');
    const hiddenSizingContent = await status
      .locator('*')
      .evaluateAll((elements) =>
        elements
          .filter((element) => {
            const style = getComputedStyle(element);
            return style.display === 'none' || style.visibility === 'hidden';
          })
          .map((element) => element.textContent?.trim()),
      );
    expect(hiddenSizingContent).toEqual([]);

    const actionGroup = page.getByTestId('egregore-header-actions');
    expect(
      await actionGroup
        .locator(':scope > *')
        .evaluateAll((elements) => elements.map((element) => element.tagName)),
    ).toEqual(['BUTTON', 'BUTTON']);
    await expect(composer).toBeEnabled();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(fakePath('long-stream'));
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await page.getByRole('button', { name: /Load Egregore/ }).click();
    await expect(page.getByTestId('lifecycle-visual-label')).toHaveCount(1);
    await submitQuestion(page, 'What does Jet write about agentic work?');
    await expect(currentStatusLabel(page)).toHaveText('Responding');
    await expect(page.getByTestId('lifecycle-visual-label')).toHaveCount(1);
  });

  test('keeps identity status and actions uncrowded across the supported header widths', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium');
    const viewports = [
      { width: 320, height: 800 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const composer = await startFakeAssistant(page, 'long-stream');

      const header = page.locator('.egregore-header');
      const identityGroup = header.locator(':scope > div').first();
      const identity = page.getByTestId('egregore-identity');
      const metadata = identity.locator('p').nth(1);
      const version = metadata.locator('span').first();
      const licenses = metadata.getByRole('link', { name: /licenses/i });
      const status = page.getByTestId('lifecycle-visible-status');
      const actionGroup = page.getByTestId('egregore-header-actions');
      const newSession = page.getByRole('button', {
        name: /New session|Start a new session/,
      });
      const unload = page.getByRole('button', { name: /Unload/ });
      const [
        headerBox,
        identityGroupBox,
        metadataBox,
        statusBox,
        actionBox,
        readyNewSessionBox,
        readyUnloadBox,
      ] = await Promise.all([
        boxOf(header),
        boxOf(identityGroup),
        boxOf(metadata),
        boxOf(status),
        boxOf(actionGroup),
        boxOf(newSession),
        boxOf(unload),
      ]);

      await expect(version).toHaveText(/^jet-web \d+\.\d+\.\d+$/);
      await expect(licenses).toBeVisible();
      await expect(licenses).toHaveAttribute('href', '/licenses/egregore/');
      await expectLifecycleLabelContained(page, 'Ready');
      expect(statusBox.x).toBeCloseTo(metadataBox.x, 0);
      expect(statusBox.y).toBeGreaterThanOrEqual(
        metadataBox.y + metadataBox.height,
      );
      expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(
        headerBox.y + headerBox.height + 1,
      );
      expect(identityGroupBox.x + identityGroupBox.width).toBeLessThanOrEqual(
        actionBox.x + 1,
      );
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      ).toBe(0);

      await composer.fill('What does Jet write about agentic work?');
      await page.getByRole('button', { name: 'Send message' }).click();
      await expectLifecycleLabelContained(page, 'Responding');
      const [
        respondingHeaderBox,
        respondingIdentityBox,
        respondingActionBox,
        respondingNewSessionBox,
        respondingUnloadBox,
      ] = await Promise.all([
        boxOf(header),
        boxOf(identityGroup),
        boxOf(actionGroup),
        boxOf(newSession),
        boxOf(unload),
      ]);
      expectStableBox(readyNewSessionBox, respondingNewSessionBox);
      expectStableBox(readyUnloadBox, respondingUnloadBox);
      expect(
        respondingIdentityBox.x + respondingIdentityBox.width,
      ).toBeLessThanOrEqual(respondingActionBox.x + 1);
      expect(
        respondingActionBox.x + respondingActionBox.width,
      ).toBeLessThanOrEqual(
        respondingHeaderBox.x + respondingHeaderBox.width + 1,
      );
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      ).toBe(0);
    }
  });

  test('keeps cached-model controls and complete identity metadata visible at the narrow phone width', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium');
    await page.setViewportSize({ width: 375, height: 720 });
    await startFakeAssistant(page, 'cached');

    const header = page.locator('.egregore-header');
    const identity = page.getByTestId('egregore-identity');
    const metadata = identity.locator('p').nth(1);
    const actionGroup = page.getByTestId('egregore-header-actions');
    const version = metadata.locator('span').first();
    const licenses = metadata.getByRole('link', { name: /licenses/i });

    await expect(version).toHaveText(/^jet-web \d+\.\d+\.\d+$/);
    await expect(licenses).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Remove downloaded model' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Start a new session' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Unload Egregore' }),
    ).toBeVisible();

    const [headerBox, metadataBox, versionBox, licensesBox, actionBox] =
      await Promise.all([
        boxOf(header),
        boxOf(metadata),
        boxOf(version),
        boxOf(licenses),
        boxOf(actionGroup),
      ]);
    const naturalVersionWidth = await version.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().width;
    });
    expect(versionBox.x).toBeGreaterThanOrEqual(metadataBox.x - 1);
    expect(versionBox.width).toBeGreaterThanOrEqual(naturalVersionWidth - 1);
    expect(licensesBox.x + licensesBox.width).toBeLessThanOrEqual(
      metadataBox.x + metadataBox.width + 1,
    );
    expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(
      headerBox.x + headerBox.width + 1,
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBe(0);
  });

  test('keeps the immersive document within the small viewport while browser chrome is visible', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium');
    await page.setViewportSize({ width: 375, height: 720 });
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setSmallViewportHeightDifferenceOverride', {
      difference: 56,
    });
    await page.goto(fakePath());

    const dimensions = await page.evaluate(() => {
      const measure = (height: string) => {
        const element = document.createElement('div');
        element.style.cssText = `position:fixed;height:${height};pointer-events:none`;
        document.body.append(element);
        const pixels = Math.round(element.getBoundingClientRect().height);
        element.remove();
        return pixels;
      };

      return {
        documentHeight: document.documentElement.scrollHeight,
        bodyHeight: document.body.scrollHeight,
        shellHeight: Math.round(
          document.querySelector('.egregore-shell')!.getBoundingClientRect()
            .height,
        ),
        smallViewportHeight: measure('100svh'),
        largeViewportHeight: measure('100lvh'),
      };
    });

    expect(
      dimensions.largeViewportHeight - dimensions.smallViewportHeight,
    ).toBe(56);
    expect(dimensions.shellHeight).toBe(dimensions.smallViewportHeight);
    expect(dimensions.documentHeight).toBe(dimensions.shellHeight);
    expect(dimensions.bodyHeight).toBe(dimensions.shellHeight);
  });

  test('contains every compact lifecycle label inside the status and header', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium');
    for (const viewport of [
      { width: 320, height: 800 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);

      await page.goto(fakePath());
      await expectLifecycleLabelContained(page, 'Not running');

      await page.goto(fakePath('checking'));
      await page.getByRole('button', { name: 'Check compatibility' }).click();
      await expectLifecycleLabelContained(page, 'Checking');

      await page.goto(fakePath());
      await page.getByRole('button', { name: 'Check compatibility' }).click();
      await expectLifecycleLabelContained(page, 'Load ready');

      await page.goto(fakePath('loading'));
      await page.getByRole('button', { name: 'Check compatibility' }).click();
      await page.getByRole('button', { name: /Load Egregore/ }).click();
      await expectLifecycleLabelContained(page, 'Loading');

      const composer = await startFakeAssistant(page, 'long-stream');
      await expectLifecycleLabelContained(page, 'Ready');
      await composer.fill('What does Jet write about agentic work?');
      await page.getByRole('button', { name: 'Send message' }).click();
      await expectLifecycleLabelContained(page, 'Responding');
    }
  });

  test('keeps the Ghost mark proportional to the three-line identity stack', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium');
    const viewports = [
      { width: 320, height: 800 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto(fakePath());

      const identityGroup = page.locator('.egregore-header > div').first();
      const icon = identityGroup.locator(':scope > span').first();
      const glyph = icon.locator('svg');
      const identity = page.getByTestId('egregore-identity');
      const [iconBox, glyphBox, identityBox] = await Promise.all([
        boxOf(icon),
        boxOf(glyph),
        boxOf(identity),
      ]);

      expect(iconBox.width).toBeCloseTo(iconBox.height, 1);
      expect(iconBox.width).toBeCloseTo(48, 1);
      expect(glyphBox.width).toBeCloseTo(glyphBox.height, 1);
      expect(glyphBox.width).toBeCloseTo(24, 1);
      expect(glyphBox.width / iconBox.width).toBeCloseTo(0.5, 2);
      expect(Math.abs(iconBox.y - identityBox.y)).toBeLessThanOrEqual(1);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      ).toBe(0);
    }
  });
});

test.describe('Egregore loading hierarchy and activation recovery', () => {
  test('keeps the tablet-portrait dock clear of the Ghost header', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await startFakeAssistant(page);

    const dockBox = await boxOf(page.locator('#site-navigation-dock'));
    const headerBox = await boxOf(page.locator('.egregore-header'));
    const boxesOverlap = !(
      dockBox.x + dockBox.width <= headerBox.x ||
      dockBox.x >= headerBox.x + headerBox.width ||
      dockBox.y + dockBox.height <= headerBox.y ||
      dockBox.y >= headerBox.y + headerBox.height
    );

    expect(boxesOverlap).toBe(false);
  });

  test('keeps the complete dock inside a safe 320px viewport inset', async ({
    page,
  }) => {
    const viewportWidth = 320;
    const safeInset = 8;
    await page.setViewportSize({ width: viewportWidth, height: 800 });
    await page.goto(fakePath());

    const dockBox = await boxOf(page.locator('#site-navigation-dock'));
    expect(dockBox.x).toBeGreaterThanOrEqual(safeInset);
    expect(dockBox.x + dockBox.width).toBeLessThanOrEqual(
      viewportWidth - safeInset,
    );
  });

  test('holds the exact long-loading hierarchy stable across time, motion, themes, and widths', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'One Chromium matrix covers the explicit viewport set.',
    );
    await page.clock.install();
    await page.goto(fakePath('loading'));
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await page.getByRole('button', { name: /Load Egregore/ }).click();

    const stack = page.getByTestId('loading-stack');
    const elapsed = page.getByTestId('loading-elapsed');
    const reassurance = page.getByTestId('loading-reassurance-slot');
    const headline = stack.getByRole('heading');
    await expect(stack).toBeVisible();
    await expect(headline).toHaveText("Haunting Jet's archive");
    await expect(reassurance).toBeEmpty();
    await expect(
      page.getByRole('button', { name: 'Cancel and reload' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Unload/ })).toHaveCount(0);
    expect(await runtimeMethods(page)).toEqual([
      'checkCapabilities',
      'repository.load',
      'runtime.load',
    ]);

    await page.clock.runFor(12_000);
    await expect(headline).toHaveText('Waking the ghost');
    await page.clock.runFor(12_000);
    await expect(headline).toHaveText('Feeding it ones and zeroes');
    const boxesAt24 = new Map<string, Box>();
    const elapsedAt24 = Number(
      (await elapsed.textContent())?.match(/\d+/)?.[0],
    );

    const viewports = [
      ['mobile-320', 320, 800],
      ['mobile-430', 430, 932],
      ['tablet-portrait', 768, 1024],
      ['tablet-landscape', 1024, 768],
      ['desktop', 1440, 900],
    ] as const;
    for (const [name, width, height] of viewports) {
      await page.setViewportSize({ width, height });
      boxesAt24.set(name, await boxOf(stack));
    }

    await page.clock.runFor(12_000);
    await expect(headline).toHaveText("Haunting Jet's archive");
    await expect(reassurance).toHaveText('First load may take a few minutes.');
    const elapsedAt36 = Number(
      (await elapsed.textContent())?.match(/\d+/)?.[0],
    );
    expect(elapsedAt36).toBeGreaterThan(elapsedAt24);

    for (const [name, width, height] of viewports) {
      await page.setViewportSize({ width, height });
      expectStableBox(boxesAt24.get(name)!, await boxOf(stack));
      if (width >= 320) {
        const lineGeometry = await reassurance.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            height: element.getBoundingClientRect().height,
            lineHeight: Number.parseFloat(style.lineHeight),
          };
        });
        expect(lineGeometry.height).toBeLessThanOrEqual(
          lineGeometry.lineHeight + 1,
        );
      }
      for (const theme of ['light', 'dark'] as const) {
        await page.locator('html').evaluate((element, nextTheme) => {
          element.classList.toggle('dark', nextTheme === 'dark');
        }, theme);
        await page.screenshot({
          path: testInfo.outputPath(`loading-${name}-${theme}.png`),
          animations: 'disabled',
        });
      }
    }

    await expect(page.getByTestId('loading-ghost-afterimage')).toHaveCount(2);
    await expect(page.getByTestId('loading-inward-particle')).toHaveCount(4);
    await expect(page.locator('[role="progressbar"], progress')).toHaveCount(0);
    expect(
      await stack.getByText("Haunting Jet's archive").getAttribute('aria-live'),
    ).toBeNull();
    await expect(page.getByTestId('loading-phase-visual')).not.toHaveAttribute(
      'aria-live',
    );

    const animated = page.getByTestId('loading-ghost-afterimage').first();
    const beforeMotion = await animated.evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.transform}|${style.opacity}`;
    });
    await page.clock.runFor(500);
    const afterMotion = await animated.evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.transform}|${style.opacity}`;
    });
    expect(afterMotion).not.toBe(beforeMotion);

    const mainTranslation = await page
      .getByTestId('loading-main-ghost')
      .evaluate((element) => {
        const transform = getComputedStyle(element).transform;
        if (transform === 'none') return null;
        const matrix = new DOMMatrix(transform);
        return { x: matrix.e, y: matrix.f };
      });
    if (mainTranslation) {
      expect(mainTranslation.x).toBeCloseTo(0, 5);
      expect(mainTranslation.y).toBeCloseTo(0, 5);
    }

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(largeGhostLayers(page)).toHaveCount(1);
    await expect(
      page.locator(
        '[data-testid="animated-ghost-mode-layer"][data-mode="loading"]',
      ),
    ).toHaveCount(1);
    await expect(animated).toHaveCSS('opacity', '0.14');
    await expect(animated).toHaveCSS(
      'transform',
      'matrix(1.14, 0, 0, 1.14, 0, 0)',
    );
    await page.clock.runFor(500);
    await expect(animated).toHaveCSS('opacity', '0.14');
    await expect(animated).toHaveCSS(
      'transform',
      'matrix(1.14, 0, 0, 1.14, 0, 0)',
    );

    await page.clock.runFor(5_000);
    const elapsedAfterForty = Number(
      (await elapsed.textContent())?.match(/\d+/)?.[0],
    );
    expect(elapsedAfterForty).toBeGreaterThanOrEqual(41);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.locator('html').evaluate((element) => {
      element.style.fontSize = '32px';
    });
    const zoomedSlot = await reassurance.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      left: element.getBoundingClientRect().left,
      right: element.getBoundingClientRect().right,
    }));
    expect(zoomedSlot.scrollHeight).toBeLessThanOrEqual(
      zoomedSlot.clientHeight + 1,
    );
    expect(zoomedSlot.left).toBeGreaterThanOrEqual(0);
    expect(zoomedSlot.right).toBeLessThanOrEqual(320);
    await expect(
      stack.locator(
        '[role="progressbar"], [data-testid*="progress"], .loading-progress, .progress-track',
      ),
    ).toHaveCount(0);
  });

  test('Cancel and reload requests one document reload without entering runtime cleanup UI', async ({
    page,
  }) => {
    await page.goto(fakePath('loading'));
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await page.getByRole('button', { name: /Load Egregore/ }).click();
    await expect(page.getByTestId('loading-stack')).toBeVisible();
    let reloadAttempts = 0;
    await page.route('**/chatbot/**', async (route) => {
      if (route.request().resourceType() === 'document') {
        reloadAttempts += 1;
        await route.abort('aborted');
        return;
      }
      await route.continue();
    });
    await page
      .getByRole('button', { name: 'Cancel and reload' })
      .click()
      .catch(() => undefined);
    await expect.poll(() => reloadAttempts).toBe(1);
    await expect(page.getByTestId('loading-stack')).toBeVisible();
    const methodsAfterReload = await runtimeMethods(page);
    expect(methodsAfterReload).not.toEqual(
      expect.arrayContaining([
        'conversation.delete',
        'repository.unload',
        'engine.delete',
        'sdk.unload',
      ]),
    );
    await expect(page.getByText('Releasing this device')).toHaveCount(0);
  });

  for (const mismatch of ['version', 'index'] as const) {
    test(`preserves the activation slot and recovers from a corpus ${mismatch} mismatch`, async ({
      page,
      request,
    }) => {
      test.slow();
      await installCorpusMismatch(page, request, mismatch);
      for (const viewport of [
        { width: 320, height: 800 },
        { width: 430, height: 932 },
        { width: 1280, height: 800 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto(fakePath('published-corpus'));
        await page.getByRole('button', { name: 'Check compatibility' }).click();
        const slot = page.getByTestId('activation-status-message');
        const activationMain = page.getByTestId('activation-main');
        const load = page.getByRole('button', { name: /Load Egregore/ });
        const readySlot = await boxOf(slot);
        const readyMain = await boxOf(activationMain);
        const readyAction = await boxOf(load);
        await load.click();

        const expected =
          mismatch === 'version'
            ? 'Egregore found an incompatible knowledge-base version.'
            : 'Egregore found an incompatible search index.';
        await expect(slot).toHaveText(expected);
        await expect(page.getByText(expected)).toHaveCount(1);
        const returnToLoad = page.getByRole('button', {
          name: 'Return to load',
        });
        await expect(returnToLoad).toBeFocused();
        await expect(returnToLoad).toHaveAttribute(
          'aria-describedby',
          'egregore-activation-status',
        );
        await expect(
          page.locator('#egregore-activation-status'),
        ).toHaveAttribute('data-testid', 'activation-status-message');
        expectStableVerticalCenter(readySlot, await boxOf(slot));
        expectStableBox(readyMain, await boxOf(activationMain));
        expectStableVerticalCenter(readyAction, await boxOf(returnToLoad));

        await returnToLoad.press('Enter');
        await expect(
          page.getByRole('button', { name: /Load Egregore/ }),
        ).toBeFocused();
      }
    });
  }

  test('reports and recovers from a model load failure after consent', async ({
    page,
  }) => {
    await page.goto(fakePath('load-failure'));
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await page.getByRole('button', { name: /Load Egregore/ }).click();
    await expect(page.getByTestId('activation-status-message')).toHaveText(
      'Egregore could not load the local model.',
    );
    const recovery = page.getByRole('button', { name: 'Return to load' });
    await expect(recovery).toBeFocused();
    await recovery.press('Enter');
    await expect(
      page.getByRole('button', { name: /Load Egregore/ }),
    ).toBeFocused();
  });

  test('keeps elapsed unloading time factual while deterministic cleanup is pending', async ({
    page,
  }) => {
    await page.clock.install();
    await startFakeAssistant(page, 'unloading');
    await submitQuestionAndWait(
      page,
      'What does Jet write about agentic work?',
    );
    await page.getByRole('button', { name: /Unload/ }).click();

    const stack = page.getByTestId('loading-stack');
    const elapsed = page.getByTestId('loading-elapsed');
    await expect(stack.getByText('Releasing this device')).toBeVisible();
    await expect(
      stack.getByRole('heading', { name: 'Letting the ghost rest' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Cancel and reload' }),
    ).toHaveCount(0);
    const start = Number((await elapsed.textContent())?.match(/\d+/)?.[0]);
    await page.clock.runFor(2_000);
    const pending = Number((await elapsed.textContent())?.match(/\d+/)?.[0]);
    expect(pending).toBeGreaterThan(start);
    await expect(stack).toBeVisible();
    await page.clock.runFor(58_000);
    await expect(
      page.getByRole('button', { name: 'Check compatibility' }),
    ).toBeFocused();
  });
});

test.describe('Egregore responses, citations, and scrolling', () => {
  test('grounds a profile question in the canonical About source without exposing uncited context', async ({
    page,
  }) => {
    await startFakeAssistant(page, 'published-corpus');
    await submitQuestionAndWait(page, 'Who is Jet?');

    const response = page.locator('[aria-label="Conversation"] article').last();
    const citation = response.getByRole('link', {
      name: /^\[S\d+\] Jet Sanchez$/u,
    });
    await expect(citation).toHaveAttribute(
      'href',
      'https://jetsanchez.com/about/',
    );
    await expect(
      response.getByRole('link', { name: /^\[S\d+\]/u }),
    ).toHaveCount(1);
    await expect(response).not.toContainText(
      'I am a marketing engineer working at the intersection of AI research',
    );

    const disclosure = response.getByTestId('response-source-disclosure');
    await expect(
      disclosure.getByRole('button', { name: '1 source' }),
    ).toBeVisible();
    await disclosure.getByRole('button', { name: '1 source' }).click();
    await expect(
      disclosure.getByRole('link', {
        name: /^\[S\d+\] Jet Sanchez$/u,
      }),
    ).toHaveAttribute('href', 'https://jetsanchez.com/about/');
    await expect(disclosure.getByRole('link')).toHaveCount(1);
    await expect(disclosure).not.toContainText(
      'At Digital Squad, I lead AI research & development',
    );
  });

  test('keeps a representative live-corpus follow-up within one local session', async ({
    page,
  }) => {
    await startFakeAssistant(page, 'published-corpus');
    await submitQuestionAndWait(
      page,
      'What does Jet write about agentic work?',
    );

    await submitQuestionAndWait(page, 'What else has Jet published?');

    expect(
      (await runtimeMethods(page)).filter((method) => method === 'generate'),
    ).toHaveLength(2);
    await expect(
      page.locator('[aria-label="Conversation"] article'),
    ).toHaveCount(4);
  });

  test('renders citation disclosure with responsive semantics and no overlay', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'One Chromium matrix covers the explicit viewport set.',
    );
    const viewports = [
      ['mobile-320', 320, 800],
      ['mobile-430', 430, 932],
      ['tablet-portrait', 768, 1024],
      ['tablet-landscape', 1024, 768],
      ['desktop', 1440, 900],
    ] as const;

    for (const [name, width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await startFakeAssistant(page);
      await submitQuestionAndWait(page, LONG_SOURCE_TITLE);

      const trigger = page.getByRole('button', { name: '1 source' });
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      const controlledId = await trigger.getAttribute('aria-controls');
      expect(controlledId).toBeTruthy();
      await expect(page.locator(`#${controlledId}`)).toHaveCount(0);
      const triggerBox = await boxOf(trigger);
      expect(triggerBox.height).toBeGreaterThanOrEqual(44);
      expect(triggerBox.x).toBeGreaterThanOrEqual(0);
      expect(triggerBox.x + triggerBox.width).toBeLessThanOrEqual(width);

      for (const theme of ['light', 'dark'] as const) {
        await page.locator('html').evaluate((element, nextTheme) => {
          element.classList.toggle('dark', nextTheme === 'dark');
        }, theme);
        await page.screenshot({
          path: testInfo.outputPath(`sources-${name}-${theme}-collapsed.png`),
          animations: 'disabled',
        });
      }

      await trigger.focus();
      await trigger.press('Enter');
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      const region = page.getByRole('region', {
        name: 'Sources for this response',
      });
      await expect(region).toBeVisible();
      await expect(region.locator('ul')).toHaveCount(1);
      const source = region.getByRole('link').filter({
        hasText: LONG_SOURCE_TITLE,
      });
      await expect(source).toHaveAccessibleName(/^\[S\d+\] /u);
      await expect(source).toHaveAttribute(
        'href',
        /\/works\/recursive-convergence-hypothesis\/$/,
      );
      await expect(source).toHaveAttribute('target', '_blank');
      await expect(source).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(
        source.getByText(LONG_SOURCE_TITLE, { exact: true }),
      ).toBeVisible();
      expect(
        await source
          .getByText(LONG_SOURCE_TITLE, { exact: true })
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);

      const composer = page.locator('.egregore-composer form');
      const dock = page.locator('#site-navigation-dock > div').first();
      const sourceBox = await boxOf(region);
      const composerBox = await boxOf(composer);
      expect(sourceBox.y + sourceBox.height).toBeLessThanOrEqual(
        composerBox.y + 1,
      );
      if (await dock.isVisible()) {
        const dockBox = await boxOf(dock);
        expect(
          sourceBox.y + sourceBox.height <= dockBox.y ||
            sourceBox.y >= dockBox.y + dockBox.height,
        ).toBe(true);
      }
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      ).toBe(0);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      if (width >= 1024) {
        expect(triggerBox.width).toBeLessThan(200);
        expect(sourceBox.width).toBeLessThanOrEqual(608);
      }
      for (const theme of ['light', 'dark'] as const) {
        await page.locator('html').evaluate((element, nextTheme) => {
          element.classList.toggle('dark', nextTheme === 'dark');
        }, theme);
        await page.screenshot({
          path: testInfo.outputPath(`sources-${name}-${theme}-expanded.png`),
          animations: 'disabled',
        });
      }
    }
  });

  test('keeps citations and source disclosure controls outside the inline link recipe', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await startFakeAssistant(page);
    await submitQuestionAndWait(page, LONG_SOURCE_TITLE);

    const response = page.locator('[aria-label="Conversation"] article').last();
    const citation = response.getByRole('link', { name: /^\[S\d+\] /u });
    await expectOutsideTextLinkRecipe(citation);
    await expect(citation).toHaveCSS('text-decoration-line', 'underline');

    const disclosure = response.getByRole('button', { name: '1 source' });
    await expectOutsideTextLinkRecipe(disclosure);
    await expect(disclosure).toHaveAttribute('data-action-variant', 'ghost');
    await disclosure.click();

    const source = response
      .getByRole('region', { name: 'Sources for this response' })
      .getByRole('link', { name: /^\[S\d+\] /u });
    await expectOutsideTextLinkRecipe(source);
    await expect(source).toHaveAttribute('target', '_blank');
    await expect(source).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('deduplicates cited documents in first-citation order and keeps responses independent', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await startFakeAssistant(page, 'citations');
    await submitQuestionAndWait(
      page,
      `${LONG_SOURCE_TITLE} ${SOURCE_SENTINEL}`,
    );

    const firstDisclosure = page
      .getByTestId('response-source-disclosure')
      .first();
    const firstTrigger = firstDisclosure.getByRole('button', {
      name: '2 sources',
    });
    await expect(firstTrigger).toHaveAttribute('aria-expanded', 'false');
    await firstTrigger.click();
    const firstLinks = firstDisclosure.getByRole('link');
    await expect(firstLinks).toHaveCount(2);
    const firstHrefs = await firstLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')),
    );
    expect(new Set(firstHrefs).size).toBe(2);
    await expect(firstLinks.first()).toHaveAccessibleName(/^\[S\d+\] /u);
    await expect(firstLinks.first()).toContainText(LONG_SOURCE_TITLE);
    expect(await firstDisclosure.textContent()).not.toContain(SOURCE_SENTINEL);

    await submitQuestionAndWait(
      page,
      `${LONG_SOURCE_TITLE} ${SOURCE_SENTINEL}`,
    );
    const disclosures = page.getByTestId('response-source-disclosure');
    await expect(disclosures).toHaveCount(2);
    await expect(disclosures.first().getByRole('button')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(disclosures.nth(1).getByRole('button')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  test('omits an empty source panel for a completed zero-citation response', async ({
    page,
  }) => {
    await startFakeAssistant(page, 'zero-citation');
    await expect(page.getByTestId('response-source-disclosure')).toHaveCount(0);
    await submitQuestionAndWait(page, 'What has Jet published?');
    await expect(page.getByTestId('response-source-disclosure')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /sources?$/ })).toHaveCount(
      0,
    );
  });

  test('stops once, preserves the partial response, and completes one recovery response', async ({
    page,
  }) => {
    const composer = await startFakeAssistant(page, 'stop-recovery');
    await submitQuestion(page, 'What does Jet write about local-first AI?');
    await expect(composer).not.toBeFocused();
    await expect(
      page.getByText("Jet's published work connects local-first AI", {
        exact: false,
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Stop response' }).click();
    await expect(composer).not.toBeFocused();
    await expect(page.getByText('Stopped', { exact: true })).toHaveCount(1);
    const stoppedResponse = page
      .locator('[aria-label="Conversation"] article')
      .filter({
        hasText: 'Stopped',
      });
    const stoppedInlineCitations = await stoppedResponse
      .getByRole('link', { name: /\[S\d+\]/ })
      .count();
    const stoppedDisclosures = stoppedResponse.getByTestId(
      'response-source-disclosure',
    );
    const expectedStoppedDisclosures = stoppedInlineCitations > 0 ? 1 : 0;
    // Stop may land on either side of the next streamed citation chunk under load.
    // The durable contract is that the disclosure mirrors validated inline citations.
    await expect(stoppedDisclosures).toHaveCount(expectedStoppedDisclosures);
    await composer.fill('Summarize the recursive convergence hypothesis.');
    const completedGenerationCount = await generatedResponseCount(page);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(composer).not.toBeFocused();
    await waitForCompletedResponse(page, completedGenerationCount);
    await expect(composer).not.toBeFocused();
    await expect(page.getByText('Stopped', { exact: true })).toHaveCount(1);
    await expect(page.getByTestId('response-source-disclosure')).toHaveCount(
      expectedStoppedDisclosures + 1,
    );
  });

  test('stops sticky follow after manual scroll-away and restores it through Jump to latest', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 430, height: 480 });
    const composer = await startFakeAssistant(page, 'long-stream');
    await page.clock.install();
    const pageNow = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(pageNow + 1_000);
    await composer.fill('Summarize the recursive convergence hypothesis.');
    await composer.press('Enter');
    // Runner wall time must not be able to complete this clock-controlled stream.
    await new Promise<void>((resolve) => setTimeout(resolve, 900));
    const scroller = page.getByTestId('conversation-scroller');
    await expect(currentStatusLabel(page)).toHaveText('Responding');
    const currentAssistant = scroller.locator('article').last();
    await page.clock.runFor(80);
    await expect(currentAssistant).toContainText('Reading the site locally…');
    await expect
      .poll(() =>
        scroller.evaluate(
          (element) =>
            element.scrollHeight - element.scrollTop - element.clientHeight,
        ),
      )
      .toBeLessThanOrEqual(48);
    const contentBeforeScroll = await currentAssistant.textContent();
    await scroller.evaluate(async (element) => {
      await new Promise<void>((resolve) => {
        element.addEventListener('scroll', () => resolve(), { once: true });
        element.scrollTop = 0;
      });
    });
    const awayPosition = await scroller.evaluate(
      (element) => element.scrollTop,
    );
    await page.clock.runFor(160);
    await expect
      .poll(() => currentAssistant.textContent())
      .not.toBe(contentBeforeScroll);
    await expect(
      page.getByRole('button', { name: 'Jump to latest' }),
    ).toBeVisible();
    expect(await scroller.evaluate((element) => element.scrollTop)).toBe(
      awayPosition,
    );

    const jump = page.getByRole('button', { name: 'Jump to latest' });
    await jump.focus();
    await jump.press('Enter');
    // Commit the jump action before fast-forwarding the remaining stream timers.
    await expect(jump).toHaveCount(0);
    await page.clock.runFor(500);
    await expect(jump).toHaveCount(0);
    await expect(composer).not.toBeFocused();
    expect(
      await scroller.evaluate(
        (element) =>
          element.scrollHeight - element.scrollTop - element.clientHeight,
      ),
    ).toBeLessThanOrEqual(48);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe('Egregore unsupported, failure, and exhaustion states', () => {
  test('shows no enabled composer when WebGPU is unsupported and permits a fresh check', async ({
    page,
  }) => {
    await page.goto(fakePath('unsupported'));
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await expect(
      page.getByRole('heading', { name: 'This browser cannot run Egregore' }),
    ).toBeVisible();
    await expect(
      page.getByText('Egregore could not access a compatible GPU adapter.'),
    ).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: 'Ask Egregore' }),
    ).toHaveCount(0);
    const checkAgain = page.getByRole('button', { name: 'Check again' });
    await expect(checkAgain).toBeFocused();
    await checkAgain.press('Enter');
    await expect(
      page.getByRole('heading', { name: 'This browser cannot run Egregore' }),
    ).toBeVisible();
    await expect(checkAgain).toBeFocused();
  });

  test('keeps the transcript and recovers after generation failure', async ({
    page,
  }) => {
    const composer = await startFakeAssistant(page, 'generation-failure');
    await submitQuestion(page, 'What does Jet write about agentic work?');
    await expect(
      page.getByText('Egregore could not complete the local response.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Try another question' }),
    ).toBeFocused();
    await expect(
      page
        .locator('[aria-label="Conversation"] article')
        .getByText('What does Jet write about agentic work?', { exact: true }),
    ).toHaveCount(0);
    await expect(composer).toHaveValue(
      'What does Jet write about agentic work?',
    );

    await page
      .getByRole('button', { name: 'Try another question' })
      .press('Enter');
    await expect(composer).toBeFocused();
    await composer.fill('Summarize the recursive convergence hypothesis.');
    const completedGenerationCount = await generatedResponseCount(page);
    await composer.press('Enter');
    await waitForCompletedResponse(page, completedGenerationCount);
    await expect(
      page.getByText('Summarize the recursive convergence hypothesis.', {
        exact: true,
      }),
    ).toBeVisible();
  });

  test('preserves the complete transcript and avoids generation after exhaustion', async ({
    page,
  }) => {
    const supportedQuestion = 'What does Jet write about agentic work?';
    const recoveryQuestion = 'Summarize the recursive convergence hypothesis.';
    const composer = await startFakeAssistant(page, 'exhaustion');
    await submitQuestionAndWait(page, supportedQuestion);
    const transcriptBefore = await page
      .locator('[aria-label="Conversation"] article')
      .allTextContents();
    const methodsBefore = await runtimeMethods(page);
    const generationCount = methodsBefore.filter(
      (method) => method === 'generate',
    ).length;
    const sessionCount = methodsBefore.filter(
      (method) => method === 'conversation.create',
    ).length;

    await composer.fill(
      'Question that exceeds the deterministic fake conversation budget',
    );
    await composer.press('Enter');
    await expect(
      page.getByText(
        'The current session is full. Start a new session to continue.',
      ),
    ).toBeVisible();
    const methodsAfter = await runtimeMethods(page);
    expect(methodsAfter.filter((method) => method === 'generate')).toHaveLength(
      generationCount,
    );
    expect(
      methodsAfter.filter((method) => method === 'conversation.create'),
    ).toHaveLength(sessionCount);
    expect(
      await page
        .locator('[aria-label="Conversation"] article')
        .allTextContents(),
    ).toEqual(transcriptBefore);

    const startNewSession = page.getByRole('button', {
      name: 'Start new session',
    });
    await startNewSession.focus();
    await startNewSession.press('Enter');
    await expect(composer).toBeFocused();
    await expect(composer).toBeEnabled();
    await expect(composer).toHaveValue('');
    await expect(
      page.locator('[aria-label="Conversation"] article'),
    ).toHaveCount(0);
    await submitQuestionAndWait(page, recoveryQuestion);
    await expect(
      page.getByText(recoveryQuestion, { exact: true }),
    ).toBeVisible();

    await page.goto(fakePath('exhaustion'));
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await page.getByRole('button', { name: /Load Egregore/ }).click();
    const pointerComposer = page.getByRole('textbox', { name: 'Ask Egregore' });
    await submitQuestionAndWait(page, supportedQuestion);
    await submitQuestion(page, 'Second pointer question');
    await expect(
      page.getByText(
        'The current session is full. Start a new session to continue.',
      ),
    ).toBeVisible();
    const pointerRecovery = page.getByRole('button', {
      name: 'Start new session',
    });
    await pointerRecovery.click();
    await expect(pointerComposer).toBeEnabled();
    await expect(pointerComposer).toHaveValue('');
    await expect(pointerComposer).not.toBeFocused();
    await submitQuestionAndWait(page, recoveryQuestion);
    await expect(
      page.getByText(recoveryQuestion, { exact: true }),
    ).toBeVisible();
  });

  for (const scenario of ['reset-failure', 'unload-failure'] as const) {
    test(`offers a keyboard recovery action for ${scenario}`, async ({
      page,
    }) => {
      await startFakeAssistant(page, scenario);
      if (scenario === 'reset-failure') {
        await page
          .getByRole('button', { name: /New session|Start a new session/ })
          .click();
        await expect(
          page.getByText(
            'Egregore could not fully release the local model runtime.',
          ),
        ).toBeVisible();
        const retry = page.getByRole('button', { name: 'Retry new session' });
        await expect(retry).toBeFocused();
        await retry.press('Enter');
        await expect(
          page.getByRole('textbox', { name: 'Ask Egregore' }),
        ).toBeFocused();
      } else {
        await page.getByRole('button', { name: /Unload/ }).click();
        await expect(
          page.getByText(
            'Egregore could not fully release the local model runtime.',
          ),
        ).toBeVisible();
        const retry = page.getByRole('button', { name: 'Retry unload' });
        await expect(retry).toBeFocused();
        await retry.press('Enter');
        await expect(
          page.getByRole('button', { name: 'Check compatibility' }),
        ).toBeFocused();
      }
    });
  }
});

test.describe('Egregore ClientRouter cleanup', () => {
  async function navigateAwayThroughDock(page: Page): Promise<void> {
    const about = page
      .locator('#site-navigation-dock')
      .getByRole('link', { name: 'About' });
    await about.click();
    await expect(page).toHaveURL(/\/about\/$/);
    await expect(page.getByRole('heading', { name: /About/i })).toBeVisible();
  }

  test('cleans prior resources once and starts an isolated session after route re-entry', async ({
    page,
  }) => {
    const previousQuestion = 'What does Jet write about agentic work?';
    await startFakeAssistant(page);
    await submitQuestionAndWait(page, previousQuestion);
    await navigateAwayThroughDock(page);

    const methods = await runtimeMethods(page);
    for (const method of [
      'conversation.delete',
      'repository.unload',
      'engine.delete',
      'sdk.unload',
    ]) {
      expect(
        methods.filter((candidate) => candidate === method),
        method,
      ).toHaveLength(1);
    }

    await page
      .locator('#site-navigation-dock')
      .getByRole('link', { name: 'Egregore' })
      .click();
    await expect(page).toHaveURL(/\/chatbot\/$/);
    await expect(
      page.getByRole('button', { name: 'Check compatibility' }),
    ).toBeVisible();
    await expect
      .poll(() => runtimeCalls(page), {
        message: 'the re-entered island should install a clean runtime audit',
      })
      .toEqual([]);
    await expect(page.getByText(previousQuestion, { exact: true })).toHaveCount(
      0,
    );

    await page.getByRole('button', { name: 'Check compatibility' }).click();
    const load = page.getByRole('button', { name: /Load Egregore/ });
    await expect(load).toBeVisible();
    await load.click();
    const composer = page.getByRole('textbox', { name: 'Ask Egregore' });
    await expect(composer).toBeEnabled();
    await expect(currentStatusLabel(page)).toHaveText('Ready');

    const reentryQuestion = 'Which projects connect AI and systems thinking?';
    await submitQuestionAndWait(page, reentryQuestion);
    await expect(
      page.getByText(reentryQuestion, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /\[S\d+\]/u }).first(),
    ).toBeVisible();
    await expect(page.getByText(previousQuestion, { exact: true })).toHaveCount(
      0,
    );
  });

  test('cancels streaming before cleanup and suppresses a deliberately late event', async ({
    page,
  }) => {
    await startFakeAssistant(page, 'late-event');
    await submitQuestion(page, 'What does Jet write about agentic work?');
    await expect(
      page.getByText("Jet's published work connects local-first AI", {
        exact: false,
      }),
    ).toBeVisible();
    await navigateAwayThroughDock(page);

    await page.waitForTimeout(750);
    const methods = await runtimeMethods(page);
    const requiredCleanup = [
      'cancel',
      'conversation.delete',
      'repository.unload',
      'engine.delete',
      'sdk.unload',
    ];
    for (const method of requiredCleanup) {
      expect(
        methods.filter((candidate) => candidate === method),
        method,
      ).toHaveLength(1);
    }
    await expect(
      page.getByText(/with systems thinking \[S\d+\]\./u),
    ).toHaveCount(0);
    await expect(page.getByTestId('lifecycle-visible-status')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /About/i })).toBeVisible();
  });
});
