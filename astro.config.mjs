// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

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
        return pathname !== '/tools' && !pathname.startsWith('/tools/');
      },
    }),
  ],
  vite: {
    build: {
      target: ['chrome111', 'safari16.4', 'firefox128'],
    },
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
