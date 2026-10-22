import { test, expect } from '../support/localBrowser';
import { publishedContent } from '../support/publishedContent';
import { loadMediaAsset } from '../../src/features/media/registry.server';
import { resolveMediaPresentation } from '../../src/features/media/contract';
test('every published article agrees on social image identity and actual dimensions', async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const content of publishedContent()) {
    await page.goto(content.route);
    const social = content.image?.social;
    expect(social).toBeDefined();
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      social!.url,
    );
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      'content',
      social!.url,
    );
    await expect(
      page.locator('meta[property="og:image:width"]'),
    ).toHaveAttribute('content', '1200');
    await expect(
      page.locator('meta[property="og:image:height"]'),
    ).toHaveAttribute('content', '675');
    const entities = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const pageEntity = entities
      .map((e) => JSON.parse(e))
      .find((e) => e['@type'] === 'WebPage');
    const contentEntity = entities
      .map((e) => JSON.parse(e))
      .find((e) => e['@type'] === content.entityType);
    expect(pageEntity?.image).toBe(social!.url);
    expect(contentEntity?.image).toBe(social!.url);
    const image = page.locator('main img:visible').first();
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (e) =>
            e instanceof HTMLImageElement && e.complete && e.naturalWidth > 0,
        ),
      )
      .toBe(true);
    expect(await image.getAttribute('srcset')).toContain('480w');
    if (content.route.includes('digital-squad-timesheet')) {
      await page.screenshot({
        path: testInfo.outputPath('work-light.png'),
        animations: 'disabled',
      });
      await page.getByRole('button', { name: /switch to dark mode/iu }).click();
      await page.screenshot({
        path: testInfo.outputPath('work-dark.png'),
        animations: 'disabled',
      });
    }
    expect((await page.content()).toLowerCase()).not.toContain(
      '.private.blob.vercel-storage.com',
    );
  }
});
test('About uses its bounded portrait set and the unchanged default social image', async ({
  page,
}, testInfo) => {
  const portrait = resolveMediaPresentation(
    loadMediaAsset('about/about-hero'),
    'portrait-detail',
  );
  await page.goto('/about/');
  const image = page.getByRole('img', { name: 'Jet Sanchez', exact: true });
  await expect(image).toHaveAttribute('src', portrait.url);
  await expect(image).toHaveAttribute('srcset', portrait.srcSet!);
  await expect(image).toHaveAttribute('width', '1200');
  await expect(image).toHaveAttribute('height', '1600');
  await expect
    .poll(() =>
      image.evaluate(
        (e) =>
          e instanceof HTMLImageElement && e.complete && e.naturalWidth > 0,
      ),
    )
    .toBe(true);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://jetsanchez.com/images/og-default.jpg',
  );
  await image.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('about-portrait.png') });
});
