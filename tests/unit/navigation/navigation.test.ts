import { describe, expect, it } from 'vitest';
import { isActiveNavItem, NAV_ITEMS } from '../../../src/config/site';

describe('navigation', () => {
  it('keeps unique ids and routes', () => {
    expect(new Set(NAV_ITEMS.map((item) => item.id)).size).toBe(
      NAV_ITEMS.length,
    );
    expect(new Set(NAV_ITEMS.map((item) => item.href)).size).toBe(
      NAV_ITEMS.length,
    );
  });

  it('matches root only at root', () => {
    expect(isActiveNavItem('/', '/')).toBe(true);
    expect(isActiveNavItem('/about', '/')).toBe(false);
    expect(isActiveNavItem('/about/', '/')).toBe(false);
  });

  it.each([
    ['/blog', '/blog/'],
    ['/blog/', '/blog/'],
    ['/blog/post', '/blog/'],
    ['/blog/post/', '/blog/'],
  ])('matches the Blog item for current path %s', (currentPath, href) => {
    expect(isActiveNavItem(currentPath, href)).toBe(true);
  });

  it.each([
    ['/chatbot-lab/', '/chatbot/'],
    ['/toolshed/', '/tools/'],
  ])('does not match prefix lookalike %s against %s', (currentPath, href) => {
    expect(isActiveNavItem(currentPath, href)).toBe(false);
  });
});
