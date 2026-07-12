import {
  ArrowRight,
  ArrowUp,
  CircleStop,
  CloudOff,
  Ghost,
  LockKeyhole,
  MonitorCheck,
  RotateCcw,
  Unplug,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import {
  createInitialExperience,
  getComposerActionTone,
  getGhostAnimationMode,
  getLoadingStage,
  transitionExperience,
  type GhostAnimationMode,
  type JetsGhostLifecycle,
} from './experience';

interface PreviewMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  stopped?: boolean;
}

const suggestedQuestions = [
  'What does Jet write about agentic work?',
  'Summarize the recursive convergence hypothesis.',
  'Which projects connect AI and systems thinking?',
];

const lifecycleLabels: Record<JetsGhostLifecycle, string> = {
  idle: 'Not running',
  checking: 'Checking this browser',
  compatible: 'Ready to load',
  loading: 'Loading locally',
  ready: 'Ready',
  generating: 'Responding',
};

function makePreviewResponse(question: string) {
  const shortenedQuestion = question.length > 86
    ? `${question.slice(0, 83)}...`
    : question;

  return `This interface preview has reached the local-generation boundary. In Jet's Ghost 2.1.0, Gemma 4 E2B will answer “${shortenedQuestion}” here using only eligible, published site material, with citations attached to each grounded claim.`;
}

export default function JetsGhostExperience() {
  const [experience, dispatch] = useReducer(
    transitionExperience,
    undefined,
    createInitialExperience,
  );
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const responseTimerRef = useRef<number | null>(null);

  const hasConversation = messages.length > 0;
  const isGenerating = experience.lifecycle === 'generating';
  const canCompose = experience.lifecycle === 'ready' || isGenerating;
  const ghostAnimationMode = getGhostAnimationMode(experience.lifecycle);

  const loadingStage = getLoadingStage(experience.progress);

  useEffect(() => {
    if (experience.lifecycle !== 'loading') return;

    const progressSteps = [18, 34, 57, 74, 88, 96];
    const timers = progressSteps.map((progress, index) => window.setTimeout(() => {
      dispatch({ type: 'set-progress', progress });
    }, 420 * (index + 1)));

    const readyTimer = window.setTimeout(() => {
      dispatch({ type: 'model-ready' });
    }, 420 * (progressSteps.length + 1));

    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(readyTimer);
    };
  }, [experience.lifecycle]);

  useEffect(() => {
    if (experience.lifecycle === 'ready') {
      inputRef.current?.focus();
    }
  }, [experience.lifecycle]);

  useEffect(() => () => {
    if (responseTimerRef.current !== null) {
      window.clearTimeout(responseTimerRef.current);
    }
  }, []);

  const handleCompatibilityCheck = () => {
    dispatch({ type: 'check-compatibility' });
    window.setTimeout(() => {
      dispatch({ type: 'compatibility-passed' });
    }, 850);
  };

  const handleUnload = () => {
    if (responseTimerRef.current !== null) {
      window.clearTimeout(responseTimerRef.current);
      responseTimerRef.current = null;
    }

    setMessages([]);
    setDraft('');
    dispatch({ type: 'unload' });
  };

  const handleNewSession = () => {
    if (responseTimerRef.current !== null) {
      window.clearTimeout(responseTimerRef.current);
      responseTimerRef.current = null;
    }

    setMessages([]);
    setDraft('');
    dispatch({ type: 'new-session' });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleStop = () => {
    if (responseTimerRef.current !== null) {
      window.clearTimeout(responseTimerRef.current);
      responseTimerRef.current = null;
    }

    setMessages((current) => current.map((message, index) => (
      index === current.length - 1 && message.role === 'assistant'
        ? { ...message, content: 'Response stopped in the interface preview.', stopped: true }
        : message
    )));
    dispatch({ type: 'stop-generation' });
  };

  const sendMessage = (question: string) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || experience.lifecycle !== 'ready') return;

    const timestamp = Date.now();
    const assistantId = `assistant-${timestamp}`;
    setMessages((current) => [
      ...current,
      { id: `user-${timestamp}`, role: 'user', content: cleanQuestion },
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    setDraft('');
    dispatch({ type: 'send-message' });

    responseTimerRef.current = window.setTimeout(() => {
      setMessages((current) => current.map((message) => (
        message.id === assistantId
          ? { ...message, content: makePreviewResponse(cleanQuestion) }
          : message
      )));
      responseTimerRef.current = null;
      dispatch({ type: 'generation-finished' });
    }, 1200);
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

  return (
    <section className="jets-ghost-shell relative flex h-[100svh] min-h-[40rem] flex-col overflow-hidden bg-bg-base text-text-primary">
      <header className="jets-ghost-header relative z-10 flex items-center justify-between gap-s px-gutter">
        <div className="flex min-w-0 items-center gap-xs">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-default bg-surface-base text-brand-base shadow-sm">
            <Ghost aria-hidden="true" size={20} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-serif text-lg font-bold">Jet&apos;s Ghost</p>
            <p className="truncate text-xs text-text-tertiary">2.1.0 interface preview</p>
          </div>
        </div>

        <div className="flex items-center gap-2xs">
          {experience.hasActivatedModel && experience.lifecycle !== 'loading' && (
            <>
              <button
                type="button"
                onClick={handleNewSession}
                className="flex min-h-10 items-center gap-2xs rounded-lg px-xs text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-base"
              >
                <RotateCcw aria-hidden="true" size={16} />
                <span className="hidden sm:inline">New session</span>
                <span className="sr-only sm:hidden">Start a new session</span>
              </button>
              <button
                type="button"
                onClick={handleUnload}
                className="flex min-h-10 items-center gap-2xs rounded-lg px-xs text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-base"
              >
                <Unplug aria-hidden="true" size={16} />
                <span className="hidden sm:inline">Unload</span>
                <span className="sr-only sm:hidden">Unload Jet&apos;s Ghost</span>
              </button>
            </>
          )}
          <div className="flex min-h-10 items-center gap-2xs rounded-full border border-border-default bg-surface-base px-xs text-xs font-medium text-text-secondary shadow-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                experience.lifecycle === 'ready'
                  ? 'bg-brand-base'
                  : experience.lifecycle === 'generating' || experience.lifecycle === 'loading'
                    ? 'bg-accent-base'
                    : 'bg-text-disabled'
              }`}
              aria-hidden="true"
            />
            <span aria-live="polite">
              {experience.lifecycle === 'loading'
                ? `${lifecycleLabels.loading} ${experience.progress}%`
                : lifecycleLabels[experience.lifecycle]}
            </span>
          </div>
        </div>
      </header>

      <div className="relative z-0 flex min-h-0 flex-1 flex-col">
        {!experience.hasActivatedModel && experience.lifecycle !== 'loading' && (
          <main className="flex flex-1 items-center justify-center overflow-y-auto px-gutter py-m">
            <div className="w-full max-w-3xl text-center">
              <AnimatedGhost mode={ghostAnimationMode} />
              <h1 className="mx-auto max-w-2xl text-5xl font-bold leading-[1.04] text-text-primary">
                Ask the part of the site that reads everything.
              </h1>
              <p className="mx-auto mt-s max-w-2xl text-base leading-relaxed text-text-secondary">
                Jet&apos;s Ghost runs frontier local AI in this browser, grounded in Jet&apos;s published works. Starting it downloads about 2 GB and may use substantial GPU memory.
              </p>

              <div className="mx-auto mt-m grid max-w-xl grid-cols-3 items-center gap-2xs text-xs text-text-tertiary">
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
                  Unload anytime
                </span>
              </div>

              <div className="mt-l grid min-h-[calc(var(--space-xl)+var(--space-m)+var(--space-xs))] grid-rows-[var(--space-s)_var(--space-xl)] place-items-center gap-xs">
                <p
                  className={`inline-flex items-center gap-2xs text-sm font-medium text-brand-text ${experience.lifecycle === 'compatible' ? 'visible' : 'invisible'}`}
                  aria-hidden={experience.lifecycle !== 'compatible'}
                >
                  <MonitorCheck aria-hidden="true" size={16} />
                  This browser is ready for the local runtime
                </p>

                {experience.lifecycle === 'idle' && (
                  <button
                    type="button"
                    onClick={handleCompatibilityCheck}
                    className="inline-flex min-h-12 items-center justify-center gap-xs rounded-xl bg-brand-base px-m font-semibold text-brand-contrast transition-colors hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand-base focus:ring-offset-2 focus:ring-offset-bg-base"
                  >
                    Check compatibility
                    <ArrowRight aria-hidden="true" size={18} />
                  </button>
                )}

                {experience.lifecycle === 'checking' && (
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-12 cursor-wait items-center justify-center gap-xs rounded-xl bg-bg-ui px-m font-semibold text-text-secondary"
                  >
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-brand-base motion-reduce:animate-none" />
                    Checking WebGPU and memory
                  </button>
                )}

                {experience.lifecycle === 'compatible' && (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'load-model' })}
                    className="inline-flex min-h-12 items-center justify-center gap-xs rounded-xl bg-accent-base px-m font-semibold text-accent-contrast transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent-base focus:ring-offset-2 focus:ring-offset-bg-base"
                  >
                    Load Jet&apos;s Ghost · about 2 GB
                    <ArrowRight aria-hidden="true" size={18} />
                  </button>
                )}
              </div>
            </div>
          </main>
        )}

        {experience.lifecycle === 'loading' && (
          <main className="flex flex-1 items-center justify-center px-gutter py-m">
            <div className="w-full max-w-xl text-center" aria-live="polite">
              <AnimatedGhost mode="loading" />
              <p className="mb-2xs font-mono text-xs uppercase tracking-[0.16em] text-brand-text">
                Loading on this device
              </p>
              <h1 className="text-3xl font-bold text-text-primary">{loadingStage}</h1>
              <div className="mt-l h-2 overflow-hidden rounded-full bg-bg-ui">
                <div
                  className="h-full rounded-full bg-accent-base transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${experience.progress}%` }}
                />
              </div>
              <div className="mt-xs flex items-center text-xs text-text-tertiary">
                <span>{experience.progress}%</span>
              </div>
              <button
                type="button"
                onClick={handleUnload}
                className="mt-m inline-flex min-h-11 items-center justify-center rounded-xl border border-border-strong bg-surface-base px-m text-sm font-semibold text-text-primary shadow-sm transition-colors hover:border-brand-base hover:bg-bg-subtle focus:outline-none focus:ring-2 focus:ring-brand-base"
              >
                Cancel and unload
              </button>
            </div>
          </main>
        )}

        {experience.hasActivatedModel && experience.lifecycle !== 'loading' && (
          <main className="flex min-h-0 flex-1 flex-col">
            {!hasConversation ? (
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
              <div className="min-h-0 flex-1 overflow-y-auto px-gutter py-m" aria-label="Conversation">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-l pb-l">
                  {messages.map((message) => (
                    <article
                      key={message.id}
                      className={message.role === 'user' ? 'flex justify-end' : 'flex gap-xs'}
                    >
                      {message.role === 'assistant' && (
                        <AnimatedGhost
                          compact
                          mode={!message.content && isGenerating ? 'thinking' : 'ready'}
                        />
                      )}
                      <div className={message.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-br-md bg-bg-ui px-s py-xs text-text-primary'
                        : 'min-w-0 max-w-[42rem] pt-1 text-text-primary'}
                      >
                        {message.content ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        ) : (
                          <div className="flex items-center gap-2xs py-2xs text-sm text-text-tertiary">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-accent-base motion-reduce:animate-none" />
                            Reading the site locally…
                          </div>
                        )}
                        {message.role === 'assistant' && message.content && (
                          <div className="mt-s flex flex-wrap items-center gap-2xs text-xs text-text-tertiary">
                            <span className="rounded-full border border-border-default bg-surface-base px-xs py-3xs transition-colors hover:border-accent-base hover:bg-accent-subtle">
                              <span className="font-semibold text-accent-text">1</span> · Works
                            </span>
                            <span className="rounded-full border border-border-default bg-surface-base px-xs py-3xs transition-colors hover:border-accent-base hover:bg-accent-subtle">
                              <span className="font-semibold text-accent-text">2</span> · Blog
                            </span>
                            {message.stopped && <span>Stopped</span>}
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            <Composer
              canCompose={canCompose}
              draft={draft}
              inputRef={inputRef}
              isGenerating={isGenerating}
              onDraftChange={setDraft}
              onKeyDown={handleKeyDown}
              onSubmit={handleSubmit}
            />
          </main>
        )}
      </div>
    </section>
  );
}

interface ComposerProps {
  canCompose: boolean;
  draft: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  isGenerating: boolean;
  onDraftChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function Composer({
  canCompose,
  draft,
  inputRef,
  isGenerating,
  onDraftChange,
  onKeyDown,
  onSubmit,
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
      <div className="mx-auto mt-2xs flex max-w-3xl flex-nowrap items-center justify-between gap-2xs px-2xs text-xs text-text-tertiary">
        <span className="whitespace-nowrap">Enter sends · Shift+Enter newline</span>
        <span className="inline-flex items-center gap-3xs whitespace-nowrap">
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

const ghostMotion: Record<GhostAnimationMode, {
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
  loading: {
    animate: { x: [-34, 34, -34], y: [0, -5, 0], rotate: [-3, 3, -3], scale: [1, 1.05, 1] },
    duration: 2.2,
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

function AnimatedGhost({ compact = false, mode }: AnimatedGhostProps) {
  const reduceMotion = useReducedMotion();
  const motionProfile = ghostMotion[mode];
  const particleDuration = mode === 'loading' || mode === 'scanning' ? 1.6 : 2.7;

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
