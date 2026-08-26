import { expect, test, type Locator, type Page } from '@playwright/test';
import { resolvedPublishedCollections } from '../support/publishedContent';

const homepageSections = () => {
  const homepage = resolvedPublishedCollections().homepage;
  return [
    {
      heading: 'Blog',
      label: 'Latest Articles',
      records: homepage.filter(({ kind }) => kind === 'blog'),
    },
    {
      heading: 'Works',
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
    const root = carouselRoot(page, label);
    const sentinel = root.locator('[data-carousel-sentinel]');
    if ((await sentinel.count()) > 0) await sentinel.scrollIntoViewIfNeeded();
    await expect(root.getByRole('region')).toBeVisible();
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

interface GeometryFrame {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface PromotionEvidence {
  connected: boolean;
  samples: GeometryFrame[];
  start: GeometryFrame;
}

function frameDistance(first: GeometryFrame, second: GeometryFrame): number {
  return Math.hypot(
    first.x - second.x,
    first.y - second.y,
    first.width - second.width,
    first.height - second.height,
  );
}

async function waitForStableGeometry(locator: Locator): Promise<void> {
  let previous: GeometryFrame | null = null;
  await expect
    .poll(async () => {
      const current = await locator.boundingBox();
      const stable =
        current !== null &&
        previous !== null &&
        frameDistance(current, previous) <= 0.5;
      previous = current;
      return stable;
    })
    .toBe(true);
}

async function installPromotionRecorder(layer: Locator): Promise<void> {
  await layer.evaluate((element) => {
    type RecordedLayer = HTMLElement & {
      __promotion?: {
        done: boolean;
        evidence?: PromotionEvidence;
      };
    };
    const owner = element as RecordedLayer;
    const frame = (): GeometryFrame => {
      const bounds = element.getBoundingClientRect();
      return {
        height: bounds.height,
        width: bounds.width,
        x: bounds.x,
        y: bounds.y,
      };
    };
    const start = frame();
    const samples: GeometryFrame[] = [];
    const deadline = performance.now() + 1_500;
    let connected = true;
    let hasMoved = false;
    let previous = start;
    let stableFrames = 0;
    owner.__promotion = { done: false };

    const sample = () => {
      connected &&= element.isConnected;
      const current = frame();
      samples.push(current);
      hasMoved ||=
        Math.hypot(
          current.x - start.x,
          current.y - start.y,
          current.width - start.width,
          current.height - start.height,
        ) > 2;
      if (
        hasMoved &&
        element.querySelector('a[href]') !== null &&
        Math.hypot(
          current.x - previous.x,
          current.y - previous.y,
          current.width - previous.width,
          current.height - previous.height,
        ) <= 0.5
      ) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
      }
      previous = current;
      if (stableFrames < 2 && performance.now() < deadline) {
        requestAnimationFrame(sample);
        return;
      }
      owner.__promotion = {
        done: true,
        evidence: { connected, samples, start },
      };
    };

    requestAnimationFrame(sample);
  });
}

async function readPromotionEvidence(
  layer: Locator,
): Promise<PromotionEvidence> {
  await expect
    .poll(() =>
      layer.evaluate(
        (element) =>
          (
            element as HTMLElement & {
              __promotion?: { done: boolean };
            }
          ).__promotion?.done ?? false,
      ),
    )
    .toBe(true);

  return layer.evaluate((element) => {
    const evidence = (
      element as HTMLElement & {
        __promotion?: { evidence?: PromotionEvidence };
      }
    ).__promotion?.evidence;
    if (evidence === undefined) {
      throw new Error('Promotion evidence is missing.');
    }
    return evidence;
  });
}

async function expectAssistiveOnly(status: Locator): Promise<void> {
  const box = await status.boundingBox();
  expect(box?.width ?? Infinity).toBeLessThanOrEqual(1);
  expect(box?.height ?? Infinity).toBeLessThanOrEqual(1);
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

    await expect(page.locator('[data-home-reveal]')).toHaveCount(7);
    for (const target of await page.locator('[data-home-reveal]').all()) {
      await expect(target).toHaveCSS('opacity', '1');
      await expect(target).toHaveCSS('transform', 'none');
      expect(await target.getAttribute('data-home-reveal-state')).toBeNull();
    }

    await context.close();
  },
);

test(
  'reveals only offscreen Homepage section groups as one-time coherent targets',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 420 });
    await page.goto('/');

    const scope = page.locator('[data-home-reveal-scope]');
    const targets = scope.locator('[data-home-reveal]');
    await expect(targets).toHaveCount(7);
    await expect(page.locator('footer [data-home-reveal]')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Works' }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('heading', { name: "Hi, I'm Jet Sanchez." })
        .locator('xpath=ancestor-or-self::*[@data-home-reveal]'),
    ).toHaveCount(0);

    const articleHeadingGroup = page
      .getByRole('heading', { name: 'Blog' })
      .locator('xpath=parent::*');
    await expect(articleHeadingGroup).toHaveAttribute(
      'data-home-reveal-state',
      'pending',
    );
    await expect(articleHeadingGroup).toHaveCSS('opacity', '0');
    expect(
      await articleHeadingGroup.evaluate(
        (element) => getComputedStyle(element).transform,
      ),
    ).not.toBe('none');

    await articleHeadingGroup.scrollIntoViewIfNeeded();
    await expect(articleHeadingGroup).toHaveAttribute(
      'data-home-reveal-state',
      'revealed',
    );
    await expect(articleHeadingGroup).toHaveCSS('opacity', '1');
    await expect
      .poll(() =>
        articleHeadingGroup.evaluate(
          (element) => getComputedStyle(element).transform,
        ),
      )
      .toBe('none');

    const carouselTarget = carouselRoot(page, 'Latest Articles').locator(
      'xpath=parent::*[@data-home-reveal="component"]',
    );
    await expect(carouselTarget).toHaveCount(1);
    await expect(carouselTarget.locator('[data-home-reveal]')).toHaveCount(0);
    const ctaTargets = scope.locator('[data-home-reveal-group="cta"]');
    await expect(ctaTargets).toHaveCount(3);
    expect(
      await ctaTargets.evaluateAll((elements) =>
        elements.map((element) =>
          element.getAttribute('data-home-reveal-order'),
        ),
      ),
    ).toEqual(['0', '1', '2']);
  },
);

test(
  'shows final Homepage reveal state without interpolation for reduced motion',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 420 });
    await page.goto('/');

    const targets = page.locator('[data-home-reveal-scope] [data-home-reveal]');
    await expect(targets).toHaveCount(7);
    for (const target of await targets.all()) {
      await expect(target).toHaveAttribute(
        'data-home-reveal-state',
        'revealed',
      );
      await expect(target).toHaveCSS('opacity', '1');
      await expect(target).toHaveCSS('transform', 'none');
      await expect(target).toHaveCSS('transition-duration', '0s');
    }
  },
);

test(
  'keeps the complete fallback and carousel chunk behind the visible sentinel',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 420 });
    const carouselRequests: string[] = [];
    page.on('request', (request) => {
      if (
        /\/DepthCarousel\.[^/]+\.js$/u.test(new URL(request.url()).pathname)
      ) {
        carouselRequests.push(request.url());
      }
    });

    await page.goto('/');
    const firstSection = homepageSections()[0];
    expect(firstSection).toBeDefined();
    if (firstSection === undefined) return;
    const root = carouselRoot(page, firstSection.label);
    const fallback = root.locator('[data-carousel-fallback]');
    const sentinel = root.locator('[data-carousel-sentinel]');

    await expect(fallback).toBeVisible();
    await expect(root.getByRole('region')).toHaveCount(0);
    expect(
      await fallback
        .locator('article a')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
    ).toEqual(firstSection.records.map(({ href }) => href));
    await expect(sentinel).toHaveCount(1);
    expect(await sentinel.getAttribute('aria-hidden')).toBe('true');
    expect(await sentinel.getAttribute('inert')).not.toBeNull();
    const sentinelBox = await sentinel.boundingBox();
    expect(sentinelBox?.width ?? 0).toBeGreaterThan(0);
    expect(sentinelBox?.height ?? 0).toBeGreaterThan(0);
    expect(carouselRequests).toEqual([]);

    for (const { label } of homepageSections()) {
      const islandProps = await carouselRoot(page, label)
        .locator('astro-island')
        .getAttribute('props');
      expect(islandProps).not.toContain('"search"');
    }

    await sentinel.scrollIntoViewIfNeeded();
    await expect.poll(() => carouselRequests.length).toBe(1);
    await expect(root.getByRole('region')).toBeVisible();
    await expect(sentinel).toHaveCount(0);
    await expect(fallback).toBeHidden();
  },
);

test(
  'does not cascade an offscreen Works enhancement when the Blog fallback hands off',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 420 });
    await page.goto('/');
    const [articles, works] = homepageSections();
    expect(articles).toBeDefined();
    expect(works).toBeDefined();
    if (articles === undefined || works === undefined) return;

    const articleRoot = carouselRoot(page, articles.label);
    const worksRoot = carouselRoot(page, works.label);
    await expect(articleRoot.getByRole('region')).toHaveCount(0);
    await expect(worksRoot.getByRole('region')).toHaveCount(0);
    await articleRoot
      .locator('[data-carousel-sentinel]')
      .scrollIntoViewIfNeeded();
    await expect(articleRoot.getByRole('region')).toBeVisible();

    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    await expect(worksRoot.locator('[data-carousel-sentinel]')).toHaveCount(1);
    await expect(worksRoot.getByRole('region')).toHaveCount(0);
    await expect(worksRoot.locator('[data-carousel-fallback]')).toBeVisible();
  },
);

test(
  'serves every enhanced carousel image locally without Blob requests',
  { tag: '@desktop' },
  async ({ page }) => {
    const blobRequests: string[] = [];
    await page.route(
      /https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\/.+/u,
      async (route) => {
        blobRequests.push(route.request().url());
        await route.abort('blockedbyclient');
      },
    );

    await page.goto('/');
    await waitForCarousels(page);

    for (const { label, records } of homepageSections()) {
      const region = carouselRoot(page, label).getByRole('region');
      for (const [itemIndex, record] of records.entries()) {
        if (itemIndex > 0) {
          await region
            .getByRole('button', {
              name: `Go to item ${itemIndex + 1} of ${records.length}`,
            })
            .click();
        }

        const destination = region.getByRole('link');
        await expect(destination).toHaveAttribute('href', record.href);
        const image = destination.locator('img');
        await expect(image).toHaveCount(1);
        await expect
          .poll(() =>
            image.evaluate(
              (element) =>
                element instanceof HTMLImageElement &&
                element.complete &&
                element.naturalWidth > 0,
            ),
          )
          .toBe(true);
        const evidence = await image.evaluate((element) => {
          if (!(element instanceof HTMLImageElement)) {
            throw new TypeError('Active carousel image is not an img element.');
          }
          return {
            height: element.naturalHeight,
            src: element.currentSrc,
            width: element.naturalWidth,
          };
        });
        expect(new URL(evidence.src).origin).toBe(new URL(page.url()).origin);
        expect(evidence.width / evidence.height).toBeCloseTo(16 / 9, 3);
      }
    }

    expect(blobRequests).toEqual([]);
  },
);

test(
  'keeps an adaptive centered canvas with mirrored desktop rails and fixed controls',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await waitForCarousels(page);

      for (const {
        heading: headingName,
        label,
        records,
      } of homepageSections()) {
        const root = carouselRoot(page, label);
        const section = root.locator('xpath=ancestor::section[1]');
        const region = root.getByRole('region');
        const active = region.getByRole('link');
        const heading = section.getByRole('heading', { name: headingName });
        const viewAll = section.getByRole('link', { name: /View all/u });
        const previous = region.getByRole('button', { name: /^Previous /u });
        const next = region.getByRole('button', { name: /^Next /u });
        const firstIndicator = region
          .getByRole('button', { name: /^Go to item /u })
          .first();
        const indicators = firstIndicator.locator('xpath=..');
        const promotionControls = region.getByRole('button', {
          name: /^Bring item /u,
        });

        const [
          sectionBox,
          regionBox,
          activeBox,
          headingBox,
          viewAllBox,
          previousBox,
          nextBox,
          indicatorsBox,
        ] = await Promise.all([
          section.boundingBox(),
          region.boundingBox(),
          active.boundingBox(),
          heading.boundingBox(),
          viewAll.boundingBox(),
          previous.boundingBox(),
          next.boundingBox(),
          indicators.boundingBox(),
        ]);
        expect(sectionBox).not.toBeNull();
        expect(regionBox).not.toBeNull();
        expect(activeBox).not.toBeNull();
        if (
          sectionBox === null ||
          regionBox === null ||
          activeBox === null ||
          headingBox === null ||
          viewAllBox === null ||
          previousBox === null ||
          nextBox === null ||
          indicatorsBox === null
        ) {
          continue;
        }

        expect(regionBox.x).toBeCloseTo(sectionBox.x, 0);
        expect(regionBox.width).toBeCloseTo(sectionBox.width, 0);
        const sectionCenter = sectionBox.x + sectionBox.width / 2;
        const activeCenter = activeBox.x + activeBox.width / 2;
        expect(Math.abs(activeCenter - sectionCenter)).toBeLessThanOrEqual(2);
        expect(
          Math.abs(headingBox.x + headingBox.width / 2 - sectionCenter),
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(viewAllBox.x + viewAllBox.width / 2 - sectionCenter),
        ).toBeLessThanOrEqual(1);
        expect(viewAllBox.y).toBeGreaterThanOrEqual(
          headingBox.y + headingBox.height,
        );

        expect(activeBox.width).toBeLessThanOrEqual(576.5);
        expect(activeBox.height).toBeLessThanOrEqual(324.5);
        expect(activeBox.width / activeBox.height).toBeCloseTo(16 / 9, 1);
        expect(previousBox.width).toBeGreaterThanOrEqual(44);
        expect(previousBox.height).toBeGreaterThanOrEqual(44);
        expect(nextBox.width).toBeGreaterThanOrEqual(44);
        expect(nextBox.height).toBeGreaterThanOrEqual(44);
        expect(indicatorsBox.y).toBeGreaterThanOrEqual(
          activeBox.y + activeBox.height,
        );

        const expectedPromotions = Math.min(
          records.length - 1,
          viewport.width < 768 ? 2 : 6,
        );
        await expect(promotionControls).toHaveCount(expectedPromotions);
        const promotionNames = await promotionControls.evaluateAll((buttons) =>
          buttons.map((button) => button.getAttribute('aria-label')),
        );
        expect(new Set(promotionNames).size).toBe(promotionNames.length);

        if (viewport.width < 768) {
          expect(previousBox.y).toBeGreaterThanOrEqual(
            activeBox.y + activeBox.height,
          );
          expect(nextBox.y).toBeGreaterThanOrEqual(
            activeBox.y + activeBox.height,
          );
        } else {
          expect(previousBox.x + previousBox.width).toBeLessThanOrEqual(
            activeBox.x,
          );
          expect(nextBox.x).toBeGreaterThanOrEqual(
            activeBox.x + activeBox.width,
          );

          const promotionBoxes = (
            await Promise.all(
              (await promotionControls.all()).map((control) =>
                control.locator('xpath=..').boundingBox(),
              ),
            )
          ).filter((box) => box !== null);
          const leftDistances = promotionBoxes
            .map((box) => activeCenter - (box.x + box.width / 2))
            .filter((distance) => distance > 0)
            .sort((left, right) => left - right);
          const rightDistances = promotionBoxes
            .map((box) => box.x + box.width / 2 - activeCenter)
            .filter((distance) => distance > 0)
            .sort((left, right) => left - right);
          expect(leftDistances.length).toBeGreaterThan(0);
          expect(rightDistances.length).toBeGreaterThan(0);
          expect(leftDistances[0]).toBeCloseTo(rightDistances[0] ?? 0, 0);
        }
      }

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width);
    }
  },
);

test(
  'bounds connected two-axis drag to the section while controls stay above the cards',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await waitForCarousels(page);

    const { heading: headingName, label } = homepageSections()[0] ?? {};
    expect(label).toBeDefined();
    if (label === undefined || headingName === undefined) return;
    const root = carouselRoot(page, label);
    const section = root.locator('xpath=ancestor::section[1]');
    const region = root.getByRole('region');
    const active = region.getByRole('link');
    const receded = region
      .getByRole('button', { name: /^Bring item /u })
      .first()
      .locator('xpath=..');
    const heading = section.getByRole('heading', { name: headingName });
    const previous = region.getByRole('button', { name: /^Previous /u });
    const indicators = region
      .getByRole('button', { name: /^Go to item /u })
      .first()
      .locator('xpath=..');
    await active.scrollIntoViewIfNeeded();
    await waitForStableGeometry(active);
    await waitForStableGeometry(receded);

    const [
      sectionBefore,
      activeBefore,
      recededBefore,
      headingBefore,
      previousBefore,
      indicatorsBefore,
    ] = await Promise.all([
      section.boundingBox(),
      active.boundingBox(),
      receded.boundingBox(),
      heading.boundingBox(),
      previous.boundingBox(),
      indicators.boundingBox(),
    ]);
    if (
      sectionBefore === null ||
      activeBefore === null ||
      recededBefore === null ||
      headingBefore === null ||
      previousBefore === null ||
      indicatorsBefore === null
    ) {
      throw new Error('Carousel drag geometry is unavailable.');
    }

    const initialHref = await activeHref(region);
    const centerX = activeBefore.x + activeBefore.width / 2;
    const centerY = activeBefore.y + activeBefore.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(1, centerY - 96, { steps: 12 });

    await expect
      .poll(async () => {
        const [activeDuring, recededDuring] = await Promise.all([
          active.boundingBox(),
          receded.boundingBox(),
        ]);
        if (activeDuring === null || recededDuring === null) return false;
        const activeShift = activeBefore.x - activeDuring.x;
        const recededShift = recededBefore.x - recededDuring.x;
        return (
          activeShift > 200 &&
          activeBefore.y - activeDuring.y > 48 &&
          recededShift > 40 &&
          recededShift < activeShift
        );
      })
      .toBe(true);

    const [
      activeDuring,
      recededDuring,
      headingDuring,
      previousDuring,
      indicatorsDuring,
    ] = await Promise.all([
      active.boundingBox(),
      receded.boundingBox(),
      heading.boundingBox(),
      previous.boundingBox(),
      indicators.boundingBox(),
    ]);
    if (activeDuring === null || recededDuring === null) {
      await page.mouse.up();
      throw new Error('Carousel cards disappeared during drag.');
    }

    expect(activeDuring.x).toBeGreaterThanOrEqual(sectionBefore.x);
    expect(activeDuring.y).toBeGreaterThanOrEqual(sectionBefore.y);
    expect(activeDuring.x + activeDuring.width).toBeLessThanOrEqual(
      sectionBefore.x + sectionBefore.width,
    );
    expect(headingDuring).toEqual(headingBefore);
    expect(previousDuring).toEqual(previousBefore);
    expect(indicatorsDuring).toEqual(indicatorsBefore);
    expect(
      await previous.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const target = document.elementFromPoint(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        );
        return (
          target === element || (target !== null && element.contains(target))
        );
      }),
    ).toBe(true);

    await page.mouse.up();
    await expect(region.getByRole('link')).not.toHaveAttribute(
      'href',
      initialHref,
    );
    expect(new URL(page.url()).pathname).toBe('/');
    const committedHref = await activeHref(region);
    await previous.click();
    await expect(region.getByRole('link')).not.toHaveAttribute(
      'href',
      committedHref,
    );

    await active.hover();
    const beforeScroll = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 360);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(beforeScroll);
  },
);

test(
  'uses mustard chevrons with neutral control borders in both themes',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    for (const theme of ['light', 'dark'] as const) {
      await page.goto('/');
      await page.evaluate((selectedTheme) => {
        localStorage.setItem('theme', selectedTheme);
      }, theme);
      await page.reload();
      await waitForCarousels(page);

      for (const { label } of homepageSections()) {
        const region = carouselRoot(page, label).getByRole('region');
        const previous = region.getByRole('button', { name: /^Previous /u });
        const activeDot = region.locator('[aria-current="step"] span').first();
        const colors = await previous.evaluate((element) => ({
          border: getComputedStyle(element).borderColor,
          glyph: getComputedStyle(element.querySelector('svg') ?? element)
            .stroke,
          mustard: (() => {
            const probe = document.createElement('span');
            probe.style.color = 'var(--color-accent-base)';
            document.body.append(probe);
            const color = getComputedStyle(probe).color;
            probe.remove();
            return color;
          })(),
          neutralBorder: (() => {
            const probe = document.createElement('button');
            probe.style.border = '1px solid var(--color-border-default)';
            document.body.append(probe);
            const color = getComputedStyle(probe).borderColor;
            probe.remove();
            return color;
          })(),
          restingBackground: getComputedStyle(element).backgroundColor,
        }));
        expect(colors.glyph).toBe(colors.mustard);
        expect(colors.border).toBe(colors.neutralBorder);
        expect(
          await activeDot.evaluate(
            (element) => getComputedStyle(element).backgroundColor,
          ),
        ).toBe(
          await activeDot.evaluate(() =>
            (() => {
              const probe = document.createElement('span');
              probe.style.backgroundColor = 'var(--color-accent-base)';
              document.body.append(probe);
              const color = getComputedStyle(probe).backgroundColor;
              probe.remove();
              return color;
            })(),
          ),
        );
        await previous.hover();
        await expect
          .poll(() =>
            previous.evaluate(
              (element) => getComputedStyle(element).backgroundColor,
            ),
          )
          .not.toBe(colors.restingBackground);
        await previous.focus();
        await expect(previous).toHaveCSS('outline-style', 'solid');
      }
    }
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
  await expect(region.getByRole('status')).toContainText('Item 1 of');
  await expectAssistiveOnly(region.getByRole('status'));
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
  'promotes the same canonical card along a continuous trajectory',
  { tag: '@desktop' },
  async ({ page }) => {
    const articleSection = homepageSections().find(
      ({ label, records }) =>
        label === 'Latest Articles' && records.length >= 2,
    );
    expect(articleSection).toBeDefined();
    if (articleSection === undefined) return;

    await page.goto('/');
    await waitForCarousels(page);
    const region = carouselRoot(page, articleSection.label).getByRole('region');
    await region.scrollIntoViewIfNeeded();
    const promotedRecord = articleSection.records[1];
    expect(promotedRecord).toBeDefined();
    if (promotedRecord === undefined) return;

    const promotion = region.getByRole('button', {
      name: `Bring item 2 of ${articleSection.records.length} forward`,
    });
    await promotion.evaluate((button) => {
      button.parentElement?.setAttribute('data-audit-promotion', 'target');
    });
    const layer = region.locator('[data-audit-promotion="target"]');
    await installPromotionRecorder(layer);
    await region.getByRole('button', { name: /^Next /u }).click();

    const evidence = await readPromotionEvidence(layer);
    const finish = evidence.samples.at(-1);
    expect(evidence.connected).toBe(true);
    expect(finish).toBeDefined();
    if (finish === undefined) return;

    const travel = frameDistance(evidence.start, finish);
    expect(travel).toBeGreaterThan(12);
    expect(
      evidence.samples.some(
        (sample) =>
          frameDistance(sample, evidence.start) > travel * 0.15 &&
          frameDistance(sample, finish) > travel * 0.15,
      ),
    ).toBe(true);
    await expect(layer.getByRole('link')).toHaveAttribute(
      'href',
      promotedRecord.href,
    );
  },
);

test(
  'springs a sub-threshold diagonal gesture back to stable settled positions',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.goto('/');
    await waitForCarousels(page);
    for (const { label, records } of homepageSections()) {
      if (records.length < 2) continue;
      const region = carouselRoot(page, label).getByRole('region');
      const active = region.getByRole('link');
      const receded = region
        .getByRole('button', { name: /^Bring item /u })
        .first()
        .locator('xpath=..');
      await active.scrollIntoViewIfNeeded();
      await waitForStableGeometry(active);
      await waitForStableGeometry(receded);
      const initialHref = await activeHref(region);
      const activeBefore = await active.boundingBox();
      const recededBefore = await receded.boundingBox();
      expect(activeBefore).not.toBeNull();
      expect(recededBefore).not.toBeNull();
      if (activeBefore === null || recededBefore === null) continue;

      const centerX = activeBefore.x + activeBefore.width / 2;
      const centerY = activeBefore.y + activeBefore.height / 2;
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.mouse.move(centerX - 30, centerY + 18, { steps: 6 });
      await expect
        .poll(async () => {
          const [activeDuring, recededDuring] = await Promise.all([
            active.boundingBox(),
            receded.boundingBox(),
          ]);
          return (
            (activeDuring?.y ?? activeBefore.y) - activeBefore.y > 4 &&
            (recededDuring?.y ?? recededBefore.y) - recededBefore.y > 1
          );
        })
        .toBe(true);
      const [activeDuring, recededDuring] = await Promise.all([
        active.boundingBox(),
        receded.boundingBox(),
      ]);
      expect(
        (activeDuring?.y ?? activeBefore.y) - activeBefore.y,
      ).toBeGreaterThan(4);
      expect(
        (recededDuring?.y ?? recededBefore.y) - recededBefore.y,
      ).toBeGreaterThan(1);
      await page.mouse.up();

      await expect(region.getByRole('link')).toHaveAttribute(
        'href',
        initialHref,
      );
      await expect
        .poll(async () => {
          const [activeAfter, recededAfter] = await Promise.all([
            active.boundingBox(),
            receded.boundingBox(),
          ]);
          return [
            Math.abs((activeAfter?.x ?? 0) - activeBefore.x),
            Math.abs((activeAfter?.y ?? 0) - activeBefore.y),
            Math.abs((recededAfter?.x ?? 0) - recededBefore.x),
            Math.abs((recededAfter?.y ?? 0) - recededBefore.y),
          ].every((difference) => difference <= 1);
        })
        .toBe(true);
    }
  },
);

test(
  'preserves vertical touch scrolling without changing the active item',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/');
    await waitForCarousels(page);
    const region = await firstInteractiveCarousel(page);
    const active = region.getByRole('link');
    await active.scrollIntoViewIfNeeded();
    const initialHref = await activeHref(region);
    const activeBox = await active.boundingBox();
    expect(activeBox).not.toBeNull();
    if (activeBox === null) return;

    const beforeScroll = await page.evaluate(() => window.scrollY);
    const client = await page.context().newCDPSession(page);
    const startX = activeBox.x + activeBox.width / 2;
    const startY = activeBox.y + activeBox.height / 2;
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY }],
    });
    for (let step = 1; step <= 6; step += 1) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: startX + 4, y: startY - step * 24 }],
      });
    }
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(beforeScroll + 20);
    await expect(region.getByRole('link')).toHaveAttribute('href', initialHref);
  },
);

test(
  'reveals desktop metadata without moving the card and keeps touch facts stable',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');
    await waitForCarousels(page);

    for (const { label, records } of homepageSections()) {
      const first = records[0];
      expect(first).toBeDefined();
      if (first === undefined) continue;

      const region = carouselRoot(page, label).getByRole('region');
      await region.scrollIntoViewIfNeeded();
      const destination = region.getByRole('link');
      let heading = destination.getByRole('heading', { name: first.title });
      let summary = destination.getByText(first.summary, { exact: true });
      let facts = destination.getByRole('list');
      await page.mouse.move(0, 0);

      const before = await destination.boundingBox();
      const headingAtRest = await heading.boundingBox();
      expect(before).not.toBeNull();
      expect(headingAtRest).not.toBeNull();
      if (before !== null && headingAtRest !== null) {
        expect(
          before.y + before.height - (headingAtRest.y + headingAtRest.height),
        ).toBeLessThanOrEqual(32);
      }
      await expect(summary).toHaveCSS('opacity', '0');
      await expect(facts).toHaveCSS('opacity', '0');

      await destination.hover();
      await expect(summary).toHaveCSS('opacity', '1');
      await expect(facts).toHaveCSS('opacity', '1');
      const headingExpanded = await heading.boundingBox();
      if (headingAtRest !== null && headingExpanded !== null) {
        expect(headingExpanded.y).toBeLessThan(headingAtRest.y);
      }
      expect(await destination.boundingBox()).toEqual(before);

      await destination.focus();
      await expect(summary).toHaveCSS('opacity', '1');
      await expect(facts).toHaveCSS('opacity', '1');
      expect(await destination.boundingBox()).toEqual(before);

      for (const [itemIndex, record] of records.entries()) {
        if (itemIndex > 0) {
          await region
            .getByRole('button', {
              name: `Go to item ${itemIndex + 1} of ${records.length}`,
            })
            .click();
          await expect(destination).toHaveAttribute('href', record.href);
        }

        heading = destination.getByRole('heading', { name: record.title });
        summary = destination.getByText(record.summary, { exact: true });
        facts = destination.getByRole('list');
        await destination.hover();
        await expect(summary).toHaveCSS('opacity', '1');
        await expect(facts).toHaveCSS('opacity', '1');
        const [cardBox, headingBox, summaryBox, factsBox] = await Promise.all([
          destination.boundingBox(),
          heading.boundingBox(),
          summary.boundingBox(),
          facts.boundingBox(),
        ]);
        if (
          cardBox === null ||
          headingBox === null ||
          summaryBox === null ||
          factsBox === null
        ) {
          throw new Error('Carousel metadata geometry is unavailable.');
        }
        expect(
          summaryBox.y - (headingBox.y + headingBox.height),
        ).toBeGreaterThanOrEqual(6);
        expect(headingBox.y).toBeGreaterThanOrEqual(cardBox.y);
        expect(summaryBox.y).toBeGreaterThanOrEqual(cardBox.y);
        expect(factsBox.y + factsBox.height).toBeLessThanOrEqual(
          cardBox.y + cardBox.height,
        );
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await waitForCarousels(page);
    for (const { label, records } of homepageSections()) {
      const first = records[0];
      expect(first).toBeDefined();
      if (first === undefined) continue;
      const destination = carouselRoot(page, label)
        .getByRole('region')
        .getByRole('link');
      await expect(
        destination.getByRole('heading', { name: first.title }),
      ).toBeVisible();
      await expect(destination.getByText(first.facts[0] ?? '')).toBeVisible();
      if (first.kind === 'blog') {
        await expect(destination.getByText(first.facts[1] ?? '')).toBeVisible();
      } else {
        const typeLabel =
          first.kind === 'research'
            ? 'Research'
            : first.kind === 'project'
              ? 'Project'
              : 'Work';
        await expect(destination.getByText(typeLabel)).toBeVisible();
        if (first.facts[1] !== undefined) {
          await expect(destination.getByText(first.facts[1])).toBeHidden();
        }
      }
      await expect(
        destination.getByText(first.summary, { exact: true }),
      ).toBeHidden();
    }
  },
);

test(
  'exposes and activates a real 44px hit region for every visible receded mobile card',
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
      const firstPosition = region.getByRole('button', {
        name: /^Go to item 1 of /u,
      });
      const promotionNames = await region
        .getByRole('button', { name: /^Bring item /u })
        .evaluateAll((controls) =>
          controls
            .filter((control) => control.checkVisibility())
            .map((control) => control.getAttribute('aria-label'))
            .filter((label): label is string => label !== null),
        );
      expect(promotionNames.length).toBeGreaterThan(0);

      for (const name of promotionNames) {
        await firstPosition.click();
        const control = region.getByRole('button', { name, exact: true });
        await expect(control).toBeVisible();
        const previousHref = await activeHref(region);
        const target = await findUnobstructed44PixelTarget(control);
        expect(target, `${name} at ${viewport.width}px`).not.toBeNull();
        if (target === null) continue;

        await page.touchscreen.tap(target.x, target.y);
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
