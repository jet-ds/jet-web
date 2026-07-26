import type { PropsWithChildren } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LiquidGlassDock from '../../../src/components/navigation/LiquidGlassDock';

const media = vi.hoisted(() => ({
  compact: true,
  listeners: new Set<() => void>(),
}));

vi.mock('../../../src/hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light' as const, toggleTheme: vi.fn() }),
}));

vi.mock('../../../src/components/navigation/GlassSurface', () => ({
  default: ({
    children,
    className,
  }: PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}));

function setCompact(compact: boolean) {
  act(() => {
    media.compact = compact;
    for (const listener of media.listeners) listener();
  });
}

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value });
}

function renderDock({
  path = '/blog/',
  immersive = false,
}: {
  path?: string;
  immersive?: boolean;
} = {}) {
  return render(<LiquidGlassDock currentPath={path} immersive={immersive} />);
}

function dock() {
  const navigation = document.querySelector('#site-navigation-dock');
  if (!(navigation instanceof HTMLElement))
    throw new Error('Dock was not rendered');
  return navigation;
}

describe('LiquidGlassDock', () => {
  beforeEach(() => {
    media.compact = true;
    media.listeners.clear();
    sessionStorage.clear();
    setScrollY(0);
    vi.stubGlobal('matchMedia', (query: string) => ({
      media: query,
      get matches() {
        return media.compact;
      },
      addEventListener: (_: string, listener: () => void) =>
        media.listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) =>
        media.listeners.delete(listener),
      addListener: (listener: () => void) => media.listeners.add(listener),
      removeListener: (listener: () => void) =>
        media.listeners.delete(listener),
      dispatchEvent: () => true,
    }));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 64,
      height: 48,
      left: 16,
      right: 64,
      top: 16,
      width: 48,
      x: 16,
      y: 16,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps an ordinary compact dock open until document scroll discovers it', () => {
    renderDock();

    expect(
      screen.queryByRole('button', { name: 'Open navigation' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Close navigation' }),
    ).not.toBeInTheDocument();
    expect(dock()).not.toHaveAttribute('inert');

    setScrollY(160);
    fireEvent.scroll(window);

    expect(
      screen.getByRole('button', { name: 'Open navigation' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(dock()).toHaveAttribute('inert');
    expect(dock()).toHaveAttribute('aria-hidden', 'true');
  });

  it('discovers an immersive compact dock immediately and retains that discovery for an ordinary remount', () => {
    const mounted = renderDock({ immersive: true });

    expect(
      screen.getByRole('button', { name: 'Close navigation' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(dock()).not.toHaveAttribute('inert');

    mounted.unmount();
    renderDock();

    expect(
      screen.getByRole('button', { name: 'Close navigation' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('preserves an explicit compact choice through remounts and restores its route-appropriate default after session clearing', () => {
    const mounted = renderDock({ immersive: true });
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));

    expect(
      screen.getByRole('button', { name: 'Open navigation' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(dock()).toHaveAttribute('inert');

    mounted.unmount();
    renderDock({ immersive: true });
    expect(
      screen.getByRole('button', { name: 'Open navigation' }),
    ).toHaveAttribute('aria-expanded', 'false');

    cleanup();
    sessionStorage.clear();
    renderDock({ immersive: true });
    expect(
      screen.getByRole('button', { name: 'Close navigation' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps the remembered compact choice while a wide dock is effectively open', () => {
    const mounted = renderDock({ immersive: true });
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));

    setCompact(false);
    mounted.rerender(<LiquidGlassDock currentPath="/blog/" immersive />);

    expect(
      screen.queryByRole('button', { name: /navigation/i }),
    ).not.toBeInTheDocument();
    expect(dock()).not.toHaveAttribute('inert');
    expect(dock()).not.toHaveAttribute('aria-hidden');

    setCompact(true);
    expect(
      screen.getByRole('button', { name: 'Open navigation' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(dock()).toHaveAttribute('inert');
  });

  it('does not let later scrolling override an explicit open choice', () => {
    renderDock({ immersive: true });
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));

    setScrollY(160);
    fireEvent.scroll(window);

    expect(
      screen.getByRole('button', { name: 'Close navigation' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(dock()).not.toHaveAttribute('inert');
  });

  it('fails open with operable page-lifetime state when session storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    renderDock({ immersive: true });
    expect(
      screen.getByRole('button', { name: 'Close navigation' }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(
      screen.getByRole('button', { name: 'Open navigation' }),
    ).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(
      screen.getByRole('button', { name: 'Close navigation' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });
});
