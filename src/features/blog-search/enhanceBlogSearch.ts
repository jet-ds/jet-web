import {
  normalizeSearchText,
  searchBlogPosts,
  type SearchableBlogRecord,
} from './searchBlogPosts';

const HAS_SEARCH_TOKEN = /[\p{L}\p{N}]/u;

function synchronizeUrl(query: string): void {
  const url = new URL(window.location.href);

  if (query) {
    url.searchParams.set('q', query);
  } else {
    url.searchParams.delete('q');
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function readRecords(root: HTMLElement): readonly SearchableBlogRecord[] {
  const source = root.querySelector<HTMLScriptElement>(
    'script[data-blog-search-records]',
  );
  if (!source?.textContent) return [];

  try {
    const records: unknown = JSON.parse(source.textContent);
    return Array.isArray(records)
      ? (records as readonly SearchableBlogRecord[])
      : [];
  } catch {
    return [];
  }
}

function normalizedQuery(value: string): string {
  const normalized = normalizeSearchText(value);
  return HAS_SEARCH_TOKEN.test(normalized) ? value.trim() : '';
}

function initializeRoot(root: HTMLElement): void {
  const records = readRecords(root);
  const list = root.querySelector<HTMLElement>('[data-blog-search-list]');
  const input = root.querySelector<HTMLInputElement>(
    '[data-blog-search-input]',
  );
  const clear = root.querySelector<HTMLButtonElement>(
    '[data-blog-search-clear]',
  );
  const status = root.querySelector<HTMLElement>('[data-blog-search-status]');
  const empty = root.querySelector<HTMLElement>('[data-blog-search-empty]');
  const enhancement = root.querySelector<HTMLElement>(
    '[data-blog-search-enhancement]',
  );
  if (!list || !input || !clear || !status || !empty || !enhancement) return;

  const items = new Map(
    Array.from(
      root.querySelectorAll<HTMLElement>(
        '[data-blog-search-item][data-blog-search-id]',
      ),
    ).map((item) => [item.dataset.blogSearchId ?? '', item]),
  );
  if (records.length === 0 || items.size !== records.length) return;

  const applySearch = (requestedQuery: string): void => {
    const query = normalizedQuery(requestedQuery);
    const results = searchBlogPosts(records, query);
    const resultIds = new Set(results.map(({ id }) => id));

    for (const { id } of results) {
      const item = items.get(id);
      if (!item) continue;
      item.hidden = false;
      list.append(item);
    }
    for (const { id } of records) {
      if (resultIds.has(id)) continue;
      const item = items.get(id);
      if (!item) continue;
      item.hidden = true;
      list.append(item);
    }

    const visibleCount = results.length;
    status.textContent = query
      ? `${visibleCount} ${visibleCount === 1 ? 'post' : 'posts'} found`
      : `${visibleCount} ${visibleCount === 1 ? 'post' : 'posts'}`;
    empty.hidden = visibleCount > 0;
    clear.hidden = input.value.length === 0;
    synchronizeUrl(query);
  };

  if (root.dataset.blogSearchReady !== 'true') {
    input.addEventListener('input', () => applySearch(input.value));
    root.querySelector('form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      applySearch(input.value);
    });
    clear.addEventListener('click', () => {
      input.value = '';
      applySearch('');
      input.focus();
    });
    root.dataset.blogSearchReady = 'true';
  }

  const initialQuery =
    new URL(window.location.href).searchParams.get('q') ?? '';
  input.value = normalizedQuery(initialQuery);
  applySearch(input.value);
  enhancement.hidden = false;
}

export function initializeBlogSearch(scope: ParentNode = document): void {
  for (const root of scope.querySelectorAll<HTMLElement>(
    '[data-blog-search]',
  )) {
    initializeRoot(root);
  }
}
