import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { JETS_GHOST_CONTEXT } from '../config';
import type { LoadedKnowledgeBase } from '../corpus/repository';
import type { JetsGhostError, JetsGhostErrorCode } from '../errors';
import type { AssembledPrompt } from '../prompt/assemble';
import type { ValidCitation } from '../prompt/citations';
import {
  createInitialLifecycleState,
  reduceJetsGhostLifecycle,
  type JetsGhostLifecycleEvent,
} from '../runtime/lifecycle';
import type { LocalModelRuntime } from '../runtime/types';
import type { CapabilityReport } from '../runtime/types';
import type {
  ContextBudget,
  ConversationHistoryTurn,
  SelectionInput,
  SelectionResult,
  SelectedSource,
} from '../selection/types';
import type { JetsGhostLoadingState, JetsGhostState } from './types';

export interface JetsGhostKnowledgeRepository {
  load(signal?: AbortSignal): Promise<LoadedKnowledgeBase>;
  unload(): void | Promise<void>;
}

export interface JetsGhostDependencies {
  createRepository: () => JetsGhostKnowledgeRepository;
  createRuntime: () => LocalModelRuntime;
  rankAndPackContext: (input: SelectionInput) => SelectionResult;
  assemblePrompt: (
    query: string,
    history: ConversationHistoryTurn[],
    selection: SelectionResult,
    budget: ContextBudget,
  ) => AssembledPrompt;
  extractValidCitations: (
    response: string,
    sources: SelectedSource[],
  ) => ValidCitation[];
  contextBudget?: ContextBudget;
  createTurnId: () => string;
  now: () => number;
}

export interface UseJetsGhostResult {
  state: JetsGhostState;
  loading: JetsGhostLoadingState | null;
  checkCompatibility: () => Promise<void>;
  load: () => Promise<void>;
  sendMessage: (question: string) => Promise<void>;
  stop: () => void;
  startNewSession: () => Promise<void>;
  recoverFromError: () => void;
  unload: () => Promise<void>;
}

const ERROR_MESSAGES: Record<JetsGhostErrorCode, string> = {
  'insecure-context': "Jet's Ghost needs a secure browser context.",
  'webgpu-unavailable': "Jet's Ghost needs WebGPU in this browser.",
  'adapter-unavailable': "Jet's Ghost could not access a compatible GPU adapter.",
  'storage-warning': 'This browser may not have enough available storage for the local model.',
  'corpus-load-failed': "Jet's Ghost could not load its published knowledge base.",
  'corpus-version-mismatch': "Jet's Ghost found an incompatible knowledge-base version.",
  'corpus-index-mismatch': "Jet's Ghost found an incompatible search index.",
  'model-load-failed': "Jet's Ghost could not load the local model.",
  'generation-failed': "Jet's Ghost could not complete the local response.",
  'generation-cancelled': 'The local response was stopped.',
  'question-too-long': 'That question is too long for the local context.',
  'conversation-limit-reached': 'The current session is full. Start a new session to continue.',
  'context-budget-exceeded': "Jet's Ghost could not fit that question into the local context.",
  'engine-cleanup-failed': "Jet's Ghost could not fully release the local model runtime.",
};

const ERROR_CODES = new Set<JetsGhostErrorCode>(
  Object.keys(ERROR_MESSAGES) as JetsGhostErrorCode[],
);

function safeError(
  cause: unknown,
  code: JetsGhostErrorCode,
): JetsGhostError {
  const candidateCode = cause instanceof Error
    && 'code' in cause
    && typeof cause.code === 'string'
    && ERROR_CODES.has(cause.code as JetsGhostErrorCode)
    ? cause.code as JetsGhostErrorCode
    : code;

  if (
    candidateCode !== code
    || (
      cause instanceof Error
      && 'code' in cause
      && cause.code === code
    )
  ) {
    return {
      code: candidateCode,
      message: ERROR_MESSAGES[candidateCode],
      recoverable: ![
        'insecure-context',
        'webgpu-unavailable',
        'adapter-unavailable',
      ].includes(candidateCode),
      diagnosticCause: candidateCode,
    };
  }

  return {
    code,
    message: ERROR_MESSAGES[code],
    recoverable: true,
    diagnosticCause: cause instanceof DOMException
      ? 'DOMException'
      : cause instanceof Error
        ? 'Error'
        : `type:${typeof cause}`,
  };
}

function classifyCorpusError(cause: unknown): JetsGhostErrorCode {
  if (cause instanceof Error && /search index|\bindex\b/i.test(cause.message)) {
    return 'corpus-index-mismatch';
  }
  if (
    cause instanceof Error
    && /corpus version|artifact version|provenance mismatch/i.test(cause.message)
  ) {
    return 'corpus-version-mismatch';
  }
  return 'corpus-load-failed';
}

function sanitizeReportedError(
  error: JetsGhostError,
  fallback: JetsGhostErrorCode,
): JetsGhostError {
  const code = ERROR_CODES.has(error.code) ? error.code : fallback;
  return {
    code,
    message: ERROR_MESSAGES[code],
    recoverable: ![
      'insecure-context',
      'webgpu-unavailable',
      'adapter-unavailable',
    ].includes(code),
    diagnosticCause: code,
  };
}

function sanitizeCapabilityReport(report: CapabilityReport): CapabilityReport {
  return {
    ...report,
    warnings: report.warnings.map((warning) => (
      sanitizeReportedError(warning, 'storage-warning')
    )),
    failures: report.failures.map((failure) => (
      sanitizeReportedError(failure, 'adapter-unavailable')
    )),
  };
}

function initialState(): JetsGhostState {
  return {
    lifecycle: createInitialLifecycleState(),
    capability: null,
    turns: [],
    error: null,
  };
}

function cleanupError(failures: readonly string[]): JetsGhostError {
  return {
    code: 'engine-cleanup-failed',
    message: "Jet's Ghost could not fully release the local model runtime.",
    recoverable: true,
    diagnosticCause: failures.join(','),
  };
}

export function useJetsGhost(
  dependencies: JetsGhostDependencies,
): UseJetsGhostResult {
  const dependenciesRef = useRef(dependencies);
  const repositoryRef = useRef<JetsGhostKnowledgeRepository | null>(null);
  const runtimeRef = useRef<LocalModelRuntime | null>(null);
  if (repositoryRef.current === null) {
    repositoryRef.current = dependenciesRef.current.createRepository();
  }
  if (runtimeRef.current === null) {
    runtimeRef.current = dependenciesRef.current.createRuntime();
  }

  const [state, setState] = useState<JetsGhostState>(initialState);
  const stateRef = useRef(state);
  const [loading, setLoading] = useState<JetsGhostLoadingState | null>(null);
  const mountedRef = useRef(true);
  const operationRef = useRef(0);
  const knowledgeBaseRef = useRef<LoadedKnowledgeBase | null>(null);
  const activationStartedRef = useRef(false);
  const activationAbortRef = useRef<AbortController | null>(null);
  const corpusActivationRef = useRef<Promise<LoadedKnowledgeBase> | null>(null);
  const cleanupRef = useRef<Promise<void> | null>(null);

  const commit = useCallback((next: JetsGhostState) => {
    stateRef.current = next;
    if (mountedRef.current) setState(next);
  }, []);

  const emit = useCallback((event: JetsGhostLifecycleEvent) => {
    commit({
      ...stateRef.current,
      lifecycle: reduceJetsGhostLifecycle(stateRef.current.lifecycle, event),
    });
  }, [commit]);

  const isCurrent = useCallback((operationId: number) => (
    mountedRef.current && operationRef.current === operationId
  ), []);

  const checkCompatibility = useCallback(async () => {
    const status = stateRef.current.lifecycle.status;
    if (status !== 'idle' && status !== 'unsupported') return;

    const operationId = ++operationRef.current;
    emit({ type: 'check-requested' });
    try {
      const report = sanitizeCapabilityReport(
        await runtimeRef.current!.checkCapabilities(),
      );
      if (!isCurrent(operationId)) return;
      const error = report.supported ? null : report.failures[0] ?? null;
      commit({
        ...stateRef.current,
        capability: report,
        error,
        lifecycle: reduceJetsGhostLifecycle(stateRef.current.lifecycle, {
          type: 'capabilities-resolved',
          report,
        }),
      });
    } catch (cause) {
      if (!isCurrent(operationId)) return;
      const error = safeError(
        cause,
        'webgpu-unavailable',
      );
      commit({
        ...stateRef.current,
        error,
        lifecycle: reduceJetsGhostLifecycle(stateRef.current.lifecycle, {
          type: 'capabilities-failed',
          error,
        }),
      });
    }
  }, [commit, emit, isCurrent]);

  const load = useCallback(async () => {
    if (stateRef.current.lifecycle.status !== 'awaiting-consent') return;

    const operationId = ++operationRef.current;
    activationStartedRef.current = true;
    emit({ type: 'load-requested' });
    setLoading({ phase: 'corpus', startedAt: dependenciesRef.current.now() });
    const abortController = new AbortController();
    activationAbortRef.current = abortController;
    const corpusActivation = repositoryRef.current!.load(abortController.signal);
    corpusActivationRef.current = corpusActivation;
    try {
      const knowledgeBase = await corpusActivation;
      if (!isCurrent(operationId)) return;
      knowledgeBaseRef.current = knowledgeBase;
      await runtimeRef.current!.load({
        onPhase: (phase) => {
          if (!isCurrent(operationId)) return;
          setLoading((current) => ({
            phase,
            startedAt: current?.startedAt ?? dependenciesRef.current.now(),
          }));
        },
      });
      if (!isCurrent(operationId)) return;
      setLoading(null);
      emit({ type: 'load-succeeded' });
    } catch (cause) {
      if (!isCurrent(operationId)) return;
      setLoading(null);
      const error = safeError(
        cause,
        knowledgeBaseRef.current === null
          ? classifyCorpusError(cause)
          : 'model-load-failed',
      );
      commit({
        ...stateRef.current,
        error,
        lifecycle: reduceJetsGhostLifecycle(stateRef.current.lifecycle, {
          type: 'load-failed',
          error,
        }),
      });
    } finally {
      if (activationAbortRef.current === abortController) {
        activationAbortRef.current = null;
      }
      if (corpusActivationRef.current === corpusActivation) {
        corpusActivationRef.current = null;
      }
    }
  }, [commit, emit, isCurrent]);

  const sendMessage = useCallback(async (question: string) => {
    const cleanQuestion = question.trim();
    const knowledgeBase = knowledgeBaseRef.current;
    if (
      cleanQuestion === ''
      || stateRef.current.lifecycle.status !== 'ready'
      || knowledgeBase === null
    ) return;

    const operationId = ++operationRef.current;
    const completeTurns = stateRef.current.turns;
    const history = completeTurns.map(({ role, content }) => ({
      role,
      content,
    }));
    let assembled: AssembledPrompt;
    try {
      const selection = dependenciesRef.current.rankAndPackContext({
        query: cleanQuestion,
        knowledgeBase,
        budget: dependenciesRef.current.contextBudget ?? JETS_GHOST_CONTEXT,
      });
      assembled = dependenciesRef.current.assemblePrompt(
        cleanQuestion,
        history,
        selection,
        dependenciesRef.current.contextBudget ?? JETS_GHOST_CONTEXT,
      );
    } catch (cause) {
      if (!isCurrent(operationId)) return;
      const error = safeError(
        cause,
        'context-budget-exceeded',
      );
      const generating = reduceJetsGhostLifecycle(stateRef.current.lifecycle, {
        type: 'generation-requested',
      });
      commit({
        ...stateRef.current,
        error,
        lifecycle: reduceJetsGhostLifecycle(generating, {
          type: 'generation-failed',
          error,
        }),
      });
      return;
    }

    const userTurnId = dependenciesRef.current.createTurnId();
    const assistantTurnId = dependenciesRef.current.createTurnId();
    commit({
      ...stateRef.current,
      error: null,
      lifecycle: reduceJetsGhostLifecycle(stateRef.current.lifecycle, {
        type: 'generation-requested',
      }),
      turns: [
        ...stateRef.current.turns,
        {
          id: userTurnId,
          role: 'user',
          content: cleanQuestion,
          citations: [],
        },
        {
          id: assistantTurnId,
          role: 'assistant',
          content: '',
          citations: [],
        },
      ],
    });

    let response = '';
    try {
      await runtimeRef.current!.createSession(assembled.preface);
      if (!isCurrent(operationId)) return;
      const result = await runtimeRef.current!.generate(assembled.userMessage, {
        onText: (chunk) => {
          if (!isCurrent(operationId)) return;
          response += chunk;
          commit({
            ...stateRef.current,
            turns: stateRef.current.turns.map((turn) => (
              turn.id === assistantTurnId
                ? { ...turn, content: response }
                : turn
            )),
          });
        },
      });
      if (!isCurrent(operationId)) return;

      const stopped = result.finishReason === 'cancelled';
      const citations = dependenciesRef.current.extractValidCitations(
        response,
        assembled.selectedSources,
      );
      commit({
        ...stateRef.current,
        error: null,
        lifecycle: reduceJetsGhostLifecycle(stateRef.current.lifecycle, stopped
          ? { type: 'generation-cancelled' }
          : { type: 'generation-succeeded' }),
        turns: stateRef.current.turns.map((turn) => (
          turn.id === assistantTurnId
            ? {
                ...turn,
                content: response,
                citations,
                ...(stopped ? { stopped: true } : {}),
              }
            : turn
        )),
      });
    } catch (cause) {
      if (!isCurrent(operationId)) return;
      const error = safeError(
        cause,
        'generation-failed',
      );
      commit({
        ...stateRef.current,
        error,
        turns: completeTurns,
        lifecycle: reduceJetsGhostLifecycle(stateRef.current.lifecycle, {
          type: 'generation-failed',
          error,
        }),
      });
    }
  }, [commit, isCurrent]);

  const stop = useCallback(() => {
    if (stateRef.current.lifecycle.status !== 'generating') return;
    emit({ type: 'stop-requested' });
    runtimeRef.current!.cancel();
  }, [emit]);

  const startNewSession = useCallback(async () => {
    let lifecycle = stateRef.current.lifecycle;
    if (
      lifecycle.status === 'generation-error'
      && stateRef.current.error?.code === 'conversation-limit-reached'
    ) {
      lifecycle = reduceJetsGhostLifecycle(lifecycle, {
        type: 'error-acknowledged',
      });
    }
    if (lifecycle.status !== 'ready' && lifecycle.status !== 'reset-error') return;

    const operationId = ++operationRef.current;
    commit({
      ...stateRef.current,
      error: null,
      lifecycle: reduceJetsGhostLifecycle(lifecycle, {
        type: 'reset-requested',
      }),
    });
    try {
      await runtimeRef.current!.reset();
      if (!isCurrent(operationId)) return;
      commit({
        ...stateRef.current,
        turns: [],
        error: null,
        lifecycle: reduceJetsGhostLifecycle(stateRef.current.lifecycle, {
          type: 'reset-succeeded',
        }),
      });
    } catch (cause) {
      if (!isCurrent(operationId)) return;
      const error = safeError(cause, 'engine-cleanup-failed');
      commit({
        ...stateRef.current,
        error,
        lifecycle: reduceJetsGhostLifecycle(stateRef.current.lifecycle, {
          type: 'reset-failed',
          error,
        }),
      });
    }
  }, [commit, isCurrent]);

  const recoverFromError = useCallback(() => {
    const status = stateRef.current.lifecycle.status;
    if (status !== 'load-error' && status !== 'generation-error') return;
    commit({
      ...stateRef.current,
      error: null,
      lifecycle: reduceJetsGhostLifecycle(stateRef.current.lifecycle, {
        type: 'error-acknowledged',
      }),
    });
  }, [commit]);

  const cleanupResources = useCallback(async (unmounted = false) => {
    if (!activationStartedRef.current) return;
    if (cleanupRef.current !== null) return cleanupRef.current;

    operationRef.current += 1;
    if (!unmounted) emit({ type: 'unload-requested' });
    const corpusActivation = corpusActivationRef.current;
    activationAbortRef.current?.abort();
    const cleanup = (async () => {
      const failures: string[] = [];
      try {
        runtimeRef.current!.cancel();
      } catch {
        failures.push('cancel');
      }
      try {
        await runtimeRef.current!.reset();
      } catch {
        failures.push('reset');
      }
      if (corpusActivation !== null) {
        try {
          await corpusActivation;
        } catch {
          // Activation errors are handled by load(); cleanup only joins the work.
        }
      }
      try {
        await repositoryRef.current!.unload();
      } catch {
        failures.push('repository');
      } finally {
        try {
          await runtimeRef.current!.unload();
        } catch {
          failures.push('runtime');
        }
      }

      knowledgeBaseRef.current = null;
      if (mountedRef.current) setLoading(null);
      if (failures.length === 0) {
        activationStartedRef.current = false;
        if (!unmounted) commit(initialState());
        return;
      }

      if (!unmounted) {
        const error = cleanupError(failures);
        commit({
          ...stateRef.current,
          error,
          lifecycle: reduceJetsGhostLifecycle(stateRef.current.lifecycle, {
            type: 'unload-failed',
            error,
          }),
        });
      }
    })();
    cleanupRef.current = cleanup;
    try {
      await cleanup;
    } finally {
      if (cleanupRef.current === cleanup) cleanupRef.current = null;
    }
  }, [commit, emit]);

  const unload = useCallback(() => cleanupResources(false), [cleanupResources]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationRef.current += 1;
      void cleanupResources(true);
    };
  }, [cleanupResources]);

  return {
    state,
    loading,
    checkCompatibility,
    load,
    sendMessage,
    stop,
    startNewSession,
    recoverFromError,
    unload,
  };
}
