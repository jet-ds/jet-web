import { expect, test, type Locator, type Page } from '@playwright/test';
import { SOCIAL_LINKS } from '../../src/config/site';

type Theme = 'light' | 'dark';

const themes: Theme[] = ['light', 'dark'];

function normalizeCssColorSerialization(value: string): string {
  return value.replace(/(^|[\s(])\.(?=\d)/gu, (_match, prefix: string) => `${prefix}0.`);
}

const expectedLinks = [
  {
    name: 'GitHub',
    url: SOCIAL_LINKS.github,
    description: 'Code, experiments, and open-source work',
  },
  {
    name: 'LinkedIn',
    url: SOCIAL_LINKS.linkedin,
    description: 'Professional profile and updates',
  },
  {
    name: 'SSRN',
    url: SOCIAL_LINKS.ssrn,
    description: 'Research papers and publications',
  },
  {
    name: 'Google Scholar',
    url: SOCIAL_LINKS.scholar,
    description: 'Academic citations and research profile',
  },
] as const;

async function applyTheme(page: Page, theme: Theme) {
  await page.evaluate((nextTheme) => {
    if (!document.querySelector('#annotation-card-system-no-transitions')) {
      const style = document.createElement('style');
      style.id = 'annotation-card-system-no-transitions';
      style.textContent = '*, *::before, *::after { transition: none !important; }';
      document.head.append(style);
    }
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }, theme);
}

async function expectDefaultAccentAction(action: Locator) {
  await expect(action).toHaveAttribute('data-action-variant', 'accent');
  await expect(action).toHaveAttribute('data-action-density', 'default');

  const bounds = await action.boundingBox();
  expect(bounds?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);

  const style = await action.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      backgroundColor: computed.backgroundColor,
      borderRadius: Number.parseFloat(computed.borderRadius),
      opacity: Number.parseFloat(computed.opacity),
      paddingInline: Number.parseFloat(computed.paddingInlineStart),
    };
  });
  expect(style.backgroundColor).not.toBe('transparent');
  expect(style.backgroundColor).not.toMatch(/rgba\([^)]*,\s*0\s*\)$/u);
  expect(style.borderRadius).toBeGreaterThan(0);
  expect(style.opacity).toBe(1);
  expect(style.paddingInline).toBeGreaterThan(0);
}

async function expectClippedImageCard(page: Page, route: '/blog/' | '/works/') {
  await page.goto(route);

  if (route === '/works/') {
    await page.locator('[data-filter-item]').first().evaluate(async (card) => {
      const anchor = card.querySelector('a.group');
      if (!anchor) throw new Error('WorkCard primary link missing');
      if (anchor.querySelector('.aspect-video img')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'aspect-video overflow-hidden';
      const image = document.createElement('img');
      image.alt = 'WorkCard clipping fixture';
      image.className = 'w-full h-full object-cover transition-transform duration-300 group-hover:scale-105';
      image.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="%23ef4444"/></svg>';
      wrapper.append(image);
      anchor.prepend(wrapper);
      await image.decode();
    });
  }

  const card = page.locator('[data-filter-item]:has(.aspect-video img)').first();
  const anchor = card.locator('a.group');
  const image = card.locator('.aspect-video img:visible');
  await expect(card).toBeVisible();
  await expect(image).toHaveCount(1);
  await expect(image).toBeVisible();

  const readBoundary = () => card.evaluate((element) => {
    const media = element.querySelector('.aspect-video');
    const imageElement = media?.querySelector('img');
    if (!media || !imageElement) throw new Error('Card image boundary missing');
    const cardStyle = getComputedStyle(element);
    return {
      borderRadius: Number.parseFloat(cardStyle.borderRadius),
      overflow: cardStyle.overflow,
      transform: getComputedStyle(imageElement).transform,
    };
  });

  const rest = await readBoundary();
  expect(rest.overflow).toBe('hidden');
  expect(rest.borderRadius).toBe(8);

  await card.locator('a.group').hover();
  const hover = await readBoundary();
  expect(hover.transform).not.toBe('none');
  expect(hover.overflow).toBe('hidden');
  expect(hover.borderRadius).toBe(rest.borderRadius);

  await page.mouse.move(1, 1);
  await page.evaluate(() => {
    document.addEventListener('click', (event) => event.preventDefault(), {
      capture: true,
      once: true,
    });
  });
  await anchor.click();
  const pointerFocus = await card.evaluate((element) => {
    const computed = getComputedStyle(element);
    const link = element.querySelector('a.group');
    return {
      focusVisible: link?.matches(':focus-visible') ?? false,
      outlineStyle: computed.outlineStyle,
    };
  });
  expect(pointerFocus.focusVisible).toBe(false);
  expect(pointerFocus.outlineStyle).toBe('none');

  await page.reload();
  if (route === '/works/') {
    await page.locator('[data-filter-item]').first().evaluate(async (element) => {
      const link = element.querySelector('a.group');
      if (!link) throw new Error('WorkCard primary link missing');
      if (link.querySelector('.aspect-video img')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'aspect-video overflow-hidden';
      const fixtureImage = document.createElement('img');
      fixtureImage.alt = 'WorkCard clipping fixture';
      fixtureImage.className = 'w-full h-full object-cover transition-transform duration-300 group-hover:scale-105';
      fixtureImage.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="%23ef4444"/></svg>';
      wrapper.append(fixtureImage);
      link.prepend(wrapper);
      await fixtureImage.decode();
    });
  }

  const focusCard = page.locator('[data-filter-item]:has(.aspect-video img)').first();
  const focusAnchor = focusCard.locator('a.group');
  for (let presses = 0; presses < 30; presses += 1) {
    await page.keyboard.press('Tab');
    if (await focusAnchor.evaluate((element) => element === document.activeElement)) break;
  }
  await expect(focusAnchor).toBeFocused();
  const keyboardFocus = await focusCard.evaluate((element) => {
    const computed = getComputedStyle(element);
    const link = element.querySelector('a.group');
    const expectedColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-brand-base').trim();
    return {
      expectedColor,
      focusVisible: link?.matches(':focus-visible') ?? false,
      outlineColor: computed.outlineColor,
      outlineOffset: Number.parseFloat(computed.outlineOffset),
      outlineStyle: computed.outlineStyle,
      outlineWidth: Number.parseFloat(computed.outlineWidth),
      overflow: computed.overflow,
    };
  });
  expect(keyboardFocus.focusVisible).toBe(true);
  expect(keyboardFocus.outlineStyle).toBe('solid');
  expect(keyboardFocus.outlineWidth).toBe(2);
  expect(keyboardFocus.outlineOffset).toBe(2);
  expect(normalizeCssColorSerialization(keyboardFocus.outlineColor))
    .toBe(normalizeCssColorSerialization(keyboardFocus.expectedColor));
  expect(keyboardFocus.overflow).toBe('hidden');
}

test('Licenses, About, and Contact resolve one subtle card surface in both themes', async ({ page }) => {
  const routes = [
    ['/licenses/jets-ghost/', 4],
    ['/about/', 3],
    ['/contact/', 2],
  ] as const;

  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });

    for (const theme of themes) {
      const routeStyles: Array<{
        backgroundColor: string;
        borderColor: string;
        borderRadius: number;
        padding: number[];
      }> = [];

      for (const [route, expectedCount] of routes) {
        await page.goto(route);
        await applyTheme(page, theme);

        const expectedCardPadding = await page.evaluate(() => {
          const probe = document.createElement('div');
          probe.style.padding = 'var(--space-card)';
          document.body.append(probe);
          const padding = Number.parseFloat(getComputedStyle(probe).paddingTop);
          probe.remove();
          return padding;
        });

        const cards = page.locator('main .bg-bg-subtle.border-border-default');
        await expect(cards).toHaveCount(expectedCount);
        const styles = await cards.evaluateAll((elements) => elements.map((element) => {
          const computed = getComputedStyle(element);
          return {
            backgroundColor: computed.backgroundColor,
            borderColor: computed.borderColor,
            borderRadius: Number.parseFloat(computed.borderRadius),
            padding: [
              computed.paddingTop,
              computed.paddingRight,
              computed.paddingBottom,
              computed.paddingLeft,
            ].map(Number.parseFloat),
          };
        }));

        expect(new Set(styles.map(({ backgroundColor }) => backgroundColor)).size).toBe(1);
        expect(new Set(styles.map(({ borderColor }) => borderColor)).size).toBe(1);
        for (const style of styles) {
          expect(style.borderRadius).toBe(12);
          for (const padding of style.padding) {
            expect(padding).toBeCloseTo(expectedCardPadding, 2);
          }
        }
        routeStyles.push(styles[0]);
      }

      expect(new Set(routeStyles.map(({ backgroundColor }) => backgroundColor)).size).toBe(1);
      expect(new Set(routeStyles.map(({ borderColor }) => borderColor)).size).toBe(1);
      expect(new Set(routeStyles.map(({ borderRadius }) => borderRadius))).toEqual(new Set([12]));
      expect(new Set(routeStyles.map(({ padding }) => padding.join(','))).size).toBe(1);

      await page.goto('/about/');
      await applyTheme(page, theme);
      const backgroundCard = page.locator('main .bg-bg-subtle.border-border-default').first();
      const portraitCard = page.locator('main .bg-surface-base:has(img[alt="Jet Sanchez"])');
      await expect(portraitCard).toHaveCount(1);
      const backgroundRadius = await backgroundCard.evaluate(
        (card) => Number.parseFloat(getComputedStyle(card).borderRadius),
      );
      const portraitStyle = await portraitCard.evaluate((card) => {
        const image = card.querySelector('img[alt="Jet Sanchez"]');
        if (!image) throw new Error('Portrait image missing');
        const cardStyle = getComputedStyle(card);
        const imageStyle = getComputedStyle(image);
        const cardBounds = card.getBoundingClientRect();
        const imageBounds = image.getBoundingClientRect();
        return {
          borderRadius: Number.parseFloat(cardStyle.borderRadius),
          clippedWithinCard: imageBounds.left >= cardBounds.left - 0.5
            && imageBounds.top >= cardBounds.top - 0.5
            && imageBounds.right <= cardBounds.right + 0.5
            && imageBounds.bottom <= cardBounds.bottom + 0.5,
          filter: imageStyle.filter,
          opacity: imageStyle.opacity,
          overflow: cardStyle.overflow,
          padding: Number.parseFloat(cardStyle.paddingTop),
        };
      });
      expect(portraitStyle.borderRadius).toBe(12);
      expect(portraitStyle.borderRadius).toBe(backgroundRadius);
      expect(portraitStyle.clippedWithinCard).toBe(true);
      expect(portraitStyle.filter).toBe('none');
      expect(portraitStyle.opacity).toBe('1');
      expect(portraitStyle.overflow).toBe('hidden');
      expect(portraitStyle.padding).toBe(0);
    }
  }
});

test('About Connect retains four compact shared soft actions in both themes', async ({ page }) => {
  await page.goto('/about/');

  const actionSelectors = await page.evaluate(() => {
    const selectors: string[] = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule) selectors.push(rule.selectorText);
        }
      } catch {
        // Cross-origin stylesheets are irrelevant to the local action taxonomy.
      }
    }
    return selectors.join('\n');
  });
  for (const className of [
    'action--brand',
    'action--accent',
    'action--soft',
    'action--neutral',
    'action--outline',
    'action--ghost',
    'action--filter',
    'action--compact',
    'action--default',
    'action--immersive',
  ]) {
    expect(actionSelectors).toContain(`.${className}`);
  }

  const actions = page.locator(
    'main a.action[data-action-variant="soft"][data-action-density="compact"]',
  );
  await expect(actions).toHaveCount(expectedLinks.length);
  expect(await actions.evaluateAll((links) => links.map((link) => link.getAttribute('href'))))
    .toEqual(expectedLinks.map(({ url }) => url));

  for (const action of await actions.all()) {
    await expect(action.locator('[aria-hidden="true"]')).toHaveText('↗');
  }

  for (const theme of themes) {
    await applyTheme(page, theme);
    const action = actions.first();
    const bounds = await action.boundingBox();
    expect(bounds?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);

    const rest = await action.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        backgroundColor: computed.backgroundColor,
        borderRadius: Number.parseFloat(computed.borderRadius),
        paddingInline: Number.parseFloat(computed.paddingInlineStart),
      };
    });
    expect(rest.backgroundColor).not.toBe('transparent');
    expect(rest.backgroundColor).not.toMatch(/rgba\([^)]*,\s*0\s*\)$/u);
    expect(rest.borderRadius).toBeGreaterThan(0);
    expect(rest.paddingInline).toBeGreaterThan(0);

    await action.hover();
    const hoverBackground = await action.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(hoverBackground).not.toBe(rest.backgroundColor);
    expect(hoverBackground).not.toBe('transparent');

    await page.mouse.move(0, 0);
    await action.focus();
    const focus = await action.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        backgroundColor: computed.backgroundColor,
        outlineStyle: computed.outlineStyle,
        outlineWidth: Number.parseFloat(computed.outlineWidth),
      };
    });
    expect(focus.backgroundColor).not.toBe('transparent');
    expect(focus.backgroundColor).not.toMatch(/rgba\([^)]*,\s*0\s*\)$/u);
    expect(focus.outlineStyle).not.toBe('none');
    expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
  }
});

test('Blog and Works image cards clip rest and hover media to shared Card corners', async ({ page }) => {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectClippedImageCard(page, '/blog/');
    await expectClippedImageCard(page, '/works/');
  }
});

test('Contact renders one ordered destination list and one shared Send email action', async ({ page }) => {
  await page.goto('/contact/');

  const cards = page.locator('main .bg-bg-subtle.border-border-default');
  await expect(cards).toHaveCount(2);
  await expect(cards.locator('h2')).toHaveText(['Email', 'Links']);
  await expect(page.getByText('Response Time', { exact: true })).toHaveCount(0);

  const destinationLinks = page.locator('main a[target="_blank"]');
  await expect(destinationLinks).toHaveCount(expectedLinks.length);
  expect(await destinationLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href'))))
    .toEqual(expectedLinks.map(({ url }) => url));

  const rows = await destinationLinks.allTextContents();
  for (const [index, { name, url, description }] of expectedLinks.entries()) {
    expect(rows[index]).toContain(name);
    expect(rows[index]).toContain(description);
    await expect(page.locator(`main a[href="${url}"]`)).toHaveCount(1);
  }

  for (const theme of themes) {
    await applyTheme(page, theme);
    await expectDefaultAccentAction(
      page.getByRole('main').getByRole('link', { name: 'Send email', exact: true }),
    );
  }
});
