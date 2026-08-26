import { expect, test, type Page } from '@playwright/test';

async function itemListUrls(page: Page, route: string): Promise<string[]> {
  await page.goto(route);
  return page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((scripts) =>
      scripts
        .map((script) => JSON.parse(script.textContent ?? '{}') as unknown)
        .filter(
          (
            schema,
          ): schema is {
            '@type': 'ItemList';
            itemListElement: Array<{ url: string }>;
          } =>
            typeof schema === 'object' &&
            schema !== null &&
            Reflect.get(schema, '@type') === 'ItemList' &&
            Array.isArray(Reflect.get(schema, 'itemListElement')),
        )
        .flatMap((schema) =>
          schema.itemListElement.map(({ url }) => new URL(url).toString()),
        ),
    );
}

function sectionUrls(text: string, heading: string, next?: string): string[] {
  const startMarker = `## ${heading}\n`;
  const start = text.indexOf(startMarker);
  expect(start).toBeGreaterThanOrEqual(0);
  const contentStart = start + startMarker.length;
  const end = next === undefined ? text.length : text.indexOf(`\n## ${next}\n`);
  expect(end).toBeGreaterThanOrEqual(contentStart);

  return text
    .slice(contentStart, end)
    .split('\n')
    .filter((line) => line.startsWith('- ['))
    .map((line) => {
      const labelEnd = line.lastIndexOf('](');
      const urlEnd = line.indexOf('): ', labelEnd);
      expect(labelEnd).toBeGreaterThan(1);
      expect(urlEnd).toBeGreaterThan(labelEnd + 2);
      return line.slice(labelEnd + 2, urlEnd);
    });
}

test('serves plain discovery text with the canonical hub ItemList memberships', async ({
  page,
  request,
}) => {
  const response = await request.get('/llms.txt');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toMatch(
    /^text\/plain(?:; charset=utf-8)?$/u,
  );

  const text = await response.text();
  const blogUrls = await itemListUrls(page, '/blog/');
  const workUrls = await itemListUrls(page, '/works/');

  expect(sectionUrls(text, 'Articles', 'Works')).toEqual(blogUrls);
  expect(sectionUrls(text, 'Works')).toEqual(workUrls);
});
