import { beforeEach, describe, expect, it } from 'vitest';
import { initializeCollectionFilters } from '../../../src/features/collection-filters/enhanceCollectionFilters';

function renderFilterFixture(): HTMLElement {
  document.body.innerHTML = `
    <div
      data-collection-filter
      data-filter-param="tag"
      data-filter-singular="post"
      data-filter-plural="posts"
      data-filter-context-template=' tagged with "{value}"'
    >
      <section data-filter-enhancement hidden>
        <button type="button" data-filter-value="" aria-pressed="true">All (2)</button>
        <button type="button" data-filter-value="tutorial" aria-pressed="false">tutorial (1)</button>
        <button type="button" data-filter-value="missing" aria-pressed="false">missing (0)</button>
        <p data-filter-status>2 posts</p>
      </section>
      <section data-filter-section>
        <article data-filter-item data-filter-values='["AI"]'>AI post</article>
        <article data-filter-item data-filter-values='["tutorial"]'>Tutorial post</article>
      </section>
      <div data-filter-empty hidden>
        <p data-filter-empty-message></p>
      </div>
    </div>
  `;

  const root = document.querySelector<HTMLElement>('[data-collection-filter]');
  if (!root) throw new Error('Filter fixture did not render');
  return root;
}

beforeEach(() => {
  document.body.innerHTML = '';
  window.history.replaceState(null, '', '/');
});

describe('initializeCollectionFilters', () => {
  it('restores and canonicalizes a direct query from rendered filter metadata', () => {
    window.history.replaceState(null, '', '/blog/?tag=TUTORIAL');
    const root = renderFilterFixture();

    initializeCollectionFilters();

    const items = root.querySelectorAll<HTMLElement>('[data-filter-item]');
    expect(items[0].hidden).toBe(true);
    expect(items[1].hidden).toBe(false);
    expect(root.querySelector('[data-filter-value="tutorial"]'))
      .toHaveAttribute('aria-pressed', 'true');
    expect(root.querySelector('[data-filter-status]'))
      .toHaveTextContent('1 post tagged with "tutorial"');
    expect(root.querySelector<HTMLElement>('[data-filter-enhancement]')?.hidden).toBe(false);
    expect(new URL(window.location.href).searchParams.get('tag')).toBe('tutorial');
  });

  it('normalizes an invalid query to All without hiding static content', () => {
    window.history.replaceState(null, '', '/blog/?tag=unknown');
    const root = renderFilterFixture();

    initializeCollectionFilters();

    expect(root.querySelector('[data-filter-value=""]'))
      .toHaveAttribute('aria-pressed', 'true');
    for (const item of root.querySelectorAll<HTMLElement>('[data-filter-item]')) {
      expect(item.hidden).toBe(false);
    }
    expect(new URL(window.location.href).searchParams.has('tag')).toBe(false);
  });

  it('updates items, sections, empty state, and URL through native button clicks', () => {
    window.history.replaceState(null, '', '/blog/');
    const root = renderFilterFixture();
    initializeCollectionFilters();

    root.querySelector<HTMLButtonElement>('[data-filter-value="missing"]')?.click();

    expect(root.querySelector<HTMLElement>('[data-filter-section]')?.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-filter-empty]')?.hidden).toBe(false);
    expect(root.querySelector('[data-filter-empty-message]'))
      .toHaveTextContent('No posts found tagged with "missing".');
    expect(new URL(window.location.href).searchParams.get('tag')).toBe('missing');

    root.querySelector<HTMLButtonElement>('[data-filter-value=""]')?.click();

    expect(root.querySelector<HTMLElement>('[data-filter-section]')?.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('[data-filter-empty]')?.hidden).toBe(true);
    expect(new URL(window.location.href).searchParams.has('tag')).toBe(false);
  });
});
