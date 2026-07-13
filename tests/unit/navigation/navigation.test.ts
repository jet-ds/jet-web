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
      { id: 'about', href: '/about', gradient: 'from-purple-600 to-purple-400' },
      { id: 'blog', href: '/blog', gradient: 'from-green-600 to-green-400' },
      { id: 'works', href: '/works', gradient: 'from-orange-600 to-orange-400' },
      { id: 'tools', href: '/tools', gradient: 'from-indigo-600 to-indigo-400' },
      { id: 'contact', href: '/contact', gradient: 'from-red-600 to-red-400' },
    ]);
  });

  it('matches nested routes without matching home globally', () => {
    expect(isActiveNavItem('/blog/post', '/blog')).toBe(true);
    expect(isActiveNavItem('/about', '/')).toBe(false);
    expect(isActiveNavItem('/', '/')).toBe(true);
  });
});
