const normalize = (value: string) => value.trim().toLocaleLowerCase();

function filterContext(root: HTMLElement, selectedValue: string): string {
  if (!selectedValue) return '';

  return (root.dataset.filterContextTemplate ?? '').replace(
    '{value}',
    selectedValue,
  );
}

function synchronizeUrl(parameter: string, selectedValue: string): void {
  const url = new URL(window.location.href);

  if (selectedValue) {
    url.searchParams.set(parameter, selectedValue);
  } else {
    url.searchParams.delete(parameter);
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function applyFilter(root: HTMLElement, requestedValue: string | null): void {
  const parameter = root.dataset.filterParam;
  const singular = root.dataset.filterSingular;
  const plural = root.dataset.filterPlural;
  if (!parameter || !singular || !plural) return;

  const buttons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('button[data-filter-value]'),
  );
  const selectedButton = requestedValue
    ? buttons.find(
        (button) =>
          button.dataset.filterValue &&
          normalize(button.dataset.filterValue) === normalize(requestedValue),
      )
    : buttons.find((button) => button.dataset.filterValue === '');
  const selectedValue = selectedButton?.dataset.filterValue ?? '';

  const items = Array.from(
    root.querySelectorAll<HTMLElement>('[data-filter-item]'),
  );
  let visibleCount = 0;

  for (const item of items) {
    const values = JSON.parse(item.dataset.filterValues ?? '[]') as string[];
    const matches =
      !selectedValue ||
      values.some((value) => normalize(value) === normalize(selectedValue));
    item.hidden = !matches;
    if (matches) visibleCount += 1;
  }

  for (const button of buttons) {
    button.setAttribute(
      'aria-pressed',
      String((button.dataset.filterValue ?? '') === selectedValue),
    );
  }

  for (const section of root.querySelectorAll<HTMLElement>(
    '[data-filter-section]',
  )) {
    const sectionItems = Array.from(
      section.querySelectorAll<HTMLElement>('[data-filter-item]'),
    );
    section.hidden =
      sectionItems.length > 0 && sectionItems.every((item) => item.hidden);
  }

  const context = filterContext(root, selectedValue);
  const status = root.querySelector<HTMLElement>('[data-filter-status]');
  if (status) {
    status.textContent = `${visibleCount} ${visibleCount === 1 ? singular : plural}${context}`;
  }

  const empty = root.querySelector<HTMLElement>('[data-filter-empty]');
  if (empty) {
    empty.hidden = visibleCount > 0;
    const message = empty.querySelector<HTMLElement>(
      '[data-filter-empty-message]',
    );
    if (message) message.textContent = `No ${plural} found${context}.`;
  }

  for (const enhancement of root.querySelectorAll<HTMLElement>(
    '[data-filter-enhancement]',
  )) {
    enhancement.hidden = false;
  }

  synchronizeUrl(parameter, selectedValue);
}

function initializeRoot(root: HTMLElement): void {
  if (root.dataset.filterReady !== 'true') {
    root.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest<HTMLButtonElement>(
        'button[data-filter-value]',
      );
      if (!button || !root.contains(button)) return;
      applyFilter(root, button.dataset.filterValue ?? '');
    });
    root.dataset.filterReady = 'true';
  }

  const parameter = root.dataset.filterParam;
  if (!parameter) return;
  applyFilter(root, new URL(window.location.href).searchParams.get(parameter));
}

export function initializeCollectionFilters(
  scope: ParentNode = document,
): void {
  for (const root of scope.querySelectorAll<HTMLElement>(
    '[data-collection-filter]',
  )) {
    initializeRoot(root);
  }
}
