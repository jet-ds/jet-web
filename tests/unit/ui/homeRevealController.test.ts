import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installHomeRevealController } from '../../../src/features/home-reveal/homeRevealController';

interface ObservedEntry {
  target: Element;
  isIntersecting: boolean;
}

class TestIntersectionObserver {
  static instances: TestIntersectionObserver[] = [];

  readonly observed = new Set<Element>();
  readonly disconnect = vi.fn(() => this.observed.clear());
  readonly unobserve = vi.fn((element: Element) =>
    this.observed.delete(element),
  );

  constructor(private readonly callback: IntersectionObserverCallback) {
    TestIntersectionObserver.instances.push(this);
  }

  observe = vi.fn((element: Element) => this.observed.add(element));
  takeRecords = vi.fn(() => []);

  emit(entries: ObservedEntry[]) {
    this.callback(entries as IntersectionObserverEntry[], this as never);
  }

  get root() {
    return null;
  }

  get rootMargin() {
    return '0px 0px -10%';
  }

  get thresholds() {
    return [0.12];
  }
}

function setTop(element: HTMLElement, top: number) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    bottom: top + 100,
    height: 100,
    left: 0,
    right: 320,
    toJSON: () => ({}),
    top,
    width: 320,
    x: 0,
    y: top,
  });
}

function renderTargets() {
  document.body.innerHTML = `
    <main data-home-reveal-scope>
      <div id="visible" data-home-reveal="text">Visible target</div>
      <div id="offscreen" data-home-reveal="component">Offscreen target</div>
    </main>
    <footer><p id="footer-copy">Footer copy</p></footer>
  `;
  const visible = document.querySelector<HTMLElement>('#visible')!;
  const offscreen = document.querySelector<HTMLElement>('#offscreen')!;
  setTop(visible, 120);
  setTop(offscreen, 900);
  return { visible, offscreen };
}

function setReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  TestIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
  setReducedMotion(false);
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 700,
  });
});

describe('installHomeRevealController', () => {
  it('only makes offscreen homepage targets pending and reveals each once', () => {
    const { visible, offscreen } = renderTargets();
    const cleanup = installHomeRevealController(document);
    const observer = TestIntersectionObserver.instances[0];

    expect(visible).toHaveAttribute('data-home-reveal-state', 'revealed');
    expect(offscreen).toHaveAttribute('data-home-reveal-state', 'pending');
    expect([...observer.observed]).toEqual([offscreen]);
    expect(document.querySelector('footer [data-home-reveal]')).toBeNull();

    observer.emit([{ target: offscreen, isIntersecting: true }]);

    expect(offscreen).toHaveAttribute('data-home-reveal-state', 'revealed');
    expect(observer.unobserve).toHaveBeenCalledWith(offscreen);
    cleanup();
  });

  it('shows final state without observing when reduced motion is requested', () => {
    setReducedMotion(true);
    const { visible, offscreen } = renderTargets();
    const cleanup = installHomeRevealController(document);

    expect(visible).toHaveAttribute('data-home-reveal-state', 'revealed');
    expect(offscreen).toHaveAttribute('data-home-reveal-state', 'revealed');
    expect(TestIntersectionObserver.instances).toHaveLength(0);
    cleanup();
  });

  it('disconnects stale observers on reinstall and Astro page loads', () => {
    renderTargets();
    const firstCleanup = installHomeRevealController(document);
    const firstObserver = TestIntersectionObserver.instances[0];
    const secondCleanup = installHomeRevealController(document);
    const secondObserver = TestIntersectionObserver.instances[1];

    expect(firstObserver.disconnect).toHaveBeenCalledOnce();
    document.dispatchEvent(new Event('astro:page-load'));
    expect(secondObserver.disconnect).toHaveBeenCalledOnce();
    expect(TestIntersectionObserver.instances).toHaveLength(3);

    firstCleanup();
    secondCleanup();
  });
});
