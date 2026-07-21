import { describe, expect, it } from 'vitest';
import {
  getGrainientRendererAction,
  shouldRunGrainient,
  type GrainientRendererSnapshot,
  type GrainientRendererConditions,
} from '../../../src/utils/grainientLifecycle';

describe('Grainient lifecycle', () => {
  it.each([
    [{ documentHidden: true, inViewport: true, reducedMotion: false }, false],
    [{ documentHidden: false, inViewport: false, reducedMotion: false }, false],
    [{ documentHidden: false, inViewport: true, reducedMotion: true }, false],
    [{ documentHidden: false, inViewport: true, reducedMotion: false }, true],
  ] as const)('returns the expected loop state', (state, expected) => {
    expect(shouldRunGrainient(state)).toBe(expected);
  });

  const eligible: GrainientRendererConditions = {
    mounted: true,
    documentHidden: false,
    inViewport: true,
    reducedMotion: false,
  };
  const absent: GrainientRendererSnapshot = {
    rendererInitialized: false,
    loopRunning: false,
  };
  const running: GrainientRendererSnapshot = {
    rendererInitialized: true,
    loopRunning: true,
  };
  const stopped: GrainientRendererSnapshot = {
    rendererInitialized: true,
    loopRunning: false,
  };

  it.each([
    ['the initial eligible state', null, eligible],
    ['reduce to no-preference while eligible', absent, eligible],
    ['becoming visible with no renderer', absent, eligible],
    ['becoming onscreen with no renderer', absent, eligible],
  ] as const)('initializes for %s', (_label, previous, next) => {
    expect(getGrainientRendererAction(previous, next)).toBe('initialize');
  });

  it.each([
    [
      'the initial reduced-motion state',
      null,
      { ...eligible, reducedMotion: true },
    ],
    ['the initial hidden state', null, { ...eligible, documentHidden: true }],
    ['the initial offscreen state', null, { ...eligible, inViewport: false }],
    [
      'reduce to no-preference while hidden',
      absent,
      { ...eligible, documentHidden: true },
    ],
    [
      'reduce to no-preference while offscreen',
      absent,
      { ...eligible, inViewport: false },
    ],
    [
      'a reduced, hidden, offscreen combination',
      absent,
      {
        ...eligible,
        documentHidden: true,
        inViewport: false,
        reducedMotion: true,
      },
    ],
  ] as const)('does nothing for %s', (_label, previous, next) => {
    expect(getGrainientRendererAction(previous, next)).toBe('none');
  });

  it.each([
    [
      'no-preference to reduce while running',
      running,
      { ...eligible, reducedMotion: true },
    ],
    [
      'no-preference to reduce while stopped',
      stopped,
      { ...eligible, reducedMotion: true },
    ],
    ['unmount while running', running, { ...eligible, mounted: false }],
    ['unmount while stopped', stopped, { ...eligible, mounted: false }],
  ] as const)('disposes for %s', (_label, previous, next) => {
    expect(getGrainientRendererAction(previous, next)).toBe('dispose');
  });

  it.each([
    ['a document becoming hidden', { ...eligible, documentHidden: true }],
    ['the component moving offscreen', { ...eligible, inViewport: false }],
  ] as const)('stops the loop for %s', (_label, next) => {
    expect(getGrainientRendererAction(running, next)).toBe('stop-loop');
  });

  it.each([
    ['a document becoming visible', eligible],
    ['the component moving onscreen', eligible],
  ] as const)('starts the existing renderer for %s', (_label, next) => {
    expect(getGrainientRendererAction(stopped, next)).toBe('start-loop');
  });

  it('leaves an eligible running renderer alone', () => {
    expect(getGrainientRendererAction(running, eligible)).toBe('none');
  });
});
