import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';

const suggestedQuestions = [
  'What does Jet write about agentic work?',
  'Summarize the recursive convergence hypothesis.',
  'Which projects connect AI and systems thinking?',
];

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

function parseCssColor(raw: string): LinearColor {
  const value = raw.trim().toLowerCase();
  const functional = value.match(/^([a-z]+)\((.*)\)$/u);
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
    const a = chroma * Math.cos(hue);
    const b = chroma * Math.sin(hue);

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
      alpha: parseAlpha(slashAlpha),
    };
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

async function seriousAxeViolations(page: Page) {
  const lifecycleLabels = page.getByTestId('lifecycle-visual-label');
  if ((await lifecycleLabels.count()) > 0) {
    await expect(lifecycleLabels).toHaveCount(1);
    await expect(lifecycleLabels).toHaveCSS('opacity', '1');
  }

  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter(
    (violation) =>
      violation.impact === 'serious' || violation.impact === 'critical',
  );
}

async function expectNoSeriousAxeViolations(page: Page, state: string) {
  const serious = await seriousAxeViolations(page);
  expect(serious, `${state} has serious or critical axe violations`).toEqual(
    [],
  );
}

function locPaths(xml: string) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
    ([, location]) => new URL(location).pathname,
  );
}

async function sitemapHtmlRoutes(request: APIRequestContext) {
  const indexResponse = await request.get('/sitemap-index.xml');
  expect(indexResponse.ok()).toBe(true);

  const sitemapPaths = locPaths(await indexResponse.text());
  const routes = new Set<string>();
  for (const sitemapPath of sitemapPaths) {
    const sitemapResponse = await request.get(sitemapPath);
    expect(sitemapResponse.ok()).toBe(true);
    for (const route of locPaths(await sitemapResponse.text()))
      routes.add(route);
  }

  return [...routes].sort();
}

async function focusWithKeyboard(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await target.evaluate((element) => element === document.activeElement))
      return;
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
}

for (const theme of ['light', 'dark'] as const) {
  test(`every sitemap HTML page plus the dormant route is axe-clean in ${theme} theme`, async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium');

    await page.addInitScript((selectedTheme) => {
      localStorage.setItem('theme', selectedTheme);
    }, theme);

    const sitemapRoutes = await sitemapHtmlRoutes(request);
    expect(sitemapRoutes).toContain('/chatbot/');
    expect(sitemapRoutes).not.toContain('/tools/');

    const failures = [];
    for (const route of [...sitemapRoutes, '/tools/']) {
      await page.goto(route);
      await expect(page.locator('html')).toHaveClass(
        theme === 'dark' ? /\bdark\b/u : /^(?!.*\bdark\b)/u,
      );
      for (const violation of await seriousAxeViolations(page)) {
        for (const node of violation.nodes) {
          failures.push({
            route,
            rule: violation.id,
            target: node.target,
            summary: node.failureSummary,
          });
        }
      }
    }
    expect(failures, `axe violations in ${theme} theme`).toEqual([]);
  });
}

test('Egregore introduction, ready, and response states remain accessible by keyboard', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.goto('/chatbot/?runtime=fake&stream=slow');

  await expectLifecycleAccessibility(page, 'Egregore is not running.');
  await expectNoSeriousAxeViolations(page, 'introduction');

  const compatibility = page.getByRole('button', {
    name: 'Check compatibility',
  });
  await focusWithKeyboard(page, compatibility);
  await page.keyboard.press('Enter');

  const load = page.getByRole('button', { name: /Load Egregore/ });
  await focusWithKeyboard(page, load);
  await page.keyboard.press('Enter');

  const composer = page.getByRole('textbox', { name: 'Ask Egregore' });
  await expect(composer).toBeFocused();
  await expectLifecycleAccessibility(page, 'Egregore is ready.');
  await expectNoSeriousAxeViolations(page, 'ready');

  const newSession = page.getByRole('button', { name: 'New session' });
  const unload = page.getByRole('button', { name: 'Unload' });
  await focusWithKeyboard(page, newSession);
  await focusWithKeyboard(page, unload);
  for (const question of suggestedQuestions) {
    await focusWithKeyboard(page, page.getByRole('button', { name: question }));
  }

  const firstSuggestion = page.getByRole('button', {
    name: suggestedQuestions[0],
  });
  await focusWithKeyboard(page, firstSuggestion);
  await page.keyboard.press('Enter');
  await expect(composer).toBeFocused();
  await expect(composer).toHaveValue(suggestedQuestions[0]);

  const send = page.getByRole('button', { name: 'Send message' });
  await focusWithKeyboard(page, send);
  await page.keyboard.press('Enter');
  await expectLifecycleAccessibility(page, 'Egregore is responding.');

  const conversation = page.getByLabel('Conversation');
  const response = conversation.locator('article').last().locator('p').first();
  await expect(response).not.toBeEmpty();
  await expect(response.getByRole('link', { name: /\[S\d+\]/u })).toBeVisible();
  await expect(response).not.toHaveAttribute('aria-live', /.+/);
  expect(
    await response.evaluate((element) =>
      Boolean(element.closest('[aria-live]')),
    ),
  ).toBe(false);
  await expectNoSeriousAxeViolations(page, 'response');

  const sources = page.getByRole('button', { name: /^\d+ sources?$/ });
  await focusWithKeyboard(page, sources);
  await page.keyboard.press('Enter');
  const sourceRegion = page.getByRole('region', {
    name: 'Sources for this response',
  });
  await expect(sourceRegion).toBeVisible();
  await focusWithKeyboard(page, sourceRegion.getByRole('link').first());

  await focusWithKeyboard(page, newSession);
  await page.keyboard.press('Enter');
  await expect(composer).toBeFocused();
  await expect(composer).toHaveValue('');
});

test('Egregore recoverable error is axe-clean and keyboard operable', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/assistant/corpus/manifest.json', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'text/plain',
      body: 'Temporarily unavailable',
    });
  });
  await page.goto('/chatbot/?runtime=fake');

  const compatibility = page.getByRole('button', {
    name: 'Check compatibility',
  });
  await focusWithKeyboard(page, compatibility);
  await page.keyboard.press('Enter');
  const load = page.getByRole('button', { name: /Load Egregore/ });
  await focusWithKeyboard(page, load);
  await page.keyboard.press('Enter');

  const returnToLoad = page.getByRole('button', { name: 'Return to load' });
  await expect(returnToLoad).toBeFocused();
  await expect(returnToLoad).toHaveAttribute(
    'aria-describedby',
    'egregore-activation-status',
  );
  await expectLifecycleAccessibility(
    page,
    'Egregore did not finish loading. Review the recovery action.',
  );
  await expectNoSeriousAxeViolations(page, 'recoverable error');

  await page.keyboard.press('Enter');
  await expect(load).toBeFocused();
});

test('Home call to action keeps opaque AA surfaces and full touch targets', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const heading = page.getByRole('heading', { name: "Let's Connect" });
  const section = page.locator('section').filter({ has: heading });

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((nextTheme) => {
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      localStorage.setItem('theme', nextTheme);
    }, theme);

    const metrics = await section.evaluate((element) => {
      const details = (target: Element) => {
        const style = getComputedStyle(target);
        const bounds = target.getBoundingClientRect();
        return {
          background: style.backgroundColor,
          foreground: style.color,
          height: bounds.height,
          width: bounds.width,
        };
      };
      const headingElement = element.querySelector('h2');
      const paragraph = element.querySelector('p');
      const contact = element.querySelector('a[href="/contact/"]');
      const learn = element.querySelector('a[href="/about/"]');
      if (
        headingElement === null ||
        paragraph === null ||
        contact === null ||
        learn === null
      ) {
        throw new Error('Home call-to-action structure is incomplete');
      }

      return {
        section: details(element),
        heading: details(headingElement),
        paragraph: details(paragraph),
        contact: details(contact),
        learn: details(learn),
      };
    });

    const backgrounds = [
      metrics.section.background,
      metrics.contact.background,
      metrics.learn.background,
    ];
    expect(new Set(backgrounds).size, `${theme} backgrounds`).toBe(3);
    for (const background of backgrounds) {
      expect(parseCssColor(background).alpha, `${theme} ${background}`).toBe(1);
    }

    expect(
      contrastRatio(metrics.heading.foreground, metrics.section.background),
      `${theme} heading contrast`,
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(metrics.paragraph.foreground, metrics.section.background),
      `${theme} paragraph contrast`,
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(metrics.contact.foreground, metrics.contact.background),
      `${theme} accent-action contrast`,
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(metrics.learn.foreground, metrics.learn.background),
      `${theme} soft-action contrast`,
    ).toBeGreaterThanOrEqual(4.5);

    for (const action of [metrics.contact, metrics.learn]) {
      expect(action.width).toBeGreaterThanOrEqual(48);
      expect(action.height).toBeGreaterThanOrEqual(48);
    }
  }
});

test('reduced motion disables and disposes the Grainient canvas', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('mobile disclosure follows sequential focus order and restores focus', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, 160));
  const disclosure = page.locator(
    'button[aria-controls="site-navigation-dock"]',
  );
  await expect(disclosure).toBeVisible();
  await expect(disclosure).toHaveAccessibleName('Open navigation');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  const controlledId = await disclosure.getAttribute('aria-controls');
  if (!controlledId)
    throw new Error('Navigation disclosure lacks aria-controls');
  const dock = page.locator(`#${controlledId}`);
  await expect(dock).toHaveAttribute('inert', '');
  await expect(dock).toHaveAttribute('aria-hidden', 'true');

  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
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
  await expect(
    dock.getByRole('button', { name: /switch to (dark|light) mode/i }),
  ).toBeFocused();
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
