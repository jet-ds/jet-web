import { expect, test, type Locator, type Page } from '@playwright/test';
import { resolvedPublishedCollections } from '../support/publishedContent';

const expectedHomepageSections = () => {
  const homepage = resolvedPublishedCollections().homepage;
  return [
    homepage.filter(({ kind }) => kind === 'blog'),
    homepage.filter(({ kind }) => kind !== 'blog'),
  ];
};

async function carouselRoots(page: Page) {
  const roots = page.locator('[data-home-collection-carousel]');
  await expect(roots).toHaveCount(2);
  return roots;
}

async function position(
  region: Locator,
): Promise<{ current: number; total: number }> {
  const text = await region.getByRole('status').innerText();
  const match = text.match(/^Item (\d+) of (\d+)$/u);
  if (match === null) throw new Error(`Unexpected carousel position: ${text}`);
  return { current: Number(match[1]), total: Number(match[2]) };
}

test.describe('Homepage carousel fallback', () => {
  test.use({ javaScriptEnabled: false });

  test('keeps every finite canonical destination available without JavaScript', async ({
    page,
  }) => {
    await page.goto('/');
    const roots = await carouselRoots(page);

    for (const [
      sectionIndex,
      records,
    ] of expectedHomepageSections().entries()) {
      const root = roots.nth(sectionIndex);
      await expect(root.locator('[data-carousel-fallback]')).toBeVisible();
      await expect(root.locator('[data-depth-carousel]')).toHaveCount(0);
      const hrefs = await root
        .locator('[data-carousel-fallback] article a')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      expect(hrefs).toEqual(records.map(({ href }) => href));
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
  });
});

test('loops first and last positions while exposing only the active destination', async ({
  page,
}) => {
  await page.goto('/');
  const roots = await carouselRoots(page);

  for (const root of await roots.all()) {
    const fallback = root.locator('[data-carousel-fallback]');
    await expect(fallback).toHaveAttribute('hidden', '');
    await expect(fallback).toHaveAttribute('inert', '');
    await expect(fallback).toHaveAttribute('aria-hidden', 'true');

    const region = root.getByRole('region');
    const initial = await position(region);
    expect(initial.current).toBe(1);
    expect(initial.total).toBeGreaterThan(1);
    await expect(region.getByRole('link')).toHaveCount(1);

    await region.getByRole('button', { name: /^Previous /u }).click();
    await expect(region.getByRole('status')).toHaveText(
      `Item ${initial.total} of ${initial.total}`,
    );
    await expect(region.getByRole('link')).toHaveCount(1);

    await region.getByRole('button', { name: /^Next /u }).click();
    await expect(region.getByRole('status')).toHaveText(
      `Item 1 of ${initial.total}`,
    );
  }
});

test('owns arrow keys on focus and presents visible full-size controls', async ({
  page,
}) => {
  await page.goto('/');
  const roots = await carouselRoots(page);
  const region = roots.first().getByRole('region');
  const initial = await position(region);

  await page.keyboard.press('ArrowRight');
  await expect(region.getByRole('status')).toHaveText(
    `Item 1 of ${initial.total}`,
  );

  const activeLink = region.getByRole('link');
  await activeLink.focus();
  await expect(activeLink).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(region.getByRole('status')).toHaveText(
    `Item 2 of ${initial.total}`,
  );
  await page.keyboard.press('ArrowLeft');
  await expect(region.getByRole('status')).toHaveText(
    `Item 1 of ${initial.total}`,
  );

  const controls = region.locator('button:visible');
  for (const control of await controls.all()) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test('commits a deliberate horizontal gesture without navigation or wheel capture', async ({
  page,
}) => {
  await page.goto('/');
  const roots = await carouselRoots(page);
  const region = roots.first().getByRole('region');
  const stage = region.locator('[data-carousel-stage]');
  const initial = await position(region);
  await stage.scrollIntoViewIfNeeded();
  const box = await stage.boundingBox();
  if (box === null) throw new Error('Carousel stage has no geometry');

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX - 96, centerY + 8, { steps: 8 });
  await page.mouse.up();
  await expect(region.getByRole('status')).toHaveText(
    `Item 2 of ${initial.total}`,
  );
  expect(new URL(page.url()).pathname).toBe('/');

  expect(
    await stage.evaluate((element) => getComputedStyle(element).touchAction),
  ).toBe('pan-y');
  await stage.hover();
  const beforeScroll = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 360);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(beforeScroll);
});

for (const viewport of [
  { width: 1024, height: 768, recededLayers: 3 },
  { width: 430, height: 932, recededLayers: 2 },
] as const) {
  test(`contains ${viewport.recededLayers} receding layers at ${viewport.width}px without overflow`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const roots = await carouselRoots(page);

    for (const root of await roots.all()) {
      const region = root.getByRole('region');
      const currentPosition = await position(region);
      const visibleLayers = region.locator(
        '[data-carousel-layer-item]:visible',
      );
      await expect(visibleLayers).toHaveCount(
        Math.min(currentPosition.total, viewport.recededLayers + 1),
      );
      const layerIds = await visibleLayers.evaluateAll((layers) =>
        layers.map((layer) => layer.getAttribute('data-carousel-layer-item')),
      );
      expect(new Set(layerIds).size).toBe(layerIds.length);

      const active = region.locator('[data-carousel-depth="0"]');
      const activeBox = await active.boundingBox();
      expect(activeBox).not.toBeNull();
      expect(activeBox?.width ?? Infinity).toBeLessThanOrEqual(480.5);
      expect(activeBox?.height ?? Infinity).toBeLessThanOrEqual(270.5);
      expect((activeBox?.width ?? 0) / (activeBox?.height ?? 1)).toBeCloseTo(
        16 / 9,
        1,
      );

      const companion = region.locator('.depth-carousel__companion');
      const companionBox = await companion.boundingBox();
      expect(companionBox?.width ?? Infinity).toBeLessThanOrEqual(480.5);
      await expect(companion).toHaveCSS('transform', 'none');
    }

    const overflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });
}

test('reduced motion keeps manual circular state changes and an idle stage', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const roots = await carouselRoots(page);
  const region = roots.first().getByRole('region');
  const initial = await position(region);
  await expect(region).toHaveAttribute('data-reduced-motion', 'true');

  const transformsBefore = await region
    .locator('[data-carousel-layer-item]')
    .evaluateAll((layers) =>
      layers.map((layer) => getComputedStyle(layer).transform),
    );
  await page.waitForTimeout(250);
  const transformsAfter = await region
    .locator('[data-carousel-layer-item]')
    .evaluateAll((layers) =>
      layers.map((layer) => getComputedStyle(layer).transform),
    );
  expect(transformsAfter).toEqual(transformsBefore);

  await region.getByRole('button', { name: /^Previous /u }).click();
  await expect(region.getByRole('status')).toHaveText(
    `Item ${initial.total} of ${initial.total}`,
  );
});

test('enhancement mounts without console, page, or hydration warnings', async ({
  page,
}) => {
  const messages: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`));

  await page.goto('/');
  await carouselRoots(page);
  expect(messages).toEqual([]);
});
