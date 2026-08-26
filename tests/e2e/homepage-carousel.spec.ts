import { expect, test, type Locator, type Page } from '@playwright/test';
import { resolvedPublishedCollections } from '../support/publishedContent';

const homepageSections = () => {
  const homepage = resolvedPublishedCollections().homepage;
  return [
    {
      label: 'Latest Articles',
      records: homepage.filter(({ kind }) => kind === 'blog'),
    },
    {
      label: 'Latest Works',
      records: homepage.filter(({ kind }) => kind !== 'blog'),
    },
  ].filter(({ records }) => records.length > 0);
};

function carouselRoot(page: Page, label: string): Locator {
  return page.locator(
    `[data-home-collection-carousel][data-carousel-label="${label}"]`,
  );
}

async function waitForCarousels(page: Page): Promise<void> {
  const sections = homepageSections();
  await expect(page.locator('[data-home-collection-carousel]')).toHaveCount(
    sections.length,
  );
  for (const { label } of sections) {
    await expect(carouselRoot(page, label).getByRole('region')).toBeVisible();
  }
}

async function firstInteractiveCarousel(page: Page): Promise<Locator> {
  const section = homepageSections().find(({ records }) => records.length >= 2);
  expect(
    section,
    'The Homepage carousel contract needs one collection with two destinations',
  ).toBeDefined();
  return carouselRoot(page, section?.label ?? '').getByRole('region');
}

async function activeHref(region: Locator): Promise<string> {
  const href = await region.getByRole('link').getAttribute('href');
  expect(href).not.toBeNull();
  return href ?? '';
}

async function findUnobstructed44PixelTarget(
  control: Locator,
): Promise<{ x: number; y: number; width: 44; height: 44 } | null> {
  return control.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const left = Math.max(0, Math.ceil(bounds.left));
    const top = Math.max(0, Math.ceil(bounds.top));
    const right = Math.min(window.innerWidth, Math.floor(bounds.right));
    const bottom = Math.min(window.innerHeight, Math.floor(bounds.bottom));
    const width = Math.max(0, right - left);
    const heights = Array.from({ length: width }, () => 0);

    for (let y = top; y < bottom; y += 1) {
      for (let column = 0; column < width; column += 1) {
        const target = document.elementFromPoint(left + column + 0.5, y + 0.5);
        heights[column] =
          target === element || (target !== null && element.contains(target))
            ? heights[column] + 1
            : 0;
      }

      const stack: number[] = [];
      for (let column = 0; column <= width; column += 1) {
        const height = column === width ? 0 : heights[column];
        while (stack.length > 0 && heights[stack.at(-1) ?? 0] > height) {
          const owner = stack.pop();
          if (owner === undefined) break;
          const candidateHeight = heights[owner];
          const candidateLeft =
            stack.length === 0 ? 0 : (stack.at(-1) ?? -1) + 1;
          const candidateWidth = column - candidateLeft;
          if (candidateWidth >= 44 && candidateHeight >= 44) {
            return {
              x: left + candidateLeft + 22,
              y: y - candidateHeight + 1 + 22,
              width: 44 as const,
              height: 44 as const,
            };
          }
        }
        stack.push(column);
      }
    }

    return null;
  });
}

test(
  'keeps every finite canonical destination available without JavaScript',
  { tag: '@desktop' },
  async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');

    for (const { label, records } of homepageSections()) {
      const root = carouselRoot(page, label);
      await expect(root.locator('[data-carousel-fallback]')).toBeVisible();
      await expect(root.getByRole('region')).toHaveCount(0);
      const destinations = await root
        .locator('[data-carousel-fallback] article a')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      expect(destinations).toEqual(records.map(({ href }) => href));
    }

    await context.close();
  },
);

test('loops manually while preserving one active destination and keyboard focus', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCarousels(page);
  const region = await firstInteractiveCarousel(page);
  const initialHref = await activeHref(region);

  await expect(region.getByRole('link')).toHaveCount(1);
  await region.getByRole('button', { name: /^Previous /u }).click();
  await expect(region.getByRole('link')).not.toHaveAttribute(
    'href',
    initialHref,
  );
  await region.getByRole('button', { name: /^Next /u }).click();
  await expect(region.getByRole('link')).toHaveAttribute('href', initialHref);

  const activeLink = region.getByRole('link');
  await activeLink.focus();
  await page.keyboard.press('ArrowRight');
  await expect(activeLink).toBeFocused();
  await expect(activeLink).not.toHaveAttribute('href', initialHref);

  const receded = region.getByRole('button', { name: /^Bring item /u }).first();
  await receded.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(activeLink).toBeFocused();

  for (const control of await region.locator('button:visible').all()) {
    const box = await control.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test(
  'commits a horizontal pointer gesture without capturing navigation or vertical scroll',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.goto('/');
    await waitForCarousels(page);
    const region = await firstInteractiveCarousel(page);
    const stage = region.locator('[data-carousel-stage]');
    const initialHref = await activeHref(region);
    await stage.scrollIntoViewIfNeeded();
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX - 96, centerY + 8, { steps: 8 });
    await page.mouse.up();
    await expect(region.getByRole('link')).not.toHaveAttribute(
      'href',
      initialHref,
    );
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(stage).toHaveCSS('touch-action', 'pan-y');

    const beforeScroll = await page.evaluate(() => window.scrollY);
    await stage.hover();
    await page.mouse.wheel(0, 360);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(beforeScroll);
  },
);

test(
  'keeps compact and desktop depth geometry finite across the 767px handoff',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const viewport of [
      { width: 320, height: 700 },
      { width: 430, height: 932 },
      { width: 767, height: 900 },
      { width: 768, height: 900 },
      { width: 1024, height: 768 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await waitForCarousels(page);

      for (const { label, records } of homepageSections()) {
        const region = carouselRoot(page, label).getByRole('region');
        const visibleLayers = region.locator(
          '[data-carousel-layer-item]:visible',
        );
        const expectedReceded = viewport.width < 768 ? 2 : 3;
        await expect(visibleLayers).toHaveCount(
          Math.min(records.length, expectedReceded + 1),
        );
        const layerIds = await visibleLayers.evaluateAll((layers) =>
          layers.map((layer) => layer.getAttribute('data-carousel-layer-item')),
        );
        expect(layerIds.every((id) => id !== null)).toBe(true);
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

        const companion = region.locator('[data-carousel-role="companion"]');
        const companionBox = await companion.boundingBox();
        expect(companionBox?.width ?? Infinity).toBeLessThanOrEqual(480.5);
        await expect(companion).toHaveCSS('transform', 'none');

        const firstReceded = region.locator('[data-carousel-depth="1"]');
        if ((await firstReceded.count()) > 0) {
          const recededBox = await firstReceded.boundingBox();
          expect(recededBox).not.toBeNull();
          if (activeBox !== null && recededBox !== null) {
            const horizontalShift = Math.abs(
              recededBox.x +
                recededBox.width / 2 -
                (activeBox.x + activeBox.width / 2),
            );
            const verticalShift = Math.abs(
              recededBox.y +
                recededBox.height / 2 -
                (activeBox.y + activeBox.height / 2),
            );
            if (viewport.width < 768)
              expect(verticalShift).toBeGreaterThan(horizontalShift);
            else expect(horizontalShift).toBeGreaterThan(verticalShift);
          }
        }
      }

      const overflow = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
    }
  },
);

test(
  'exposes and activates a real 44px hit region for every visible receded mobile depth',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const viewport of [
      { width: 320, height: 700 },
      { width: 430, height: 932 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await waitForCarousels(page);
      const region = await firstInteractiveCarousel(page);
      await region.scrollIntoViewIfNeeded();
      const recededDepths = await region
        .getByRole('button', { name: /^Bring item /u })
        .evaluateAll((controls) =>
          controls
            .filter((control) => control.checkVisibility())
            .map((control) => control.getAttribute('data-carousel-depth')),
        );
      expect(recededDepths.length).toBeGreaterThan(0);

      for (const depth of recededDepths) {
        expect(depth).not.toBeNull();
        const control = region.locator(
          `button[data-carousel-depth="${depth ?? ''}"]`,
        );
        await expect(control).toBeVisible();
        const itemId = await control.getAttribute('data-carousel-layer-item');
        expect(itemId).not.toBeNull();
        const previousHref = await activeHref(region);
        const target = await findUnobstructed44PixelTarget(control);
        expect(
          target,
          `visible receded depth ${depth} at ${viewport.width}px`,
        ).not.toBeNull();
        if (target === null) continue;
        await page.touchscreen.tap(target.x, target.y);
        await expect(
          region.locator('[data-carousel-depth="0"]'),
        ).toHaveAttribute('data-carousel-layer-item', itemId ?? '');
        await expect(region.getByRole('link')).not.toHaveAttribute(
          'href',
          previousHref,
        );
      }
    }
  },
);

test('honors reduced motion and remains idle without autoplay', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-08-26T00:00:00Z') });
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/');
    await waitForCarousels(page);
    const region = await firstInteractiveCarousel(page);

    const hrefBefore = await activeHref(region);
    await page.clock.fastForward('10:00');
    expect(await activeHref(region)).toBe(hrefBefore);
    if (reducedMotion === 'reduce') {
      expect(
        await region.evaluate(
          (element) =>
            element
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === 'running').length,
        ),
      ).toBe(0);
    }

    await region.getByRole('button', { name: /^Previous /u }).click();
    await expect(region.getByRole('link')).not.toHaveAttribute(
      'href',
      hrefBefore,
    );
  }
});
