import { describe, expect, it } from 'vitest';

import {
  createAuditedRuntime,
  FakeRuntime,
  FakeRuntimeRecorder,
} from '../../../src/features/egregore/runtime/fakeRuntime';
import {
  FAKE_SCENARIOS,
  configureFakeCitationSelection,
  configureFakeSourceSentinel,
  getFakeScenarioConfiguration,
  resolveFakeScenario,
} from '../../../src/features/egregore/runtime/fakeScenario';
import type { SelectionResult } from '../../../src/features/egregore/selection/types';

describe('Egregore fake browser scenarios', () => {
  it('admits only an allowlisted scenario in an explicit local test build', () => {
    const enabled = {
      testBuild: true,
      hostname: '127.0.0.1',
    } as const;

    expect(
      resolveFakeScenario({
        ...enabled,
        search: '?runtime=fake&scenario=citations',
      }),
    ).toEqual({ scenario: 'citations', slowStream: false });
    expect(
      resolveFakeScenario({
        ...enabled,
        search:
          '?runtime=fake&scenario=not-allowlisted&prompt=PRIVATE&source=PRIVATE',
      }),
    ).toEqual({ scenario: 'default', slowStream: false });
    expect(
      resolveFakeScenario({
        ...enabled,
        search: '?runtime=fake&stream=slow&prompt=PRIVATE&source=PRIVATE',
      }),
    ).toEqual({ scenario: 'default', slowStream: true });

    expect(
      resolveFakeScenario({
        ...enabled,
        search: '?scenario=citations',
      }),
    ).toBeNull();
    expect(
      resolveFakeScenario({
        testBuild: false,
        hostname: '127.0.0.1',
        search: '?runtime=fake&scenario=citations',
      }),
    ).toBeNull();
    expect(
      resolveFakeScenario({
        testBuild: true,
        hostname: 'jetsanchez.com',
        search: '?runtime=fake&scenario=citations',
      }),
    ).toBeNull();
    expect(
      resolveFakeScenario({
        ...enabled,
        pathname: '/chatbot/',
        search: '',
        sessionAuthorized: true,
      }),
    ).toEqual({ scenario: 'default', slowStream: false });
    expect(
      resolveFakeScenario({
        ...enabled,
        pathname: '/about/',
        search: '',
        sessionAuthorized: true,
      }),
    ).toBeNull();

    expect(FAKE_SCENARIOS).toEqual([
      'default',
      'checking',
      'unsupported',
      'load-failure',
      'generation-failure',
      'reset-failure',
      'unload-failure',
      'loading',
      'unloading',
      'cached',
      'crossfade',
      'long-stream',
      'stop-recovery',
      'citations',
      'zero-citation',
      'exhaustion',
      'late-event',
    ]);
  });

  it('maps the allowlist to fixed behavior without accepting payload configuration', () => {
    expect(getFakeScenarioConfiguration('checking')).toMatchObject({
      capabilityDelayMs: 60_000,
    });
    expect(getFakeScenarioConfiguration('unsupported')).toMatchObject({
      failures: { capability: true },
    });
    expect(getFakeScenarioConfiguration('load-failure')).toMatchObject({
      failures: { load: 1 },
    });
    expect(getFakeScenarioConfiguration('generation-failure')).toMatchObject({
      failures: { generation: 1 },
    });
    expect(getFakeScenarioConfiguration('reset-failure')).toMatchObject({
      failures: { reset: 1 },
    });
    expect(getFakeScenarioConfiguration('unload-failure')).toMatchObject({
      failures: { unload: 1 },
    });
    expect(getFakeScenarioConfiguration('loading')).toMatchObject({
      loadDelayMs: 60_000,
    });
    expect(getFakeScenarioConfiguration('unloading')).toMatchObject({
      unloadDelayMs: 5_000,
    });
    expect(getFakeScenarioConfiguration('cached')).toMatchObject({
      modelCached: true,
    });
    expect(getFakeScenarioConfiguration('crossfade')).toMatchObject({
      capabilityDelayMs: 50,
      loadDelayMs: 650,
    });
    expect(getFakeScenarioConfiguration('long-stream')).toMatchObject({
      chunkDelayMs: 120,
    });
    expect(getFakeScenarioConfiguration('stop-recovery')).toMatchObject({
      chunkDelayMs: 120,
    });
    expect(
      getFakeScenarioConfiguration('citations').responseChunks.join(''),
    ).toMatch(/\[S2\][\s\S]*\[S1\][\s\S]*\[S2\]/);
    expect(
      getFakeScenarioConfiguration('zero-citation').responseChunks.join(''),
    ).not.toMatch(/\[S\d+\]/);
    expect(getFakeScenarioConfiguration('exhaustion')).toMatchObject({
      exhaustAfterCompletedGenerations: 1,
    });
    expect(getFakeScenarioConfiguration('late-event')).toMatchObject({
      chunkDelayMs: 120,
      emitLateChunkAfterCancellation: true,
    });

    expect(JSON.stringify(getFakeScenarioConfiguration('default'))).not.toMatch(
      /prompt|sourcePayload|PRIVATE/i,
    );
    expect(getFakeScenarioConfiguration('default')).toMatchObject({
      capabilityDelayMs: 50,
    });
  });

  it('records a content-free resource lifecycle with one runtime identity', async () => {
    const recorder = new FakeRuntimeRecorder(7);
    const runtime = new FakeRuntime({
      testOnly: true,
      recorder,
      recordResourceLifecycle: true,
      responseChunks: ['PRIVATE_RESPONSE'],
    });

    await runtime.checkCapabilities();
    recorder.record('repository.load');
    await runtime.load({ modelSource: 'test-model' });
    await runtime.createSession([
      { role: 'system', content: 'PRIVATE_PREFACE' },
    ]);
    await runtime.generate('PRIVATE_PROMPT', { onText: () => undefined });
    await runtime.reset();
    recorder.record('repository.unload');
    await runtime.unload();

    expect(runtime.calls.map(({ method }) => method)).toEqual([
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
    expect(runtime.calls.every(({ runtimeId }) => runtimeId === 7)).toBe(true);
    expect(runtime.calls.map(({ operationId }) => operationId)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(Object.isFrozen(runtime.calls)).toBe(true);
    expect(runtime.calls.every(Object.isFrozen)).toBe(true);
    expect(JSON.stringify(runtime.calls)).not.toMatch(
      /PRIVATE|prompt|preface|response/i,
    );
  });

  it('keeps one fake conversation active until the session is reset', async () => {
    const runtime = new FakeRuntime({
      testOnly: true,
      responseChunks: ['A grounded answer.'],
    });

    await runtime.load({ modelSource: 'test-model' });
    await runtime.createSession([
      { role: 'system', content: 'Use the published corpus.' },
    ]);
    await runtime.generate('First question', { onText: () => undefined });
    await runtime.generate('Second question', { onText: () => undefined });
    const tokenCountBeforeRejectedReplacement =
      await runtime.getConversationTokenCount();

    await expect(
      runtime.createSession([
        { role: 'system', content: 'Replace the active conversation.' },
      ]),
    ).rejects.toMatchObject({ code: 'generation-failed' });
    await expect(runtime.getConversationTokenCount()).resolves.toBe(
      tokenCountBeforeRejectedReplacement,
    );

    await runtime.reset();
    await expect(
      runtime.createSession([
        { role: 'system', content: 'Start a fresh conversation.' },
      ]),
    ).resolves.toBeUndefined();
    await expect(runtime.getConversationTokenCount()).resolves.toBeGreaterThan(
      0,
    );
  });

  it('audits every production-runtime method without recording method payloads', async () => {
    const forwarded: string[] = [];
    const recorder = new FakeRuntimeRecorder(11);
    const runtime = createAuditedRuntime(
      {
        checkCapabilities: async () => {
          forwarded.push('checkCapabilities');
          return {
            supported: true,
            warnings: [],
            failures: [],
            secureContext: true,
            webGpuAvailable: true,
            adapterAvailable: true,
            browser: { family: 'unknown', version: null },
            storageEstimate: null,
          };
        },
        load: async () => {
          forwarded.push('load');
        },
        createSession: async () => {
          forwarded.push('createSession');
        },
        getConversationTokenCount: async () => {
          forwarded.push('getConversationTokenCount');
          return 17;
        },
        generate: async () => {
          forwarded.push('generate');
          return { finishReason: 'completed' };
        },
        cancel: () => {
          forwarded.push('cancel');
        },
        reset: async () => {
          forwarded.push('reset');
        },
        unload: async () => {
          forwarded.push('unload');
        },
      },
      recorder,
    );

    await runtime.checkCapabilities();
    await runtime.load({
      modelSource: 'test-model',
      onPhase: () => undefined,
    });
    await runtime.createSession([
      { role: 'system', content: 'PRIVATE_PREFACE' },
    ]);
    await expect(runtime.getConversationTokenCount()).resolves.toBe(17);
    await runtime.generate('PRIVATE_PROMPT', { onText: () => undefined });
    runtime.cancel();
    await runtime.reset();
    await runtime.unload();

    expect(forwarded).toEqual([
      'checkCapabilities',
      'load',
      'createSession',
      'getConversationTokenCount',
      'generate',
      'cancel',
      'reset',
      'unload',
    ]);
    expect(recorder.calls.map(({ method }) => method)).toEqual(forwarded);
    expect(recorder.calls.map((call) => Object.keys(call).sort())).toEqual(
      forwarded.map(() => ['method', 'operationId', 'runtimeId']),
    );
    expect(JSON.stringify(recorder.calls)).not.toMatch(/PRIVATE/);
  });

  it('consumes numeric failures once so keyboard recovery can succeed', async () => {
    const runtime = new FakeRuntime({
      testOnly: true,
      failures: {
        generation: 1,
        reset: 1,
        unload: 1,
      },
    });

    await expect(
      runtime.generate('first', { onText: () => undefined }),
    ).rejects.toMatchObject({ code: 'generation-failed' });
    await expect(
      runtime.generate('second', { onText: () => undefined }),
    ).resolves.toEqual({ finishReason: 'completed' });
    await expect(runtime.reset()).rejects.toMatchObject({
      code: 'engine-cleanup-failed',
    });
    await expect(runtime.reset()).resolves.toBeUndefined();
    await expect(runtime.unload()).rejects.toMatchObject({
      code: 'engine-cleanup-failed',
    });
    await expect(runtime.unload()).resolves.toBeUndefined();
  });

  it('keeps load and unload resources pending until their deterministic scheduler releases', async () => {
    let releaseLoad!: () => void;
    let releaseUnload!: () => void;
    const loadWait = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    const unloadWait = new Promise<void>((resolve) => {
      releaseUnload = resolve;
    });
    const runtime = new FakeRuntime({
      testOnly: true,
      recordResourceLifecycle: true,
      scheduler: {
        waitForChunk: async () => undefined,
        waitForLoad: async () => loadWait,
        waitForUnload: async () => unloadWait,
      },
    });

    let loadSettled = false;
    const loading = runtime.load({ modelSource: 'test-model' }).then(() => {
      loadSettled = true;
    });
    await Promise.resolve();
    expect(loadSettled).toBe(false);
    expect(runtime.calls.map(({ method }) => method)).toEqual(['runtime.load']);
    releaseLoad();
    await loading;
    expect(runtime.calls.map(({ method }) => method)).toEqual([
      'runtime.load',
      'engine.create',
    ]);

    let unloadSettled = false;
    const unloading = runtime.unload().then(() => {
      unloadSettled = true;
    });
    await Promise.resolve();
    expect(unloadSettled).toBe(false);
    expect(runtime.calls.map(({ method }) => method)).not.toContain(
      'engine.delete',
    );
    releaseUnload();
    await unloading;
    expect(runtime.calls.map(({ method }) => method).slice(-2)).toEqual([
      'engine.delete',
      'sdk.unload',
    ]);
  });

  it('keeps capability checking pending until its deterministic scheduler releases', async () => {
    let releaseCapability!: () => void;
    const capabilityWait = new Promise<void>((resolve) => {
      releaseCapability = resolve;
    });
    const runtime = new FakeRuntime({
      testOnly: true,
      scheduler: {
        waitForChunk: async () => undefined,
        waitForCapability: async () => capabilityWait,
      },
    });

    let settled = false;
    const checking = runtime.checkCapabilities().then((report) => {
      settled = true;
      return report;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(runtime.calls.map(({ method }) => method)).toEqual([
      'checkCapabilities',
    ]);
    releaseCapability();
    await expect(checking).resolves.toMatchObject({ supported: true });
  });

  it('can deliberately emit one late chunk so the controller proves stale-event suppression', async () => {
    let releaseChunk!: () => void;
    const chunkWait = new Promise<void>((resolve) => {
      releaseChunk = resolve;
    });
    const chunks: string[] = [];
    const runtime = new FakeRuntime({
      testOnly: true,
      responseChunks: ['late'],
      emitLateChunkAfterCancellation: true,
      scheduler: {
        waitForChunk: async () => chunkWait,
      },
    });

    const generation = runtime.generate('question', {
      onText: (chunk) => chunks.push(chunk),
    });
    runtime.cancel();
    releaseChunk();

    await expect(generation).resolves.toEqual({ finishReason: 'cancelled' });
    expect(chunks).toEqual(['late']);
  });

  it('builds the citation fixture from packed sources without injecting source content', () => {
    const packed = {
      sources: [
        { citationId: 'S1', canonicalUrl: '/long/', title: 'Long research' },
        { citationId: 'S2', canonicalUrl: '/long/', title: 'Long research' },
        { citationId: 'S3', canonicalUrl: '/other/', title: 'Other writing' },
      ],
    } as unknown as SelectionResult;

    const configured = configureFakeCitationSelection(packed);

    expect(
      configured.sources.map(({ citationId, canonicalUrl }) => ({
        citationId,
        canonicalUrl,
      })),
    ).toEqual([
      { citationId: 'S1', canonicalUrl: '/other/' },
      { citationId: 'S2', canonicalUrl: '/long/' },
      { citationId: 'S3', canonicalUrl: '/long/' },
    ]);
    expect(configured).not.toBe(packed);
    expect(packed.sources.map(({ citationId }) => citationId)).toEqual([
      'S1',
      'S2',
      'S3',
    ]);
  });

  it('seeds an independent privacy sentinel into fake selected context only', () => {
    const packed = {
      sources: [
        { citationId: 'S1', text: 'Published source text.' },
        { citationId: 'S2', text: 'Second published source.' },
      ],
    } as unknown as SelectionResult;

    const configured = configureFakeSourceSentinel(packed);

    expect(configured.sources[0]?.text).toBe(
      'Published source text. EGREGORE_SOURCE_SENTINEL_4a6c1b',
    );
    expect(configured.sources[1]?.text).toBe('Second published source.');
    expect(packed.sources[0]?.text).toBe('Published source text.');
    expect(JSON.stringify(configured)).not.toContain(
      'EGREGORE_PROMPT_SENTINEL_7f9e2d',
    );
  });
});
