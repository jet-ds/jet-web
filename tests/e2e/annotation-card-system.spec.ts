import { expect, test, type Locator, type Page } from '@playwright/test';
import { SOCIAL_LINKS } from '../../src/config/site';

type Theme = 'light' | 'dark';

const themes: Theme[] = ['light', 'dark'];

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

test('Licenses, About, and Contact resolve one subtle card surface in both themes', async ({ page }) => {
  const routes = [
    ['/licenses/jets-ghost/', 4],
    ['/about/', 3],
    ['/contact/', 2],
  ] as const;

  for (const theme of themes) {
    const routeStyles: Array<{ backgroundColor: string; borderColor: string }> = [];

    for (const [route, expectedCount] of routes) {
      await page.goto(route);
      await applyTheme(page, theme);

      const cards = page.locator('main .bg-bg-subtle.border-border-default');
      await expect(cards).toHaveCount(expectedCount);
      const styles = await cards.evaluateAll((elements) => elements.map((element) => {
        const computed = getComputedStyle(element);
        return {
          backgroundColor: computed.backgroundColor,
          borderColor: computed.borderColor,
        };
      }));

      expect(new Set(styles.map(({ backgroundColor }) => backgroundColor)).size).toBe(1);
      expect(new Set(styles.map(({ borderColor }) => borderColor)).size).toBe(1);
      routeStyles.push(styles[0]);
    }

    expect(new Set(routeStyles.map(({ backgroundColor }) => backgroundColor)).size).toBe(1);
    expect(new Set(routeStyles.map(({ borderColor }) => borderColor)).size).toBe(1);
  }

  await page.goto('/about/');
  const portraitCard = page.locator('main .bg-surface-base:has(img[alt="Jet Sanchez"])');
  await expect(portraitCard).toHaveCount(1);
  const portraitStyle = await portraitCard.locator('img[alt="Jet Sanchez"]').evaluate((image) => {
    const computed = getComputedStyle(image);
    return { filter: computed.filter, opacity: computed.opacity };
  });
  expect(portraitStyle.filter).toBe('none');
  expect(portraitStyle.opacity).toBe('1');
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
