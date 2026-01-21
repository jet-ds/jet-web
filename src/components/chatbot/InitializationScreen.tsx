/**
 * InitializationScreen Component - Loading Progress Display
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: UX Narrative Loading States
 *
 * Displays initialization progress with friendly messages for each substep.
 */

import type { InitializationSubstate } from '../../types/chatbot';

interface InitializationScreenProps {
  substate: InitializationSubstate;
  progress: number;
}

/**
 * Get friendly message for each initialization substep
 */
function getSubstateMessage(substate: InitializationSubstate): string {
  switch (substate) {
    case 'checking-cache':
      return 'Checking for cached data...';
    case 'loading-model':
      return 'Loading AI model (first time: ~23 MB download)...';
    case 'fetching-artifacts':
      return 'Fetching blog embeddings and content...';
    case 'initializing-search':
      return 'Building search index...';
    case 'spawning-worker':
      return 'Initializing background worker...';
    case 'complete':
      return 'Ready to chat!';
    default:
      return 'Initializing...';
  }
}

/**
 * InitializationScreen - Progress display during loading
 *
 * Features:
 * - Progress bar (0-100%)
 * - Friendly messages for each substep
 * - Estimated time remaining
 * - Ghost animation
 */
export function InitializationScreen({
  substate,
  progress,
}: InitializationScreenProps) {
  return (
    <div className="flex items-center justify-center min-h-[600px]">
      <div className="max-w-md w-full space-y-xl px-gutter">
        {/* Ghost Icon with animation */}
        <div className="text-center">
          <div className="text-6xl mb-m animate-bounce">👻</div>
          <h2 className="text-2xl font-bold leading-tight text-text-primary mb-s">
            Waking up Jet's Ghost...
          </h2>
          <p className="text-text-tertiary">
            {getSubstateMessage(substate)}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-neutral-3 rounded-full h-4 overflow-hidden relative">
          <div
            className="bg-brand-base h-full transition-all duration-300 ease-out relative overflow-hidden"
            style={{ width: `${Math.min(progress, 100)}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-4 to-transparent animate-[shimmer_2s_infinite]" />
          </div>
        </div>

        {/* Progress Percentage */}
        <div className="text-center text-sm text-text-tertiary">
          {Math.floor(progress)}% complete
        </div>

        {/* Substep indicator */}
        <div className="flex justify-center gap-s">
          {(['checking-cache', 'loading-model', 'fetching-artifacts', 'initializing-search', 'spawning-worker'] as const).map(
            (step) => (
              <div
                key={step}
                className={`w-2 h-2 rounded-full transition-colors ${
                  step === substate
                    ? 'bg-brand-base'
                    : progress >= getStepProgress(step)
                      ? 'bg-brand-4'
                      : 'bg-neutral-4'
                }`}
              />
            )
          )}
        </div>

        {/* First-time notice */}
        {substate === 'loading-model' && (
          <p className="text-xs text-center text-text-tertiary">
            First load downloads the AI model (~23 MB). Subsequent loads are instant.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Get progress threshold for each step (for visual indicator)
 */
function getStepProgress(step: InitializationSubstate): number {
  switch (step) {
    case 'checking-cache':
      return 0;
    case 'loading-model':
      return 10;
    case 'fetching-artifacts':
      return 40;
    case 'initializing-search':
      return 70;
    case 'spawning-worker':
      return 90;
    default:
      return 100;
  }
}
