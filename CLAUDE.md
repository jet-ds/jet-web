# Personal Website & Blog - Claude Code Memory

> Project memory file for Claude Code. See @docs/project-spec.md for complete technical specification and implementation plan.

## Project Overview

Modern personal website and blog built with Astro, MDX, and React. Features a dark mode design with blue theming, full SEO optimization, and deployment on Vercel.

**Key Sections**: Home, About, Blog, Works (showcasing research papers and projects), Contact

## Frequently Used Commands

```bash
# Development
npm run dev              # Start dev server at http://localhost:4321
npm run build            # Build for production
npm run preview          # Preview production build locally

# Code Quality
npm run astro check      # Type-check Astro files
npm run lint             # Run ESLint (if configured)

# Content
# Blog posts: src/content/blog/*.mdx
# Works: src/content/works/*.mdx
```

## Tech Stack

- **Astro**: v5.x (latest: v5.16.5) - Static site generator
- **React**: v19.x (latest: v19.2.3) - Interactive components only
- **Tailwind CSS**: v3.4.18 - Styling (using v3.x for reliability)
- **TypeScript**: v5.9.x - Type safety
- **MDX**: Rich content with embedded components
- **Deployment**: Vercel

## Code Style & Conventions

### General
- **Indentation**: 2 spaces (no tabs)
- **Line endings**: LF (Unix-style)
- **Quotes**: Single quotes for strings, double quotes for JSX attributes
- **Semicolons**: Required
- **TypeScript**: Strict mode enabled

### File Naming
- Components: PascalCase (e.g., `BlogCard.astro`, `ThemeToggle.tsx`)
- Utilities: camelCase (e.g., `readingTime.ts`, `formatDate.ts`)
- Content: kebab-case (e.g., `my-first-post.mdx`)
- Config files: Standard naming (e.g., `astro.config.mjs`, `tailwind.config.mjs`)

### Component Structure
- **Astro components**: Use `.astro` extension for static components
- **React components**: Use `.tsx` extension for interactive components (islands)
- **Layouts**: Place in `src/layouts/` or `src/components/layout/`
- **Minimize JavaScript**: Prefer Astro components over React when possible

### Tailwind CSS (v3.4.18)
- Use `tailwind.config.mjs` for theme customization (JavaScript-based config)
- Configure content paths: `content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}']`
- Dark mode: Use `class` strategy with `.dark` class
- Custom colors: Define in `theme.extend.colors` in config
- Custom utilities: Use `@layer components` or `@layer utilities` in global.css

### Content Collections
- **Type-safe**: All content must follow schemas defined in `src/content/config.ts`
- **Blog schema**: title, description, pubDate, tags, author, draft (optional)
- **Works schema**: title, description, type ('research' | 'project' | 'other'), date, tags, links
- **Frontmatter**: Use YAML frontmatter at top of MDX files

## Project Architecture

### Directory Structure
```
/
├── public/              # Static assets (favicon, robots.txt, images)
├── src/
│   ├── components/      # Reusable components
│   │   ├── layout/      # Header, Footer, Navigation, BaseLayout
│   │   ├── seo/         # SEO, StructuredData components
│   │   ├── ui/          # Button, Card, Tag, etc.
│   │   ├── blog/        # Blog-specific components
│   │   └── works/       # Works-specific components
│   ├── content/         # Content Collections (type-safe)
│   │   ├── config.ts    # Schema definitions
│   │   ├── blog/        # Blog posts (.mdx)
│   │   └── works/       # Work items (.mdx)
│   ├── layouts/         # Page layouts (alternative to components/layout)
│   ├── pages/           # File-based routing
│   │   ├── index.astro  # Home
│   │   ├── about.astro
│   │   ├── contact.astro
│   │   ├── blog/
│   │   │   ├── index.astro      # Blog list
│   │   │   └── [slug].astro     # Blog post detail
│   │   └── works/
│   │       ├── index.astro      # Works list
│   │       └── [slug].astro     # Work detail
│   ├── styles/          # Global styles
│   │   └── global.css   # Tailwind imports + custom CSS
│   ├── utils/           # Helper functions
│   └── config/          # Site configuration (metadata, social links)
├── docs/                # Project documentation
│   └── project-spec.md          # Technical specification
├── astro.config.mjs     # Astro configuration
├── tailwind.config.mjs  # Tailwind v3.x configuration
├── tsconfig.json        # TypeScript configuration
├── package.json
├── CLAUDE.md            # This file - Claude Code project memory
└── README.md
```

### Key Patterns
- **Islands Architecture**: Use React only for interactive components (theme toggle, forms). Keep most components as Astro for performance
- **Content Collections**: Always use `getCollection()` and `getEntry()` for type-safe content access
- **SEO Component**: Reusable `<SEO />` component for all pages with meta tags, OpenGraph, Twitter Cards
- **Layouts**: Use layout components for consistent structure across pages

## Design System

### Color Palette
- **Primary**: Custom blue shades (50-950) defined in `tailwind.config.mjs`
- **Semantic tokens**: background, foreground, accent, muted, border
- **Dark mode**: All colors must have dark mode variants

### Dark Mode Implementation
- Use Tailwind's `dark:` variant for styling
- Theme toggle: React component with localStorage persistence
- System preference detection: `prefers-color-scheme`
- Prevent flash: Inline script in `<head>` to set `.dark` class before render

### Typography
- Define custom font families in Tailwind config
- Responsive typography using Tailwind's responsive utilities
- Reading time calculation for blog posts

## SEO Best Practices

### Required for All Pages
- Unique `<title>` tag (50-60 characters)
- Meta description (150-160 characters)
- Canonical URL
- OpenGraph tags (og:title, og:description, og:image, og:url)
- Twitter Card tags

### Content Pages (Blog, Works)
- JSON-LD structured data (Article schema for blog posts)
- Proper heading hierarchy (single h1, nested h2-h6)
- Alt text for all images
- Reading time for blog posts

### Automated
- Sitemap generation (via @astrojs/sitemap)
- RSS feed for blog (via @astrojs/rss)
- robots.txt in public/

## Development Workflow

### Starting a New Feature
1. Reference the spec: Check @docs/project-spec.md for architectural decisions
2. Identify which phase the feature belongs to
3. Create/modify components following the established patterns
4. Ensure TypeScript types are correct
5. Test in both light and dark modes
6. Verify responsive design (mobile, tablet, desktop)

### Adding Blog Content
1. Create new `.mdx` file in `src/content/blog/`
2. Add required frontmatter (title, description, pubDate, tags, author)
3. Write content using MDX (can embed React components)
4. Build to verify content collection validation
5. Check reading time calculation and metadata display

### Adding Work Items
1. Create new `.mdx` file in `src/content/works/`
2. Add required frontmatter (title, description, type, date)
3. For research papers: Include venue, abstract, links (SSRN, PDF)
4. For projects: Include technologies, repository, demo links
5. Verify display in works list and detail pages

### Pre-Deployment Checklist
- Run `npm run build` successfully
- Run `npm run astro check` with no errors
- Test all navigation links
- Verify dark mode toggle works
- Check responsive design on multiple screen sizes
- Validate SEO meta tags (use browser dev tools)
- Test performance (Lighthouse score 90+)

## Review Criteria & Quality Standards

### Code Quality
- **TypeScript**: No `any` types unless absolutely necessary
- **Accessibility**: Semantic HTML, proper ARIA labels, keyboard navigation
- **Performance**: Minimize JavaScript bundle, lazy load images
- **SEO**: All pages must have proper meta tags and structured data
- **Responsive**: Mobile-first approach, test on multiple breakpoints

### Content Quality
- Blog posts must have meaningful descriptions for SEO
- All images must have descriptive alt text
- External links should open in new tab with `rel="noopener noreferrer"`
- Code blocks should have language specification for syntax highlighting

### Component Guidelines
- Keep components focused and single-purpose
- Prefer composition over prop drilling
- Document complex components with comments
- Reusable components go in `src/components/ui/`

## Common Issues & Solutions

### Tailwind Not Applying Styles
- Check content paths in `tailwind.config.mjs` include your file type
- Ensure `@tailwind` directives are imported in global.css
- Restart dev server after config changes

### Content Collection Errors
- Verify frontmatter matches schema in `src/content/config.ts`
- Check date formats (use ISO 8601: YYYY-MM-DD)
- Ensure required fields are present

### Dark Mode Flash (FOUC)
- Inline script must run before body renders
- Check localStorage key matches between script and toggle component
- Verify `dark` class is applied to `<html>` element

### Build Errors
- Run `npm run astro check` for detailed TypeScript errors
- Check for circular dependencies
- Ensure all imports have correct extensions

## Important Notes

- **Spec is source of truth**: Always reference @docs/project-spec.md for architectural decisions and implementation phases
- **Tailwind v3.x**: Using v3.4.18 for reliability. Do NOT use v4.0 patterns (CSS-first config, @theme directive)
- **Astro Islands**: React components are automatically islands. Use `client:*` directives wisely
- **Content is in MDX**: All blog posts and works are MDX files, not markdown
- **Type safety**: Content Collections provide runtime validation and TypeScript types
- **SEO is critical**: This is a personal/professional site, SEO optimization is a priority

## External References

- Project Specification: @docs/project-spec.md
- Astro Documentation: https://docs.astro.build
- Tailwind v3 Documentation: https://v3.tailwindcss.com
- React 19 Documentation: https://react.dev
- MDX Documentation: https://mdxjs.com

---

**Last Updated**: 2025-12-17
**Spec Version**: 1.4
