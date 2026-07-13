export interface GrainientLifecycleState {
  documentHidden: boolean;
  inViewport: boolean;
  reducedMotion: boolean;
}

export interface GrainientRendererConditions extends GrainientLifecycleState {
  mounted: boolean;
}

export interface GrainientRendererSnapshot {
  rendererInitialized: boolean;
  loopRunning: boolean;
}

export type GrainientRendererAction =
  | 'initialize'
  | 'start-loop'
  | 'stop-loop'
  | 'dispose'
  | 'none';

export function shouldRunGrainient(state: GrainientLifecycleState): boolean {
  return !state.documentHidden && state.inViewport && !state.reducedMotion;
}

export function getGrainientRendererAction(
  previous: GrainientRendererSnapshot | null,
  next: GrainientRendererConditions,
): GrainientRendererAction {
  const rendererInitialized = previous?.rendererInitialized ?? false;
  const loopRunning = previous?.loopRunning ?? false;

  if (!next.mounted || next.reducedMotion) {
    return rendererInitialized ? 'dispose' : 'none';
  }

  if (!shouldRunGrainient(next)) {
    return loopRunning ? 'stop-loop' : 'none';
  }

  if (!rendererInitialized) {
    return 'initialize';
  }

  if (!loopRunning) {
    return 'start-loop';
  }

  return 'none';
}
