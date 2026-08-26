import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { publishedContent } from '../support/publishedContent';

interface LinearColor {
  channels: [number, number, number];
  alpha: number;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function parseAlpha(raw: string | undefined): number {
  if (raw === undefined) return 1;
  return raw.trim().endsWith('%')
    ? Number.parseFloat(raw) / 100
    : Number.parseFloat(raw);
}

function linearOklab(
  lightness: number,
  a: number,
  b: number,
  alpha: number,
): LinearColor {
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;

  return {
    channels: [
      clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    ],
    alpha,
  };
}

function parseCssColor(raw: string): LinearColor {
  const functional = raw
    .trim()
    .toLowerCase()
    .match(/^([a-z]+)\((.*)\)$/u);
  if (functional === null) throw new Error(`Unsupported CSS color: ${raw}`);
  const [, name, body] = functional;
  const [colorBody, slashAlpha] = body.split('/').map((part) => part.trim());

  if (name === 'rgb' || name === 'rgba') {
    const parts = colorBody.split(/[\s,]+/u).filter(Boolean);
    const channels = parts
      .slice(0, 3)
      .map((part) =>
        part.endsWith('%')
          ? Number.parseFloat(part) / 100
          : Number.parseFloat(part) / 255,
      );
    return {
      channels: channels.map((channel) => srgbToLinear(clamp(channel))) as [
        number,
        number,
        number,
      ],
      alpha: parseAlpha(slashAlpha ?? parts[3]),
    };
  }

  if (name === 'color' && colorBody.startsWith('srgb ')) {
    const channels = colorBody.slice(5).trim().split(/\s+/u).map(Number);
    return {
      channels: channels.map((channel) => srgbToLinear(clamp(channel))) as [
        number,
        number,
        number,
      ],
      alpha: parseAlpha(slashAlpha),
    };
  }

  if (name === 'oklch') {
    const [rawLightness, rawChroma, rawHue] = colorBody.split(/\s+/u);
    const lightness = rawLightness.endsWith('%')
      ? Number.parseFloat(rawLightness) / 100
      : Number.parseFloat(rawLightness);
    const chroma = Number.parseFloat(rawChroma);
    const hue = (Number.parseFloat(rawHue) * Math.PI) / 180;
    return linearOklab(
      lightness,
      chroma * Math.cos(hue),
      chroma * Math.sin(hue),
      parseAlpha(slashAlpha),
    );
  }

  if (name === 'oklab') {
    const [rawLightness, rawA, rawB] = colorBody.split(/\s+/u);
    const lightness = rawLightness.endsWith('%')
      ? Number.parseFloat(rawLightness) / 100
      : Number.parseFloat(rawLightness);
    return linearOklab(
      lightness,
      Number.parseFloat(rawA),
      Number.parseFloat(rawB),
      parseAlpha(slashAlpha),
    );
  }

  throw new Error(`Unsupported CSS color: ${raw}`);
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundColor = parseCssColor(foreground);
  const backgroundColor = parseCssColor(background);
  expect(foregroundColor.alpha).toBe(1);
  expect(backgroundColor.alpha).toBe(1);
  const luminance = ({ channels }: LinearColor) =>
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  const lighter = Math.max(
    luminance(foregroundColor),
    luminance(backgroundColor),
  );
  const darker = Math.min(
    luminance(foregroundColor),
    luminance(backgroundColor),
  );
  return (lighter + 0.05) / (darker + 0.05);
}

async function expectNoSeriousAxeViolations(page: Page, state: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter(
    ({ impact }) => impact === 'serious' || impact === 'critical',
  );
  expect(serious, `${state} has serious or critical axe violations`).toEqual(
    [],
  );
}

async function focusWithKeyboard(
  page: Page,
  target: Locator,
  keys: {
    forward: 'Tab' | 'Alt+Tab';
    reverse: 'Shift+Tab' | 'Alt+Shift+Tab';
  },
) {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  await target.focus();
  await page.keyboard.press(keys.reverse);
  await expect(target).not.toBeFocused();
  await page.keyboard.press(keys.forward);
  await expect(target).toBeFocused();
}

function representativeRoutes(): string[] {
  const content = publishedContent();
  const blog = content.find(({ kind }) => kind === 'blog');
  const research = content.find(
    ({ entityType }) => entityType === 'ScholarlyArticle',
  );
  const project = content.find(
    ({ entityType }) => entityType === 'CreativeWork',
  );
  return [
    '/',
    '/about/',
    '/blog/',
    '/chatbot/',
    '/contact/',
    '/licenses/egregore/',
    '/tools/',
    '/works/',
    blog?.route,
    research?.route,
    project?.route,
  ].filter((route): route is string => route !== undefined);
}

test(
  'representative page templates are axe-clean in both themes',
  { tag: '@desktop' },
  async ({ page }) => {
    for (const route of representativeRoutes()) {
      for (const theme of ['light', 'dark'] as const) {
        await page.addInitScript((selectedTheme) => {
          localStorage.setItem('theme', selectedTheme);
        }, theme);
        await page.goto(route);
        await expectNoSeriousAxeViolations(page, `${route} in ${theme} theme`);
      }
    }
  },
);

test(
  'collection surfaces expose one keyboard-visible dominant destination',
  { tag: '@desktop' },
  async ({ browserName, page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const keys =
      browserName === 'webkit'
        ? ({ forward: 'Alt+Tab', reverse: 'Alt+Shift+Tab' } as const)
        : ({ forward: 'Tab', reverse: 'Shift+Tab' } as const);
    for (const route of ['/blog/', '/works/']) {
      await page.goto(route);
      const card = page.locator('main [data-content-card]').first();
      const destination = card.getByRole('link');
      await expect(destination).toHaveCount(1);
      await expect(card.locator('a[href]')).toHaveCount(1);
      await focusWithKeyboard(page, destination, keys);
      await expect(card).toHaveCSS('outline-style', 'solid');
    }

    await page.goto('/');
    for (const carousel of await page
      .locator('[data-home-collection-carousel]')
      .all()) {
      const sentinel = carousel.locator('[data-carousel-sentinel]');
      if ((await sentinel.count()) > 0) await sentinel.scrollIntoViewIfNeeded();
      await expect(carousel.getByRole('region')).toBeVisible();
      await expect(carousel.getByRole('link')).toHaveCount(1);
      const position = carousel.getByRole('status');
      const positionBox = await position.boundingBox();
      expect(positionBox?.width ?? Infinity).toBeLessThanOrEqual(1);
      expect(positionBox?.height ?? Infinity).toBeLessThanOrEqual(1);
    }
    await expectNoSeriousAxeViolations(page, 'Homepage depth carousels');
  },
);

test(
  'prose links keep readable hover and focus contrast in both themes',
  { tag: '@desktop' },
  async ({ page }) => {
    let routeWithLink: string | undefined;
    for (const { route } of publishedContent()) {
      await page.goto(route);
      if (
        (await page.locator('[data-article-toc-content] a[href]').count()) > 0
      ) {
        routeWithLink = route;
        break;
      }
    }
    expect(
      routeWithLink,
      'published prose needs one linked example',
    ).toBeDefined();
    if (routeWithLink === undefined) return;

    for (const theme of ['light', 'dark'] as const) {
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem('theme', selectedTheme);
      }, theme);
      await page.goto(routeWithLink);
      const proseLink = page
        .locator('[data-article-toc-content] a[href]')
        .first();
      for (const state of ['hover', 'focus'] as const) {
        if (state === 'hover') await proseLink.hover();
        else await proseLink.focus();
        const colors = await proseLink.evaluate((element) => ({
          foreground: getComputedStyle(element).color,
          background: getComputedStyle(document.body).backgroundColor,
        }));
        expect(
          contrastRatio(colors.foreground, colors.background),
          `${theme} ${state} contrast`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  },
);

test(
  'reduced motion disables and disposes the Grainient canvas',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('canvas')).toHaveCount(1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('canvas')).toHaveCount(0);
  },
);

test(
  'mobile disclosure follows sequential focus order and restores focus',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 160));
    const disclosure = page.locator(
      'button[aria-controls="site-navigation-dock"]',
    );
    const controlledId = await disclosure.getAttribute('aria-controls');
    expect(controlledId).not.toBeNull();
    const dock = page.locator(`#${controlledId ?? ''}`);
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await expect(dock).toHaveAttribute('inert', '');

    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    );
    await page.keyboard.press('Tab');
    await expect(disclosure).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Shift+Tab');
    await expect(
      dock.getByRole('button', { name: /switch to (dark|light) mode/iu }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(disclosure).toBeFocused();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await expect(dock).toHaveAttribute('inert', '');
  },
);
