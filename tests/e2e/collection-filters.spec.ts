import { expect, test, type Locator, type Page } from '@playwright/test';

function blogItems(page: Page): Locator {
  return page.locator('[data-blog-search-item]');
}

function worksRoot(page: Page): Locator {
  return page.locator('[data-collection-filter][data-filter-param="type"]');
}

function workItems(page: Page): Locator {
  return worksRoot(page).locator('[data-filter-item]');
}

test('Blog keeps its complete collection available without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto('/blog/?q=invented-query');
  const items = blogItems(page);
  const total = await items.count();

  expect(total).toBeGreaterThan(0);
  await expect(items.filter({ visible: true })).toHaveCount(total);
  await expect(page.locator('[data-blog-search-enhancement]')).toBeHidden();

  await context.close();
});

test('Works keeps its complete canonical sequence available without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto('/works/?type=research');
  const root = worksRoot(page);
  const items = workItems(page);
  const total = await items.count();

  expect(total).toBeGreaterThan(0);
  await expect(items.filter({ visible: true })).toHaveCount(total);
  await expect(root.locator('[data-filter-enhancement]')).toBeHidden();

  await context.close();
});

test('Blog restores q, replaces its URL state, and clears back to the complete collection', async ({
  page,
}) => {
  await page.goto('/blog/?q=invented-query&q=duplicate');

  const input = page.getByRole('searchbox', { name: 'Search blog posts' });
  const clear = page.getByRole('button', { name: 'Clear search' });
  const total = await blogItems(page).count();

  await expect(input).toHaveValue('invented-query');
  await expect(clear).toBeVisible();
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.locator('[data-blog-search-empty]')).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://jetsanchez.com/blog/',
  );
  expect(new URL(page.url()).searchParams.getAll('q')).toEqual([
    'invented-query',
  ]);

  const firstTitle = await page
    .locator('script[data-blog-search-records]')
    .evaluate((source) => {
      const records = JSON.parse(source.textContent ?? '[]') as Array<{
        title: string;
      }>;
      return records[0]?.title ?? '';
    });
  expect(firstTitle).not.toBe('');
  await input.focus();
  await input.fill(firstTitle);
  expect(
    await blogItems(page).filter({ visible: true }).count(),
  ).toBeGreaterThan(0);
  await expect(page.locator('[data-blog-search-empty]')).toBeHidden();
  expect(new URL(page.url()).searchParams.getAll('q')).toEqual([firstTitle]);

  await input.fill('another invented query');
  await expect(input).toBeFocused();
  await expect(page.locator('[data-blog-search-empty]')).toBeVisible();
  expect(new URL(page.url()).searchParams.getAll('q')).toEqual([
    'another invented query',
  ]);

  await clear.click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await expect(clear).toBeHidden();
  await expect(blogItems(page).filter({ visible: true })).toHaveCount(total);
  await expect(page.locator('[data-blog-search-empty]')).toBeHidden();
  expect(new URL(page.url()).searchParams.has('q')).toBe(false);
});

test('Blog normalizes whitespace-only q to the empty canonical state', async ({
  page,
}) => {
  await page.goto('/blog/?q=%20%20%20');

  const input = page.getByRole('searchbox', { name: 'Search blog posts' });
  const items = blogItems(page);
  const total = await items.count();

  await expect(input).toHaveValue('');
  await expect(items.filter({ visible: true })).toHaveCount(total);
  expect(new URL(page.url()).searchParams.has('q')).toBe(false);
});

test('Works owns native pressed state and normalizes an invalid type to All', async ({
  page,
}) => {
  await page.goto('/works/?type=RESEARCH');
  let root = worksRoot(page);
  const research = root.locator('button[data-filter-value="research"]');

  await expect(research).toHaveAttribute('aria-pressed', 'true');
  expect(new URL(page.url()).searchParams.get('type')).toBe('research');

  const projects = root.locator('button[data-filter-value="project"]');
  await projects.focus();
  await page.keyboard.press('Enter');
  await expect(projects).toBeFocused();
  await expect(projects).toHaveAttribute('aria-pressed', 'true');
  expect(new URL(page.url()).searchParams.get('type')).toBe('project');

  await page.goto('/works/?type=not-a-real-type');
  root = worksRoot(page);
  await expect(root.locator('button[data-filter-value=""]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(workItems(page).filter({ visible: true })).toHaveCount(
    await workItems(page).count(),
  );
  expect(new URL(page.url()).searchParams.has('type')).toBe(false);
});
