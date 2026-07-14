import type { JetsGhostLifecycleStatus } from './runtime/lifecycle';

export type GhostAnimationMode =
  | 'idle'
  | 'scanning'
  | 'loading'
  | 'ready'
  | 'thinking';

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
  lifecycle: JetsGhostLifecycleStatus,
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

const LOADING_LIVENESS_MESSAGES = [
  'Preparing the local assistant',
  'Loading the model onto this device',
  'Getting the local model ready',
  'This large local model can take several minutes',
] as const;

export function getLoadingLivenessMessage(elapsedSeconds: number): string {
  const safeElapsedSeconds = Number.isFinite(elapsedSeconds)
    ? Math.max(0, elapsedSeconds)
    : 0;
  const interval = Math.floor(safeElapsedSeconds / 12);
  if (interval === 0) return LOADING_LIVENESS_MESSAGES[0];

  const longRunningIndex = 1 + ((interval - 1) % (LOADING_LIVENESS_MESSAGES.length - 1));
  return LOADING_LIVENESS_MESSAGES[longRunningIndex];
}

export function getLifecycleLabel(
  lifecycle: JetsGhostLifecycleStatus,
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
  lifecycle: JetsGhostLifecycleStatus,
): string {
  switch (lifecycle) {
    case 'idle':
      return "Jet's Ghost is not running.";
    case 'checking-capabilities':
      return "Checking whether this browser can run Jet's Ghost.";
    case 'awaiting-consent':
      return "Compatibility check complete. Jet's Ghost is ready to load.";
    case 'unsupported':
      return "This browser cannot run Jet's Ghost.";
    case 'loading':
      return "Jet's Ghost is loading on this device.";
    case 'load-error':
      return "Jet's Ghost did not finish loading. Review the recovery action.";
    case 'ready':
      return "Jet's Ghost is ready.";
    case 'generating':
      return "Jet's Ghost is responding.";
    case 'cancelling':
      return 'Stopping the current response.';
    case 'generation-error':
      return 'The response was interrupted. Review the recovery action.';
    case 'resetting':
      return "Starting a new Jet's Ghost session.";
    case 'reset-error':
      return 'The new session did not start. Review the recovery action.';
    case 'unloading':
      return "Unloading Jet's Ghost from this device.";
    case 'unload-error':
      return "Jet's Ghost did not finish unloading. Review the recovery action.";
  }
}

export function shouldFocusComposer(
  previous: JetsGhostLifecycleStatus,
  current: JetsGhostLifecycleStatus,
): boolean {
  return current === 'ready' && [
    'loading',
    'resetting',
    'generation-error',
    'generating',
    'cancelling',
  ].includes(previous);
}
