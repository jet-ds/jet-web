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

async function expectAssistiveOnly(status: Locator): Promise<void> {
  const box = await status.boundingBox();
  expect(box?.width ?? Infinity).toBeLessThanOrEqual(1);
  expect(box?.height ?? Infinity).toBeLessThanOrEqual(1);
  await expect(status).toHaveCSS('clip-path', 'inset(50%)');
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
      page
        .getByRole('heading', { name: "Hi, I'm Jet Sanchez." })
        .locator('xpath=ancestor-or-self::*[@data-home-reveal]'),
    ).toHaveCount(0);

    const articleHeadingGroup = page
      .getByRole('heading', { name: 'Latest Articles' })
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
  'centers both collection headings with View all beneath each heading',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    for (const { label } of homepageSections()) {
      const section = carouselRoot(page, label).locator(
        'xpath=ancestor::section[1]',
      );
      const heading = section.getByRole('heading', { name: label });
      const viewAll = section.getByRole('link', { name: /View all/u });
      const [sectionBox, headingBox, viewAllBox] = await Promise.all([
        section.boundingBox(),
        heading.boundingBox(),
        viewAll.boundingBox(),
      ]);
      expect(sectionBox).not.toBeNull();
      expect(headingBox).not.toBeNull();
      expect(viewAllBox).not.toBeNull();
      if (sectionBox === null || headingBox === null || viewAllBox === null)
        continue;
      const sectionCenter = sectionBox.x + sectionBox.width / 2;
      expect(
        Math.abs(headingBox.x + headingBox.width / 2 - sectionCenter),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(viewAllBox.x + viewAllBox.width / 2 - sectionCenter),
      ).toBeLessThanOrEqual(1);
      expect(viewAllBox.y).toBeGreaterThanOrEqual(
        headingBox.y + headingBox.height,
      );
    }
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
        const activeDot = region
          .locator('[data-carousel-indicators] [aria-current="step"] span')
          .first();
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
            probe.className = 'action action--outline action--compact';
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
  'lets the active card lead connected depth motion without moving fixed chrome',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.goto('/');
    await waitForCarousels(page);
    for (const { label, records } of homepageSections()) {
      if (records.length < 2) continue;
      const region = carouselRoot(page, label).getByRole('region');
      const stage = region.locator('[data-carousel-stage]');
      const active = region.locator('[data-carousel-depth="0"]');
      const receded = region.locator('[data-carousel-depth="1"]');
      const previous = region.getByRole('button', { name: /^Previous /u });
      const indicators = region.locator('[data-carousel-indicators]');
      const initialHref = await activeHref(region);
      await stage.scrollIntoViewIfNeeded();
      const [
        stageBefore,
        activeBefore,
        recededBefore,
        controlBefore,
        dotsBefore,
      ] = await Promise.all([
        stage.boundingBox(),
        active.boundingBox(),
        receded.boundingBox(),
        previous.boundingBox(),
        indicators.boundingBox(),
      ]);
      expect(stageBefore).not.toBeNull();
      expect(activeBefore).not.toBeNull();
      expect(recededBefore).not.toBeNull();
      if (
        stageBefore === null ||
        activeBefore === null ||
        recededBefore === null ||
        controlBefore === null ||
        dotsBefore === null
      )
        continue;

      const centerX = activeBefore.x + activeBefore.width / 2;
      const centerY = activeBefore.y + activeBefore.height / 2;
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.mouse.move(centerX - 72, centerY + 18, { steps: 8 });
      const [
        stageDuring,
        activeDuring,
        recededDuring,
        controlDuring,
        dotsDuring,
      ] = await Promise.all([
        stage.boundingBox(),
        active.boundingBox(),
        receded.boundingBox(),
        previous.boundingBox(),
        indicators.boundingBox(),
      ]);
      expect(stageDuring?.x).toBeCloseTo(stageBefore.x, 0);
      expect(controlDuring?.x).toBeCloseTo(controlBefore.x, 0);
      expect(dotsDuring?.x).toBeCloseTo(dotsBefore.x, 0);
      const activeShift = Math.abs(
        (activeDuring?.x ?? activeBefore.x) - activeBefore.x,
      );
      const recededShift = Math.abs(
        (recededDuring?.x ?? recededBefore.x) - recededBefore.x,
      );
      expect(activeShift).toBeGreaterThan(60);
      expect(activeShift).toBeLessThan(84);
      expect(recededShift).toBeGreaterThan(16);
      expect(recededShift).toBeLessThan(32);
      expect(recededShift).toBeLessThan(activeShift);
      const activeVerticalShift = Math.abs(
        (activeDuring?.y ?? activeBefore.y) - activeBefore.y,
      );
      const recededVerticalShift = Math.abs(
        (recededDuring?.y ?? recededBefore.y) - recededBefore.y,
      );
      expect(activeVerticalShift).toBeGreaterThan(4);
      expect(recededVerticalShift).toBeGreaterThan(1);
      expect(recededVerticalShift).toBeLessThan(activeVerticalShift);
      expect(stageDuring?.y).toBeCloseTo(stageBefore.y, 0);
      expect(controlDuring?.y).toBeCloseTo(controlBefore.y, 0);
      expect(dotsDuring?.y).toBeCloseTo(dotsBefore.y, 0);
      await page.mouse.up();
      await expect(region.getByRole('link')).not.toHaveAttribute(
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
            Math.abs((activeAfter?.y ?? 0) - activeBefore.y),
            Math.abs((recededAfter?.y ?? 0) - recededBefore.y),
          ].every((difference) => difference <= 1);
        })
        .toBe(true);
      expect(new URL(page.url()).pathname).toBe('/');
      await expect(active).toHaveCSS('touch-action', 'pan-y');

      const beforeScroll = await page.evaluate(() => window.scrollY);
      await stage.hover();
      await page.mouse.wheel(0, 360);
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(beforeScroll);
    }
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
      const active = region.locator('[data-carousel-depth="0"]');
      const receded = region.locator('[data-carousel-depth="1"]');
      await active.scrollIntoViewIfNeeded();
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
    const active = region.locator('[data-carousel-depth="0"]');
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
  'keeps the approved depth, card, control, and indicator geometry across the 48rem handoff',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const viewport of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
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
        const stage = region.locator('[data-carousel-stage]');
        const activeBox = await active.boundingBox();
        const stageBox = await stage.boundingBox();
        const regionBox = await region.boundingBox();
        expect(activeBox).not.toBeNull();
        expect(stageBox).not.toBeNull();
        expect(activeBox?.width ?? Infinity).toBeLessThanOrEqual(576.5);
        expect(activeBox?.height ?? Infinity).toBeLessThanOrEqual(324.5);
        expect(stageBox?.width ?? Infinity).toBeLessThanOrEqual(960.5);
        await expect(stage).toHaveCSS('overflow', 'visible');
        await expect(region).toHaveCSS('overflow-x', 'clip');
        await expect(region).toHaveCSS('overflow-y', 'visible');
        expect((activeBox?.width ?? 0) / (activeBox?.height ?? 1)).toBeCloseTo(
          16 / 9,
          1,
        );

        await expect(
          region.locator('[data-carousel-role="companion"]'),
        ).toHaveCount(0);

        const previous = region.getByRole('button', { name: /^Previous /u });
        const next = region.getByRole('button', { name: /^Next /u });
        const dots = region.locator('[data-carousel-indicators]');
        const [previousBox, nextBox, dotsBox] = await Promise.all([
          previous.boundingBox(),
          next.boundingBox(),
          dots.boundingBox(),
        ]);
        expect(previousBox?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(previousBox?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(nextBox?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(nextBox?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(dotsBox?.y ?? 0).toBeGreaterThanOrEqual(
          (stageBox?.y ?? 0) + (stageBox?.height ?? 0),
        );
        if (activeBox !== null && previousBox !== null && nextBox !== null) {
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
          }
        }

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

        const lowestLayerBottom = await visibleLayers.evaluateAll((layers) =>
          Math.max(
            ...layers.map((layer) => {
              const bounds = layer.getBoundingClientRect();
              return bounds.bottom;
            }),
          ),
        );
        expect(regionBox).not.toBeNull();
        expect(
          (regionBox?.y ?? 0) + (regionBox?.height ?? 0) - lowestLayerBottom,
        ).toBeGreaterThanOrEqual(48);
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
  'reveals desktop metadata without moving the card and keeps touch facts stable',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');
    await waitForCarousels(page);

    for (const { label, records } of homepageSections()) {
      const region = carouselRoot(page, label).getByRole('region');
      await region.scrollIntoViewIfNeeded();
      const active = region.locator('[data-carousel-depth="0"]');
      const heading = active.locator('[data-carousel-heading]');
      const summary = active.locator('[data-carousel-summary]');
      const facts = active.locator('[data-carousel-facts]');
      await page.mouse.move(0, 0);
      const before = await active.boundingBox();
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
      const restingDisclosure = await summary.evaluate((element) => ({
        transform: getComputedStyle(element).transform,
        transitionDuration: getComputedStyle(element).transitionDuration,
      }));
      const headingTiming = await heading.evaluate(
        (element) => getComputedStyle(element).transitionDuration,
      );
      expect(headingTiming).toBe(restingDisclosure.transitionDuration);
      await active.hover();
      await expect(summary).toHaveCSS('opacity', '1');
      await expect(facts).toHaveCSS('opacity', '1');
      const headingExpanded = await heading.boundingBox();
      expect(headingExpanded).not.toBeNull();
      if (headingAtRest !== null && headingExpanded !== null) {
        expect(headingExpanded.y).toBeLessThan(headingAtRest.y - 48);
      }
      expect(
        await summary.evaluate(
          (element) => new DOMMatrix(getComputedStyle(element).transform).m42,
        ),
      ).toBeCloseTo(0, 2);
      expect(await active.boundingBox()).toEqual(before);
      expect(await summary.textContent()).toContain(records[0]?.summary);

      await active.focus();
      await expect(summary).toHaveCSS('opacity', '1');
      await expect(facts).toHaveCSS('opacity', '1');
      expect(await active.boundingBox()).toEqual(before);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await waitForCarousels(page);
    for (const { label, records } of homepageSections()) {
      const first = records[0];
      expect(first).toBeDefined();
      if (first === undefined) continue;
      const active = carouselRoot(page, label)
        .getByRole('region')
        .locator('[data-carousel-depth="0"]');
      await expect(
        active.getByRole('heading', { name: first.title }),
      ).toBeVisible();
      await expect(active.getByText(first.facts[0] ?? '')).toBeVisible();
      if (first.kind === 'blog') {
        await expect(active.getByText(first.facts[1] ?? '')).toBeVisible();
      } else {
        const typeLabel =
          first.kind === 'research'
            ? 'Research'
            : first.kind === 'project'
              ? 'Project'
              : 'Work';
        await expect(active.getByText(typeLabel)).toBeVisible();
        if (first.facts[1] !== undefined) {
          await expect(active.getByText(first.facts[1])).toBeHidden();
        }
      }
      await expect(active.locator('[data-carousel-summary]')).toBeHidden();
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
      await expect(region.locator('[data-carousel-heading]')).toHaveCSS(
        'transition-duration',
        '0s',
      );
    }

    await region.getByRole('button', { name: /^Previous /u }).click();
    await expect(region.getByRole('link')).not.toHaveAttribute(
      'href',
      hrefBefore,
    );
  }
});
