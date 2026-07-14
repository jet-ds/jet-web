import type { JetsGhostError } from '../errors';
import type { CapabilityReport } from './types';

export type JetsGhostLifecycleStatus =
  | 'idle'
  | 'checking-capabilities'
  | 'awaiting-consent'
  | 'unsupported'
  | 'loading'
  | 'load-error'
  | 'ready'
  | 'generating'
  | 'cancelling'
  | 'generation-error'
  | 'resetting'
  | 'reset-error'
  | 'unloading'
  | 'unload-error';

export interface JetsGhostLifecycleState {
  status: JetsGhostLifecycleStatus;
  mounted: boolean;
  stopRequestedDuringLoad: boolean;
  error: JetsGhostError | null;
}

export type JetsGhostLifecycleEvent =
  | { type: 'check-requested' }
  | { type: 'capabilities-resolved'; report: CapabilityReport }
  | { type: 'capabilities-failed'; error: JetsGhostError }
  | { type: 'load-requested' }
  | { type: 'load-succeeded' }
  | { type: 'load-failed'; error: JetsGhostError }
  | { type: 'generation-requested' }
  | { type: 'generation-succeeded' }
  | { type: 'generation-failed'; error: JetsGhostError }
  | { type: 'generation-cancelled' }
  | { type: 'stop-requested' }
  | { type: 'reset-requested' }
  | { type: 'reset-succeeded' }
  | { type: 'reset-failed'; error: JetsGhostError }
  | { type: 'unload-requested' }
  | { type: 'unload-succeeded' }
  | { type: 'unload-failed'; error: JetsGhostError }
  | { type: 'error-acknowledged' }
  | { type: 'unmounted' };

export function createInitialLifecycleState(
  mounted = true,
): JetsGhostLifecycleState {
  return {
    status: 'idle',
    mounted,
    stopRequestedDuringLoad: false,
    error: null,
  };
}

function status(
  state: JetsGhostLifecycleState,
  nextStatus: JetsGhostLifecycleStatus,
  changes: Partial<JetsGhostLifecycleState> = {},
): JetsGhostLifecycleState {
  return {
    ...state,
    status: nextStatus,
    ...changes,
  };
}

export function reduceJetsGhostLifecycle(
  state: JetsGhostLifecycleState,
  event: JetsGhostLifecycleEvent,
): JetsGhostLifecycleState {
  if (!state.mounted) {
    if (state.status === 'unloading' && event.type === 'unload-succeeded') {
      return createInitialLifecycleState(false);
    }
    if (state.status === 'unloading' && event.type === 'unload-failed') {
      return createInitialLifecycleState(false);
    }
    return state;
  }

  if (event.type === 'unmounted') {
    return status(state, 'unloading', {
      mounted: false,
      stopRequestedDuringLoad: state.status === 'loading',
      error: null,
    });
  }

  if (event.type === 'unload-requested' && state.status !== 'unloading') {
    return status(state, 'unloading', {
      stopRequestedDuringLoad: state.status === 'loading',
      error: null,
    });
  }

  switch (state.status) {
    case 'idle':
      return event.type === 'check-requested'
        ? status(state, 'checking-capabilities', { error: null })
        : state;
    case 'checking-capabilities':
      if (event.type === 'capabilities-failed') {
        return status(state, 'unsupported', { error: event.error });
      }
      if (event.type === 'capabilities-resolved') {
        return event.report.supported
          ? status(state, 'awaiting-consent', { error: null })
          : status(state, 'unsupported', {
              error: event.report.failures[0] ?? null,
            });
      }
      return state;
    case 'unsupported':
      return event.type === 'check-requested'
        ? status(state, 'checking-capabilities', { error: null })
        : state;
    case 'awaiting-consent':
      return event.type === 'load-requested'
        ? status(state, 'loading', {
            stopRequestedDuringLoad: false,
            error: null,
          })
        : state;
    case 'loading':
      if (event.type === 'stop-requested') {
        return {
          ...state,
          stopRequestedDuringLoad: true,
        };
      }
      if (event.type === 'load-succeeded') {
        return state.stopRequestedDuringLoad
          ? status(state, 'unloading')
          : status(state, 'ready', { stopRequestedDuringLoad: false });
      }
      if (event.type === 'load-failed') {
        return state.stopRequestedDuringLoad
          ? createInitialLifecycleState()
          : status(state, 'load-error', {
              stopRequestedDuringLoad: false,
              error: event.error,
            });
      }
      return state;
    case 'load-error':
      return event.type === 'error-acknowledged'
        ? status(state, 'awaiting-consent', { error: null })
        : state;
    case 'ready':
      if (event.type === 'generation-requested') {
        return status(state, 'generating', { error: null });
      }
      return event.type === 'reset-requested'
        ? status(state, 'resetting', { error: null })
        : state;
    case 'generating':
      if (event.type === 'stop-requested') {
        return status(state, 'cancelling');
      }
      if (event.type === 'generation-succeeded') {
        return status(state, 'ready', { error: null });
      }
      return event.type === 'generation-failed'
        ? status(state, 'generation-error', { error: event.error })
        : state;
    case 'cancelling':
      if (
        event.type === 'generation-cancelled'
        || event.type === 'generation-succeeded'
      ) {
        return status(state, 'ready', { error: null });
      }
      return event.type === 'generation-failed'
        ? status(state, 'generation-error', { error: event.error })
        : state;
    case 'generation-error':
      return event.type === 'error-acknowledged'
        ? status(state, 'ready', { error: null })
        : state;
    case 'resetting':
      if (event.type === 'reset-succeeded') {
        return status(state, 'ready', { error: null });
      }
      return event.type === 'reset-failed'
        ? status(state, 'reset-error', { error: event.error })
        : state;
    case 'reset-error':
      return event.type === 'reset-requested'
        ? status(state, 'resetting', { error: null })
        : state;
    case 'unloading':
      if (event.type === 'unload-succeeded') {
        return createInitialLifecycleState();
      }
      return event.type === 'unload-failed'
        ? status(state, 'unload-error', { error: event.error })
        : state;
    case 'unload-error':
      return state;
  }
}
