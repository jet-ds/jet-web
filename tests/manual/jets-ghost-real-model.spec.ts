import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
  type Request,
} from '@playwright/test';
import {
  JETS_GHOST_MODEL,
  JETS_GHOST_PATHS,
} from '../../src/features/jets-ghost/config';
import { LITERT_LM_WASM_ASSETS } from '../../src/features/jets-ghost/runtime/liteRtAssets.server';
import {
  isTrustedModelOrigin,
  validateModelDeliveryChain,
  type ModelDeliveryHop,
} from '../../src/features/jets-ghost/runtime/modelDelivery';

interface ProductAcceptanceCase {
  id: string;
  category: 'supported' | 'ordinary' | 'cross-document' | 'unsupported';
  question: string;
  expectedSourceIds: string[];
  acceptableSourceIds: string[];
  requiredFacts: string[];
  forbiddenClaims: string[];
  mustAbstain: boolean;
}

interface RequestObservation {
  request: Request;
  startedAt: number;
  finishedAt?: number;
}

interface ActivationMeasurement {
  engineReadyMs: number;
  corpusMs: number;
  indexMs: number;
  modelMs: number;
  validationHydrationMs: number;
  corpusVersion: string;
  indexConfigVersion: string;
}

interface DeviceObservation {
  adapterIdentifiers: string[];
  deviceLossCount: number;
  deviceRequestCount: number;
  instrumentationFailed: boolean;
}

const REAL_MODEL_MODES = [
  'qualification',
  'smoke',
] as const;

const SMOKE_CASE_IDS = [
  'showcase-rch-claim',
  'unsupported-private-note',
] as const;

type RealModelMode = typeof REAL_MODEL_MODES[number];

const GHOST_PATH = '/chatbot/';
const ROUTE_AWAY_PATH = '/contact/';
const CORPUS_PATHS = [
  JETS_GHOST_PATHS.manifest,
  JETS_GHOST_PATHS.content,
  JETS_GHOST_PATHS.index,
] as const;
const EVIDENCE_DOCUMENT = join(process.cwd(), 'docs/verification/jets-ghost-2.1.0.md');
const CLOSEOUT_PROMPT_SENTINEL = 'JG_REAL_MODEL_PROMPT_SENTINEL_91d6c4';
const SELECTED_SOURCE_SENTINEL = 'works:recursive-convergence-hypothesis';
const PROFILE_ENVIRONMENT_KEYS = [
  'PLAYWRIGHT_USER_DATA_DIR',
  'CHROME_USER_DATA_DIR',
  'JETS_GHOST_USER_DATA_DIR',
  'PW_TEST_CONNECT_WS_ENDPOINT',
  'PW_TEST_REUSE_CONTEXT',
] as const;

const acceptanceCases = JSON.parse(readFileSync(
  new URL('../fixtures/jets-ghost/product-acceptance.json', import.meta.url),
  'utf8',
)) as ProductAcceptanceCase[];

function resolveMode(): RealModelMode {
  const value = process.env.JETS_GHOST_REAL_MODEL_MODE;
  if (!REAL_MODEL_MODES.includes(value as RealModelMode)) {
    throw new Error('UNKNOWN_REAL_MODEL_MODE');
  }
  return value as RealModelMode;
}

function rejectExternalProfile(): void {
  if (
    PROFILE_ENVIRONMENT_KEYS.some((key) => process.env[key] !== undefined)
    || process.argv.some((argument) => argument.startsWith('--user-data-dir'))
  ) {
    throw new Error('EXTERNAL_BROWSER_PROFILE_NOT_ALLOWED');
  }
}

function requireEvidenceDocument(): void {
  if (!existsSync(EVIDENCE_DOCUMENT)) {
    throw new Error('QUALIFICATION_EVIDENCE_DOCUMENT_MISSING');
  }
}

function contentFreeAssert(condition: boolean, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function roundMilliseconds(value: number): number {
  return Math.max(0, Math.round(value));
}

function sanitizeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  return value.replace(/[^a-z0-9 ._():+-]/giu, '').slice(0, 120);
}

function macOsVersion(): string {
  return sanitizeIdentifier(execFileSync(
    '/usr/bin/sw_vers',
    ['-productVersion'],
    { encoding: 'utf8' },
  ).trim()) ?? 'unavailable';
}

function assistantResourceRequest(request: Request, applicationOrigin: string): boolean {
  const url = new URL(request.url());
  return (
    url.origin === applicationOrigin
    && (
      CORPUS_PATHS.includes(url.pathname as typeof CORPUS_PATHS[number])
      || url.pathname.startsWith(JETS_GHOST_PATHS.liteRtWasm)
    )
  ) || isTrustedModelOrigin(url.href, JETS_GHOST_MODEL.trustedOrigins);
}

class RequestLedger {
  readonly observations: RequestObservation[] = [];
  private readonly byRequest = new WeakMap<Request, RequestObservation>();

  constructor(page: Page) {
    page.on('request', (request) => {
      const observation = { request, startedAt: performance.now() };
      this.observations.push(observation);
      this.byRequest.set(request, observation);
    });
    const finish = (request: Request) => {
      const observation = this.byRequest.get(request);
      if (observation !== undefined) observation.finishedAt = performance.now();
    };
    page.on('requestfinished', finish);
    page.on('requestfailed', finish);
  }

  mark(): number {
    return this.observations.length;
  }

  since(mark: number): RequestObservation[] {
    return this.observations.slice(mark);
  }

  observationFor(request: Request): RequestObservation | undefined {
    return this.byRequest.get(request);
  }
}

async function installDeviceObservation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type ObservationWindow = typeof window & {
      __JG_DEVICE_OBSERVATION__?: DeviceObservation;
    };
    const state: DeviceObservation = {
      adapterIdentifiers: [],
      deviceLossCount: 0,
      deviceRequestCount: 0,
      instrumentationFailed: false,
    };
    (window as ObservationWindow).__JG_DEVICE_OBSERVATION__ = state;

    const gpu = navigator.gpu;
    if (gpu === undefined) return;
    const requestAdapter = gpu.requestAdapter.bind(gpu);

    try {
      Object.defineProperty(gpu, 'requestAdapter', {
        configurable: true,
        value: async (...args: Parameters<GPU['requestAdapter']>) => {
          const adapter = await requestAdapter(...args);
          if (adapter === null) return null;

          const exposedInfo = adapter.info as GPUAdapterInfo & Record<string, unknown>;
          state.adapterIdentifiers = [
            exposedInfo.vendor,
            exposedInfo.architecture,
            exposedInfo.device,
            exposedInfo.description,
          ].filter((value): value is string => typeof value === 'string' && value !== '');

          const requestDevice = adapter.requestDevice.bind(adapter);
          Object.defineProperty(adapter, 'requestDevice', {
            configurable: true,
            value: async (...deviceArgs: Parameters<GPUAdapter['requestDevice']>) => {
              state.deviceRequestCount += 1;
              const device = await requestDevice(...deviceArgs);
              void device.lost.then(() => {
                state.deviceLossCount += 1;
              });
              return device;
            },
          });
          return adapter;
        },
      });
    } catch {
      state.instrumentationFailed = true;
    }
  });
}

async function deviceObservation(page: Page): Promise<DeviceObservation> {
  return page.evaluate(() => (
    window as typeof window & { __JG_DEVICE_OBSERVATION__?: DeviceObservation }
  ).__JG_DEVICE_OBSERVATION__ ?? {
    adapterIdentifiers: [],
    deviceLossCount: 0,
    deviceRequestCount: 0,
    instrumentationFailed: true,
  });
}

async function assertFreshApplicationStorage(page: Page): Promise<void> {
  const state = await page.evaluate(async () => {
    const cacheKeys = 'caches' in window ? await window.caches.keys() : [];
    const databases = typeof indexedDB.databases === 'function'
      ? await indexedDB.databases()
      : [];
    const registrations = 'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistrations()
      : [];
    return {
      cacheKeys,
      databaseNames: databases.map(({ name }) => name ?? ''),
      localStorageKeys: Object.keys(localStorage),
      serviceWorkerScopes: registrations.map(({ scope }) => scope),
    };
  });
  const applicationStatePattern = /jets?-?ghost|assistant|litert|gemma/iu;

  contentFreeAssert(
    Object.values(state).flat().every((value) => !applicationStatePattern.test(value)),
    'COLD_PROFILE_CONTAINS_APPLICATION_STATE',
  );
}

async function boxOf(locator: Locator): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  const box = await locator.boundingBox();
  contentFreeAssert(box !== null, 'LOADING_STACK_GEOMETRY_UNAVAILABLE');
  return box;
}

function boxesAreStable(
  before: { x: number; y: number; width: number; height: number },
  after: { x: number; y: number; width: number; height: number },
): boolean {
  return (['x', 'y', 'width', 'height'] as const).every((key) => (
    Math.abs(before[key] - after[key]) <= 1
  ));
}

async function motionSnapshot(page: Page): Promise<string[]> {
  return page.locator(
    '[data-testid="loading-ghost-afterimage"], [data-testid="loading-inward-particle"]',
  ).evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return `${style.transform}|${style.opacity}`;
  }));
}

async function assertLoadingSurface(page: Page): Promise<void> {
  const stack = page.getByTestId('loading-stack');
  await expect(stack).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel and reload' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Unload/ })).toHaveCount(0);
  await expect(page.locator(
    '[role="progressbar"], progress, [data-testid*="progress"], .loading-progress, .progress-track',
  )).toHaveCount(0);
  await expect(page.getByTestId('loading-phase-visual')).not.toHaveAttribute('aria-live');
  await expect(page.getByTestId('lifecycle-announcement')).toHaveAttribute('role', 'status');
  expect(await stack.getByRole('heading').getAttribute('aria-live')).toBeNull();
}

async function observeColdLoading(page: Page, activationStartedAt: number): Promise<void> {
  await assertLoadingSurface(page);
  const stack = page.getByTestId('loading-stack');
  const elapsed = page.getByTestId('loading-elapsed');
  const headline = stack.getByRole('heading');
  const reassurance = page.getByTestId('loading-reassurance-slot');
  const initialBox = await boxOf(stack);
  let previousElapsed = Number((await elapsed.textContent())?.match(/\d+/u)?.[0] ?? '0');
  let previousHeadline = await headline.textContent();
  let boundary = 12_000;

  while (!await page.getByRole('textbox', { name: "Ask Jet's Ghost" }).isVisible()) {
    const remaining = Math.max(0, activationStartedAt + boundary - performance.now());
    const readyBeforeBoundary = await Promise.race([
      page.getByRole('textbox', { name: "Ask Jet's Ghost" })
        .waitFor({ state: 'visible' })
        .then(() => true),
      page.waitForTimeout(remaining).then(() => false),
    ]);
    if (readyBeforeBoundary) break;

    await assertLoadingSurface(page);
    const currentElapsed = Number((await elapsed.textContent())?.match(/\d+/u)?.[0] ?? '0');
    const currentHeadline = await headline.textContent();
    contentFreeAssert(currentElapsed > previousElapsed, 'LOADING_ELAPSED_NOT_MONOTONIC');
    contentFreeAssert(currentHeadline !== previousHeadline, 'LOADING_HEADLINE_NOT_CYCLING');

    const reducedMotion = await page.evaluate(() => (
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ));
    if (!reducedMotion) {
      const beforeMotion = await motionSnapshot(page);
      await page.waitForTimeout(400);
      const afterMotion = await motionSnapshot(page);
      contentFreeAssert(
        beforeMotion.some((value, index) => value !== afterMotion[index]),
        'LOADING_PHASE_MOTION_NOT_CHANGING',
      );
    }

    if (boundary >= 36_000) {
      await expect(reassurance).toHaveText('First load may take a few minutes.');
      contentFreeAssert(
        boxesAreStable(initialBox, await boxOf(stack)),
        'LOADING_STACK_GEOMETRY_MOVED',
      );
    }

    previousElapsed = currentElapsed;
    previousHeadline = currentHeadline;
    boundary += 12_000;
  }
}

function observationForPath(
  observations: RequestObservation[],
  origin: string,
  path: string,
): RequestObservation {
  const observation = observations.find(({ request }) => {
    const url = new URL(request.url());
    return url.origin === origin && url.pathname === path;
  });
  contentFreeAssert(observation !== undefined, 'ACTIVATION_REQUEST_MISSING');
  contentFreeAssert(observation.finishedAt !== undefined, 'ACTIVATION_REQUEST_INCOMPLETE');
  return observation;
}

function requestDuration(observation: RequestObservation): number {
  contentFreeAssert(observation.finishedAt !== undefined, 'REQUEST_TIMING_INCOMPLETE');
  return roundMilliseconds(observation.finishedAt - observation.startedAt);
}

function terminalRedirectRequest(request: Request): Request {
  let terminal = request;
  while (terminal.redirectedTo() !== null) terminal = terminal.redirectedTo()!;
  return terminal;
}

function modelTransferWindow(
  observations: RequestObservation[],
  ledger: RequestLedger,
): { modelTransferStartedAt: number; modelTransferFinishedAt: number } {
  const modelRoots = observations.filter(({ request }) => (
    request.url() === JETS_GHOST_MODEL.url && request.redirectedFrom() === null
  ));
  contentFreeAssert(modelRoots.length > 0, 'MODEL_REQUEST_MISSING');
  const modelTerminals = modelRoots.map(({ request }) => {
    const terminalObservation = ledger.observationFor(terminalRedirectRequest(request));
    contentFreeAssert(terminalObservation?.finishedAt !== undefined, 'MODEL_TRANSFER_INCOMPLETE');
    return terminalObservation;
  });

  return {
    modelTransferStartedAt: Math.min(...modelRoots.map(({ startedAt }) => startedAt)),
    modelTransferFinishedAt: Math.max(...modelTerminals.map(({ finishedAt }) => finishedAt!)),
  };
}

async function activationMeasurement(
  page: Page,
  ledger: RequestLedger,
  options: { sampleLoading: boolean },
): Promise<ActivationMeasurement> {
  const mark = ledger.mark();
  const startedAt = performance.now();
  await page.getByRole('button', { name: /Load Jet's Ghost/ }).click();
  if (options.sampleLoading) await observeColdLoading(page, startedAt);
  const composer = page.getByRole('textbox', { name: "Ask Jet's Ghost" });
  await expect(composer).toBeEnabled();
  await expect(page.getByTestId('lifecycle-visible-status')).toContainText('Ready');
  const readyAt = performance.now();
  const observations = ledger.since(mark);
  const origin = new URL(page.url()).origin;
  const manifestObservation = observationForPath(
    observations,
    origin,
    JETS_GHOST_PATHS.manifest,
  );
  const contentObservation = observationForPath(
    observations,
    origin,
    JETS_GHOST_PATHS.content,
  );
  const indexObservation = observationForPath(
    observations,
    origin,
    JETS_GHOST_PATHS.index,
  );
  const {
    modelTransferStartedAt,
    modelTransferFinishedAt,
  } = modelTransferWindow(observations, ledger);
  contentFreeAssert(readyAt >= modelTransferFinishedAt, 'MODEL_TRANSFER_FINISHED_AFTER_READY');
  const manifestResponse = await manifestObservation.request.response();
  contentFreeAssert(manifestResponse !== null, 'CORPUS_MANIFEST_RESPONSE_MISSING');
  const manifest = await manifestResponse.json() as Record<string, unknown>;
  contentFreeAssert(typeof manifest.corpusVersion === 'string', 'CORPUS_VERSION_MISSING');
  contentFreeAssert(typeof manifest.indexConfigVersion === 'string', 'INDEX_VERSION_MISSING');

  return {
    engineReadyMs: roundMilliseconds(readyAt - startedAt),
    corpusMs: requestDuration(contentObservation),
    indexMs: requestDuration(indexObservation),
    modelMs: roundMilliseconds(modelTransferFinishedAt - modelTransferStartedAt),
    validationHydrationMs: roundMilliseconds(readyAt - modelTransferFinishedAt),
    corpusVersion: manifest.corpusVersion,
    indexConfigVersion: manifest.indexConfigVersion,
  };
}

function printActivation(label: 'cold' | 'warm', measurement: ActivationMeasurement): void {
  console.info([
    label,
    `engine-ready-ms=${measurement.engineReadyMs}`,
    `model-ms=${measurement.modelMs}`,
    `corpus-ms=${measurement.corpusMs}`,
    `index-ms=${measurement.indexMs}`,
    `validation/hydration-ms=${measurement.validationHydrationMs}`,
    `corpus-version=${measurement.corpusVersion}`,
    `index-config-version=${measurement.indexConfigVersion}`,
    `runtime-config-version=${JETS_GHOST_MODEL.packageVersion}`,
  ].join(' '));
}

async function newSession(page: Page): Promise<void> {
  await page.getByRole('button', { name: /New session|Start a new session/ }).click();
  const composer = page.getByRole('textbox', { name: "Ask Jet's Ghost" });
  await expect(composer).toBeEnabled();
  await expect(composer).toHaveValue('');
  await expect(page.getByTestId('conversation-scroller')).toHaveCount(0);
}

function sourcePath(sourceId: string): string {
  const separator = sourceId.indexOf(':');
  return `/${sourceId.slice(0, separator)}/${sourceId.slice(separator + 1)}/`;
}

async function responseHasFirstToken(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const articles = document.querySelectorAll('[data-testid="conversation-scroller"] article');
    if (articles.length < 2) return false;
    const response = articles.item(articles.length - 1).textContent?.trim() ?? '';
    return response !== '' && !response.includes('Reading the site locally');
  });
}

async function responseAbstains(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const articles = document.querySelectorAll('[data-testid="conversation-scroller"] article');
    const response = articles.item(articles.length - 1).textContent ?? '';
    return /(?:cannot|can't|do not have|don't have|do not know|don't know|no access|not available|not in|unable)/iu
      .test(response);
  });
}

async function runProductCase(
  page: Page,
  acceptanceCase: ProductAcceptanceCase,
): Promise<string[]> {
  const caseFailures: string[] = [];
  await newSession(page);
  const startedAt = performance.now();
  const composer = page.getByRole('textbox', { name: "Ask Jet's Ghost" });
  await composer.fill(acceptanceCase.question);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(() => responseHasFirstToken(page)).toBe(true);
  const firstTokenMs = roundMilliseconds(performance.now() - startedAt);
  await expect(page.getByTestId('lifecycle-visible-status')).toContainText('Ready');
  const totalResponseMs = roundMilliseconds(performance.now() - startedAt);

  try {
    const inlineCitations = page
      .getByTestId('conversation-scroller')
      .getByRole('link', { name: /^\[S\d+\]/u });
    const disclosure = page.getByTestId('response-source-disclosure');
    const observedSourcePaths: string[] = [];
    if (await disclosure.count() > 0) {
      await disclosure.getByRole('button', { name: /sources?$/u }).click();
      const sourceLinks = disclosure.getByRole('region', { name: 'Sources for this response' })
        .getByRole('link');
      for (let index = 0; index < await sourceLinks.count(); index += 1) {
        const link = sourceLinks.nth(index);
        const href = await link.getAttribute('href');
        contentFreeAssert(href !== null, 'SOURCE_LINK_TARGET_MISSING');
        observedSourcePaths.push(new URL(href, page.url()).pathname);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      }
    }

    const expectedPaths = acceptanceCase.expectedSourceIds.map(sourcePath);
    const acceptablePaths = acceptanceCase.acceptableSourceIds.map(sourcePath);
    const citationResolved = acceptanceCase.mustAbstain
      ? await inlineCitations.count() === 0 && observedSourcePaths.length === 0
      : expectedPaths.every((path) => observedSourcePaths.includes(path))
        && observedSourcePaths.every((path) => acceptablePaths.includes(path))
        && await inlineCitations.count() > 0;
    const abstention = await responseAbstains(page);

    if (!citationResolved) caseFailures.push('CASE_CITATION_BOUNDARY_FAILED');
    if (acceptanceCase.mustAbstain) {
      if (!abstention) caseFailures.push('CASE_ABSTENTION_MISSING');
    }

    console.info([
      `case=${acceptanceCase.id}`,
      `first-token-ms=${firstTokenMs}`,
      `total-response-ms=${totalResponseMs}`,
      `citation-resolved=${citationResolved}`,
      `abstention=${abstention}`,
    ].join(' '));
  } finally {
    await page.pause();
  }
  return caseFailures;
}

async function unloadAndAssertSettled(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Unload/ }).click();
  await expect(page.getByRole('button', { name: 'Check compatibility' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: "Ask Jet's Ghost" })).toHaveCount(0);
  await expect(page.getByTestId('conversation-scroller')).toHaveCount(0);
}

async function assertCompatibilityDoesNotLoadAssistant(
  page: Page,
  ledger: RequestLedger,
  applicationOrigin: string,
): Promise<void> {
  const compatibilityMark = ledger.mark();
  await page.getByRole('button', { name: 'Check compatibility' }).click();
  await expect(page.getByRole('button', { name: /Load Jet's Ghost/ })).toBeVisible();
  contentFreeAssert(
    ledger.since(compatibilityMark).every(({ request }) => (
      !assistantResourceRequest(request, applicationOrigin)
    )),
    'ASSISTANT_REQUEST_BEFORE_LOAD',
  );
}

async function activateWithoutBenchmark(
  page: Page,
  ledger: RequestLedger,
  applicationOrigin: string,
): Promise<void> {
  await assertCompatibilityDoesNotLoadAssistant(page, ledger, applicationOrigin);
  await page.getByRole('button', { name: /Load Jet's Ghost/ }).click();
  await expect(page.getByRole('textbox', { name: "Ask Jet's Ghost" })).toBeEnabled();
  await expect(page.getByTestId('lifecycle-visible-status')).toContainText('Ready');
}

async function qualificationCloseout(
  page: Page,
  ledger: RequestLedger,
  applicationOrigin: string,
): Promise<void> {
  await newSession(page);
  const composer = page.getByRole('textbox', { name: "Ask Jet's Ghost" });
  await composer.fill(CLOSEOUT_PROMPT_SENTINEL);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('button', { name: 'Stop response' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop response' }).click();
  await expect(page.getByText('Stopped', { exact: true })).toBeVisible();
  await expect(page.getByTestId('lifecycle-visible-status')).toContainText('Ready');
  await newSession(page);
  await unloadAndAssertSettled(page);

  await activateWithoutBenchmark(page, ledger, applicationOrigin);
  const contact = page.locator('#site-navigation-dock').getByRole('link', { name: 'Contact' });
  await contact.click();
  await expect(page).toHaveURL(new RegExp(`${ROUTE_AWAY_PATH}$`, 'u'));
  await expect(page.getByTestId('lifecycle-visible-status')).toHaveCount(0);
  await page.locator('#site-navigation-dock').getByRole('link', { name: "Jet's Ghost" }).click();
  await expect(page).toHaveURL(new RegExp(`${GHOST_PATH}$`, 'u'));
  await expect(page.getByRole('button', { name: 'Check compatibility' })).toBeVisible();
  await activateWithoutBenchmark(page, ledger, applicationOrigin);
  await unloadAndAssertSettled(page);
}

function hasApplicationDefinedHeader(headers: Record<string, string>): boolean {
  return Object.keys(headers).some((rawName) => {
    const name = rawName.toLowerCase();
    return /^(?:authorization|proxy-authorization|api[-_]?key|apikey|x-)/u.test(name);
  });
}

function isAnalyticsRequest(url: URL): boolean {
  if (url.protocol !== 'https:' || url.port !== '') return false;
  if (url.origin === 'https://www.googletagmanager.com') {
    return url.pathname === '/gtag/js';
  }
  return [
    'https://www.google-analytics.com',
    'https://analytics.google.com',
    'https://region1.google-analytics.com',
  ].includes(url.origin) && /^\/(?:g\/)?collect$/u.test(url.pathname);
}

function isPartytownTransport(url: URL, applicationOrigin: string): boolean {
  return url.origin === applicationOrigin
    && url.pathname === '/~partytown/proxytown'
    && url.search === '';
}

function validateAnalyticsRequest(
  request: Request,
  url: URL,
  headers: Record<string, string>,
  body: string | null,
): void {
  const tagScript = url.origin === 'https://www.googletagmanager.com';
  contentFreeAssert(
    tagScript ? request.method() === 'GET' : ['GET', 'POST'].includes(request.method()),
    'ANALYTICS_METHOD_FORBIDDEN',
  );
  if (tagScript || request.method() === 'GET') {
    contentFreeAssert(body === null, 'ANALYTICS_BODY_FORBIDDEN');
  }
  contentFreeAssert(!hasApplicationDefinedHeader(headers), 'ANALYTICS_HEADER_FORBIDDEN');
  contentFreeAssert(headers.authorization === undefined, 'ANALYTICS_AUTHORIZATION_FORBIDDEN');
}

function validatePartytownTransport(
  request: Request,
  headers: Record<string, string>,
  body: string | null,
): void {
  contentFreeAssert(request.method() === 'POST', 'PARTYTOWN_TRANSPORT_METHOD_FORBIDDEN');
  contentFreeAssert(body !== null, 'PARTYTOWN_TRANSPORT_BODY_MISSING');
  contentFreeAssert(
    headers['content-type']?.startsWith('text/plain') === true,
    'PARTYTOWN_TRANSPORT_CONTENT_TYPE_INVALID',
  );
  contentFreeAssert(!hasApplicationDefinedHeader(headers), 'PARTYTOWN_TRANSPORT_HEADER_FORBIDDEN');
  contentFreeAssert(headers.authorization === undefined, 'PARTYTOWN_TRANSPORT_AUTHORIZATION_FORBIDDEN');

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error('PARTYTOWN_TRANSPORT_SCHEMA_INVALID');
  }
  const record = payload as { F?: unknown; Q?: unknown };
  contentFreeAssert(
    typeof record.F === 'string'
      && Array.isArray(record.Q)
      && Object.keys(record).every((key) => key === 'F' || key === 'Q'),
    'PARTYTOWN_TRANSPORT_SCHEMA_INVALID',
  );
}

function decodedRequestValue(value: string): string {
  let decoded = value.replace(/\+/gu, ' ');
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

async function modelDeliveryHop(request: Request): Promise<ModelDeliveryHop> {
  const headers = await request.allHeaders();
  const response = await request.response();
  contentFreeAssert(response !== null, 'MODEL_RESPONSE_MISSING');
  const responseHeaders = await response.allHeaders();
  const location = responseHeaders.location ?? request.redirectedTo()?.url();
  return {
    request: {
      url: request.url(),
      method: request.method(),
      headers: headers.range === undefined ? undefined : { range: headers.range },
      body: request.postData() ?? undefined,
    },
    response: {
      status: response.status(),
      ...(location === undefined ? {} : { location }),
    },
  };
}

async function validateModelChains(observations: RequestObservation[]): Promise<void> {
  const requests = observations.map(({ request }) => request);
  const modelRequests = requests.filter((request) => (
    isTrustedModelOrigin(request.url(), JETS_GHOST_MODEL.trustedOrigins)
  ));
  const roots = modelRequests.filter((request) => request.redirectedFrom() === null);
  contentFreeAssert(roots.length > 0, 'MODEL_CHAIN_MISSING');

  for (const request of modelRequests) {
    let root = request;
    while (root.redirectedFrom() !== null) root = root.redirectedFrom()!;
    contentFreeAssert(root.url() === JETS_GHOST_MODEL.url, 'MODEL_CHAIN_ROOT_CHANGED');
  }

  for (const root of roots) {
    const chain: ModelDeliveryHop[] = [];
    let request: Request | null = root;
    while (request !== null) {
      chain.push(await modelDeliveryHop(request));
      request = request.redirectedTo();
    }
    const validation = validateModelDeliveryChain(chain, JETS_GHOST_MODEL);
    contentFreeAssert(
      validation.valid,
      `MODEL_DELIVERY_${validation.failures.map(({ ruleCode }) => ruleCode).join('_')}`,
    );
    contentFreeAssert(
      validation.redirectDepth <= JETS_GHOST_MODEL.maxRedirects,
      'MODEL_REDIRECT_LIMIT_EXCEEDED',
    );
  }
}

async function validateRequestPrivacy(
  ledger: RequestLedger,
  applicationOrigin: string,
): Promise<void> {
  const sentinels = [
    CLOSEOUT_PROMPT_SENTINEL,
    SELECTED_SOURCE_SENTINEL,
    ...acceptanceCases.flatMap(({ question, acceptableSourceIds }) => [
      question,
      ...acceptableSourceIds,
    ]),
  ];
  const runtimeAssets = new Set<string>(LITERT_LM_WASM_ASSETS);

  for (const { request } of ledger.observations) {
    const url = new URL(request.url());
    const headers = await request.allHeaders();
    const body = request.postData();
    const requestValues = [
      url.href,
      url.pathname,
      url.search,
      ...url.searchParams.values(),
      body ?? '',
      ...Object.entries(headers).flat(),
    ];
    const serializedRequest = requestValues
      .flatMap((value) => [value, decodedRequestValue(value)])
      .join('\n');
    contentFreeAssert(
      sentinels.every((sentinel) => !serializedRequest.includes(sentinel)),
      'CONVERSATION_DATA_IN_REQUEST',
    );
    contentFreeAssert(url.hostname !== 'cdn.jsdelivr.net', 'SDK_CDN_REQUEST_FORBIDDEN');

    const sameOrigin = url.origin === applicationOrigin;
    const corpus = sameOrigin
      && CORPUS_PATHS.includes(url.pathname as typeof CORPUS_PATHS[number]);
    const applicationChunk = sameOrigin && url.pathname.startsWith('/_astro/');
    const runtimeFilename = sameOrigin && url.pathname.startsWith(JETS_GHOST_PATHS.liteRtWasm)
      ? url.pathname.slice(JETS_GHOST_PATHS.liteRtWasm.length)
      : undefined;
    const runtimeAsset = runtimeFilename !== undefined
      && !runtimeFilename.includes('/')
      && runtimeAssets.has(runtimeFilename);
    const documentRequest = sameOrigin
      && [GHOST_PATH, ROUTE_AWAY_PATH].includes(url.pathname);
    const model = isTrustedModelOrigin(url.href, JETS_GHOST_MODEL.trustedOrigins);
    const analytics = isAnalyticsRequest(url);
    const partytownTransport = isPartytownTransport(url, applicationOrigin);

    contentFreeAssert(
      corpus
        || applicationChunk
        || runtimeAsset
        || documentRequest
        || model
        || analytics
        || partytownTransport,
      'NONALLOWLISTED_REQUEST',
    );
    if (analytics) {
      validateAnalyticsRequest(request, url, headers, body);
    } else if (partytownTransport) {
      validatePartytownTransport(request, headers, body);
    } else {
      contentFreeAssert(
        request.method() === 'GET' || (model && request.method() === 'HEAD'),
        'REQUEST_METHOD_FORBIDDEN',
      );
      contentFreeAssert(body === null, 'REQUEST_BODY_FORBIDDEN');
      contentFreeAssert(!hasApplicationDefinedHeader(headers), 'CUSTOM_HEADER_FORBIDDEN');
    }
    if (corpus || applicationChunk || runtimeAsset || documentRequest) {
      contentFreeAssert(url.search === '', 'VARIABLE_APPLICATION_REQUEST_FORBIDDEN');
    }
    if (corpus || model) {
      contentFreeAssert(headers.cookie === undefined, 'ASSISTANT_COOKIE_FORBIDDEN');
      contentFreeAssert(headers.authorization === undefined, 'ASSISTANT_AUTHORIZATION_FORBIDDEN');
    }
  }

  await validateModelChains(ledger.observations);
}

async function printSmokeVersions(
  ledger: RequestLedger,
  mark: number,
  applicationOrigin: string,
): Promise<void> {
  const manifestObservation = observationForPath(
    ledger.since(mark),
    applicationOrigin,
    JETS_GHOST_PATHS.manifest,
  );
  const response = await manifestObservation.request.response();
  contentFreeAssert(response !== null, 'CORPUS_MANIFEST_RESPONSE_MISSING');
  const manifest = await response.json() as Record<string, unknown>;
  contentFreeAssert(typeof manifest.corpusVersion === 'string', 'CORPUS_VERSION_MISSING');
  contentFreeAssert(typeof manifest.indexConfigVersion === 'string', 'INDEX_VERSION_MISSING');
  console.info([
    `corpus-version=${manifest.corpusVersion}`,
    `index-config-version=${manifest.indexConfigVersion}`,
    `runtime-config-version=${JETS_GHOST_MODEL.packageVersion}`,
  ].join(' '));
}

async function printEnvironment(browser: Browser, page: Page, mode: RealModelMode): Promise<void> {
  const device = await deviceObservation(page);
  contentFreeAssert(!device.instrumentationFailed, 'WEBGPU_INSTRUMENTATION_FAILED');
  contentFreeAssert(device.deviceRequestCount > 0, 'WEBGPU_DEVICE_REQUEST_NOT_OBSERVED');
  const adapters = device.adapterIdentifiers
    .map(sanitizeIdentifier)
    .filter((value): value is string => value !== undefined);
  console.info([
    `mode=${mode}`,
    `browser=${sanitizeIdentifier(browser.version()) ?? 'unavailable'}`,
    `macos=${macOsVersion()}`,
    `adapter=${adapters.join(',') || 'unavailable'}`,
  ].join(' '));
}

test.skip(process.env.RUN_REAL_MODEL !== '1', 'Set RUN_REAL_MODEL=1 for the 2 GB WebGPU qualification');

test("qualifies Jet's Ghost with the real local model", async ({ browser, page }) => {
  const mode = resolveMode();
  rejectExternalProfile();
  requireEvidenceDocument();
  if (mode === 'qualification' && (process.platform !== 'darwin' || process.arch !== 'arm64')) {
    throw new Error('QUALIFICATION_REQUIRES_APPLE_SILICON_MAC');
  }

  await installDeviceObservation(page);
  await page.goto(GHOST_PATH);
  await assertFreshApplicationStorage(page);
  const applicationOrigin = new URL(page.url()).origin;
  const ledger = new RequestLedger(page);
  const productCaseFailures: string[] = [];
  await assertCompatibilityDoesNotLoadAssistant(page, ledger, applicationOrigin);

  if (mode === 'qualification') {
    console.info('phase=cold-activation');
    const cold = await activationMeasurement(page, ledger, { sampleLoading: true });
    printActivation('cold', cold);
    await unloadAndAssertSettled(page);
    await assertCompatibilityDoesNotLoadAssistant(page, ledger, applicationOrigin);
    console.info('phase=warm-activation');
    const warm = await activationMeasurement(page, ledger, { sampleLoading: false });
    printActivation('warm', warm);

    console.info('phase=product-cases');
    for (const acceptanceCase of acceptanceCases) {
      productCaseFailures.push(...(await runProductCase(page, acceptanceCase)).map((failure) => (
        `${acceptanceCase.id}:${failure}`
      )));
    }
    console.info('phase=lifecycle-closeout');
    await qualificationCloseout(page, ledger, applicationOrigin);
  } else {
    const smokeActivationMark = ledger.mark();
    await page.getByRole('button', { name: /Load Jet's Ghost/ }).click();
    await expect(page.getByRole('textbox', { name: "Ask Jet's Ghost" })).toBeEnabled();
    await printSmokeVersions(ledger, smokeActivationMark, applicationOrigin);
    const smokeCases = SMOKE_CASE_IDS.map((id) => acceptanceCases.find((item) => item.id === id));
    contentFreeAssert(smokeCases.every((item) => item !== undefined), 'SMOKE_CASE_MISSING');
    for (const acceptanceCase of smokeCases) {
      productCaseFailures.push(...(await runProductCase(page, acceptanceCase!)).map((failure) => (
        `${acceptanceCase!.id}:${failure}`
      )));
    }
    await unloadAndAssertSettled(page);
  }

  await validateRequestPrivacy(ledger, applicationOrigin);
  await printEnvironment(browser, page, mode);
  const device = await deviceObservation(page);
  console.info([
    `mode=${mode}`,
    'privacy=pass',
    'lifecycle=pass',
    `device-loss-count=${device.deviceLossCount}`,
  ].join(' '));
  contentFreeAssert(
    productCaseFailures.length === 0,
    `PRODUCT_CASES_FAILED_${productCaseFailures.join('_')}`,
  );
});
