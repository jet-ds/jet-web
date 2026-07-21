import { execFileSync } from 'node:child_process';
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
  type Request,
} from '@playwright/test';
import {
  EGREGORE_MODEL,
  EGREGORE_PATHS,
} from '../../src/features/egregore/config';
import { LITERT_LM_WASM_ASSETS } from '../../src/features/egregore/runtime/liteRtAssets.server';
import {
  isTrustedModelOrigin,
  validateModelDeliveryChain,
  type ModelDeliveryHop,
} from '../../src/features/egregore/runtime/modelDelivery';
import { EGREGORE_ABSTENTION_PREFIX } from '../../src/features/egregore/prompt/assemble';
import { establishDeploymentProtectionBypass } from '../support/deploymentProtection';
import {
  isAllowedDeploymentProtectionCookie,
  isPartytownBlobScript,
  isPartytownSandboxDocument,
} from './requestPrivacy';

interface VisitorCase {
  id: string;
  coverage: 'single-source' | 'multiple-source' | 'cross-document' | 'unsupported';
  question: string;
  expectedSourceIds: string[];
  acceptableSourceIds: string[];
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

interface ConsentAuditState {
  activationStartedAt: number;
  loadInitiated: boolean;
  loadInitiatedAt?: number;
  assistantRequests: Array<{ beforeConsent: boolean }>;
  isAssistantResource: (value: string) => boolean;
}

type ConsentAuditWindow = typeof window & {
  __EGREGORE_CONSENT_AUDIT__?: ConsentAuditState;
};

const REAL_MODEL_MODES = [
  'qualification',
  'smoke',
] as const;

const SMOKE_CASE_IDS = [
  'recursive-convergence-claim',
  'private-note-abstention',
] as const;

type RealModelMode = typeof REAL_MODEL_MODES[number];

const EGREGORE_PATH = '/chatbot/';
const ROUTE_AWAY_PATH = '/contact/';
const ACTIVATION_READY_TIMEOUT_MS = 10 * 60_000;
const FIRST_TOKEN_TIMEOUT_MS = 2 * 60_000;
const RESPONSE_COMPLETION_TIMEOUT_MS = 5 * 60_000;
const LOADING_MOTION_TIMEOUT_MS = 3_000;
const LOADING_OBSERVATION_INTERVAL_MS = 12_000;
const LOADING_REASSURANCE_AFTER_MS = 36_000;
const CORPUS_PATHS = [
  EGREGORE_PATHS.manifest,
  EGREGORE_PATHS.content,
  EGREGORE_PATHS.index,
] as const;
const CLOSEOUT_PROMPT_SENTINEL = 'EGREGORE_REAL_MODEL_PROMPT_SENTINEL_91d6c4';
const SELECTED_SOURCE_SENTINEL = 'works:recursive-convergence-hypothesis';
const PROFILE_ENVIRONMENT_KEYS = [
  'PLAYWRIGHT_USER_DATA_DIR',
  'CHROME_USER_DATA_DIR',
  'EGREGORE_USER_DATA_DIR',
  'PW_TEST_CONNECT_WS_ENDPOINT',
  'PW_TEST_REUSE_CONTEXT',
] as const;

const VISITOR_CASES: readonly VisitorCase[] = [
  {
    id: 'claude-native-installation',
    coverage: 'single-source',
    question: 'What installation method does Jet recommend for Claude Code in 2026, and why?',
    expectedSourceIds: ['blog:how-to-install-claude-code-cli-2026'],
    acceptableSourceIds: ['blog:how-to-install-claude-code-cli-2026'],
    mustAbstain: false,
  },
  {
    id: 'recursive-convergence-claim',
    coverage: 'single-source',
    question: 'What is the central claim of the Recursive Convergence Hypothesis?',
    expectedSourceIds: ['works:recursive-convergence-hypothesis'],
    acceptableSourceIds: ['works:recursive-convergence-hypothesis'],
    mustAbstain: false,
  },
  {
    id: 'coding-workflows',
    coverage: 'multiple-source',
    question: 'What has Jet published about working with coding agents?',
    expectedSourceIds: [
      'blog:how-to-install-claude-code-cli-2026',
      'blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters',
    ],
    acceptableSourceIds: [
      'blog:how-to-install-claude-code-cli-2026',
      'blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters',
    ],
    mustAbstain: false,
  },
  {
    id: 'human-review-control',
    coverage: 'cross-document',
    question: "How does human review in Jet's Claude Code guidance relate to the control concerns in agentic coding?",
    expectedSourceIds: [
      'blog:how-to-install-claude-code-cli-2026',
      'blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters',
    ],
    acceptableSourceIds: [
      'blog:how-to-install-claude-code-cli-2026',
      'blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters',
    ],
    mustAbstain: false,
  },
  {
    id: 'private-note-abstention',
    coverage: 'unsupported',
    question: "What exact launch date did Jet record in a private, unpublished note for Egregore 2.1?",
    expectedSourceIds: [],
    acceptableSourceIds: [],
    mustAbstain: true,
  },
  {
    id: 'private-schedule-abstention',
    coverage: 'unsupported',
    question: "What meetings are on Jet's private schedule tomorrow?",
    expectedSourceIds: [],
    acceptableSourceIds: [],
    mustAbstain: true,
  },
];

function resolveMode(): RealModelMode {
  const value = process.env.EGREGORE_REAL_MODEL_MODE;
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
      || url.pathname.startsWith(EGREGORE_PATHS.liteRtWasm)
    )
  ) || isTrustedModelOrigin(url.href, EGREGORE_MODEL.trustedOrigins);
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

async function installConsentAudit(page: Page): Promise<void> {
  await page.addInitScript((config) => {
    const isAssistantResource = (value: string): boolean => {
      let url: URL;
      try {
        url = new URL(value, location.href);
      } catch {
        return false;
      }

      const localResource = url.origin === location.origin && (
        config.corpusPaths.some((path) => path === url.pathname)
        || url.pathname.startsWith(config.wasmRoot)
      );
      const trustedModelResource = url.protocol === 'https:'
        && url.port === ''
        && config.trustedOrigins.some(({ hostname, allowSubdomains }) => (
          url.hostname === hostname
          || (allowSubdomains && url.hostname.endsWith(`.${hostname}`))
        ));
      return localResource || trustedModelResource;
    };
    const state: ConsentAuditState = {
      activationStartedAt: performance.now(),
      loadInitiated: false,
      assistantRequests: [],
      isAssistantResource,
    };
    (window as ConsentAuditWindow).__EGREGORE_CONSENT_AUDIT__ = state;
    performance.setResourceTimingBufferSize(2_000);

    const originalFetch = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const value = typeof input === 'string' || input instanceof URL
        ? input.toString()
        : input.url;
      if (isAssistantResource(value)) {
        state.assistantRequests.push({ beforeConsent: !state.loadInitiated });
      }
      return originalFetch(input, init);
    }) as typeof window.fetch;
  }, {
    corpusPaths: [...CORPUS_PATHS],
    wasmRoot: EGREGORE_PATHS.liteRtWasm,
    trustedOrigins: EGREGORE_MODEL.trustedOrigins.map((origin) => ({ ...origin })),
  });
}

async function resetConsentAudit(page: Page): Promise<void> {
  await page.evaluate(() => {
    const audit = (window as ConsentAuditWindow).__EGREGORE_CONSENT_AUDIT__;
    if (audit === undefined) throw new Error('CONSENT_AUDIT_MISSING');
    audit.activationStartedAt = performance.now();
    audit.loadInitiated = false;
    audit.loadInitiatedAt = undefined;
    audit.assistantRequests = [];
  });
}

async function validateConsentAudit(
  page: Page,
  ledger: RequestLedger,
  compatibilityMark: number,
  applicationOrigin: string,
): Promise<void> {
  const audit = await page.evaluate(() => {
    const state = (window as ConsentAuditWindow).__EGREGORE_CONSENT_AUDIT__;
    if (state === undefined || state.loadInitiatedAt === undefined) {
      throw new Error('CONSENT_AUDIT_MISSING');
    }

    const timedResources = performance.getEntriesByType('resource')
      .filter((entry) => (
        entry.startTime >= state.activationStartedAt && state.isAssistantResource(entry.name)
      ));
    return {
      auditedRequestCount: Math.max(state.assistantRequests.length, timedResources.length),
      beforeConsent: state.assistantRequests.some((request) => request.beforeConsent)
        || timedResources.some((entry) => entry.startTime < state.loadInitiatedAt!),
    };
  });
  const assistantRootCount = ledger.since(compatibilityMark).filter(({ request }) => (
    request.redirectedFrom() === null && assistantResourceRequest(request, applicationOrigin)
  )).length;

  contentFreeAssert(!audit.beforeConsent, 'ASSISTANT_REQUEST_BEFORE_LOAD');
  contentFreeAssert(
    audit.auditedRequestCount >= assistantRootCount,
    'CONSENT_AUDIT_REQUEST_MISSING',
  );
}

async function installDeviceObservation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type ObservationWindow = typeof window & {
      __EGREGORE_DEVICE_OBSERVATION__?: DeviceObservation;
    };
    const state: DeviceObservation = {
      adapterIdentifiers: [],
      deviceLossCount: 0,
      deviceRequestCount: 0,
      instrumentationFailed: false,
    };
    (window as ObservationWindow).__EGREGORE_DEVICE_OBSERVATION__ = state;

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
    window as typeof window & { __EGREGORE_DEVICE_OBSERVATION__?: DeviceObservation }
  ).__EGREGORE_DEVICE_OBSERVATION__ ?? {
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
  const applicationStatePattern = /egregore|assistant|litert|gemma/iu;

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

async function observeColdLoading(
  page: Page,
  activationStartedAt: number,
  activationReady: Promise<void>,
): Promise<void> {
  await assertLoadingSurface(page);
  const stack = page.getByTestId('loading-stack');
  const elapsed = page.getByTestId('loading-elapsed');
  const headline = stack.getByRole('heading');
  const reassurance = page.getByTestId('loading-reassurance-slot');
  const initialBox = await boxOf(stack);
  let previousElapsed = Number((await elapsed.textContent())?.match(/\d+/u)?.[0] ?? '0');
  let previousHeadline = await headline.textContent();

  while (!await page.getByRole('textbox', { name: "Ask Egregore" }).isVisible()) {
    const readyBeforeObservation = await Promise.race([
      activationReady.then(() => true),
      page.waitForTimeout(LOADING_OBSERVATION_INTERVAL_MS).then(() => false),
    ]);
    if (readyBeforeObservation) break;

    await assertLoadingSurface(page);
    const currentElapsed = Number((await elapsed.textContent())?.match(/\d+/u)?.[0] ?? '0');
    const currentHeadline = await headline.textContent();
    contentFreeAssert(currentElapsed > previousElapsed, 'LOADING_ELAPSED_NOT_MONOTONIC');
    contentFreeAssert(currentHeadline !== previousHeadline, 'LOADING_HEADLINE_NOT_CYCLING');

    const reducedMotion = await page.evaluate(() => (
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ));
    if (!reducedMotion) {
      await page.bringToFront();
      const beforeMotion = await motionSnapshot(page);
      let becameReadyDuringMotionPoll = false;
      await expect.poll(async () => {
        becameReadyDuringMotionPoll = await page.getByRole(
          'textbox',
          { name: "Ask Egregore" },
        ).isVisible();
        if (becameReadyDuringMotionPoll) return true;
        const afterMotion = await motionSnapshot(page);
        return afterMotion.length === beforeMotion.length
          && beforeMotion.some((value, index) => value !== afterMotion[index]);
      }, {
        message: 'LOADING_PHASE_MOTION_NOT_CHANGING',
        intervals: [200, 400, 800, 1_200],
        timeout: LOADING_MOTION_TIMEOUT_MS,
      }).toBe(true);
      if (becameReadyDuringMotionPoll) break;
    }

    if (performance.now() - activationStartedAt >= LOADING_REASSURANCE_AFTER_MS) {
      await expect(reassurance).toHaveText('First load may take a few minutes.');
      contentFreeAssert(
        boxesAreStable(initialBox, await boxOf(stack)),
        'LOADING_STACK_GEOMETRY_MOVED',
      );
    }

    previousElapsed = currentElapsed;
    previousHeadline = currentHeadline;
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
    request.url() === EGREGORE_MODEL.url && request.redirectedFrom() === null
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

function modelActivationTimeoutCode(
  ledger: RequestLedger,
  activationMark: number,
): string {
  const modelObservations = ledger.since(activationMark).filter(({ request }) => (
    isTrustedModelOrigin(request.url(), EGREGORE_MODEL.trustedOrigins)
  ));
  if (modelObservations.length === 0) return 'MODEL_NOT_STARTED';
  if (modelObservations.some(({ request }) => request.failure() !== null)) {
    return 'MODEL_TRANSFER_FAILED';
  }
  if (modelObservations.some(({ finishedAt }) => finishedAt === undefined)) {
    return 'MODEL_TRANSFER_PENDING';
  }
  return 'MODEL_TRANSFER_FINISHED_ENGINE_NOT_READY';
}

async function waitForActivationReady(
  page: Page,
  ledger: RequestLedger,
  activationMark: number,
): Promise<void> {
  const composer = page.getByRole('textbox', { name: "Ask Egregore" });
  const recoveryAction = page.getByRole('button', {
    name: /^(?:Return to load|Unload Egregore)$/u,
  });
  try {
    await expect(composer.or(recoveryAction)).toBeVisible({
      timeout: ACTIVATION_READY_TIMEOUT_MS,
    });
  } catch {
    const stillLoading = await page.getByTestId('loading-stack').isVisible()
      .catch(() => false);
    throw new Error(stillLoading
      ? modelActivationTimeoutCode(ledger, activationMark)
      : 'ACTIVATION_TIMEOUT_UNKNOWN');
  }
  contentFreeAssert(!(await recoveryAction.isVisible()), 'ACTIVATION_LOAD_FAILED');
  await expect(composer).toBeEnabled();
}

async function activationMeasurement(
  page: Page,
  ledger: RequestLedger,
  applicationOrigin: string,
  options: { sampleLoading: boolean; compatibilityMark: number },
): Promise<ActivationMeasurement> {
  const mark = ledger.mark();
  const startedAt = performance.now();
  await clickLoadAfterConsentAudit(
    page,
    ledger,
    applicationOrigin,
    options.compatibilityMark,
  );
  const activationReady = waitForActivationReady(page, ledger, mark);
  if (options.sampleLoading) {
    await Promise.all([
      activationReady,
      observeColdLoading(page, startedAt, activationReady),
    ]);
  } else {
    await activationReady;
  }
  await expect(page.getByTestId('lifecycle-visible-status')).toContainText('Ready');
  const readyAt = performance.now();
  const observations = ledger.since(mark);
  const origin = new URL(page.url()).origin;
  const manifestObservation = observationForPath(
    observations,
    origin,
    EGREGORE_PATHS.manifest,
  );
  const contentObservation = observationForPath(
    observations,
    origin,
    EGREGORE_PATHS.content,
  );
  const indexObservation = observationForPath(
    observations,
    origin,
    EGREGORE_PATHS.index,
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
  await validateConsentAudit(page, ledger, options.compatibilityMark, applicationOrigin);

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
    `runtime-config-version=${EGREGORE_MODEL.packageVersion}`,
  ].join(' '));
}

async function newSession(page: Page): Promise<void> {
  await page.getByRole('button', { name: /New session|Start a new session/ }).click();
  const composer = page.getByRole('textbox', { name: "Ask Egregore" });
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
  return page.evaluate((abstentionPrefix) => {
    const articles = document.querySelectorAll('[data-testid="conversation-scroller"] article');
    const response = articles.item(articles.length - 1).textContent ?? '';
    return response.trimStart().startsWith(abstentionPrefix);
  }, EGREGORE_ABSTENTION_PREFIX);
}

async function runVisitorCase(
  page: Page,
  visitorCase: VisitorCase,
): Promise<string[]> {
  const caseFailures: string[] = [];
  await newSession(page);
  const startedAt = performance.now();
  const composer = page.getByRole('textbox', { name: "Ask Egregore" });
  await composer.fill(visitorCase.question);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(() => responseHasFirstToken(page), {
    timeout: FIRST_TOKEN_TIMEOUT_MS,
  }).toBe(true);
  const firstTokenMs = roundMilliseconds(performance.now() - startedAt);
  await expect(page.getByTestId('lifecycle-visible-status')).toContainText('Ready', {
    timeout: RESPONSE_COMPLETION_TIMEOUT_MS,
  });
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
        if (href === null) {
          caseFailures.push('CASE_SOURCE_HREF_MISSING');
        } else {
          try {
            observedSourcePaths.push(new URL(href, page.url()).pathname);
          } catch {
            caseFailures.push('CASE_SOURCE_HREF_MALFORMED');
          }
        }

        if (await link.getAttribute('target') !== '_blank') {
          caseFailures.push('CASE_SOURCE_TARGET_INVALID');
        }
        const rel = await link.getAttribute('rel');
        const relTokens = new Set(rel?.split(/\s+/u).filter(Boolean) ?? []);
        if (!relTokens.has('noopener') || !relTokens.has('noreferrer')) {
          caseFailures.push('CASE_SOURCE_REL_INVALID');
        }
      }
    }

    const expectedPaths = visitorCase.expectedSourceIds.map(sourcePath);
    const acceptablePaths = visitorCase.acceptableSourceIds.map(sourcePath);
    const inlineCitationCount = await inlineCitations.count();
    const requiresEveryExpectedSource = visitorCase.coverage === 'cross-document';
    const expectedSourceMissing = requiresEveryExpectedSource
      ? expectedPaths.some((path) => !observedSourcePaths.includes(path))
      : !expectedPaths.some((path) => observedSourcePaths.includes(path));
    const unacceptableSourcePresent = observedSourcePaths.some((path) => (
      !acceptablePaths.includes(path)
    ));
    const unsupportedCitationPresent = inlineCitationCount > 0
      || observedSourcePaths.length > 0;
    const citationResolved = visitorCase.mustAbstain
      ? !unsupportedCitationPresent
      : !expectedSourceMissing
        && !unacceptableSourcePresent
        && inlineCitationCount > 0;
    const abstention = await responseAbstains(page);

    if (visitorCase.mustAbstain) {
      if (unsupportedCitationPresent) caseFailures.push('CASE_UNSUPPORTED_CITATION_PRESENT');
      if (!abstention) caseFailures.push('CASE_ABSTENTION_MISSING');
    } else {
      if (expectedSourceMissing) caseFailures.push('CASE_EXPECTED_SOURCE_MISSING');
      if (unacceptableSourcePresent) caseFailures.push('CASE_UNACCEPTABLE_SOURCE');
      if (inlineCitationCount === 0) caseFailures.push('CASE_INLINE_CITATION_MISSING');
    }

    console.info([
      `case=${visitorCase.id}`,
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
  await expect(page.getByRole('textbox', { name: "Ask Egregore" })).toHaveCount(0);
  await expect(page.getByTestId('conversation-scroller')).toHaveCount(0);
}

async function assertCompatibilityDoesNotLoadAssistant(
  page: Page,
  ledger: RequestLedger,
  applicationOrigin: string,
): Promise<number> {
  const compatibilityMark = ledger.mark();
  await resetConsentAudit(page);
  await page.getByRole('button', { name: 'Check compatibility' }).click();
  await expect(page.getByRole('button', { name: /Load Egregore/ })).toBeVisible();
  assertNoAssistantRequestsSince(ledger, compatibilityMark, applicationOrigin);
  return compatibilityMark;
}

function assertNoAssistantRequestsSince(
  ledger: RequestLedger,
  compatibilityMark: number,
  applicationOrigin: string,
): void {
  contentFreeAssert(
    ledger.since(compatibilityMark).every(({ request }) => (
      !assistantResourceRequest(request, applicationOrigin)
    )),
    'ASSISTANT_REQUEST_BEFORE_LOAD',
  );
}

async function clickLoadAfterConsentAudit(
  page: Page,
  ledger: RequestLedger,
  applicationOrigin: string,
  compatibilityMark: number,
): Promise<void> {
  assertNoAssistantRequestsSince(ledger, compatibilityMark, applicationOrigin);
  const loadButton = page.getByRole('button', { name: /Load Egregore/ });
  await expect(loadButton).toBeVisible();
  await expect(loadButton).toBeEnabled();
  await loadButton.evaluate((element) => {
    const audit = (window as ConsentAuditWindow).__EGREGORE_CONSENT_AUDIT__;
    if (audit === undefined) throw new Error('CONSENT_AUDIT_MISSING');
    if (!(element instanceof HTMLButtonElement)) throw new Error('LOAD_CONTROL_INVALID');
    audit.loadInitiatedAt = performance.now();
    audit.loadInitiated = true;
    element.click();
  });
}

async function activateWithoutBenchmark(
  page: Page,
  ledger: RequestLedger,
  applicationOrigin: string,
): Promise<void> {
  const compatibilityMark = await assertCompatibilityDoesNotLoadAssistant(
    page,
    ledger,
    applicationOrigin,
  );
  const activationMark = ledger.mark();
  await clickLoadAfterConsentAudit(page, ledger, applicationOrigin, compatibilityMark);
  await waitForActivationReady(page, ledger, activationMark);
  await expect(page.getByTestId('lifecycle-visible-status')).toContainText('Ready');
  await validateConsentAudit(page, ledger, compatibilityMark, applicationOrigin);
}

async function qualificationCloseout(
  page: Page,
  ledger: RequestLedger,
  applicationOrigin: string,
): Promise<void> {
  await newSession(page);
  const composer = page.getByRole('textbox', { name: "Ask Egregore" });
  await composer.fill(CLOSEOUT_PROMPT_SENTINEL);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('button', { name: 'Stop response' })).toBeVisible({
    timeout: FIRST_TOKEN_TIMEOUT_MS,
  });
  await page.getByRole('button', { name: 'Stop response' }).click();
  await expect(page.getByText('Stopped', { exact: true })).toBeVisible({
    timeout: RESPONSE_COMPLETION_TIMEOUT_MS,
  });
  await expect(page.getByTestId('lifecycle-visible-status')).toContainText('Ready', {
    timeout: RESPONSE_COMPLETION_TIMEOUT_MS,
  });
  await newSession(page);
  await unloadAndAssertSettled(page);

  await activateWithoutBenchmark(page, ledger, applicationOrigin);
  const contact = page.locator('#site-navigation-dock').getByRole('link', { name: 'Contact' });
  await contact.click();
  await expect(page).toHaveURL(new RegExp(`${ROUTE_AWAY_PATH}$`, 'u'));
  await expect(page.getByTestId('lifecycle-visible-status')).toHaveCount(0);
  await page.locator('#site-navigation-dock').getByRole('link', { name: "Egregore" }).click();
  await expect(page).toHaveURL(new RegExp(`${EGREGORE_PATH}$`, 'u'));
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
    isTrustedModelOrigin(request.url(), EGREGORE_MODEL.trustedOrigins)
  ));
  const roots = modelRequests.filter((request) => request.redirectedFrom() === null);
  contentFreeAssert(roots.length > 0, 'MODEL_CHAIN_MISSING');

  for (const request of modelRequests) {
    let root = request;
    while (root.redirectedFrom() !== null) root = root.redirectedFrom()!;
    contentFreeAssert(root.url() === EGREGORE_MODEL.url, 'MODEL_CHAIN_ROOT_CHANGED');
  }

  for (const root of roots) {
    const chain: ModelDeliveryHop[] = [];
    let request: Request | null = root;
    while (request !== null) {
      chain.push(await modelDeliveryHop(request));
      request = request.redirectedTo();
    }
    const validation = validateModelDeliveryChain(chain, EGREGORE_MODEL);
    contentFreeAssert(
      validation.valid,
      `MODEL_DELIVERY_${validation.failures.map(({ ruleCode }) => ruleCode).join('_')}`,
    );
    contentFreeAssert(
      validation.redirectDepth <= EGREGORE_MODEL.maxRedirects,
      'MODEL_REDIRECT_LIMIT_EXCEEDED',
    );
  }
}

async function validateRequestPrivacy(
  ledger: RequestLedger,
  applicationOrigin: string,
): Promise<void> {
  const deploymentProtectionSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const deploymentProtectionBypassEnabled = deploymentProtectionSecret !== undefined
    && deploymentProtectionSecret.trim() !== '';
  const sentinels = [
    CLOSEOUT_PROMPT_SENTINEL,
    SELECTED_SOURCE_SENTINEL,
    ...VISITOR_CASES.flatMap(({ question, acceptableSourceIds }) => [
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

    const sameOrigin = ['http:', 'https:'].includes(url.protocol)
      && url.origin === applicationOrigin;
    const corpus = sameOrigin
      && CORPUS_PATHS.includes(url.pathname as typeof CORPUS_PATHS[number]);
    const applicationChunk = sameOrigin && url.pathname.startsWith('/_astro/');
    const runtimeFilename = sameOrigin && url.pathname.startsWith(EGREGORE_PATHS.liteRtWasm)
      ? url.pathname.slice(EGREGORE_PATHS.liteRtWasm.length)
      : undefined;
    const runtimeAsset = runtimeFilename !== undefined
      && !runtimeFilename.includes('/')
      && runtimeAssets.has(runtimeFilename);
    const documentRequest = sameOrigin
      && [EGREGORE_PATH, ROUTE_AWAY_PATH].includes(url.pathname);
    const model = isTrustedModelOrigin(url.href, EGREGORE_MODEL.trustedOrigins);
    const analytics = isAnalyticsRequest(url);
    const partytownTransport = isPartytownTransport(url, applicationOrigin);
    const partytownBlobScript = isPartytownBlobScript(request, url, applicationOrigin);
    const partytownSandboxDocument = isPartytownSandboxDocument(
      request,
      url,
      applicationOrigin,
    );

    contentFreeAssert(
      corpus
        || applicationChunk
        || runtimeAsset
        || documentRequest
        || model
        || analytics
        || partytownTransport
        || partytownBlobScript
        || partytownSandboxDocument,
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
    if (corpus) {
      contentFreeAssert(
        isAllowedDeploymentProtectionCookie(
          headers.cookie,
          deploymentProtectionBypassEnabled,
        ),
        'ASSISTANT_COOKIE_FORBIDDEN',
      );
      contentFreeAssert(headers.authorization === undefined, 'ASSISTANT_AUTHORIZATION_FORBIDDEN');
    }
    if (model) {
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
    EGREGORE_PATHS.manifest,
  );
  const response = await manifestObservation.request.response();
  contentFreeAssert(response !== null, 'CORPUS_MANIFEST_RESPONSE_MISSING');
  const manifest = await response.json() as Record<string, unknown>;
  contentFreeAssert(typeof manifest.corpusVersion === 'string', 'CORPUS_VERSION_MISSING');
  contentFreeAssert(typeof manifest.indexConfigVersion === 'string', 'INDEX_VERSION_MISSING');
  console.info([
    `corpus-version=${manifest.corpusVersion}`,
    `index-config-version=${manifest.indexConfigVersion}`,
    `runtime-config-version=${EGREGORE_MODEL.packageVersion}`,
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

test("qualifies Egregore with the real local model", async ({ browser, page }) => {
  const mode = resolveMode();
  rejectExternalProfile();
  if (mode === 'qualification' && (process.platform !== 'darwin' || process.arch !== 'arm64')) {
    throw new Error('QUALIFICATION_REQUIRES_APPLE_SILICON_MAC');
  }

  const applicationBaseUrl = process.env.REAL_MODEL_BASE_URL ?? 'http://127.0.0.1:4322';
  await establishDeploymentProtectionBypass(
    page.context(),
    new URL(applicationBaseUrl).origin,
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  );
  await installDeviceObservation(page);
  await installConsentAudit(page);
  await page.goto(EGREGORE_PATH);
  await assertFreshApplicationStorage(page);
  const applicationOrigin = new URL(page.url()).origin;
  const ledger = new RequestLedger(page);
  const visitorCaseFailures: string[] = [];
  const compatibilityMark = await assertCompatibilityDoesNotLoadAssistant(
    page,
    ledger,
    applicationOrigin,
  );

  if (mode === 'qualification') {
    console.info('phase=cold-activation');
    const cold = await activationMeasurement(page, ledger, applicationOrigin, {
      sampleLoading: true,
      compatibilityMark,
    });
    printActivation('cold', cold);
    await unloadAndAssertSettled(page);
    const warmCompatibilityMark = await assertCompatibilityDoesNotLoadAssistant(
      page,
      ledger,
      applicationOrigin,
    );
    console.info('phase=warm-activation');
    const warm = await activationMeasurement(page, ledger, applicationOrigin, {
      sampleLoading: false,
      compatibilityMark: warmCompatibilityMark,
    });
    printActivation('warm', warm);

    console.info('phase=visitor-cases');
    for (const visitorCase of VISITOR_CASES) {
      visitorCaseFailures.push(...(await runVisitorCase(page, visitorCase)).map((failure) => (
        `${visitorCase.id}:${failure}`
      )));
    }
    console.info('phase=lifecycle-closeout');
    await qualificationCloseout(page, ledger, applicationOrigin);
  } else {
    console.info('phase=smoke-activation');
    const smokeActivationMark = ledger.mark();
    await clickLoadAfterConsentAudit(page, ledger, applicationOrigin, compatibilityMark);
    await waitForActivationReady(page, ledger, smokeActivationMark);
    await validateConsentAudit(page, ledger, compatibilityMark, applicationOrigin);
    await printSmokeVersions(ledger, smokeActivationMark, applicationOrigin);
    const smokeCases = SMOKE_CASE_IDS.map((id) => VISITOR_CASES.find((item) => item.id === id));
    contentFreeAssert(smokeCases.every((item) => item !== undefined), 'SMOKE_CASE_MISSING');
    for (const visitorCase of smokeCases) {
      visitorCaseFailures.push(...(await runVisitorCase(page, visitorCase!)).map((failure) => (
        `${visitorCase!.id}:${failure}`
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
    visitorCaseFailures.length === 0,
    `VISITOR_CASES_FAILED_${visitorCaseFailures.join('_')}`,
  );
});
