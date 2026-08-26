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

test('Blog and Works keep their complete collections available without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto('/blog/?q=invented-query');
  let items = blogItems(page);
  let total = await items.count();

  expect(total).toBeGreaterThan(0);
  await expect(items.filter({ visible: true })).toHaveCount(total);
  await expect(page.locator('[data-blog-search-enhancement]')).toBeHidden();

  await page.goto('/works/?type=research');
  const root = worksRoot(page);
  items = workItems(page);
  total = await items.count();

  expect(total).toBeGreaterThan(0);
  await expect(items.filter({ visible: true })).toHaveCount(total);
  await expect(root.locator('[data-filter-enhancement]')).toBeHidden();

  await context.close();
});

test('Blog restores q, replaces its URL state, and clears back to the complete collection', async ({
  page,
}) => {
  await page.goto('/about/');
  await page.goto('/blog/?q=invented-query&q=duplicate');
  await expect(page).toHaveURL(/\/blog\/\?q=invented-query/u);

  const input = page.getByRole('searchbox', { name: 'Search blog posts' });
  const clear = page.getByRole('button', { name: 'Clear search' });
  const status = page.getByRole('status');
  const total = await blogItems(page).count();
  const historyLength = await page.evaluate(() => window.history.length);

  await expect(input).toHaveValue('invented-query');
  await expect(clear).toBeVisible();
  await expect(status).toBeVisible();
  await expect(page.locator('[data-blog-search-empty]')).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://jetsanchez.com/blog/',
  );
  expect(new URL(page.url()).searchParams.getAll('q')).toEqual([
    'invented-query',
  ]);

  const firstTitle =
    (
      await blogItems(page)
        .first()
        .locator('[data-content-card-title]')
        .textContent()
    )?.trim() ?? '';
  expect(firstTitle).not.toBe('');
  await input.focus();
  await input.fill(firstTitle);
  const positiveCount = await blogItems(page).filter({ visible: true }).count();
  expect(positiveCount).toBeGreaterThan(0);
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
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);

  await page.goBack();
  await expect(page).toHaveURL(/\/about\/$/u);
  await expect(page.getByRole('heading', { name: /About/iu })).toBeVisible();

  await page.goto('/blog/?q=%20%20%20');
  const normalizedInput = page.getByRole('searchbox', {
    name: 'Search blog posts',
  });
  const normalizedItems = blogItems(page);
  const normalizedTotal = await normalizedItems.count();

  await expect(normalizedInput).toHaveValue('');
  await expect(normalizedItems.filter({ visible: true })).toHaveCount(
    normalizedTotal,
  );
  expect(new URL(page.url()).searchParams.has('q')).toBe(false);
});

test('Works owns native pressed state and normalizes an invalid type to All', async ({
  page,
}) => {
  await page.goto('/works/?type=RESEARCH');
  let root = worksRoot(page);
  const research = root.getByRole('button', { name: /^Research/u });

  await expect(research).toHaveAttribute('aria-pressed', 'true');
  expect(new URL(page.url()).searchParams.get('type')).toBe('research');

  const projects = root.getByRole('button', { name: /^Projects/u });
  await projects.focus();
  await page.keyboard.press('Enter');
  await expect(projects).toBeFocused();
  await expect(projects).toHaveAttribute('aria-pressed', 'true');
  expect(new URL(page.url()).searchParams.get('type')).toBe('project');

  await page.goto('/works/?type=not-a-real-type');
  root = worksRoot(page);
  await expect(root.getByRole('button', { name: /^All/u })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(workItems(page).filter({ visible: true })).toHaveCount(
    await workItems(page).count(),
  );
  expect(new URL(page.url()).searchParams.has('type')).toBe(false);
});
