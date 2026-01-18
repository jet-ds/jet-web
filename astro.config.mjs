// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import partytown from '@astrojs/partytown';

// https://astro.build/config
export default defineConfig({
  site: 'https://jetsanchez.com',
  adapter: vercel(), // Vercel adapter for API routes
  integrations: [
    react(),
    mdx(),
    tailwind({
      applyBaseStyles: false, // We'll use our own global.css
    }),
    sitemap(),
    partytown({
      config: {
        forward: ['dataLayer.push', 'gtag'], // Forward GA4 events to web worker
      },
    }),
  ],
  image: {
    // Image optimization configuration
    domains: [],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
      },
    ],
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
