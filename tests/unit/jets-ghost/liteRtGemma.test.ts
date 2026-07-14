import { describe, expect, it, vi } from 'vitest';
import {
  JETS_GHOST_CONTEXT,
  JETS_GHOST_MODEL,
  JETS_GHOST_PATHS,
} from '../../../src/features/jets-ghost/config';
import { LiteRtGemmaRuntime } from '../../../src/features/jets-ghost/runtime/liteRtGemma';

interface StreamMessage {
  content?: string | Array<{
    type: string;
    text?: string;
  }>;
}

interface FakeConversation {
  sendMessageStreaming: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

interface FakeEngine {
  createConversation: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function streamFrom(messages: readonly StreamMessage[]): ReadableStream<StreamMessage> {
  return new ReadableStream({
    start(controller) {
      for (const message of messages) controller.enqueue(message);
      controller.close();
    },
  });
}

function controlledStream(): {
  stream: ReadableStream<StreamMessage>;
  emit: (message: StreamMessage) => void;
  close: () => void;
} {
  let controller!: ReadableStreamDefaultController<StreamMessage>;
  return {
    stream: new ReadableStream({
      start(nextController) {
        controller = nextController;
      },
    }),
    emit: (message) => controller.enqueue(message),
    close: () => controller.close(),
  };
}

function fakeConversation(
  stream: ReadableStream<StreamMessage> = streamFrom([]),
  calls: string[] = [],
  name = 'conversation',
): FakeConversation {
  return {
    sendMessageStreaming: vi.fn(() => stream),
    cancel: vi.fn(() => calls.push(`${name}.cancel`)),
    delete: vi.fn(async () => {
      calls.push(`${name}.delete`);
    }),
  };
}

function fakeEngine(
  conversations: FakeConversation[],
  calls: string[] = [],
  name = 'engine',
): FakeEngine {
  return {
    createConversation: vi.fn(async () => {
      calls.push(`${name}.createConversation`);
      const conversation = conversations.shift();
      if (!conversation) throw new Error('No fake conversation remains.');
      return conversation;
    }),
    delete: vi.fn(async () => {
      calls.push(`${name}.delete`);
    }),
  };
}

function runtimeHarness(options: {
  engines?: FakeEngine[];
  loadLiteRtLm?: (path: string) => Promise<unknown>;
  unloadLiteRtLm?: () => void;
} = {}) {
  const calls: string[] = [];
  const engines = [...(options.engines ?? [fakeEngine([fakeConversation()], calls)])];
  const loadLiteRtLm = vi.fn(options.loadLiteRtLm ?? (async () => {
    calls.push('loadLiteRtLm');
  }));
  const unloadLiteRtLm = vi.fn(options.unloadLiteRtLm ?? (() => {
    calls.push('unloadLiteRtLm');
  }));
  const create = vi.fn(async (_settings: unknown) => {
    calls.push('Engine.create');
    const engine = engines.shift();
    if (!engine) throw new Error('No fake engine remains.');
    return engine;
  });
  const module = {
    Engine: { create },
    loadLiteRtLm,
    unloadLiteRtLm,
  };
  const loadModule = vi.fn(async () => {
    calls.push('loadModule');
    return module;
  });

  return {
    calls,
    create,
    loadLiteRtLm,
    unloadLiteRtLm,
    loadModule,
    runtime: new LiteRtGemmaRuntime(loadModule as never),
  };
}

describe('LiteRT-LM Gemma runtime', () => {
  it('does not import LiteRT-LM before explicit load consent', async () => {
    const { loadModule, runtime } = runtimeHarness();

    expect(loadModule).not.toHaveBeenCalled();
    await runtime.checkCapabilities();
    expect(loadModule).not.toHaveBeenCalled();
  });

  it('loads the pinned same-origin WASM before creating the exact URL-backed engine', async () => {
    const { calls, create, loadLiteRtLm, runtime } = runtimeHarness();
    const phases: string[] = [];
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const digestSpy = vi.spyOn(globalThis.crypto.subtle, 'digest');

    await runtime.load({ onPhase: (phase) => phases.push(phase) });

    expect(calls.slice(0, 3)).toEqual(['loadModule', 'loadLiteRtLm', 'Engine.create']);
    expect(loadLiteRtLm).toHaveBeenCalledWith(JETS_GHOST_PATHS.liteRtWasm);
    expect(loadLiteRtLm).not.toHaveBeenCalledWith(expect.stringContaining('jsdelivr'));
    expect(create).toHaveBeenCalledWith({
      model: JETS_GHOST_MODEL.url,
      mainExecutorSettings: {
        maxNumTokens: 16_384,
      },
    });
    const engineSettings = create.mock.calls[0]?.[0] as { model: unknown };
    expect(typeof engineSettings.model).toBe('string');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(digestSpy).not.toHaveBeenCalled();
    expect(phases).toEqual(['runtime', 'model']);
    expect(runtime).not.toHaveProperty('artifactIntegrityVerified');
    expect(runtime).not.toHaveProperty('runtimeArtifactIntegrity');

    fetchSpy.mockRestore();
    digestSpy.mockRestore();
  });

  it('caps sessions at the reserved output budget without consuming estimator headroom', async () => {
    const calls: string[] = [];
    const conversation = fakeConversation(streamFrom([]), calls, 'first');
    const engine = fakeEngine([conversation], calls);
    const { runtime } = runtimeHarness({ engines: [engine] });
    const preface = [{ role: 'system' as const, content: 'Grounded preface' }];

    await runtime.load({});
    await runtime.createSession(preface);

    expect(engine.createConversation).toHaveBeenCalledWith({
      preface: { messages: preface },
      prefillPrefaceOnInit: true,
      sessionConfig: {
        maxOutputTokens: 1_024,
      },
    });
    expect(JETS_GHOST_CONTEXT.responseReserve).toBe(1_024);
    expect(
      JETS_GHOST_CONTEXT.maxContextTokens
      - JETS_GHOST_CONTEXT.responseReserve
      - JETS_GHOST_CONTEXT.estimatorHeadroom,
    ).toBe(12_083);
    expect(JETS_GHOST_CONTEXT.estimatorHeadroom).toBe(3_277);
  });

  it('deletes an existing conversation before creating its replacement', async () => {
    const calls: string[] = [];
    const first = fakeConversation(streamFrom([]), calls, 'first');
    const second = fakeConversation(streamFrom([]), calls, 'second');
    const engine = fakeEngine([first, second], calls);
    const { runtime } = runtimeHarness({ engines: [engine] });

    await runtime.load({});
    await runtime.createSession([{ role: 'system', content: 'First' }]);
    calls.length = 0;
    await runtime.createSession([{ role: 'system', content: 'Second' }]);

    expect(calls).toEqual(['first.delete', 'engine.createConversation']);
  });

  it('streams string and text-part content in order while ignoring non-text parts', async () => {
    const conversation = fakeConversation(streamFrom([
      { content: 'One' },
      {
        content: [
          { type: 'text', text: ' two' },
          { type: 'image' },
          { type: 'text', text: ' three' },
          { type: 'text' },
        ],
      },
      {},
    ]));
    const engine = fakeEngine([conversation]);
    const { runtime } = runtimeHarness({ engines: [engine] });
    const fragments: string[] = [];

    await runtime.load({});
    await runtime.createSession([]);
    const result = await runtime.generate('Question', {
      onText: (text) => fragments.push(text),
    });

    expect(conversation.sendMessageStreaming).toHaveBeenCalledWith({
      role: 'user',
      content: 'Question',
    });
    expect(fragments).toEqual(['One', ' two', ' three']);
    expect(result).toEqual({ finishReason: 'completed' });
  });

  it('cancels the active conversation and suppresses later stream fragments', async () => {
    const controlled = controlledStream();
    const conversation = fakeConversation(controlled.stream);
    const engine = fakeEngine([conversation]);
    const { runtime } = runtimeHarness({ engines: [engine] });
    const fragments: string[] = [];

    await runtime.load({});
    await runtime.createSession([]);
    const generation = runtime.generate('Question', {
      onText: (text) => fragments.push(text),
    });
    controlled.emit({ content: 'keep' });
    await vi.waitFor(() => expect(fragments).toEqual(['keep']));

    runtime.cancel();
    controlled.emit({ content: 'drop' });
    controlled.close();

    await expect(generation).resolves.toEqual({ finishReason: 'cancelled' });
    expect(conversation.cancel).toHaveBeenCalledTimes(1);
    expect(fragments).toEqual(['keep']);
  });

  it('reset invalidates generation and deletes only the conversation', async () => {
    const controlled = controlledStream();
    const conversation = fakeConversation(controlled.stream);
    const engine = fakeEngine([conversation]);
    const { runtime } = runtimeHarness({ engines: [engine] });
    const fragments: string[] = [];

    await runtime.load({});
    await runtime.createSession([]);
    const generation = runtime.generate('Question', {
      onText: (text) => fragments.push(text),
    });
    const resetting = runtime.reset();
    controlled.emit({ content: 'late' });
    controlled.close();
    await resetting;

    await expect(generation).resolves.toEqual({ finishReason: 'cancelled' });
    expect(conversation.delete).toHaveBeenCalledTimes(1);
    expect(engine.delete).not.toHaveBeenCalled();
    expect(fragments).toEqual([]);
  });

  it('keeps failed unload resources pending, blocks load, and retries cleanup in order', async () => {
    const calls: string[] = [];
    const conversation = fakeConversation(streamFrom([]), calls);
    conversation.delete.mockImplementationOnce(async () => {
      calls.push('conversation.delete');
      throw new Error('PRIVATE_PROMPT_SENTINEL');
    }).mockImplementationOnce(async () => {
      calls.push('conversation.delete');
    });
    const firstEngine = fakeEngine([conversation], calls, 'engine');
    firstEngine.delete.mockImplementationOnce(async () => {
      calls.push('engine.delete');
      throw new Error('PRIVATE_RESPONSE_SENTINEL');
    }).mockImplementationOnce(async () => {
      calls.push('engine.delete');
    });
    const secondEngine = fakeEngine([fakeConversation()], calls, 'fresh-engine');
    const { loadModule, runtime, unloadLiteRtLm } = runtimeHarness({
      engines: [firstEngine, secondEngine],
      unloadLiteRtLm: vi.fn()
        .mockImplementationOnce(() => {
          calls.push('unloadLiteRtLm');
          throw new Error('PRIVATE_RUNTIME_SENTINEL');
        })
        .mockImplementation(() => {
          calls.push('unloadLiteRtLm');
        }),
    });

    await runtime.load({});
    await runtime.createSession([]);
    calls.length = 0;
    let cleanupError: unknown;
    try {
      await runtime.unload();
    } catch (error) {
      cleanupError = error;
    }

    expect(calls).toEqual([
      'conversation.delete',
      'engine.delete',
      'unloadLiteRtLm',
    ]);
    expect(cleanupError).toMatchObject({
      code: 'engine-cleanup-failed',
      cleanupFailures: ['conversation', 'engine', 'runtime'],
    });
    expect(JSON.stringify(cleanupError)).not.toMatch(/PRIVATE|PROMPT|RESPONSE/);
    expect(unloadLiteRtLm).toHaveBeenCalledTimes(1);

    await expect(runtime.load({})).rejects.toMatchObject({
      code: 'model-load-failed',
    });
    expect(loadModule).toHaveBeenCalledTimes(1);

    calls.length = 0;
    await runtime.unload();
    expect(calls).toEqual([
      'conversation.delete',
      'engine.delete',
      'unloadLiteRtLm',
    ]);

    await runtime.load({});
    expect(loadModule).toHaveBeenCalledTimes(2);
  });

  it('keeps a failed reset deletion pending until an explicit retry succeeds', async () => {
    const conversation = fakeConversation();
    conversation.delete
      .mockRejectedValueOnce(new Error('PRIVATE_RESET_SENTINEL'))
      .mockResolvedValueOnce(undefined);
    const engine = fakeEngine([conversation]);
    const { runtime } = runtimeHarness({ engines: [engine] });

    await runtime.load({});
    await runtime.createSession([]);
    await expect(runtime.reset()).rejects.toMatchObject({
      code: 'engine-cleanup-failed',
      diagnosticCause: 'Error',
    });
    await runtime.reset();

    expect(conversation.delete).toHaveBeenCalledTimes(2);
    await runtime.reset();
    expect(conversation.delete).toHaveBeenCalledTimes(2);
  });

  it('maps replacement deletion failures safely and retries before creating a new session', async () => {
    const first = fakeConversation();
    const second = fakeConversation();
    first.delete
      .mockRejectedValueOnce(new Error('PRIVATE_OLD_SESSION_SENTINEL'))
      .mockResolvedValueOnce(undefined);
    const engine = fakeEngine([first, second]);
    const { runtime } = runtimeHarness({ engines: [engine] });

    await runtime.load({});
    await runtime.createSession([{ role: 'system', content: 'First' }]);
    let replacementError: unknown;
    try {
      await runtime.createSession([{ role: 'system', content: 'Second' }]);
    } catch (error) {
      replacementError = error;
    }

    expect(replacementError).toMatchObject({
      code: 'engine-cleanup-failed',
      diagnosticCause: 'Error',
    });
    expect(JSON.stringify(replacementError)).not.toContain('PRIVATE_OLD_SESSION_SENTINEL');
    expect(engine.createConversation).toHaveBeenCalledTimes(1);

    await runtime.createSession([{ role: 'system', content: 'Second' }]);
    expect(first.delete).toHaveBeenCalledTimes(2);
    expect(engine.createConversation).toHaveBeenCalledTimes(2);
  });

  it('maps createConversation failures without retaining SDK cause text', async () => {
    const conversation = fakeConversation();
    const engine = fakeEngine([]);
    engine.createConversation
      .mockRejectedValueOnce(new Error('PRIVATE_PREFACE_SENTINEL'))
      .mockResolvedValueOnce(conversation);
    const { runtime } = runtimeHarness({ engines: [engine] });

    await runtime.load({});
    let sessionError: unknown;
    try {
      await runtime.createSession([{ role: 'system', content: 'PRIVATE_SYSTEM_SENTINEL' }]);
    } catch (error) {
      sessionError = error;
    }

    expect(sessionError).toMatchObject({
      name: 'JetsGhostRuntimeError',
      code: 'generation-failed',
      diagnosticCause: 'Error',
    });
    expect(JSON.stringify(sessionError)).not.toMatch(/PRIVATE|PREFACE|SYSTEM/);

    await runtime.createSession([]);
    expect(engine.createConversation).toHaveBeenCalledTimes(2);
  });

  it('waits for a non-abortable WASM load before stopping and never creates an engine', async () => {
    const wasmLoad = deferred<unknown>();
    const calls: string[] = [];
    const { create, runtime, unloadLiteRtLm } = runtimeHarness({
      loadLiteRtLm: async () => {
        calls.push('wasm.start');
        await wasmLoad.promise;
        calls.push('wasm.end');
      },
      unloadLiteRtLm: () => calls.push('unloadLiteRtLm'),
    });

    const loading = runtime.load({});
    await vi.waitFor(() => expect(calls).toContain('wasm.start'));
    runtime.cancel();
    expect(unloadLiteRtLm).not.toHaveBeenCalled();
    wasmLoad.resolve(undefined);
    await loading;

    expect(create).not.toHaveBeenCalled();
    expect(calls).toEqual(['wasm.start', 'wasm.end', 'unloadLiteRtLm']);
  });

  it('maps SDK load failures with code-like fields to fixed diagnostics', async () => {
    const privateFailure = Object.assign(
      new Error('PRIVATE_MODEL_URL_SENTINEL'),
      { code: 'NETWORK_FAILURE' },
    );
    const { runtime } = runtimeHarness({
      loadLiteRtLm: async () => {
        throw privateFailure;
      },
    });

    let loadError: unknown;
    try {
      await runtime.load({});
    } catch (error) {
      loadError = error;
    }

    expect(loadError).toMatchObject({
      name: 'JetsGhostRuntimeError',
      code: 'model-load-failed',
      diagnosticCause: 'Error',
    });
    expect(JSON.stringify(loadError)).not.toContain('PRIVATE_MODEL_URL_SENTINEL');
  });

  it('deletes a model engine that resolves after Stop before unloading the singleton', async () => {
    const engineLoad = deferred<FakeEngine>();
    const calls: string[] = [];
    const engine = fakeEngine([fakeConversation()], calls);
    const loadLiteRtLm = vi.fn(async () => calls.push('loadLiteRtLm'));
    const unloadLiteRtLm = vi.fn(() => calls.push('unloadLiteRtLm'));
    const create = vi.fn(async () => {
      calls.push('Engine.create.start');
      const created = await engineLoad.promise;
      calls.push('Engine.create.end');
      return created;
    });
    const loadModule = vi.fn(async () => ({
      Engine: { create },
      loadLiteRtLm,
      unloadLiteRtLm,
    }));
    const runtime = new LiteRtGemmaRuntime(loadModule as never);

    const loading = runtime.load({});
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    runtime.cancel();
    engineLoad.resolve(engine);
    await loading;

    expect(calls).toEqual([
      'loadLiteRtLm',
      'Engine.create.start',
      'Engine.create.end',
      'engine.delete',
      'unloadLiteRtLm',
    ]);
  });

  it('propagates an active-load cleanup failure through unload and keeps it retryable', async () => {
    const wasmLoad = deferred<unknown>();
    const unloadLiteRtLm = vi.fn()
      .mockImplementationOnce(() => {
        throw new Error('PRIVATE_ACTIVE_LOAD_CLEANUP');
      })
      .mockImplementation(() => undefined);
    const { loadLiteRtLm, runtime } = runtimeHarness({
      loadLiteRtLm: async () => wasmLoad.promise,
      unloadLiteRtLm,
    });

    const loading = runtime.load({});
    await vi.waitFor(() => expect(loadLiteRtLm).toHaveBeenCalledTimes(1));
    const unloading = runtime.unload();
    wasmLoad.resolve(undefined);

    await expect(loading).rejects.toMatchObject({
      code: 'engine-cleanup-failed',
      cleanupFailures: ['runtime'],
    });
    await expect(unloading).rejects.toMatchObject({
      code: 'engine-cleanup-failed',
      cleanupFailures: ['runtime'],
    });
    expect(unloadLiteRtLm).toHaveBeenCalledTimes(1);

    await runtime.unload();
    expect(unloadLiteRtLm).toHaveBeenCalledTimes(2);
  });

  it('creates fresh module, engine, and conversation state after unload and route re-entry', async () => {
    const calls: string[] = [];
    const firstConversation = fakeConversation(streamFrom([]), calls, 'first-conversation');
    const secondConversation = fakeConversation(streamFrom([]), calls, 'second-conversation');
    const firstEngine = fakeEngine([firstConversation], calls, 'first-engine');
    const secondEngine = fakeEngine([secondConversation], calls, 'second-engine');
    const { loadModule, runtime, unloadLiteRtLm } = runtimeHarness({
      engines: [firstEngine, secondEngine],
    });

    await runtime.load({});
    await runtime.createSession([]);
    await runtime.unload();
    await runtime.load({});
    await runtime.createSession([]);

    expect(loadModule).toHaveBeenCalledTimes(2);
    expect(unloadLiteRtLm).toHaveBeenCalledTimes(1);
    expect(firstEngine.delete).toHaveBeenCalledTimes(1);
    expect(firstConversation.delete).toHaveBeenCalledTimes(1);
    expect(secondEngine.createConversation).toHaveBeenCalledTimes(1);
    expect(secondConversation.delete).not.toHaveBeenCalled();
  });

  it('ignores all stream events after unload begins', async () => {
    const controlled = controlledStream();
    const conversation = fakeConversation(controlled.stream);
    const engine = fakeEngine([conversation]);
    const { runtime } = runtimeHarness({ engines: [engine] });
    const fragments: string[] = [];

    await runtime.load({});
    await runtime.createSession([]);
    const generation = runtime.generate('Question', {
      onText: (text) => fragments.push(text),
    });
    const unloading = runtime.unload();
    controlled.emit({ content: 'late string' });
    controlled.emit({ content: [{ type: 'text', text: 'late part' }] });
    controlled.close();

    await unloading;
    await expect(generation).resolves.toEqual({ finishReason: 'cancelled' });
    expect(fragments).toEqual([]);
  });
});
