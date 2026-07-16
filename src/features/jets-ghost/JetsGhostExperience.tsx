import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  CircleStop,
  CloudOff,
  Ghost,
  LockKeyhole,
  MonitorCheck,
  RotateCcw,
  Unplug,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type UIEvent,
} from 'react';

import { JETS_GHOST_CONTEXT } from './config';
import { StaticKnowledgeRepository } from './corpus/repository';
import type { JetsGhostErrorCode } from './errors';
import {
  getComposerActionTone,
  getGhostAnimationMode,
  getLifecycleAnnouncement,
  getLifecycleLabel,
  getLoadingHeadline,
  getLoadingReassurance,
  shouldFocusComposer,
  type GhostAnimationMode,
} from './experience';
import { assemblePrompt } from './prompt/assemble';
import {
  extractValidCitations,
  getCitedDocumentSources,
} from './prompt/citations';
import {
  createAuditedRuntime,
  FakeRuntime,
  FakeRuntimeRecorder,
  type FakeRuntimeCall,
} from './runtime/fakeRuntime';
import {
  configureFakeCitationSelection,
  configureFakeSourceSentinel,
  getFakeScenarioConfiguration,
  resolveFakeScenario,
} from './runtime/fakeScenario';
import { LiteRtGemmaRuntime } from './runtime/liteRtGemma';
import type { JetsGhostLifecycleStatus } from './runtime/lifecycle';
import {
  createRuntimeError,
} from './runtime/types';
import { rankAndPackContext } from './selection/rankAndPack';
import type { ConversationTurn } from './state/types';
import {
  useJetsGhost,
  type JetsGhostDependencies,
} from './state/useJetsGhost';

const suggestedQuestions = [
  'What does Jet write about agentic work?',
  'Summarize the recursive convergence hypothesis.',
  'Which projects connect AI and systems thinking?',
];

type JetsGhostE2EWindow = Window & {
  __JETS_GHOST_E2E__?: {
    readonly runtimeId: number;
    readonly calls: readonly FakeRuntimeCall[];
  };
};

type InteractionModality = 'keyboard' | 'mouse' | 'touch' | 'pen';

const STICKY_FOLLOW_THRESHOLD_PX = 48;

function isNearConversationBottom(scroller: HTMLElement): boolean {
  return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
    <= STICKY_FOLLOW_THRESHOLD_PX;
}

function scrollConversationToLatest(
  scroller: HTMLElement,
  behavior: ScrollBehavior,
): void {
  if (behavior === 'smooth' && typeof scroller.scrollTo === 'function') {
    scroller.scrollTo({ top: scroller.scrollHeight, behavior });
    return;
  }
  scroller.scrollTop = scroller.scrollHeight;
}

function useLiveReducedMotion(): boolean {
  const initialPreference = Boolean(useReducedMotion());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(initialPreference);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  return prefersReducedMotion;
}

function waitForFakeDelay(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

function allocateE2ERuntimeId(): number {
  const storageKey = 'jets-ghost-e2e-runtime-id';
  const previous = Number.parseInt(window.sessionStorage.getItem(storageKey) ?? '0', 10);
  const runtimeId = Number.isSafeInteger(previous) && previous >= 0
    ? previous + 1
    : 1;
  window.sessionStorage.setItem(storageKey, String(runtimeId));
  return runtimeId;
}

function exposeE2EAudit(recorder: FakeRuntimeRecorder): void {
  Object.defineProperty(window as JetsGhostE2EWindow, '__JETS_GHOST_E2E__', {
    configurable: true,
    value: Object.freeze({
      runtimeId: recorder.runtimeId,
      get calls() {
        return recorder.calls;
      },
    }),
  });
}

function createTestBuildDependencies(): JetsGhostDependencies {
  let nextTurnId = 0;
  const searchParams = new URL(window.location.href).searchParams;
  const explicitFakeRuntime = searchParams.get('runtime') === 'fake';
  const slowFakeStream = searchParams.get('stream') === 'slow';
  const fakeSessionKey = 'jets-ghost-e2e-fake-authorized';
  const resolvedFakeScenario = resolveFakeScenario({
    testBuild: true,
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    search: window.location.search,
    sessionAuthorized: window.sessionStorage.getItem(fakeSessionKey) === '1',
  });

  if (resolvedFakeScenario !== null) {
    if (explicitFakeRuntime) window.sessionStorage.setItem(fakeSessionKey, '1');
    const { scenario } = resolvedFakeScenario;
    const configuration = getFakeScenarioConfiguration(scenario);
    const runtimeId = allocateE2ERuntimeId();
    const recorder = new FakeRuntimeRecorder(runtimeId);
    const chunkDelayMs = configuration.chunkDelayMs
      ?? (slowFakeStream || resolvedFakeScenario.slowStream ? 120 : 0);
    const scheduler = {
      waitForChunk: async () => {
        if (chunkDelayMs > 0) await waitForFakeDelay(chunkDelayMs);
      },
      ...(configuration.capabilityDelayMs === undefined ? {} : {
        waitForCapability: async () => waitForFakeDelay(configuration.capabilityDelayMs!),
      }),
      ...(configuration.loadDelayMs === undefined ? {} : {
        waitForLoad: async () => waitForFakeDelay(configuration.loadDelayMs!),
      }),
      ...(configuration.unloadDelayMs === undefined ? {} : {
        waitForUnload: async () => waitForFakeDelay(configuration.unloadDelayMs!),
      }),
    };
    const runtime = new FakeRuntime({
      testOnly: true,
      recorder,
      recordResourceLifecycle: true,
      responseChunks: configuration.responseChunks,
      failures: configuration.failures,
      scheduler: scheduler,
      emitLateChunkAfterCancellation: configuration.emitLateChunkAfterCancellation,
    });
    const repository = new StaticKnowledgeRepository();
    let completedAssemblies = 0;

    exposeE2EAudit(recorder);

    return {
      createRepository: () => ({
        load: (signal) => {
          recorder.record('repository.load');
          return repository.load(signal);
        },
        unload: () => {
          recorder.record('repository.unload');
          return repository.unload();
        },
      }),
      createRuntime: () => runtime,
      rankAndPackContext: (input) => {
        const selection = rankAndPackContext(input);
        const scenarioSelection = scenario === 'citations'
          ? configureFakeCitationSelection(selection)
          : selection;
        return configureFakeSourceSentinel(scenarioSelection);
      },
      assemblePrompt: (...args) => {
        if (
          configuration.exhaustAfterCompletedGenerations !== undefined
          && completedAssemblies >= configuration.exhaustAfterCompletedGenerations
        ) {
          throw createRuntimeError(
            'conversation-limit-reached',
            'The deterministic fake conversation is full.',
            true,
          );
        }
        const assembled = assemblePrompt(...args);
        completedAssemblies += 1;
        return assembled;
      },
      extractValidCitations,
      contextBudget: JETS_GHOST_CONTEXT,
      createTurnId: () => `turn-${++nextTurnId}`,
      now: () => performance.now(),
    };
  }

  const productionRuntime = new LiteRtGemmaRuntime();
  const recorder = new FakeRuntimeRecorder(allocateE2ERuntimeId());
  exposeE2EAudit(recorder);
  const runtime = createAuditedRuntime(productionRuntime, recorder);

  return {
    createRepository: () => new StaticKnowledgeRepository(),
    createRuntime: () => runtime,
    rankAndPackContext,
    assemblePrompt,
    extractValidCitations,
    contextBudget: JETS_GHOST_CONTEXT,
    createTurnId: () => `turn-${++nextTurnId}`,
    now: () => performance.now(),
  };
}

function createProductionDependencies(): JetsGhostDependencies {
  let nextTurnId = 0;
  const runtime = new LiteRtGemmaRuntime();
  return {
    createRepository: () => new StaticKnowledgeRepository(),
    createRuntime: () => runtime,
    rankAndPackContext,
    assemblePrompt,
    extractValidCitations,
    contextBudget: JETS_GHOST_CONTEXT,
    createTurnId: () => `turn-${++nextTurnId}`,
    now: () => performance.now(),
  };
}

function createDependencies(): JetsGhostDependencies {
  const localHost = typeof window !== 'undefined'
    && (
      window.location.hostname === '127.0.0.1'
      || window.location.hostname === 'localhost'
    );
  if (
    import.meta.env.PUBLIC_JETS_GHOST_E2E === '1'
    && localHost
  ) return createTestBuildDependencies();
  return createProductionDependencies();
}

interface JetsGhostExperienceProps {
  dependencies?: JetsGhostDependencies;
  reloadPage?: () => void;
}

function reloadCurrentDocument(): void {
  window.location.reload();
}

export default function JetsGhostExperience({
  dependencies: injectedDependencies,
  reloadPage = reloadCurrentDocument,
}: JetsGhostExperienceProps = {}) {
  const dependencies = useMemo(
    () => injectedDependencies ?? createDependencies(),
    [injectedDependencies],
  );
  const ghost = useJetsGhost(dependencies);
  const [draft, setDraft] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasSubmittedInSession, setHasSubmittedInSession] = useState(false);
  const [hasUnseenContent, setHasUnseenContent] = useState(false);
  const prefersReducedMotion = useLiveReducedMotion();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationScrollerRef = useRef<HTMLDivElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const errorActionRef = useRef<HTMLButtonElement>(null);
  const loadActionRef = useRef<HTMLButtonElement>(null);
  const checkCompatibilityActionRef = useRef<HTMLButtonElement>(null);
  const lastSubmittedRef = useRef<string | null>(null);
  const unloadRequestedRef = useRef(false);
  const previousStatusRef = useRef(ghost.state.lifecycle.status);
  const lastInteractionModalityRef = useRef<InteractionModality>('keyboard');
  const composerFocusModalityRef = useRef<InteractionModality>('keyboard');
  const readyFocusModalityRef = useRef<InteractionModality>('keyboard');
  const messageSubmissionModalityRef = useRef<InteractionModality>('keyboard');
  const suppressComposerRestoreRef = useRef(false);
  const stickyFollowRef = useRef(true);
  const pendingSubmissionFollowRef = useRef(false);
  const submissionFollowCleanupRef = useRef<(() => void) | null>(null);

  const status = ghost.state.lifecycle.status;
  const hasConversation = ghost.state.turns.length > 0;
  const showPreConversation = !hasSubmittedInSession && !hasConversation;
  const isGenerating = status === 'generating';
  const canCompose = status === 'ready';
  const showHeaderActions = [
    'ready',
    'generating',
    'cancelling',
    'generation-error',
    'resetting',
    'reset-error',
    'unloading',
    'unload-error',
  ].includes(status);
  const canStartNewSession = status === 'ready'
    || status === 'reset-error'
    || (
      status === 'generation-error'
      && ghost.state.error?.code === 'conversation-limit-reached'
    );
  const canUnload = showHeaderActions && status !== 'unloading';
  const ghostAnimationMode = getGhostAnimationMode(status);
  const loadingHeadline = getLoadingHeadline(elapsedSeconds);
  const loadingReassurance = status === 'loading'
    ? getLoadingReassurance(elapsedSeconds)
    : null;

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    const readyTransitionModality = previousStatus === 'loading'
      || previousStatus === 'resetting'
      || previousStatus === 'generation-error'
      ? readyFocusModalityRef.current
      : messageSubmissionModalityRef.current;
    if (
      shouldFocusComposer(previousStatus, status)
      && readyTransitionModality === 'keyboard'
      && !suppressComposerRestoreRef.current
    ) {
      inputRef.current?.focus();
    }
    if (previousStatus === 'load-error' && status === 'awaiting-consent') {
      loadActionRef.current?.focus();
    }
    if (status === 'generation-error' && lastSubmittedRef.current !== null) {
      setDraft(lastSubmittedRef.current);
    }
    if (
      status === 'ready'
      && (previousStatus === 'generating' || previousStatus === 'cancelling')
    ) {
      lastSubmittedRef.current = null;
      suppressComposerRestoreRef.current = false;
    }
    if (previousStatus === 'resetting' && status === 'ready') {
      setDraft('');
      setHasSubmittedInSession(false);
      lastSubmittedRef.current = null;
    }
    if (status === 'idle' && unloadRequestedRef.current) {
      setDraft('');
      setHasSubmittedInSession(false);
      lastSubmittedRef.current = null;
      unloadRequestedRef.current = false;
      checkCompatibilityActionRef.current?.focus();
    }
    previousStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (ghost.state.turns.length === 0) {
      stickyFollowRef.current = true;
      setHasUnseenContent(false);
      return;
    }
    const scroller = conversationScrollerRef.current;
    if (
      scroller === null
      || conversationEndRef.current === null
      || pendingSubmissionFollowRef.current
    ) return;
    if (stickyFollowRef.current) {
      scrollConversationToLatest(scroller, 'auto');
    } else {
      setHasUnseenContent(true);
    }
  }, [ghost.state.turns]);

  useEffect(() => () => {
    submissionFollowCleanupRef.current?.();
  }, []);

  useEffect(() => {
    if (status !== 'loading' && status !== 'unloading') {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = status === 'loading' && ghost.loading !== null
      ? ghost.loading.startedAt
      : performance.now();
    const updateElapsed = () => setElapsedSeconds(Math.max(
      0,
      Math.floor((performance.now() - startedAt) / 1_000),
    ));
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1_000);
    return () => window.clearInterval(interval);
  }, [ghost.loading?.startedAt, status]);

  useEffect(() => {
    if (ghost.state.error === null) return;
    const frame = requestAnimationFrame(() => errorActionRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [ghost.state.error]);

  const handleUnload = () => {
    unloadRequestedRef.current = true;
    void ghost.unload();
  };

  const handleNewSession = () => {
    readyFocusModalityRef.current = lastInteractionModalityRef.current;
    void ghost.startNewSession();
  };

  const handleLoad = () => {
    readyFocusModalityRef.current = lastInteractionModalityRef.current;
    void ghost.load();
  };

  const handleRecoverFromError = () => {
    const modality = lastInteractionModalityRef.current;
    readyFocusModalityRef.current = modality;
    ghost.recoverFromError();
    if (modality === 'keyboard') {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleStop = () => ghost.stop();

  const scrollToLatest = (behavior: ScrollBehavior = 'auto') => {
    const scroller = conversationScrollerRef.current;
    if (scroller === null || conversationEndRef.current === null) return;
    scrollConversationToLatest(scroller, behavior);
  };

  const scheduleSubmissionFollow = (modality: InteractionModality) => {
    submissionFollowCleanupRef.current?.();
    pendingSubmissionFollowRef.current = true;
    let cancelled = false;
    let finishedWaiting = false;
    let firstFrame = 0;
    let secondFrame = 0;
    let settleTimer = 0;
    const viewport = modality === 'touch' || modality === 'pen'
      ? window.visualViewport ?? null
      : null;

    const removeViewportWait = () => {
      if (settleTimer !== 0) window.clearTimeout(settleTimer);
      viewport?.removeEventListener('resize', queueAfterViewportSettles);
    };
    const completeAfterFrames = () => {
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          if (cancelled) return;
          pendingSubmissionFollowRef.current = false;
          scrollToLatest('auto');
        });
      });
    };
    const finishViewportWait = () => {
      if (finishedWaiting || cancelled) return;
      finishedWaiting = true;
      removeViewportWait();
      completeAfterFrames();
    };
    function queueAfterViewportSettles() {
      if (settleTimer !== 0) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(finishViewportWait, 80);
    }

    if (viewport !== null) {
      viewport.addEventListener('resize', queueAfterViewportSettles);
      settleTimer = window.setTimeout(finishViewportWait, 320);
    } else {
      completeAfterFrames();
    }

    submissionFollowCleanupRef.current = () => {
      cancelled = true;
      removeViewportWait();
      if (firstFrame !== 0) cancelAnimationFrame(firstFrame);
      if (secondFrame !== 0) cancelAnimationFrame(secondFrame);
      pendingSubmissionFollowRef.current = false;
    };
  };

  const sendMessage = (question: string) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || status !== 'ready') return;
    const submissionModality = lastInteractionModalityRef.current;
    messageSubmissionModalityRef.current = submissionModality;
    suppressComposerRestoreRef.current = false;
    if (submissionModality !== 'keyboard') inputRef.current?.blur();
    stickyFollowRef.current = true;
    setHasUnseenContent(false);
    lastSubmittedRef.current = cleanQuestion;
    setHasSubmittedInSession(true);
    setDraft('');
    void ghost.sendMessage(cleanQuestion);
    scheduleSubmissionFollow(submissionModality);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isGenerating) {
      handleStop();
      return;
    }
    sendMessage(draft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handlePointerDownCapture = (event: ReactPointerEvent<HTMLElement>) => {
    const pointerType: InteractionModality = event.pointerType === 'touch'
      || event.pointerType === 'pen'
      ? event.pointerType
      : 'mouse';
    lastInteractionModalityRef.current = pointerType;
    if (event.target === inputRef.current) {
      composerFocusModalityRef.current = pointerType;
    }
  };

  const handleInteractionKeyDownCapture = (event: KeyboardEvent<HTMLElement>) => {
    const isTouchOriginComposerKeyDown = event.target === inputRef.current
      && (
        composerFocusModalityRef.current === 'touch'
        || composerFocusModalityRef.current === 'pen'
      );
    if (!isTouchOriginComposerKeyDown) {
      lastInteractionModalityRef.current = 'keyboard';
    }
  };

  const handleConversationScroll = (event: UIEvent<HTMLDivElement>) => {
    if (isNearConversationBottom(event.currentTarget)) {
      stickyFollowRef.current = true;
      setHasUnseenContent(false);
      return;
    }
    if (status === 'generating' || status === 'cancelling') {
      stickyFollowRef.current = false;
    }
  };

  const handleJumpToLatest = () => {
    suppressComposerRestoreRef.current = true;
    stickyFollowRef.current = true;
    setHasUnseenContent(false);
    scrollToLatest(prefersReducedMotion ? 'auto' : 'smooth');
  };

  return (
    <section
      className="jets-ghost-shell relative flex h-[100svh] min-h-[40rem] flex-col overflow-hidden bg-bg-base text-text-primary"
      onPointerDownCapture={handlePointerDownCapture}
      onKeyDownCapture={handleInteractionKeyDownCapture}
    >
      <header className="jets-ghost-header relative z-10 flex items-center justify-between gap-s px-gutter">
        <div className="flex min-w-0 items-center gap-xs">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-default bg-surface-base text-brand-base shadow-sm">
            <Ghost aria-hidden="true" size={20} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-serif text-lg font-bold">Jet&apos;s Ghost</p>
            <p className="truncate text-xs text-text-tertiary">2.1.0 · local and private</p>
          </div>
        </div>

        <div className="flex items-center gap-2xs">
          <span
            data-testid="lifecycle-announcement"
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {getLifecycleAnnouncement(status)}
          </span>
          <LifecycleStatus status={status} />
          {showHeaderActions && (
            <>
              <button
                type="button"
                onClick={handleNewSession}
                disabled={!canStartNewSession}
                className="flex min-h-10 items-center gap-2xs rounded-lg px-xs text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-base disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
              >
                <RotateCcw aria-hidden="true" size={16} />
                <span className="hidden sm:inline">New session</span>
                <span className="sr-only sm:hidden">Start a new session</span>
              </button>
              <button
                type="button"
                onClick={handleUnload}
                disabled={!canUnload}
                className="flex min-h-10 items-center gap-2xs rounded-lg px-xs text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-base disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
              >
                <Unplug aria-hidden="true" size={16} />
                <span className="hidden sm:inline">Unload</span>
                <span className="sr-only sm:hidden">Unload Jet&apos;s Ghost</span>
              </button>
            </>
          )}
        </div>
      </header>

      <div className="relative z-0 flex min-h-0 flex-1 flex-col">
        {[
          'idle',
          'checking-capabilities',
          'awaiting-consent',
          'load-error',
        ].includes(status) && (
          <main
            data-testid="activation-main"
            className="flex flex-1 items-center justify-center overflow-y-auto px-gutter py-m max-[369px]:pb-5xl"
          >
            <div className="w-full max-w-3xl text-center">
              <AnimatedGhost mode={ghostAnimationMode} />
              <h1 className="mx-auto max-w-2xl text-5xl font-bold leading-[1.04] text-text-primary">
                Ask the part of the site that reads everything.
              </h1>
              <p className="mx-auto mt-s max-w-2xl text-base leading-relaxed text-text-secondary">
                Jet&apos;s Ghost runs frontier local AI in this browser. Starting it downloads about 2 GB and may use substantial GPU memory. Your prompts and responses stay on this device.
              </p>

              <div
                data-testid="activation-privacy-facts"
                className="mx-auto mt-m flex max-w-xl flex-wrap items-center justify-center gap-x-s gap-y-2xs text-xs text-text-tertiary"
              >
                <span className="inline-flex items-center justify-center gap-3xs whitespace-nowrap">
                  <LockKeyhole aria-hidden="true" size={15} />
                  Prompts stay here
                </span>
                <span className="inline-flex items-center justify-center gap-3xs whitespace-nowrap">
                  <CloudOff aria-hidden="true" size={15} />
                  No cloud history
                </span>
                <span className="inline-flex items-center justify-center gap-3xs whitespace-nowrap">
                  <Unplug aria-hidden="true" size={15} />
                  Session only
                </span>
              </div>

              <div className="mt-l grid min-h-[calc(var(--space-xl)+var(--space-m)+var(--space-xs))] grid-rows-[auto_var(--space-xl)] place-items-center gap-xs">
                <p
                  id="jets-ghost-activation-status"
                  data-testid="activation-status-message"
                  className={`inline-flex min-h-[2.75em] max-w-xl items-center justify-center gap-2xs text-xs font-medium leading-[1.375] min-[430px]:min-h-[1.375em] ${status === 'awaiting-consent' ? 'visible text-brand-text' : status === 'load-error' ? 'visible text-text-secondary' : 'invisible text-text-secondary'}`}
                  aria-hidden={status !== 'awaiting-consent' && status !== 'load-error'}
                >
                  {status === 'awaiting-consent' && (
                    <>
                      <MonitorCheck aria-hidden="true" className="shrink-0" size={16} />
                      This browser is ready for the local runtime
                    </>
                  )}
                  {status === 'load-error'
                    ? ghost.state.error?.message
                    : null}
                </p>

                {status === 'idle' && (
                  <button
                    ref={checkCompatibilityActionRef}
                    type="button"
                    onClick={() => void ghost.checkCompatibility()}
                    className="inline-flex min-h-12 items-center justify-center gap-xs rounded-xl bg-brand-base px-m font-semibold text-brand-contrast transition-colors hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand-base focus:ring-offset-2 focus:ring-offset-bg-base"
                  >
                    Check compatibility
                    <ArrowRight aria-hidden="true" size={18} />
                  </button>
                )}

                {status === 'checking-capabilities' && (
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-12 cursor-wait items-center justify-center gap-xs rounded-xl bg-bg-ui px-m font-semibold text-text-secondary"
                  >
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-brand-base motion-reduce:animate-none" />
                    Checking WebGPU and memory
                  </button>
                )}

                {status === 'awaiting-consent' && (
                  <button
                    ref={loadActionRef}
                    type="button"
                    onClick={handleLoad}
                    className="inline-flex min-h-12 items-center justify-center gap-xs rounded-xl bg-accent-base px-m font-semibold text-accent-contrast transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent-base focus:ring-offset-2 focus:ring-offset-bg-base max-[369px]:px-s max-[369px]:text-sm max-[369px]:whitespace-nowrap"
                  >
                    Load Jet&apos;s Ghost · about 2 GB
                    <ArrowRight aria-hidden="true" size={18} />
                  </button>
                )}

                {status === 'load-error' && ghost.state.error !== null && (
                  <button
                    ref={errorActionRef}
                    type="button"
                    aria-describedby="jets-ghost-activation-status"
                    onClick={ghost.state.error.code === 'engine-cleanup-failed'
                      ? handleUnload
                      : ghost.recoverFromError}
                    className="inline-flex min-h-12 items-center justify-center gap-xs rounded-xl border border-border-strong bg-surface-base px-m font-semibold text-text-primary transition-colors hover:border-brand-base hover:bg-bg-subtle focus:outline-none focus:ring-2 focus:ring-brand-base"
                  >
                    {ghost.state.error.code === 'engine-cleanup-failed'
                      ? <><span>Unload Jet&apos;s Ghost</span><Unplug aria-hidden="true" size={18} /></>
                      : <><span>Return to load</span><RotateCcw aria-hidden="true" size={18} /></>}
                  </button>
                )}
              </div>
              {status === 'awaiting-consent'
                && ghost.state.capability !== null
                && ghost.state.capability.warnings.length > 0 && (
                <div className="mx-auto mt-xs max-w-xl text-sm text-text-secondary" role="status">
                  {ghost.state.capability.warnings.map((warning, index) => (
                    <p key={`${warning.code}-${index}`}>{warning.message}</p>
                  ))}
                </div>
              )}
            </div>
          </main>
        )}

        {status === 'unsupported' && (
          <main className="flex flex-1 items-center justify-center overflow-y-auto px-gutter py-m">
            <div className="w-full max-w-2xl text-center">
              <AnimatedGhost mode="idle" />
              <h1 className="text-3xl font-bold text-text-primary">This browser cannot run Jet&apos;s Ghost</h1>
              <p className="mx-auto mt-s max-w-xl text-base text-text-secondary">
                {ghost.state.error?.message ?? 'The required local AI capabilities are not available here.'}
              </p>
              <div className="mt-m flex flex-wrap items-center justify-center gap-xs">
                <a href="/blog/" className="rounded-xl border border-border-strong bg-surface-base px-m py-xs font-semibold text-text-primary hover:border-brand-base hover:bg-bg-subtle">Visit Blog</a>
                <a href="/works/" className="rounded-xl border border-border-strong bg-surface-base px-m py-xs font-semibold text-text-primary hover:border-brand-base hover:bg-bg-subtle">Visit Works</a>
                <button
                  ref={errorActionRef}
                  type="button"
                  onClick={() => void ghost.checkCompatibility()}
                  className="rounded-xl bg-brand-base px-m py-xs font-semibold text-brand-contrast hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand-base"
                >
                  Check again
                </button>
              </div>
            </div>
          </main>
        )}

        {(status === 'loading' || status === 'unloading') && (
          <main className="flex flex-1 items-center justify-center px-gutter py-m">
            <div data-testid="loading-stack" className="w-full max-w-xl text-center">
              <AnimatedGhost mode={status === 'loading' ? 'loading' : 'idle'} />
              <div>
                <p className="mb-2xs font-mono text-xs uppercase tracking-[0.16em] text-brand-text">
                  {status === 'loading' ? 'Loading on this device' : 'Releasing this device'}
                </p>
                <h1 className="text-3xl font-bold text-text-primary">
                  {status === 'loading' ? loadingHeadline : 'Letting the ghost rest'}
                </h1>
              </div>
              <p data-testid="loading-elapsed" className="mt-xs text-xs text-text-tertiary">
                Elapsed {elapsedSeconds}s
              </p>
              <p
                data-testid="loading-reassurance-slot"
                className="mx-auto mt-2xs min-h-[1.375em] w-full text-xs leading-[1.375] text-text-tertiary"
              >
                {loadingReassurance}
              </p>
              {status === 'loading' && (
                <button
                  type="button"
                  onClick={reloadPage}
                  className="mt-s inline-flex min-h-12 items-center justify-center gap-2xs rounded-xl border border-border-strong bg-surface-base px-m text-sm font-semibold text-text-primary transition-colors hover:border-brand-base hover:bg-bg-subtle focus:outline-none focus:ring-2 focus:ring-brand-base focus:ring-offset-2 focus:ring-offset-bg-base"
                >
                  Cancel and reload
                  <RotateCcw aria-hidden="true" size={17} />
                </button>
              )}
            </div>
          </main>
        )}

        {[
          'ready',
          'generating',
          'cancelling',
          'generation-error',
          'resetting',
          'reset-error',
          'unload-error',
        ].includes(status) && (
          <main className="flex min-h-0 flex-1 flex-col">
            {showPreConversation ? (
              <div className="flex flex-1 items-center justify-center overflow-y-auto px-gutter py-m">
                <div className="w-full max-w-3xl text-center">
                  <AnimatedGhost mode="ready" />
                  <h1 className="text-2xl font-bold leading-tight tracking-tight min-[370px]:whitespace-nowrap">What are you curious about?</h1>
                  <p className="mx-auto mt-xs max-w-xl text-xs text-text-tertiary min-[370px]:whitespace-nowrap">
                    Ask about Jet&apos;s writing, research, projects, or ideas.
                  </p>
                  <div className="mx-auto mt-m grid max-w-2xl grid-cols-1 gap-xs sm:grid-cols-3">
                    {suggestedQuestions.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => {
                          setDraft(question);
                          inputRef.current?.focus();
                        }}
                        className="min-h-20 rounded-xl border border-border-default bg-surface-base p-xs text-left text-sm leading-snug text-text-secondary transition-colors hover:border-brand-base hover:bg-bg-subtle hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-base"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative min-h-0 flex-1">
                <div
                  ref={conversationScrollerRef}
                  data-testid="conversation-scroller"
                  className="h-full min-h-0 overflow-y-auto px-gutter py-m"
                  aria-label="Conversation"
                  onScroll={handleConversationScroll}
                >
                  <div className="mx-auto flex w-full max-w-3xl flex-col gap-l pb-l">
                  {ghost.state.turns.map((turn) => (
                    <article
                      key={turn.id}
                      className={turn.role === 'user' ? 'flex justify-end' : 'flex gap-xs'}
                    >
                      {turn.role === 'assistant' && (
                        <AnimatedGhost
                          compact
                          mode={!turn.content && isGenerating ? 'thinking' : 'ready'}
                        />
                      )}
                      <div className={turn.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-br-md bg-bg-ui px-s py-xs text-text-primary'
                        : 'min-w-0 max-w-[42rem] pt-1 text-text-primary'}
                      >
                        {turn.content ? (
                          turn.role === 'assistant'
                            ? <CitedResponse turn={turn} />
                            : <p className="whitespace-pre-wrap leading-relaxed">{turn.content}</p>
                        ) : isGenerating ? (
                          <div className="flex items-center gap-2xs py-2xs text-sm text-text-tertiary">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-accent-base motion-reduce:animate-none" />
                            Reading the site locally…
                          </div>
                        ) : null}
                        {turn.role === 'assistant' && (turn.content || turn.stopped) && (
                          <ResponseDetails turn={turn} />
                        )}
                      </div>
                    </article>
                  ))}
                  {ghost.state.error !== null && (
                    <ErrorRecovery
                      actionRef={errorActionRef}
                      errorCode={ghost.state.error.code}
                      message={ghost.state.error.message}
                      status={status}
                      onRecover={handleRecoverFromError}
                      onRetryReset={handleNewSession}
                      onRetryUnload={handleUnload}
                    />
                  )}
                    <div
                      ref={conversationEndRef}
                      data-testid="conversation-end-sentinel"
                      className="h-px w-full shrink-0"
                      aria-hidden="true"
                    />
                  </div>
                </div>
                {hasUnseenContent && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-2xs flex justify-center px-gutter">
                    <button
                      type="button"
                      onClick={handleJumpToLatest}
                      className="pointer-events-auto inline-flex min-h-11 items-center gap-2xs rounded-full border border-border-strong bg-surface-base px-s text-sm font-medium text-text-primary shadow-sm transition-colors hover:bg-bg-hover focus:outline-none focus:ring-2 focus:ring-brand-base focus:ring-offset-2 focus:ring-offset-bg-base"
                    >
                      <ArrowDown aria-hidden="true" size={15} />
                      Jump to latest
                    </button>
                  </div>
                )}
              </div>
            )}

            {showPreConversation && ghost.state.error !== null && (
              <div className="mx-auto w-full max-w-3xl px-gutter pb-s">
                <ErrorRecovery
                  actionRef={errorActionRef}
                  errorCode={ghost.state.error.code}
                  message={ghost.state.error.message}
                  status={status}
                  onRecover={handleRecoverFromError}
                  onRetryReset={handleNewSession}
                  onRetryUnload={handleUnload}
                />
              </div>
            )}

            <Composer
              canCompose={canCompose}
              draft={draft}
              inputRef={inputRef}
              isGenerating={isGenerating}
              onFocus={() => {
                composerFocusModalityRef.current = lastInteractionModalityRef.current;
              }}
              onDraftChange={setDraft}
              onKeyDown={handleKeyDown}
              onSubmit={handleSubmit}
              showReliabilityDisclosure={!hasSubmittedInSession}
            />
          </main>
        )}
      </div>
    </section>
  );
}

function LifecycleStatus({ status }: { status: JetsGhostLifecycleStatus }) {
  const prefersReducedMotion = useReducedMotion();
  const compactLabel = getLifecycleLabel(status);
  const dotColor = status === 'ready'
    ? 'bg-brand-base'
    : status === 'generating' || status === 'loading'
      ? 'bg-accent-base'
      : 'bg-text-disabled';

  return (
    <div
      data-testid="lifecycle-visible-status"
      aria-hidden="true"
      className="inline-flex w-fit shrink-0 items-center gap-2xs text-xs font-medium text-text-secondary"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
      <span className="grid h-4 overflow-hidden">
        {prefersReducedMotion ? (
          <span
            data-testid="lifecycle-visual-label"
            className="col-start-1 row-start-1 flex items-center whitespace-nowrap motion-reduce:transition-none"
          >
            {compactLabel}
          </span>
        ) : (
          <AnimatePresence initial={false}>
            <motion.span
              data-testid="lifecycle-visual-label"
              key={compactLabel}
              className="col-start-1 row-start-1 flex items-center whitespace-nowrap motion-reduce:transition-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {compactLabel}
            </motion.span>
          </AnimatePresence>
        )}
      </span>
    </div>
  );
}

function CitedResponse({ turn }: { turn: ConversationTurn }) {
  const citations = new Map(turn.citations.map((citation) => [
    citation.id,
    citation.source,
  ]));
  const parts = turn.content.split(/(\[S\d+\])/g);

  return (
    <p className="whitespace-pre-wrap leading-relaxed">
      {parts.map((part, index) => {
        const match = /^\[(S\d+)\]$/.exec(part);
        const source = match === null ? undefined : citations.get(match[1] as `S${number}`);
        return source === undefined ? part : (
          <a
            key={`${part}-${index}`}
            href={source.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-accent-text underline decoration-accent-base/50 underline-offset-2 hover:decoration-accent-base"
            aria-label={`${part} ${source.title}`}
          >
            {part}
          </a>
        );
      })}
    </p>
  );
}

function ResponseDetails({ turn }: { turn: ConversationTurn }) {
  const citedDocumentSources = getCitedDocumentSources(turn.citations);
  const [isExpanded, setIsExpanded] = useState(false);
  const disclosureId = useId();

  if (!(citedDocumentSources.length > 0 || turn.stopped)) return null;

  const sourceCount = citedDocumentSources.length;
  const sourceLabel = `${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}`;

  return (
    <div
      data-testid="response-details"
      className="mt-s flex min-w-0 flex-col items-start gap-2xs text-sm text-text-tertiary"
    >
      {turn.stopped && <span>Stopped</span>}
      {sourceCount > 0 && (
        <div
          data-testid="response-source-disclosure"
          className="w-full min-w-0 max-w-[38rem]"
        >
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={disclosureId}
            onClick={() => setIsExpanded((expanded) => !expanded)}
            className="inline-flex min-h-11 max-w-full items-center gap-3xs text-left font-medium text-text-tertiary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-base focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
          >
            <span>{sourceLabel}</span>
            <ChevronDown
              aria-hidden="true"
              size={15}
              className={`shrink-0 transition-transform duration-150 motion-reduce:transition-none ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
          {isExpanded && (
            <div
              id={disclosureId}
              role="region"
              aria-label="Sources for this response"
              className="w-full min-w-0"
            >
              <ul className="w-full min-w-0 divide-y divide-border-default border-y border-border-default">
                {citedDocumentSources.map(({ id, source }) => (
                  <li key={source.canonicalUrl} className="min-w-0">
                    <a
                      href={source.canonicalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`[${id}] ${source.title}`}
                      className="grid min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-2xs py-xs text-left text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-base"
                    >
                      <span className="shrink-0 font-semibold text-accent-text">[{id}]</span>
                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                        {source.title}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ErrorRecoveryProps {
  actionRef: React.RefObject<HTMLButtonElement | null>;
  errorCode: JetsGhostErrorCode;
  message: string;
  status: string;
  onRecover: () => void;
  onRetryReset: () => void;
  onRetryUnload: () => void;
}

function ErrorRecovery({
  actionRef,
  errorCode,
  message,
  status,
  onRecover,
  onRetryReset,
  onRetryUnload,
}: ErrorRecoveryProps) {
  const isConversationFull = errorCode === 'conversation-limit-reached';
  const isResetError = status === 'reset-error';
  const isUnloadError = status === 'unload-error';
  const requiresUnload = errorCode === 'engine-cleanup-failed' && !isResetError;
  const action = isConversationFull || isResetError
    ? onRetryReset
    : isUnloadError || requiresUnload
      ? onRetryUnload
      : onRecover;
  const label = isConversationFull
    ? 'Start new session'
    : isResetError
      ? 'Retry new session'
      : isUnloadError
        ? 'Retry unload'
        : requiresUnload
          ? "Unload Jet's Ghost"
          : 'Try another question';

  return (
    <div className="rounded-xl border border-border-strong bg-bg-subtle p-s text-sm text-text-secondary">
      <p>{message}</p>
      <button
        ref={actionRef}
        type="button"
        onClick={action}
        className="mt-xs inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-base px-s font-semibold text-brand-contrast hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand-base"
      >{label}</button>
    </div>
  );
}

interface ComposerProps {
  canCompose: boolean;
  draft: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  isGenerating: boolean;
  onDraftChange: (value: string) => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  showReliabilityDisclosure: boolean;
}

function Composer({
  canCompose,
  draft,
  inputRef,
  isGenerating,
  onDraftChange,
  onFocus,
  onKeyDown,
  onSubmit,
  showReliabilityDisclosure,
}: ComposerProps) {
  const canSend = Boolean(draft.trim() && canCompose);
  const actionTone = getComposerActionTone(isGenerating, canSend);
  const actionToneClasses = {
    accent: 'bg-accent-base text-accent-contrast hover:bg-accent-hover',
    neutral: 'bg-bg-ui text-text-disabled',
    stop: 'bg-text-primary text-bg-base hover:bg-text-secondary',
  }[actionTone];

  return (
    <div className="jets-ghost-composer shrink-0 px-gutter">
      {showReliabilityDisclosure && (
        <p
          data-testid="composer-reliability-disclosure"
          className="mx-auto mb-2xs max-w-3xl px-2xs text-center text-sm leading-relaxed text-text-tertiary"
        >Jet’s Ghost can make mistakes. Check cited sources.</p>
      )}
      <form
        onSubmit={onSubmit}
        className="mx-auto flex w-full max-w-3xl items-end gap-xs rounded-2xl border border-border-default bg-surface-base p-2xs shadow-[0_16px_48px_rgba(31,39,50,0.12)] transition-colors focus-within:border-brand-base"
      >
        <label htmlFor="jets-ghost-prompt" className="sr-only">Ask Jet&apos;s Ghost</label>
        <textarea
          ref={inputRef}
          id="jets-ghost-prompt"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          disabled={!canCompose || isGenerating}
          rows={1}
          maxLength={1200}
          placeholder="Ask Jet's Ghost…"
          className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-xs py-xs text-base text-text-primary outline-none placeholder:text-text-tertiary disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!isGenerating && !canSend}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-brand-base disabled:cursor-not-allowed ${actionToneClasses}`}
          aria-label={isGenerating ? 'Stop response' : 'Send message'}
        >
          {isGenerating
            ? <CircleStop aria-hidden="true" size={19} />
            : <ArrowUp aria-hidden="true" size={19} />}
        </button>
      </form>
      <div
        data-testid="composer-metadata"
        className="mx-auto mt-2xs flex max-w-3xl flex-nowrap items-center justify-end gap-2xs px-2xs text-xs text-text-tertiary min-[768px]:[@media(pointer:fine)]:justify-between"
      >
        <span
          data-testid="composer-keyboard-hint"
          className="hidden whitespace-nowrap min-[768px]:[@media(pointer:fine)]:inline"
        >Enter sends · Shift+Enter newline</span>
        <span
          data-testid="composer-local-only"
          className="inline-flex items-center gap-3xs whitespace-nowrap"
        >
          <LockKeyhole aria-hidden="true" size={13} />
          Local only
        </span>
      </div>
    </div>
  );
}

interface AnimatedGhostProps {
  compact?: boolean;
  mode: GhostAnimationMode;
}

type NonLoadingGhostAnimationMode = Exclude<GhostAnimationMode, 'loading'>;

const ghostMotion: Record<NonLoadingGhostAnimationMode, {
  animate: { x: number[]; y: number[]; rotate: number[]; scale: number[] };
  duration: number;
}> = {
  idle: {
    animate: { x: [-10, 10, -10], y: [1, -4, 1], rotate: [-2, 2, -2], scale: [1, 1.02, 1] },
    duration: 3.8,
  },
  scanning: {
    animate: { x: [-28, 28, -28], y: [0, -2, 0], rotate: [-4, 4, -4], scale: [1, 1.03, 1] },
    duration: 1.8,
  },
  ready: {
    animate: { x: [-4, 4, -4], y: [1, -6, 1], rotate: [-1, 1, -1], scale: [1, 1.04, 1] },
    duration: 4.2,
  },
  thinking: {
    animate: { x: [-8, 8, -8], y: [0, -7, 0], rotate: [-3, 3, -3], scale: [1, 1.08, 1] },
    duration: 1.35,
  },
};

const binaryParticles = [
  { delay: 0, top: '22%', value: '1' },
  { delay: 0.7, top: '48%', value: '0' },
  { delay: 1.35, top: '68%', value: '1' },
];

const loadingAfterimageDelays = [0, 1.2];
const loadingInwardParticles = [
  { delay: 0, value: '1', x: [-30, -12, 0], y: [-18, -20, 0] },
  { delay: 0.6, value: '0', x: [28, 18, 0], y: [-20, -8, 0] },
  { delay: 1.2, value: '1', x: [32, 10, 0], y: [18, 16, 0] },
  { delay: 1.8, value: '0', x: [-28, -18, 0], y: [22, 8, 0] },
];

function LoadingPhaseGhost({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div
      data-testid="loading-phase-visual"
      className="relative mx-auto mb-s h-16 w-36 shrink-0 text-brand-base"
      aria-hidden="true"
    >
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          [data-testid="loading-ghost-afterimage"] {
            opacity: var(--jets-ghost-reduced-opacity) !important;
            transform: scale(var(--jets-ghost-reduced-scale)) !important;
          }

          [data-testid="loading-inward-particle"] {
            opacity: 0.3 !important;
            transform: translate(
              var(--jets-ghost-reduced-x),
              var(--jets-ghost-reduced-y)
            ) scale(0.85) !important;
          }

          [data-testid="loading-main-ghost"] {
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
      {loadingAfterimageDelays.map((delay, index) => (
        <motion.div
          key={delay}
          data-testid="loading-ghost-afterimage"
          className="absolute inset-0 flex items-center justify-center text-brand-base"
          style={{
            '--jets-ghost-reduced-opacity': index === 0 ? 0.14 : 0.08,
            '--jets-ghost-reduced-scale': index === 0 ? 1.14 : 1.3,
          } as CSSProperties}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.88 }}
          animate={reduceMotion
            ? { opacity: index === 0 ? 0.14 : 0.08, scale: index === 0 ? 1.14 : 1.3 }
            : { opacity: [0, 0.28, 0], scale: [0.88, 1.16, 1.45] }}
          transition={reduceMotion
            ? { duration: 0 }
            : { delay, duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
        >
          <Ghost size={38} strokeWidth={1.35} />
        </motion.div>
      ))}

      {loadingInwardParticles.map((particle) => (
        <motion.span
          key={`${particle.value}-${particle.delay}`}
          data-testid="loading-inward-particle"
          className="absolute left-1/2 top-1/2 z-10 -ml-1 -mt-2 font-mono text-xs font-semibold text-accent-base"
          style={{
            '--jets-ghost-reduced-x': `${particle.x[1]}px`,
            '--jets-ghost-reduced-y': `${particle.y[1]}px`,
          } as CSSProperties}
          initial={reduceMotion
            ? false
            : {
                x: particle.x[0],
                y: particle.y[0],
                opacity: 0,
                scale: 0.75,
              }}
          animate={reduceMotion
            ? {
                x: particle.x[1],
                y: particle.y[1],
                opacity: 0.3,
                scale: 0.85,
              }
            : {
                x: particle.x,
                y: particle.y,
                opacity: [0, 0.75, 0],
                scale: [0.75, 1, 0.45],
              }}
          transition={reduceMotion
            ? { duration: 0 }
            : {
                delay: particle.delay,
                duration: 2.4,
                ease: 'easeInOut',
                repeat: Infinity,
              }}
        >
          {particle.value}
        </motion.span>
      ))}

      <div className="absolute inset-0 z-20 flex items-center justify-center">
        <motion.div
          data-testid="loading-main-ghost"
          initial={reduceMotion ? false : { opacity: 0.72, scale: 0.97 }}
          animate={reduceMotion
            ? { opacity: 1, scale: 1 }
            : { opacity: [0.72, 1, 0.72], scale: [0.97, 1.03, 0.97] }}
          transition={reduceMotion
            ? { duration: 0 }
            : { duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
        >
          <Ghost size={38} strokeWidth={1.65} />
        </motion.div>
      </div>
    </div>
  );
}

function AnimatedGhost({ compact = false, mode }: AnimatedGhostProps) {
  const reduceMotion = useLiveReducedMotion();
  if (mode === 'loading') return <LoadingPhaseGhost reduceMotion={reduceMotion} />;

  const motionProfile = ghostMotion[mode];
  const particleDuration = mode === 'scanning' ? 1.6 : 2.7;

  return (
    <div
      className={`relative shrink-0 text-brand-base ${compact ? 'mt-1 h-8 w-10' : 'mx-auto mb-s h-16 w-36'}`}
      aria-hidden="true"
    >
      {!compact && binaryParticles.map((particle) => (
        <motion.span
          key={`${particle.value}-${particle.delay}`}
          className="absolute right-1 font-mono text-xs font-semibold text-accent-base"
          style={{ top: particle.top }}
          animate={reduceMotion
            ? { opacity: 0.35 }
            : { x: [0, -38, -62], opacity: [0, 0.7, 0], scale: [0.9, 1, 0.55] }}
          transition={{
            delay: particle.delay,
            duration: particleDuration,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        >
          {particle.value}
        </motion.span>
      ))}

      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={reduceMotion ? undefined : motionProfile.animate}
          transition={{
            duration: motionProfile.duration,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        >
          <Ghost size={compact ? 20 : 38} strokeWidth={1.65} />
        </motion.div>
      </div>
    </div>
  );
}
