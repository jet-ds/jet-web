import { describe, expect, it } from 'vitest';
import {
  createInitialLifecycleState,
  reduceJetsGhostLifecycle,
} from '../../../src/features/jets-ghost/runtime/lifecycle';
import {
  FakeRuntime,
  type FakeRuntimeOptions,
} from '../../../src/features/jets-ghost/runtime/fakeRuntime';
import {
  createRuntimeError,
  type CapabilityReport,
} from '../../../src/features/jets-ghost/runtime/types';

function supportedCapabilities(): CapabilityReport {
  return {
    supported: true,
    warnings: [],
    failures: [],
    secureContext: true,
    webGpuAvailable: true,
    adapterAvailable: true,
    browser: {
      family: 'unknown',
      version: null,
    },
    storageEstimate: null,
  };
}

function loadingState() {
  let state = createInitialLifecycleState();
  state = reduceJetsGhostLifecycle(state, { type: 'check-requested' });
  state = reduceJetsGhostLifecycle(state, {
    type: 'capabilities-resolved',
    report: supportedCapabilities(),
  });
  return reduceJetsGhostLifecycle(state, { type: 'load-requested' });
}

function readyState() {
  return reduceJetsGhostLifecycle(loadingState(), { type: 'load-succeeded' });
}

class ManualFakeRuntimeScheduler {
  private readonly pending: Array<() => void> = [];

  get pendingCount(): number {
    return this.pending.length;
  }

  waitForChunk(_operationId: number, _chunkIndex: number): Promise<void> {
    return new Promise((resolve) => {
      this.pending.push(resolve);
    });
  }

  releaseNext(): void {
    const release = this.pending.shift();
    if (!release) throw new Error('No fake runtime chunk is pending.');
    release();
  }
}

function fakeRuntimeWithScheduler(
  scheduler: ManualFakeRuntimeScheduler,
  responseChunks: readonly string[],
): FakeRuntime {
  const options: FakeRuntimeOptions & { scheduler: ManualFakeRuntimeScheduler } = {
    testOnly: true,
    responseChunks,
    scheduler,
  };
  return new FakeRuntime(options);
}

describe("Jet's Ghost lifecycle reducer", () => {
  it('moves through compatibility, consent, loading, and ready', () => {
    let state = createInitialLifecycleState();
    expect(state).toMatchObject({ status: 'idle', mounted: true });

    state = reduceJetsGhostLifecycle(state, { type: 'check-requested' });
    expect(state.status).toBe('checking-capabilities');

    state = reduceJetsGhostLifecycle(state, {
      type: 'capabilities-resolved',
      report: supportedCapabilities(),
    });
    expect(state.status).toBe('awaiting-consent');

    state = reduceJetsGhostLifecycle(state, { type: 'load-requested' });
    expect(state.status).toBe('loading');

    state = reduceJetsGhostLifecycle(state, { type: 'load-succeeded' });
    expect(state).toMatchObject({
      status: 'ready',
      stopRequestedDuringLoad: false,
      error: null,
    });
  });

  it('waits for a non-abortable load to settle before unloading after Stop', () => {
    let state = loadingState();

    state = reduceJetsGhostLifecycle(state, { type: 'stop-requested' });
    expect(state).toMatchObject({
      status: 'loading',
      stopRequestedDuringLoad: true,
    });

    state = reduceJetsGhostLifecycle(state, { type: 'load-succeeded' });
    expect(state.status).toBe('unloading');
    expect(reduceJetsGhostLifecycle(state, { type: 'unload-succeeded' }).status).toBe('idle');
  });

  it('returns cancellation to ready and keeps generation failures recoverable', () => {
    let state = reduceJetsGhostLifecycle(readyState(), { type: 'generation-requested' });
    expect(state.status).toBe('generating');

    state = reduceJetsGhostLifecycle(state, { type: 'stop-requested' });
    expect(state.status).toBe('cancelling');

    state = reduceJetsGhostLifecycle(state, { type: 'generation-cancelled' });
    expect(state.status).toBe('ready');

    state = reduceJetsGhostLifecycle(state, { type: 'generation-requested' });
    state = reduceJetsGhostLifecycle(state, {
      type: 'generation-failed',
      error: createRuntimeError('generation-failed', 'Generation failed.', true, new Error('secret')),
    });
    expect(state).toMatchObject({
      status: 'generation-error',
      error: {
        code: 'generation-failed',
        diagnosticCause: 'Error',
      },
    });

    state = reduceJetsGhostLifecycle(state, { type: 'error-acknowledged' });
    expect(state).toMatchObject({ status: 'ready', error: null });
  });

  it('routes load failures back through consent and supports reset and unload', () => {
    let state = createInitialLifecycleState();
    state = reduceJetsGhostLifecycle(state, { type: 'check-requested' });
    state = reduceJetsGhostLifecycle(state, {
      type: 'capabilities-resolved',
      report: supportedCapabilities(),
    });
    state = reduceJetsGhostLifecycle(state, { type: 'load-requested' });
    state = reduceJetsGhostLifecycle(state, {
      type: 'load-failed',
      error: createRuntimeError('model-load-failed', 'Model load failed.', true),
    });
    expect(state.status).toBe('load-error');

    state = reduceJetsGhostLifecycle(state, { type: 'error-acknowledged' });
    expect(state.status).toBe('awaiting-consent');

    state = reduceJetsGhostLifecycle(state, { type: 'load-requested' });
    state = reduceJetsGhostLifecycle(state, { type: 'load-succeeded' });
    state = reduceJetsGhostLifecycle(state, { type: 'reset-requested' });
    expect(state.status).toBe('resetting');
    state = reduceJetsGhostLifecycle(state, { type: 'reset-succeeded' });
    expect(state.status).toBe('ready');

    state = reduceJetsGhostLifecycle(state, { type: 'unload-requested' });
    expect(state.status).toBe('unloading');
    state = reduceJetsGhostLifecycle(state, { type: 'unload-succeeded' });
    expect(state).toEqual(createInitialLifecycleState());
  });

  it('keeps mounted unload failures fail-closed until a retry succeeds', () => {
    const cleanupError = createRuntimeError(
      'engine-cleanup-failed',
      'Cleanup failed.',
      true,
    );
    let state = reduceJetsGhostLifecycle(readyState(), { type: 'unload-requested' });

    state = reduceJetsGhostLifecycle(state, {
      type: 'unload-failed',
      error: cleanupError,
    });
    expect(state).toMatchObject({
      status: 'unload-error',
      mounted: true,
      error: cleanupError,
    });

    const acknowledged = reduceJetsGhostLifecycle(state, { type: 'error-acknowledged' });
    expect(acknowledged).toBe(state);

    state = reduceJetsGhostLifecycle(state, { type: 'unload-requested' });
    expect(state).toMatchObject({ status: 'unloading', error: null });
    state = reduceJetsGhostLifecycle(state, { type: 'unload-succeeded' });
    expect(state).toEqual(createInitialLifecycleState());
  });

  it('keeps reset failures distinct and failed until reset retry succeeds', () => {
    const cleanupError = createRuntimeError(
      'engine-cleanup-failed',
      'Reset failed.',
      true,
    );
    let state = reduceJetsGhostLifecycle(readyState(), { type: 'reset-requested' });

    state = reduceJetsGhostLifecycle(state, {
      type: 'reset-failed',
      error: cleanupError,
    });
    expect(state).toMatchObject({
      status: 'reset-error',
      mounted: true,
      error: cleanupError,
    });
    expect(reduceJetsGhostLifecycle(state, { type: 'error-acknowledged' })).toBe(state);

    state = reduceJetsGhostLifecycle(state, { type: 'reset-requested' });
    expect(state).toMatchObject({ status: 'resetting', error: null });
    state = reduceJetsGhostLifecycle(state, { type: 'reset-succeeded' });
    expect(state).toMatchObject({ status: 'ready', error: null });
  });

  it('suppresses late events after unmount while allowing cleanup to settle', () => {
    let state = reduceJetsGhostLifecycle(readyState(), { type: 'generation-requested' });
    state = reduceJetsGhostLifecycle(state, { type: 'unmounted' });
    expect(state).toMatchObject({ status: 'unloading', mounted: false });

    const lateGeneration = reduceJetsGhostLifecycle(state, { type: 'generation-succeeded' });
    const lateFailure = reduceJetsGhostLifecycle(state, {
      type: 'generation-failed',
      error: createRuntimeError('generation-failed', 'Generation failed.', true),
    });
    expect(lateGeneration).toBe(state);
    expect(lateFailure).toBe(state);

    const settled = reduceJetsGhostLifecycle(state, { type: 'unload-succeeded' });
    expect(settled).toMatchObject({ status: 'idle', mounted: false, error: null });
    expect(reduceJetsGhostLifecycle(settled, { type: 'check-requested' })).toBe(settled);
  });

  it('settles an unmounted cleanup failure as inactive without accepting late work', () => {
    let state = reduceJetsGhostLifecycle(readyState(), { type: 'unmounted' });
    state = reduceJetsGhostLifecycle(state, {
      type: 'unload-failed',
      error: createRuntimeError('engine-cleanup-failed', 'Cleanup failed.', true),
    });

    expect(state).toEqual(createInitialLifecycleState(false));
    expect(reduceJetsGhostLifecycle(state, { type: 'generation-succeeded' })).toBe(state);
  });
});

describe('runtime diagnostics', () => {
  it('maps hostile error names and other causes to fixed diagnostic categories', () => {
    const privateNamedError = new Error('private message');
    privateNamedError.name = 'PRIVATE_PROMPT_SENTINEL';

    const errorDiagnostic = createRuntimeError(
      'generation-failed',
      'Generation failed.',
      true,
      privateNamedError,
    );
    const domDiagnostic = createRuntimeError(
      'adapter-unavailable',
      'Adapter failed.',
      false,
      new DOMException('private DOM message'),
    );
    const typeDiagnostic = createRuntimeError(
      'model-load-failed',
      'Model failed.',
      true,
      { private: true },
    );

    expect(errorDiagnostic.diagnosticCause).toBe('Error');
    expect(domDiagnostic.diagnosticCause).toBe('DOMException');
    expect(typeDiagnostic.diagnosticCause).toBe('type:object');
    expect(errorDiagnostic.diagnosticCause).not.toContain('PRIVATE_PROMPT_SENTINEL');
  });
});

describe('FakeRuntime', () => {
  it('is explicitly test-only, streams deterministic chunks, and records no content', async () => {
    expect(() => new FakeRuntime({ testOnly: false as true })).toThrow(/test-only/i);

    const runtime = new FakeRuntime({
      testOnly: true,
      responseChunks: ['First ', 'second.'],
    });
    const chunks: string[] = [];

    await runtime.checkCapabilities();
    await runtime.load({});
    await runtime.createSession([{ role: 'system', content: 'PRIVATE_PREFACE' }]);
    const result = await runtime.generate('PRIVATE_QUESTION', {
      onText: (chunk) => chunks.push(chunk),
    });

    expect(chunks).toEqual(['First ', 'second.']);
    expect(result).toEqual({ finishReason: 'completed' });
    expect(runtime.calls.map(({ method }) => method)).toEqual([
      'checkCapabilities',
      'load',
      'createSession',
      'generate',
    ]);
    expect(new Set(runtime.calls.map(({ operationId }) => operationId)).size).toBe(4);
    expect(JSON.stringify(runtime.calls)).not.toMatch(/PRIVATE|First|second/);
  });

  it('cancels between deterministic chunks and reports the partial operation as cancelled', async () => {
    const runtime = new FakeRuntime({
      testOnly: true,
      responseChunks: ['keep', 'drop'],
    });
    const chunks: string[] = [];

    const result = await runtime.generate('question', {
      onText: (chunk) => {
        chunks.push(chunk);
        runtime.cancel();
      },
    });

    expect(chunks).toEqual(['keep']);
    expect(result).toEqual({ finishReason: 'cancelled' });
    expect(runtime.calls.map(({ method }) => method)).toEqual(['generate', 'cancel']);
  });

  it('rejects overlapping generation without replacing the active operation', async () => {
    const scheduler = new ManualFakeRuntimeScheduler();
    const runtime = fakeRuntimeWithScheduler(scheduler, ['first']);
    const firstChunks: string[] = [];
    const first = runtime.generate('first question', {
      onText: (chunk) => firstChunks.push(chunk),
    });

    expect(scheduler.pendingCount).toBe(1);
    await expect(runtime.generate('overlapping question', {
      onText: () => undefined,
    })).rejects.toMatchObject({ code: 'generation-failed' });
    scheduler.releaseNext();
    await expect(first).resolves.toEqual({ finishReason: 'completed' });

    expect(firstChunks).toEqual(['first']);
    expect(runtime.calls.map(({ method }) => method)).toEqual(['generate', 'generate']);
  });

  it('streams only after each deterministic scheduler release', async () => {
    const scheduler = new ManualFakeRuntimeScheduler();
    const runtime = fakeRuntimeWithScheduler(scheduler, ['released']);
    const chunks: string[] = [];

    const generation = runtime.generate('PRIVATE_PROMPT_SENTINEL', {
      onText: (chunk) => chunks.push(chunk),
    });
    expect(scheduler.pendingCount).toBe(1);
    expect(chunks).toEqual([]);

    scheduler.releaseNext();
    await expect(generation).resolves.toEqual({ finishReason: 'completed' });
    expect(chunks).toEqual(['released']);
    expect(JSON.stringify(runtime.calls)).not.toMatch(/PRIVATE_PROMPT_SENTINEL|released/);
  });

  it('suppresses a delayed chunk after Stop is requested', async () => {
    const scheduler = new ManualFakeRuntimeScheduler();
    const runtime = fakeRuntimeWithScheduler(scheduler, ['late-after-stop']);
    const chunks: string[] = [];
    const generation = runtime.generate('question', {
      onText: (chunk) => chunks.push(chunk),
    });

    runtime.cancel();
    scheduler.releaseNext();

    await expect(generation).resolves.toEqual({ finishReason: 'cancelled' });
    expect(chunks).toEqual([]);
    expect(runtime.calls.map(({ method }) => method)).toEqual(['generate', 'cancel']);
  });

  it('invalidates an overlapping delayed operation on reset without stale chunks', async () => {
    const scheduler = new ManualFakeRuntimeScheduler();
    const runtime = fakeRuntimeWithScheduler(scheduler, ['late-after-reset']);
    const chunks: string[] = [];
    const generation = runtime.generate('first question', {
      onText: (chunk) => chunks.push(chunk),
    });

    await expect(runtime.generate('overlap', {
      onText: () => undefined,
    })).rejects.toMatchObject({ code: 'generation-failed' });
    await runtime.reset();
    scheduler.releaseNext();

    await expect(generation).resolves.toEqual({ finishReason: 'cancelled' });
    expect(chunks).toEqual([]);
    expect(runtime.calls.map(({ method }) => method)).toEqual([
      'generate',
      'generate',
      'reset',
    ]);
  });

  it('suppresses deliberately delayed post-navigation chunks after unload', async () => {
    const scheduler = new ManualFakeRuntimeScheduler();
    const runtime = fakeRuntimeWithScheduler(scheduler, ['PRIVATE_RESPONSE_SENTINEL']);
    const chunks: string[] = [];
    const generation = runtime.generate('PRIVATE_PROMPT_SENTINEL', {
      onText: (chunk) => chunks.push(chunk),
    });

    await runtime.unload();
    scheduler.releaseNext();

    await expect(generation).resolves.toEqual({ finishReason: 'cancelled' });
    expect(chunks).toEqual([]);
    expect(JSON.stringify(runtime.calls)).not.toMatch(/PRIVATE_PROMPT_SENTINEL|PRIVATE_RESPONSE_SENTINEL/);
    expect(runtime.calls.map(({ method }) => method)).toEqual(['generate', 'unload']);
  });

  it('suppresses queued chunks when unload invalidates an active generation', async () => {
    const runtime = new FakeRuntime({
      testOnly: true,
      responseChunks: ['keep', 'drop'],
    });
    const chunks: string[] = [];

    const result = await runtime.generate('question', {
      onText: (chunk) => {
        chunks.push(chunk);
        void runtime.unload();
      },
    });

    expect(chunks).toEqual(['keep']);
    expect(result).toEqual({ finishReason: 'cancelled' });
    expect(runtime.calls.map(({ method }) => method)).toEqual(['generate', 'unload']);
  });

  it('supports configured capability, load, generation, reset, and unload failures', async () => {
    const capabilityRuntime = new FakeRuntime({
      testOnly: true,
      failures: { capability: true },
    });
    expect(await capabilityRuntime.checkCapabilities()).toMatchObject({
      supported: false,
      failures: [{ code: 'adapter-unavailable' }],
    });

    for (const [failure, invoke, code] of [
      ['load', (runtime: FakeRuntime) => runtime.load({}), 'model-load-failed'],
      [
        'generation',
        (runtime: FakeRuntime) => runtime.generate('question', { onText: () => undefined }),
        'generation-failed',
      ],
      ['reset', (runtime: FakeRuntime) => runtime.reset(), 'engine-cleanup-failed'],
      ['unload', (runtime: FakeRuntime) => runtime.unload(), 'engine-cleanup-failed'],
    ] as const) {
      const runtime = new FakeRuntime({
        testOnly: true,
        failures: { [failure]: true },
      });
      await expect(invoke(runtime)).rejects.toMatchObject({ code });
    }
  });
});
