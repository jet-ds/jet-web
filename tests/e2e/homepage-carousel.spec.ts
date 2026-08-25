import { expect, test, type Locator, type Page } from '@playwright/test';
import { resolvedPublishedCollections } from '../support/publishedContent';

const expectedHomepageSections = () => {
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
  ];
};

const expectedCarouselSections = () =>
  expectedHomepageSections().filter(({ records }) => records.length > 0);

async function carouselRoots(page: Page) {
  const roots = page.locator('[data-home-collection-carousel]');
  await expect(roots).toHaveCount(expectedCarouselSections().length);
  return roots;
}

async function waitForCarouselEnhancement(page: Page) {
  await carouselRoots(page);
  for (const { label } of expectedCarouselSections()) {
    const root = carouselRoot(page, label);
    const fallback = root.locator('[data-carousel-fallback]');
    await expect(root.getByRole('region')).toBeVisible();
    await expect(fallback).toHaveAttribute('hidden', '');
    await expect(fallback).toHaveAttribute('inert', '');
    await expect(fallback).toHaveAttribute('aria-hidden', 'true');
  }
}

async function crossPostEnhancementBoundary(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => queueMicrotask(resolve));
      }),
  );
}

function carouselRoot(page: Page, label: string) {
  return page.locator(
    `[data-home-collection-carousel][data-carousel-label="${label}"]`,
  );
}

async function position(
  region: Locator,
): Promise<{ current: number; total: number }> {
  const text = await region.getByRole('status').innerText();
  const match = text.match(/^Item (\d+) of (\d+)$/u);
  if (match === null) throw new Error(`Unexpected carousel position: ${text}`);
  return { current: Number(match[1]), total: Number(match[2]) };
}

async function findHitTestableTarget(control: Locator) {
  return control.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const step = 4;
    const minimum = 44;
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(window.innerWidth, rect.right);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    const columns = Math.floor((right - left) / step) + 1;
    const rows = Math.floor((bottom - top) / step) + 1;
    const span = Math.ceil(minimum / step) + 1;
    const hit = Array.from({ length: rows }, (_, row) =>
      Array.from({ length: columns }, (_, column) => {
        const target = document.elementFromPoint(
          left + column * step,
          top + row * step,
        );
        return (
          target === element || (target !== null && element.contains(target))
        );
      }),
    );

    for (let row = 0; row + span <= rows; row += 1) {
      for (let column = 0; column + span <= columns; column += 1) {
        let complete = true;
        for (
          let innerRow = row;
          innerRow < row + span && complete;
          innerRow += 1
        ) {
          for (
            let innerColumn = column;
            innerColumn < column + span;
            innerColumn += 1
          ) {
            if (!hit[innerRow][innerColumn]) {
              complete = false;
              break;
            }
          }
        }
        if (complete) {
          return {
            x: left + column * step + minimum / 2,
            y: top + row * step + minimum / 2,
            width: minimum,
            height: minimum,
          };
        }
      }
    }

    return null;
  });
}

test.describe('Homepage carousel fallback', () => {
  test.use({ javaScriptEnabled: false });

  test('keeps every finite canonical destination available without JavaScript', async ({
    page,
  }) => {
    await page.goto('/');
    await carouselRoots(page);

    for (const { label, records } of expectedCarouselSections()) {
      const root = carouselRoot(page, label);
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
  await carouselRoots(page);
  const eligibleSections = expectedCarouselSections().filter(
    ({ records }) => records.length >= 2,
  );
  test.skip(
    eligibleSections.length === 0,
    'No canonical homepage collection currently has at least two records',
  );

  for (const { label, records } of eligibleSections) {
    const root = carouselRoot(page, label);
    const fallback = root.locator('[data-carousel-fallback]');
    await expect(fallback).toHaveAttribute('hidden', '');
    await expect(fallback).toHaveAttribute('inert', '');
    await expect(fallback).toHaveAttribute('aria-hidden', 'true');

    const region = root.getByRole('region');
    const initial = await position(region);
    expect(initial).toEqual({ current: 1, total: records.length });
    await expect(region.getByRole('link')).toHaveCount(1);

    await region.getByRole('button', { name: /^Previous /u }).click();
    await expect(region.getByRole('status')).toHaveText(
      `Item ${records.length} of ${records.length}`,
    );
    await expect(region.getByRole('link')).toHaveCount(1);

    await region.getByRole('button', { name: /^Next /u }).click();
    await expect(region.getByRole('status')).toHaveText(
      `Item 1 of ${records.length}`,
    );
  }
});

test('owns arrow keys on focus and presents visible full-size controls', async ({
  page,
}) => {
  await page.goto('/');
  await carouselRoots(page);
  const section = expectedCarouselSections().find(
    ({ records }) => records.length >= 2,
  );
  test.skip(
    section === undefined,
    'No canonical homepage collection currently has at least two records',
  );
  if (section === undefined) return;
  const region = carouselRoot(page, section.label).getByRole('region');
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

  const receded = region.locator('button[data-carousel-depth="1"]');
  await receded.focus();
  const promotedId = await receded.getAttribute('data-carousel-layer-item');
  const promotedRecord = section.records.find(({ id }) => id === promotedId);
  expect(promotedRecord).toBeDefined();
  await page.keyboard.press('ArrowRight');
  await expect(region.getByRole('link')).toHaveAttribute(
    'href',
    promotedRecord?.href ?? '',
  );
  await expect(region.getByRole('link')).toBeFocused();

  const controls = region.locator('button:visible');
  for (const control of await controls.all()) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

for (const focusCase of [
  { width: 1024, height: 768, depth: 3, label: 'desktop deepest' },
  { width: 430, height: 932, depth: 2, label: 'mobile deepest' },
] as const) {
  test(`${focusCase.label} receded ArrowLeft preserves focus on the new active destination`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(focusCase);
    await page.goto('/');
    await carouselRoots(page);
    const section = expectedCarouselSections().find(
      ({ records }) => records.length >= 5,
    );
    test.skip(
      section === undefined,
      'No canonical homepage collection currently has five records',
    );
    if (section === undefined) return;
    const region = carouselRoot(page, section.label).getByRole('region');
    const receded = region.locator(
      `button[data-carousel-depth="${focusCase.depth}"]`,
    );

    await receded.focus();
    await page.keyboard.press('ArrowLeft');

    await expect(region.getByRole('link')).toHaveAttribute(
      'href',
      section.records.at(-1)?.href ?? '',
    );
    await expect(region.getByRole('link')).toBeFocused();
  });
}

test('commits a deliberate horizontal gesture without navigation or wheel capture', async ({
  page,
}) => {
  await page.goto('/');
  await carouselRoots(page);
  const section = expectedCarouselSections().find(
    ({ records }) => records.length >= 2,
  );
  test.skip(
    section === undefined,
    'No canonical homepage collection currently has at least two records',
  );
  if (section === undefined) return;
  const region = carouselRoot(page, section.label).getByRole('region');
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
    await carouselRoots(page);

    for (const { label, records } of expectedCarouselSections()) {
      const root = carouselRoot(page, label);
      const region = root.getByRole('region');
      const currentPosition = await position(region);
      expect(currentPosition.total).toBe(records.length);
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

for (const width of [320, 430]) {
  test(`mobile receded controls expose and activate 44px hit regions at ${width}px`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: width === 320 ? 568 : 932 });
    await page.goto('/');
    await carouselRoots(page);
    const section = expectedCarouselSections().find(
      ({ records }) => records.length >= 3,
    );
    test.skip(
      section === undefined,
      'No canonical homepage collection currently has three records',
    );
    if (section === undefined) return;
    const region = carouselRoot(page, section.label).getByRole('region');
    await region.scrollIntoViewIfNeeded();

    for (const depth of [1, 2]) {
      const control = region.locator(`button[data-carousel-depth="${depth}"]`);
      await expect(control).toBeVisible();
      const itemId = await control.getAttribute('data-carousel-layer-item');
      const expectedRecord = section.records.find(({ id }) => id === itemId);
      expect(expectedRecord).toBeDefined();
      const target = await findHitTestableTarget(control);
      expect(target, `depth ${depth} at ${width}px`).not.toBeNull();
      if (target === null || expectedRecord === undefined) return;
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
      await page.mouse.click(target.x, target.y);
      await expect(region.getByRole('link')).toHaveAttribute(
        'href',
        expectedRecord.href,
      );
    }
  });
}

test('reduced motion keeps manual circular state changes and an idle stage', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await carouselRoots(page);
  const section = expectedCarouselSections().find(
    ({ records }) => records.length >= 2,
  );
  test.skip(
    section === undefined,
    'No canonical homepage collection currently has at least two records',
  );
  if (section === undefined) return;
  const region = carouselRoot(page, section.label).getByRole('region');
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
  let releaseChunk: () => void = () => undefined;
  let signalChunkRequest: () => void = () => undefined;
  const chunkGate = new Promise<void>((resolve) => {
    releaseChunk = resolve;
  });
  const chunkRequested = new Promise<void>((resolve) => {
    signalChunkRequest = resolve;
  });
  await page.route(
    /\/_astro\/DepthCarousel\..+\.js(?:\?.*)?$/u,
    async (route) => {
      signalChunkRequest();
      await chunkGate;
      await route.continue();
    },
  );
  const messages: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`));

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const navigation = page.goto('/');
  await chunkRequested;
  await carouselRoots(page);
  let enhancementCompleted = false;
  const enhancement = waitForCarouselEnhancement(page).then(() => {
    enhancementCompleted = true;
  });
  try {
    for (const { label } of expectedCarouselSections()) {
      const root = carouselRoot(page, label);
      await expect(root.getByRole('region')).toHaveCount(0);
      await expect(
        root.locator('[data-carousel-fallback]'),
      ).not.toHaveAttribute('hidden', '');
    }
    await page.evaluate(() => Promise.resolve());
    expect(enhancementCompleted).toBe(false);
  } finally {
    releaseChunk();
    await navigation;
  }
  await enhancement;
  await crossPostEnhancementBoundary(page);
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(messages).toEqual([]);
});
