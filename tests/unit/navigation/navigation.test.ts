import { describe, expect, it } from 'vitest';
import { isActiveNavItem, NAV_ITEMS } from '../../../src/config/site';

describe('navigation', () => {
  it('keeps unique ids and routes', () => {
    expect(new Set(NAV_ITEMS.map((item) => item.id)).size).toBe(NAV_ITEMS.length);
    expect(new Set(NAV_ITEMS.map((item) => item.href)).size).toBe(NAV_ITEMS.length);
  });

  it('preserves the core routes and their dock gradients', () => {
    expect(NAV_ITEMS.map(({ id, href, gradient }) => ({ id, href, gradient }))).toEqual([
      { id: 'home', href: '/', gradient: 'from-blue-600 to-blue-400' },
      { id: 'about', href: '/about/', gradient: 'from-purple-600 to-purple-400' },
      { id: 'blog', href: '/blog/', gradient: 'from-green-600 to-green-400' },
      { id: 'works', href: '/works/', gradient: 'from-orange-600 to-orange-400' },
      { id: 'ghost', href: '/chatbot/', gradient: 'from-indigo-600 to-indigo-400' },
      { id: 'contact', href: '/contact/', gradient: 'from-red-600 to-red-400' },
    ]);
  });

  it('publishes one canonical Ghost navigation item instead of Tools', () => {
    expect(NAV_ITEMS).toHaveLength(6);
    expect(NAV_ITEMS.map(({ id, label, href }) => ({ id, label, href }))).toContainEqual({
      id: 'ghost',
      label: "Jet's Ghost",
      href: '/chatbot/',
    });
    expect(NAV_ITEMS.some(({ id, label }) => String(id) === 'tools' || String(label) === 'Tools')).toBe(false);
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
