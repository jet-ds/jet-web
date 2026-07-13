import type { PropsWithChildren } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LiquidGlassDock from '../../../src/components/navigation/LiquidGlassDock';

const viewport = vi.hoisted(() => ({ isMobile: true }));

vi.mock('../../../src/hooks/useMediaQuery', () => ({
  useMediaQuery: () => viewport.isMobile,
}));

vi.mock('../../../src/hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light' as const, toggleTheme: vi.fn() }),
}));

vi.mock('../../../src/components/navigation/GlassSurface', () => ({
  default: ({ children, className }: PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}));

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value,
  });
}

describe('LiquidGlassDock', () => {
  beforeEach(() => {
    viewport.isMobile = true;
    sessionStorage.clear();
    setScrollY(0);
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
  });

  it('marks the current nested route and keeps desktop navigation exposed', () => {
    viewport.isMobile = false;

    render(<LiquidGlassDock currentPath="/blog/post" />);

    const dock = document.querySelector('#site-navigation-dock');
    const blogLink = screen.getByRole('link', { name: 'Blog' });

    expect(dock).not.toHaveAttribute('inert');
    expect(dock).not.toHaveAttribute('aria-hidden');
    expect(blogLink).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    expect(blogLink).toHaveClass(
      'focus-visible:ring-brand-base',
      'focus-visible:ring-offset-bg-base',
    );
  });

  it('hides the discovered mobile dock from focus until opened and restores focus on close', async () => {
    const { rerender } = render(<LiquidGlassDock currentPath="/blog/post" />);

    expect(screen.queryByRole('button', { name: 'Open navigation' })).not.toBeInTheDocument();

    setScrollY(100);
    fireEvent.scroll(window);
    expect(screen.queryByRole('button', { name: 'Open navigation' })).not.toBeInTheDocument();

    setScrollY(101);
    fireEvent.scroll(window);

    const disclosure = await screen.findByRole('button', { name: 'Open navigation' });
    const dock = document.querySelector('#site-navigation-dock');

    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(disclosure).toHaveAttribute('aria-controls', 'site-navigation-dock');
    expect(dock).toHaveAttribute('inert');
    expect(dock).toHaveAttribute('aria-hidden', 'true');
    expect(dock?.querySelectorAll('a, button')).not.toHaveLength(0);
    dock?.querySelectorAll('a, button').forEach((element) => {
      expect(element).toHaveAttribute('tabindex', '-1');
    });

    fireEvent.click(disclosure);

    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(dock).not.toHaveAttribute('inert');
    expect(dock).not.toHaveAttribute('aria-hidden');
    dock?.querySelectorAll('a, button').forEach((element) => {
      expect(element).not.toHaveAttribute('tabindex');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));

    await waitFor(() => {
      expect(disclosure).toHaveFocus();
      expect(dock).toHaveAttribute('inert');
      expect(dock).toHaveAttribute('aria-hidden', 'true');
    });
    expect(sessionStorage.getItem('dockScrolled')).toBe('true');

    viewport.isMobile = false;
    rerender(<LiquidGlassDock currentPath="/blog/post" />);

    await waitFor(() => {
      expect(sessionStorage.getItem('dockScrolled')).toBeNull();
      expect(dock).not.toHaveAttribute('inert');
      expect(dock).not.toHaveAttribute('aria-hidden');
    });

    viewport.isMobile = true;
    rerender(<LiquidGlassDock currentPath="/blog/post" />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Open navigation' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Close navigation' })).not.toBeInTheDocument();
      expect(dock).not.toHaveAttribute('inert');
      expect(dock).not.toHaveAttribute('aria-hidden');
    });
  });
});
