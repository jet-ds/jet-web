import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installArticleTocController } from '../../../src/features/article-toc/articleTocController';

interface ObservedEntry {
  target: Element;
  isIntersecting: boolean;
}

function setHeadingPosition(
  heading: HTMLElement,
  { top, height }: { top: number; height: number },
) {
  vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue({
    bottom: top + height,
    height,
    left: 0,
    right: 0,
    toJSON: () => ({}),
    top,
    width: 320,
    x: 0,
    y: top,
  });
}

class TestIntersectionObserver {
  static instances: TestIntersectionObserver[] = [];

  readonly observed = new Set<Element>();
  readonly disconnect = vi.fn(() => this.observed.clear());

  constructor(private readonly callback: IntersectionObserverCallback) {
    TestIntersectionObserver.instances.push(this);
  }

  observe = vi.fn((element: Element) => this.observed.add(element));
  unobserve = vi.fn((element: Element) => this.observed.delete(element));
  takeRecords = vi.fn(() => []);

  emit(entries: ObservedEntry[]) {
    this.callback(entries as IntersectionObserverEntry[], this as never);
  }

  get root() {
    return null;
  }

  get rootMargin() {
    return '-100px 0px -66%';
  }

  get thresholds() {
    return [1];
  }
}

function renderArticleNavigation() {
  document.body.innerHTML = `
    <article data-article-toc-content>
      <h2 id="represented-first">First section</h2>
      <h2 id="unrepresented">Unrepresented section</h2>
      <h3 id="represented-second">Second section</h3>
    </article>
    <aside data-article-toc>
      <a href="#represented-first">First section</a>
      <a href="#represented-second">Second section</a>
    </aside>
    <section data-article-toc>
      <button
        type="button"
        data-article-toc-toggle
        aria-controls="article-toc-mobile-panel"
        aria-expanded="false"
      >
        On this page: <span data-article-toc-current>First section</span>
      </button>
      <div id="article-toc-mobile-panel" data-article-toc-panel hidden>
        <a href="#represented-first">First section</a>
        <a href="#represented-second">Second section</a>
      </div>
    </section>
  `;
}

beforeEach(() => {
  TestIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
  renderArticleNavigation();
});

describe('installArticleTocController', () => {
  it('shares the represented active section across both navigation views and closes the mobile disclosure after selection', () => {
    const cleanup = installArticleTocController(document);
    const observer = TestIntersectionObserver.instances[0];
    const first = document.querySelector('#represented-first')!;
    const second = document.querySelector('#represented-second')!;

    expect(TestIntersectionObserver.instances).toHaveLength(1);
    expect([...observer.observed]).toEqual([first, second]);

    observer.emit([{ target: second, isIntersecting: true }]);

    const links = [
      ...document.querySelectorAll<HTMLAnchorElement>(
        '[data-article-toc] a[href="#represented-second"]',
      ),
    ];
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveClass('active');
      expect(link).toHaveAttribute('aria-current', 'location');
    }
    expect(
      document.querySelector('[data-article-toc-current]'),
    ).toHaveTextContent('Second section');

    const toggle = document.querySelector<HTMLButtonElement>(
      '[data-article-toc-toggle]',
    )!;
    const panel = document.querySelector<HTMLElement>(
      '[data-article-toc-panel]',
    )!;
    toggle.click();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(panel.hidden).toBe(false);

    links[1].click();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(second);

    cleanup();
  });

  it('replaces its observer and event handlers on direct reinstallation and astro page loads', () => {
    const firstCleanup = installArticleTocController(document);
    const firstObserver = TestIntersectionObserver.instances[0];
    const secondCleanup = installArticleTocController(document);
    const secondObserver = TestIntersectionObserver.instances[1];

    expect(firstObserver.disconnect).toHaveBeenCalledOnce();
    expect(TestIntersectionObserver.instances).toHaveLength(2);

    document.dispatchEvent(new Event('astro:page-load'));
    const thirdObserver = TestIntersectionObserver.instances[2];
    expect(secondObserver.disconnect).toHaveBeenCalledOnce();
    expect(TestIntersectionObserver.instances).toHaveLength(3);

    const toggle = document.querySelector<HTMLButtonElement>(
      '[data-article-toc-toggle]',
    )!;
    toggle.click();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    document.dispatchEvent(new Event('astro:page-load'));
    expect(thirdObserver.disconnect).toHaveBeenCalledOnce();
    expect(TestIntersectionObserver.instances).toHaveLength(4);

    firstCleanup();
    secondCleanup();
  });

  it('selects a represented section from its leading viewport position even when the heading is taller than the viewport', () => {
    const cleanup = installArticleTocController(document);
    const first = document.querySelector<HTMLElement>('#represented-first')!;
    const second = document.querySelector<HTMLElement>('#represented-second')!;
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 390,
    });
    setHeadingPosition(first, { top: -80, height: 32 });
    setHeadingPosition(second, { top: 110, height: 460 });

    window.dispatchEvent(new Event('scroll'));

    for (const link of document.querySelectorAll<HTMLAnchorElement>(
      '[data-article-toc] a[href="#represented-second"]',
    ))
      expect(link).toHaveAttribute('aria-current', 'location');
    expect(
      document.querySelector('[data-article-toc-current]'),
    ).toHaveTextContent('Second section');

    cleanup();
  });
});
