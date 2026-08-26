import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DepthCarousel from '../../../src/features/depth-carousel/DepthCarousel';
import type { DepthCarouselItem } from '../../../src/features/depth-carousel/types';

function inventedItems(
  count: number,
  kind: DepthCarouselItem['kind'] = 'blog',
): DepthCarouselItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `invented-${index + 1}`,
    href: `/${kind === 'blog' ? 'blog' : 'works'}/invented-${index + 1}/`,
    kind,
    title: `Invented item ${index + 1}`,
    summary: `Complete invented summary ${index + 1}.`,
    image: {
      url: `https://example.public.blob.vercel-storage.com/images/blog/invented-${index + 1}-12345678.jpg`,
      alt: `Invented scene ${index + 1}`,
      width: 1920 as const,
      height: 1080 as const,
    },
    date: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    facts: [`January ${index + 1}, 2026`, `${index + 1} min read`],
  }));
}

function installMotionPreference(
  reducedMotion: boolean,
  desktopLayout = false,
) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches:
      ((query === '(prefers-reduced-motion)' ||
        query === '(prefers-reduced-motion: reduce)') &&
        reducedMotion) ||
      (query === '(min-width: 48rem)' && desktopLayout),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  }));
}

function installResizeObserver() {
  class ResizeObserverFixture implements ResizeObserver {
    disconnect() {}

    observe() {}

    unobserve() {}
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverFixture);
}

function renderWithFallback(
  items: readonly DepthCarouselItem[],
  focusedFallbackIndex?: number,
) {
  const host = document.createElement('div');
  host.setAttribute('data-home-collection-carousel', '');

  const fallback = document.createElement('div');
  fallback.setAttribute('data-carousel-fallback', '');
  const fallbackLinks = items.map((item, index) => {
    const link = document.createElement('a');
    link.href = item.href;
    link.textContent = `Static collection destination ${index + 1}`;
    fallback.append(link);
    return link;
  });
  const fallbackLink = fallbackLinks[0];

  const mount = document.createElement('div');
  host.append(fallback, mount);
  document.body.append(host);
  if (focusedFallbackIndex !== undefined) {
    fallbackLinks[focusedFallbackIndex]?.focus();
  }

  const rendered = render(
    <DepthCarousel label="Invented articles" items={items} />,
    { container: mount },
  );

  return { ...rendered, fallback, fallbackLink, host };
}

describe('DepthCarousel', () => {
  beforeEach(() => {
    installMotionPreference(false);
    installResizeObserver();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('server-renders one inert sentinel without a second collection', () => {
    const markup = renderToString(
      <DepthCarousel label="Invented articles" items={inventedItems(3)} />,
    );

    expect(markup).toContain('data-carousel-sentinel');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('inert=""');
    expect(markup).not.toContain('role="region"');
    expect(markup).not.toContain('/blog/invented-1/');
    expect(markup).not.toContain('Invented item 1');
  });

  it('keeps the complete active Blog content inside its one canonical destination', () => {
    render(
      <DepthCarousel label="Invented articles" items={inventedItems(3)} />,
    );

    const destination = screen.getByRole('link');
    expect(destination).toHaveAttribute('href', '/blog/invented-1/');
    expect(
      within(destination).getByRole('heading', { name: 'Invented item 1' }),
    ).toBeInTheDocument();
    expect(
      within(destination).getByText('Complete invented summary 1.'),
    ).toBeInTheDocument();
    expect(
      within(destination).getByText('January 1, 2026'),
    ).toBeInTheDocument();
    expect(within(destination).getByText('1 min read')).toBeInTheDocument();
  });

  it('keeps Work type, title, summary, and facts inside its active destination', () => {
    render(
      <DepthCarousel
        label="Invented works"
        items={inventedItems(3, 'research')}
      />,
    );

    const destination = screen.getByRole('link');
    expect(within(destination).getByText('Research')).toBeInTheDocument();
    expect(
      within(destination).getByRole('heading', { name: 'Invented item 1' }),
    ).toBeInTheDocument();
    expect(
      within(destination).getByText('Complete invented summary 1.'),
    ).toBeInTheDocument();
    expect(
      within(destination).getByText('January 1, 2026'),
    ).toBeInTheDocument();
  });

  it('wraps previous and next controls and announces the dynamic position', () => {
    render(
      <DepthCarousel label="Invented articles" items={inventedItems(3)} />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Item 1 of 3');
    fireEvent.click(
      screen.getByRole('button', { name: 'Previous invented articles item' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Item 3 of 3');
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/blog/invented-3/',
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Next invented articles item' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Item 1 of 3');
  });

  it('owns arrow navigation only while focus is inside the carousel', () => {
    render(<DepthCarousel label="Invented works" items={inventedItems(3)} />);
    const activeLink = screen.getByRole('link');

    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.getByRole('status')).toHaveTextContent('Item 1 of 3');

    activeLink.focus();
    fireEvent.keyDown(activeLink, { key: 'ArrowRight' });
    expect(screen.getByRole('status')).toHaveTextContent('Item 2 of 3');
    fireEvent.keyDown(screen.getByRole('link'), { key: 'ArrowLeft' });
    expect(screen.getByRole('status')).toHaveTextContent('Item 1 of 3');
  });

  it('moves focus to the active destination when ArrowRight promotes the focused receded card', () => {
    render(
      <DepthCarousel label="Invented articles" items={inventedItems(5)} />,
    );
    const receded = screen.getByRole('button', {
      name: 'Bring item 2 of 5 forward',
    });

    receded.focus();
    fireEvent.keyDown(receded, { key: 'ArrowRight' });

    expect(screen.getByRole('status')).toHaveTextContent('Item 2 of 5');
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/blog/invented-2/',
    );
    expect(screen.getByRole('link')).toHaveFocus();
  });

  it('moves focus to the new active destination after an opposite Arrow from the deepest receded card', () => {
    render(
      <DepthCarousel label="Invented articles" items={inventedItems(5)} />,
    );
    const deepestReceded = screen.getByRole('button', {
      name: 'Bring item 4 of 5 forward',
    });

    deepestReceded.focus();
    fireEvent.keyDown(deepestReceded, { key: 'ArrowLeft' });

    expect(screen.getByRole('status')).toHaveTextContent('Item 5 of 5');
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/blog/invented-5/',
    );
    expect(screen.getByRole('link')).toHaveFocus();
  });

  it('keeps one active destination while receded selection and indicators use the real five-item total', () => {
    render(
      <DepthCarousel label="Invented articles" items={inventedItems(5)} />,
    );

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: /Go to item \d of 5/u }),
    ).toHaveLength(5);

    const layerIds = screen
      .getByRole('region', { name: 'Invented articles' })
      .querySelectorAll('[data-carousel-layer-item]');
    const uniqueLayerIds = new Set(
      [...layerIds].map((element) =>
        element.getAttribute('data-carousel-layer-item'),
      ),
    );
    expect(uniqueLayerIds.size).toBe(layerIds.length);

    fireEvent.click(
      screen.getByRole('button', { name: 'Bring item 3 of 5 forward' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Item 3 of 5');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/blog/invented-3/',
    );
  });

  it('renders images only for the unique seven-position desktop ring', () => {
    installMotionPreference(false, true);
    const items = inventedItems(9);
    const { container } = render(
      <DepthCarousel label="Invented articles" items={items} />,
    );

    const visibleLayers = container.querySelectorAll(
      '[data-carousel-layer-item][data-carousel-visible="true"]',
    );
    expect(visibleLayers).toHaveLength(7);
    expect(container.querySelectorAll('img')).toHaveLength(7);
    expect(
      new Set(
        [...visibleLayers].map((element) =>
          element.getAttribute('data-carousel-layer-item'),
        ),
      ).size,
    ).toBe(7);
    for (const hiddenLayer of container.querySelectorAll(
      '[data-carousel-layer-item]:not([data-carousel-visible="true"])',
    )) {
      expect(hiddenLayer.querySelector('img')).toBeNull();
    }

    fireEvent.click(
      screen.getByRole('button', { name: 'Next invented articles item' }),
    );
    expect(container.querySelectorAll('img')).toHaveLength(7);
  });

  it('moves keyboard focus from a promoted receded card to its active destination', () => {
    render(
      <DepthCarousel label="Invented articles" items={inventedItems(5)} />,
    );
    const receded = screen.getByRole('button', {
      name: 'Bring item 3 of 5 forward',
    });

    receded.focus();
    fireEvent.click(receded, { detail: 0 });

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/blog/invented-3/',
    );
    expect(screen.getByRole('link')).toHaveFocus();
  });

  it('omits navigation controls for a one-item collection', () => {
    render(
      <DepthCarousel label="One invented work" items={inventedItems(1)} />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Item 1 of 1');
    expect(
      screen.queryByRole('button', { name: /item/u }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/blog/invented-1/',
    );
  });

  it('does not mount an interactive stage for an empty collection', () => {
    render(<DepthCarousel label="Empty invented works" items={[]} />);

    expect(
      screen.queryByRole('region', { name: 'Empty invented works' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('hands off one accessible collection after commit and restores the fallback on teardown', async () => {
    const { fallback, fallbackLink, unmount } = renderWithFallback(
      inventedItems(3),
    );

    await waitFor(() => expect(fallback).toHaveAttribute('hidden'));
    expect(fallback).toHaveAttribute('inert');
    expect(fallback).toHaveAttribute('aria-hidden', 'true');
    expect(fallbackLink).not.toBeVisible();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link')).not.toHaveFocus();

    unmount();
    expect(fallback).not.toHaveAttribute('hidden');
    expect(fallback).not.toHaveAttribute('inert');
    expect(fallback).not.toHaveAttribute('aria-hidden');
    expect(fallbackLink).toBeVisible();
  });

  it('transfers a focused fallback destination to the matching enhanced destination after handoff', async () => {
    const { fallback } = renderWithFallback(inventedItems(3), 1);

    await waitFor(() => expect(fallback).toHaveAttribute('hidden'));

    expect(screen.getByRole('status')).toHaveTextContent('Item 2 of 3');
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/blog/invented-2/',
    );
    expect(screen.getByRole('link')).toHaveFocus();
  });

  it('restores the fallback when a later enhanced render fails', async () => {
    const items = inventedItems(3);
    Object.defineProperty(items[1].image, 'alt', {
      configurable: true,
      get: () => {
        throw new Error('Invented later render failure');
      },
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { fallback, fallbackLink } = renderWithFallback(items);
    await waitFor(() => expect(fallback).toHaveAttribute('hidden'));

    fireEvent.click(
      screen.getByRole('button', { name: 'Next invented articles item' }),
    );

    await waitFor(() => expect(fallback).not.toHaveAttribute('hidden'));
    expect(fallback).not.toHaveAttribute('inert');
    expect(fallback).not.toHaveAttribute('aria-hidden');
    expect(fallbackLink).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Invented articles' }),
    ).not.toBeInTheDocument();
  });

  it('mounts and cleans up without console or hydration warnings', () => {
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const warning = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const { unmount } = renderWithFallback(inventedItems(3));
    unmount();

    expect(error).not.toHaveBeenCalled();
    expect(warning).not.toHaveBeenCalled();
  });
});
