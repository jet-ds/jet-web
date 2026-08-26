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

interface TransitionSample {
  incoming: GeometryFrame | null;
  outgoing: GeometryFrame | null;
  receding: GeometryFrame | null;
}

interface TransitionEvidence {
  activeTarget: GeometryFrame;
  before: TransitionSample;
  samples: TransitionSample[];
}

function frameDistance(
  first: GeometryFrame | null,
  second: GeometryFrame | null,
): number {
  if (first === null || second === null) return Number.POSITIVE_INFINITY;
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
      const bounds = await locator.boundingBox();
      const current =
        bounds === null
          ? null
          : {
              height: bounds.height,
              width: bounds.width,
              x: bounds.x,
              y: bounds.y,
            };
      const stable =
        current !== null &&
        previous !== null &&
        frameDistance(current, previous) <= 0.5;
      previous = current;
      return stable;
    })
    .toBe(true);
}

async function installTransitionRecorder(
  region: Locator,
  incomingId: string,
  trigger: 'next' | 'pointerup',
): Promise<void> {
  await region.evaluate(
    (root, { incomingId: selectedId, trigger }) => {
      type ReleaseOwner = HTMLElement & {
        __carouselTransition?: {
          done: boolean;
          evidence?: TransitionEvidence;
        };
      };
      const owner = root as ReleaseOwner;
      const itemSelector = (id: string) =>
        `[data-carousel-layer-item="${CSS.escape(id)}"]`;
      const frame = (element: Element | null): GeometryFrame | null => {
        if (!(element instanceof HTMLElement)) return null;
        const bounds = element.getBoundingClientRect();
        return {
          height: bounds.height,
          width: bounds.width,
          x: bounds.x,
          y: bounds.y,
        };
      };
      const active = root.querySelector('[data-carousel-depth="0"]');
      const outgoingId = active?.getAttribute('data-carousel-layer-item');
      const activeTarget = frame(active);
      if (
        outgoingId === null ||
        outgoingId === undefined ||
        activeTarget === null
      )
        throw new Error('Trajectory recorder needs active card geometry.');
      const recedingId = root
        .querySelector('[data-carousel-side="next"][data-carousel-depth="2"]')
        ?.getAttribute('data-carousel-layer-item');
      const readSample = (): TransitionSample => ({
        incoming: frame(root.querySelector(itemSelector(selectedId))),
        outgoing: frame(root.querySelector(itemSelector(outgoingId))),
        receding:
          recedingId === null || recedingId === undefined
            ? null
            : frame(root.querySelector(itemSelector(recedingId))),
      });
      owner.__carouselTransition = { done: false };
      const record = () => {
        const before = readSample();
        const samples: TransitionSample[] = [];
        const deadline = performance.now() + 5_000;
        const sample = () => {
          const current = readSample();
          samples.push(current);
          const incoming = current.incoming;
          const settled =
            incoming !== null &&
            Math.hypot(
              incoming.x - activeTarget.x,
              incoming.y - activeTarget.y,
              incoming.width - activeTarget.width,
              incoming.height - activeTarget.height,
            ) < 2;
          if (
            (!settled || samples.length < 2) &&
            performance.now() < deadline
          ) {
            requestAnimationFrame(sample);
            return;
          }
          owner.__carouselTransition = {
            done: true,
            evidence: { activeTarget, before, samples },
          };
        };
        requestAnimationFrame(sample);
      };
      if (trigger === 'pointerup') {
        document.addEventListener('pointerup', record, {
          capture: true,
          once: true,
        });
        return;
      }
      const next = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.getAttribute('aria-label')?.startsWith('Next '),
      );
      if (next === undefined) throw new Error('Next control is missing.');
      record();
      next.click();
    },
    { incomingId, trigger },
  );
}

async function readTransitionEvidence(
  region: Locator,
): Promise<TransitionEvidence> {
  await expect
    .poll(() =>
      region.evaluate(
        (root) =>
          (
            root as HTMLElement & {
              __carouselTransition?: { done: boolean };
            }
          ).__carouselTransition?.done ?? false,
      ),
    )
    .toBe(true);
  return region.evaluate((root) => {
    const evidence = (
      root as HTMLElement & {
        __carouselTransition?: { evidence?: TransitionEvidence };
      }
    ).__carouselTransition?.evidence;
    if (evidence === undefined)
      throw new Error('Carousel transition evidence is missing.');
    return evidence;
  });
}

function expectContinuousSelection(evidence: TransitionEvidence) {
  const incomingBefore = evidence.before.incoming;
  const outgoingBefore = evidence.before.outgoing;
  const recedingBefore = evidence.before.receding;
  expect(incomingBefore).not.toBeNull();
  expect(outgoingBefore).not.toBeNull();
  const travel = frameDistance(incomingBefore, evidence.activeTarget);
  expect(travel).toBeGreaterThan(12);

  const first = evidence.samples[0];
  expect(frameDistance(first?.incoming ?? null, incomingBefore)).toBeLessThan(
    travel * 0.4,
  );
  expect(
    evidence.samples.some((sample) => {
      const fromStart = frameDistance(sample.incoming, incomingBefore);
      const fromFinish = frameDistance(sample.incoming, evidence.activeTarget);
      return fromStart > travel * 0.15 && fromFinish > travel * 0.15;
    }),
  ).toBe(true);
  expect(
    frameDistance(
      evidence.samples.at(-1)?.incoming ?? null,
      evidence.activeTarget,
    ),
  ).toBeLessThan(2);

  expect(first?.outgoing).not.toBeNull();
  expect(frameDistance(first?.outgoing ?? null, outgoingBefore)).toBeLessThan(
    24,
  );
  expect(
    evidence.samples.some(
      (sample) => frameDistance(sample.outgoing, outgoingBefore) > 12,
    ),
  ).toBe(true);

  if (recedingBefore !== null) {
    expect(first?.receding).not.toBeNull();
    expect(frameDistance(first?.receding ?? null, recedingBefore)).toBeLessThan(
      24,
    );
    expect(
      evidence.samples.some(
        (sample) => frameDistance(sample.receding, recedingBefore) > 8,
      ),
    ).toBe(true);
  }
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

    await page.waitForTimeout(500);
    await expect(worksRoot.locator('[data-carousel-sentinel]')).toHaveCount(1);
    await expect(worksRoot.getByRole('region')).toHaveCount(0);
    await expect(worksRoot.locator('[data-carousel-fallback]')).toBeVisible();
  },
);

test(
  'serves every enhanced carousel image locally without Blob requests',
  { tag: '@desktop' },
  async ({ browser }) => {
    const blobRequests: string[] = [];
    const imageEvidence: Array<{
      height: number;
      origin: string;
      src: string;
      width: number;
    }> = [];
    const serializedProps: string[] = [];

    for (const colorScheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({ colorScheme });
      await context.route(
        /https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\/.+/u,
        async (route) => {
          blobRequests.push(route.request().url());
          await route.abort('blockedbyclient');
        },
      );
      const page = await context.newPage();
      await page.goto('/');
      await waitForCarousels(page);

      for (const { label, records } of homepageSections()) {
        const root = carouselRoot(page, label);
        const props = await root.locator('astro-island').getAttribute('props');
        expect(props).not.toBeNull();
        if (props !== null) {
          expect(props).not.toContain('darkUrl');
          serializedProps.push(props);
        }
        await expect(root.locator('[data-carousel-fallback] img')).toHaveCount(
          records.length,
        );

        const region = root.getByRole('region');
        const active = region.locator('[data-carousel-depth="0"]');
        for (const [itemIndex, record] of records.entries()) {
          if (itemIndex > 0) {
            await region
              .getByRole('button', {
                name: `Go to item ${itemIndex + 1} of ${records.length}`,
              })
              .click();
          }
          await expect(active).toHaveAttribute(
            'data-carousel-layer-item',
            record.id,
          );
          const visibleImages = region.locator(
            '[data-carousel-visible="true"]:visible img:visible',
          );
          await expect(visibleImages).toHaveCount(Math.min(records.length, 7));
          for (const image of await visibleImages.all()) {
            await expect
              .poll(() =>
                image.evaluate(
                  (element) =>
                    element instanceof HTMLImageElement && element.complete,
                ),
              )
              .toBe(true);
            imageEvidence.push({
              ...(await image.evaluate((element) => {
                if (!(element instanceof HTMLImageElement))
                  throw new Error(
                    'Carousel layer image is not an img element.',
                  );
                return {
                  height: element.naturalHeight,
                  src: element.currentSrc,
                  width: element.naturalWidth,
                };
              })),
              origin: new URL(page.url()).origin,
            });
          }
        }
      }
      await context.close();
    }

    expect(blobRequests).toEqual([]);
    for (const props of serializedProps) {
      expect(props).not.toContain('public.blob.vercel-storage.com');
      expect(props).toContain('/_astro/');
    }
    expect(imageEvidence.length).toBeGreaterThan(0);
    for (const image of imageEvidence) {
      const url = new URL(image.src);
      expect(url.origin).toBe(image.origin);
      expect(url.pathname).toMatch(/^\/_astro\/.+\.webp$/u);
      expect(image.width).toBeGreaterThanOrEqual(576);
      expect(image.width).toBeLessThanOrEqual(1152);
      expect(image.width / image.height).toBeCloseTo(16 / 9, 3);
    }
  },
);

test(
  'centers both collection headings with View all beneath each heading',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    for (const { heading: headingName, label } of homepageSections()) {
      const section = carouselRoot(page, label).locator(
        'xpath=ancestor::section[1]',
      );
      const heading = section.getByRole('heading', { name: headingName });
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
  'uses the full section canvas with a centered active card and mirrored unique rails beneath fixed UI',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const viewport of [
      { width: 800, height: 900 },
      { width: 1024, height: 768 },
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
        const heading = section.getByRole('heading', { name: headingName });
        const active = region.locator('[data-carousel-depth="0"]');
        const [sectionBox, regionBox, activeBox] = await Promise.all([
          section.boundingBox(),
          region.boundingBox(),
          active.boundingBox(),
        ]);
        expect(sectionBox).not.toBeNull();
        expect(regionBox).not.toBeNull();
        expect(activeBox).not.toBeNull();
        if (sectionBox === null || regionBox === null || activeBox === null)
          continue;

        expect(regionBox.x).toBeCloseTo(sectionBox.x, 0);
        expect(regionBox.width).toBeCloseTo(sectionBox.width, 0);

        const activeCenter = activeBox.x + activeBox.width / 2;
        const sectionCenter = sectionBox.x + sectionBox.width / 2;
        expect(Math.abs(activeCenter - sectionCenter)).toBeLessThanOrEqual(2);

        const expectedSideCount = Math.min(
          3,
          Math.floor((records.length - 1) / 2),
        );
        const previousLayers = region.locator(
          '[data-carousel-visible="true"][data-carousel-side="previous"]',
        );
        const nextLayers = region.locator(
          '[data-carousel-visible="true"][data-carousel-side="next"]',
        );
        await expect(previousLayers).toHaveCount(expectedSideCount);
        await expect(nextLayers).toHaveCount(expectedSideCount);
        const visibleIds = await region
          .locator('[data-carousel-visible="true"]')
          .evaluateAll((layers) =>
            layers.map((layer) =>
              layer.getAttribute('data-carousel-layer-item'),
            ),
          );
        expect(visibleIds).toHaveLength(Math.min(records.length, 7));
        expect(new Set(visibleIds).size).toBe(visibleIds.length);

        for (let depth = 1; depth <= expectedSideCount; depth += 1) {
          const [previousBox, nextBox] = await Promise.all([
            region
              .locator(
                `[data-carousel-side="previous"][data-carousel-depth="${depth}"]`,
              )
              .boundingBox(),
            region
              .locator(
                `[data-carousel-side="next"][data-carousel-depth="${depth}"]`,
              )
              .boundingBox(),
          ]);
          expect(previousBox).not.toBeNull();
          expect(nextBox).not.toBeNull();
          if (previousBox === null || nextBox === null) continue;
          const previousCenter = previousBox.x + previousBox.width / 2;
          const nextCenter = nextBox.x + nextBox.width / 2;
          expect(activeCenter - previousCenter).toBeCloseTo(
            nextCenter - activeCenter,
            0,
          );
          expect(previousBox.y).toBeCloseTo(nextBox.y, 0);
          expect(previousBox.width).toBeCloseTo(nextBox.width, 0);
          expect(previousBox.height).toBeCloseTo(nextBox.height, 0);
        }

        const [uiZIndex, cardZIndex] = await Promise.all([
          heading.evaluate((element) => {
            const owner = element.parentElement;
            if (owner === null) return 0;
            const zIndex = Number.parseInt(getComputedStyle(owner).zIndex, 10);
            return Number.isFinite(zIndex) ? zIndex : 0;
          }),
          active.evaluate((element) => {
            const zIndex = Number.parseInt(
              getComputedStyle(element).zIndex,
              10,
            );
            return Number.isFinite(zIndex) ? zIndex : 0;
          }),
        ]);
        expect(uiZIndex).toBeGreaterThan(cardZIndex);
      }
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
    const stage = region.locator('[data-carousel-stage]');
    const active = region.locator('[data-carousel-depth="0"]');
    const receded = region.locator(
      '[data-carousel-side="next"][data-carousel-depth="1"]',
    );
    const heading = section.getByRole('heading', { name: headingName });
    const previous = region.getByRole('button', { name: /^Previous /u });
    const indicators = region.locator('[data-carousel-indicators]');
    await active.scrollIntoViewIfNeeded();

    const [
      sectionBefore,
      stageBefore,
      activeBefore,
      recededBefore,
      headingBefore,
      previousBefore,
      dotsBefore,
    ] = await Promise.all([
      section.boundingBox(),
      stage.boundingBox(),
      active.boundingBox(),
      receded.boundingBox(),
      heading.boundingBox(),
      previous.boundingBox(),
      indicators.boundingBox(),
    ]);
    expect(sectionBefore).not.toBeNull();
    expect(activeBefore).not.toBeNull();
    expect(recededBefore).not.toBeNull();
    if (
      sectionBefore === null ||
      stageBefore === null ||
      activeBefore === null ||
      recededBefore === null ||
      headingBefore === null ||
      previousBefore === null ||
      dotsBefore === null
    )
      return;

    const initialHref = await activeHref(region);
    const centerX = activeBefore.x + activeBefore.width / 2;
    const centerY = activeBefore.y + activeBefore.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(1, centerY - 96, { steps: 12 });
    await page.waitForTimeout(50);

    const [
      activeDuring,
      recededDuring,
      stageDuring,
      headingDuring,
      previousDuring,
      dotsDuring,
    ] = await Promise.all([
      active.boundingBox(),
      receded.boundingBox(),
      stage.boundingBox(),
      heading.boundingBox(),
      previous.boundingBox(),
      indicators.boundingBox(),
    ]);
    expect(activeDuring).not.toBeNull();
    expect(recededDuring).not.toBeNull();
    if (activeDuring === null || recededDuring === null) {
      await page.mouse.up();
      return;
    }

    const canvasPadding = await region.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        left: Number.parseFloat(style.paddingLeft) || 0,
        top:
          Number.parseFloat(
            getComputedStyle(element.closest('section') ?? element).paddingTop,
          ) || 0,
      };
    });
    expect(activeDuring.x).toBeGreaterThanOrEqual(
      sectionBefore.x + canvasPadding.left - 2,
    );
    expect(activeDuring.x).toBeLessThanOrEqual(
      sectionBefore.x + canvasPadding.left + 3,
    );
    expect(activeDuring.y).toBeGreaterThanOrEqual(
      sectionBefore.y + canvasPadding.top - 2,
    );
    expect(activeBefore.y - activeDuring.y).toBeGreaterThan(48);

    const activeShift = activeBefore.x - activeDuring.x;
    const recededShift = recededBefore.x - recededDuring.x;
    expect(activeShift).toBeGreaterThan(200);
    expect(recededShift).toBeGreaterThan(40);
    expect(recededShift).toBeLessThan(activeShift);
    expect(stageDuring).toEqual(stageBefore);
    expect(headingDuring).toEqual(headingBefore);
    expect(previousDuring).toEqual(previousBefore);
    expect(dotsDuring).toEqual(dotsBefore);
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
    const committedHref = await activeHref(region);
    await previous.click();
    await expect(region.getByRole('link')).not.toHaveAttribute(
      'href',
      committedHref,
    );
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
  'keeps incoming, outgoing, and receding cards continuous after control selection',
  { tag: '@desktop' },
  async ({ page }) => {
    const articleSection = homepageSections().find(
      ({ label, records }) =>
        label === 'Latest Articles' && records.length >= 3,
    );
    expect(articleSection).toBeDefined();
    if (articleSection === undefined) return;

    await page.goto('/');
    await waitForCarousels(page);
    const region = carouselRoot(page, articleSection.label).getByRole('region');
    await region.scrollIntoViewIfNeeded();
    const incomingId = articleSection.records[1]?.id;
    expect(incomingId).toBeDefined();
    if (incomingId === undefined) return;

    await installTransitionRecorder(region, incomingId, 'next');
    expectContinuousSelection(await readTransitionEvidence(region));
    await expect(region.locator('[data-carousel-depth="0"]')).toHaveAttribute(
      'data-carousel-layer-item',
      incomingId,
    );
  },
);

test(
  'keeps the same canonical cards on continuous trajectories after drag resolution',
  { tag: '@desktop' },
  async ({ page }) => {
    const articleSection = homepageSections().find(
      ({ label, records }) =>
        label === 'Latest Articles' && records.length >= 3,
    );
    expect(articleSection).toBeDefined();
    if (articleSection === undefined) return;

    await page.goto('/');
    await waitForCarousels(page);
    const region = carouselRoot(page, articleSection.label).getByRole('region');
    await region.scrollIntoViewIfNeeded();
    const active = region.locator('[data-carousel-depth="0"]');
    const activeBox = await active.boundingBox();
    expect(activeBox).not.toBeNull();
    if (activeBox === null) return;
    const incomingId = articleSection.records[1]?.id;
    expect(incomingId).toBeDefined();
    if (incomingId === undefined) return;

    await installTransitionRecorder(region, incomingId, 'pointerup');
    await page.mouse.move(
      activeBox.x + activeBox.width / 2,
      activeBox.y + activeBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      activeBox.x + activeBox.width / 2 - 72,
      activeBox.y + activeBox.height / 2 + 18,
      { steps: 8 },
    );
    await page.mouse.up();

    const evidence = await readTransitionEvidence(region);
    expectContinuousSelection(evidence);
    await expect(region.locator('[data-carousel-depth="0"]')).toHaveAttribute(
      'data-carousel-layer-item',
      incomingId,
    );
  },
);

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
      const receded = region.locator(
        '[data-carousel-side="next"][data-carousel-depth="1"]',
      );
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
      await page.waitForTimeout(50);
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
      const receded = region.locator(
        '[data-carousel-side="next"][data-carousel-depth="1"]',
      );
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
      await page.waitForTimeout(50);
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
      { width: 800, height: 900 },
      { width: 900, height: 900 },
      { width: 1024, height: 768 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await waitForCarousels(page);

      for (const { label, records } of homepageSections()) {
        const region = carouselRoot(page, label).getByRole('region');
        const visibleLayers = region.locator(
          '[data-carousel-layer-item][data-carousel-visible="true"]:visible',
        );
        const visibleCapacity = viewport.width < 768 ? 3 : 7;
        await expect(visibleLayers).toHaveCount(
          Math.min(records.length, visibleCapacity),
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

        if (viewport.width >= 768 && regionBox !== null) {
          const regionInsets = await region.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              left: Number.parseFloat(style.paddingLeft) || 0,
              right: Number.parseFloat(style.paddingRight) || 0,
            };
          });
          const layerBoxes = await visibleLayers.evaluateAll((layers) =>
            layers.map((layer) => {
              const bounds = layer.getBoundingClientRect();
              return { left: bounds.left, right: bounds.right };
            }),
          );
          for (const layerBox of layerBoxes) {
            expect(layerBox.left - regionBox.x).toBeGreaterThanOrEqual(
              regionInsets.left - 1,
            );
            expect(
              regionBox.x + regionBox.width - layerBox.right,
            ).toBeGreaterThanOrEqual(regionInsets.right - 1);
          }
        }

        const firstReceded = region.locator(
          '[data-carousel-side="next"][data-carousel-depth="1"]',
        );
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
      const content = active.locator('.depth-carousel__content');
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
      const restingMotion = await Promise.all([
        heading.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            translateY: new DOMMatrix(style.transform).m42,
            transitionDuration: style.transitionDuration,
            transitionProperty: style.transitionProperty,
          };
        }),
        content.evaluate((element) => {
          const style = getComputedStyle(element);
          const bounds = element.getBoundingClientRect();
          return {
            bounds: {
              height: bounds.height,
              width: bounds.width,
              x: bounds.x,
              y: bounds.y,
            },
            gridTemplateRows: style.gridTemplateRows,
            transitionProperty: style.transitionProperty,
          };
        }),
      ]);
      expect(restingMotion[0].transitionDuration).toBe(
        restingDisclosure.transitionDuration,
      );
      expect(restingMotion[0].transitionProperty).toContain('transform');
      expect(restingMotion[0].translateY).toBeGreaterThan(48);
      expect(restingMotion[1].transitionProperty).not.toMatch(
        /grid-template-rows|row-gap/iu,
      );
      await active.hover();
      await expect(summary).toHaveCSS('opacity', '1');
      await expect(facts).toHaveCSS('opacity', '1');
      const headingExpanded = await heading.boundingBox();
      expect(headingExpanded).not.toBeNull();
      if (headingAtRest !== null && headingExpanded !== null) {
        expect(headingExpanded.y).toBeLessThan(headingAtRest.y - 48);
      }
      expect(
        await heading.evaluate(
          (element) => new DOMMatrix(getComputedStyle(element).transform).m42,
        ),
      ).toBeCloseTo(0, 2);
      const expandedContent = await content.evaluate((element) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return {
          bounds: {
            height: bounds.height,
            width: bounds.width,
            x: bounds.x,
            y: bounds.y,
          },
          gridTemplateRows: style.gridTemplateRows,
        };
      });
      expect(expandedContent).toEqual({
        bounds: restingMotion[1].bounds,
        gridTemplateRows: restingMotion[1].gridTemplateRows,
      });
      expect(
        await summary.evaluate(
          (element) => new DOMMatrix(getComputedStyle(element).transform).m42,
        ),
      ).toBeCloseTo(0, 2);
      expect(await active.boundingBox()).toEqual(before);
      expect(await summary.textContent()).toContain(records[0]?.summary);

      await region.getByRole('link').focus();
      await expect(summary).toHaveCSS('opacity', '1');
      await expect(facts).toHaveCSS('opacity', '1');
      expect(await active.boundingBox()).toEqual(before);

      for (const [itemIndex, record] of records.entries()) {
        if (itemIndex > 0) {
          await region
            .getByRole('button', {
              name: `Go to item ${itemIndex + 1} of ${records.length}`,
            })
            .click();
          await expect(active).toHaveAttribute(
            'data-carousel-layer-item',
            record.id,
          );
        }
        await active.hover();
        await expect(summary).toHaveCSS('opacity', '1');
        await expect(facts).toHaveCSS('opacity', '1');
        const [cardBox, headingBox, summaryBox, factsBox] = await Promise.all([
          active.boundingBox(),
          heading.boundingBox(),
          summary.boundingBox(),
          facts.boundingBox(),
        ]);
        expect(cardBox).not.toBeNull();
        expect(headingBox).not.toBeNull();
        expect(summaryBox).not.toBeNull();
        expect(factsBox).not.toBeNull();
        if (
          cardBox === null ||
          headingBox === null ||
          summaryBox === null ||
          factsBox === null
        )
          continue;
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
            .map((control) =>
              control
                .closest('[data-carousel-depth]')
                ?.getAttribute('data-carousel-depth'),
            ),
        );
      expect(recededDepths.length).toBeGreaterThan(0);

      for (const depth of recededDepths) {
        expect(depth).toBeDefined();
        const layer = region.locator(`[data-carousel-depth="${depth ?? ''}"]`);
        const control = layer.getByRole('button', { name: /^Bring item /u });
        await expect(control).toBeVisible();
        const itemId = await layer.getAttribute('data-carousel-layer-item');
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
      await expect(
        region
          .locator('[data-carousel-depth="0"]')
          .locator('[data-carousel-heading]'),
      ).toHaveCSS('transition-duration', '0s');
    }

    await region.getByRole('button', { name: /^Previous /u }).click();
    await expect(region.getByRole('link')).not.toHaveAttribute(
      'href',
      hrefBefore,
    );
  }
});
