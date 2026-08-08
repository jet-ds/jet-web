import { expect, test, type Locator, type Page } from '@playwright/test';

type FilterConfig = {
  route: '/blog/' | '/works/';
  parameter: 'tag' | 'type';
  groupName: string;
  singular: 'post' | 'work';
  plural: 'posts' | 'works';
};

const filters: FilterConfig[] = [
  {
    route: '/blog/',
    parameter: 'tag',
    groupName: 'Filter posts by tag',
    singular: 'post',
    plural: 'posts',
  },
  {
    route: '/works/',
    parameter: 'type',
    groupName: 'Filter works by type',
    singular: 'work',
    plural: 'works',
  },
];

function filterRoot(page: Page, parameter: FilterConfig['parameter']): Locator {
  return page.locator(
    `[data-collection-filter][data-filter-param="${parameter}"]`,
  );
}

function filterItems(root: Locator): Locator {
  return root.locator('[data-filter-item]');
}

function visibleFilterItems(root: Locator): Locator {
  return root.locator('[data-filter-item]:visible');
}

function filterButton(root: Locator, value: string): Locator {
  return root.locator(`button[data-filter-value="${value}"]`);
}

function countFromLabel(label: string): number {
  const match = /\((\d+)\)$/u.exec(label.trim());
  expect(match, `expected a trailing count in "${label}"`).not.toBeNull();
  return Number(match?.[1]);
}

for (const config of filters) {
  test(`${config.route} renders a complete useful collection without JavaScript`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto(`${config.route}?${config.parameter}=not-a-real-filter`);
    const root = filterRoot(page, config.parameter);
    const items = filterItems(root);
    const total = await items.count();

    expect(total).toBeGreaterThan(0);
    await expect(visibleFilterItems(root)).toHaveCount(total);
    await expect(root.locator('[data-filter-enhancement]')).toBeHidden();
    const group = root.locator(
      `[role="group"][aria-label="${config.groupName}"]`,
    );
    await expect(group).toHaveCount(1);
    await expect(group).toBeHidden();
    await expect(page.locator(`a[href*="?${config.parameter}="]`)).toHaveCount(
      0,
    );

    await context.close();
  });

  test(`${config.route} initializes to All with collection-derived counts`, async ({
    page,
  }) => {
    await page.goto(config.route);
    const root = filterRoot(page, config.parameter);
    const items = filterItems(root);
    const allButton = filterButton(root, '');
    const total = await items.count();

    expect(total).toBeGreaterThan(0);
    await expect(visibleFilterItems(root)).toHaveCount(total);
    await expect(allButton).toHaveAttribute('aria-pressed', 'true');
    expect(countFromLabel(await allButton.innerText())).toBe(total);
    await expect(root.getByRole('status')).toHaveText(
      `${total} ${total === 1 ? config.singular : config.plural}`,
    );
    await expect(
      root.getByRole('group', { name: config.groupName }),
    ).toBeVisible();
    await expect(root.locator('[data-filter-enhancement]')).toBeVisible();
    await expect(page.locator(`a[href*="?${config.parameter}="]`)).toHaveCount(
      0,
    );

    const buttons = root.locator('button[data-filter-value]');
    for (let index = 0; index < (await buttons.count()); index += 1) {
      const button = buttons.nth(index);
      const expectedVisibleCards = countFromLabel(await button.innerText());

      await button.click();

      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(visibleFilterItems(root)).toHaveCount(expectedVisibleCards);
    }
  });
}

test('Blog restores a direct tag query and preserves the canonical collection URL', async ({
  page,
}) => {
  await page.goto('/blog/?tag=TUTORIAL');
  const root = filterRoot(page, 'tag');

  await expect(filterButton(root, 'tutorial')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(filterButton(root, '')).toHaveAttribute('aria-pressed', 'false');
  await expect(filterItems(root)).toHaveCount(2);
  await expect(visibleFilterItems(root)).toHaveCount(1);
  await expect(root.getByRole('status')).toHaveText(
    '1 post tagged with "tutorial"',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://jetsanchez.com/blog/',
  );
  expect(new URL(page.url()).searchParams.get('tag')).toBe('tutorial');

  await page.reload();
  await expect(
    filterButton(filterRoot(page, 'tag'), 'tutorial'),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(visibleFilterItems(filterRoot(page, 'tag'))).toHaveCount(1);
});

test('Works restores a direct type query and preserves the canonical collection URL', async ({
  page,
}) => {
  await page.goto('/works/?type=RESEARCH');
  const root = filterRoot(page, 'type');
  const research = filterButton(root, 'research');
  const expectedVisibleWorks = countFromLabel(await research.innerText());

  await expect(research).toHaveAttribute('aria-pressed', 'true');
  await expect(filterButton(root, '')).toHaveAttribute('aria-pressed', 'false');
  await expect(visibleFilterItems(root)).toHaveCount(expectedVisibleWorks);
  await expect(root.getByRole('status')).toHaveText(
    `${expectedVisibleWorks} ${expectedVisibleWorks === 1 ? 'work' : 'works'} in the research category`,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://jetsanchez.com/works/',
  );
  expect(new URL(page.url()).searchParams.get('type')).toBe('research');
});

test('Blog interaction filters cards, synchronizes the URL, and All clears it', async ({
  page,
}) => {
  await page.goto('/blog/');
  const root = filterRoot(page, 'tag');

  await filterButton(root, 'tutorial').click();
  await expect(visibleFilterItems(root)).toHaveCount(1);
  await expect(filterButton(root, 'tutorial')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(new URL(page.url()).searchParams.get('tag')).toBe('tutorial');

  await filterButton(root, '').click();
  await expect(visibleFilterItems(root)).toHaveCount(
    await filterItems(root).count(),
  );
  await expect(filterButton(root, '')).toHaveAttribute('aria-pressed', 'true');
  expect(new URL(page.url()).searchParams.has('tag')).toBe(false);
});

test('Works buttons support the keyboard and expose the project category', async ({
  page,
}) => {
  await page.goto('/works/');
  const root = filterRoot(page, 'type');
  const projects = filterButton(root, 'project');

  await projects.focus();
  await page.keyboard.press('Enter');

  await expect(projects).toHaveAttribute('aria-pressed', 'true');
  await expect(visibleFilterItems(root)).toHaveCount(1);
  await expect(root.getByRole('status')).toHaveText(
    '1 work in the project category',
  );
  await expect(root.locator('[data-filter-empty]')).toBeHidden();
  expect(new URL(page.url()).searchParams.get('type')).toBe('project');

  const all = filterButton(root, '');
  await all.focus();
  await page.keyboard.press('Space');
  await expect(visibleFilterItems(root)).toHaveCount(
    await filterItems(root).count(),
  );
  await expect(root.locator('[data-filter-empty]')).toBeHidden();
  expect(new URL(page.url()).searchParams.has('type')).toBe(false);
});

for (const config of filters) {
  test(`${config.route} normalizes an invalid filter query back to All`, async ({
    page,
  }) => {
    await page.goto(`${config.route}?${config.parameter}=not-a-real-filter`);
    const root = filterRoot(page, config.parameter);

    await expect(filterButton(root, '')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(visibleFilterItems(root)).toHaveCount(
      await filterItems(root).count(),
    );
    expect(new URL(page.url()).searchParams.has(config.parameter)).toBe(false);
  });
}
