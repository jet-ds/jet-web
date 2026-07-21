import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EGREGORE_CONTEXT } from '../../../src/features/egregore/config';
import EgregoreExperience from '../../../src/features/egregore/EgregoreExperience';
import type { LoadedKnowledgeBase } from '../../../src/features/egregore/corpus/repository';
import type { AssembledPrompt } from '../../../src/features/egregore/prompt/assemble';
import type { ValidCitation } from '../../../src/features/egregore/prompt/citations';
import {
  FakeRuntime,
  type FakeRuntimeOptions,
} from '../../../src/features/egregore/runtime/fakeRuntime';
import type {
  GenerationHandlers,
  GenerationResult,
  LoadOptions,
  LocalModelRuntime,
  ModelMessage,
  CapabilityReport,
} from '../../../src/features/egregore/runtime/types';
import { createRuntimeError } from '../../../src/features/egregore/runtime/types';
import type {
  ChunkId,
  DocumentId,
  SectionId,
} from '../../../src/features/egregore/corpus/types';
import type {
  ContextBudget,
  SelectionInput,
  SelectionResult,
  SelectedSource,
} from '../../../src/features/egregore/selection/types';

interface WishedKnowledgeRepository {
  load(signal?: AbortSignal): Promise<LoadedKnowledgeBase>;
  unload(): void | Promise<void>;
}

interface WishedDependencies {
  createRepository: () => WishedKnowledgeRepository;
  createRuntime: () => LocalModelRuntime;
  rankAndPackContext: (input: SelectionInput) => SelectionResult;
  assemblePrompt: (
    query: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    selection: SelectionResult,
    budget: ContextBudget,
  ) => AssembledPrompt;
  extractValidCitations: (
    response: string,
    sources: SelectedSource[],
  ) => ValidCitation[];
  createTurnId: () => string;
  now: () => number;
}

interface WishedHookResult {
  state: {
    lifecycle: { status: string };
    error: { code: string; diagnosticCause?: string } | null;
    capability: CapabilityReport | null;
    turns: Array<{
      role: string;
      content: string;
      citations: ValidCitation[];
      stopped?: boolean;
    }>;
  };
  checkCompatibility: () => Promise<void>;
  load: () => Promise<void>;
  sendMessage: (question: string) => Promise<void>;
  stop: () => void;
  startNewSession: () => Promise<void>;
  recoverFromError: () => void;
  unload: () => Promise<void>;
}

type UseEgregore = (dependencies: WishedDependencies) => WishedHookResult;

const hookModulePath = '../../../src/features/egregore/state/useEgregore';

afterEach(() => cleanup());

async function loadSubject(): Promise<UseEgregore> {
  const module = await import(hookModulePath) as {
    useEgregore: UseEgregore;
  };
  return module.useEgregore;
}

class OrderedFakeRuntime extends FakeRuntime {
  private remainingGenerationFailures: number;
  private remainingResetFailures: number;
  private failNextGenerationRequested = false;
  private readonly loadErrorCode: 'engine-cleanup-failed' | null;
  readonly generationMessages: string[] = [];

  constructor(
    private readonly order: string[],
    responseChunks: readonly string[] = ['Grounded answer [S1].'],
    scheduler?: { waitForChunk(operationId: number, chunkIndex: number): Promise<void> },
    failures?: FakeRuntimeOptions['failures'],
    generationFailuresBeforeSuccess = 0,
    resetFailuresBeforeSuccess = 0,
    capabilityReport?: CapabilityReport,
    loadErrorCode: 'engine-cleanup-failed' | null = null,
    private readonly unloadWait?: Promise<void>,
    private readonly createSessionWait?: Promise<void>,
    private readonly createSessionError?: Error,
  ) {
    super({
      testOnly: true,
      responseChunks,
      ...(scheduler === undefined ? {} : { scheduler }),
      ...(failures === undefined ? {} : { failures }),
      ...(capabilityReport === undefined ? {} : { capabilityReport }),
    });
    this.remainingGenerationFailures = generationFailuresBeforeSuccess;
    this.remainingResetFailures = resetFailuresBeforeSuccess;
    this.loadErrorCode = loadErrorCode;
  }

  override async load(options: LoadOptions): Promise<void> {
    this.order.push('runtime.load');
    await super.load(options);
    if (this.loadErrorCode !== null) {
      throw createRuntimeError(
        this.loadErrorCode,
        'Private cleanup details must not reach the interface.',
        true,
      );
    }
  }

  override async createSession(preface: ModelMessage[]): Promise<void> {
    this.order.push('runtime.createSession');
    await super.createSession(preface);
    await this.createSessionWait;
    if (this.createSessionError !== undefined) throw this.createSessionError;
  }

  override async generate(
    message: string,
    handlers: GenerationHandlers,
  ): Promise<GenerationResult> {
    this.order.push('runtime.generate');
    this.generationMessages.push(message);
    if (this.failNextGenerationRequested || this.remainingGenerationFailures > 0) {
      this.failNextGenerationRequested = false;
      if (this.remainingGenerationFailures > 0) {
        this.remainingGenerationFailures -= 1;
      }
      throw createRuntimeError(
        'generation-failed',
        'The first test generation failed.',
        true,
      );
    }
    return super.generate(message, handlers);
  }

  failNextGeneration(): void {
    this.failNextGenerationRequested = true;
  }

  override cancel(): void {
    this.order.push('runtime.cancel');
    super.cancel();
  }

  override async reset(): Promise<void> {
    this.order.push('runtime.reset');
    if (this.remainingResetFailures > 0) {
      this.remainingResetFailures -= 1;
      throw createRuntimeError(
        'engine-cleanup-failed',
        'The first test reset failed.',
        true,
      );
    }
    await super.reset();
  }

  override async unload(): Promise<void> {
    this.order.push('runtime.unload');
    await this.unloadWait;
    await super.unload();
  }
}

class ManualScheduler {
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
    if (release === undefined) throw new Error('No chunk is pending.');
    release();
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function selectedSource(): SelectedSource {
  const documentId = 'blog:grounded' as DocumentId;
  const sectionId = `${documentId}#answer` as SectionId;
  return {
    citationId: 'S1',
    documentId,
    documentOrder: 0,
    sectionId,
    sectionOrder: 0,
    chunkId: `${sectionId}:${'a'.repeat(64)}:0` as ChunkId,
    chunkOrder: 0,
    title: 'Grounded source',
    canonicalUrl: 'https://jetsanchez.com/blog/grounded/',
    heading: 'Answer',
    text: 'Grounded source text.',
    estimatedTokens: 8,
    selectionReason: 'lexical-match',
    rankingScore: 10,
    provenance: {
      sourcePath: 'src/data/blog/grounded.mdx',
      sourceHash: 'b'.repeat(64),
      chunkContentHash: 'a'.repeat(64),
      sourceCommit: 'test-commit',
      corpusVersion: 'c'.repeat(64),
    },
  };
}

function selection(
  sources: SelectedSource[],
  completeCorpusIncluded = false,
): SelectionResult {
  return {
    pipeline: 'minisearch-rank-pack',
    indexSha256: 'd'.repeat(64),
    indexConfigVersion: '1.1.0',
    miniSearchVersion: '7.2.0',
    stemmerVersion: '2.0.1',
    corpusVersion: 'c'.repeat(64),
    sources,
    estimatedTokens: sources.length * 8,
    diagnostics: {
      directMatchCount: sources.length,
      expansionCandidateCount: 0,
      packedCount: sources.length,
      rejectedForBudgetCount: 0,
      completeCorpusIncluded,
      knowledgeTokens: sources.length * 8,
      rankingMs: 0,
    },
  };
}

function createHarness(options: {
  responseChunks?: readonly string[];
  scheduler?: ManualScheduler;
  runtimeFailures?: FakeRuntimeOptions['failures'];
  repositoryError?: Error;
  repositoryFailuresBeforeSuccess?: number;
  repositoryUnloadError?: Error;
  selection?: SelectionResult;
  generationFailuresBeforeSuccess?: number;
  resetFailuresBeforeSuccess?: number;
  capabilityReport?: CapabilityReport;
  loadErrorCode?: 'engine-cleanup-failed';
  repositoryLoad?: (signal?: AbortSignal) => Promise<LoadedKnowledgeBase>;
  runtimeUnloadWait?: Promise<void>;
  runtimeCreateSessionWait?: Promise<void>;
  runtimeCreateSessionError?: Error;
} = {}) {
  const order: string[] = [];
  const source = selectedSource();
  const selected = options.selection ?? selection([source]);
  const runtime = new OrderedFakeRuntime(
    order,
    options.responseChunks,
    options.scheduler,
    options.runtimeFailures,
    options.generationFailuresBeforeSuccess,
    options.resetFailuresBeforeSuccess,
    options.capabilityReport,
    options.loadErrorCode ?? null,
    options.runtimeUnloadWait,
    options.runtimeCreateSessionWait,
    options.runtimeCreateSessionError,
  );
  const knowledgeBase = {} as LoadedKnowledgeBase;
  let repositoryFailuresRemaining = options.repositoryFailuresBeforeSuccess ?? 0;
  const repository: WishedKnowledgeRepository = {
    load: vi.fn(async (signal?: AbortSignal) => {
      order.push('repository.load');
      if (options.repositoryLoad !== undefined) {
        return options.repositoryLoad(signal);
      }
      if (options.repositoryError !== undefined) throw options.repositoryError;
      if (repositoryFailuresRemaining > 0) {
        repositoryFailuresRemaining -= 1;
        throw new Error('Temporary corpus request failure.');
      }
      return knowledgeBase;
    }),
    unload: vi.fn(() => {
      order.push('repository.unload');
      if (options.repositoryUnloadError !== undefined) {
        throw options.repositoryUnloadError;
      }
    }),
  };
  const rankAndPack = vi.fn((_input: SelectionInput) => {
    order.push('select');
    return selected;
  });
  const assemble = vi.fn((
    query: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ) => {
    order.push('assemble');
    return {
      preface: [
        { role: 'system' as const, content: 'Ground only in the supplied source.' },
        ...history,
      ],
      userMessage: query,
      selectedSources: [...selected.sources],
      estimatedTokens: 24,
      diagnostics: {
        systemTokens: 8,
        questionTokens: 4,
        historyTokens: 0,
        knowledgeTokens: 8,
        responseReserve: EGREGORE_CONTEXT.responseReserve,
        estimatorHeadroom: EGREGORE_CONTEXT.estimatorHeadroom,
        totalContextTokens: EGREGORE_CONTEXT.maxContextTokens,
      },
    };
  });

  let nextTurnId = 0;
  const dependencies: WishedDependencies = {
    createRepository: () => repository,
    createRuntime: () => runtime,
    rankAndPackContext: rankAndPack,
    assemblePrompt: assemble,
    extractValidCitations: vi.fn((
      response: string,
      sources: SelectedSource[],
    ): ValidCitation[] => {
      const seen = new Set<string>();
      const citations: ValidCitation[] = [];
      for (const match of response.matchAll(/\[(S\d+)\]/g)) {
        const id = match[1] as `S${number}`;
        const citedSource = sources.find((candidate) => candidate.citationId === id);
        if (citedSource === undefined || seen.has(id)) continue;
        seen.add(id);
        citations.push({ id, source: citedSource });
      }
      return citations;
    }),
    createTurnId: () => `turn-${++nextTurnId}`,
    now: () => 1_000,
  };

  return {
    assemblePrompt: assemble,
    dependencies,
    order,
    rankAndPack,
    repository,
    runtime,
    selected,
    source,
  };
}

async function makeReady(result: { current: WishedHookResult }): Promise<void> {
  await act(async () => {
    await result.current.checkCompatibility();
  });
  await act(async () => {
    await result.current.load();
  });
}

describe('useEgregore activation boundary', () => {
  it('constructs without probing, loading, selecting, prompting, or generating', async () => {
    const useEgregore = await loadSubject();
    const harness = createHarness();

    const { result } = renderHook(() => useEgregore(harness.dependencies));

    expect(result.current.state.lifecycle.status).toBe('idle');
    expect(harness.runtime.calls).toEqual([]);
    expect(harness.repository.load).not.toHaveBeenCalled();
    expect(harness.rankAndPack).not.toHaveBeenCalled();
  });

  it('survives React StrictMode setup-cleanup-setup replay before activation', async () => {
    const useEgregore = await loadSubject();
    const harness = createHarness();
    const { result } = renderHook(() => useEgregore(harness.dependencies), {
      wrapper: StrictMode,
    });

    await act(async () => {
      await result.current.checkCompatibility();
      await result.current.load();
    });

    expect(result.current.state.lifecycle.status).toBe('ready');
    expect(harness.order).toEqual([
      'repository.load',
      'runtime.load',
    ]);
  });

  it('checks compatibility without crossing any heavy-work boundary', async () => {
    const useEgregore = await loadSubject();
    const harness = createHarness();
    const { result } = renderHook(() => useEgregore(harness.dependencies));

    await act(async () => {
      await result.current.checkCompatibility();
    });

    expect(harness.runtime.calls.map(({ method }) => method)).toEqual([
      'checkCapabilities',
    ]);
    expect(harness.repository.load).not.toHaveBeenCalled();
    expect(harness.rankAndPack).not.toHaveBeenCalled();
    expect(result.current.state.lifecycle.status).toBe('awaiting-consent');
  });

  it('keeps supported warnings advisory while sanitizing capability messages', async () => {
    const useEgregore = await loadSubject();
    const harness = createHarness({
      capabilityReport: {
        supported: true,
        warnings: [{
          code: 'storage-warning',
          message: 'PRIVATE_STORAGE_DETAILS',
          recoverable: true,
          diagnosticCause: 'PRIVATE_DIAGNOSTIC',
        }],
        failures: [],
        secureContext: true,
        webGpuAvailable: true,
        adapterAvailable: true,
        browser: { family: 'chrome', version: 'test' },
        storageEstimate: null,
      },
    });
    const { result } = renderHook(() => useEgregore(harness.dependencies));

    await act(async () => {
      await result.current.checkCompatibility();
    });

    expect(result.current.state.lifecycle.status).toBe('awaiting-consent');
    expect(result.current.state.capability?.warnings[0]).toMatchObject({
      code: 'storage-warning',
      diagnosticCause: 'storage-warning',
    });
    expect(JSON.stringify(result.current.state.capability)).not.toContain('PRIVATE');
  });

  it('sanitizes unsupported capability failures before exposing the recovery UI', async () => {
    const useEgregore = await loadSubject();
    const harness = createHarness({
      capabilityReport: {
        supported: false,
        warnings: [],
        failures: [{
          code: 'adapter-unavailable',
          message: 'PRIVATE_GPU_DETAILS',
          recoverable: false,
          diagnosticCause: 'PRIVATE_DIAGNOSTIC',
        }],
        secureContext: true,
        webGpuAvailable: true,
        adapterAvailable: false,
        browser: { family: 'chrome', version: 'test' },
        storageEstimate: null,
      },
    });
    const { result } = renderHook(() => useEgregore(harness.dependencies));

    await act(async () => {
      await result.current.checkCompatibility();
    });

    expect(result.current.state.lifecycle.status).toBe('unsupported');
    expect(result.current.state.error).toMatchObject({
      code: 'adapter-unavailable',
      diagnosticCause: 'adapter-unavailable',
    });
    expect(JSON.stringify(result.current.state)).not.toContain('PRIVATE');
  });

  it('loads the repository then runtime only after compatibility succeeds', async () => {
    const useEgregore = await loadSubject();
    const harness = createHarness();
    const { result } = renderHook(() => useEgregore(harness.dependencies));

    await act(async () => {
      await result.current.load();
    });
    expect(harness.repository.load).not.toHaveBeenCalled();
    expect(harness.runtime.calls).toEqual([]);

    await act(async () => {
      await result.current.checkCompatibility();
    });
    harness.order.length = 0;

    await act(async () => {
      await result.current.load();
    });

    expect(harness.order).toEqual(['repository.load', 'runtime.load']);
    expect(harness.runtime.calls.map(({ method }) => method)).toEqual([
      'checkCapabilities',
      'load',
    ]);
    expect(harness.rankAndPack).not.toHaveBeenCalled();
    expect(harness.assemblePrompt).not.toHaveBeenCalled();
    expect(result.current.state.lifecycle.status).toBe('ready');
  });

  it('orders selection, prompt assembly, session creation, and streamed generation', async () => {
    const useEgregore = await loadSubject();
    const harness = createHarness({ responseChunks: ['Grounded ', 'answer [S1].'] });
    const { result } = renderHook(() => useEgregore(harness.dependencies));
    await makeReady(result);
    harness.order.length = 0;

    await act(async () => {
      await result.current.sendMessage('What did Jet publish?');
    });

    expect(harness.order).toEqual([
      'select',
      'assemble',
      'runtime.createSession',
      'runtime.generate',
    ]);
    expect(result.current.state.turns).toEqual([
      expect.objectContaining({ role: 'user', content: 'What did Jet publish?' }),
      expect.objectContaining({
        role: 'assistant',
        content: 'Grounded answer [S1].',
        citations: [{ id: 'S1', source: harness.source }],
      }),
    ]);
    expect(result.current.state.turns.every((turn) => !('sources' in turn))).toBe(true);
    expect(result.current.state.lifecycle.status).toBe('ready');
  });

  it('unloads in safe order and suppresses chunks released after cleanup starts', async () => {
    const useEgregore = await loadSubject();
    const scheduler = new ManualScheduler();
    const harness = createHarness({
      responseChunks: ['Keep this. ', 'DROP THIS [S1].'],
      scheduler,
    });
    const { result } = renderHook(() => useEgregore(harness.dependencies));
    await makeReady(result);
    harness.order.length = 0;

    let generation!: Promise<void>;
    act(() => {
      generation = result.current.sendMessage('Start a response.');
    });
    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    act(() => scheduler.releaseNext());
    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    await waitFor(() => {
      expect(result.current.state.turns.at(-1)?.content).toBe('Keep this. ');
    });

    await act(async () => {
      await result.current.unload();
    });
    expect(harness.order.slice(-4)).toEqual([
      'runtime.cancel',
      'runtime.reset',
      'repository.unload',
      'runtime.unload',
    ]);
    expect(result.current.state.turns).toEqual([]);
    expect(result.current.state.lifecycle.status).toBe('idle');

    act(() => scheduler.releaseNext());
    await act(async () => generation);
    expect(JSON.stringify(result.current.state.turns)).not.toContain('DROP THIS');
  });

  it('aborts an in-flight corpus fetch before ordered cleanup and never starts the runtime', async () => {
    const useEgregore = await loadSubject();
    const fallback = createDeferred<LoadedKnowledgeBase>();
    let receivedSignal: AbortSignal | undefined;
    let abortObserved = false;
    const harness = createHarness({
      repositoryLoad: (signal) => {
        receivedSignal = signal;
        signal?.addEventListener('abort', () => {
          abortObserved = true;
          fallback.reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
        return fallback.promise;
      },
    });
    const { result } = renderHook(() => useEgregore(harness.dependencies));
    await act(async () => result.current.checkCompatibility());

    let activation!: Promise<void>;
    act(() => {
      activation = result.current.load();
    });
    await waitFor(() => expect(harness.repository.load).toHaveBeenCalledOnce());
    harness.order.length = 0;

    await act(async () => result.current.unload());
    if (!abortObserved) fallback.resolve({} as LoadedKnowledgeBase);
    await act(async () => activation);

    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal?.aborted).toBe(true);
    expect(abortObserved).toBe(true);
    expect(harness.order).toEqual([
      'runtime.cancel',
      'runtime.reset',
      'repository.unload',
      'runtime.unload',
    ]);
    expect(harness.runtime.calls.some(({ method }) => method === 'load')).toBe(false);
    expect(result.current.state.lifecycle.status).toBe('idle');
  });

  it('waits for post-fetch corpus validation to settle before repository and runtime unload', async () => {
    const useEgregore = await loadSubject();
    const validation = createDeferred<LoadedKnowledgeBase>();
    let receivedSignal: AbortSignal | undefined;
    const harness = createHarness({
      repositoryLoad: (signal) => {
        receivedSignal = signal;
        return validation.promise;
      },
    });
    const { result } = renderHook(() => useEgregore(harness.dependencies));
    await act(async () => result.current.checkCompatibility());

    let activation!: Promise<void>;
    act(() => {
      activation = result.current.load();
    });
    await waitFor(() => expect(harness.repository.load).toHaveBeenCalledOnce());
    harness.order.length = 0;

    let cleanupSettled = false;
    let cleanup!: Promise<void>;
    act(() => {
      cleanup = result.current.unload().then(() => {
        cleanupSettled = true;
      });
    });
    await waitFor(() => expect(harness.order).toContain('runtime.reset'));
    await act(async () => Promise.resolve());
    const beforeValidationSettles = {
      cleanupSettled,
      order: [...harness.order],
      status: result.current.state.lifecycle.status,
    };

    validation.resolve({} as LoadedKnowledgeBase);
    await act(async () => Promise.all([activation, cleanup]));

    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal?.aborted).toBe(true);
    expect(beforeValidationSettles).toEqual({
      cleanupSettled: false,
      order: ['runtime.cancel', 'runtime.reset'],
      status: 'unloading',
    });
    expect(harness.order).toEqual([
      'runtime.cancel',
      'runtime.reset',
      'repository.unload',
      'runtime.unload',
    ]);
    expect(harness.runtime.calls.some(({ method }) => method === 'load')).toBe(false);
    expect(result.current.state.lifecycle.status).toBe('idle');
  });

  it('performs the same ordered cleanup when the route unmounts', async () => {
    const useEgregore = await loadSubject();
    const harness = createHarness();
    const { result, unmount } = renderHook(() => useEgregore(harness.dependencies));
    await makeReady(result);
    harness.order.length = 0;

    unmount();

    await waitFor(() => {
      expect(harness.order.slice(-4)).toEqual([
        'runtime.cancel',
        'runtime.reset',
        'repository.unload',
        'runtime.unload',
      ]);
    });
  });

  it('aborts an in-flight corpus activation when the route unmounts', async () => {
    const useEgregore = await loadSubject();
    const activationWork = createDeferred<LoadedKnowledgeBase>();
    let receivedSignal: AbortSignal | undefined;
    const harness = createHarness({
      repositoryLoad: (signal) => {
        receivedSignal = signal;
        signal?.addEventListener('abort', () => {
          activationWork.reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
        return activationWork.promise;
      },
    });
    const { result, unmount } = renderHook(() => useEgregore(harness.dependencies));
    await act(async () => result.current.checkCompatibility());
    let activation!: Promise<void>;
    act(() => {
      activation = result.current.load();
    });
    await waitFor(() => expect(harness.repository.load).toHaveBeenCalledOnce());
    harness.order.length = 0;

    unmount();
    await act(async () => activation);

    expect(receivedSignal?.aborted).toBe(true);
    await waitFor(() => expect(harness.order).toEqual([
      'runtime.cancel',
      'runtime.reset',
      'repository.unload',
      'runtime.unload',
    ]));
    expect(harness.runtime.calls.some(({ method }) => method === 'load')).toBe(false);
  });

  it('classifies search-index validation failures without attempting model load', async () => {
    const useEgregore = await loadSubject();
    const harness = createHarness({
      repositoryError: new Error('Search index manifest contract mismatch.'),
    });
    const { result } = renderHook(() => useEgregore(harness.dependencies));

    await act(async () => {
      await result.current.checkCompatibility();
      await result.current.load();
    });

    expect(result.current.state.error?.code).toBe('corpus-index-mismatch');
    expect(harness.runtime.calls.map(({ method }) => method)).toEqual([
      'checkCapabilities',
    ]);
  });

  it('sanitizes dependency failures and rejects unrecognized error codes', async () => {
    const useEgregore = await loadSubject();
    const hostileError = Object.assign(new Error('PRIVATE_PROMPT_OR_SOURCE_TEXT'), {
      code: 'attacker-controlled-code',
      recoverable: false,
      diagnosticCause: 'PRIVATE_DIAGNOSTIC',
    });
    const harness = createHarness({ repositoryError: hostileError });
    const { result } = renderHook(() => useEgregore(harness.dependencies));

    await act(async () => {
      await result.current.checkCompatibility();
      await result.current.load();
    });

    expect(result.current.state.error).toMatchObject({
      code: 'corpus-load-failed',
      recoverable: true,
      diagnosticCause: 'Error',
    });
    expect(JSON.stringify(result.current.state.error)).not.toMatch(/PRIVATE|attacker/);
  });

  it('acknowledges a recoverable load error and retries from explicit consent', async () => {
    const useEgregore = await loadSubject();
    const harness = createHarness({ repositoryFailuresBeforeSuccess: 1 });
    const { result } = renderHook(() => useEgregore(harness.dependencies));

    await act(async () => {
      await result.current.checkCompatibility();
      await result.current.load();
    });
    expect(result.current.state.lifecycle.status).toBe('load-error');
    expect(result.current.state.error?.code).toBe('corpus-load-failed');

    act(() => result.current.recoverFromError());
    expect(result.current.state.lifecycle.status).toBe('awaiting-consent');
    expect(result.current.state.error).toBeNull();

    await act(async () => {
      await result.current.load();
    });
    expect(result.current.state.lifecycle.status).toBe('ready');
    expect(harness.repository.load).toHaveBeenCalledTimes(2);
    expect(harness.runtime.calls.filter(({ method }) => method === 'load')).toHaveLength(1);
  });

  it.each([
    ['complete corpus', true, true],
    ['ranked packing', false, true],
    ['empty selection', false, false],
  ] as const)(
    'passes the %s selection through prompt assembly and response-local sources',
    async (_label, completeCorpusIncluded, hasSource) => {
      const useEgregore = await loadSubject();
      const source = selectedSource();
      const selected = selection(hasSource ? [source] : [], completeCorpusIncluded);
      const harness = createHarness({
        selection: selected,
        responseChunks: [hasSource ? 'Answer [S1].' : 'I do not have a grounded source.'],
      });
      const { result } = renderHook(() => useEgregore(harness.dependencies));
      await makeReady(result);

      await act(async () => {
        await result.current.sendMessage('Question');
      });

      expect(harness.assemblePrompt).toHaveBeenCalledWith(
        'Question',
        [],
        selected,
        EGREGORE_CONTEXT,
      );
      expect(result.current.state.turns.at(-1)?.citations).toHaveLength(hasSource ? 1 : 0);
      expect(result.current.state.turns.at(-1)).not.toHaveProperty('sources');
    },
  );

  it('retains a deterministic partial response marked Stopped', async () => {
    const useEgregore = await loadSubject();
    const scheduler = new ManualScheduler();
    const harness = createHarness({
      responseChunks: ['Partial response. ', 'Never emitted.'],
      scheduler,
    });
    const { result } = renderHook(() => useEgregore(harness.dependencies));
    await makeReady(result);

    let generation!: Promise<void>;
    act(() => {
      generation = result.current.sendMessage('Please answer.');
    });
    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    act(() => scheduler.releaseNext());
    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    await waitFor(() => {
      expect(result.current.state.turns.at(-1)?.content).toBe('Partial response. ');
    });

    act(() => result.current.stop());
    act(() => scheduler.releaseNext());
    await act(async () => generation);

    expect(result.current.state.turns.at(-1)).toMatchObject({
      role: 'assistant',
      content: 'Partial response. ',
      stopped: true,
    });
    expect(result.current.state.lifecycle.status).toBe('ready');
  });

  it('stops cleanly while the first conversation is still being created', async () => {
    const useEgregore = await loadSubject();
    const sessionCreation = createDeferred<void>();
    const harness = createHarness({
      runtimeCreateSessionWait: sessionCreation.promise,
    });
    const { result } = renderHook(() => useEgregore(harness.dependencies));
    await makeReady(result);

    let submission!: Promise<void>;
    act(() => {
      submission = result.current.sendMessage('Stop before generation starts.');
    });
    await waitFor(() => expect(harness.order).toContain('runtime.createSession'));

    act(() => result.current.stop());
    expect(result.current.state.lifecycle.status).toBe('cancelling');
    expect(harness.order).toContain('runtime.cancel');

    sessionCreation.resolve(undefined);
    await act(async () => submission);

    expect(harness.order).not.toContain('runtime.generate');
    expect(result.current.state.lifecycle.status).toBe('ready');
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.turns.at(-1)).toMatchObject({
      role: 'assistant',
      content: '',
      stopped: true,
    });
  });

  it('fails closed when stopping a late-created session cannot clean up its conversation', async () => {
    const useEgregore = await loadSubject();
    const sessionCreation = createDeferred<void>();
    const harness = createHarness({
      runtimeCreateSessionWait: sessionCreation.promise,
      runtimeCreateSessionError: createRuntimeError(
        'engine-cleanup-failed',
        'PRIVATE_STALE_SESSION',
        true,
      ),
    });
    const { result } = renderHook(() => useEgregore(harness.dependencies));
    await makeReady(result);

    let submission!: Promise<void>;
    act(() => {
      submission = result.current.sendMessage('Stop with failed stale cleanup.');
    });
    await waitFor(() => expect(harness.order).toContain('runtime.createSession'));
    act(() => result.current.stop());
    sessionCreation.resolve(undefined);
    await act(async () => submission);

    expect(harness.order).not.toContain('runtime.generate');
    expect(result.current.state.lifecycle.status).toBe('unload-error');
    expect(result.current.state.error).toMatchObject({
      code: 'engine-cleanup-failed',
      message: "Egregore could not fully release the local model runtime.",
    });
    expect(JSON.stringify(result.current.state.error)).not.toContain('PRIVATE');
    expect(result.current.state.turns.at(-1)).toMatchObject({
      role: 'assistant',
      content: '',
      stopped: true,
    });
    act(() => result.current.recoverFromError());
    expect(result.current.state.lifecycle.status).toBe('unload-error');
    expect(result.current.state.error?.code).toBe('engine-cleanup-failed');
  });

  it('starts a new session by resetting first and clearing only after success', async () => {
    const useEgregore = await loadSubject();
    const harness = createHarness();
    const { result } = renderHook(() => useEgregore(harness.dependencies));
    await makeReady(result);
    await act(async () => {
      await result.current.sendMessage('Keep this until reset succeeds.');
    });
    harness.order.length = 0;

    await act(async () => {
      await result.current.startNewSession();
    });

    expect(harness.order).toEqual(['runtime.reset']);
    expect(result.current.state.turns).toEqual([]);
    expect(result.current.state.lifecycle.status).toBe('ready');
    expect(harness.repository.unload).not.toHaveBeenCalled();
  });

  it('preserves the transcript when starting a new session cannot delete the conversation', async () => {
    const useEgregore = await loadSubject();
    const harness = createHarness({ runtimeFailures: { reset: true } });
    const { result } = renderHook(() => useEgregore(harness.dependencies));
    await makeReady(result);
    await act(async () => {
      await result.current.sendMessage('Preserve this transcript.');
    });
    const transcript = JSON.stringify(result.current.state.turns);

    await act(async () => {
      await result.current.startNewSession();
    });

    expect(JSON.stringify(result.current.state.turns)).toBe(transcript);
    expect(result.current.state.error?.code).toBe('engine-cleanup-failed');
    expect(result.current.state.lifecycle.status).toBe('reset-error');
  });

  it('retries a failed session reset and clears the transcript only after retry succeeds', async () => {
    const useEgregore = await loadSubject();
    const harness = createHarness({ resetFailuresBeforeSuccess: 1 });
    const { result } = renderHook(() => useEgregore(harness.dependencies));
    await makeReady(result);
    await act(async () => {
      await result.current.sendMessage('Keep this through the failed reset.');
    });
    const transcript = JSON.stringify(result.current.state.turns);

    await act(async () => {
      await result.current.startNewSession();
    });
    expect(result.current.state.lifecycle.status).toBe('reset-error');
    expect(JSON.stringify(result.current.state.turns)).toBe(transcript);

    await act(async () => {
      await result.current.startNewSession();
    });
    expect(result.current.state.lifecycle.status).toBe('ready');
    expect(result.current.state.turns).toEqual([]);
  });

  it('rolls back a failed generation and retries against only the prior complete transcript', async () => {
    const useEgregore = await loadSubject();
    const harness = createHarness();
    const { result } = renderHook(() => useEgregore(harness.dependencies));
    await makeReady(result);

    await act(async () => {
      await result.current.sendMessage('Prior complete question');
    });
    const priorTranscript = JSON.stringify(result.current.state.turns);
    harness.runtime.failNextGeneration();

    await act(async () => {
      await result.current.sendMessage('Retry this exact question');
    });

    expect(result.current.state.lifecycle.status).toBe('generation-error');
    expect(result.current.state.error?.code).toBe('generation-failed');
    expect(JSON.stringify(result.current.state.turns)).toBe(priorTranscript);
    expect(JSON.stringify(result.current.state.turns)).not.toContain('Retry this exact question');

    act(() => result.current.recoverFromError());
    expect(result.current.state.lifecycle.status).toBe('ready');
    expect(result.current.state.error).toBeNull();

    await act(async () => {
      await result.current.sendMessage('Retry this exact question');
    });

    const retryAssemblies = harness.assemblePrompt.mock.calls.filter(
      ([question]) => question === 'Retry this exact question',
    );
    expect(retryAssemblies).toHaveLength(2);
    expect(retryAssemblies[0]?.[1]).toEqual(retryAssemblies[1]?.[1]);
    expect(retryAssemblies[1]?.[1]).toEqual([
      { role: 'user', content: 'Prior complete question' },
      { role: 'assistant', content: 'Grounded answer [S1].' },
    ]);
    expect(harness.runtime.generationMessages).toEqual([
      'Prior complete question',
      'Retry this exact question',
      'Retry this exact question',
    ]);
    expect(result.current.state.lifecycle.status).toBe('ready');
    expect(result.current.state.turns.at(-1)?.content).toBe('Grounded answer [S1].');
  });

  it('preserves the exact transcript and avoids runtime calls at conversation exhaustion', async () => {
    const useEgregore = await loadSubject();
    const harness = createHarness();
    const { result } = renderHook(() => useEgregore(harness.dependencies));
    await makeReady(result);
    await act(async () => {
      await result.current.sendMessage('A complete prior question.');
    });
    const transcript = JSON.stringify(result.current.state.turns);
    const runtimeCallCount = harness.runtime.calls.length;
    const exhausted = Object.assign(
      new Error('The current session is full. Start a new session to continue.'),
      {
        name: 'EgregorePromptError',
        code: 'conversation-limit-reached',
        recoverable: true,
        diagnosticCause: 'conversation-limit-reached',
      },
    );
    harness.assemblePrompt.mockImplementationOnce(() => {
      throw exhausted;
    });

    await act(async () => {
      await result.current.sendMessage('This question crosses the reserve.');
    });

    expect(JSON.stringify(result.current.state.turns)).toBe(transcript);
    expect(result.current.state.error?.code).toBe('conversation-limit-reached');
    expect(harness.runtime.calls).toHaveLength(runtimeCallCount);
    expect(result.current.startNewSession).toBeTypeOf('function');
  });

  it('runs every cleanup stage and reports only aggregated safe diagnostics', async () => {
    const useEgregore = await loadSubject();
    const harness = createHarness({
      runtimeFailures: { reset: true, unload: true },
      repositoryUnloadError: new Error('PRIVATE_REPOSITORY_FAILURE'),
    });
    const { result } = renderHook(() => useEgregore(harness.dependencies));
    await makeReady(result);
    harness.order.length = 0;

    await act(async () => {
      await result.current.unload();
    });

    expect(harness.order).toEqual([
      'runtime.cancel',
      'runtime.reset',
      'repository.unload',
      'runtime.unload',
    ]);
    expect(result.current.state.lifecycle.status).toBe('unload-error');
    expect(result.current.state.error).toMatchObject({
      code: 'engine-cleanup-failed',
      diagnosticCause: 'reset,repository,runtime',
    });
    expect(JSON.stringify(result.current.state.error)).not.toContain('PRIVATE');
  });
});

describe('EgregoreExperience production composition', () => {
  it('updates rendered header metadata when the package version prop changes', () => {
    const harness = createHarness();
    const view = render(
      <EgregoreExperience
        appVersion="9.8.7-test"
        dependencies={harness.dependencies}
      />,
    );

    expect(screen.getByText('jet-web 9.8.7-test')).toBeInTheDocument();
    const licenses = screen.getByRole('link', {
      name: "Open Egregore model and open-source licenses",
    });
    expect(licenses).toHaveAttribute('href', '/licenses/egregore/');

    view.rerender(
      <EgregoreExperience
        appVersion="9.8.8-test"
        dependencies={harness.dependencies}
      />,
    );
    expect(screen.getByText('jet-web 9.8.8-test')).toBeInTheDocument();
    expect(screen.queryByText('jet-web 9.8.7-test')).not.toBeInTheDocument();
  });

  it('renders only the content-sized chrome-free status and separate full announcement', () => {
    const harness = createHarness();
    render(<EgregoreExperience dependencies={harness.dependencies} />);

    const visibleStatus = screen.getByTestId('lifecycle-visible-status');
    const announcement = screen.getByTestId('lifecycle-announcement');
    expect(screen.queryByTestId('lifecycle-status-slot')).not.toBeInTheDocument();
    expect(visibleStatus).toHaveClass('w-fit');
    expect(visibleStatus.className).not.toMatch(/(?:^|\s)(?:min-w-|w-\[|h-(?:\[|\d))/);
    expect(visibleStatus.className).not.toMatch(
      /(?:^|\s)(?:border(?:-\S+)?|bg-\S+|rounded\S*|shadow\S*|p[trblxy]?-\S+)(?:\s|$)/,
    );
    expect(visibleStatus).toHaveAttribute('aria-hidden', 'true');
    expect(visibleStatus).not.toHaveAttribute('aria-live');
    expect(within(visibleStatus).getByTestId('lifecycle-visual-label')).toHaveTextContent('Not running');
    expect(announcement).toHaveAttribute('role', 'status');
    expect(announcement).toHaveAttribute('aria-live', 'polite');
    expect(announcement).toHaveTextContent("Egregore is not running.");
    expect(visibleStatus).not.toHaveTextContent('%');
  });

  it('keeps stable header actions after status while a response is generating', async () => {
    const scheduler = new ManualScheduler();
    const harness = createHarness({
      responseChunks: ['Grounded answer [S1].'],
      scheduler,
    });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    const visibleStatus = screen.getByTestId('lifecycle-visible-status');
    const newSession = screen.getByRole('button', { name: /New session/ });
    const unload = screen.getByRole('button', { name: /^Unload/ });
    const readyLabels = [newSession.textContent, unload.textContent];
    expect(newSession).toBeEnabled();
    expect(unload).toBeEnabled();
    expect(visibleStatus.compareDocumentPosition(newSession) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(newSession.compareDocumentPosition(unload) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const metadata = screen.getByTestId('composer-metadata');
    const keyboardHint = screen.getByTestId('composer-keyboard-hint');
    const localOnly = screen.getByTestId('composer-local-only');
    expect(metadata).toHaveClass(
      'justify-end',
      'min-[768px]:[@media(pointer:fine)]:justify-between',
    );
    expect(keyboardHint).toHaveClass(
      'hidden',
      'min-[768px]:[@media(pointer:fine)]:inline',
    );
    expect(localOnly).toHaveTextContent('Local only');

    fireEvent.change(composer, { target: { value: 'Hold this response' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    await waitFor(() => expect(screen.getByTestId('lifecycle-announcement')).toHaveTextContent(
      "Egregore is responding.",
    ));

    expect(screen.getByRole('button', { name: /New session/ })).toBe(newSession);
    expect(screen.getByRole('button', { name: /^Unload/ })).toBe(unload);
    expect(newSession).toBeDisabled();
    expect(unload).toBeEnabled();
    expect([newSession.textContent, unload.textContent]).toEqual(readyLabels);

    act(() => scheduler.releaseNext());
    await waitFor(() => expect(newSession).toBeEnabled());
    expect(unload).toBeEnabled();
    expect([newSession.textContent, unload.textContent]).toEqual(readyLabels);
  });

  it('keeps activation explicit and exposes cited documents only through a collapsed disclosure', async () => {
    const harness = createHarness({ responseChunks: ['Grounded answer [S1].'] });
    render(<EgregoreExperience dependencies={harness.dependencies} />);

    expect(screen.getByText(/frontier local AI/)).toBeInTheDocument();
    expect(screen.queryByText(/runs Gemma 4 E2B/)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    await screen.findByRole('button', { name: /Load Egregore/ });
    expect(harness.runtime.calls.map(({ method }) => method)).toEqual([
      'checkCapabilities',
    ]);

    fireEvent.click(screen.getByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    await waitFor(() => expect(composer).toHaveFocus());
    expect(harness.runtime.calls.map(({ method }) => method)).toEqual([
      'checkCapabilities',
      'load',
    ]);

    fireEvent.change(composer, { target: { value: 'What did Jet publish?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByRole('link', { name: '[S1] Grounded source' });
    const sourceTrigger = await screen.findByRole('button', { name: '1 source' });

    expect(screen.queryByText('What does Jet write about agentic work?')).not.toBeInTheDocument();
    expect(sourceTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('link', { name: /Grounded source/ })).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'Sources for this response' })).not.toBeInTheDocument();

    sourceTrigger.focus();
    fireEvent.click(sourceTrigger);
    const sourceRegion = screen.getByRole('region', { name: 'Sources for this response' });
    expect(sourceTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(sourceTrigger).toHaveAttribute('aria-controls', sourceRegion.id);
    expect(within(sourceRegion).getByRole('list')).toBeInTheDocument();
    expect(within(sourceRegion).getByRole('link', { name: '[S1] Grounded source' }))
      .toBeInTheDocument();

    fireEvent.click(sourceTrigger);
    expect(sourceTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Sources for this response' })).not.toBeInTheDocument();
  });

  it('keeps the reliability disclosure through starter selection, removes it on submit, and restores it after reset', async () => {
    const disclosureCopy = 'Egregore can make mistakes. Check cited sources.';
    const harness = createHarness({ responseChunks: ['Grounded answer [S1].'] });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    const disclosure = screen.getByText(disclosureCopy);
    const form = composer.closest('form');
    if (!(form instanceof HTMLFormElement)) throw new Error('Composer form is missing.');

    expect(disclosure).toHaveClass('text-sm', 'text-text-tertiary', 'mb-2xs');
    expect(disclosure.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(form.compareDocumentPosition(screen.getByTestId('composer-metadata')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByText('What does Jet write about agentic work?'));
    expect(screen.getByText(disclosureCopy)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByRole('link', { name: '[S1] Grounded source' });
    expect(screen.queryByText(disclosureCopy)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /New session/ }));
    expect(await screen.findByText(disclosureCopy)).toBeInTheDocument();
  });

  it('keeps touch Load, pointer submit, response completion, and touch New session blurred', async () => {
    const scheduler = new ManualScheduler();
    const harness = createHarness({
      responseChunks: ['Grounded answer [S1].'],
      scheduler,
    });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    const load = await screen.findByRole('button', { name: /Load Egregore/ });
    fireEvent.pointerDown(load, { pointerType: 'touch' });
    fireEvent.click(load);
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    expect(composer).not.toHaveFocus();

    fireEvent.pointerDown(composer, { pointerType: 'touch' });
    composer.focus();
    expect(composer).toHaveFocus();
    fireEvent.change(composer, { target: { value: 'Pointer submit' } });
    const send = screen.getByRole('button', { name: 'Send message' });
    fireEvent.pointerDown(send, { pointerType: 'touch' });
    fireEvent.click(send);
    expect(composer).not.toHaveFocus();
    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    act(() => scheduler.releaseNext());
    await waitFor(() => expect(screen.getByTestId('lifecycle-announcement')).toHaveTextContent(
      "Egregore is ready.",
    ));
    expect(composer).not.toHaveFocus();

    const newSession = screen.getByRole('button', { name: /New session/ });
    fireEvent.pointerDown(newSession, { pointerType: 'touch' });
    fireEvent.click(newSession);
    await screen.findByText('What does Jet write about agentic work?');
    expect(composer).not.toHaveFocus();
  });

  it('preserves touch modality through virtual-keyboard character input and Enter', async () => {
    const scheduler = new ManualScheduler();
    const harness = createHarness({ responseChunks: ['Answer [S1].'], scheduler });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    const load = await screen.findByRole('button', { name: /Load Egregore/ });
    fireEvent.pointerDown(load, { pointerType: 'touch' });
    fireEvent.click(load);
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.pointerDown(composer, { pointerType: 'touch' });
    composer.focus();
    fireEvent.keyDown(composer, { key: 'V', code: 'KeyV' });
    fireEvent.change(composer, { target: { value: 'Virtual keyboard send' } });

    fireEvent.keyDown(composer, { key: 'Enter' });
    expect(composer).not.toHaveFocus();
    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    act(() => scheduler.releaseNext());
    await waitFor(() => expect(screen.getByTestId('lifecycle-announcement')).toHaveTextContent(
      "Egregore is ready.",
    ));
    expect(composer).not.toHaveFocus();
  });

  it('keeps a touch-submitted partial response visible and the composer blurred after cancellation', async () => {
    const scheduler = new ManualScheduler();
    const harness = createHarness({
      responseChunks: ['Partial response remains. ', 'Never emitted.'],
      scheduler,
    });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    const load = await screen.findByRole('button', { name: /Load Egregore/ });
    fireEvent.pointerDown(load, { pointerType: 'touch' });
    fireEvent.click(load);
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.pointerDown(composer, { pointerType: 'touch' });
    composer.focus();
    fireEvent.keyDown(composer, { key: 'C', code: 'KeyC' });
    fireEvent.change(composer, { target: { value: 'Cancel this response' } });
    fireEvent.keyDown(composer, { key: 'Enter' });
    expect(composer).not.toHaveFocus();

    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    act(() => scheduler.releaseNext());
    await screen.findByText('Partial response remains.');
    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    const stop = screen.getByRole('button', { name: 'Stop response' });
    fireEvent.pointerDown(stop, { pointerType: 'touch' });
    fireEvent.click(stop);
    act(() => scheduler.releaseNext());

    expect(await screen.findByText('Stopped')).toBeInTheDocument();
    expect(screen.getByText('Partial response remains.')).toBeInTheDocument();
    expect(composer).not.toHaveFocus();
  });

  it('renders a stopped turn instead of an error when Stop precedes first-session creation', async () => {
    const sessionCreation = createDeferred<void>();
    const harness = createHarness({
      runtimeCreateSessionWait: sessionCreation.promise,
    });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.change(composer, { target: { value: 'Stop this before generation.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(harness.order).toContain('runtime.createSession'));

    fireEvent.click(screen.getByRole('button', { name: 'Stop response' }));
    await waitFor(() => expect(screen.getByTestId('lifecycle-announcement')).toHaveTextContent(
      'Stopping the current response.',
    ));
    sessionCreation.resolve(undefined);

    expect(await screen.findByText('Stopped')).toBeInTheDocument();
    expect(screen.getByTestId('lifecycle-announcement')).toHaveTextContent(
      "Egregore is ready.",
    );
    expect(screen.queryByRole('button', { name: 'Try another question' })).not.toBeInTheDocument();
    expect(harness.order).not.toContain('runtime.generate');
  });

  it('requires Unload when stopped session creation leaves cleanup pending', async () => {
    const sessionCreation = createDeferred<void>();
    const harness = createHarness({
      runtimeCreateSessionWait: sessionCreation.promise,
      runtimeCreateSessionError: createRuntimeError(
        'engine-cleanup-failed',
        'PRIVATE_STALE_SESSION',
        true,
      ),
    });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.change(composer, { target: { value: 'Stop with failed cleanup.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(harness.order).toContain('runtime.createSession'));
    fireEvent.click(screen.getByRole('button', { name: 'Stop response' }));
    await waitFor(() => expect(screen.getByTestId('lifecycle-announcement')).toHaveTextContent(
      'Stopping the current response.',
    ));
    sessionCreation.resolve(undefined);

    expect(await screen.findByText(
      "Egregore could not fully release the local model runtime.",
    )).toBeInTheDocument();
    expect(screen.getByText('Stopped')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId('lifecycle-visual-label')).toHaveLength(1));
    expect(screen.getByTestId('lifecycle-visual-label')).toHaveTextContent('Not running');
    expect(screen.getByTestId('lifecycle-announcement')).toHaveTextContent(
      "Egregore did not finish unloading. Review the recovery action.",
    );
    expect(screen.queryByRole('button', { name: 'Try another question' })).not.toBeInTheDocument();
    const unload = screen.getByRole('button', { name: 'Retry unload' });
    fireEvent.click(unload);
    expect(await screen.findByRole('button', { name: 'Check compatibility' })).toBeInTheDocument();
  });

  it('keeps touch-origin virtual-keyboard recovery blurred after character input', async () => {
    const harness = createHarness({ generationFailuresBeforeSuccess: 1 });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    const load = await screen.findByRole('button', { name: /Load Egregore/ });
    fireEvent.pointerDown(load, { pointerType: 'touch' });
    fireEvent.click(load);
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.pointerDown(composer, { pointerType: 'touch' });
    composer.focus();
    fireEvent.keyDown(composer, { key: 'R', code: 'KeyR' });
    fireEvent.change(composer, { target: { value: 'Recover without reopening the keyboard' } });
    fireEvent.keyDown(composer, { key: 'Enter' });
    expect(composer).not.toHaveFocus();

    const recovery = await screen.findByRole('button', { name: 'Try another question' });
    fireEvent.pointerDown(recovery, { pointerType: 'touch' });
    fireEvent.click(recovery);
    await waitFor(() => expect(screen.getByTestId('lifecycle-announcement')).toHaveTextContent(
      "Egregore is ready.",
    ));
    expect(composer).not.toHaveFocus();
  });

  it('waits for the touch visual viewport to settle before final submit positioning', async () => {
    const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    let resizeListener: (() => void) | null = null;
    const visualViewport = {
      addEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
        resizeListener = typeof listener === 'function'
          ? () => listener(new Event('resize'))
          : () => listener.handleEvent(new Event('resize'));
      }),
      removeEventListener: vi.fn(() => {
        resizeListener = null;
      }),
    } as unknown as VisualViewport;
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visualViewport,
    });

    try {
      const scheduler = new ManualScheduler();
      const harness = createHarness({ responseChunks: ['Settled response [S1].'], scheduler });
      render(<EgregoreExperience dependencies={harness.dependencies} />);
      fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
      const load = await screen.findByRole('button', { name: /Load Egregore/ });
      fireEvent.pointerDown(load, { pointerType: 'touch' });
      fireEvent.click(load);
      const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
      fireEvent.pointerDown(composer, { pointerType: 'touch' });
      composer.focus();
      fireEvent.keyDown(composer, { key: 'S', code: 'KeyS' });
      fireEvent.change(composer, { target: { value: 'Settle after keyboard dismissal' } });
      fireEvent.keyDown(composer, { key: 'Enter' });
      expect(composer).not.toHaveFocus();

      const scroller = await screen.findByTestId('conversation-scroller');
      let assignedScrollTop = -1;
      Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 600 });
      Object.defineProperty(scroller, 'scrollTop', {
        configurable: true,
        get: () => assignedScrollTop,
        set: (value: number) => { assignedScrollTop = value; },
      });
      expect(assignedScrollTop).toBe(-1);
      expect(resizeListener).not.toBeNull();

      act(() => resizeListener?.());
      await waitFor(() => expect(assignedScrollTop).toBe(600));
      expect(visualViewport.removeEventListener).toHaveBeenCalledWith(
        'resize',
        expect.any(Function),
      );
    } finally {
      if (originalVisualViewport === undefined) {
        Reflect.deleteProperty(window, 'visualViewport');
      } else {
        Object.defineProperty(window, 'visualViewport', originalVisualViewport);
      }
    }
  });

  it('retains focus for desktop keyboard Load, hardware Enter, completion, and New session', async () => {
    const scheduler = new ManualScheduler();
    const harness = createHarness({ responseChunks: ['Answer [S1].'], scheduler });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    const check = screen.getByRole('button', { name: 'Check compatibility' });
    fireEvent.keyDown(check, { key: 'Enter' });
    fireEvent.click(check);
    const load = await screen.findByRole('button', { name: /Load Egregore/ });
    fireEvent.keyDown(load, { key: 'Enter' });
    fireEvent.click(load);
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    await waitFor(() => expect(composer).toHaveFocus());

    fireEvent.pointerDown(composer, { pointerType: 'mouse' });
    composer.focus();
    fireEvent.change(composer, { target: { value: 'Hardware keyboard send' } });
    fireEvent.keyDown(composer, { key: 'Enter' });
    expect(composer).toHaveFocus();
    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    act(() => scheduler.releaseNext());
    await waitFor(() => expect(screen.getByTestId('lifecycle-announcement')).toHaveTextContent(
      "Egregore is ready.",
    ));
    expect(composer).toHaveFocus();

    const newSession = screen.getByRole('button', { name: /New session/ });
    fireEvent.keyDown(newSession, { key: 'Enter' });
    fireEvent.click(newSession);
    await screen.findByText('What does Jet write about agentic work?');
    await waitFor(() => expect(composer).toHaveFocus());
  });

  it('sticky-follows delayed streamed tokens through completion without stealing keyboard focus', async () => {
    const scheduler = new ManualScheduler();
    const harness = createHarness({
      responseChunks: ['First late token. ', 'Final late token [S1].'],
      scheduler,
    });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.change(composer, { target: { value: 'Stream late tokens' } });
    fireEvent.keyDown(composer, { key: 'Enter' });
    const scroller = await screen.findByTestId('conversation-scroller');
    let assignedScrollTop = -1;
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 640 });
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      get: () => assignedScrollTop,
      set: (value: number) => { assignedScrollTop = value; },
    });

    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    act(() => scheduler.releaseNext());
    await screen.findByText('First late token.');
    await waitFor(() => expect(assignedScrollTop).toBe(640));
    expect(composer).toHaveFocus();

    assignedScrollTop = -1;
    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    act(() => scheduler.releaseNext());
    await screen.findByRole('link', { name: '[S1] Grounded source' });
    await waitFor(() => expect(assignedScrollTop).toBe(640));
    expect(composer).toHaveFocus();
  });

  it('suspends sticky follow after manual scroll-away and restores it on demand or at bottom', async () => {
    const scheduler = new ManualScheduler();
    const harness = createHarness({
      responseChunks: [
        'First overflow chunk. ',
        'Second unseen chunk. ',
        'Third chunk after jump. ',
        'Final chunk [S1].',
      ],
      scheduler,
    });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.change(composer, { target: { value: 'Stream enough content to overflow' } });
    fireEvent.keyDown(composer, { key: 'Enter' });
    const scroller = await screen.findByTestId('conversation-scroller');
    let assignedScrollTop = 700;
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 200 });
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 900 });
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      get: () => assignedScrollTop,
      set: (value: number) => { assignedScrollTop = value; },
    });

    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    act(() => scheduler.releaseNext());
    await screen.findByText('First overflow chunk.');
    await waitFor(() => expect(assignedScrollTop).toBe(900));

    assignedScrollTop = 200;
    fireEvent.scroll(scroller);
    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    act(() => scheduler.releaseNext());
    await screen.findByText(/Second unseen chunk/);
    expect(assignedScrollTop).toBe(200);
    const jumpToLatest = await screen.findByRole('button', { name: 'Jump to latest' });
    expect(jumpToLatest).toHaveClass('action', 'action--compact');
    expect(jumpToLatest).toHaveAttribute('data-action-density', 'compact');
    expect(jumpToLatest).not.toHaveFocus();
    expect(composer).toHaveFocus();

    fireEvent.click(jumpToLatest);
    expect(assignedScrollTop).toBe(900);
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument();
    expect(composer).toHaveFocus();

    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    act(() => scheduler.releaseNext());
    await screen.findByText(/Third chunk after jump/);
    await waitFor(() => expect(assignedScrollTop).toBe(900));
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument();

    assignedScrollTop = 200;
    fireEvent.scroll(scroller);
    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    act(() => scheduler.releaseNext());
    await screen.findByRole('link', { name: '[S1] Grounded source' });
    expect(assignedScrollTop).toBe(200);
    await screen.findByRole('button', { name: 'Jump to latest' });

    assignedScrollTop = 700;
    fireEvent.scroll(scroller);
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument();
  });

  it('keeps following when content grows before a programmatic scroll event is delivered', async () => {
    const scheduler = new ManualScheduler();
    const harness = createHarness({
      responseChunks: [
        'First overflow chunk. ',
        'Second unseen chunk. ',
        'Third chunk after jump [S1].',
      ],
      scheduler,
    });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.change(composer, { target: { value: 'Stream enough content to overflow' } });
    fireEvent.keyDown(composer, { key: 'Enter' });
    const scroller = await screen.findByTestId('conversation-scroller');
    const clientHeight = 200;
    let currentScrollHeight = 900;
    let assignedScrollTop = 700;
    let scrollAssignments = 0;
    Object.defineProperty(scroller, 'clientHeight', {
      configurable: true,
      value: clientHeight,
    });
    Object.defineProperty(scroller, 'scrollHeight', {
      configurable: true,
      get: () => currentScrollHeight,
    });
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      get: () => assignedScrollTop,
      set: (value: number) => {
        scrollAssignments += 1;
        assignedScrollTop = Math.min(
          Math.max(value, 0),
          currentScrollHeight - clientHeight,
        );
      },
    });

    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    act(() => scheduler.releaseNext());
    await screen.findByText('First overflow chunk.');
    await waitFor(() => expect(scrollAssignments).toBeGreaterThan(0));
    await waitFor(() => expect(assignedScrollTop).toBe(700));

    assignedScrollTop = 200;
    fireEvent.scroll(scroller);
    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    act(() => scheduler.releaseNext());
    await screen.findByText(/Second unseen chunk/);
    const jumpToLatest = await screen.findByRole('button', { name: 'Jump to latest' });

    fireEvent.click(jumpToLatest);
    expect(assignedScrollTop).toBe(700);
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument();

    currentScrollHeight = 1_100;
    fireEvent.scroll(scroller);
    expect(assignedScrollTop).toBe(900);

    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    act(() => scheduler.releaseNext());
    await screen.findByRole('link', { name: '[S1] Grounded source' });
    await waitFor(() => expect(assignedScrollTop).toBe(900));
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).not.toBeInTheDocument();
  });

  it('keeps uncited packed context out of a one-source disclosure', async () => {
    const cited = selectedSource();
    const uncitedSecond = {
      ...selectedSource(),
      citationId: 'S2' as const,
      title: 'Uncited second source',
      canonicalUrl: 'https://jetsanchez.com/blog/uncited-second/',
    };
    const uncitedThird = {
      ...selectedSource(),
      citationId: 'S3' as const,
      title: 'Uncited third source',
      canonicalUrl: 'https://jetsanchez.com/blog/uncited-third/',
    };
    const harness = createHarness({
      responseChunks: ['Grounded answer [S1].'],
      selection: selection([cited, uncitedSecond, uncitedThird]),
    });
    render(<EgregoreExperience dependencies={harness.dependencies} />);

    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.change(composer, { target: { value: 'Use one source' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await screen.findByRole('link', { name: '[S1] Grounded source' });
    const sourceTrigger = await screen.findByRole('button', { name: '1 source' });
    expect(sourceTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Sources for this response' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Uncited second source/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Uncited third source/ })).not.toBeInTheDocument();

    fireEvent.click(sourceTrigger);
    const sourceRegion = screen.getByRole('region', { name: 'Sources for this response' });
    expect(within(sourceRegion).getAllByRole('link')).toHaveLength(1);
    expect(within(sourceRegion).getByRole('link', { name: '[S1] Grounded source' }))
      .toBeInTheDocument();
  });

  it('wraps a complete long source title without truncation or clamping', async () => {
    const longTitle = 'The Recursive Convergence Hypothesis: Emergent Sentience as a Structural Attractor of Recursive ASI';
    const longTitleSource = {
      ...selectedSource(),
      title: longTitle,
    };
    const harness = createHarness({
      responseChunks: ['Grounded answer [S1].'],
      selection: selection([longTitleSource]),
    });
    render(<EgregoreExperience dependencies={harness.dependencies} />);

    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.change(composer, { target: { value: 'Use the long source title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    const sourceTrigger = await screen.findByRole('button', { name: '1 source' });
    fireEvent.click(sourceTrigger);
    const sourceRegion = screen.getByRole('region', { name: 'Sources for this response' });
    const sourceLink = within(sourceRegion).getByRole('link', { name: `[S1] ${longTitle}` });
    const title = within(sourceLink).getByText(longTitle);
    expect(title).toHaveTextContent(longTitle);
    expect(title).toHaveClass('min-w-0', 'break-words', '[overflow-wrap:anywhere]');
    expect(title.className).not.toMatch(/line-clamp|truncate|overflow-hidden/);
    expect(title.textContent).toBe(longTitle);
    expect(sourceLink.className).not.toMatch(/rounded-full/);
  });

  it('deduplicates multiple cited documents in first-citation order inside the disclosure', async () => {
    const sharedDocumentUrl = 'https://jetsanchez.com/works/shared-document/';
    const laterSharedChunk = {
      ...selectedSource(),
      citationId: 'S1' as const,
      title: 'Same document, later citation',
      canonicalUrl: sharedDocumentUrl,
    };
    const firstSharedChunk = {
      ...selectedSource(),
      citationId: 'S2' as const,
      title: 'Same document, first cited chunk',
      canonicalUrl: sharedDocumentUrl,
    };
    const secondDocument = {
      ...selectedSource(),
      citationId: 'S3' as const,
      title: 'Second cited document',
      canonicalUrl: 'https://jetsanchez.com/blog/second-cited/',
    };
    const uncitedDocument = {
      ...selectedSource(),
      citationId: 'S4' as const,
      title: 'Uncited packed document',
      canonicalUrl: 'https://jetsanchez.com/blog/uncited-packed/',
    };
    const harness = createHarness({
      responseChunks: ['Supported by the first chunk [S2], then another document [S3], and the same document again [S1].'],
      selection: selection([
        laterSharedChunk,
        firstSharedChunk,
        secondDocument,
        uncitedDocument,
      ]),
    });
    render(<EgregoreExperience dependencies={harness.dependencies} />);

    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.change(composer, { target: { value: 'Use multiple sources' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    const sourceTrigger = await screen.findByRole('button', { name: '2 sources' });
    expect(sourceTrigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(sourceTrigger);
    const sourceRegion = screen.getByRole('region', { name: 'Sources for this response' });
    const sourceLinks = within(sourceRegion).getAllByRole('link');
    expect(sourceLinks).toHaveLength(2);
    expect(sourceLinks.map((link) => link.getAttribute('aria-label'))).toEqual([
      '[S2] Same document, first cited chunk',
      '[S3] Second cited document',
    ]);
    expect(within(sourceRegion).queryByText('Same document, later citation')).not.toBeInTheDocument();
    expect(within(sourceRegion).queryByText('Uncited packed document')).not.toBeInTheDocument();
  });

  it('renders no source disclosure for a completed response with zero validated citations', async () => {
    const harness = createHarness({ responseChunks: ['Answer without a citation.'] });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.change(composer, { target: { value: 'Answer without sources' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await screen.findByText('Answer without a citation.');
    expect(screen.queryByRole('button', { name: /sources?/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('response-source-disclosure')).not.toBeInTheDocument();
    expect(screen.queryByTestId('response-source-footer')).not.toBeInTheDocument();
  });

  it('waits for completion before showing sources and keeps a cited stopped response collapsed', async () => {
    const scheduler = new ManualScheduler();
    const harness = createHarness({
      responseChunks: ['Partial cited response [S1]. ', 'Never emitted.'],
      scheduler,
    });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.change(composer, { target: { value: 'Stop after a cited chunk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    act(() => scheduler.releaseNext());
    await screen.findByText(/Partial cited response/);
    expect(screen.queryByRole('button', { name: /sources?/ })).not.toBeInTheDocument();
    await waitFor(() => expect(scheduler.pendingCount).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Stop response' }));
    act(() => scheduler.releaseNext());

    expect(await screen.findByText('Stopped')).toBeInTheDocument();
    const sourceTrigger = await screen.findByRole('button', { name: '1 source' });
    expect(sourceTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Sources for this response' })).not.toBeInTheDocument();
  });

  it('keeps expansion state local to each completed assistant response', async () => {
    const harness = createHarness({ responseChunks: ['Grounded answer [S1].'] });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });

    fireEvent.change(composer, { target: { value: 'First response' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    const firstTrigger = await screen.findByRole('button', { name: '1 source' });
    fireEvent.click(firstTrigger);
    expect(firstTrigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.change(composer, { target: { value: 'Second response' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: '1 source' })).toHaveLength(2));
    const [first, second] = screen.getAllByRole('button', { name: '1 source' });
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(second).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('region', { name: 'Sources for this response' })).toHaveLength(1);
  });

  it('restores one failed question for an explicit retry without rendering the failed pair', async () => {
    const harness = createHarness();
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });

    fireEvent.change(composer, { target: { value: 'Prior complete question' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByRole('link', { name: '[S1] Grounded source' });
    const priorTranscript = [
      { role: 'user', content: 'Prior complete question' },
      { role: 'assistant', content: 'Grounded answer [S1].' },
    ];
    harness.runtime.failNextGeneration();

    fireEvent.change(composer, { target: { value: 'Retry this exact question' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    const recovery = await screen.findByRole('button', { name: 'Try another question' });
    expect(screen.queryAllByText('Retry this exact question').filter(
      (element) => element.tagName === 'P',
    )).toHaveLength(0);
    await waitFor(() => expect(composer).toHaveValue('Retry this exact question'));
    await waitFor(() => expect(recovery).toHaveFocus());

    fireEvent.click(recovery);
    await waitFor(() => expect(composer).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(harness.runtime.generationMessages).toEqual([
      'Prior complete question',
      'Retry this exact question',
      'Retry this exact question',
    ]));

    const retryAssemblies = harness.assemblePrompt.mock.calls.filter(
      ([question]) => question === 'Retry this exact question',
    );
    expect(retryAssemblies).toHaveLength(2);
    expect(retryAssemblies[0]?.[1]).toEqual(priorTranscript);
    expect(retryAssemblies[1]?.[1]).toEqual(priorTranscript);
  });

  it('keeps suggestions dismissed after a first-ever generation failure and recovery', async () => {
    const suggestion = 'What does Jet write about agentic work?';
    const harness = createHarness({ generationFailuresBeforeSuccess: 1 });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    expect(screen.getByText(suggestion)).toBeInTheDocument();

    fireEvent.change(composer, { target: { value: 'First submitted question' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    const recovery = await screen.findByRole('button', { name: 'Try another question' });

    await waitFor(() => expect(composer).toHaveValue('First submitted question'));
    await waitFor(() => expect(recovery).toHaveFocus());
    expect(screen.queryByText(suggestion)).not.toBeInTheDocument();
    expect(screen.queryByText('Egregore can make mistakes. Check cited sources.'))
      .not.toBeInTheDocument();

    fireEvent.click(recovery);
    await waitFor(() => expect(composer).toHaveFocus());
    expect(screen.queryByText(suggestion)).not.toBeInTheDocument();
  });

  it('preserves the submitted-session surface through reset failure and clears it after reset succeeds', async () => {
    const suggestion = 'What does Jet write about agentic work?';
    const harness = createHarness({
      generationFailuresBeforeSuccess: 1,
      resetFailuresBeforeSuccess: 1,
    });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.change(composer, { target: { value: 'Reset only after success' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Try another question' }));
    await waitFor(() => expect(composer).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: /New session/ }));
    const retry = await screen.findByRole('button', { name: 'Retry new session' });
    await waitFor(() => expect(retry).toHaveFocus());
    expect(screen.queryByText(suggestion)).not.toBeInTheDocument();
    expect(screen.queryByText('Egregore can make mistakes. Check cited sources.'))
      .not.toBeInTheDocument();
    expect(composer).toHaveValue('Reset only after success');

    fireEvent.click(retry);
    await screen.findByText(suggestion);
    await waitFor(() => expect(composer).toHaveFocus());
    expect(composer).toHaveValue('');
  });

  it('returns recoverable load errors to consent and focuses the load action', async () => {
    const harness = createHarness({ repositoryFailuresBeforeSuccess: 1 });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    const readyMessage = await screen.findByTestId('activation-status-message');
    expect(readyMessage).toHaveTextContent('This browser is ready for the local runtime');
    fireEvent.click(screen.getByRole('button', { name: /Load Egregore/ }));

    const returnToLoad = await screen.findByRole('button', { name: 'Return to load' });
    const errorMessage = screen.getByTestId('activation-status-message');
    expect(errorMessage).toHaveAttribute('id', readyMessage.id);
    expect(errorMessage).toHaveTextContent(
      "Egregore could not load its published knowledge base.",
    );
    expect(screen.getAllByText(
      "Egregore could not load its published knowledge base.",
    )).toHaveLength(1);
    expect(returnToLoad).toHaveAttribute('aria-describedby', errorMessage.id);
    await waitFor(() => expect(returnToLoad).toHaveFocus());
    fireEvent.click(returnToLoad);

    const load = await screen.findByRole('button', { name: /Load Egregore/ });
    await waitFor(() => expect(load).toHaveFocus());
  });

  it('offers a focused unload action when load fails during runtime cleanup', async () => {
    const harness = createHarness({ loadErrorCode: 'engine-cleanup-failed' });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));

    const unload = await screen.findByRole('button', { name: "Unload Egregore" });
    await waitFor(() => expect(unload).toHaveFocus());
    fireEvent.click(unload);

    const checkCompatibility = await screen.findByRole('button', { name: 'Check compatibility' });
    await waitFor(() => expect(checkCompatibility).toHaveFocus());
    expect(harness.order.slice(-4)).toEqual([
      'runtime.cancel',
      'runtime.reset',
      'repository.unload',
      'runtime.unload',
    ]);
  });

  it('clears the draft only after unload succeeds', async () => {
    const harness = createHarness();
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.change(composer, { target: { value: 'Clear only after cleanup' } });

    fireEvent.click(screen.getByRole('button', { name: /Unload/ }));
    const checkCompatibility = await screen.findByRole('button', { name: 'Check compatibility' });
    await waitFor(() => expect(checkCompatibility).toHaveFocus());
    fireEvent.click(checkCompatibility);
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));

    expect(await screen.findByRole('textbox', { name: "Ask Egregore" })).toHaveValue('');
  });

  it('preserves the draft when unload cleanup fails', async () => {
    const harness = createHarness({ runtimeFailures: { reset: true } });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.change(composer, { target: { value: 'Preserve after cleanup failure' } });

    fireEvent.click(screen.getByRole('button', { name: /Unload/ }));
    const retryUnload = await screen.findByRole('button', { name: 'Retry unload' });
    await waitFor(() => expect(retryUnload).toHaveFocus());

    expect(composer).toHaveValue('Preserve after cleanup failure');
  });

  it('preserves the submitted-session surface through unload failure then focuses idle after recovery', async () => {
    const suggestion = 'What does Jet write about agentic work?';
    const harness = createHarness({
      generationFailuresBeforeSuccess: 1,
      resetFailuresBeforeSuccess: 1,
    });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Egregore" });
    fireEvent.change(composer, { target: { value: 'Unload only after success' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Try another question' }));
    await waitFor(() => expect(composer).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: /Unload/ }));
    const retryUnload = await screen.findByRole('button', { name: 'Retry unload' });
    await waitFor(() => expect(retryUnload).toHaveFocus());
    expect(screen.queryByText(suggestion)).not.toBeInTheDocument();
    expect(composer).toHaveValue('Unload only after success');

    fireEvent.click(retryUnload);
    const checkCompatibility = await screen.findByRole('button', { name: 'Check compatibility' });
    await waitFor(() => expect(checkCompatibility).toHaveFocus());
  });

  it('offers an honest page reload escape while loading without entering app cleanup', async () => {
    const activation = createDeferred<LoadedKnowledgeBase>();
    const harness = createHarness({
      repositoryLoad: () => activation.promise,
    });
    const reloadPage = vi.fn();
    const view = render(
      <EgregoreExperience
        dependencies={harness.dependencies}
        reloadPage={reloadPage}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));

    expect(await screen.findByTestId('loading-stack')).toBeInTheDocument();
    expect(screen.getByTestId('loading-phase-visual')).toBeInTheDocument();
    expect(screen.getByTestId('loading-main-ghost')).toBeInTheDocument();
    expect(screen.getAllByTestId('loading-ghost-afterimage')).toHaveLength(2);
    expect(screen.getAllByTestId('loading-inward-particle')).toHaveLength(4);
    expect(screen.queryByTestId('loading-progress-track')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loading-liveness-indicator')).not.toBeInTheDocument();
    expect(screen.getByTestId('loading-reassurance-slot')).toBeInTheDocument();
    expect(screen.queryByText('First load may take a few minutes.')).not.toBeInTheDocument();
    const cancelAndReload = screen.getByRole('button', { name: 'Cancel and reload' });
    expect(screen.queryByRole('button', { name: /unload/i })).not.toBeInTheDocument();

    fireEvent.click(cancelAndReload);
    expect(reloadPage).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Releasing this device')).not.toBeInTheDocument();
    expect(harness.order).not.toContain('runtime.unload');

    view.unmount();
    activation.resolve({} as LoadedKnowledgeBase);
  });

  it('keeps elapsed loading time outside the polite live region', async () => {
    const activation = createDeferred<LoadedKnowledgeBase>();
    const harness = createHarness({ repositoryLoad: () => activation.promise });
    const view = render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));

    const loadingStatus = await screen.findByTestId('lifecycle-announcement');
    const elapsed = screen.getByText(/Elapsed \d+s/);
    expect(loadingStatus).toHaveTextContent("Egregore is loading on this device.");
    expect(within(loadingStatus).queryByText(/Elapsed/)).not.toBeInTheDocument();
    expect(elapsed).not.toHaveAttribute('aria-live');

    view.unmount();
    activation.resolve({} as LoadedKnowledgeBase);
  });

  it('keeps elapsed cleanup time moving while post-load unload is pending', async () => {
    const unloadWait = createDeferred<void>();
    const harness = createHarness({ runtimeUnloadWait: unloadWait.promise });
    render(<EgregoreExperience dependencies={harness.dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    fireEvent.click(await screen.findByRole('button', { name: /Load Egregore/ }));
    await screen.findByRole('textbox', { name: "Ask Egregore" });

    const performanceNow = vi.spyOn(performance, 'now').mockReturnValue(0);
    fireEvent.click(screen.getByRole('button', { name: /^Unload/ }));
    expect(await screen.findByText('Elapsed 0s')).toBeInTheDocument();
    performanceNow.mockReturnValue(37_000);
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1_100));
    });
    await waitFor(
      () => expect(screen.getByText('Elapsed 37s')).toBeInTheDocument(),
      { timeout: 3_000 },
    );
    expect(screen.queryByText('First load may take a few minutes.')).not.toBeInTheDocument();
    performanceNow.mockRestore();

    unloadWait.resolve();
    expect(await screen.findByRole('button', { name: 'Check compatibility' })).toBeInTheDocument();
  });
});
