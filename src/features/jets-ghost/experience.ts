import type { JetsGhostLifecycleStatus } from './runtime/lifecycle';
import type { RuntimeLoadPhase } from './runtime/types';

export type GhostAnimationMode =
  | 'idle'
  | 'scanning'
  | 'loading'
  | 'ready'
  | 'thinking';

export type ComposerActionTone = 'accent' | 'neutral' | 'stop';

export type LoadingPhase = 'corpus' | RuntimeLoadPhase;

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

export function getLoadingStage(phase: LoadingPhase): string {
  switch (phase) {
    case 'corpus':
      return "Haunting Jet's archive";
    case 'runtime':
      return 'Waking the ghost';
    case 'model':
      return 'Feeding it ones and zeroes';
  }
}

export function getLifecycleLabel(
  lifecycle: JetsGhostLifecycleStatus,
): string {
  switch (lifecycle) {
    case 'idle':
      return 'Not running';
    case 'checking-capabilities':
      return 'Checking this browser';
    case 'awaiting-consent':
      return 'Ready to load';
    case 'unsupported':
      return 'Not supported';
    case 'loading':
      return 'Loading locally';
    case 'load-error':
      return 'Load interrupted';
    case 'ready':
      return 'Ready';
    case 'generating':
      return 'Responding';
    case 'cancelling':
      return 'Stopping';
    case 'generation-error':
      return 'Response interrupted';
    case 'resetting':
      return 'Starting a new session';
    case 'reset-error':
      return 'Session reset interrupted';
    case 'unloading':
      return 'Unloading';
    case 'unload-error':
      return 'Unload interrupted';
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
