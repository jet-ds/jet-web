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
      <div className="max-w-md w-full space-y-8 px-4">
        {/* Ghost Icon with animation */}
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">👻</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Waking up Jet's Ghost...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {getSubstateMessage(substate)}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        {/* Progress Percentage */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          {Math.floor(progress)}% complete
        </div>

        {/* Substep indicator */}
        <div className="flex justify-center gap-2">
          {(['checking-cache', 'loading-model', 'fetching-artifacts', 'initializing-search', 'spawning-worker'] as const).map(
            (step) => (
              <div
                key={step}
                className={`w-2 h-2 rounded-full transition-colors ${
                  step === substate
                    ? 'bg-blue-600'
                    : progress >= getStepProgress(step)
                      ? 'bg-blue-400'
                      : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            )
          )}
        </div>

        {/* First-time notice */}
        {substate === 'loading-model' && (
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
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
