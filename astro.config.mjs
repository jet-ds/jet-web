// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://example.com', // TODO: Update with your actual domain
  integrations: [
    react(),
    mdx(),
    tailwind({
      applyBaseStyles: false, // We'll use our own global.css
    }),
    sitemap(),
  ],
});
