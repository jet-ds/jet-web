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
  EGREGORE_MODEL_CACHE,
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
import {
  localQualificationSpansRequired,
  orderQualificationCases,
  resolveQualificationRunContract,
  validateUnloadLifecycleEvidence,
  type QualificationRunContract,
  type RealModelMode,
} from './qualificationContract';

interface VisitorCase {
  id: string;
  coverage:
    'single-source' | 'multiple-source' | 'cross-document' | 'unsupported';
  question: string;
  expectedSourceIds: string[];
  acceptableSourceIds: string[];
  mustAbstain: boolean;
}

interface VisitorCaseResult {
  failures: string[];
  completedTokenCount: number | null;
  sessionFull: boolean;
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
  modelTransferMs: number | null;
  cachePutWallMs: number | null;
  cacheRereadMs: number | null;
  liteRtWasmMs: number | null;
  engineReadyAfterWasmMs: number | null;
  corpusVersion: string;
  indexConfigVersion: string;
}

type QualificationObservationName =
  | 'retrieval-context-selection-start'
  | 'retrieval-context-selection-end'
  | 'prompt-assembly-start'
  | 'prompt-assembly-end'
  | 'generation-send'
  | 'generation-first-nonempty'
  | 'conversation-created'
  | 'conversation-token-count'
  | 'conversation-reset'
  | 'device-destroyed'
  | 'device-reference-cleared'
  | 'runtime-unloaded';

interface QualificationObservation {
  observation: QualificationObservationName;
  timestamp: number;
  value?: number;
}

interface QualificationObserverState {
  observations: QualificationObservation[];
}

interface DeviceObservation {
  adapterIdentifiers: string[];
  deviceDestroyCount: number;
  deviceLossCount: number;
  deviceRequestCount: number;
  instrumentationFailed: boolean;
  jsHeapUsedBytes: number | null;
  deviceMemoryGiB: number | null;
  thermalState: 'not-exposed-by-browser';
}

interface CacheOperationSpan {
  startedAt: number;
  finishedAt: number;
}

interface CacheObservation {
  modelCacheMatches: CacheOperationSpan[];
  modelCacheWrites: CacheOperationSpan[];
  instrumentationFailed: boolean;
}

interface ConsentAuditState {
  activationStartedAt: number;
  loadInitiated: boolean;
  loadInitiatedAt?: number;
  assistantRequests: Array<{ beforeConsent: boolean }>;
  isAssistantResource: (value: string) => boolean;
}

type QualificationObserverWindow = typeof window & {
  __EGREGORE_QUALIFICATION_OBSERVER__?: QualificationObserverState;
};

type ConsentAuditWindow = typeof window & {
  __EGREGORE_CONSENT_AUDIT__?: ConsentAuditState;
};

const SMOKE_CASE_IDS = [
  'recursive-convergence-claim',
  'private-note-abstention',
] as const;

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
    id: 'recursive-convergence-claim',
    coverage: 'single-source',
    question:
      'What is the central claim of the Recursive Convergence Hypothesis?',
    expectedSourceIds: ['works:recursive-convergence-hypothesis'],
    acceptableSourceIds: ['works:recursive-convergence-hypothesis'],
    mustAbstain: false,
  },
  {
    id: 'who-is-jet',
    coverage: 'single-source',
    question: 'Who is Jet?',
    expectedSourceIds: ['profile:jet-sanchez'],
    acceptableSourceIds: ['profile:jet-sanchez'],
    mustAbstain: false,
  },
  {
    id: 'what-does-jet-do',
    coverage: 'single-source',
    question: 'What does Jet do?',
    expectedSourceIds: ['profile:jet-sanchez'],
    acceptableSourceIds: ['profile:jet-sanchez'],
    mustAbstain: false,
  },
  {
    id: 'digital-squad-timesheet',
    coverage: 'single-source',
    question:
      'What problem does the Digital Squad Timesheet solve, and how does it structure weekly work?',
    expectedSourceIds: ['works:digital-squad-timesheet'],
    acceptableSourceIds: [
      'works:digital-squad-timesheet',
      'profile:jet-sanchez',
    ],
    mustAbstain: false,
  },
  {
    id: 'claude-native-installation',
    coverage: 'single-source',
    question:
      'What installation method does Jet recommend for Claude Code in 2026, and why?',
    expectedSourceIds: ['blog:how-to-install-claude-code-cli-2026'],
    acceptableSourceIds: ['blog:how-to-install-claude-code-cli-2026'],
    mustAbstain: false,
  },
  {
    id: 'private-note-abstention',
    coverage: 'unsupported',
    question:
      'What exact launch date did Jet record in a private, unpublished note for Egregore 2.1?',
    expectedSourceIds: [],
    acceptableSourceIds: [],
    mustAbstain: true,
  },
];

function rejectExternalProfile(): void {
  if (
    PROFILE_ENVIRONMENT_KEYS.some((key) => process.env[key] !== undefined) ||
    process.argv.some((argument) => argument.startsWith('--user-data-dir'))
  ) {
    throw new Error('EXTERNAL_BROWSER_PROFILE_NOT_ALLOWED');
  }
}

function contentFreeAssert(
  condition: boolean,
  code: string,
): asserts condition {
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
  return (
    sanitizeIdentifier(
      execFileSync('/usr/bin/sw_vers', ['-productVersion'], {
        encoding: 'utf8',
      }).trim(),
    ) ?? 'unavailable'
  );
}

function assistantResourceRequest(
  request: Request,
  applicationOrigin: string,
): boolean {
  const url = new URL(request.url());
  return (
    (url.origin === applicationOrigin &&
      (CORPUS_PATHS.includes(url.pathname as (typeof CORPUS_PATHS)[number]) ||
        url.pathname.startsWith(EGREGORE_PATHS.liteRtWasm))) ||
    isTrustedModelOrigin(url.href, EGREGORE_MODEL.trustedOrigins)
  );
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

function assertNoModelNetworkRequestsSince(
  ledger: RequestLedger,
  mark: number,
): void {
  contentFreeAssert(
    ledger
      .since(mark)
      .every(
        ({ request }) =>
          !isTrustedModelOrigin(request.url(), EGREGORE_MODEL.trustedOrigins),
      ),
    'WARM_MODEL_NETWORK_REQUEST',
  );
}

async function installConsentAudit(page: Page): Promise<void> {
  await page.addInitScript(
    (config) => {
      const isAssistantResource = (value: string): boolean => {
        let url: URL;
        try {
          url = new URL(value, location.href);
        } catch {
          return false;
        }

        const localResource =
          url.origin === location.origin &&
          (config.corpusPaths.some((path) => path === url.pathname) ||
            url.pathname.startsWith(config.wasmRoot));
        const trustedModelResource =
          url.protocol === 'https:' &&
          url.port === '' &&
          config.trustedOrigins.some(
            ({ hostname, allowSubdomains }) =>
              url.hostname === hostname ||
              (allowSubdomains && url.hostname.endsWith(`.${hostname}`)),
          );
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
        const value =
          typeof input === 'string' || input instanceof URL
            ? input.toString()
            : input.url;
        if (isAssistantResource(value)) {
          state.assistantRequests.push({ beforeConsent: !state.loadInitiated });
        }
        return originalFetch(input, init);
      }) as typeof window.fetch;
    },
    {
      corpusPaths: [...CORPUS_PATHS],
      wasmRoot: EGREGORE_PATHS.liteRtWasm,
      trustedOrigins: EGREGORE_MODEL.trustedOrigins.map((origin) => ({
        ...origin,
      })),
    },
  );
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

    const timedResources = performance
      .getEntriesByType('resource')
      .filter(
        (entry) =>
          entry.startTime >= state.activationStartedAt &&
          state.isAssistantResource(entry.name),
      );
    return {
      auditedRequestCount: Math.max(
        state.assistantRequests.length,
        timedResources.length,
      ),
      beforeConsent:
        state.assistantRequests.some((request) => request.beforeConsent) ||
        timedResources.some(
          (entry) => entry.startTime < state.loadInitiatedAt!,
        ),
    };
  });
  const assistantRootCount = ledger
    .since(compatibilityMark)
    .filter(
      ({ request }) =>
        request.redirectedFrom() === null &&
        assistantResourceRequest(request, applicationOrigin),
    ).length;

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
      deviceDestroyCount: 0,
      deviceLossCount: 0,
      deviceRequestCount: 0,
      instrumentationFailed: false,
      jsHeapUsedBytes: null,
      deviceMemoryGiB: null,
      thermalState: 'not-exposed-by-browser',
    };
    (window as ObservationWindow).__EGREGORE_DEVICE_OBSERVATION__ = state;

    const gpu = navigator.gpu;
    if (gpu === undefined) return;
    const requestAdapter = gpu.requestAdapter.bind(gpu);
    const observedAdapters = new WeakSet<GPUAdapter>();
    const observedDevices = new WeakSet<GPUDevice>();

    try {
      Object.defineProperty(gpu, 'requestAdapter', {
        configurable: true,
        value: async (...args: Parameters<GPU['requestAdapter']>) => {
          const adapter = await requestAdapter(...args);
          if (adapter === null) return null;

          const exposedInfo = adapter.info as GPUAdapterInfo &
            Record<string, unknown>;
          state.adapterIdentifiers = [
            exposedInfo.vendor,
            exposedInfo.architecture,
            exposedInfo.device,
            exposedInfo.description,
          ].filter(
            (value): value is string =>
              typeof value === 'string' && value !== '',
          );

          if (observedAdapters.has(adapter)) return adapter;
          observedAdapters.add(adapter);

          const requestDevice = adapter.requestDevice.bind(adapter);
          Object.defineProperty(adapter, 'requestDevice', {
            configurable: true,
            value: async (
              ...deviceArgs: Parameters<GPUAdapter['requestDevice']>
            ) => {
              state.deviceRequestCount += 1;
              const device = await requestDevice(...deviceArgs);
              if (observedDevices.has(device)) return device;
              observedDevices.add(device);
              const destroy = device.destroy.bind(device);
              try {
                Object.defineProperty(device, 'destroy', {
                  configurable: true,
                  value: () => {
                    state.deviceDestroyCount += 1;
                    destroy();
                    window.dispatchEvent(
                      new CustomEvent('egregore:qualification-observation', {
                        detail: {
                          observation: 'device-destroyed',
                          timestamp: performance.now(),
                        },
                      }),
                    );
                  },
                });
              } catch {
                state.instrumentationFailed = true;
              }
              void device.lost.then((info) => {
                if (info.reason !== 'destroyed') state.deviceLossCount += 1;
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
  return page.evaluate(() => {
    const state = (
      window as typeof window & {
        __EGREGORE_DEVICE_OBSERVATION__?: DeviceObservation;
      }
    ).__EGREGORE_DEVICE_OBSERVATION__ ?? {
      adapterIdentifiers: [],
      deviceDestroyCount: 0,
      deviceLossCount: 0,
      deviceRequestCount: 0,
      instrumentationFailed: true,
      jsHeapUsedBytes: null,
      deviceMemoryGiB: null,
      thermalState: 'not-exposed-by-browser' as const,
    };
    const memory = performance as Performance & {
      memory?: { usedJSHeapSize?: unknown };
    };
    const navigatorWithMemory = navigator as Navigator & {
      deviceMemory?: unknown;
    };
    return {
      ...state,
      jsHeapUsedBytes:
        typeof memory.memory?.usedJSHeapSize === 'number'
          ? memory.memory.usedJSHeapSize
          : null,
      deviceMemoryGiB:
        typeof navigatorWithMemory.deviceMemory === 'number'
          ? navigatorWithMemory.deviceMemory
          : null,
    };
  });
}

async function printQualificationCheckpoint(
  page: Page,
  checkpoint: string,
  conversationTokenCount: number | null,
): Promise<void> {
  const device = await deviceObservation(page);
  console.info(
    [
      'observation=qualification-checkpoint',
      `checkpoint=${sanitizeIdentifier(checkpoint) ?? 'unavailable'}`,
      `conversation-token-count=${conversationTokenCount ?? 'not-created'}`,
      `webgpu-device-requests=${device.deviceRequestCount}`,
      `webgpu-device-destroys=${device.deviceDestroyCount}`,
      `unexpected-device-losses=${device.deviceLossCount}`,
      `js-heap-used-bytes=${device.jsHeapUsedBytes ?? 'not-exposed'}`,
      `device-memory-gib=${device.deviceMemoryGiB ?? 'not-exposed'}`,
      `thermal-state=${device.thermalState}`,
      'external-process-snapshot=required',
    ].join(' '),
  );
}

async function installCacheObservation(page: Page): Promise<void> {
  await page.addInitScript((cacheKeyPath) => {
    type ObservationWindow = typeof window & {
      __EGREGORE_CACHE_OBSERVATION__?: CacheObservation;
    };
    const state: CacheObservation = {
      modelCacheMatches: [],
      modelCacheWrites: [],
      instrumentationFailed: false,
    };
    (window as ObservationWindow).__EGREGORE_CACHE_OBSERVATION__ = state;

    const requestUrl = (input: RequestInfo | URL): string | null => {
      if (typeof input === 'string' || input instanceof URL)
        return input.toString();
      return input.url;
    };
    const isModelRequest = (input: RequestInfo | URL): boolean => {
      try {
        return new URL(
          requestUrl(input) ?? '',
          location.href,
        ).pathname.startsWith(cacheKeyPath);
      } catch {
        return false;
      }
    };
    const observe = async <T>(
      input: RequestInfo | URL,
      spans: CacheOperationSpan[],
      operation: () => Promise<T>,
    ): Promise<T> => {
      if (!isModelRequest(input)) return operation();
      const startedAt = performance.now();
      try {
        return await operation();
      } finally {
        spans.push({ startedAt, finishedAt: performance.now() });
      }
    };

    try {
      const originalMatch = Cache.prototype.match;
      Cache.prototype.match = function (
        request: RequestInfo | URL,
        options?: CacheQueryOptions,
      ) {
        return observe(request, state.modelCacheMatches, () =>
          originalMatch.call(this, request, options),
        );
      };
      const originalPut = Cache.prototype.put;
      Cache.prototype.put = function (
        request: RequestInfo | URL,
        response: Response,
      ) {
        return observe(request, state.modelCacheWrites, () =>
          originalPut.call(this, request, response),
        );
      };
    } catch {
      state.instrumentationFailed = true;
    }
  }, '/__egregore-model__/');
}

async function resetCacheObservation(page: Page): Promise<void> {
  await page.evaluate(() => {
    const state = (
      window as typeof window & {
        __EGREGORE_CACHE_OBSERVATION__?: CacheObservation;
      }
    ).__EGREGORE_CACHE_OBSERVATION__;
    if (state === undefined) throw new Error('CACHE_OBSERVATION_MISSING');
    state.modelCacheMatches = [];
    state.modelCacheWrites = [];
  });
}

async function cacheObservation(page: Page): Promise<CacheObservation> {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __EGREGORE_CACHE_OBSERVATION__?: CacheObservation;
        }
      ).__EGREGORE_CACHE_OBSERVATION__ ?? {
        modelCacheMatches: [],
        modelCacheWrites: [],
        instrumentationFailed: true,
      },
  );
}

async function installQualificationObserver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state: QualificationObserverState = { observations: [] };
    (
      window as QualificationObserverWindow
    ).__EGREGORE_QUALIFICATION_OBSERVER__ = state;
    window.addEventListener('egregore:qualification-observation', (event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as Partial<QualificationObservation>;
      if (
        typeof detail.observation !== 'string' ||
        typeof detail.timestamp !== 'number'
      ) {
        return;
      }
      state.observations.push({
        observation: detail.observation as QualificationObservationName,
        timestamp: detail.timestamp,
        ...(typeof detail.value === 'number' ? { value: detail.value } : {}),
      });
    });
  });
}

async function qualificationObservationMark(page: Page): Promise<number> {
  return page.evaluate(() => {
    const state = (window as QualificationObserverWindow)
      .__EGREGORE_QUALIFICATION_OBSERVER__;
    if (state === undefined) throw new Error('QUALIFICATION_OBSERVER_MISSING');
    return state.observations.length;
  });
}

async function qualificationObservations(
  page: Page,
  mark = 0,
): Promise<QualificationObservation[]> {
  return page
    .evaluate(() => {
      const state = (window as QualificationObserverWindow)
        .__EGREGORE_QUALIFICATION_OBSERVER__;
      if (state === undefined)
        throw new Error('QUALIFICATION_OBSERVER_MISSING');
      return state.observations.map((observation) => ({ ...observation }));
    })
    .then((observations) => observations.slice(mark));
}

function observationTimestamp(
  observations: QualificationObservation[],
  name: QualificationObservationName,
): number | null {
  return (
    observations.find((candidate) => candidate.observation === name)
      ?.timestamp ?? null
  );
}

function observationCount(
  observations: readonly QualificationObservation[],
  name: QualificationObservationName,
): number {
  return observations.filter(({ observation }) => observation === name).length;
}

function assertNoContractFailures(failures: readonly string[]): void {
  contentFreeAssert(failures.length === 0, failures.join('_'));
}

async function assertFreshApplicationStorage(page: Page): Promise<void> {
  const state = await page.evaluate(async () => {
    const cacheKeys = 'caches' in window ? await window.caches.keys() : [];
    const databases =
      typeof indexedDB.databases === 'function'
        ? await indexedDB.databases()
        : [];
    const registrations =
      'serviceWorker' in navigator
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
    Object.values(state)
      .flat()
      .every((value) => !applicationStatePattern.test(value)),
    'COLD_PROFILE_CONTAINS_APPLICATION_STATE',
  );
}

function currentModelCacheName(): string {
  return `egregore-model-${EGREGORE_MODEL_CACHE.schemaVersion}-${EGREGORE_MODEL.sha256}`;
}

function currentModelCacheKey(): string {
  return `https://jetsanchez.com/__egregore-model__/${EGREGORE_MODEL.repositoryRevision}/${EGREGORE_MODEL.filename}`;
}

async function assertReadableCommittedModelCache(page: Page): Promise<void> {
  const evidence = await page.evaluate(
    async ({ cacheName, cacheKey, expectedBytes }) => {
      if (!('caches' in window)) throw new Error('CACHE_STORAGE_UNAVAILABLE');
      const cacheNames = await window.caches.keys();
      if (!cacheNames.includes(cacheName)) {
        throw new Error('CURRENT_MODEL_CACHE_MISSING');
      }

      const cache = await window.caches.open(cacheName);
      const response = await cache.match(cacheKey);
      if (response === undefined || response.body === null) {
        throw new Error('CURRENT_MODEL_CACHE_ENTRY_UNREADABLE');
      }
      const declaredLength = Number(
        response.headers.get('content-length') ??
          response.headers.get('x-linked-size'),
      );
      if (response.status !== 200 || declaredLength !== expectedBytes) {
        throw new Error('CURRENT_MODEL_CACHE_ENTRY_INCOMPLETE');
      }

      const reader = response.clone().body!.getReader();
      const firstChunk = await reader.read();
      await reader.cancel();
      if (firstChunk.done || firstChunk.value.byteLength === 0) {
        throw new Error('CURRENT_MODEL_CACHE_ENTRY_UNREADABLE');
      }

      return {
        status: response.status,
        declaredLength,
        responseUrl: response.url,
      };
    },
    {
      cacheName: currentModelCacheName(),
      cacheKey: currentModelCacheKey(),
      expectedBytes: EGREGORE_MODEL.bytes,
    },
  );
  contentFreeAssert(
    evidence.responseUrl === '' ||
      isTrustedModelOrigin(evidence.responseUrl, EGREGORE_MODEL.trustedOrigins),
    'CURRENT_MODEL_CACHE_ORIGIN_INVALID',
  );
  console.info(
    [
      'observation=committed-model-cache',
      `status=${evidence.status}`,
      `declared-bytes=${evidence.declaredLength}`,
      'readable=true',
    ].join(' '),
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
  return (['x', 'y', 'width', 'height'] as const).every(
    (key) => Math.abs(before[key] - after[key]) <= 1,
  );
}

async function motionSnapshot(page: Page): Promise<string[]> {
  return page
    .locator(
      '[data-testid="loading-ghost-afterimage"], [data-testid="loading-inward-particle"]',
    )
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return `${style.transform}|${style.opacity}`;
      }),
    );
}

async function assertLoadingSurface(page: Page): Promise<void> {
  const stack = page.getByTestId('loading-stack');
  await expect(stack).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Cancel and reload' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Unload/ })).toHaveCount(0);
  await expect(
    page.locator(
      '[role="progressbar"], progress, [data-testid*="progress"], .loading-progress, .progress-track',
    ),
  ).toHaveCount(0);
  await expect(page.getByTestId('loading-phase-visual')).not.toHaveAttribute(
    'aria-live',
  );
  await expect(page.getByTestId('lifecycle-announcement')).toHaveAttribute(
    'role',
    'status',
  );
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
  let previousElapsed = Number(
    (await elapsed.textContent())?.match(/\d+/u)?.[0] ?? '0',
  );
  let previousHeadline = await headline.textContent();

  while (
    !(await page.getByRole('textbox', { name: 'Ask Egregore' }).isVisible())
  ) {
    const readyBeforeObservation = await Promise.race([
      activationReady.then(() => true),
      page.waitForTimeout(LOADING_OBSERVATION_INTERVAL_MS).then(() => false),
    ]);
    if (readyBeforeObservation) break;

    await assertLoadingSurface(page);
    const currentElapsed = Number(
      (await elapsed.textContent())?.match(/\d+/u)?.[0] ?? '0',
    );
    const currentHeadline = await headline.textContent();
    contentFreeAssert(
      currentElapsed > previousElapsed,
      'LOADING_ELAPSED_NOT_MONOTONIC',
    );
    contentFreeAssert(
      currentHeadline !== previousHeadline,
      'LOADING_HEADLINE_NOT_CYCLING',
    );

    const reducedMotion = await page.evaluate(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    if (!reducedMotion) {
      await page.bringToFront();
      const beforeMotion = await motionSnapshot(page);
      let becameReadyDuringMotionPoll = false;
      await expect
        .poll(
          async () => {
            becameReadyDuringMotionPoll = await page
              .getByRole('textbox', { name: 'Ask Egregore' })
              .isVisible();
            if (becameReadyDuringMotionPoll) return true;
            const afterMotion = await motionSnapshot(page);
            return (
              afterMotion.length === beforeMotion.length &&
              beforeMotion.some((value, index) => value !== afterMotion[index])
            );
          },
          {
            message: 'LOADING_PHASE_MOTION_NOT_CHANGING',
            intervals: [200, 400, 800, 1_200],
            timeout: LOADING_MOTION_TIMEOUT_MS,
          },
        )
        .toBe(true);
      if (becameReadyDuringMotionPoll) break;
    }

    if (
      performance.now() - activationStartedAt >=
      LOADING_REASSURANCE_AFTER_MS
    ) {
      await expect(reassurance).toHaveText(
        'First load may take a few minutes.',
      );
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
  contentFreeAssert(
    observation.finishedAt !== undefined,
    'ACTIVATION_REQUEST_INCOMPLETE',
  );
  return observation;
}

function requestDuration(observation: RequestObservation): number {
  contentFreeAssert(
    observation.finishedAt !== undefined,
    'REQUEST_TIMING_INCOMPLETE',
  );
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
  const modelRoots = observations.filter(
    ({ request }) =>
      request.url() === EGREGORE_MODEL.url && request.redirectedFrom() === null,
  );
  contentFreeAssert(modelRoots.length > 0, 'MODEL_REQUEST_MISSING');
  const modelTerminals = modelRoots.map(({ request }) => {
    const terminalObservation = ledger.observationFor(
      terminalRedirectRequest(request),
    );
    contentFreeAssert(
      terminalObservation?.finishedAt !== undefined,
      'MODEL_TRANSFER_INCOMPLETE',
    );
    return terminalObservation;
  });

  return {
    modelTransferStartedAt: Math.min(
      ...modelRoots.map(({ startedAt }) => startedAt),
    ),
    modelTransferFinishedAt: Math.max(
      ...modelTerminals.map(({ finishedAt }) => finishedAt!),
    ),
  };
}

function modelActivationTimeoutCode(
  ledger: RequestLedger,
  activationMark: number,
): string {
  const modelObservations = ledger
    .since(activationMark)
    .filter(({ request }) =>
      isTrustedModelOrigin(request.url(), EGREGORE_MODEL.trustedOrigins),
    );
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
  const composer = page.getByRole('textbox', { name: 'Ask Egregore' });
  const recoveryAction = page
    .getByTestId('activation-main')
    .getByRole('button', {
      name: /^(?:Return to load|Unload Egregore)$/u,
    });
  try {
    await expect(composer.or(recoveryAction)).toBeVisible({
      timeout: ACTIVATION_READY_TIMEOUT_MS,
    });
  } catch {
    const stillLoading = await page
      .getByTestId('loading-stack')
      .isVisible()
      .catch(() => false);
    throw new Error(
      stillLoading
        ? modelActivationTimeoutCode(ledger, activationMark)
        : 'ACTIVATION_TIMEOUT_UNKNOWN',
    );
  }
  contentFreeAssert(
    !(await recoveryAction.isVisible()),
    'ACTIVATION_LOAD_FAILED',
  );
  await expect(composer).toBeEnabled();
}

async function activationMeasurement(
  page: Page,
  ledger: RequestLedger,
  applicationOrigin: string,
  options: {
    sampleLoading: boolean;
    compatibilityMark: number;
    expectModelNetwork: boolean;
  },
): Promise<ActivationMeasurement> {
  const mark = ledger.mark();
  const startedAt = performance.now();
  await resetCacheObservation(page);
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
  await expect(page.getByTestId('lifecycle-visible-status')).toContainText(
    'Ready',
  );
  const readyAt = performance.now();
  const observations = ledger.since(mark);
  const cache = await cacheObservation(page);
  contentFreeAssert(!cache.instrumentationFailed, 'CACHE_OBSERVATION_FAILED');
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
  const modelNetworkRequests = observations.filter(({ request }) =>
    isTrustedModelOrigin(request.url(), EGREGORE_MODEL.trustedOrigins),
  );
  const modelTransfer = options.expectModelNetwork
    ? modelTransferWindow(observations, ledger)
    : null;
  if (modelTransfer !== null) {
    contentFreeAssert(
      readyAt >= modelTransfer.modelTransferFinishedAt,
      'MODEL_TRANSFER_FINISHED_AFTER_READY',
    );
  } else {
    contentFreeAssert(
      modelNetworkRequests.length === 0,
      'WARM_MODEL_NETWORK_REQUEST',
    );
    contentFreeAssert(
      cache.modelCacheWrites.length === 0,
      'WARM_MODEL_CACHE_WRITE',
    );
    contentFreeAssert(
      cache.modelCacheMatches.length > 0,
      'WARM_MODEL_CACHE_READ_MISSING',
    );
  }
  const manifestResponse = await manifestObservation.request.response();
  contentFreeAssert(
    manifestResponse !== null,
    'CORPUS_MANIFEST_RESPONSE_MISSING',
  );
  const manifest = (await manifestResponse.json()) as Record<string, unknown>;
  contentFreeAssert(
    typeof manifest.corpusVersion === 'string',
    'CORPUS_VERSION_MISSING',
  );
  contentFreeAssert(
    typeof manifest.indexConfigVersion === 'string',
    'INDEX_VERSION_MISSING',
  );
  await validateConsentAudit(
    page,
    ledger,
    options.compatibilityMark,
    applicationOrigin,
  );

  const cachePut = cache.modelCacheWrites.at(-1) ?? null;
  const cacheRereadCandidates = cache.modelCacheMatches.filter(
    (span) => cachePut === null || span.startedAt >= cachePut.finishedAt,
  );
  const cacheReread = cacheRereadCandidates.at(-1) ?? null;
  const wasmObservations = observations.filter(({ request }) =>
    new URL(request.url()).pathname.startsWith(EGREGORE_PATHS.liteRtWasm),
  );
  const wasmFinishedAt = wasmObservations.length
    ? Math.max(
        ...wasmObservations.map(({ finishedAt }) => finishedAt ?? readyAt),
      )
    : null;

  return {
    engineReadyMs: roundMilliseconds(readyAt - startedAt),
    corpusMs: requestDuration(contentObservation),
    indexMs: requestDuration(indexObservation),
    modelTransferMs:
      modelTransfer === null
        ? null
        : roundMilliseconds(
            modelTransfer.modelTransferFinishedAt -
              modelTransfer.modelTransferStartedAt,
          ),
    cachePutWallMs:
      cachePut === null
        ? null
        : roundMilliseconds(cachePut.finishedAt - cachePut.startedAt),
    cacheRereadMs:
      cacheReread === null
        ? null
        : roundMilliseconds(cacheReread.finishedAt - cacheReread.startedAt),
    liteRtWasmMs:
      wasmObservations.length === 0
        ? null
        : roundMilliseconds(
            Math.max(
              ...wasmObservations.map(
                ({ finishedAt }) => finishedAt ?? readyAt,
              ),
            ) - Math.min(...wasmObservations.map(({ startedAt }) => startedAt)),
          ),
    engineReadyAfterWasmMs:
      wasmFinishedAt === null
        ? null
        : roundMilliseconds(readyAt - wasmFinishedAt),
    corpusVersion: manifest.corpusVersion,
    indexConfigVersion: manifest.indexConfigVersion,
  };
}

function printActivation(
  label: 'cold' | 'warm',
  measurement: ActivationMeasurement,
): void {
  console.info(
    [
      'span=activation',
      `phase=${label}`,
      `engine-ready-ms=${measurement.engineReadyMs}`,
      `model-transfer-ms=${measurement.modelTransferMs ?? 'cache-reuse'}`,
      `corpus-ms=${measurement.corpusMs}`,
      `index-ms=${measurement.indexMs}`,
      `cache-put-wall-ms=${measurement.cachePutWallMs ?? 'not-observed'}`,
      'cache-put-wall-includes-streaming-transfer=true',
      `cache-reread-ms=${measurement.cacheRereadMs ?? 'not-observed'}`,
      `litert-wasm-ms=${measurement.liteRtWasmMs ?? 'not-observed'}`,
      `engine-ready-after-wasm-ms=${measurement.engineReadyAfterWasmMs ?? 'not-observed'}`,
      `corpus-version=${measurement.corpusVersion}`,
      `index-config-version=${measurement.indexConfigVersion}`,
      `runtime-config-version=${EGREGORE_MODEL.packageVersion}`,
    ].join(' '),
  );
}

async function activateButton(page: Page, button: Locator): Promise<void> {
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  const touchCapable = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (!touchCapable) {
    await button.click();
    return;
  }

  await button.evaluate((element) => {
    if (!(element instanceof HTMLButtonElement))
      throw new Error('QUALIFICATION_CONTROL_INVALID');
    const init: PointerEventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
    };
    element.dispatchEvent(new PointerEvent('pointerdown', init));
    element.dispatchEvent(new PointerEvent('pointerup', init));
    element.click();
  });
}

async function newSession(
  page: Page,
  source: 'header' | 'session-full' = 'header',
): Promise<void> {
  await activateButton(
    page,
    source === 'session-full'
      ? page.getByRole('button', { name: 'Start new session', exact: true })
      : page.getByRole('button', {
          name: /^(?:New session|Start a new session)$/u,
        }),
  );
  const composer = page.getByRole('textbox', { name: 'Ask Egregore' });
  await expect(composer).toBeEnabled();
  await expect(composer).toHaveValue('');
  await expect(page.getByTestId('conversation-scroller')).toHaveCount(0);
}

function sourcePath(sourceId: string): string {
  if (sourceId === 'profile:jet-sanchez') return '/about/';
  const separator = sourceId.indexOf(':');
  return `/${sourceId.slice(0, separator)}/${sourceId.slice(separator + 1)}/`;
}

type VisitorCaseOutcome = 'pending' | 'response' | 'session-full';

async function visitorCaseOutcome(
  page: Page,
  previousArticleCount: number,
): Promise<VisitorCaseOutcome> {
  return page.evaluate((priorCount) => {
    const sessionFullMessage =
      'The current session is full. Start a new session to continue.';
    if (document.body.textContent?.includes(sessionFullMessage)) {
      return 'session-full';
    }
    const articles = document.querySelectorAll(
      '[data-testid="conversation-scroller"] article',
    );
    if (articles.length <= priorCount) return 'pending';
    const response =
      articles.item(articles.length - 1).textContent?.trim() ?? '';
    return response !== '' && !response.includes('Reading the site locally')
      ? 'response'
      : 'pending';
  }, previousArticleCount);
}

async function responseAbstains(page: Page): Promise<boolean> {
  return page.evaluate((abstentionPrefix) => {
    const articles = document.querySelectorAll(
      '[data-testid="conversation-scroller"] article',
    );
    const response = articles.item(articles.length - 1).textContent ?? '';
    return response.trimStart().startsWith(abstentionPrefix);
  }, EGREGORE_ABSTENTION_PREFIX);
}

async function runVisitorCase(
  page: Page,
  visitorCase: VisitorCase,
  options: {
    requireDetailedSpans: boolean;
    requireLifecycleEvidence: boolean;
  },
): Promise<VisitorCaseResult> {
  const caseFailures: string[] = [];
  const observesQualificationEvents =
    options.requireDetailedSpans || options.requireLifecycleEvidence;
  const observationMark = observesQualificationEvents
    ? await qualificationObservationMark(page)
    : 0;
  const composer = page.getByRole('textbox', { name: 'Ask Egregore' });
  const previousArticleCount = await page
    .getByTestId('conversation-scroller')
    .locator('article')
    .count();
  await composer.fill(visitorCase.question);
  await activateButton(
    page,
    page.getByRole('button', { name: 'Send message' }),
  );
  await expect
    .poll(() => visitorCaseOutcome(page, previousArticleCount), {
      timeout: FIRST_TOKEN_TIMEOUT_MS,
    })
    .not.toBe('pending');
  const outcome = await visitorCaseOutcome(page, previousArticleCount);
  if (outcome === 'session-full') {
    console.info(`observation=session-boundary case=${visitorCase.id}`);
    return {
      failures: [],
      completedTokenCount: null,
      sessionFull: true,
    };
  }
  await expect(page.getByTestId('lifecycle-visible-status')).toContainText(
    'Ready',
    {
      timeout: RESPONSE_COMPLETION_TIMEOUT_MS,
    },
  );
  const observations = observesQualificationEvents
    ? await qualificationObservations(page, observationMark)
    : [];
  const tokenCounts = observations
    .filter(
      (
        observation,
      ): observation is QualificationObservation & { value: number } =>
        observation.observation === 'conversation-token-count' &&
        typeof observation.value === 'number',
    )
    .map(({ value }) => value);
  const createdConversation = observations.some(
    ({ observation }) => observation === 'conversation-created',
  );
  if (options.requireLifecycleEvidence && createdConversation) {
    if (tokenCounts.length > 0) {
      console.info(
        `observation=conversation-token-count checkpoint=session-created tokens=${tokenCounts[0]}`,
      );
    }
  }
  const completedTokenCount = tokenCounts.at(-1) ?? null;
  const detailedSpans = options.requireDetailedSpans
    ? await (async () => {
        const completedAt = await page.evaluate(() => performance.now());
        const retrievalStartedAt = observationTimestamp(
          observations,
          'retrieval-context-selection-start',
        );
        const retrievalFinishedAt = observationTimestamp(
          observations,
          'retrieval-context-selection-end',
        );
        const promptStartedAt = observationTimestamp(
          observations,
          'prompt-assembly-start',
        );
        const promptFinishedAt = observationTimestamp(
          observations,
          'prompt-assembly-end',
        );
        const sendAt = observationTimestamp(observations, 'generation-send');
        const firstNonemptyAt = observationTimestamp(
          observations,
          'generation-first-nonempty',
        );
        if (
          retrievalStartedAt === null ||
          retrievalFinishedAt === null ||
          promptStartedAt === null ||
          promptFinishedAt === null ||
          sendAt === null ||
          firstNonemptyAt === null
        ) {
          return null;
        }
        return {
          retrievalContextSelectionMs: roundMilliseconds(
            retrievalFinishedAt - retrievalStartedAt,
          ),
          promptAssemblyMs: roundMilliseconds(
            promptFinishedAt - promptStartedAt,
          ),
          sendToFirstNonemptyMs: roundMilliseconds(firstNonemptyAt - sendAt),
          totalGenerationMs: roundMilliseconds(completedAt - sendAt),
        };
      })()
    : null;

  const latestAssistant = page
    .getByTestId('conversation-scroller')
    .locator('article')
    .last();
  const inlineCitations = latestAssistant.getByRole('link', {
    name: /^\[S\d+\]/u,
  });
  const disclosure = latestAssistant.getByTestId('response-source-disclosure');
  const observedSourcePaths: string[] = [];
  if ((await disclosure.count()) > 0) {
    await disclosure.getByRole('button', { name: /sources?$/u }).click();
    const sourceLinks = disclosure
      .getByRole('region', { name: 'Sources for this response' })
      .getByRole('link');
    for (let index = 0; index < (await sourceLinks.count()); index += 1) {
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

      if ((await link.getAttribute('target')) !== '_blank') {
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
  const unacceptableSourcePresent = observedSourcePaths.some(
    (path) => !acceptablePaths.includes(path),
  );
  const unsupportedCitationPresent =
    inlineCitationCount > 0 || observedSourcePaths.length > 0;
  const citationResolved = visitorCase.mustAbstain
    ? !unsupportedCitationPresent
    : !expectedSourceMissing &&
      !unacceptableSourcePresent &&
      inlineCitationCount > 0;
  const abstention = await responseAbstains(page);

  if (visitorCase.mustAbstain) {
    if (unsupportedCitationPresent)
      caseFailures.push('CASE_UNSUPPORTED_CITATION_PRESENT');
    if (!abstention) caseFailures.push('CASE_ABSTENTION_MISSING');
  } else {
    if (expectedSourceMissing)
      caseFailures.push('CASE_EXPECTED_SOURCE_MISSING');
    if (unacceptableSourcePresent)
      caseFailures.push('CASE_UNACCEPTABLE_SOURCE');
    if (inlineCitationCount === 0)
      caseFailures.push('CASE_INLINE_CITATION_MISSING');
  }

  console.info(
    [
      'span=visitor-case',
      `case=${visitorCase.id}`,
      `conversation-token-count=${completedTokenCount ?? 'not-observed'}`,
      ...(detailedSpans === null
        ? ['qualification-spans=not-injected']
        : [
            `retrieval-context-selection-ms=${detailedSpans.retrievalContextSelectionMs}`,
            `prompt-assembly-ms=${detailedSpans.promptAssemblyMs}`,
            `send-to-first-nonempty-ms=${detailedSpans.sendToFirstNonemptyMs}`,
            `total-generation-ms=${detailedSpans.totalGenerationMs}`,
          ]),
      `citation-resolved=${citationResolved}`,
      `abstention=${abstention}`,
    ].join(' '),
  );
  await printQualificationCheckpoint(
    page,
    `turn-completed:${visitorCase.id}`,
    completedTokenCount,
  );
  return {
    failures: caseFailures,
    completedTokenCount,
    sessionFull: false,
  };
}

async function unloadAndAssertSettled(
  page: Page,
  requireLifecycleEvidence: boolean,
): Promise<void> {
  const observationMark = requireLifecycleEvidence
    ? await qualificationObservationMark(page)
    : 0;
  const deviceBefore = requireLifecycleEvidence
    ? await deviceObservation(page)
    : null;
  await activateButton(page, page.getByRole('button', { name: /Unload/ }));
  await expect(
    page.getByRole('button', { name: 'Check compatibility' }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Ask Egregore' })).toHaveCount(
    0,
  );
  await expect(page.getByTestId('conversation-scroller')).toHaveCount(0);

  if (requireLifecycleEvidence) {
    const observations = await qualificationObservations(page, observationMark);
    const evidence = {
      deviceDestroyCount: observationCount(observations, 'device-destroyed'),
      deviceReferenceClearCount: observationCount(
        observations,
        'device-reference-cleared',
      ),
      runtimeUnloadCount: observationCount(observations, 'runtime-unloaded'),
    };
    assertNoContractFailures(validateUnloadLifecycleEvidence(evidence));
    const deviceAfter = await deviceObservation(page);
    contentFreeAssert(
      deviceAfter.deviceDestroyCount - deviceBefore!.deviceDestroyCount === 1,
      'WEBGPU_DEVICE_DESTROY_CALL_COUNT_INVALID',
    );
    console.info(
      [
        'observation=runtime-unload',
        `device-destroyed=${evidence.deviceDestroyCount}`,
        `device-reference-cleared=${evidence.deviceReferenceClearCount}`,
        `runtime-unloaded=${evidence.runtimeUnloadCount}`,
        'browser-coherent=true',
      ].join(' '),
    );
  }
}

async function assertModelCacheStorageAbsent(page: Page): Promise<void> {
  const modelCacheNames = await page.evaluate(async () => {
    if (!('caches' in window)) throw new Error('CACHE_STORAGE_UNAVAILABLE');
    return (await window.caches.keys()).filter((name) =>
      name.startsWith('egregore-model-'),
    );
  });
  contentFreeAssert(modelCacheNames.length === 0, 'MODEL_CACHE_STILL_PRESENT');
  console.info('observation=cache-storage-removal result=absent');
}

async function assertCompatibilityDoesNotLoadAssistant(
  page: Page,
  ledger: RequestLedger,
  applicationOrigin: string,
): Promise<number> {
  const compatibilityMark = ledger.mark();
  await resetConsentAudit(page);
  await activateButton(
    page,
    page.getByRole('button', { name: 'Check compatibility' }),
  );
  await expect(
    page.getByRole('button', { name: /Load Egregore/ }),
  ).toBeVisible();
  assertNoAssistantRequestsSince(ledger, compatibilityMark, applicationOrigin);
  return compatibilityMark;
}

function assertNoAssistantRequestsSince(
  ledger: RequestLedger,
  compatibilityMark: number,
  applicationOrigin: string,
): void {
  contentFreeAssert(
    ledger
      .since(compatibilityMark)
      .every(
        ({ request }) => !assistantResourceRequest(request, applicationOrigin),
      ),
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
    if (!(element instanceof HTMLButtonElement))
      throw new Error('LOAD_CONTROL_INVALID');
    audit.loadInitiatedAt = performance.now();
    audit.loadInitiated = true;
    if (navigator.maxTouchPoints > 0) {
      const init: PointerEventInit = {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
      };
      element.dispatchEvent(new PointerEvent('pointerdown', init));
      element.dispatchEvent(new PointerEvent('pointerup', init));
    }
    element.click();
  });
}

async function runAccumulatingQualificationSequence(
  page: Page,
  visitorCases: readonly VisitorCase[],
  options: {
    requireDetailedSpans: boolean;
    requireLifecycleEvidence: boolean;
  },
): Promise<string[]> {
  const failures: string[] = [];
  const sequenceMark = await qualificationObservationMark(page);
  let sessionBoundaryCount = 0;
  await printQualificationCheckpoint(page, 'before-first-generation', null);

  for (const visitorCase of visitorCases) {
    let result = await runVisitorCase(page, visitorCase, options);
    if (result.sessionFull) {
      sessionBoundaryCount += 1;
      await newSession(page, 'session-full');
      result = await runVisitorCase(page, visitorCase, options);
      contentFreeAssert(!result.sessionFull, 'SESSION_BOUNDARY_RETRY_FAILED');
    }
    failures.push(
      ...result.failures.map((failure) => `${visitorCase.id}:${failure}`),
    );
  }

  const initialSequence = await qualificationObservations(page, sequenceMark);
  contentFreeAssert(
    observationCount(initialSequence, 'conversation-created') ===
      sessionBoundaryCount + 1 &&
      observationCount(initialSequence, 'conversation-reset') ===
        sessionBoundaryCount,
    'ACCUMULATING_CONVERSATION_REPLACED',
  );

  const stopRecoveryMark = await qualificationObservationMark(page);
  const composer = page.getByRole('textbox', { name: 'Ask Egregore' });
  await composer.fill(CLOSEOUT_PROMPT_SENTINEL);
  await activateButton(
    page,
    page.getByRole('button', { name: 'Send message' }),
  );
  await expect(page.getByRole('button', { name: 'Stop response' })).toBeVisible(
    {
      timeout: FIRST_TOKEN_TIMEOUT_MS,
    },
  );
  await activateButton(
    page,
    page.getByRole('button', { name: 'Stop response' }),
  );
  await expect(page.getByText('Stopped', { exact: true })).toBeVisible({
    timeout: RESPONSE_COMPLETION_TIMEOUT_MS,
  });
  await expect(page.getByTestId('lifecycle-visible-status')).toContainText(
    'Ready',
    {
      timeout: RESPONSE_COMPLETION_TIMEOUT_MS,
    },
  );
  await printQualificationCheckpoint(page, 'stop-completed', null);

  const recoveryCase = visitorCases[0];
  contentFreeAssert(recoveryCase !== undefined, 'RECOVERY_CASE_MISSING');
  const recoveryResult = await runVisitorCase(page, recoveryCase, options);
  contentFreeAssert(!recoveryResult.sessionFull, 'STOP_RECOVERY_SESSION_FULL');
  failures.push(
    ...recoveryResult.failures.map((failure) => `recovery:${failure}`),
  );
  const stopRecoveryObservations = await qualificationObservations(
    page,
    stopRecoveryMark,
  );
  contentFreeAssert(
    observationCount(stopRecoveryObservations, 'conversation-created') === 0 &&
      observationCount(stopRecoveryObservations, 'conversation-reset') === 0,
    'STOP_RECOVERY_REPLACED_CONVERSATION',
  );
  const accumulatedWithRecovery = await qualificationObservations(
    page,
    sequenceMark,
  );
  contentFreeAssert(
    observationCount(accumulatedWithRecovery, 'conversation-created') ===
      sessionBoundaryCount + 1 &&
      observationCount(accumulatedWithRecovery, 'conversation-reset') ===
        sessionBoundaryCount,
    'STOP_RECOVERY_REPLACED_CONVERSATION',
  );
  console.info(
    'observation=stop-recovery conversation-replaced=false recovery-completed=true',
  );

  const resetMark = await qualificationObservationMark(page);
  await newSession(page);
  const resetObservations = await qualificationObservations(page, resetMark);
  contentFreeAssert(
    observationCount(resetObservations, 'conversation-reset') === 1 &&
      observationCount(resetObservations, 'conversation-created') === 0,
    'NEW_SESSION_RESET_EVIDENCE_INVALID',
  );

  const replacementMark = await qualificationObservationMark(page);
  const replacementResult = await runVisitorCase(page, recoveryCase, options);
  contentFreeAssert(!replacementResult.sessionFull, 'REPLACEMENT_SESSION_FULL');
  failures.push(
    ...replacementResult.failures.map((failure) => `replacement:${failure}`),
  );
  const replacementObservations = await qualificationObservations(
    page,
    replacementMark,
  );
  contentFreeAssert(
    observationCount(replacementObservations, 'conversation-created') === 1,
    'REPLACEMENT_CONVERSATION_NOT_CREATED',
  );
  contentFreeAssert(
    observationCount(replacementObservations, 'conversation-reset') === 0,
    'REPLACEMENT_CONVERSATION_RESET_UNEXPECTED',
  );
  console.info(
    'observation=new-session replacement-created-on-first-send=true replacement-count=1',
  );

  return failures;
}

async function applyFinalCacheDisposition(
  page: Page,
  contract: QualificationRunContract,
): Promise<void> {
  await assertReadableCommittedModelCache(page);
  if (contract.cacheDisposition === 'preserve') {
    console.info('observation=final-cache-disposition result=preserved');
    return;
  }

  const removeDownloadedModel = page.getByRole('button', {
    name: 'Remove downloaded model',
  });
  await expect(removeDownloadedModel).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await removeDownloadedModel.click();
  await expect(page.getByText('Downloaded model removed.')).toBeVisible();
  await assertModelCacheStorageAbsent(page);
}

function hasApplicationDefinedHeader(headers: Record<string, string>): boolean {
  return Object.keys(headers).some((rawName) => {
    const name = rawName.toLowerCase();
    return /^(?:authorization|proxy-authorization|api[-_]?key|apikey|x-)/u.test(
      name,
    );
  });
}

function isAnalyticsRequest(url: URL): boolean {
  if (url.protocol !== 'https:' || url.port !== '') return false;
  if (url.origin === 'https://www.googletagmanager.com') {
    return url.pathname === '/gtag/js';
  }
  return (
    [
      'https://www.google-analytics.com',
      'https://analytics.google.com',
      'https://region1.google-analytics.com',
    ].includes(url.origin) && /^\/(?:g\/)?collect$/u.test(url.pathname)
  );
}

function isPartytownTransport(url: URL, applicationOrigin: string): boolean {
  return (
    url.origin === applicationOrigin &&
    url.pathname === '/~partytown/proxytown' &&
    url.search === ''
  );
}

function validateAnalyticsRequest(
  request: Request,
  url: URL,
  headers: Record<string, string>,
  body: string | null,
): void {
  const tagScript = url.origin === 'https://www.googletagmanager.com';
  contentFreeAssert(
    tagScript
      ? request.method() === 'GET'
      : ['GET', 'POST'].includes(request.method()),
    'ANALYTICS_METHOD_FORBIDDEN',
  );
  if (tagScript || request.method() === 'GET') {
    contentFreeAssert(body === null, 'ANALYTICS_BODY_FORBIDDEN');
  }
  contentFreeAssert(
    !hasApplicationDefinedHeader(headers),
    'ANALYTICS_HEADER_FORBIDDEN',
  );
  contentFreeAssert(
    headers.authorization === undefined,
    'ANALYTICS_AUTHORIZATION_FORBIDDEN',
  );
}

function validatePartytownTransport(
  request: Request,
  headers: Record<string, string>,
  body: string | null,
): void {
  contentFreeAssert(
    request.method() === 'POST',
    'PARTYTOWN_TRANSPORT_METHOD_FORBIDDEN',
  );
  contentFreeAssert(body !== null, 'PARTYTOWN_TRANSPORT_BODY_MISSING');
  contentFreeAssert(
    headers['content-type']?.startsWith('text/plain') === true,
    'PARTYTOWN_TRANSPORT_CONTENT_TYPE_INVALID',
  );
  contentFreeAssert(
    !hasApplicationDefinedHeader(headers),
    'PARTYTOWN_TRANSPORT_HEADER_FORBIDDEN',
  );
  contentFreeAssert(
    headers.authorization === undefined,
    'PARTYTOWN_TRANSPORT_AUTHORIZATION_FORBIDDEN',
  );

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error('PARTYTOWN_TRANSPORT_SCHEMA_INVALID');
  }
  const record = payload as { F?: unknown; Q?: unknown };
  contentFreeAssert(
    typeof record.F === 'string' &&
      Array.isArray(record.Q) &&
      Object.keys(record).every((key) => key === 'F' || key === 'Q'),
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
      headers:
        headers.range === undefined ? undefined : { range: headers.range },
      body: request.postData() ?? undefined,
    },
    response: {
      status: response.status(),
      ...(location === undefined ? {} : { location }),
    },
  };
}

async function validateModelChains(
  observations: RequestObservation[],
): Promise<void> {
  const requests = observations.map(({ request }) => request);
  const modelRequests = requests.filter((request) =>
    isTrustedModelOrigin(request.url(), EGREGORE_MODEL.trustedOrigins),
  );
  const roots = modelRequests.filter(
    (request) => request.redirectedFrom() === null,
  );
  contentFreeAssert(roots.length > 0, 'MODEL_CHAIN_MISSING');

  for (const request of modelRequests) {
    let root = request;
    while (root.redirectedFrom() !== null) root = root.redirectedFrom()!;
    contentFreeAssert(
      root.url() === EGREGORE_MODEL.url,
      'MODEL_CHAIN_ROOT_CHANGED',
    );
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
  requireModelDeliveryChain: boolean,
): Promise<void> {
  const deploymentProtectionSecret =
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const deploymentProtectionBypassEnabled =
    deploymentProtectionSecret !== undefined &&
    deploymentProtectionSecret.trim() !== '';
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
    contentFreeAssert(
      url.hostname !== 'cdn.jsdelivr.net',
      'SDK_CDN_REQUEST_FORBIDDEN',
    );

    const sameOrigin =
      ['http:', 'https:'].includes(url.protocol) &&
      url.origin === applicationOrigin;
    const corpus =
      sameOrigin &&
      CORPUS_PATHS.includes(url.pathname as (typeof CORPUS_PATHS)[number]);
    const applicationChunk = sameOrigin && url.pathname.startsWith('/_astro/');
    const runtimeFilename =
      sameOrigin && url.pathname.startsWith(EGREGORE_PATHS.liteRtWasm)
        ? url.pathname.slice(EGREGORE_PATHS.liteRtWasm.length)
        : undefined;
    const runtimeAsset =
      runtimeFilename !== undefined &&
      !runtimeFilename.includes('/') &&
      runtimeAssets.has(runtimeFilename);
    const documentRequest =
      sameOrigin && [EGREGORE_PATH, ROUTE_AWAY_PATH].includes(url.pathname);
    const model = isTrustedModelOrigin(url.href, EGREGORE_MODEL.trustedOrigins);
    const analytics = isAnalyticsRequest(url);
    const partytownTransport = isPartytownTransport(url, applicationOrigin);
    const partytownBlobScript = isPartytownBlobScript(
      request,
      url,
      applicationOrigin,
    );
    const partytownSandboxDocument = isPartytownSandboxDocument(
      request,
      url,
      applicationOrigin,
    );

    contentFreeAssert(
      corpus ||
        applicationChunk ||
        runtimeAsset ||
        documentRequest ||
        model ||
        analytics ||
        partytownTransport ||
        partytownBlobScript ||
        partytownSandboxDocument,
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
      contentFreeAssert(
        !hasApplicationDefinedHeader(headers),
        'CUSTOM_HEADER_FORBIDDEN',
      );
    }
    if (corpus || applicationChunk || runtimeAsset || documentRequest) {
      contentFreeAssert(
        url.search === '',
        'VARIABLE_APPLICATION_REQUEST_FORBIDDEN',
      );
    }
    if (corpus) {
      contentFreeAssert(
        isAllowedDeploymentProtectionCookie(
          headers.cookie,
          deploymentProtectionBypassEnabled,
        ),
        'ASSISTANT_COOKIE_FORBIDDEN',
      );
      contentFreeAssert(
        headers.authorization === undefined,
        'ASSISTANT_AUTHORIZATION_FORBIDDEN',
      );
    }
    if (model) {
      contentFreeAssert(
        headers.cookie === undefined,
        'ASSISTANT_COOKIE_FORBIDDEN',
      );
      contentFreeAssert(
        headers.authorization === undefined,
        'ASSISTANT_AUTHORIZATION_FORBIDDEN',
      );
    }
  }

  if (requireModelDeliveryChain) {
    await validateModelChains(ledger.observations);
  } else {
    contentFreeAssert(
      ledger.observations.every(
        ({ request }) =>
          !isTrustedModelOrigin(request.url(), EGREGORE_MODEL.trustedOrigins),
      ),
      'WARM_MODEL_NETWORK_REQUEST',
    );
  }
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
  const manifest = (await response.json()) as Record<string, unknown>;
  contentFreeAssert(
    typeof manifest.corpusVersion === 'string',
    'CORPUS_VERSION_MISSING',
  );
  contentFreeAssert(
    typeof manifest.indexConfigVersion === 'string',
    'INDEX_VERSION_MISSING',
  );
  console.info(
    [
      `corpus-version=${manifest.corpusVersion}`,
      `index-config-version=${manifest.indexConfigVersion}`,
      `runtime-config-version=${EGREGORE_MODEL.packageVersion}`,
    ].join(' '),
  );
}

async function printEnvironment(
  browser: Browser,
  page: Page,
  mode: RealModelMode,
): Promise<void> {
  const device = await deviceObservation(page);
  contentFreeAssert(
    !device.instrumentationFailed,
    'WEBGPU_INSTRUMENTATION_FAILED',
  );
  contentFreeAssert(
    device.deviceRequestCount > 0,
    'WEBGPU_DEVICE_REQUEST_NOT_OBSERVED',
  );
  const adapters = device.adapterIdentifiers
    .map(sanitizeIdentifier)
    .filter((value): value is string => value !== undefined);
  console.info(
    [
      `mode=${mode}`,
      `browser=${sanitizeIdentifier(browser.version()) ?? 'unavailable'}`,
      `macos=${macOsVersion()}`,
      `adapter=${adapters.join(',') || 'unavailable'}`,
    ].join(' '),
  );
  console.info(
    [
      'observation=memory-thermal',
      `js-heap-used-bytes=${device.jsHeapUsedBytes ?? 'not-exposed'}`,
      `device-memory-gib=${device.deviceMemoryGiB ?? 'not-exposed'}`,
      `thermal-state=${device.thermalState}`,
      `device-destroy-count=${device.deviceDestroyCount}`,
      `renderer-termination=${
        device.deviceLossCount === 0 ? 'not-observed' : 'device-loss-observed'
      }`,
    ].join(' '),
  );
}

test.skip(
  process.env.RUN_REAL_MODEL !== '1',
  'Set RUN_REAL_MODEL=1 for the 2 GB WebGPU qualification',
);

test('qualifies Egregore with the real local model', async ({ playwright }) => {
  rejectExternalProfile();
  const removalValue = process.env.EGREGORE_REMOVE_MODEL_AFTER_QUALIFICATION;
  contentFreeAssert(
    removalValue === undefined || removalValue === '1',
    'REMOVE_MODEL_FLAG_INVALID',
  );
  const contract = resolveQualificationRunContract({
    mode: process.env.EGREGORE_REAL_MODEL_MODE,
    cdpEndpoint: process.env.EGREGORE_CDP_ENDPOINT,
    removeDownloadedModel: removalValue === '1',
  });
  const mode = contract.mode;
  if (
    mode !== 'smoke' &&
    (process.platform !== 'darwin' || process.arch !== 'arm64')
  ) {
    throw new Error('QUALIFICATION_REQUIRES_APPLE_SILICON_MAC');
  }

  const applicationBaseUrl =
    process.env.REAL_MODEL_BASE_URL ?? 'http://127.0.0.1:4322';
  const detailedSpansRequired = localQualificationSpansRequired(
    process.env.REAL_MODEL_BASE_URL,
  );
  if (mode !== 'smoke') {
    contentFreeAssert(
      detailedSpansRequired,
      'QUALIFICATION_REQUIRES_LOCAL_INSTRUMENTED_BUILD',
    );
  }

  let activeBrowser: Browser;
  let activePage: Page;
  let closeLocalBrowser = false;
  if (contract.cdpEndpoint !== undefined) {
    activeBrowser = await playwright.chromium.connectOverCDP(
      contract.cdpEndpoint,
    );
    const existingContext = activeBrowser.contexts()[0];
    contentFreeAssert(
      existingContext !== undefined,
      'WARM_RESUME_BROWSER_CONTEXT_MISSING',
    );
    activePage = await existingContext.newPage();
  } else {
    activeBrowser = await playwright.chromium.launch({
      channel: 'chrome',
      headless: false,
    });
    closeLocalBrowser = true;
    activePage = await (await activeBrowser.newContext()).newPage();
  }

  try {
    await establishDeploymentProtectionBypass(
      activePage.context(),
      new URL(applicationBaseUrl).origin,
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    );
    await installDeviceObservation(activePage);
    await installCacheObservation(activePage);
    if (detailedSpansRequired) await installQualificationObserver(activePage);
    await installConsentAudit(activePage);
    await activePage.goto(new URL(EGREGORE_PATH, applicationBaseUrl).href);
    if (contract.storagePrecondition === 'fresh') {
      await assertFreshApplicationStorage(activePage);
    } else {
      await assertReadableCommittedModelCache(activePage);
    }
    const applicationOrigin = new URL(activePage.url()).origin;
    const ledger = new RequestLedger(activePage);
    const visitorCaseFailures: string[] = [];
    let compatibilityMark = await assertCompatibilityDoesNotLoadAssistant(
      activePage,
      ledger,
      applicationOrigin,
    );
    const lifecycleEvidenceRequired = mode !== 'smoke';

    if (contract.activationPath !== 'smoke') {
      const qualificationCases = orderQualificationCases(VISITOR_CASES);
      if (contract.activationPath === 'cold-then-warm') {
        console.info('phase=cold-activation');
        const cold = await activationMeasurement(
          activePage,
          ledger,
          applicationOrigin,
          {
            sampleLoading: true,
            compatibilityMark,
            expectModelNetwork: true,
          },
        );
        printActivation('cold', cold);
        console.info('phase=cold-qualification-interaction');
        const coldSequenceMark = await qualificationObservationMark(activePage);
        const coldResult = await runVisitorCase(
          activePage,
          qualificationCases[0]!,
          {
            requireDetailedSpans: detailedSpansRequired,
            requireLifecycleEvidence: lifecycleEvidenceRequired,
          },
        );
        visitorCaseFailures.push(
          ...coldResult.failures.map(
            (failure) => `cold:${qualificationCases[0]!.id}:${failure}`,
          ),
        );
        const coldSequence = await qualificationObservations(
          activePage,
          coldSequenceMark,
        );
        contentFreeAssert(
          observationCount(coldSequence, 'conversation-created') === 1 &&
            observationCount(coldSequence, 'conversation-reset') === 0,
          'COLD_CONVERSATION_REPLACED',
        );
        await unloadAndAssertSettled(activePage, lifecycleEvidenceRequired);
        await assertReadableCommittedModelCache(activePage);
        compatibilityMark = await assertCompatibilityDoesNotLoadAssistant(
          activePage,
          ledger,
          applicationOrigin,
        );
      }

      const warmRequestMark = ledger.mark();
      console.info(
        contract.activationPath === 'warm-only'
          ? 'phase=warm-resume-activation'
          : 'phase=warm-activation',
      );
      const warm = await activationMeasurement(
        activePage,
        ledger,
        applicationOrigin,
        {
          sampleLoading: false,
          compatibilityMark,
          expectModelNetwork: false,
        },
      );
      printActivation('warm', warm);
      console.info('phase=accumulating-warm-qualification-sequence');
      visitorCaseFailures.push(
        ...(
          await runAccumulatingQualificationSequence(
            activePage,
            qualificationCases,
            {
              requireDetailedSpans: detailedSpansRequired,
              requireLifecycleEvidence: lifecycleEvidenceRequired,
            },
          )
        ).map((failure) => `warm:${failure}`),
      );
      await unloadAndAssertSettled(activePage, lifecycleEvidenceRequired);
      await applyFinalCacheDisposition(activePage, contract);
      assertNoModelNetworkRequestsSince(ledger, warmRequestMark);
    } else {
      console.info('phase=smoke-activation');
      const smokeActivationMark = ledger.mark();
      await clickLoadAfterConsentAudit(
        activePage,
        ledger,
        applicationOrigin,
        compatibilityMark,
      );
      await waitForActivationReady(activePage, ledger, smokeActivationMark);
      await validateConsentAudit(
        activePage,
        ledger,
        compatibilityMark,
        applicationOrigin,
      );
      await printSmokeVersions(ledger, smokeActivationMark, applicationOrigin);
      const smokeCases = SMOKE_CASE_IDS.map((id) =>
        VISITOR_CASES.find((item) => item.id === id),
      );
      contentFreeAssert(
        smokeCases.every((item) => item !== undefined),
        'SMOKE_CASE_MISSING',
      );
      for (const visitorCase of smokeCases) {
        const result = await runVisitorCase(activePage, visitorCase!, {
          requireDetailedSpans: detailedSpansRequired,
          requireLifecycleEvidence: false,
        });
        visitorCaseFailures.push(
          ...result.failures.map((failure) => `${visitorCase!.id}:${failure}`),
        );
      }
      await unloadAndAssertSettled(activePage, false);
    }

    await validateRequestPrivacy(
      ledger,
      applicationOrigin,
      contract.activationPath !== 'warm-only',
    );
    await printEnvironment(activeBrowser, activePage, mode);
    const device = await deviceObservation(activePage);
    console.info(
      [
        `mode=${mode}`,
        'privacy=pass',
        'lifecycle=pass',
        `device-loss-count=${device.deviceLossCount}`,
      ].join(' '),
    );
    contentFreeAssert(
      visitorCaseFailures.length === 0,
      `VISITOR_CASES_FAILED_${visitorCaseFailures.join('_')}`,
    );
  } finally {
    if (closeLocalBrowser) {
      await activeBrowser.close().catch(() => undefined);
    } else {
      await activePage.close().catch(() => undefined);
    }
  }
});
