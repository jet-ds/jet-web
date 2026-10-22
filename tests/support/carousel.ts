import { expect, type Locator } from '@playwright/test';

/** Trigger the visible enhancement through its persistent public owner. */
export async function revealCarousel(
  owner: Locator,
  label: string,
): Promise<Locator> {
  // The visibility boundary is the section's leading edge. Hydration may replace
  // every child, so the action must finish on the Astro-owned container itself.
  await owner.evaluate((element) =>
    element.scrollIntoView({
      block: 'start',
      inline: 'nearest',
      behavior: 'instant',
    }),
  );
  const region = owner.getByRole('region', { name: label, exact: true });
  await expect(region).toBeVisible();
  return region;
}
