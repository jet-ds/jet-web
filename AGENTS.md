# jetsanchez.com - Agent Memory

> Project memory file for agentic coding tools.

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
# Blog posts: src/data/blog/*.mdx
# Works: src/data/works/*.mdx

# Image Management
npm run upload-image blog/image.jpg   # Upload blog image to Vercel Blob
npm run upload-image works/image.png  # Upload works image to Vercel Blob
# Images: public/images-staging/{blog,works}/*.{jpg,png,webp,avif}
# See docs/image-workflow.md for detailed guide
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
- **Versioning**: Follow [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).
  - `package.json` is the authoritative application version.
  - The Semantic Versioning starting point is `1.0.0`.
  - Use `v<major>.<minor>.<patch>` release tags.
  - Content-only and documentation-only deployments do not require a version change unless they accompany an application release.
- **Commits**: Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).
  - Format: `type(optional-scope)!: description`.
  - Common types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
  - Use `!` and a `BREAKING CHANGE:` footer for incompatible changes.
  - Commit bodies describe intent, constraints, and verification when useful.
  - Do not add Claude, Codex, agent, co-author, or generated-by attribution unless a human explicitly requests it for that commit.

### File Naming
- Components: PascalCase (e.g., `BlogCard.astro`, `ThemeToggle.tsx`)
- Utilities: camelCase (e.g., `readingTime.ts`, `formatDate.ts`)
- Custom Hooks: camelCase with `use` prefix (e.g., `useTheme.ts`, `useDarkMode.ts`)
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

### Content Collections (Astro Loader API)
- **Type-safe**: All content must follow schemas defined in `src/schemas/content.ts` and loaded via `src/content/config.ts`
- **Content location**: `src/data/blog/` and `src/data/works/` (loaded via glob loader)
- **Blog schema**: title, description, pubDate, tags, author, draft (optional), image (optional)
- **Works schema**: title, description, type ('research' | 'project' | 'other'), date, tags, links, image (optional), venue (research), abstract (research)
- **Image field**: `{ url: string, alt: string }` - URL from Vercel Blob, descriptive alt text required
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
│   │   ├── works/       # Works-specific components
│   │   └── navigation/  # Dock and mobile menu components
│   ├── content/
│   │   └── config.ts    # Content loader configuration (Astro Loader API)
│   ├── data/            # Content source files
│   │   ├── blog/        # Blog posts (.mdx)
│   │   └── works/       # Work items (.mdx)
│   ├── schemas/
│   │   └── content.ts   # Shared content schemas (blog, works)
│   ├── hooks/           # Custom React hooks
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
│   ├── project-spec.md          # Technical specification
│   └── image-workflow.md        # Image upload and management guide
├── public/              # Public static assets
│   └── images-staging/  # Image staging before Blob upload
│       ├── blog/        # Blog post images
│       ├── works/       # Works images
│       └── README.md    # Staging directory usage guide
├── scripts/             # Build and utility scripts
│   └── upload-image.ts  # Upload images to Vercel Blob
├── astro.config.mjs     # Astro configuration
├── tailwind.config.mjs  # Tailwind v3.x configuration
├── tsconfig.json        # TypeScript configuration
├── package.json
├── AGENTS.md            # Canonical instructions for agents and contributors
├── CLAUDE.md -> AGENTS.md
└── README.md
```

### Key Patterns
- **Islands Architecture**: Use React only for interactive components (theme toggle, forms). Keep most components as Astro for performance
- **Content Collections**: Always use `getCollection()` and `getEntry()` for type-safe content access
- **SEO Component**: Reusable `<SEO />` component for all pages with meta tags, OpenGraph, Twitter Cards
- **Structured Data Architecture**:
  - BaseLayout owns WebPage schema generation (single source of truth)
  - Content pages provide specific schemas: BlogPosting (blog), ScholarlyArticle (research), SoftwareApplication (chatbot), CreativeWork (projects)
  - Entity linking: Use @id with fragment identifiers (`${url}#webpage`, `${url}#blogposting`, etc.)
  - Homepage uses WebSite + Person schemas (no WebPage) via `suppressWebPage={true}` prop
- **Layouts**: Use layout components for consistent structure across pages

## Design System

### OKLCH Color System

The site uses OKLCH color space for perceptually uniform colors that work consistently across light and dark modes.

**Color Scales (Radix-style 1-11 numbering):**

**Brand (Slate Blue)** - Primary interactive elements
- Scale: oklch(0.9755 0.0045 258.32) → oklch(0.27 0.0235 256.43)
- Usage: Links, buttons, interactive states
- 11 steps from lightest (#f5f7fa) to darkest (#1f2732)

**Accent (Mustard Yellow)** - Highlights, CTAs
- Scale: oklch(0.9873 0.0262 102.21) → oklch(0.2852 0.0664 52.21)
- Usage: Call-to-action buttons, highlights, special emphasis
- 11 steps from lightest (#fefce8) to darkest (#431f05)

**Neutral (Neutral Blue/Slate Grey)** - Base UI, text, backgrounds
- Scale: oklch(0.9764 0.0045 214.33) → oklch(0.3151 0.0143 256.78)
- Usage: Text hierarchy, borders, backgrounds
- 11 steps from lightest (#f4f8f9) to darkest (#2d3239)

**Semantic Color Tokens:**

These semantic tokens automatically adapt to light/dark mode via CSS variables:

Background hierarchy:
- `bg-bg-base` - Page background (neutral.1 / brand.11)
- `bg-bg-subtle` - Subtle backgrounds (neutral.2 / brand.10)
- `bg-bg-ui` - UI element backgrounds (neutral.3 / brand.9)
- `bg-bg-hover` - Hover states (neutral.4 / brand.8)
- `bg-bg-active` - Active states (neutral.5 / brand.7)

Text hierarchy:
- `text-text-primary` - Headings (neutral.11 / neutral.1)
- `text-text-secondary` - Body text (neutral.9 / neutral.4)
- `text-text-tertiary` - Muted text (neutral.7 / neutral.6)
- `text-text-disabled` - Disabled state (neutral.5 / neutral.7)

Brand/Interactive:
- `bg-brand-base` - Primary brand color
- `bg-brand-hover` - Brand hover state
- `bg-brand-subtle` - Subtle brand backgrounds
- `text-brand-text` - Brand text color

Accent:
- `bg-accent-base` - Accent color
- `bg-accent-hover` - Accent hover state
- `text-accent-text` - Accent text color

**Dark Mode Behavior:**
- Light mode: Uses lower scale numbers (1-5 for backgrounds, 9-11 for text)
- Dark mode: Inverts scale (11 for darkest bg, 1 for lightest text)
- All semantic tokens defined in `src/styles/global.css` under `:root` and `.dark`
- Theme toggle persists to localStorage

**Implementation:**
- Color scales defined in `tailwind.config.mjs`
- Semantic tokens as CSS variables in `src/styles/global.css`
- Always use semantic tokens (not direct scale values) in components

**Special Cases:**
- Navigation dock (LiquidGlassDock/GlassSurface) uses custom glass morphism implementation with specialized backdrop-filter effects and browser compatibility handling

### Dark Mode Implementation
- Use Tailwind's `dark:` variant for styling
- Theme toggle: React component with localStorage persistence
- System preference detection: `prefers-color-scheme`
- Prevent flash: Inline script in `<head>` to set `.dark` class before render

### Typography
- Define custom font families in Tailwind config
- Responsive typography using Tailwind's responsive utilities
- Reading time calculation for blog posts

### Utopia Fluid Design System

The site uses the Utopia fluid design system for spacing and typography, providing smooth viewport-based scaling without breakpoint jumps.

**Configuration:**
- Viewport range: 320px → 1440px
- Base size: 16px → 17px
- Type scale: 1.125 (Major Second) → 1.2 (Minor Third)
- Optimized for 1080p displays where viewport ~1280-1519px

**Spacing Philosophy:**
All spacing uses fluid scales. Never use responsive breakpoints for spacing (`md:py-*`, `lg:px-*`).

**Semantic spacing tokens (use these first):**
- `px-gutter` - Container padding (16px → 17px base × 0.9821 + 0.0893vw)
- `py-section` - Section spacing (via `--space-l-xl`)
- `py-section-lg` - Large sections (via `--space-xl-2xl`)
- `p-card` - Card padding (via `--space-m-l`)
- `gap-m` - Grid gaps (1.5rem → 1.625rem)

**T-shirt size tokens:**
- Single values: `3xs`, `2xs`, `xs`, `s`, `m`, `l`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`
- Space pairs (dramatic scaling): `s-m`, `m-l`, `l-xl`, `xl-2xl`, `2xl-3xl`
- Extended: `5xs`, `4xs` (static 0.25rem), `s-l` custom pair

**Typography scale:**
- `text-7xl` - Hero headings (~36px → ~61px)
- `text-5xl` - Page headings (~29px → ~42px)
- `text-3xl` - Section headings (~23px → ~29px)
- `text-xl` - Card titles (~20px → ~24px)
- `text-base` - Body text (16px → 17px)
- `text-sm` - Metadata (~14px → ~14px)

**Component patterns:**

Page layout:
```astro
<PageWrapper spacing="default">
  <Container size="lg">
    <!-- content -->
  </Container>
</PageWrapper>
```

Sections:
```astro
<Section spacing="default" background="subtle">
  <Container size="lg">
    <!-- content -->
  </Container>
</Section>
```

Hero sections:
```astro
<Section spacing="none" class="min-h-[75svh] flex items-center">
  <Container size="lg">
    <!-- hero content -->
  </Container>
</Section>
```

**Important:**
- Avoid responsive spacing variants - use fluid tokens
- Use viewport units (`svh`) for hero sections, not fixed spacing
- Some responsive utilities remain for functional reasons (dock positioning)

## SEO Best Practices

### Required for All Pages
- Unique `<title>` tag (50-60 characters)
- Meta description (150-160 characters)
- Canonical URL
- OpenGraph tags (og:title, og:description, og:image, og:url)
- Twitter Card tags

### Content Pages (Blog, Works)
- JSON-LD structured data (BlogPosting for blog posts, ScholarlyArticle for research papers)
- Proper heading hierarchy (single h1, nested h2-h6)
- Alt text for all images
- Reading time for blog posts
- Research papers: Include `abstract` and `venue` fields in frontmatter

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
1. Create new `.mdx` file in `src/data/blog/`
2. Add required frontmatter (title, description, pubDate, tags, author)
3. Write content using MDX (can embed React components)
4. Build to verify content collection validation
5. Check reading time calculation and metadata display

### Adding Work Items
1. Create new `.mdx` file in `src/data/works/`
2. Add required frontmatter (title, description, type, date)
3. For research papers: Include `type: "research"`, `venue`, `abstract`, and links (SSRN, PDF) - generates ScholarlyArticle schema
4. For projects: Include `type: "project"`, `technologies`, `repository`, `demo` - generates CreativeWork schema
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
- Verify frontmatter matches schema in `src/schemas/content.ts`
- Check date formats (use ISO 8601: YYYY-MM-DD)
- Ensure required fields are present
- Content files are in `src/data/` not `src/content/`

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

**Last Updated**: 2026-01-28
**Spec Version**: 1.5
