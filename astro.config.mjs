// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import partytown from '@astrojs/partytown';

const isProduction = process.env.VERCEL_ENV === 'production';

// https://astro.build/config
export default defineConfig({
  site: 'https://jetsanchez.com',
  trailingSlash: 'always',
  compressHTML: true,
  integrations: [
    react(),
    mdx(),
    sitemap({
      filter: (page) => {
        const pathname = new URL(page).pathname.replace(/\/$/, '') || '/';
        return (
          (isProduction || pathname !== '/chatbot') &&
          pathname !== '/tools' &&
          !pathname.startsWith('/tools/')
        );
      },
    }),
    partytown({
      config: {
        forward: ['dataLayer.push', 'gtag'], // Forward GA4 events to web worker
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
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
