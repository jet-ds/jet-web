import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Grainient from '../../../src/components/ui/Grainient';

const ogl = vi.hoisted(() => ({
  rendererFactory: vi.fn(),
  rendererRender: vi.fn(),
  rendererSetSize: vi.fn(),
  geometryRemove: vi.fn(),
  programRemove: vi.fn(),
  loseContext: vi.fn(),
  rendererError: null as Error | null,
  programUniforms: [] as Array<Record<string, { value: unknown }>>,
}));

vi.mock('ogl', () => {
  class Renderer {
    gl: {
      canvas: HTMLCanvasElement;
      drawingBufferHeight: number;
      drawingBufferWidth: number;
      getExtension: ReturnType<typeof vi.fn>;
    };

    render = ogl.rendererRender;
    setSize = ogl.rendererSetSize;

    constructor(options: unknown) {
      ogl.rendererFactory(options);
      if (ogl.rendererError) throw ogl.rendererError;
      this.gl = {
        canvas: document.createElement('canvas'),
        drawingBufferHeight: 1,
        drawingBufferWidth: 1,
        getExtension: vi.fn((name: string) =>
          name === 'WEBGL_lose_context'
            ? { loseContext: ogl.loseContext }
            : null,
        ),
      };
    }
  }

  class Triangle {
    remove = ogl.geometryRemove;

    constructor(_gl: unknown) {}
  }

  class Program {
    uniforms: Record<string, { value: unknown }>;
    remove = ogl.programRemove;

    constructor(
      _gl: unknown,
      options: { uniforms: Record<string, { value: unknown }> },
    ) {
      this.uniforms = options.uniforms;
      ogl.programUniforms.push(this.uniforms);
    }
  }

  class Mesh {
    constructor(_gl: unknown, _options: unknown) {}
  }

  return { Mesh, Program, Renderer, Triangle };
});

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];

  disconnect = vi.fn();
  observe = vi.fn();

  constructor(_callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
}

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  disconnect = vi.fn();
  observe = vi.fn();

  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }

  emit(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

function createMediaQuery(initialMatches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let matches = initialMatches;

  const mediaQuery = {
    get matches() {
      return matches;
    },
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn(
      (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') listeners.add(listener);
      },
    ),
    removeEventListener: vi.fn(
      (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') listeners.delete(listener);
      },
    ),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as MediaQueryList;

  return {
    mediaQuery,
    emit(nextMatches: boolean) {
      matches = nextMatches;
      const event = {
        matches: nextMatches,
        media: mediaQuery.media,
      } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

let documentHidden = false;
let nextRafId = 1;
let requestAnimationFrameMock: ReturnType<typeof vi.fn>;
let cancelAnimationFrameMock: ReturnType<typeof vi.fn>;
let rafCallbacks: Map<number, FrameRequestCallback>;

function installLifecycleEnvironment(initialReducedMotion: boolean) {
  const media = createMediaQuery(initialReducedMotion);
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media.mediaQuery),
  );

  return media;
}

function emitVisibility(hidden: boolean) {
  documentHidden = hidden;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

function emitIntersection(isIntersecting: boolean) {
  const observer = FakeIntersectionObserver.instances[0];
  if (!observer) throw new Error('IntersectionObserver was not created');
  act(() => observer.emit(isIntersecting));
}

function runAnimationFrame(timestamp: number) {
  const entry = rafCallbacks.entries().next().value as
    [number, FrameRequestCallback] | undefined;
  if (!entry) throw new Error('No animation frame was scheduled');
  const [id, callback] = entry;
  rafCallbacks.delete(id);
  act(() => callback(timestamp));
}

describe('Grainient reduced-motion lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ogl.rendererError = null;
    ogl.programUniforms = [];
    documentHidden = false;
    nextRafId = 1;
    rafCallbacks = new Map();
    FakeResizeObserver.instances = [];
    FakeIntersectionObserver.instances = [];
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => documentHidden,
    });
    requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
      const id = nextRafId++;
      rafCallbacks.set(id, callback);
      return id;
    });
    cancelAnimationFrameMock = vi.fn((id: number) => {
      rafCallbacks.delete(id);
    });
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock);
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates no renderer resources for initial reduced motion and recreates them once per eligible preference cycle', () => {
    const media = installLifecycleEnvironment(true);
    const view = render(<Grainient />);

    expect(ogl.rendererFactory).toHaveBeenCalledTimes(0);
    expect(FakeResizeObserver.instances).toHaveLength(0);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(0);
    expect(ogl.geometryRemove).toHaveBeenCalledTimes(0);
    expect(ogl.programRemove).toHaveBeenCalledTimes(0);
    expect(ogl.loseContext).toHaveBeenCalledTimes(0);
    expect(FakeIntersectionObserver.instances[0]?.options).toEqual({
      root: null,
      threshold: 0.01,
    });

    act(() => media.emit(false));

    expect(ogl.rendererFactory).toHaveBeenCalledTimes(0);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(0);

    emitIntersection(true);

    expect(ogl.rendererFactory).toHaveBeenCalledTimes(1);
    expect(FakeResizeObserver.instances).toHaveLength(1);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);

    act(() => media.emit(false));
    expect(ogl.rendererFactory).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);

    act(() => media.emit(true));

    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(1);
    expect(FakeResizeObserver.instances[0]?.disconnect).toHaveBeenCalledTimes(
      1,
    );
    expect(ogl.geometryRemove).toHaveBeenCalledTimes(1);
    expect(ogl.programRemove).toHaveBeenCalledTimes(1);
    expect(ogl.loseContext).toHaveBeenCalledTimes(1);
    expect(ogl.rendererFactory).toHaveBeenCalledTimes(1);

    act(() => media.emit(true));
    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(1);
    expect(ogl.geometryRemove).toHaveBeenCalledTimes(1);
    expect(ogl.programRemove).toHaveBeenCalledTimes(1);
    expect(ogl.loseContext).toHaveBeenCalledTimes(1);

    act(() => media.emit(false));

    expect(ogl.rendererFactory).toHaveBeenCalledTimes(2);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(2);

    view.unmount();

    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(2);
    expect(ogl.geometryRemove).toHaveBeenCalledTimes(2);
    expect(ogl.programRemove).toHaveBeenCalledTimes(2);
    expect(ogl.loseContext).toHaveBeenCalledTimes(2);
    expect(FakeResizeObserver.instances[1]?.disconnect).toHaveBeenCalledTimes(
      1,
    );
    expect(
      FakeIntersectionObserver.instances[0]?.disconnect,
    ).toHaveBeenCalledTimes(1);
    expect(media.mediaQuery.removeEventListener).toHaveBeenCalledTimes(1);
    expect(media.mediaQuery.removeEventListener).toHaveBeenCalledWith(
      'change',
      (media.mediaQuery.addEventListener as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[1],
    );

    act(() => {
      media.emit(true);
      media.emit(false);
      document.dispatchEvent(new Event('visibilitychange'));
      FakeIntersectionObserver.instances[0]?.emit(false);
      FakeIntersectionObserver.instances[0]?.emit(true);
    });

    expect(ogl.rendererFactory).toHaveBeenCalledTimes(2);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(2);
    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(2);
    expect(FakeResizeObserver.instances).toHaveLength(2);
    expect(FakeIntersectionObserver.instances).toHaveLength(1);
    expect(ogl.geometryRemove).toHaveBeenCalledTimes(2);
    expect(ogl.programRemove).toHaveBeenCalledTimes(2);
    expect(ogl.loseContext).toHaveBeenCalledTimes(2);
  });

  it('stops and restarts the existing renderer across document visibility without disposing it', () => {
    installLifecycleEnvironment(false);
    const view = render(<Grainient />);

    expect(ogl.rendererFactory).toHaveBeenCalledTimes(0);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(0);

    emitIntersection(true);

    expect(ogl.rendererFactory).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);

    emitVisibility(true);
    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(1);
    expect(ogl.loseContext).toHaveBeenCalledTimes(0);

    emitVisibility(false);
    expect(ogl.rendererFactory).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(2);

    view.unmount();
    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(2);
    expect(ogl.loseContext).toHaveBeenCalledTimes(1);
  });

  it('defers recreation while offscreen and restarts only when viewport eligibility returns', () => {
    const media = installLifecycleEnvironment(false);
    const view = render(<Grainient />);

    expect(ogl.rendererFactory).toHaveBeenCalledTimes(0);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(0);

    emitIntersection(true);

    expect(ogl.rendererFactory).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);

    emitIntersection(false);
    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(1);
    expect(ogl.loseContext).toHaveBeenCalledTimes(0);

    act(() => media.emit(true));
    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(1);
    expect(ogl.loseContext).toHaveBeenCalledTimes(1);

    act(() => media.emit(false));
    expect(ogl.rendererFactory).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);

    emitIntersection(true);
    expect(ogl.rendererFactory).toHaveBeenCalledTimes(2);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(2);

    view.unmount();
    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(2);
    expect(ogl.loseContext).toHaveBeenCalledTimes(2);
  });

  it('waits for both document and viewport eligibility after reduced motion is disabled', () => {
    documentHidden = true;
    const media = installLifecycleEnvironment(true);
    const view = render(<Grainient />);

    emitIntersection(false);
    act(() => media.emit(false));
    expect(ogl.rendererFactory).toHaveBeenCalledTimes(0);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(0);

    emitVisibility(false);
    expect(ogl.rendererFactory).toHaveBeenCalledTimes(0);

    emitIntersection(true);
    expect(ogl.rendererFactory).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(1);
    expect(ogl.loseContext).toHaveBeenCalledTimes(1);
  });

  it('preserves the 24fps cadence and excludes hidden time from elapsed animation time', () => {
    installLifecycleEnvironment(false);
    const view = render(<Grainient />);

    emitIntersection(true);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);

    runAnimationFrame(100);
    expect(ogl.rendererRender).toHaveBeenCalledTimes(1);
    expect(ogl.programUniforms[0]?.iTime.value).toBe(0);

    runAnimationFrame(120);
    expect(ogl.rendererRender).toHaveBeenCalledTimes(1);

    runAnimationFrame(150);
    expect(ogl.rendererRender).toHaveBeenCalledTimes(2);
    expect(ogl.programUniforms[0]?.iTime.value).toBeCloseTo(0.05);

    emitVisibility(true);
    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(1);
    expect(rafCallbacks.size).toBe(0);

    emitVisibility(false);
    runAnimationFrame(1_000);
    expect(ogl.rendererRender).toHaveBeenCalledTimes(3);
    expect(ogl.programUniforms[0]?.iTime.value).toBeCloseTo(0.05);

    runAnimationFrame(1_020);
    expect(ogl.rendererRender).toHaveBeenCalledTimes(3);

    view.unmount();
    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the plain fallback and cleans lifecycle observers after WebGL construction fails', () => {
    ogl.rendererError = new Error('WebGL2 unavailable');
    const media = installLifecycleEnvironment(false);
    const view = render(<Grainient />);

    expect(ogl.rendererFactory).toHaveBeenCalledTimes(0);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(0);

    emitIntersection(true);

    expect(ogl.rendererFactory).toHaveBeenCalledTimes(1);
    expect(view.container).toBeEmptyDOMElement();
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(0);
    expect(FakeResizeObserver.instances).toHaveLength(0);
    expect(ogl.geometryRemove).toHaveBeenCalledTimes(0);
    expect(ogl.programRemove).toHaveBeenCalledTimes(0);
    expect(ogl.loseContext).toHaveBeenCalledTimes(0);

    view.unmount();
    expect(
      FakeIntersectionObserver.instances[0]?.disconnect,
    ).toHaveBeenCalledTimes(1);
    expect(media.mediaQuery.removeEventListener).toHaveBeenCalledTimes(1);

    act(() => {
      media.emit(true);
      media.emit(false);
      FakeIntersectionObserver.instances[0]?.emit(true);
    });
    expect(ogl.rendererFactory).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(0);
  });
});
