import { beforeEach, describe, expect, it } from 'vitest';
import { initializeCollectionFilters } from '../../../src/features/collection-filters/enhanceCollectionFilters';

function renderFilterFixture(): HTMLElement {
  document.body.innerHTML = `
    <div
      data-collection-filter
      data-filter-param="type"
      data-filter-singular="work"
      data-filter-plural="works"
      data-filter-context-template=" in the {value} category"
    >
      <section data-filter-enhancement hidden>
        <button type="button" data-filter-value="" aria-pressed="true">All (3)</button>
        <button type="button" data-filter-value="research" aria-pressed="false">Research (2)</button>
        <button type="button" data-filter-value="project" aria-pressed="false">Projects (1)</button>
        <p data-filter-status>3 works</p>
      </section>
      <section>
        <article data-filter-item data-filter-values='["research"]'>Newest research</article>
        <article data-filter-item data-filter-values='["project"]'>Middle project</article>
        <article data-filter-item data-filter-values='["research"]'>Oldest research</article>
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
  it('restores and canonicalizes a direct Works type query', () => {
    window.history.replaceState(null, '', '/works/?type=RESEARCH');
    const root = renderFilterFixture();

    initializeCollectionFilters();

    const items = root.querySelectorAll<HTMLElement>('[data-filter-item]');
    expect(items[0].hidden).toBe(false);
    expect(items[1].hidden).toBe(true);
    expect(items[2].hidden).toBe(false);
    expect(
      root.querySelector('[data-filter-value="research"]'),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(root.querySelector('[data-filter-status]')).toHaveTextContent(
      '2 works in the research category',
    );
    expect(
      root.querySelector<HTMLElement>('[data-filter-enhancement]')?.hidden,
    ).toBe(false);
    expect(new URL(window.location.href).searchParams.get('type')).toBe(
      'research',
    );
  });

  it('normalizes an invalid query to All without hiding static content', () => {
    window.history.replaceState(null, '', '/works/?type=unknown');
    const root = renderFilterFixture();

    initializeCollectionFilters();

    expect(root.querySelector('[data-filter-value=""]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    for (const item of root.querySelectorAll<HTMLElement>(
      '[data-filter-item]',
    )) {
      expect(item.hidden).toBe(false);
    }
    expect(new URL(window.location.href).searchParams.has('type')).toBe(false);
  });

  it('changes only visibility and preserves canonical DOM order through native button clicks', () => {
    window.history.replaceState(null, '', '/works/');
    const root = renderFilterFixture();
    initializeCollectionFilters();

    root
      .querySelector<HTMLButtonElement>('[data-filter-value="research"]')
      ?.click();

    expect(
      Array.from(root.querySelectorAll('[data-filter-item]')).map(
        (item) => item.textContent,
      ),
    ).toEqual(['Newest research', 'Middle project', 'Oldest research']);
    expect(root.querySelector<HTMLElement>('[data-filter-empty]')?.hidden).toBe(
      true,
    );
    expect(new URL(window.location.href).searchParams.get('type')).toBe(
      'research',
    );

    root.querySelector<HTMLButtonElement>('[data-filter-value=""]')?.click();

    expect(root.querySelector<HTMLElement>('[data-filter-empty]')?.hidden).toBe(
      true,
    );
    expect(new URL(window.location.href).searchParams.has('type')).toBe(false);
  });
});
