# Personal Website & Blog - Project Specification & Implementation Plan

## Project Overview

A modern, minimal personal website and blog built with Astro, MDX, and React. The site will feature a dark mode design with blue color theming, full SEO optimization, and be deployed on Vercel.

## Requirements

### Core Sections
- **Home**: Landing page with introduction and highlights
- **About**: Personal bio and background
- **Blog**: Articles and posts with MDX support
- **Works**: Showcase of projects, papers, and other work (initially featuring ASI whitepaper from SSRN)
- **Contact**: Email and social media links

### Design Requirements
- Modern and minimal aesthetic
- Dark mode with blue/dark blue color scheme
- Responsive design (mobile-first approach)
- Smooth page transitions
- Clean typography and spacing

### Technical Requirements
- **Framework**: Astro (static site generation)
- **Content**: MDX for rich content with React component embedding
- **Styling**: Tailwind CSS
- **Type Safety**: TypeScript
- **Deployment**: Vercel
- **SEO**: Full optimization (meta tags, OpenGraph, sitemap, RSS, structured data)

### Content Structure
- Blog posts with standard metadata (title, date, description, tags, reading time)
- Works section supporting multiple types (research papers, projects, etc.)
- Content Collections for type-safe content management

## Technical Architecture

### Tech Stack
- **Astro**: v5.x (latest: v5.16.5, November 2025)
- **React**: v19.x (latest: v19.2.3, December 2025)
- **Tailwind CSS**: v3.4.18 (last stable v3.x release, October 2024)
  - Using v3.x for reliability and proven patterns
  - JavaScript-based configuration (tailwind.config.mjs)
  - Excellent performance and mature ecosystem
  - Clear upgrade path to v4.x when needed
- **TypeScript**: v5.9.x (latest: v5.9.3)
- **MDX**: Via @astrojs/mdx integration

### Project Structure
```
/
├── public/
│   ├── favicon.svg
│   ├── robots.txt
│   └── images/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── BaseLayout.astro
│   │   │   ├── BlogLayout.astro
│   │   │   ├── WorkLayout.astro
│   │   │   ├── Header.astro
│   │   │   ├── Footer.astro
│   │   │   └── Navigation.astro
│   │   ├── seo/
│   │   │   ├── SEO.astro
│   │   │   └── StructuredData.astro
│   │   ├── ui/
│   │   │   ├── Button.astro
│   │   │   ├── Card.astro
│   │   │   ├── Tag.astro
│   │   │   └── ThemeToggle.astro
│   │   ├── blog/
│   │   │   ├── BlogCard.astro
│   │   │   ├── BlogPost.astro
│   │   │   └── TableOfContents.astro
│   │   └── works/
│   │       ├── WorkCard.astro
│   │       └── WorkItem.astro
│   ├── content/
│   │   ├── config.ts
│   │   ├── blog/
│   │   │   └── (blog posts as .mdx files)
│   │   └── works/
│   │       └── (work items as .mdx files)
│   ├── layouts/
│   ├── pages/
│   │   ├── index.astro (Home)
│   │   ├── about.astro
│   │   ├── contact.astro
│   │   ├── blog/
│   │   │   ├── index.astro (Blog list)
│   │   │   └── [slug].astro (Blog post)
│   │   └── works/
│   │       ├── index.astro (Works list)
│   │       └── [slug].astro (Work detail)
│   ├── styles/
│   │   └── global.css
│   ├── utils/
│   │   ├── readingTime.ts
│   │   ├── formatDate.ts
│   │   └── seo.ts
│   └── config/
│       └── site.ts (site metadata, social links, etc.)
├── docs/
│   └── project-spec.md          # Technical specification (this document)
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── package.json
├── CLAUDE.md                     # Claude Code project memory
└── README.md
```

### Content Collections Schema

#### Blog Collection
```typescript
{
  title: string
  description: string
  pubDate: Date
  updatedDate?: Date
  author: string
  tags: string[]
  draft?: boolean
  image?: {
    url: string
    alt: string
  }
}
```

#### Works Collection
```typescript
{
  title: string
  description: string
  type: 'research' | 'project' | 'other'
  date: Date
  tags: string[]
  featured?: boolean
  links?: {
    label: string
    url: string
  }[]
  // For research papers
  venue?: string
  abstract?: string
  // For projects
  technologies?: string[]
  repository?: string
  demo?: string
}
```

## Implementation Plan

### Phase 1: Foundation & Project Setup
**Objective**: Initialize project with all necessary dependencies and configurations

**Tasks**:
1. Create new Astro project with TypeScript template
2. Install dependencies:
   - `@astrojs/mdx`
   - `@astrojs/react`
   - `@astrojs/tailwind`
   - `@astrojs/sitemap`
   - `@astrojs/rss`
   - `tailwindcss@3.4.18`
   - `react` & `react-dom`
3. Configure `astro.config.mjs`:
   - Add all integrations
   - Configure site URL
   - Enable sitemap generation
4. Configure `tailwind.config.mjs`:
   - Set up content paths for template scanning
   - Configure custom theme (colors, typography, etc.)
   - Enable dark mode with class strategy
5. Configure `tsconfig.json` for strict type checking
6. Set up project folder structure
7. Create `.gitignore` and initialize git repository

**Deliverables**:
- Functional Astro project with all integrations
- Configured build system
- Clean project structure

---

### Phase 2: Design System & Theming
**Objective**: Establish visual design system with dark mode and blue theming

**Tasks**:
1. Configure Tailwind theme in `tailwind.config.mjs`:
   - Extend default theme with custom blue color palette (50-950 shades)
   - Define semantic color tokens in theme.extend.colors
   - Set up dark mode variants
   - Configure custom typography scale (font families, sizes, weights)
   - Define custom spacing and breakpoints if needed
2. Set up dark mode:
   - Configure dark mode strategy as 'class' in Tailwind config
   - Create theme toggle component with React
   - Implement localStorage persistence
   - System preference detection using `prefers-color-scheme`
   - Add dark mode script to prevent flash of unstyled content
3. Create global styles (`src/styles/global.css`):
   - Import Tailwind directives (`@tailwind base/components/utilities`)
   - Define base resets and defaults
   - Custom CSS for typography
   - Smooth transitions for dark mode
   - Any custom @layer components needed
4. Create base UI components:
   - `Button.astro`
   - `Card.astro`
   - `Tag.astro`
   - `Container.astro`
   - `Link.astro`

**Deliverables**:
- Complete design system configured in tailwind.config.mjs
- Functional dark mode toggle
- Reusable UI components

---

### Phase 3: Core Layouts & Navigation
**Objective**: Build reusable layouts and site-wide navigation

**Tasks**:
1. Create site configuration (`src/config/site.ts`):
   - Site metadata (title, description, author)
   - Social media links
   - Navigation items
2. Build `BaseLayout.astro`:
   - HTML structure with proper meta tags
   - Header and footer inclusion
   - Dark mode script injection
   - ClientRouter setup (Astro v5 for smooth page transitions)
3. Create `Header.astro`:
   - Responsive navigation
   - Active route highlighting
   - Dark mode toggle
   - Mobile menu (hamburger)
4. Create `Footer.astro`:
   - Social media links
   - Copyright notice
   - Additional navigation if needed
5. Build specialized layouts:
   - `BlogLayout.astro` (extends BaseLayout)
   - `WorkLayout.astro` (extends BaseLayout)

**Deliverables**:
- Reusable layout system
- Responsive navigation
- Site-wide header and footer

---

### Phase 4: SEO Infrastructure
**Objective**: Implement comprehensive SEO optimization

**Tasks**:
1. Create `SEO.astro` component:
   - Accept props for title, description, image, etc.
   - Generate meta tags (description, keywords)
   - OpenGraph tags (og:title, og:description, og:image, etc.)
   - Twitter Card tags
   - Canonical URL
   - Language and charset
2. Create `StructuredData.astro` component:
   - JSON-LD for blog posts (Article schema)
   - JSON-LD for person/author
   - JSON-LD for website
3. Implement RSS feed:
   - Create `/rss.xml` endpoint
   - Include all published blog posts
4. Configure sitemap generation in Astro config
5. Create `robots.txt` in public folder
6. Create utility functions:
   - `generateSEOProps()` for consistent SEO data
   - `getCanonicalURL()` for URL generation

**Deliverables**:
- Complete SEO component system
- Automated sitemap generation
- RSS feed for blog
- Structured data implementation

---

### Phase 5: Static Pages
**Objective**: Build Home, About, and Contact pages

**Tasks**:
1. **Home Page** (`src/pages/index.astro`):
   - Hero section with introduction
   - Brief bio or tagline
   - Latest blog posts preview (2-3 posts)
   - Featured works section
   - Call-to-action links
2. **About Page** (`src/pages/about.astro`):
   - Personal bio and background
   - Professional experience/interests
   - Photo/avatar (optional)
   - Social links
3. **Contact Page** (`src/pages/contact.astro`):
   - Email address (with copy button or mailto link)
   - Social media links (GitHub, LinkedIn, Twitter, etc.)
   - Professional links (SSRN, Google Scholar, etc.)
   - Clean card-based layout

**Deliverables**:
- Three polished static pages
- Responsive design
- Proper SEO for each page

---

### Phase 6: Content Collections Setup
**Objective**: Configure type-safe content management system

**Tasks**:
1. Define content schemas in `src/content/config.ts`:
   - Blog collection schema with validation
   - Works collection schema with type variants
2. Create example content files:
   - 1-2 sample blog posts in `src/content/blog/`
   - 1 sample work item (ASI whitepaper template) in `src/content/works/`
3. Create utility functions:
   - `getReadingTime(content)` - calculate reading time
   - `formatDate(date)` - consistent date formatting
   - `sortByDate(items)` - sort content by date
   - `filterByTag(items, tag)` - filter content

**Deliverables**:
- Type-safe content collections
- Content validation schemas
- Helper utilities for content processing

---

### Phase 7: Blog System
**Objective**: Build complete blog functionality

**Tasks**:
1. **Blog List Page** (`src/pages/blog/index.astro`):
   - Fetch all published blog posts
   - Sort by date (newest first)
   - Display as grid/list of cards
   - Show title, description, date, tags, reading time
   - Filter by tag (optional for v1)
   - Pagination (if needed)
2. **Blog Card Component** (`src/components/blog/BlogCard.astro`):
   - Thumbnail/image (optional)
   - Title, description, metadata
   - Tag list
   - Link to full post
3. **Blog Post Page** (`src/pages/blog/[slug].astro`):
   - Use BlogLayout
   - Display title, date, reading time, tags
   - Render MDX content with proper styling
   - Table of contents (for longer posts)
   - Author info
   - Previous/Next navigation (optional)
4. **Table of Contents Component** (`src/components/blog/TableOfContents.astro`):
   - Auto-generate from headings
   - Sticky positioning on desktop
   - Smooth scroll to sections
5. Configure MDX:
   - Syntax highlighting for code blocks (Shiki/Prism)
   - Custom components for callouts, images, etc.
   - Proper typography rendering

**Deliverables**:
- Functional blog system
- Blog list and detail pages
- Rich MDX content rendering
- Reading time and metadata display

---

### Phase 8: Works Section
**Objective**: Build flexible works showcase system

**Tasks**:
1. **Works List Page** (`src/pages/works/index.astro`):
   - Fetch all works items
   - Display as cards/grid
   - Support different work types (research, project, etc.)
   - Filter by type (optional)
   - Show title, description, type badge, date
2. **Work Card Component** (`src/components/works/WorkCard.astro`):
   - Adapt display based on work type
   - Show relevant metadata (venue for research, tech stack for projects)
   - External links (SSRN, GitHub, demo, etc.)
3. **Work Detail Page** (`src/pages/works/[slug].astro`):
   - Use WorkLayout
   - Display full content with MDX support
   - Show links prominently (SSRN, PDF, etc.)
   - For research: show abstract, venue, publication date
   - For projects: show tech stack, repository, demo links
4. Create ASI whitepaper work item:
   - Template with title, abstract, SSRN link
   - Proper metadata and formatting

**Deliverables**:
- Works showcase system
- Support for multiple work types
- ASI whitepaper properly featured
- Extensible for future additions

---

### Phase 9: Performance & Image Optimization
**Objective**: Optimize performance and assets

**Tasks**:
1. Configure Astro Image component:
   - Set up image optimization
   - Create responsive image component
   - Lazy loading for images
2. Optimize fonts:
   - Use system fonts or self-host web fonts
   - Preload critical fonts
   - Font display swap strategy
3. Code splitting:
   - Ensure React components are island-optimized
   - Lazy load non-critical components
4. Performance audit:
   - Run Lighthouse tests
   - Optimize Core Web Vitals
   - Minimize JavaScript payload
5. Add loading states and transitions:
   - ClientRouter (Astro v5) for smooth navigation
   - Loading indicators where appropriate

**Deliverables**:
- Optimized images
- Excellent Lighthouse scores
- Fast page loads
- Smooth transitions

---

### Phase 10: Deployment & Finalization
**Objective**: Deploy to Vercel and finalize project

**Tasks**:
1. Configure for Vercel:
   - Set output mode in `astro.config.mjs`
   - Create `vercel.json` if needed
   - Set up environment variables structure
2. Create comprehensive README:
   - Project overview
   - Setup instructions
   - Development commands
   - Deployment guide
   - Content management guide
3. Add deployment configuration:
   - Build command
   - Output directory
   - Environment variables documentation
4. Final testing:
   - Test all pages and navigation
   - Verify dark mode functionality
   - Check responsive design on multiple devices
   - Validate all links
   - Test SEO meta tags
5. Deploy to Vercel:
   - Connect GitHub repository
   - Configure build settings
   - Deploy and verify

**Deliverables**:
- Live website on Vercel
- Complete documentation
- Production-ready codebase

---

## Feature Roadmap (Future Enhancements)

### Potential Future Additions
- Contact form with email service integration
- Newsletter subscription
- Comment system (Giscus or similar)
- Analytics integration (Plausible, Umami, or Vercel Analytics)
- Search functionality for blog posts
- Series/collections for related blog posts
- Webmentions support
- Enhanced filtering and sorting for works
- Case study templates for projects
- Download statistics for papers

---

## Success Criteria

### Functionality
- ✅ All five sections (Home, About, Blog, Works, Contact) functional
- ✅ Content can be added via MDX files
- ✅ Dark mode works with persistence
- ✅ Responsive on mobile, tablet, and desktop
- ✅ All links and navigation work correctly

### Performance
- ✅ Lighthouse score 90+ for all metrics
- ✅ First Contentful Paint < 1.5s
- ✅ Time to Interactive < 3s
- ✅ Minimal JavaScript payload

### SEO
- ✅ All pages have proper meta tags
- ✅ OpenGraph and Twitter Cards configured
- ✅ Sitemap generated and accessible
- ✅ RSS feed functional
- ✅ Structured data present and valid
- ✅ robots.txt configured

### Design
- ✅ Modern, minimal aesthetic achieved
- ✅ Blue color theme properly implemented
- ✅ Dark mode visually appealing
- ✅ Typography clean and readable
- ✅ Consistent spacing and layout

### Deployment
- ✅ Successfully deployed to Vercel
- ✅ Build process automated
- ✅ Easy to update content and redeploy

---

## Timeline Estimate

Based on focused development work, this project can be completed in phases. The modular approach allows for iterative development and testing.

---

## Notes

- This specification prioritizes clean architecture and extensibility
- Content Collections provide type safety and validation
- The Works section is designed to accommodate diverse content types
- SEO optimization is built-in from the start, not bolted on later
- The design system allows for easy theming and future adjustments
- All components are built with reusability and maintainability in mind
- **Tailwind CSS v3.4.18**: Using the last stable v3.x release for reliability and proven patterns. Clean upgrade path to v4.x available when ecosystem matures
- **Browser Support**: Modern evergreen browsers (latest Chrome, Firefox, Safari, Edge)

---

**Document Version**: 1.5
**Last Updated**: 2025-12-22
**Status**: Ready for Implementation
**Change Log**:
- v1.5: Added hooks/ directory structure for custom React hooks (Phase 11)
- v1.4: Updated View Transitions to ClientRouter (Astro v5 API change)
- v1.3: Added docs/ directory structure for project documentation
- v1.2: Updated for latest stable versions (Astro v5.x, React v19.x, Tailwind CSS v3.4.18). Using Tailwind v3.x for reliability
- v1.1: Initial version with Tailwind v4.0
- v1.0: Initial specification
