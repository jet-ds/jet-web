import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test,
  type Locator,
  type Page,
} from '@playwright/test';

const suggestedQuestions = [
  'What does Jet write about agentic work?',
  'Summarize the recursive convergence hypothesis.',
  'Which projects connect AI and systems thinking?',
];

async function expectNoSeriousAxeViolations(page: Page, state: string) {
  const lifecycleLabels = page.getByTestId('lifecycle-visual-label');
  if (await lifecycleLabels.count() > 0) {
    await expect(lifecycleLabels).toHaveCount(1);
    await expect(lifecycleLabels).toHaveCSS('opacity', '1');
  }

  const results = await new AxeBuilder({ page })
    .analyze();
  const serious = results.violations.filter((violation) =>
    violation.impact === 'serious' || violation.impact === 'critical');
  expect(serious, `${state} has serious or critical axe violations`).toEqual([]);
}

async function focusWithKeyboard(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

async function expectLifecycleAccessibility(page: Page, announcement: string) {
  const fullStatus = page.getByTestId('lifecycle-announcement');
  await expect(fullStatus).toHaveAttribute('role', 'status');
  await expect(fullStatus).toHaveAttribute('aria-live', 'polite');
  await expect(fullStatus).toHaveAttribute('aria-atomic', 'true');
  await expect(fullStatus).toHaveText(announcement);

  const compactStatus = page.getByTestId('lifecycle-visible-status');
  await expect(compactStatus).toBeVisible();
  await expect(compactStatus).toHaveAttribute('aria-hidden', 'true');
  await expect(compactStatus).not.toHaveAttribute('aria-live', /.+/);
  await expect(compactStatus).not.toHaveAttribute('role', /.+/);

  const chrome = await compactStatus.evaluate((element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      borderRadius: style.borderRadius,
      borderWidths: [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ],
      boxShadow: style.boxShadow,
      height: bounds.height,
      minWidth: style.minWidth,
      paddings: [
        style.paddingTop,
        style.paddingRight,
        style.paddingBottom,
        style.paddingLeft,
      ],
      width: bounds.width,
    };
  });
  expect(chrome.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  expect(chrome.backgroundImage).toBe('none');
  expect(chrome.borderRadius).toBe('0px');
  expect(chrome.borderWidths).toEqual(['0px', '0px', '0px', '0px']);
  expect(chrome.boxShadow).toBe('none');
  expect(chrome.height).toBeLessThan(32);
  expect(chrome.minWidth).toBe('auto');
  expect(chrome.paddings).toEqual(['0px', '0px', '0px', '0px']);
  expect(chrome.width).toBeLessThan(160);
}

for (const route of ['/', '/blog/', '/works/', '/chatbot/']) {
  test(`${route} has no serious axe violations`, async ({ page }) => {
    await page.goto(route);
    await expectNoSeriousAxeViolations(page, route);
  });
}

test("Jet's Ghost introduction, ready, and response states remain accessible by keyboard", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.goto('/chatbot/?runtime=fake&stream=slow');

  await expectLifecycleAccessibility(page, "Jet's Ghost is not running.");
  await expectNoSeriousAxeViolations(page, 'introduction');

  const compatibility = page.getByRole('button', { name: 'Check compatibility' });
  await focusWithKeyboard(page, compatibility);
  await page.keyboard.press('Enter');

  const load = page.getByRole('button', { name: /Load Jet's Ghost/ });
  await focusWithKeyboard(page, load);
  await page.keyboard.press('Enter');

  const composer = page.getByRole('textbox', { name: "Ask Jet's Ghost" });
  await expect(composer).toBeFocused();
  await expectLifecycleAccessibility(page, "Jet's Ghost is ready.");
  await expectNoSeriousAxeViolations(page, 'ready');

  const newSession = page.getByRole('button', { name: 'New session' });
  const unload = page.getByRole('button', { name: 'Unload' });
  await focusWithKeyboard(page, newSession);
  await focusWithKeyboard(page, unload);
  for (const question of suggestedQuestions) {
    await focusWithKeyboard(page, page.getByRole('button', { name: question }));
  }

  const firstSuggestion = page.getByRole('button', { name: suggestedQuestions[0] });
  await focusWithKeyboard(page, firstSuggestion);
  await page.keyboard.press('Enter');
  await expect(composer).toBeFocused();
  await expect(composer).toHaveValue(suggestedQuestions[0]);

  const send = page.getByRole('button', { name: 'Send message' });
  await focusWithKeyboard(page, send);
  await page.keyboard.press('Enter');
  await expectLifecycleAccessibility(page, "Jet's Ghost is responding.");

  const conversation = page.getByLabel('Conversation');
  const response = conversation.locator('article').filter({
    hasText: "Jet's published work connects local-first AI",
  }).locator('p').first();
  await expect(response).toContainText(
    "Jet's published work connects local-first AI with systems thinking [S1].",
  );
  await expect(response).not.toHaveAttribute('aria-live', /.+/);
  expect(await response.evaluate((element) => Boolean(element.closest('[aria-live]')))).toBe(false);
  await expectNoSeriousAxeViolations(page, 'response');

  const sources = page.getByRole('button', { name: /^\d+ sources?$/ });
  await focusWithKeyboard(page, sources);
  await page.keyboard.press('Enter');
  const sourceRegion = page.getByRole('region', { name: 'Sources for this response' });
  await expect(sourceRegion).toBeVisible();
  await focusWithKeyboard(page, sourceRegion.getByRole('link').first());

  await focusWithKeyboard(page, newSession);
  await page.keyboard.press('Enter');
  await expect(composer).toBeFocused();
  await expect(composer).toHaveValue('');
});

test("Jet's Ghost recoverable error is axe-clean and keyboard operable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.route('**/assistant/corpus/manifest.json', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'text/plain',
      body: 'Temporarily unavailable',
    });
  });
  await page.goto('/chatbot/?runtime=fake');

  const compatibility = page.getByRole('button', { name: 'Check compatibility' });
  await focusWithKeyboard(page, compatibility);
  await page.keyboard.press('Enter');
  const load = page.getByRole('button', { name: /Load Jet's Ghost/ });
  await focusWithKeyboard(page, load);
  await page.keyboard.press('Enter');

  const returnToLoad = page.getByRole('button', { name: 'Return to load' });
  await expect(returnToLoad).toBeFocused();
  await expect(returnToLoad).toHaveAttribute(
    'aria-describedby',
    'jets-ghost-activation-status',
  );
  await expectLifecycleAccessibility(
    page,
    "Jet's Ghost did not finish loading. Review the recovery action.",
  );
  await expectNoSeriousAxeViolations(page, 'recoverable error');

  await page.keyboard.press('Enter');
  await expect(load).toBeFocused();
});

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
