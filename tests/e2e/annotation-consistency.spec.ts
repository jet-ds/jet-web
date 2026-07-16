import { expect, test } from '@playwright/test';

interface LinearColor {
  channels: [number, number, number];
  alpha: number;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function srgbToLinear(value: number): number {
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
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
    const channels = parts.slice(0, 3).map((part) => (
      part.endsWith('%')
        ? Number.parseFloat(part) / 100
        : Number.parseFloat(part) / 255
    ));
    const alpha = parseAlpha(slashAlpha ?? parts[3]);
    return {
      channels: channels.map((channel) => srgbToLinear(clamp(channel))) as [number, number, number],
      alpha,
    };
  }

  if (name === 'color' && colorBody.startsWith('srgb ')) {
    const channels = colorBody.slice(5).trim().split(/\s+/u).map(Number);
    return {
      channels: channels.map((channel) => srgbToLinear(clamp(channel))) as [number, number, number],
      alpha: parseAlpha(slashAlpha),
    };
  }

  if (name === 'oklch') {
    const [rawLightness, rawChroma, rawHue] = colorBody.split(/\s+/u);
    const lightness = rawLightness.endsWith('%')
      ? Number.parseFloat(rawLightness) / 100
      : Number.parseFloat(rawLightness);
    const chroma = Number.parseFloat(rawChroma);
    const hue = Number.parseFloat(rawHue) * Math.PI / 180;
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

  const luminance = ({ channels }: LinearColor) => (
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  );
  const lighter = Math.max(luminance(foregroundColor), luminance(backgroundColor));
  const darker = Math.min(luminance(foregroundColor), luminance(backgroundColor));
  return (lighter + 0.05) / (darker + 0.05);
}

test('Blog and Works separate first-person visible copy from SEO metadata', async ({ page }) => {
  const cases = [
    {
      route: '/blog/',
      heading: 'Blog',
      subheading: 'Explore my articles on AI, agentic software development, local-first tools, technical workflows, and the systems shaping modern work.',
      description: "Explore Jet Sanchez's articles on AI, agentic software development, local-first tools, technical workflows, and the systems shaping modern work.",
    },
    {
      route: '/works/',
      heading: 'Works',
      subheading: 'Explore my research papers, software projects, and applied AI experiments spanning agentic systems, AI governance, and emerging technology.',
      description: "Explore Jet Sanchez's research papers, software projects, and applied AI experiments spanning agentic systems, AI governance, and emerging technology.",
    },
  ] as const;

  for (const { route, heading, subheading, description } of cases) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1, name: heading }))
      .toBeVisible();
    await expect(page.locator('main h1 + p')).toHaveText(subheading);
    await expect(page.locator('main h1 + p')).not.toContainText("Jet Sanchez's");
    await expect(page.locator('meta[name="description"]'))
      .toHaveAttribute('content', description);
  }
});

test('shared inline links retain focus and reduced-motion behavior', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters/');

  const backLink = page.getByRole('link', { name: 'Back to blog' });
  await expect(backLink).toHaveClass(/\btext-link\b/u);

  const proseLink = page.locator('.prose a').first();
  await expect(proseLink).toHaveCSS('font-weight', '500');
  await expect(proseLink).toHaveCSS('text-decoration-line', 'none');
  await expect(proseLink).toHaveCSS('text-underline-offset', '4px');
  await expect(proseLink).toHaveCSS('transition-duration', '0s');
  await proseLink.focus();
  await expect(proseLink).toHaveCSS('text-decoration-line', 'underline');
  await expect(proseLink).toHaveCSS('outline-style', 'solid');
  await expect(proseLink).toHaveCSS('outline-offset', '2px');

  const tocLink = page.locator('.toc a:not(.active)').first();
  await expect(tocLink).toBeVisible();
  await expect(tocLink).toHaveCSS('font-weight', '400');
  await tocLink.hover();
  await expect(tocLink).toHaveCSS('text-decoration-line', 'none');
  await tocLink.focus();
  await expect(tocLink).not.toHaveCSS('outline-offset', '2px');

  const postNavigationLink = page.locator('nav[aria-label="Post navigation"] a').first();
  await expect(postNavigationLink).toBeVisible();
  await expect(postNavigationLink).toHaveCSS('font-weight', '400');
  await postNavigationLink.hover();
  await expect(postNavigationLink).toHaveCSS('text-decoration-line', 'none');
  await postNavigationLink.focus();
  await expect(postNavigationLink).not.toHaveCSS('outline-offset', '2px');

  await page.goto('/licenses/jets-ghost/');
  await expect(page.locator('a[href="/licenses/apache-2.0.txt"]'))
    .toHaveClass(/\btext-link\b/u);
});

test('Home CTA keeps distinct, opaque, AA semantic surfaces in both themes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const ctaHeading = page.getByRole('heading', { name: "Let's Connect" });
  const section = page.locator('section').filter({ has: ctaHeading });
  const contactAction = section.getByRole('link', { name: 'Contact me', exact: true });
  const learnAction = section.getByRole('link', { name: 'Learn more', exact: true });

  await expect(section).toHaveClass(/\bbg-section-brand\b/u);
  await expect(section).toHaveClass(/\bpy-section\b/u);
  await expect(section).not.toHaveClass(/\bbg-accent-subtle\b/u);
  await expect(contactAction).toHaveAttribute('data-action-variant', 'accent');
  await expect(contactAction).toHaveAttribute('data-action-density', 'immersive');
  await expect(learnAction).toHaveAttribute('data-action-variant', 'soft');
  await expect(learnAction).toHaveAttribute('data-action-density', 'immersive');

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((nextTheme) => {
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      localStorage.setItem('theme', nextTheme);
    }, theme);

    const metrics = await section.evaluate((element) => {
      const styles = (target: Element) => getComputedStyle(target);
      const details = (target: Element) => {
        const style = styles(target);
        const bounds = target.getBoundingClientRect();
        return {
          background: style.backgroundColor,
          foreground: style.color,
          width: bounds.width,
          height: bounds.height,
        };
      };
      const heading = element.querySelector('h2');
      const paragraph = element.querySelector('p');
      const contact = element.querySelector('a[href="/contact/"]');
      const learn = element.querySelector('a[href="/about/"]');
      if (heading === null || paragraph === null || contact === null || learn === null) {
        throw new Error('Home CTA structure is incomplete');
      }

      return {
        section: details(element),
        heading: details(heading),
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
      `${theme} accent action contrast`,
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(metrics.learn.foreground, metrics.learn.background),
      `${theme} soft action contrast`,
    ).toBeGreaterThanOrEqual(4.5);
    expect(metrics.contact.width).toBeGreaterThanOrEqual(48);
    expect(metrics.contact.height).toBeGreaterThanOrEqual(48);
    expect(metrics.learn.width).toBeGreaterThanOrEqual(48);
    expect(metrics.learn.height).toBeGreaterThanOrEqual(48);
  }
});
