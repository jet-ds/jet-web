/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class', // Enable dark mode with class strategy
  theme: {
    extend: {
      colors: {
        // OKLCH Color Scales (Radix-style 1-11 numbering)
        // Brand (Slate Blue) - Primary interactive elements
        brand: {
          1: 'oklch(0.9755 0.0045 258.32)',  // #f5f7fa
          2: 'oklch(0.9502 0.0069 247.9)',   // #ebeff3
          3: 'oklch(0.8895 0.0164 245.1)',   // #d2dce5
          4: 'oklch(0.7896 0.0331 246.79)',  // #aabdcf
          5: 'oklch(0.6728 0.0512 244.82)',  // #7c9ab4
          6: 'oklch(0.5725 0.0587 245.59)',  // #5b7c99
          7: 'oklch(0.4956 0.0566 248.16)',  // #486581
          8: 'oklch(0.4296 0.0477 248.99)',  // #3b5269
          9: 'oklch(0.384 0.0392 251.63)',   // #344558
          10: 'oklch(0.3536 0.0306 248.71)', // #2f3d4b
          11: 'oklch(0.27 0.0235 256.43)',   // #1f2732
        },
        // Accent (Mustard Yellow) - Highlights, CTAs
        accent: {
          1: 'oklch(0.9873 0.0262 102.21)',  // #fefce8
          2: 'oklch(0.9735 0.0706 102.42)',  // #fff9c2
          3: 'oklch(0.9455 0.1274 101.26)',  // #fff087
          4: 'oklch(0.9068 0.1681 97.52)',   // #ffe043
          5: 'oklch(0.8695 0.1736 90.79)',   // #ffce1b
          6: 'oklch(0.8005 0.1639 84.11)',   // #efb303
          7: 'oklch(0.6834 0.1451 73.6)',    // #ce8900
          8: 'oklch(0.5558 0.1239 64.52)',   // #a46104
          9: 'oklch(0.4766 0.1078 59.07)',   // #884b0b
          10: 'oklch(0.4219 0.0931 56.19)',  // #733e10
          11: 'oklch(0.2852 0.0664 52.21)',  // #431f05
        },
        // Neutral (Neutral Blue/Slate Grey) - Base UI, text, backgrounds
        neutral: {
          1: 'oklch(0.9764 0.0045 214.33)',  // #f4f8f9
          2: 'oklch(0.9549 0.006 223.46)',   // #ecf1f3
          3: 'oklch(0.9162 0.0111 225.99)',  // #dce5e9
          4: 'oklch(0.8614 0.018 229.04)',   // #c6d4db
          5: 'oklch(0.7975 0.0252 234.52)',  // #aec0cb
          6: 'oklch(0.7342 0.0322 242.16)',  // #98acbc
          7: 'oklch(0.6596 0.0375 252.38)',  // #8294a9
          8: 'oklch(0.5907 0.036 254.11)',   // #6f7f93
          9: 'oklch(0.5122 0.03 253.72)',    // #5b6878
          10: 'oklch(0.4521 0.022 250.82)',  // #4d5762
          11: 'oklch(0.3151 0.0143 256.78)', // #2d3239
        },
        // Semantic tokens (CSS variable references)
        // Background hierarchy
        'bg-base': 'var(--color-bg-base)',
        'bg-subtle': 'var(--color-bg-subtle)',
        'bg-ui': 'var(--color-bg-ui)',
        'bg-hover': 'var(--color-bg-hover)',
        'bg-active': 'var(--color-bg-active)',
        // Surface variants
        'surface-base': 'var(--color-surface-base)',
        'surface-raised': 'var(--color-surface-raised)',
        'surface-overlay': 'var(--color-surface-overlay)',
        // Text hierarchy
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-tertiary': 'var(--color-text-tertiary)',
        'text-disabled': 'var(--color-text-disabled)',
        // Border hierarchy
        'border-subtle': 'var(--color-border-subtle)',
        'border-default': 'var(--color-border-default)',
        'border-strong': 'var(--color-border-strong)',
        // Brand/Interactive
        'brand-base': 'var(--color-brand-base)',
        'brand-hover': 'var(--color-brand-hover)',
        'brand-active': 'var(--color-brand-active)',
        'brand-subtle': 'var(--color-brand-subtle)',
        'brand-text': 'var(--color-brand-text)',
        'brand-contrast': 'var(--color-brand-contrast)',
        // Accent
        'accent-base': 'var(--color-accent-base)',
        'accent-hover': 'var(--color-accent-hover)',
        'accent-subtle': 'var(--color-accent-subtle)',
        'accent-text': 'var(--color-accent-text)',
        'accent-contrast': 'var(--color-accent-contrast)',
        // Glass morphism
        'glass-bg': 'var(--color-glass-bg)',
        'glass-border': 'var(--color-glass-border)',
        'glass-highlight': 'var(--color-glass-highlight)',
        'glass-shadow': 'var(--color-glass-shadow)',
      },
      fontFamily: {
        sans: [
          '"Work Sans"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        serif: [
          'Brawler',
          'Georgia',
          'Cambria',
          '"Times New Roman"',
          'Times',
          'serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
