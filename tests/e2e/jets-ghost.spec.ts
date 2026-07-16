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

const GHOST_PATH = '/chatbot/';
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
const LONG_SOURCE_TITLE = 'The Recursive Convergence Hypothesis: Emergent Sentience as a Structural Attractor of Recursive ASI';
const PROMPT_SENTINEL = 'JG_PROMPT_SENTINEL_7f9e2d';
const SOURCE_SENTINEL = 'JG_SOURCE_SENTINEL_4a6c1b';

type FakeScenario =
  | 'default'
  | 'checking'
  | 'unsupported'
  | 'load-failure'
  | 'generation-failure'
  | 'reset-failure'
  | 'unload-failure'
  | 'loading'
  | 'unloading'
  | 'long-stream'
  | 'stop-recovery'
  | 'citations'
  | 'zero-citation'
  | 'exhaustion'
  | 'late-event';

interface RuntimeCall {
  method: string;
  operationId: number;
  runtimeId?: number;
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

function currentStatusLabel(page: Page): Locator {
  return page.getByTestId('lifecycle-visual-label').last();
}

function fakePath(scenario: FakeScenario = 'default'): string {
  const legacySlowStream = [
    'long-stream',
    'stop-recovery',
    'late-event',
  ].includes(scenario) ? '&stream=slow' : '';
  return `${GHOST_PATH}?runtime=fake&scenario=${scenario}${legacySlowStream}`;
}

async function runtimeCalls(page: Page): Promise<RuntimeCall[]> {
  return page.evaluate(() => {
    const state = window as typeof window & {
      __JETS_GHOST_E2E__?: {
        readonly runtimeId: number;
        readonly calls: readonly Readonly<RuntimeCall>[];
      };
    };
    return state.__JETS_GHOST_E2E__?.calls.map((call) => ({ ...call })) ?? [];
  });
}

async function runtimeMethods(page: Page): Promise<string[]> {
  return (await runtimeCalls(page)).map(({ method }) => method);
}

async function runtimeId(page: Page): Promise<number | null> {
  return page.evaluate(() => (
    window as typeof window & {
      __JETS_GHOST_E2E__?: { readonly runtimeId: number };
    }
  ).__JETS_GHOST_E2E__?.runtimeId ?? null);
}

async function installFetchAudit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const auditedWindow = window as typeof window & { __JETS_GHOST_FETCHES__?: FetchRecord[] };
    const nativeFetch = window.fetch.bind(window);
    auditedWindow.__JETS_GHOST_FETCHES__ = [];
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      const headers = new Headers(init?.headers ?? request?.headers);
      let body: string | null = null;
      if (typeof init?.body === 'string') body = init.body;
      else if (init?.body instanceof URLSearchParams) body = init.body.toString();
      auditedWindow.__JETS_GHOST_FETCHES__?.push({
        url: new URL(request?.url ?? String(input), window.location.href).toString(),
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
    const state = window as typeof window & { __JETS_GHOST_LABELS__?: string[] };
    state.__JETS_GHOST_LABELS__ = [];
    const record = () => {
      for (const element of document.querySelectorAll('[data-testid="lifecycle-visual-label"]')) {
        const label = element.textContent?.trim() ?? '';
        if (label !== '' && !state.__JETS_GHOST_LABELS__?.includes(label)) {
          state.__JETS_GHOST_LABELS__?.push(label);
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

async function auditedFetches(page: Page): Promise<FetchRecord[]> {
  return page.evaluate(() => {
    const auditedWindow = window as typeof window & { __JETS_GHOST_FETCHES__?: FetchRecord[] };
    return auditedWindow.__JETS_GHOST_FETCHES__?.map((record) => ({ ...record })) ?? [];
  });
}

async function startFakeAssistant(
  page: Page,
  scenario: FakeScenario = 'default',
  loadModality: 'pointer' | 'keyboard' = 'pointer',
): Promise<Locator> {
  await page.goto(fakePath(scenario));
  await page.getByRole('button', { name: 'Check compatibility' }).click();
  const load = page.getByRole('button', { name: /Load Jet's Ghost/ });
  await expect(load).toBeVisible();
  if (loadModality === 'keyboard') {
    await load.focus();
    await load.press('Enter');
  } else {
    await load.click();
  }
  const composer = page.getByRole('textbox', { name: "Ask Jet's Ghost" });
  await expect(composer).toBeEnabled();
  await expect(currentStatusLabel(page)).toHaveText('Ready');
  return composer;
}

async function submitQuestion(
  page: Page,
  question: string,
  modality: 'pointer' | 'keyboard' = 'pointer',
): Promise<void> {
  const composer = page.getByRole('textbox', { name: "Ask Jet's Ghost" });
  await composer.fill(question);
  if (modality === 'keyboard') await composer.press('Enter');
  else await page.getByRole('button', { name: 'Send message' }).click();
}

async function waitForCompletedResponse(page: Page): Promise<void> {
  await expect.poll(async () => (
    await runtimeMethods(page)
  ).filter((method) => method === 'generate').length).toBeGreaterThan(0);
  await expect(currentStatusLabel(page)).toHaveText('Ready');
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

function expectStableBox(before: Box, after: Box, tolerance = 1): void {
  for (const property of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(before[property] - after[property]), property).toBeLessThanOrEqual(tolerance);
  }
}

async function expectLifecycleLabelContained(page: Page, expectedLabel: string): Promise<void> {
  const label = currentStatusLabel(page);
  const status = page.getByTestId('lifecycle-visible-status');
  const header = page.locator('.jets-ghost-header');
  await expect(label).toHaveText(expectedLabel);
  await page.waitForTimeout(220);
  await expect(page.getByTestId('lifecycle-visual-label')).toHaveCount(1);

  const [labelBox, statusBox, headerBox] = await Promise.all([
    boxOf(label),
    boxOf(status),
    boxOf(header),
  ]);
  expect(labelBox.y).toBeGreaterThanOrEqual(statusBox.y - 1);
  expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(statusBox.y + statusBox.height + 1);
  expect(statusBox.y).toBeGreaterThanOrEqual(headerBox.y - 1);
  expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(headerBox.y + headerBox.height + 1);
}

async function renderedContrastRatio(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const readColor = (color: string): [number, number, number, number] => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d');
      if (context === null) throw new Error('Canvas color conversion is unavailable');
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
      return [red, green, blue, alpha];
    };
    const backdropFor = (start: Element | null): [number, number, number] => {
      let current = start;
      while (current !== null) {
        const [red, green, blue, alpha] = readColor(getComputedStyle(current).backgroundColor);
        if (alpha === 255) return [red, green, blue];
        current = current.parentElement;
      }
      return [255, 255, 255];
    };
    const blend = (
      foreground: [number, number, number],
      background: [number, number, number],
      alpha: number,
    ): [number, number, number] => foreground.map((channel, index) => (
      channel * alpha + background[index] * (1 - alpha)
    )) as [number, number, number];
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
    const [foregroundRed, foregroundGreen, foregroundBlue] = readColor(style.color);
    const [surfaceRed, surfaceGreen, surfaceBlue] = readColor(style.backgroundColor);
    const backdrop = backdropFor(element.parentElement);
    const opacity = Number.parseFloat(style.opacity);
    const foreground = blend(
      [foregroundRed, foregroundGreen, foregroundBlue],
      backdrop,
      opacity,
    );
    const background = blend([surfaceRed, surfaceGreen, surfaceBlue], backdrop, opacity);
    const lighter = Math.max(luminance(foreground), luminance(background));
    const darker = Math.min(luminance(foreground), luminance(background));
    return (lighter + 0.05) / (darker + 0.05);
  });
}

function expectStableVerticalCenter(before: Box, after: Box, tolerance = 1): void {
  expect(Math.abs(before.y - after.y), 'y').toBeLessThanOrEqual(tolerance);
  expect(Math.abs(before.height - after.height), 'height').toBeLessThanOrEqual(tolerance);
  expect(
    Math.abs((before.x + before.width / 2) - (after.x + after.width / 2)),
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
    ).not.toMatch(/^(?:authorization|proxy-authorization|x-|api[-_]?key$|apikey$|auth(?:entication)?[-_]?token$|access[-_]?token$|id[-_]?token$|credential$)/u);
    expect(
      `${name}:${value}`,
      `Credential-bearing header value: ${rawName}`,
    ).not.toMatch(/(?:^|\s)(?:bearer|basic)\s+|api[-_]?key|auth[-_]?token|access[-_]?token/iu);
    if (name === 'cookie' && !options.allowBrowserCookie) {
      expect(name, 'Browser cookie is not allowed for this request class').not.toBe('cookie');
    }
  }
}

function emittedLiteRtChunkPaths(): string[] {
  const assetDirectory = join(process.cwd(), 'dist', '_astro');
  return readdirSync(assetDirectory)
    .filter((name) => name.endsWith('.js'))
    .filter((name) => readFileSync(join(assetDirectory, name), 'utf8')
      .includes('cdn.jsdelivr.net/npm/@litert-lm/core'))
    .map((name) => `/_astro/${name}`);
}

async function getJson(request: APIRequestContext, path: string): Promise<Record<string, unknown>> {
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
    await page.route(`**${CORPUS_PATHS[1]}`, (route) => route.fulfill({
      body: contentText,
      contentType: 'application/json',
    }));
  } else {
    const index = await getJson(request, CORPUS_PATHS[2]);
    const chunkCount = typeof index.chunkCount === 'number' ? index.chunkCount : 0;
    index.chunkCount = chunkCount + 1;
    const indexText = JSON.stringify(index);
    manifest.indexSha256 = sha256(indexText);
    await page.route(`**${CORPUS_PATHS[2]}`, (route) => route.fulfill({
      body: indexText,
      contentType: 'application/json',
    }));
  }
  await page.route(`**${CORPUS_PATHS[0]}`, (route) => route.fulfill({
    body: JSON.stringify(manifest),
    contentType: 'application/json',
  }));
}

test.describe("Jet's Ghost consent and local privacy", () => {
  test('does not construct or fetch assistant resources before explicit load consent', async ({ page }) => {
    const requests: Request[] = [];
    page.on('request', (request) => requests.push(request));

    await page.goto(GHOST_PATH);
    await expect(page.getByRole('button', { name: 'Check compatibility' })).toBeVisible();
    expect(await runtimeMethods(page)).toEqual([]);
    expect(await page.evaluate(() => {
      const audit = (
        window as typeof window & {
          __JETS_GHOST_E2E__?: { readonly calls: readonly Readonly<RuntimeCall>[] };
        }
      ).__JETS_GHOST_E2E__;
      return audit !== undefined
        && Object.isFrozen(audit)
        && Object.isFrozen(audit.calls)
        && audit.calls.every(Object.isFrozen);
    })).toBe(true);
    const liteRtChunks = emittedLiteRtChunkPaths();
    expect(liteRtChunks.length).toBeGreaterThan(0);
    expect(requests.map((request) => request.url()).filter((url) => (
      CORPUS_PATHS.some((path) => url.includes(path))
      || url.includes(RUNTIME_ROOT)
      || liteRtChunks.includes(new URL(url).pathname)
      || /huggingface|\.litertlm|litert[-_.]?lm/i.test(url)
    ))).toEqual([]);

    await page.addInitScript(() => {
      const state = window as typeof window & { __JETS_GHOST_CAPABILITY_CALLS__?: number };
      state.__JETS_GHOST_CAPABILITY_CALLS__ = 0;
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: {
          requestAdapter: async () => {
            state.__JETS_GHOST_CAPABILITY_CALLS__ = (state.__JETS_GHOST_CAPABILITY_CALLS__ ?? 0) + 1;
            return {};
          },
        },
      });
    });
    requests.length = 0;
    await page.goto(GHOST_PATH);
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await expect(page.getByRole('button', { name: /Load Jet's Ghost/ })).toBeVisible();
    expect(await page.evaluate(() => (
      window as typeof window & { __JETS_GHOST_CAPABILITY_CALLS__?: number }
    ).__JETS_GHOST_CAPABILITY_CALLS__)).toBe(1);
    const supportedAudit = await runtimeCalls(page);
    expect(supportedAudit.map(({ method }) => method)).toEqual(['checkCapabilities']);
    expect(supportedAudit.map((call) => Object.keys(call).sort())).toEqual([
      ['method', 'operationId', 'runtimeId'],
    ]);
    expect(requests.map((request) => request.url()).filter((url) => (
      CORPUS_PATHS.some((path) => url.includes(path))
      || url.includes(RUNTIME_ROOT)
      || liteRtChunks.includes(new URL(url).pathname)
      || /huggingface|\.litertlm/i.test(url)
    ))).toEqual([]);
  });

  test('allows only bodyless credential-free corpus fetches in the fake flow', async ({ page }) => {
    await installFetchAudit(page);
    const browserRequests: Request[] = [];
    page.on('request', (request) => browserRequests.push(request));
    await page.goto(fakePath());
    await page.waitForLoadState('networkidle');
    browserRequests.length = 0;
    await page.evaluate(() => {
      const auditedWindow = window as typeof window & { __JETS_GHOST_FETCHES__?: FetchRecord[] };
      auditedWindow.__JETS_GHOST_FETCHES__ = [];
    });

    await page.getByRole('button', { name: 'Check compatibility' }).click();
    expect(await auditedFetches(page)).toEqual([]);
    await page.getByRole('button', { name: /Load Jet's Ghost/ }).click();
    await expect(page.getByRole('textbox', { name: "Ask Jet's Ghost" })).toBeEnabled();

    await submitQuestion(page, PROMPT_SENTINEL);
    await waitForCompletedResponse(page);

    const fetches = await auditedFetches(page);
    const corpusFetches = fetches.filter(({ url }) => (
      CORPUS_PATHS.includes(new URL(url).pathname as typeof CORPUS_PATHS[number])
    ));
    expect(corpusFetches).toHaveLength(3);
    for (const record of corpusFetches) {
      expect(record.method).toBe('GET');
      expect(record.credentials).toBe('omit');
      expect(record.body).toBeNull();
      expect(record.headers).toEqual([]);
    }
    for (const record of fetches) {
      expectNoApplicationCredentials(record.headers, { allowBrowserCookie: false });
    }

    const serialized = JSON.stringify({
      fetches,
      requests: await Promise.all(browserRequests.map(async (request) => ({
        url: request.url(),
        method: request.method(),
        headers: await request.allHeaders(),
        body: request.postData(),
      }))),
    });
    expect(serialized).not.toContain(PROMPT_SENTINEL);
    expect(serialized).not.toContain(SOURCE_SENTINEL);
    expect(serialized).not.toMatch(/huggingface|cdn\.jsdelivr\.net|\.litertlm/i);
    expect(fetches.some(({ url }) => url.includes(RUNTIME_ROOT))).toBe(false);
    expect(browserRequests.some((request) => request.url().includes(RUNTIME_ROOT))).toBe(false);

    const origin = new URL(page.url()).origin;
    for (const request of browserRequests) {
      const url = new URL(request.url());
      const isCorpus = url.origin === origin
        && CORPUS_PATHS.includes(url.pathname as typeof CORPUS_PATHS[number]);
      const isApplicationAsset = url.origin === origin && url.pathname.startsWith('/_astro/');
      const runtimeAsset = url.origin === origin && url.pathname.startsWith(RUNTIME_ROOT)
        ? url.pathname.slice(RUNTIME_ROOT.length)
        : null;
      const isRuntimeAsset = runtimeAsset !== null
        && !runtimeAsset.includes('/')
        && LITERT_ASSETS.has(runtimeAsset);
      const isPartytownAnalytics = url.origin === origin
        && url.pathname === '/~partytown/proxytown';
      const isAnalytics = (
        [
          'www.google-analytics.com',
          'analytics.google.com',
          'region1.google-analytics.com',
          'www.googletagmanager.com',
        ].includes(url.hostname) && /\/(?:g\/)?collect$|\/gtag\/js$/u.test(url.pathname)
      ) || isPartytownAnalytics;
      expect(
        isCorpus || isApplicationAsset || isRuntimeAsset || isAnalytics,
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
      if (isCorpus || isApplicationAsset || isRuntimeAsset) expect(url.search).toBe('');
      const headers = await request.allHeaders();
      expectNoApplicationCredentials(headers, {
        allowBrowserCookie: isApplicationAsset || isAnalytics,
      });
    }
  });
});

test.describe("Jet's Ghost supported lifecycle", () => {
  test('settles the current lifecycle label before it becomes visible', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(fakePath());

    const header = page.locator('.jets-ghost-header');
    const identity = header.locator(':scope > div').first();
    const status = page.getByTestId('lifecycle-visible-status');

    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await expect(currentStatusLabel(page)).toHaveText('Load ready');

    const immediateLabel = await boxOf(currentStatusLabel(page));
    const immediateStatus = await boxOf(status);
    await page.waitForTimeout(220);
    await expect(page.getByTestId('lifecycle-visual-label')).toHaveCount(1);
    const settledLabel = await boxOf(currentStatusLabel(page));
    const settledStatus = await boxOf(status);

    expectStableBox(immediateLabel, settledLabel);
    expectStableBox(immediateStatus, settledStatus);
    await expect(identity.getByTestId('lifecycle-visible-status')).toHaveCount(1);
  });

  test('supports compatibility, load, suggestion, cited response, reset, and unload', async ({ page }) => {
    const composer = await startFakeAssistant(page, 'long-stream');
    await expect(composer).not.toBeFocused();
    const reliability = page.getByTestId('composer-reliability-disclosure');
    await expect(reliability).toHaveText('Jet’s Ghost can make mistakes. Check cited sources.');

    const suggestion = page.getByRole('button', { name: 'Summarize the recursive convergence hypothesis.' });
    await suggestion.click();
    await expect(reliability).toBeVisible();
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue('Summarize the recursive convergence hypothesis.');

    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(composer).not.toBeFocused();
    await expect(reliability).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Stop response' })).toBeVisible();
    await waitForCompletedResponse(page);

    const inlineCitation = page.getByRole('link', { name: /\[S1\]/ }).first();
    await expect(inlineCitation).toHaveAttribute('href', /\/works\/recursive-convergence-hypothesis\/$/);
    const disclosure = page.getByRole('button', { name: '1 source' });
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await disclosure.focus();
    await disclosure.press('Enter');
    await expect(page.getByRole('region', { name: 'Sources for this response' })).toBeVisible();

    const newSession = page.getByRole('button', { name: /New session|Start a new session/ });
    await newSession.focus();
    await newSession.press('Enter');
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue('');
    await expect(reliability).toBeVisible();

    await page.getByRole('button', { name: /Unload/ }).click();
    await expect(page.getByRole('button', { name: 'Check compatibility' })).toBeFocused();
    expect(await runtimeMethods(page)).toEqual([
      'checkCapabilities',
      'repository.load',
      'runtime.load',
      'engine.create',
      'conversation.create',
      'generate',
      'conversation.delete',
      'repository.unload',
      'engine.delete',
      'sdk.unload',
    ]);
  });

  test('keeps checking status text readable in light and dark themes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium');

    for (const theme of ['light', 'dark'] as const) {
      await page.goto(GHOST_PATH);
      await page.evaluate((selectedTheme) => localStorage.setItem('theme', selectedTheme), theme);
      await page.goto(fakePath('checking'));
      await page.getByRole('button', { name: 'Check compatibility' }).click();

      const checking = page.getByRole('button', { name: 'Checking WebGPU and memory' });
      await expect(checking).toBeVisible();
      expect(await renderedContrastRatio(checking), `${theme} checking contrast`)
        .toBeGreaterThanOrEqual(4.5);
      await expect(checking).toHaveAttribute('data-action-variant', 'neutral');
    }
  });

  test('keeps status left-aligned with identity while stable actions stay anchored', async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile-chromium';
    await page.setViewportSize(mobile ? { width: 430, height: 932 } : { width: 1280, height: 800 });
    const composer = await startFakeAssistant(page, 'long-stream');
    const header = page.locator('.jets-ghost-header');
    const brand = header.locator(':scope > div').first();
    const identity = page.getByTestId('jets-ghost-identity');
    const identityMetadata = identity.locator('p').nth(1);
    const actionGroup = page.getByTestId('jets-ghost-header-actions');
    const newSession = page.getByRole('button', { name: /New session|Start a new session/ });
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
        padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
        minWidth: style.minWidth,
      };
    });
    expect(statusChrome.backgroundColor).toMatch(/transparent|rgba\(0, 0, 0, 0\)/);
    expect(statusChrome.borderWidth).toBe('0px');
    expect(statusChrome.boxShadow).toBe('none');
    expect(statusChrome.borderRadius).toBe('0px');
    expect(statusChrome.padding).toEqual(['0px', '0px', '0px', '0px']);
    expect(['0px', 'auto']).toContain(statusChrome.minWidth);
    expect(before.status.x).toBeCloseTo(before.metadata.x, 0);
    await expect(identity.getByTestId('lifecycle-visible-status')).toHaveCount(1);
    await expect(actionGroup.getByTestId('lifecycle-visible-status')).toHaveCount(0);

    await composer.fill('Summarize the recursive convergence hypothesis.');
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
    expectStableBox(respondingImmediate.newSession, respondingSettled.newSession);
    expectStableBox(respondingImmediate.unload, respondingSettled.unload);
    expectStableBox(respondingImmediate.status, respondingSettled.status);
    expectStableBox(respondingImmediate.label, respondingSettled.label);
    expect(respondingImmediate.status.width).toBeGreaterThan(before.status.width);
    expect(respondingImmediate.status.x).toBeCloseTo(before.status.x, 0);
    expect(respondingImmediate.status.x + respondingImmediate.status.width)
      .toBeGreaterThan(before.status.x + before.status.width);
    await expect(newSession).toBeDisabled();
    await expect(unload).toBeEnabled();

    const statusLabels = page.getByTestId('lifecycle-visual-label');
    expect(await statusLabels.count()).toBeLessThanOrEqual(2);
    await waitForCompletedResponse(page);
    await expect(newSession).toBeEnabled();
    await expect(unload).toBeEnabled();

    const announcement = page.getByTestId('lifecycle-announcement');
    await expect(announcement).toHaveAttribute('role', 'status');
    await expect(announcement).toHaveAttribute('aria-live', 'polite');
    await expect(status).not.toHaveAttribute('aria-live');
    await expect(page.locator('[aria-label="Conversation"] article').last()).not.toHaveAttribute('aria-live');
    expect(['Not running', 'Checking', 'Load ready', 'Loading', 'Ready', 'Responding'])
      .toContain(await currentStatusLabel(page).textContent());

    const metadata = page.getByTestId('composer-metadata');
    const hint = page.getByTestId('composer-keyboard-hint');
    await expect(page.getByTestId('composer-local-only')).toBeVisible();
    if (mobile) {
      expect(await hint.evaluate((element) => getComputedStyle(element).display)).toBe('none');
      expect(await metadata.evaluate((element) => getComputedStyle(element).justifyContent)).toBe('flex-end');
    } else {
      await expect(hint).toBeVisible();
      expect(await metadata.evaluate((element) => getComputedStyle(element).justifyContent))
        .toBe('space-between');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
      .toBe(0);
  });

  test('honors pointer, touch-origin Enter, and hardware keyboard focus policy', async ({ page }, testInfo) => {
    const composer = await startFakeAssistant(page, 'long-stream');
    await composer.fill('What does Jet write about agentic work?');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(composer).not.toBeFocused();
    await waitForCompletedResponse(page);
    await expect(composer).not.toBeFocused();

    await page.getByRole('button', { name: /New session|Start a new session/ }).click();
    await expect(composer).not.toBeFocused();

    if (testInfo.project.name === 'mobile-chromium') {
      const composerBox = await boxOf(composer);
      await page.touchscreen.tap(
        composerBox.x + composerBox.width / 2,
        composerBox.y + composerBox.height / 2,
      );
      await composer.fill('Summarize the recursive convergence hypothesis.');
      await composer.press('Enter');
      await expect(composer).not.toBeFocused();
      await waitForCompletedResponse(page);
      await expect(composer).not.toBeFocused();
    } else {
      await composer.focus();
      await composer.fill('Summarize the recursive convergence hypothesis.');
      await composer.press('Enter');
      await expect(composer).toBeFocused();
      await waitForCompletedResponse(page);
      await expect(composer).toBeFocused();
      const newSession = page.getByRole('button', { name: 'New session' });
      await newSession.focus();
      await newSession.press('Enter');
      await expect(composer).toBeFocused();
      await expect(composer).toHaveValue('');
    }
  });

  test('drives the exact six compact labels without percentages or hidden sizing content', async ({ page }) => {
    await installLifecycleLabelAudit(page);
    const composer = await startFakeAssistant(page, 'long-stream');
    await submitQuestion(page, 'What does Jet write about agentic work?');
    await expect(currentStatusLabel(page)).toHaveText('Responding');
    await waitForCompletedResponse(page);

    const labels = await page.evaluate(() => (
      window as typeof window & { __JETS_GHOST_LABELS__?: string[] }
    ).__JETS_GHOST_LABELS__ ?? []);
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
    const hiddenSizingContent = await status.locator('*').evaluateAll((elements) => (
      elements.filter((element) => {
        const style = getComputedStyle(element);
        return style.display === 'none' || style.visibility === 'hidden';
      }).map((element) => element.textContent?.trim())
    ));
    expect(hiddenSizingContent).toEqual([]);

    const actionGroup = page.getByTestId('jets-ghost-header-actions');
    expect(await actionGroup.locator(':scope > *').evaluateAll((elements) => (
      elements.map((element) => element.tagName)
    ))).toEqual(['BUTTON', 'BUTTON']);
    await expect(composer).toBeEnabled();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(fakePath('long-stream'));
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await page.getByRole('button', { name: /Load Jet's Ghost/ }).click();
    await expect(page.getByTestId('lifecycle-visual-label')).toHaveCount(1);
    await submitQuestion(page, 'What does Jet write about agentic work?');
    await expect(currentStatusLabel(page)).toHaveText('Responding');
    await expect(page.getByTestId('lifecycle-visual-label')).toHaveCount(1);
  });

  test('keeps identity status and actions uncrowded across the supported header widths', async ({ page }, testInfo) => {
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

      const header = page.locator('.jets-ghost-header');
      const identityGroup = header.locator(':scope > div').first();
      const identity = page.getByTestId('jets-ghost-identity');
      const metadata = identity.locator('p').nth(1);
      const version = metadata.locator('span').first();
      const licenses = metadata.getByRole('link', { name: /licenses/i });
      const status = page.getByTestId('lifecycle-visible-status');
      const actionGroup = page.getByTestId('jets-ghost-header-actions');
      const newSession = page.getByRole('button', { name: /New session|Start a new session/ });
      const unload = page.getByRole('button', { name: /Unload/ });
      const [headerBox, identityGroupBox, metadataBox, statusBox, actionBox, readyNewSessionBox, readyUnloadBox] = await Promise.all([
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
      await expectLifecycleLabelContained(page, 'Ready');
      expect(statusBox.x).toBeCloseTo(metadataBox.x, 0);
      expect(statusBox.y).toBeGreaterThanOrEqual(metadataBox.y + metadataBox.height);
      expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(headerBox.y + headerBox.height + 1);
      expect(identityGroupBox.x + identityGroupBox.width).toBeLessThanOrEqual(actionBox.x + 1);
      expect(await page.evaluate(() => (
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      ))).toBe(0);

      await composer.fill('What does Jet write about agentic work?');
      await page.getByRole('button', { name: 'Send message' }).click();
      await expectLifecycleLabelContained(page, 'Responding');
      const [respondingHeaderBox, respondingIdentityBox, respondingActionBox, respondingNewSessionBox, respondingUnloadBox] = await Promise.all([
        boxOf(header),
        boxOf(identityGroup),
        boxOf(actionGroup),
        boxOf(newSession),
        boxOf(unload),
      ]);
      expectStableBox(readyNewSessionBox, respondingNewSessionBox);
      expectStableBox(readyUnloadBox, respondingUnloadBox);
      expect(respondingIdentityBox.x + respondingIdentityBox.width)
        .toBeLessThanOrEqual(respondingActionBox.x + 1);
      expect(respondingActionBox.x + respondingActionBox.width)
        .toBeLessThanOrEqual(respondingHeaderBox.x + respondingHeaderBox.width + 1);
      expect(await page.evaluate(() => (
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      ))).toBe(0);
    }
  });

  test('contains every compact lifecycle label inside the status and header', async ({ page }, testInfo) => {
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
      await page.getByRole('button', { name: /Load Jet's Ghost/ }).click();
      await expectLifecycleLabelContained(page, 'Loading');

      const composer = await startFakeAssistant(page, 'long-stream');
      await expectLifecycleLabelContained(page, 'Ready');
      await composer.fill('What does Jet write about agentic work?');
      await page.getByRole('button', { name: 'Send message' }).click();
      await expectLifecycleLabelContained(page, 'Responding');
    }
  });

  test('keeps the Ghost mark proportional to the three-line identity stack', async ({ page }, testInfo) => {
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

      const identityGroup = page.locator('.jets-ghost-header > div').first();
      const icon = identityGroup.locator(':scope > span').first();
      const glyph = icon.locator('svg');
      const identity = page.getByTestId('jets-ghost-identity');
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
      expect(await page.evaluate(() => (
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      ))).toBe(0);
    }
  });
});

test.describe("Jet's Ghost loading hierarchy and activation recovery", () => {
  test('keeps the tablet-portrait dock clear of the Ghost header', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await startFakeAssistant(page);

    const dockBox = await boxOf(page.locator('#site-navigation-dock'));
    const headerBox = await boxOf(page.locator('.jets-ghost-header'));
    const boxesOverlap = !(
      dockBox.x + dockBox.width <= headerBox.x
      || dockBox.x >= headerBox.x + headerBox.width
      || dockBox.y + dockBox.height <= headerBox.y
      || dockBox.y >= headerBox.y + headerBox.height
    );

    expect(boxesOverlap).toBe(false);
  });

  test('keeps the complete dock inside a safe 320px viewport inset', async ({ page }) => {
    const viewportWidth = 320;
    const safeInset = 8;
    await page.setViewportSize({ width: viewportWidth, height: 800 });
    await page.goto(fakePath());

    const dockBox = await boxOf(page.locator('#site-navigation-dock'));
    expect(dockBox.x).toBeGreaterThanOrEqual(safeInset);
    expect(dockBox.x + dockBox.width).toBeLessThanOrEqual(viewportWidth - safeInset);
  });

  test('holds the exact long-loading hierarchy stable across time, motion, themes, and widths', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'One Chromium matrix covers the explicit viewport set.');
    await page.clock.install();
    await page.goto(fakePath('loading'));
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await page.getByRole('button', { name: /Load Jet's Ghost/ }).click();

    const stack = page.getByTestId('loading-stack');
    const elapsed = page.getByTestId('loading-elapsed');
    const reassurance = page.getByTestId('loading-reassurance-slot');
    const headline = stack.getByRole('heading');
    await expect(stack).toBeVisible();
    await expect(headline).toHaveText("Haunting Jet's archive");
    await expect(reassurance).toBeEmpty();
    await expect(page.getByRole('button', { name: 'Cancel and reload' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Unload/ })).toHaveCount(0);
    expect(await runtimeMethods(page)).toEqual(['checkCapabilities', 'repository.load', 'runtime.load']);

    await page.clock.runFor(12_000);
    await expect(headline).toHaveText('Waking the ghost');
    await page.clock.runFor(12_000);
    await expect(headline).toHaveText('Feeding it ones and zeroes');
    const boxesAt24 = new Map<string, Box>();
    const elapsedAt24 = Number((await elapsed.textContent())?.match(/\d+/)?.[0]);

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
    const elapsedAt36 = Number((await elapsed.textContent())?.match(/\d+/)?.[0]);
    expect(elapsedAt36).toBeGreaterThan(elapsedAt24);

    for (const [name, width, height] of viewports) {
      await page.setViewportSize({ width, height });
      expectStableBox(boxesAt24.get(name)!, await boxOf(stack));
      if (width >= 320) {
        const lineGeometry = await reassurance.evaluate((element) => {
          const style = getComputedStyle(element);
          return { height: element.getBoundingClientRect().height, lineHeight: Number.parseFloat(style.lineHeight) };
        });
        expect(lineGeometry.height).toBeLessThanOrEqual(lineGeometry.lineHeight + 1);
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
    expect(await stack.getByText("Haunting Jet's archive").getAttribute('aria-live')).toBeNull();
    await expect(page.getByTestId('loading-phase-visual')).not.toHaveAttribute('aria-live');

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

    const mainTranslation = await page.getByTestId('loading-main-ghost').evaluate((element) => {
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
    const reducedBefore = await animated.evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.transform}|${style.opacity}`;
    });
    await page.clock.runFor(500);
    const reducedAfter = await animated.evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.transform}|${style.opacity}`;
    });
    expect(reducedAfter).toBe(reducedBefore);

    await page.clock.runFor(5_000);
    const elapsedAfterForty = Number((await elapsed.textContent())?.match(/\d+/)?.[0]);
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
    expect(zoomedSlot.scrollHeight).toBeLessThanOrEqual(zoomedSlot.clientHeight + 1);
    expect(zoomedSlot.left).toBeGreaterThanOrEqual(0);
    expect(zoomedSlot.right).toBeLessThanOrEqual(320);
    await expect(stack.locator(
      '[role="progressbar"], [data-testid*="progress"], .loading-progress, .progress-track',
    )).toHaveCount(0);
  });

  test('Cancel and reload requests one document reload without entering runtime cleanup UI', async ({ page }) => {
    await page.goto(fakePath('loading'));
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await page.getByRole('button', { name: /Load Jet's Ghost/ }).click();
    await expect(page.getByTestId('loading-stack')).toBeVisible();
    const methodsBeforeReload = await runtimeMethods(page);
    let reloadAttempts = 0;
    await page.route('**/chatbot/**', async (route) => {
      if (route.request().resourceType() === 'document') {
        reloadAttempts += 1;
        await route.abort('aborted');
        return;
      }
      await route.continue();
    });
    await page.getByRole('button', { name: 'Cancel and reload' }).click().catch(() => undefined);
    await expect.poll(() => reloadAttempts).toBe(1);
    await expect(page.getByTestId('loading-stack')).toBeVisible();
    const methodsAfterReload = await runtimeMethods(page);
    expect(methodsAfterReload.slice(0, methodsBeforeReload.length)).toEqual(methodsBeforeReload);
    expect(methodsAfterReload).not.toEqual(expect.arrayContaining([
      'conversation.delete',
      'repository.unload',
      'engine.delete',
      'sdk.unload',
    ]));
    await expect(page.getByText('Releasing this device')).toHaveCount(0);
  });

  for (const mismatch of ['version', 'index'] as const) {
    test(`preserves the activation slot and recovers from a corpus ${mismatch} mismatch`, async ({ page, request }) => {
      await installCorpusMismatch(page, request, mismatch);
      for (const viewport of [
        { width: 320, height: 800 },
        { width: 430, height: 932 },
        { width: 1280, height: 800 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto(fakePath());
        await page.getByRole('button', { name: 'Check compatibility' }).click();
        const slot = page.getByTestId('activation-status-message');
        const activationMain = page.getByTestId('activation-main');
        const load = page.getByRole('button', { name: /Load Jet's Ghost/ });
        const readySlot = await boxOf(slot);
        const readyMain = await boxOf(activationMain);
        const readyAction = await boxOf(load);
        await load.click();

        const expected = mismatch === 'version'
          ? "Jet's Ghost found an incompatible knowledge-base version."
          : "Jet's Ghost found an incompatible search index.";
        await expect(slot).toHaveText(expected);
        await expect(page.getByText(expected)).toHaveCount(1);
        const returnToLoad = page.getByRole('button', { name: 'Return to load' });
        await expect(returnToLoad).toBeFocused();
        await expect(returnToLoad).toHaveAttribute('aria-describedby', 'jets-ghost-activation-status');
        await expect(page.locator('#jets-ghost-activation-status')).toHaveAttribute(
          'data-testid',
          'activation-status-message',
        );
        expectStableVerticalCenter(readySlot, await boxOf(slot));
        expectStableBox(readyMain, await boxOf(activationMain));
        expectStableVerticalCenter(readyAction, await boxOf(returnToLoad));

        await returnToLoad.press('Enter');
        await expect(page.getByRole('button', { name: /Load Jet's Ghost/ })).toBeFocused();
      }
    });
  }

  test('reports and recovers from a model load failure after consent', async ({ page }) => {
    await page.goto(fakePath('load-failure'));
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await page.getByRole('button', { name: /Load Jet's Ghost/ }).click();
    await expect(page.getByTestId('activation-status-message'))
      .toHaveText("Jet's Ghost could not load the local model.");
    const recovery = page.getByRole('button', { name: 'Return to load' });
    await expect(recovery).toBeFocused();
    await recovery.press('Enter');
    await expect(page.getByRole('button', { name: /Load Jet's Ghost/ })).toBeFocused();
  });

  test('keeps elapsed unloading time factual while deterministic cleanup is pending', async ({ page }) => {
    await page.clock.install();
    await startFakeAssistant(page, 'unloading');
    await submitQuestion(page, 'What does Jet write about agentic work?');
    await waitForCompletedResponse(page);
    await page.getByRole('button', { name: /Unload/ }).click();

    const stack = page.getByTestId('loading-stack');
    const elapsed = page.getByTestId('loading-elapsed');
    await expect(stack.getByText('Releasing this device')).toBeVisible();
    await expect(stack.getByRole('heading', { name: 'Letting the ghost rest' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel and reload' })).toHaveCount(0);
    const start = Number((await elapsed.textContent())?.match(/\d+/)?.[0]);
    await page.clock.runFor(2_000);
    const pending = Number((await elapsed.textContent())?.match(/\d+/)?.[0]);
    expect(pending).toBeGreaterThan(start);
    await expect(stack).toBeVisible();
    await page.clock.runFor(58_000);
    await expect(page.getByRole('button', { name: 'Check compatibility' })).toBeFocused();
    expect((await runtimeMethods(page)).slice(-4)).toEqual([
      'conversation.delete',
      'repository.unload',
      'engine.delete',
      'sdk.unload',
    ]);
  });
});

test.describe("Jet's Ghost responses, citations, and scrolling", () => {
  test('renders citation disclosure with responsive semantics and no overlay', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'One Chromium matrix covers the explicit viewport set.');
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
      await submitQuestion(page, LONG_SOURCE_TITLE);
      await waitForCompletedResponse(page);

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
      const region = page.getByRole('region', { name: 'Sources for this response' });
      await expect(region).toBeVisible();
      await expect(region.locator('ul')).toHaveCount(1);
      const source = region.getByRole('link', { name: `[S1] ${LONG_SOURCE_TITLE}`, exact: true });
      await expect(source).toHaveAttribute('href', /\/works\/recursive-convergence-hypothesis\/$/);
      await expect(source).toHaveAttribute('target', '_blank');
      await expect(source).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(source.getByText(LONG_SOURCE_TITLE, { exact: true })).toBeVisible();
      expect(await source.getByText(LONG_SOURCE_TITLE, { exact: true }).evaluate((element) => (
        element.scrollWidth <= element.clientWidth
      ))).toBe(true);

      const composer = page.locator('.jets-ghost-composer form');
      const dock = page.locator('#site-navigation-dock > div').first();
      const sourceBox = await boxOf(region);
      const composerBox = await boxOf(composer);
      expect(sourceBox.y + sourceBox.height).toBeLessThanOrEqual(composerBox.y + 1);
      if (await dock.isVisible()) {
        const dockBox = await boxOf(dock);
        expect(sourceBox.y + sourceBox.height <= dockBox.y || sourceBox.y >= dockBox.y + dockBox.height)
          .toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
        .toBe(0);
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

  test('deduplicates cited documents in first-citation order and keeps responses independent', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await startFakeAssistant(page, 'citations');
    await submitQuestion(page, `${LONG_SOURCE_TITLE} ${SOURCE_SENTINEL}`);
    await waitForCompletedResponse(page);

    const firstDisclosure = page.getByTestId('response-source-disclosure').first();
    const firstTrigger = firstDisclosure.getByRole('button', { name: '2 sources' });
    await expect(firstTrigger).toHaveAttribute('aria-expanded', 'false');
    await firstTrigger.click();
    const firstLinks = firstDisclosure.getByRole('link');
    await expect(firstLinks).toHaveCount(2);
    const firstHrefs = await firstLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(new Set(firstHrefs).size).toBe(2);
    await expect(firstLinks.first()).toHaveAccessibleName(`[S2] ${LONG_SOURCE_TITLE}`);
    expect(await firstDisclosure.textContent()).not.toContain(SOURCE_SENTINEL);

    await submitQuestion(page, 'What does Jet write about agentic work?');
    await waitForCompletedResponse(page);
    const disclosures = page.getByTestId('response-source-disclosure');
    await expect(disclosures).toHaveCount(2);
    await expect(disclosures.first().getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    await expect(disclosures.nth(1).getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  test('omits an empty source panel for a completed zero-citation response', async ({ page }) => {
    await startFakeAssistant(page, 'zero-citation');
    await expect(page.getByTestId('response-source-disclosure')).toHaveCount(0);
    await submitQuestion(page, 'What has Jet published?');
    await waitForCompletedResponse(page);
    await expect(page.getByTestId('response-source-disclosure')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /sources?$/ })).toHaveCount(0);
  });

  test('stops once, preserves the partial response, and completes one recovery response', async ({ page }) => {
    const composer = await startFakeAssistant(page, 'stop-recovery');
    await submitQuestion(page, 'What does Jet write about local-first AI?');
    await expect(composer).not.toBeFocused();
    await expect(page.getByText("Jet's published work connects local-first AI", { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Stop response' }).click();
    await expect(composer).not.toBeFocused();
    await expect(page.getByText('Stopped', { exact: true })).toHaveCount(1);
    const stoppedResponse = page.locator('[aria-label="Conversation"] article').filter({
      hasText: 'Stopped',
    });
    const stoppedInlineCitations = await stoppedResponse.getByRole('link', { name: /\[S\d+\]/ }).count();
    const stoppedDisclosures = stoppedResponse.getByTestId('response-source-disclosure');
    const expectedStoppedDisclosures = stoppedInlineCitations > 0 ? 1 : 0;
    // Stop may land on either side of the next streamed citation chunk under load.
    // The durable contract is that the disclosure mirrors validated inline citations.
    await expect(stoppedDisclosures).toHaveCount(expectedStoppedDisclosures);
    expect((await runtimeMethods(page)).filter((method) => method === 'cancel')).toHaveLength(1);

    await composer.fill('Summarize the recursive convergence hypothesis.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(composer).not.toBeFocused();
    await waitForCompletedResponse(page);
    await expect(composer).not.toBeFocused();
    await expect(page.getByText('Stopped', { exact: true })).toHaveCount(1);
    expect((await runtimeMethods(page)).filter((method) => method === 'generate')).toHaveLength(2);
    await expect(page.getByTestId('response-source-disclosure'))
      .toHaveCount(expectedStoppedDisclosures + 1);
  });

  test('stops sticky follow after manual scroll-away and restores it through Jump to latest', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 720 });
    const composer = await startFakeAssistant(page, 'long-stream');
    for (let index = 0; index < 4; index += 1) {
      await submitQuestion(page, `What does Jet write about agentic work? ${index}`);
      await waitForCompletedResponse(page);
    }
    await page.clock.install();
    await composer.fill('Summarize the recursive convergence hypothesis.');
    await composer.press('Enter');
    const scroller = page.getByTestId('conversation-scroller');
    await expect(currentStatusLabel(page)).toHaveText('Responding');
    const currentAssistant = scroller.locator('article').last();
    await page.clock.runFor(80);
    await expect(currentAssistant).toContainText('Reading the site locally…');
    await expect.poll(() => scroller.evaluate((element) => (
      element.scrollHeight - element.scrollTop - element.clientHeight
    ))).toBeLessThanOrEqual(48);
    const contentBeforeScroll = await currentAssistant.textContent();
    await scroller.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    const awayPosition = await scroller.evaluate((element) => element.scrollTop);
    await page.clock.runFor(160);
    await expect.poll(() => currentAssistant.textContent()).not.toBe(contentBeforeScroll);
    await expect(page.getByRole('button', { name: 'Jump to latest' })).toBeVisible();
    expect(await scroller.evaluate((element) => element.scrollTop)).toBe(awayPosition);

    const jump = page.getByRole('button', { name: 'Jump to latest' });
    await jump.focus();
    await jump.press('Enter');
    await page.clock.runFor(500);
    await expect(jump).toHaveCount(0);
    await expect(composer).not.toBeFocused();
    expect(await scroller.evaluate((element) => (
      element.scrollHeight - element.scrollTop - element.clientHeight
    ))).toBeLessThanOrEqual(48);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe("Jet's Ghost unsupported, failure, and exhaustion states", () => {
  test('shows no enabled composer when WebGPU is unsupported and permits a fresh check', async ({ page }) => {
    await page.goto(fakePath('unsupported'));
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await expect(page.getByRole('heading', { name: "This browser cannot run Jet's Ghost" })).toBeVisible();
    await expect(page.getByText("Jet's Ghost could not access a compatible GPU adapter.")).toBeVisible();
    await expect(page.getByRole('textbox', { name: "Ask Jet's Ghost" })).toHaveCount(0);
    const checkAgain = page.getByRole('button', { name: 'Check again' });
    await expect(checkAgain).toBeFocused();
    await checkAgain.press('Enter');
    await expect(page.getByRole('heading', { name: "This browser cannot run Jet's Ghost" })).toBeVisible();
    await expect(checkAgain).toBeFocused();
    expect(await runtimeMethods(page)).toEqual(['checkCapabilities', 'checkCapabilities']);
  });

  test('keeps the transcript and recovers after generation failure', async ({ page }) => {
    const composer = await startFakeAssistant(page, 'generation-failure');
    await submitQuestion(page, 'What does Jet write about agentic work?');
    await expect(page.getByText("Jet's Ghost could not complete the local response.")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try another question' })).toBeFocused();
    await expect(page.locator('[aria-label="Conversation"] article').getByText(
      'What does Jet write about agentic work?',
      { exact: true },
    )).toHaveCount(0);
    await expect(composer).toHaveValue('What does Jet write about agentic work?');

    await page.getByRole('button', { name: 'Try another question' }).press('Enter');
    await expect(composer).toBeFocused();
    await composer.fill('Summarize the recursive convergence hypothesis.');
    await composer.press('Enter');
    await waitForCompletedResponse(page);
    await expect(page.getByText('Summarize the recursive convergence hypothesis.', { exact: true })).toBeVisible();
  });

  test('preserves the complete transcript and avoids generation after exhaustion', async ({ page }) => {
    const composer = await startFakeAssistant(page, 'exhaustion');
    await submitQuestion(page, 'First supported question');
    await waitForCompletedResponse(page);
    const transcriptBefore = await page.locator('[aria-label="Conversation"] article').allTextContents();
    const callsBefore = await runtimeCalls(page);

    await composer.fill('Question that exceeds the deterministic fake conversation budget');
    await composer.press('Enter');
    await expect(page.getByText('The current session is full. Start a new session to continue.')).toBeVisible();
    const callsAfter = await runtimeCalls(page);
    expect(callsAfter.filter(({ method }) => ['conversation.create', 'generate'].includes(method)))
      .toEqual(callsBefore.filter(({ method }) => ['conversation.create', 'generate'].includes(method)));
    expect(await page.locator('[aria-label="Conversation"] article').allTextContents()).toEqual(transcriptBefore);

    const startNewSession = page.getByRole('button', { name: 'Start new session' });
    await startNewSession.focus();
    await startNewSession.press('Enter');
    await expect(composer).toBeFocused();
    await expect(composer).toBeEnabled();
    await expect(composer).toHaveValue('');
    await expect(page.locator('[aria-label="Conversation"] article')).toHaveCount(0);

    await page.goto(fakePath('exhaustion'));
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    await page.getByRole('button', { name: /Load Jet's Ghost/ }).click();
    const pointerComposer = page.getByRole('textbox', { name: "Ask Jet's Ghost" });
    await submitQuestion(page, 'First pointer question');
    await waitForCompletedResponse(page);
    await submitQuestion(page, 'Second pointer question');
    await expect(page.getByText('The current session is full. Start a new session to continue.')).toBeVisible();
    const pointerRecovery = page.getByRole('button', { name: 'Start new session' });
    await pointerRecovery.click();
    await expect(pointerComposer).toBeEnabled();
    await expect(pointerComposer).toHaveValue('');
    await expect(pointerComposer).not.toBeFocused();
  });

  for (const scenario of ['reset-failure', 'unload-failure'] as const) {
    test(`offers a keyboard recovery action for ${scenario}`, async ({ page }) => {
      await startFakeAssistant(page, scenario);
      if (scenario === 'reset-failure') {
        await page.getByRole('button', { name: /New session|Start a new session/ }).click();
        await expect(page.getByText("Jet's Ghost could not fully release the local model runtime."))
          .toBeVisible();
        const retry = page.getByRole('button', { name: 'Retry new session' });
        await expect(retry).toBeFocused();
        await retry.press('Enter');
        await expect(page.getByRole('textbox', { name: "Ask Jet's Ghost" })).toBeFocused();
      } else {
        await page.getByRole('button', { name: /Unload/ }).click();
        await expect(page.getByText("Jet's Ghost could not fully release the local model runtime."))
          .toBeVisible();
        const retry = page.getByRole('button', { name: 'Retry unload' });
        await expect(retry).toBeFocused();
        await retry.press('Enter');
        await expect(page.getByRole('button', { name: 'Check compatibility' })).toBeFocused();
      }
    });
  }
});

test.describe("Jet's Ghost ClientRouter cleanup", () => {
  async function navigateAwayThroughDock(page: Page): Promise<void> {
    const about = page.locator('#site-navigation-dock').getByRole('link', { name: 'About' });
    await about.click();
    await expect(page).toHaveURL(/\/about\/$/);
    await expect(page.getByRole('heading', { name: /About/i })).toBeVisible();
  }

  test('cleans a ready runtime in resource order once and returns with a fresh runtime', async ({ page }) => {
    await startFakeAssistant(page);
    await submitQuestion(page, 'What does Jet write about agentic work?');
    await waitForCompletedResponse(page);
    const initialRuntimeId = await runtimeId(page);
    expect(initialRuntimeId).toEqual(expect.any(Number));
    await navigateAwayThroughDock(page);

    const methods = await runtimeMethods(page);
    expect(methods.slice(-4)).toEqual([
      'conversation.delete',
      'repository.unload',
      'engine.delete',
      'sdk.unload',
    ]);
    for (const method of ['conversation.delete', 'repository.unload', 'engine.delete', 'sdk.unload']) {
      expect(methods.filter((candidate) => candidate === method), method).toHaveLength(1);
    }

    await page.locator('#site-navigation-dock').getByRole('link', { name: "Jet's Ghost" }).click();
    await expect(page).toHaveURL(/\/chatbot\/$/);
    const freshRuntimeId = await runtimeId(page);
    expect(freshRuntimeId).toEqual(expect.any(Number));
    expect(freshRuntimeId).not.toBe(initialRuntimeId);
    expect(await runtimeCalls(page)).toEqual([]);
    await page.getByRole('button', { name: 'Check compatibility' }).click();
    const freshCalls = await runtimeCalls(page);
    expect(freshCalls[0]?.runtimeId).toBe(freshRuntimeId);
    expect(freshCalls[0]?.operationId).toBe(1);
  });

  test('cancels streaming before cleanup and suppresses a deliberately late event', async ({ page }) => {
    await startFakeAssistant(page, 'late-event');
    await submitQuestion(page, 'What does Jet write about agentic work?');
    await expect(page.getByText("Jet's published work connects local-first AI", { exact: false })).toBeVisible();
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
    const cleanup = methods.slice(methods.indexOf('cancel'));
    expect(cleanup).toEqual(requiredCleanup);
    for (const method of requiredCleanup) {
      expect(methods.filter((candidate) => candidate === method), method).toHaveLength(1);
    }
    await expect(page.getByText('with systems thinking [S1].', { exact: false })).toHaveCount(0);
    await expect(page.getByTestId('lifecycle-visible-status')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /About/i })).toBeVisible();
  });
});
