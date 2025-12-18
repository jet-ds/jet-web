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
  image: {
    // Image optimization configuration
    domains: [], // Add external domains if needed
    remotePatterns: [], // Add remote patterns if needed
  },
  markdown: {
    // Shiki syntax highlighting configuration
    shikiConfig: {
      // Choose from Shiki's built-in themes (or add your own)
      // Light theme for light mode, dark theme for dark mode
      theme: 'github-dark',
      // Alternative: Use dual themes for light/dark mode
      // themes: {
      //   light: 'github-light',
      //   dark: 'github-dark',
      // },
      // Enable word wrap to prevent horizontal scrolling
      wrap: true,
      // Add custom languages if needed
      langs: [],
    },
  },
});
