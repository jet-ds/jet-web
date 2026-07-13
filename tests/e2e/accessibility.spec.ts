import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const route of ['/', '/blog/', '/works/', '/tools/chatbot/']) {
  test(`${route} has no serious axe violations`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    const serious = results.violations.filter((violation) =>
      violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious).toEqual([]);
  });
}

test('dock is keyboard navigable', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus-visible')).toBeVisible();
});

test('reduced motion follows the real Grainient intersection lifecycle', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & { __positiveIntersections: number };
    state.__positiveIntersections = 0;
    const NativeIntersectionObserver = window.IntersectionObserver;

    window.IntersectionObserver = class extends NativeIntersectionObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super((entries, observer) => {
          state.__positiveIntersections += entries.filter((entry) => entry.isIntersecting).length;
          callback(entries, observer);
        }, options);
      }
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __positiveIntersections: number }).__positiveIntersections,
  )).toBeGreaterThan(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('mobile disclosure follows sequential focus order and restores focus', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, 160));
  const disclosure = page.locator('button[aria-controls="site-navigation-dock"]');
  await expect(disclosure).toBeVisible();
  await expect(disclosure).toHaveAccessibleName('Open navigation');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  const controlledId = await disclosure.getAttribute('aria-controls');
  if (!controlledId) throw new Error('Navigation disclosure lacks aria-controls');
  const dock = page.locator(`#${controlledId}`);
  await expect(dock).toHaveAttribute('inert', '');
  await expect(dock).toHaveAttribute('aria-hidden', 'true');

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Tab');
  await expect(disclosure).toBeFocused();
  await expect(dock.locator(':focus')).toHaveCount(0);

  await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(disclosure).toHaveAccessibleName('Close navigation');
  await expect(dock).not.toHaveAttribute('inert', '');
  await expect(dock).not.toHaveAttribute('aria-hidden', 'true');
  await expect(dock).toBeVisible();

  await page.keyboard.press('Shift+Tab');
  await expect(dock.getByRole('button', { name: /switch to (dark|light) mode/i })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(disclosure).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await expect(disclosure).toHaveAccessibleName('Open navigation');
  await expect(disclosure).toBeFocused();
  await expect(dock).toHaveAttribute('inert', '');
  await page.keyboard.press('Tab');
  await expect(dock.locator(':focus')).toHaveCount(0);
});
