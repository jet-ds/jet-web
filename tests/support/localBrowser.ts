import { test as base } from '@playwright/test';
import { installMediaTrafficFixture } from './mediaTraffic';
import { installGoogleAnalyticsTrafficBlock } from './googleAnalyticsTraffic';
export { expect } from '@playwright/test';
export const test = base.extend({
  context: async ({ context }, use) => {
    await installGoogleAnalyticsTrafficBlock(context);
    await installMediaTrafficFixture(context);
    await use(context);
  },
});
