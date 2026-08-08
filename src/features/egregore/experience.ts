import type { EgregoreLifecycleStatus } from './runtime/lifecycle';

export type GhostAnimationMode =
  'idle' | 'scanning' | 'loading' | 'ready' | 'thinking';

export type ComposerActionTone = 'accent' | 'neutral' | 'stop';

export type LifecycleCompactLabel =
  | 'Not running'
  | 'Checking'
  | 'Load ready'
  | 'Loading'
  | 'Ready'
  | 'Responding';

export function getComposerActionTone(
  isGenerating: boolean,
  canSend: boolean,
): ComposerActionTone {
  if (isGenerating) return 'stop';
  return canSend ? 'accent' : 'neutral';
}

export function getGhostAnimationMode(
  lifecycle: EgregoreLifecycleStatus,
): GhostAnimationMode {
  switch (lifecycle) {
    case 'checking-capabilities':
      return 'scanning';
    case 'loading':
      return 'loading';
    case 'generating':
    case 'cancelling':
      return 'thinking';
    case 'awaiting-consent':
    case 'ready':
    case 'generation-error':
    case 'resetting':
    case 'reset-error':
      return 'ready';
    case 'idle':
    case 'unsupported':
    case 'load-error':
    case 'unloading':
    case 'unload-error':
      return 'idle';
  }
}

const LOADING_HEADLINES = [
  "Haunting Jet's archive",
  'Waking the ghost',
  'Feeding it ones and zeroes',
] as const;

const LOADING_HEADLINE_INTERVAL_SECONDS = 12;
const LOADING_REASSURANCE_THRESHOLD_SECONDS = 36;

function getSafeElapsedSeconds(elapsedSeconds: number): number {
  return Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
}

export function getLoadingHeadline(elapsedSeconds: number): string {
  const safeElapsedSeconds = getSafeElapsedSeconds(elapsedSeconds);
  const headlineIndex =
    Math.floor(safeElapsedSeconds / LOADING_HEADLINE_INTERVAL_SECONDS) %
    LOADING_HEADLINES.length;
  return LOADING_HEADLINES[headlineIndex] ?? LOADING_HEADLINES[0];
}

export function getLoadingReassurance(elapsedSeconds: number): string | null {
  return getSafeElapsedSeconds(elapsedSeconds) >=
    LOADING_REASSURANCE_THRESHOLD_SECONDS
    ? 'First load may take a few minutes.'
    : null;
}

export function getLifecycleLabel(
  lifecycle: EgregoreLifecycleStatus,
): LifecycleCompactLabel {
  switch (lifecycle) {
    case 'idle':
      return 'Not running';
    case 'checking-capabilities':
      return 'Checking';
    case 'awaiting-consent':
      return 'Load ready';
    case 'unsupported':
      return 'Not running';
    case 'loading':
      return 'Loading';
    case 'load-error':
      return 'Not running';
    case 'ready':
      return 'Ready';
    case 'generating':
      return 'Responding';
    case 'cancelling':
      return 'Responding';
    case 'generation-error':
      return 'Ready';
    case 'resetting':
      return 'Ready';
    case 'reset-error':
      return 'Ready';
    case 'unloading':
      return 'Not running';
    case 'unload-error':
      return 'Not running';
  }
}

export function getLifecycleAnnouncement(
  lifecycle: EgregoreLifecycleStatus,
): string {
  switch (lifecycle) {
    case 'idle':
      return 'Egregore is not running.';
    case 'checking-capabilities':
      return 'Checking whether this browser can run Egregore.';
    case 'awaiting-consent':
      return 'Compatibility check complete. Egregore is ready to load.';
    case 'unsupported':
      return 'This browser cannot run Egregore.';
    case 'loading':
      return 'Egregore is loading on this device.';
    case 'load-error':
      return 'Egregore did not finish loading. Review the recovery action.';
    case 'ready':
      return 'Egregore is ready.';
    case 'generating':
      return 'Egregore is responding.';
    case 'cancelling':
      return 'Stopping the current response.';
    case 'generation-error':
      return 'The response was interrupted. Review the recovery action.';
    case 'resetting':
      return 'Starting a new Egregore session.';
    case 'reset-error':
      return 'The new session did not start. Review the recovery action.';
    case 'unloading':
      return 'Unloading Egregore from this device.';
    case 'unload-error':
      return 'Egregore did not finish unloading. Review the recovery action.';
  }
}

export function shouldFocusComposer(
  previous: EgregoreLifecycleStatus,
  current: EgregoreLifecycleStatus,
): boolean {
  return (
    current === 'ready' &&
    [
      'loading',
      'resetting',
      'generation-error',
      'generating',
      'cancelling',
    ].includes(previous)
  );
}
