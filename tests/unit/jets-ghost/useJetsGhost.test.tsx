import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { JETS_GHOST_CONTEXT } from '../../../src/features/jets-ghost/config';
import JetsGhostExperience from '../../../src/features/jets-ghost/JetsGhostExperience';
import type { LoadedKnowledgeBase } from '../../../src/features/jets-ghost/corpus/repository';
import type { AssembledPrompt } from '../../../src/features/jets-ghost/prompt/assemble';
import type { ValidCitation } from '../../../src/features/jets-ghost/prompt/citations';
import {
  FakeRuntime,
  type FakeRuntimeOptions,
} from '../../../src/features/jets-ghost/runtime/fakeRuntime';
import type {
  GenerationHandlers,
  GenerationResult,
  LoadOptions,
  LocalModelRuntime,
  ModelMessage,
  CapabilityReport,
} from '../../../src/features/jets-ghost/runtime/types';
import { createRuntimeError } from '../../../src/features/jets-ghost/runtime/types';
import type {
  ChunkId,
  DocumentId,
  SectionId,
} from '../../../src/features/jets-ghost/corpus/types';
import type {
  ContextBudget,
  SelectionInput,
  SelectionResult,
  SelectedSource,
} from '../../../src/features/jets-ghost/selection/types';

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
      sources: SelectedSource[];
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

type UseJetsGhost = (dependencies: WishedDependencies) => WishedHookResult;

const hookModulePath = '../../../src/features/jets-ghost/state/useJetsGhost';

afterEach(() => cleanup());

async function loadSubject(): Promise<UseJetsGhost> {
  const module = await import(hookModulePath) as {
    useJetsGhost: UseJetsGhost;
  };
  return module.useJetsGhost;
}

class OrderedFakeRuntime extends FakeRuntime {
  private remainingGenerationFailures: number;
  private remainingResetFailures: number;

  constructor(
    private readonly order: string[],
    responseChunks: readonly string[] = ['Grounded answer [S1].'],
    scheduler?: { waitForChunk(operationId: number, chunkIndex: number): Promise<void> },
    failures?: FakeRuntimeOptions['failures'],
    generationFailuresBeforeSuccess = 0,
    resetFailuresBeforeSuccess = 0,
    capabilityReport?: CapabilityReport,
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
  }

  override async load(options: LoadOptions): Promise<void> {
    this.order.push('runtime.load');
    await super.load(options);
  }

  override async createSession(preface: ModelMessage[]): Promise<void> {
    this.order.push('runtime.createSession');
    await super.createSession(preface);
  }

  override async generate(
    message: string,
    handlers: GenerationHandlers,
  ): Promise<GenerationResult> {
    this.order.push('runtime.generate');
    if (this.remainingGenerationFailures > 0) {
      this.remainingGenerationFailures -= 1;
      throw createRuntimeError(
        'generation-failed',
        'The first test generation failed.',
        true,
      );
    }
    return super.generate(message, handlers);
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
    indexConfigVersion: '1.0.0',
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
  );
  const knowledgeBase = {} as LoadedKnowledgeBase;
  let repositoryFailuresRemaining = options.repositoryFailuresBeforeSuccess ?? 0;
  const repository: WishedKnowledgeRepository = {
    load: vi.fn(async () => {
      order.push('repository.load');
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
        responseReserve: JETS_GHOST_CONTEXT.responseReserve,
        estimatorHeadroom: JETS_GHOST_CONTEXT.estimatorHeadroom,
        totalContextTokens: JETS_GHOST_CONTEXT.maxContextTokens,
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
    ): ValidCitation[] => (
      response.includes('[S1]') && sources[0] !== undefined
        ? [{ id: 'S1' as const, source: sources[0] }]
        : []
    )),
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

describe('useJetsGhost activation boundary', () => {
  it('constructs without probing, loading, selecting, prompting, or generating', async () => {
    const useJetsGhost = await loadSubject();
    const harness = createHarness();

    const { result } = renderHook(() => useJetsGhost(harness.dependencies));

    expect(result.current.state.lifecycle.status).toBe('idle');
    expect(harness.runtime.calls).toEqual([]);
    expect(harness.repository.load).not.toHaveBeenCalled();
    expect(harness.rankAndPack).not.toHaveBeenCalled();
  });

  it('checks compatibility without crossing any heavy-work boundary', async () => {
    const useJetsGhost = await loadSubject();
    const harness = createHarness();
    const { result } = renderHook(() => useJetsGhost(harness.dependencies));

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
    const useJetsGhost = await loadSubject();
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
    const { result } = renderHook(() => useJetsGhost(harness.dependencies));

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
    const useJetsGhost = await loadSubject();
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
    const { result } = renderHook(() => useJetsGhost(harness.dependencies));

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
    const useJetsGhost = await loadSubject();
    const harness = createHarness();
    const { result } = renderHook(() => useJetsGhost(harness.dependencies));

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
    const useJetsGhost = await loadSubject();
    const harness = createHarness({ responseChunks: ['Grounded ', 'answer [S1].'] });
    const { result } = renderHook(() => useJetsGhost(harness.dependencies));
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
        sources: [harness.source],
      }),
    ]);
    expect(result.current.state.lifecycle.status).toBe('ready');
  });

  it('unloads in safe order and suppresses chunks released after cleanup starts', async () => {
    const useJetsGhost = await loadSubject();
    const scheduler = new ManualScheduler();
    const harness = createHarness({
      responseChunks: ['Keep this. ', 'DROP THIS [S1].'],
      scheduler,
    });
    const { result } = renderHook(() => useJetsGhost(harness.dependencies));
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

  it('performs the same ordered cleanup when the route unmounts', async () => {
    const useJetsGhost = await loadSubject();
    const harness = createHarness();
    const { result, unmount } = renderHook(() => useJetsGhost(harness.dependencies));
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

  it('classifies search-index validation failures without attempting model load', async () => {
    const useJetsGhost = await loadSubject();
    const harness = createHarness({
      repositoryError: new Error('Search index manifest contract mismatch.'),
    });
    const { result } = renderHook(() => useJetsGhost(harness.dependencies));

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
    const useJetsGhost = await loadSubject();
    const hostileError = Object.assign(new Error('PRIVATE_PROMPT_OR_SOURCE_TEXT'), {
      code: 'attacker-controlled-code',
      recoverable: false,
      diagnosticCause: 'PRIVATE_DIAGNOSTIC',
    });
    const harness = createHarness({ repositoryError: hostileError });
    const { result } = renderHook(() => useJetsGhost(harness.dependencies));

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
    const useJetsGhost = await loadSubject();
    const harness = createHarness({ repositoryFailuresBeforeSuccess: 1 });
    const { result } = renderHook(() => useJetsGhost(harness.dependencies));

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
      const useJetsGhost = await loadSubject();
      const source = selectedSource();
      const selected = selection(hasSource ? [source] : [], completeCorpusIncluded);
      const harness = createHarness({
        selection: selected,
        responseChunks: [hasSource ? 'Answer [S1].' : 'I do not have a grounded source.'],
      });
      const { result } = renderHook(() => useJetsGhost(harness.dependencies));
      await makeReady(result);

      await act(async () => {
        await result.current.sendMessage('Question');
      });

      expect(harness.assemblePrompt).toHaveBeenCalledWith(
        'Question',
        [],
        selected,
        JETS_GHOST_CONTEXT,
      );
      expect(result.current.state.turns.at(-1)?.sources).toEqual(selected.sources);
      expect(result.current.state.turns.at(-1)?.citations).toHaveLength(hasSource ? 1 : 0);
    },
  );

  it('retains a deterministic partial response marked Stopped', async () => {
    const useJetsGhost = await loadSubject();
    const scheduler = new ManualScheduler();
    const harness = createHarness({
      responseChunks: ['Partial response. ', 'Never emitted.'],
      scheduler,
    });
    const { result } = renderHook(() => useJetsGhost(harness.dependencies));
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

  it('starts a new session by resetting first and clearing only after success', async () => {
    const useJetsGhost = await loadSubject();
    const harness = createHarness();
    const { result } = renderHook(() => useJetsGhost(harness.dependencies));
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
    const useJetsGhost = await loadSubject();
    const harness = createHarness({ runtimeFailures: { reset: true } });
    const { result } = renderHook(() => useJetsGhost(harness.dependencies));
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
    const useJetsGhost = await loadSubject();
    const harness = createHarness({ resetFailuresBeforeSuccess: 1 });
    const { result } = renderHook(() => useJetsGhost(harness.dependencies));
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

  it('recovers from a generation failure and allows another complete turn', async () => {
    const useJetsGhost = await loadSubject();
    const harness = createHarness({ generationFailuresBeforeSuccess: 1 });
    const { result } = renderHook(() => useJetsGhost(harness.dependencies));
    await makeReady(result);

    await act(async () => {
      await result.current.sendMessage('First attempt');
    });
    expect(result.current.state.lifecycle.status).toBe('generation-error');
    expect(result.current.state.error?.code).toBe('generation-failed');

    act(() => result.current.recoverFromError());
    expect(result.current.state.lifecycle.status).toBe('ready');
    expect(result.current.state.error).toBeNull();

    await act(async () => {
      await result.current.sendMessage('Second attempt');
    });
    expect(result.current.state.lifecycle.status).toBe('ready');
    expect(result.current.state.turns.at(-1)?.content).toBe('Grounded answer [S1].');
  });

  it('preserves the exact transcript and avoids runtime calls at conversation exhaustion', async () => {
    const useJetsGhost = await loadSubject();
    const harness = createHarness();
    const { result } = renderHook(() => useJetsGhost(harness.dependencies));
    await makeReady(result);
    await act(async () => {
      await result.current.sendMessage('A complete prior question.');
    });
    const transcript = JSON.stringify(result.current.state.turns);
    const runtimeCallCount = harness.runtime.calls.length;
    const exhausted = Object.assign(
      new Error('The current session is full. Start a new session to continue.'),
      {
        name: 'JetsGhostPromptError',
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
    const useJetsGhost = await loadSubject();
    const harness = createHarness({
      runtimeFailures: { reset: true, unload: true },
      repositoryUnloadError: new Error('PRIVATE_REPOSITORY_FAILURE'),
    });
    const { result } = renderHook(() => useJetsGhost(harness.dependencies));
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

describe('JetsGhostExperience production composition', () => {
  it('keeps activation explicit, focuses the composer, and renders cited sources locally', async () => {
    const harness = createHarness({ responseChunks: ['Grounded answer [S1].'] });
    render(<JetsGhostExperience dependencies={harness.dependencies} />);

    expect(screen.getByText(/Gemma 4 E2B/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check compatibility' }));
    await screen.findByRole('button', { name: /Load Jet's Ghost/ });
    expect(harness.runtime.calls.map(({ method }) => method)).toEqual([
      'checkCapabilities',
    ]);

    fireEvent.click(screen.getByRole('button', { name: /Load Jet's Ghost/ }));
    const composer = await screen.findByRole('textbox', { name: "Ask Jet's Ghost" });
    await waitFor(() => expect(composer).toHaveFocus());
    expect(harness.runtime.calls.map(({ method }) => method)).toEqual([
      'checkCapabilities',
      'load',
    ]);

    fireEvent.change(composer, { target: { value: 'What did Jet publish?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByRole('link', { name: '[S1] Grounded source' });

    expect(screen.queryByText('What does Jet write about agentic work?')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Grounded source/ })).toHaveLength(2);
  });
});
