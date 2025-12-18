# Personal Website & Blog

A modern, minimal personal website and blog built with Astro, MDX, and React. Features a dark mode design with blue theming, full SEO optimization, and perfect performance scores.

[![Lighthouse Performance](https://img.shields.io/badge/Lighthouse-100%2F100-brightgreen)](https://developers.google.com/web/tools/lighthouse)
[![Built with Astro](https://img.shields.io/badge/Built%20with-Astro-FF5D01)](https://astro.build)

## ✨ Features

- 🎨 **Modern Design**: Clean, minimal aesthetic with dark mode support
- ⚡️ **Perfect Performance**: 100/100 Lighthouse score with excellent Core Web Vitals
- 📝 **MDX Blog**: Rich content with embedded React components
- 🔬 **Works Showcase**: Flexible system for research papers and projects
- 🎯 **SEO Optimized**: Complete meta tags, OpenGraph, structured data, RSS feed
- 🌙 **Dark Mode**: Persistent theme with system preference detection
- 📱 **Fully Responsive**: Mobile-first design that works on all devices
- 🚀 **Fast Loading**: Minimal JavaScript (~68 kB gzipped), system fonts, optimized images
- ♿️ **Accessible**: Semantic HTML, ARIA labels, keyboard navigation

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd jet-web

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) to view the site.

## 📦 Project Structure

```
/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable components
│   │   ├── layout/      # Header, Footer, Navigation
│   │   ├── seo/         # SEO, StructuredData
│   │   ├── ui/          # Button, Card, Tag, etc.
│   │   ├── blog/        # Blog-specific components
│   │   └── works/       # Works-specific components
│   ├── content/         # Content Collections (MDX)
│   │   ├── config.ts    # Schema definitions
│   │   ├── blog/        # Blog posts
│   │   └── works/       # Work items
│   ├── layouts/         # Page layouts
│   ├── pages/           # File-based routing
│   ├── styles/          # Global styles
│   ├── utils/           # Helper functions
│   └── config/          # Site configuration
├── docs/                # Project documentation
├── astro.config.mjs     # Astro configuration
├── tailwind.config.mjs  # Tailwind configuration
└── package.json
```

## 🛠️ Development Commands

| Command                | Action                                       |
| :--------------------- | :------------------------------------------- |
| `npm install`          | Install dependencies                          |
| `npm run dev`          | Start dev server at `localhost:4321`         |
| `npm run build`        | Build production site to `./dist/`           |
| `npm run preview`      | Preview production build locally             |
| `npm run astro check`  | Type-check Astro files                       |

## ✍️ Content Management

### Adding Blog Posts

Create a new `.mdx` file in `src/content/blog/`:

```mdx
---
title: "Your Post Title"
description: "A brief description for SEO"
pubDate: 2025-12-18
author: "Your Name"
tags: ["astro", "web-dev"]
draft: false
---

Your content here with full MDX support!
```

### Adding Work Items

Create a new `.mdx` file in `src/content/works/`:

```mdx
---
title: "Your Work Title"
description: "A brief description"
type: "research" # or "project" or "other"
date: 2025-12-18
tags: ["ai", "research"]
featured: true
links:
  - label: "View on SSRN"
    url: "https://papers.ssrn.com/..."
venue: "Conference/Journal Name" # for research
---

Your work content here!
```

### Content Schemas

- **Blog Posts**: title, description, pubDate, author, tags, draft (optional), image (optional)
- **Works**: title, description, type, date, tags, featured, links, venue (research), technologies (projects)

All content is type-safe and validated at build time.

## 🚀 Deployment

### Deploy to Vercel (Recommended)

#### Using Vercel CLI (Preview):

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy preview
vercel

# Deploy to production
vercel --prod
```

#### Using GitHub Integration:

1. Push your code to GitHub
2. Import your repository on [Vercel](https://vercel.com)
3. Vercel auto-detects Astro and configures everything
4. Deploy!

Vercel automatically configures:
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

### Other Platforms

The site works on any static hosting platform (Netlify, Cloudflare Pages, GitHub Pages, etc.)

## 🎨 Customization

### Site Configuration

Update `src/config/site.ts`:

```typescript
export const SITE = {
  title: 'Your Name',
  description: 'Your site description',
  author: 'Your Name',
  email: 'your@email.com',
  siteUrl: 'https://yoursite.com',
};

export const SOCIAL_LINKS = {
  github: 'https://github.com/yourusername',
  linkedin: 'https://linkedin.com/in/yourusername',
  twitter: 'https://twitter.com/yourusername',
  ssrn: 'https://papers.ssrn.com/...',
};
```

### Update Site URL

Update `site` in `astro.config.mjs`:

```javascript
export default defineConfig({
  site: 'https://yoursite.com',
  // ... other config
});
```

### Styling

- Global styles: `src/styles/global.css`
- Tailwind config: `tailwind.config.mjs`
- Dark mode colors: Configured in Tailwind config

## 📊 Performance

- **Lighthouse Score**: 100/100
- **First Contentful Paint**: 1.2s
- **Largest Contentful Paint**: 1.5s
- **Total Blocking Time**: 0ms
- **Cumulative Layout Shift**: 0
- **JavaScript Bundle**: ~68 kB (gzipped)

## 🛡️ SEO Features

- ✅ Semantic HTML
- ✅ Meta tags (title, description, author)
- ✅ OpenGraph tags (Facebook, LinkedIn)
- ✅ Twitter Cards
- ✅ Canonical URLs
- ✅ Structured data (JSON-LD)
- ✅ Sitemap (auto-generated)
- ✅ RSS feed
- ✅ robots.txt

## 🏗️ Tech Stack

- **Framework**: [Astro](https://astro.build) v5.16.6
- **UI Library**: [React](https://react.dev) v19.2.3 (for interactive components)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) v3.4.18
- **Content**: [MDX](https://mdxjs.com) with Content Collections
- **Type Safety**: [TypeScript](https://www.typescriptlang.org)
- **Deployment**: [Vercel](https://vercel.com)

## 📄 Documentation

- [Project Specification](docs/project-spec.md) - Complete technical specification
- [Implementation Log](docs/implementation-log.md) - Phase-by-phase development log
- [Claude Code Memory](CLAUDE.md) - Quick reference for Claude Code

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

Built with [Astro](https://astro.build), styled with [Tailwind CSS](https://tailwindcss.com), and deployed on [Vercel](https://vercel.com).

---

**Last Updated**: 2025-12-18
