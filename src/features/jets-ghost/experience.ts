export type JetsGhostLifecycle =
  | 'idle'
  | 'checking'
  | 'compatible'
  | 'loading'
  | 'ready'
  | 'generating';

export type GhostAnimationMode =
  | 'idle'
  | 'scanning'
  | 'loading'
  | 'ready'
  | 'thinking';

export type ComposerActionTone = 'accent' | 'neutral' | 'stop';

export function getComposerActionTone(
  isGenerating: boolean,
  canSend: boolean,
): ComposerActionTone {
  if (isGenerating) return 'stop';
  return canSend ? 'accent' : 'neutral';
}

export function getGhostAnimationMode(
  lifecycle: JetsGhostLifecycle,
): GhostAnimationMode {
  switch (lifecycle) {
    case 'idle':
      return 'idle';
    case 'checking':
      return 'scanning';
    case 'compatible':
    case 'ready':
      return 'ready';
    case 'loading':
      return 'loading';
    case 'generating':
      return 'thinking';
  }
}

export function getLoadingStage(progress: number): string {
  if (progress < 20) return 'Waking the ghost';
  if (progress < 82) return 'Feeding it ones and zeroes';
  if (progress < 96) return "Haunting Jet's archive";
  return 'Ready for questions';
}

export type JetsGhostExperienceEvent =
  | { type: 'check-compatibility' }
  | { type: 'compatibility-passed' }
  | { type: 'load-model' }
  | { type: 'set-progress'; progress: number }
  | { type: 'model-ready' }
  | { type: 'send-message' }
  | { type: 'generation-finished' }
  | { type: 'stop-generation' }
  | { type: 'new-session' }
  | { type: 'unload' };

export interface JetsGhostExperienceState {
  lifecycle: JetsGhostLifecycle;
  hasActivatedModel: boolean;
  progress: number;
}

export function createInitialExperience(): JetsGhostExperienceState {
  return {
    lifecycle: 'idle',
    hasActivatedModel: false,
    progress: 0,
  };
}

export function transitionExperience(
  state: JetsGhostExperienceState,
  event: JetsGhostExperienceEvent,
): JetsGhostExperienceState {
  if (event.type === 'unload') {
    return createInitialExperience();
  }

  switch (state.lifecycle) {
    case 'idle':
      return event.type === 'check-compatibility'
        ? { ...state, lifecycle: 'checking' }
        : state;
    case 'checking':
      return event.type === 'compatibility-passed'
        ? { ...state, lifecycle: 'compatible' }
        : state;
    case 'compatible':
      return event.type === 'load-model'
        ? {
            lifecycle: 'loading',
            hasActivatedModel: true,
            progress: 6,
          }
        : state;
    case 'loading':
      if (event.type === 'set-progress') {
        return {
          ...state,
          progress: Math.max(0, Math.min(100, event.progress)),
        };
      }

      return event.type === 'model-ready'
        ? { ...state, lifecycle: 'ready', progress: 100 }
        : state;
    case 'ready':
      if (event.type === 'send-message') {
        return { ...state, lifecycle: 'generating' };
      }

      return event.type === 'new-session'
        ? { ...state, lifecycle: 'ready' }
        : state;
    case 'generating':
      return event.type === 'generation-finished' || event.type === 'stop-generation'
        ? { ...state, lifecycle: 'ready' }
        : state;
  }
}
