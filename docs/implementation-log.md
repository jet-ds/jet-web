# Implementation Log

## Phase 1: Foundation & Project Setup
**Date**: 2025-12-17
**Status**: ✅ Completed

### Objective
Initialize project with all necessary dependencies and configurations.

### What Was Built

**1. Project Initialization**
- Created Astro v5.16.6 project at `/Users/jet/jet-web`
- TypeScript strict mode enabled
- Git repository initialized

**2. Dependencies Installed**
```json
{
  "@astrojs/mdx": "^4.3.13",
  "@astrojs/react": "^4.4.2",
  "@astrojs/tailwind": "^5.1.5",
  "@astrojs/sitemap": "^3.6.0",
  "@astrojs/rss": "^4.0.14",
  "tailwindcss": "^3.4.18",
  "react": "^19.2.3",
  "react-dom": "^19.2.3"
}
```

**3. Configuration Files**

**astro.config.mjs**:
- React, MDX, Tailwind (v3.x), Sitemap integrations
- `applyBaseStyles: false` for Tailwind (using custom global.css)
- Placeholder site URL (needs updating)

**tailwind.config.mjs**:
- Custom blue palette (primary 50-950)
- Semantic color tokens (background, foreground, muted, border)
- Dark mode: class strategy
- Content paths configured for all file types
- Custom font families (Inter, Fira Code)

**tsconfig.json**:
- Extends `astro/tsconfigs/strict`
- React JSX configured

**4. Project Structure Created**
```
/Users/jet/jet-web/
├── docs/
│   ├── project-spec.md
│   └── implementation-log.md (this file)
├── CLAUDE.md
├── src/
│   ├── components/
│   │   ├── layout/     (empty, ready for Phase 3)
│   │   ├── seo/        (empty, ready for Phase 4)
│   │   ├── ui/         (empty, ready for Phase 2)
│   │   ├── blog/       (empty, ready for Phase 7)
│   │   └── works/      (empty, ready for Phase 8)
│   ├── content/
│   │   ├── config.ts   (Blog & Works schemas defined)
│   │   ├── blog/       (empty, ready for content)
│   │   └── works/      (empty, ready for content)
│   ├── layouts/        (empty, ready for Phase 3)
│   ├── pages/          (has default index.astro from template)
│   ├── styles/
│   │   └── global.css  (Tailwind directives + custom CSS)
│   ├── utils/          (empty, ready for Phase 6)
│   └── config/
│       └── site.ts     (Site metadata, social links, nav items)
└── public/
    └── images/         (empty, ready for assets)
```

**5. Key Files Created**

**src/content/config.ts**:
- Blog collection schema (title, description, pubDate, tags, author, draft, image)
- Works collection schema (title, description, type, date, tags, links, venue, abstract, technologies)
- Full TypeScript validation with Zod

**src/config/site.ts**:
- SITE object (title, description, author, email, siteUrl)
- SOCIAL_LINKS object (github, linkedin, twitter, ssrn)
- NAV_ITEMS array (navigation structure)
- All values are placeholders marked with TODO

**src/styles/global.css**:
- Tailwind v3.x directives (@tailwind base/components/utilities)
- CSS custom properties for theme colors
- Dark mode CSS variables
- Smooth transitions for color changes

### Verification Results
✅ All Phase 1 tasks completed per spec
✅ Dev server runs successfully
✅ Localhost accessible
✅ All dependencies correctly installed
✅ Tailwind v3.4.18 confirmed (not v4.x)
✅ TypeScript strict mode confirmed
✅ Git repository initialized with proper .gitignore

### Important Notes
- **Tailwind v3.x**: Successfully configured with v3.x approach (not v4.x)
- **Placeholders**: Site URL and social links need updating with real values
- **Content Collections**: Schemas are ready but no sample content created yet
- **Components**: All component directories created but empty (will be populated in subsequent phases)

### Next Phase
**Phase 2: Design System & Theming**
- Configure Tailwind theme in tailwind.config.mjs (already done in Phase 1)
- Set up dark mode toggle component
- Create base UI components (Button, Card, Tag, Container, Link)
- Create global styles (already done in Phase 1)

### Issues Encountered
1. **Tailwind v4.x Auto-installed**: `astro add` command initially installed v4.x
   - **Solution**: Uninstalled v4.x packages, manually installed v3.4.18
   - Updated astro.config.mjs to use @astrojs/tailwind (not @tailwindcss/vite)

### Commands Used
```bash
npm create astro@latest jet-web -- --template minimal --typescript strict --git --no-install
npm install
npx astro add react mdx tailwind --yes
npm uninstall tailwindcss @tailwindcss/vite
npm install -D tailwindcss@3.4.18 @astrojs/tailwind @astrojs/sitemap @astrojs/rss
mkdir -p src/{components/{layout,seo,ui,blog,works},content/{blog,works},layouts,utils,config,styles}
mkdir -p docs public/images
```

---

**Last Updated**: 2025-12-17
**Phase Duration**: ~30 minutes
**Status**: ✅ Complete

---

## Phase 2: Design System & Theming
**Date**: 2025-12-17
**Status**: ✅ Completed

### Objective
Establish visual design system with dark mode and blue theming.

### What Was Built

**1. Dark Mode System**

**ThemeScript.astro** (`src/components/ui/ThemeScript.astro`):
- Inline script that runs before page render to prevent FOUC
- Checks localStorage for theme preference
- Falls back to system preference (prefers-color-scheme)
- Applies 'dark' class to html element if needed

**ThemeToggle.tsx** (`src/components/ui/ThemeToggle.tsx`):
- React component with useState and useEffect
- localStorage persistence
- System preference detection
- Accessible with aria-labels and titles
- Prevents hydration mismatch with mounted state
- Visual indicators: 🌙 for dark mode, ☀️ for light mode

**2. Base UI Components**

All components created in `src/components/ui/`:

**Button.astro**:
- Variants: primary, secondary, outline, ghost
- Sizes: sm, md, lg
- Can render as button or anchor (href prop)
- Full dark mode support
- Focus ring styling
- Disabled state styling

**Card.astro**:
- Padding options: none, sm, md, lg
- Optional hover effects
- Border and background adapt to theme
- Rounded corners
- Shadow on hover (if enabled)

**Tag.astro**:
- Variants: default, primary, success, warning, error
- Sizes: sm, md
- Can render as span or anchor
- Rounded full (pill shape)
- Semantic color coding

**Container.astro**:
- Responsive max-widths: sm, md, lg, xl, full
- Automatic horizontal centering
- Responsive padding (mobile to desktop)
- Clean content wrapper

**Link.astro**:
- Variants: default, primary, muted
- Underline options: none, hover, always
- Auto-detects external links
- Opens external links in new tab with security attrs
- Visual indicator (↗) for external links

**3. Test Page**

Updated `src/pages/index.astro`:
- Comprehensive design system showcase
- Tests all UI components with variants
- Dark mode toggle in header
- Typography samples
- Responsive grid layouts
- Imports global.css

### Verification Results
✅ TypeScript type-check passed (0 errors, 0 warnings)
✅ All components created with proper TypeScript interfaces
✅ Dark mode toggle functional
✅ Theme persistence working (localStorage)
✅ System preference detection working
✅ All UI components rendering correctly
✅ Responsive design tested
✅ No FOUC (Flash of Unstyled Content)

### Important Notes
- **Phase 1 Bonus**: Tailwind config and global.css were actually completed in Phase 1
- **React Hydration**: ThemeToggle uses `client:load` directive for immediate interactivity
- **Accessibility**: All interactive components have proper ARIA labels
- **External Links**: Automatically detected and marked with ↗ symbol
- **Type Safety**: All components use TypeScript interfaces for props

### Dependencies Added
```json
{
  "@astrojs/check": "^0.9.6",
  "typescript": "^5.9.3"
}
```

### Files Created
```
src/components/ui/
├── ThemeScript.astro   # Dark mode prevention script
├── ThemeToggle.tsx     # React theme toggle component
├── Button.astro        # Button component
├── Card.astro          # Card component
├── Tag.astro           # Tag/label component
├── Container.astro     # Layout container
└── Link.astro          # Link component with external detection
```

### Next Phase
**Phase 3: Core Layouts & Navigation**
- Build base layout component (header, footer)
- Create responsive navigation
- Add View Transitions API
- Implement site-wide header and footer

### Issues Encountered
None! All components built successfully on first pass.

---

**Last Updated**: 2025-12-17
**Phase Duration**: ~20 minutes
**Status**: ✅ Complete

---

## Phase 3: Core Layouts & Navigation
**Date**: 2025-12-17
**Status**: ✅ Completed

### Objective
Build reusable layouts and site-wide navigation.

### What Was Built

**1. Base Layout System**

**BaseLayout.astro** (`src/components/layout/BaseLayout.astro`):
- Complete HTML document structure with semantic HTML5
- Comprehensive meta tags (title, description, author)
- OpenGraph tags for social media sharing
- Twitter Card tags
- Canonical URL support
- **ClientRouter** integration (Astro v5 View Transitions) for smooth page navigation
- ThemeScript integration (prevents FOUC)
- Header and Footer components included
- Flexible props for customization (title, description, image, canonicalURL)
- Global CSS import

**2. Navigation Components**

**Header.astro** (`src/components/layout/Header.astro`):
- Sticky header with backdrop blur effect
- Desktop navigation with all nav items from config
- Active route highlighting (current page)
- Mobile responsive with hamburger menu
- ThemeToggle component integration
- Mobile menu with smooth transitions
- Closes mobile menu on route change (View Transitions support)
- Accessible with proper ARIA labels
- Uses NAV_ITEMS from site config

**Footer.astro** (`src/components/layout/Footer.astro`):
- Three-column grid layout (responsive)
- About section with site description
- Quick links to main pages
- Social media links (filters out placeholder links)
- Copyright notice with dynamic year
- Fully dark mode compatible
- Uses SITE and SOCIAL_LINKS from config

**3. Specialized Layouts**

**BlogLayout.astro** (`src/layouts/BlogLayout.astro`):
- Extends BaseLayout
- "Back to Blog" navigation link
- Article header with title (h1)
- Meta information display:
  - Author
  - Publication date (formatted)
  - Updated date (if applicable)
  - Reading time (if provided)
- Tags display with Tag components
- Prose styling for MDX content (prose-lg, dark mode support)
- Responsive container (md width)
- Full TypeScript interface for props

**WorkLayout.astro** (`src/layouts/WorkLayout.astro`):
- Extends BaseLayout
- "Back to Works" navigation link
- Type badge (Research/Project/Other) with color coding
- Work header with title and description
- Meta information (date, venue for research)
- Tags display
- Technologies display (for projects)
- Action buttons for links (SSRN, PDF, repository, demo)
- Conditional rendering based on work type
- Prose styling for MDX content
- Full TypeScript interface with type discrimination

**4. Updated Pages**

**index.astro**:
- Now uses BaseLayout instead of raw HTML
- Maintains all Phase 2 component showcases
- Added navigation test section
- Cleaner structure with proper layout hierarchy

### Verification Results
✅ TypeScript check: 0 errors, 0 warnings, 0 hints (after ClientRouter fix)
✅ All layouts properly extend BaseLayout
✅ Navigation functional with active state highlighting
✅ Mobile menu working correctly
✅ ClientRouter (View Transitions) enabled and functional
✅ Dark mode integration working
✅ Responsive design verified
✅ All components use site config correctly

### Important Notes
- **ClientRouter (Astro v5)**: Uses `<ClientRouter />` from `astro:transitions` for SPA-like navigation (replaces deprecated `<ViewTransitions />`)
- **Active Route Detection**: Uses `Astro.url.pathname` for accurate highlighting
- **Mobile Menu**: JavaScript-based toggle with proper accessibility
- **Config-Driven**: All navigation and social links come from `site.ts`
- **SEO Ready**: BaseLayout includes all essential meta tags
- **Extensible**: BlogLayout and WorkLayout can be easily customized

### Files Created
```
src/components/layout/
├── BaseLayout.astro   # Main layout with meta tags and structure
├── Header.astro       # Responsive navigation header
└── Footer.astro       # Footer with links and social media

src/layouts/
├── BlogLayout.astro   # Layout for blog posts
└── WorkLayout.astro   # Layout for work items
```

### Files Modified
```
src/pages/index.astro  # Updated to use BaseLayout
```

### Next Phase
**Phase 4: SEO Infrastructure**
- Create SEO.astro component
- Create StructuredData.astro component
- Implement RSS feed
- Configure sitemap (already in astro.config)
- Create robots.txt
- Create SEO utility functions

### Issues Encountered
**View Transitions Deprecation (RESOLVED)**:
- Initially used deprecated `<ViewTransitions />` component
- Updated to use `<ClientRouter />` per Astro v5 documentation
- Import changed from `ViewTransitions` to `ClientRouter` in `astro:transitions`
- All deprecation warnings resolved (0 hints after fix)

---

**Last Updated**: 2025-12-17
**Phase Duration**: ~15 minutes
**Phase Version**: 3.1 (Updated for Astro v5 ClientRouter)
**Status**: ✅ Complete

---

## Phase 4: SEO Infrastructure
**Date**: 2025-12-17
**Status**: ✅ Completed

### Objective
Implement comprehensive SEO optimization.

### What Was Built

**1. SEO Utility Functions**

**seo.ts** (`src/utils/seo.ts`):
- `getCanonicalURL(path)` - Generates full canonical URLs
- `generateSEOProps(props)` - Creates SEO props with defaults from site config
- `formatTitle(pageTitle, includeSiteName)` - Formats page titles with site name
- `truncateDescription(description, maxLength)` - Truncates descriptions to SEO-friendly length (160 chars)
- TypeScript `SEOProps` interface for type safety

**2. SEO Component**

**SEO.astro** (`src/components/seo/SEO.astro`):
- Comprehensive meta tags (title, description, author)
- Canonical URL support
- OpenGraph tags for social media (Facebook, LinkedIn, etc.)
  - og:type, og:url, og:title, og:description, og:image
  - og:site_name, og:locale
  - Article-specific tags (published_time, modified_time, author, tags)
- Twitter Card tags (summary_large_image)
- Keywords meta tag (from tags array)
- Additional meta tags (robots, googlebot, language, revisit-after)
- Automatic title formatting with site name
- Description truncation to 160 characters
- Full image URL generation

**3. Structured Data Component**

**StructuredData.astro** (`src/components/seo/StructuredData.astro`):
- JSON-LD schema generation for three types:
  - **Website**: WebSite schema with name, description, URL, publisher
  - **Article**: Article schema with headline, author, dates, keywords, publisher
  - **Person**: Person schema with name, email, job title, sameAs links
- Schema.org compliant markup
- Inline script with `is:inline` directive

**4. RSS Feed**

**rss.xml.ts** (`src/pages/rss.xml.ts`):
- RSS 2.0 feed endpoint at `/rss.xml`
- Fetches all published blog posts (excludes drafts)
- Sorts posts by date (newest first)
- Includes title, description, pubDate, link, author, categories
- Custom language tag (en-us)
- Uses `@astrojs/rss` integration

**5. Robots.txt**

**robots.txt** (`public/robots.txt`):
- Allows all crawlers (User-agent: *)
- Sitemap location pointing to sitemap-index.xml
- Crawl delay set to 10 seconds
- Placeholder comments for blocking specific paths

**6. BaseLayout Integration**

**Updated BaseLayout.astro**:
- Replaced manual meta tags with `<SEO />` component
- Added `<StructuredData />` component for JSON-LD
- Added RSS feed link in head
- Extended Props interface to support:
  - `type` ('website' | 'article' | 'profile')
  - `publishedTime`, `modifiedTime`
  - `author`, `tags`
- Uses `generateSEOProps()` utility for consistent defaults
- Uses `getCanonicalURL()` for proper canonical URLs

### Verification Results
✅ TypeScript check: 0 errors, 0 warnings, 0 hints
✅ SEO component properly renders meta tags
✅ StructuredData component generates valid JSON-LD
✅ RSS feed endpoint configured
✅ Sitemap already configured in astro.config.mjs (Phase 1)
✅ robots.txt created with proper directives
✅ BaseLayout successfully integrates all SEO components
✅ All utility functions working correctly

### Important Notes
- **Sitemap**: Already configured via `@astrojs/sitemap` in Phase 1 - will auto-generate at `/sitemap-index.xml`
- **RSS Feed**: Available at `/rss.xml` and linked in BaseLayout head
- **robots.txt**: Currently uses placeholder URL - needs updating with actual domain
- **Default OG Image**: References `/images/og-default.jpg` which doesn't exist yet
- **Type Safety**: All SEO components use TypeScript interfaces
- **Extensibility**: Easy to add more structured data types (Product, FAQ, etc.)

### Files Created
```
src/utils/
└── seo.ts                   # SEO utility functions

src/components/seo/
├── SEO.astro                # Meta tags component
└── StructuredData.astro     # JSON-LD schemas

src/pages/
└── rss.xml.ts               # RSS feed endpoint

public/
└── robots.txt               # Search engine directives
```

### Files Modified
```
src/components/layout/BaseLayout.astro  # Integrated SEO components
```

### Next Phase
**Phase 5: Static Pages**
- Build Home page with hero, blog preview, featured works
- Build About page with bio and background
- Build Contact page with email and social links

### Issues Encountered
**StructuredData Script Hint (RESOLVED)**:
- Initial warning about script tag processing
- Fixed by adding `is:inline` directive to script tag
- All hints resolved

### Post-Implementation Cleanup (Phase 4.1)
**Date**: 2025-12-17

**Obsolete SEO Elements Removed** (based on 2025 best practices research):

1. **Removed `<meta name="keywords">`** from SEO.astro
   - Deprecated by Google since 2009
   - Confirmed by John Mueller: no effect on indexing/ranking
   - Modern alternative: Use actual content quality and structured data

2. **Removed `<meta name="revisit-after">`** from SEO.astro
   - Never supported by major search engines
   - Invented for local search engine (searchBC), now obsolete
   - Modern alternative: XML sitemap with `<lastmod>` tags

3. **Removed `Crawl-delay: 10`** from robots.txt
   - NOT supported by Google (confirmed Nov 2025)
   - Google uses server response times, not robots.txt timing
   - Modern alternative: Google Search Console for crawl rate control
   - Note: Bing and Yandex do support it, but removed for consistency

**Research Sources**:
- Google official docs (robots.txt spec, search blog)
- John Mueller statements (2009, 2022)
- Microsoft Bing confirmation (March 2025): Schema markup helps Copilot
- AI/LLM optimization: Structured data (JSON-LD) is critical for GEO

**What We're Keeping** (2025 Best Practices):
- ✅ Structured Data (JSON-LD) - CRITICAL for AI/LLM visibility
- ✅ OpenGraph & Twitter Cards - Social sharing
- ✅ Meta description - Still used for snippets
- ✅ Canonical URLs - Duplicate content management
- ✅ Robots meta tag - Indexing control

---

**Last Updated**: 2025-12-17
**Phase Duration**: ~25 minutes (includes research & cleanup)
**Phase Version**: 4.1 (Removed obsolete SEO elements)
**Status**: ✅ Complete

---

## Phase 5: Static Pages
**Date**: 2025-12-18
**Status**: ✅ Completed

### Objective
Build Home, About, and Contact pages with proper SEO and responsive design.

### What Was Built

**1. Home Page** (`src/pages/index.astro`):
- Hero section with site title, description, and CTA buttons
- Latest blog posts section (displays 3 most recent posts)
- Featured works section (displays featured works)
- Call-to-action section for engagement
- Responsive grid layouts (1 col mobile, 2-3 cols desktop)
- Empty state handling with actual content display when available
- Proper SEO with site-wide meta tags

**2. About Page** (`src/pages/about.astro`):
- Personal bio and background section
- Interests & expertise grid (Research Areas / Technical Skills)
- Connect section with social links
- Profile type for SEO (type="profile")
- Clean card-based layout
- Social links filtered from config (removes placeholders)
- Prose styling for content readability

**3. Contact Page** (`src/pages/contact.astro`):
- Email card with mailto link and CTA button
- Social media links grid with hover effects
- Professional/academic links section (SSRN, etc.)
- Response time notice card
- Clean, accessible link styling
- Card-based layout with hover interactions
- External link indicators (→ and ↗)

**4. Sample Content Created**:

**Blog Posts** (`src/content/blog/`):
- `welcome-to-my-blog.mdx` - Introduction post
- `building-with-astro.mdx` - Technical content about Astro
- `the-future-of-ai.mdx` - Research-focused content about AI

**Works** (`src/content/works/`):
- `asi-whitepaper.mdx` - Research paper placeholder (featured)
  - Type: research
  - Includes abstract, methodology, findings sections
  - Links to SSRN (placeholder)
  - Full MDX content with proper formatting

### Key Features

**Home Page**:
- Dynamic content fetching from Content Collections
- Sorts blog posts by date (newest first)
- Filters featured works
- Graceful handling when content exists
- Responsive hero with large typography
- Alternating section backgrounds (muted/default)

**About Page**:
- Two-column grid for interests/expertise
- Social links integration from site config
- Automatic platform name capitalization
- Email fallback when social links not configured

**Contact Page**:
- Multiple contact methods organized by cards
- Hover states on all interactive elements
- Grouped by type (email, social, professional)
- Professional links with descriptions
- Helpful response time notice

### SEO Implementation

All pages use BaseLayout which includes:
- Proper meta tags (title, description, author)
- OpenGraph tags for social sharing
- Twitter Cards
- Canonical URLs
- JSON-LD structured data (WebSite schema for home/contact, Profile schema for about)
- RSS feed link in head

### Verification Results
✅ TypeScript check: 0 errors, 0 warnings, 0 hints
✅ All three static pages created and functional
✅ Sample content created (3 blog posts, 1 work)
✅ Responsive design verified
✅ SEO properly implemented on all pages
✅ Navigation links working (header/footer)
✅ Dark mode working on all pages
✅ Content Collections loading correctly

### Important Notes
- **Content Collections**: Sample content created to demonstrate functionality
- **Responsive Design**: Mobile-first approach, tested across breakpoints
- **Empty State Handling**: Pages gracefully handle lack of content (though we created samples)
- **Social Links**: Automatically filtered to exclude placeholder URLs
- **Professional Links**: SSRN link included, ready for actual URL
- **Type Safety**: All content follows defined schemas

### Files Created
```
src/pages/
├── index.astro           # Home page (replaced test page)
├── about.astro           # About page
└── contact.astro         # Contact page

src/content/blog/
├── welcome-to-my-blog.mdx
├── building-with-astro.mdx
└── the-future-of-ai.mdx

src/content/works/
└── asi-whitepaper.mdx
```

### Files Modified
```
None - All new pages created from scratch
```

### Next Phase
**Phase 6: Content Collections Setup**
- Content schemas already defined (Phase 1)
- Sample content already created (Phase 5)
- Need to create utility functions:
  - getReadingTime(content) - calculate reading time
  - formatDate(date) - consistent date formatting
  - sortByDate(items) - sort content by date
  - filterByTag(items, tag) - filter content

### Issues Encountered
**Unused Import Warning (RESOLVED)**:
- Initially imported Link component in contact.astro but didn't use it
- Removed import, all checks passed

---

**Last Updated**: 2025-12-18
**Phase Duration**: ~20 minutes
**Status**: ✅ Complete, Ready for Phase 6

---

## Phase 6: Content Collections Setup
**Date**: 2025-12-18
**Status**: ✅ Completed

### Objective
Configure type-safe content management utilities for processing blog posts and works.

### What Was Built

**1. Reading Time Utility**

**readingTime.ts** (`src/utils/readingTime.ts`):
- `getReadingTime(content)` - Calculates reading time in minutes
- `getReadingTimeText(content)` - Returns formatted string (e.g., "5 min read")
- Cleans markdown syntax and HTML for accurate word count
- Removes code blocks, inline code, images, and links
- Uses 225 words per minute as reading speed
- Rounds up to nearest minute, minimum 1 minute
- Handles MDX content correctly

**2. Date Formatting Utility**

**formatDate.ts** (`src/utils/formatDate.ts`):
- `formatDate(date, format)` - Formats dates with three styles:
  - 'long': "December 18, 2025"
  - 'medium': "Dec 18, 2025" (default)
  - 'short': "12/18/2025"
- `formatRelativeDate(date)` - Relative time (e.g., "2 days ago", "3 months ago")
- `getISODate(date)` - ISO format (YYYY-MM-DD) for HTML time elements
- Uses UTC timezone to avoid shifts
- Validates dates and handles errors gracefully
- Works with both Date objects and date strings

**3. Sort Utility**

**sortByDate.ts** (`src/utils/sortByDate.ts`):
- `sortByDate(items, order)` - Generic sorting for any items with date properties
  - Works with both blog posts (pubDate) and works (date)
  - Supports 'desc' (newest first, default) and 'asc' order
  - Handles missing dates gracefully
- `sortBlogPosts(posts, order)` - Specialized for blog posts
- `sortWorks(works, order)` - Specialized for works
- Full TypeScript generics with proper type constraints
- Creates new sorted array (doesn't mutate original)

**4. Tag Filtering Utility**

**filterByTag.ts** (`src/utils/filterByTag.ts`):
- `filterByTag(items, tag)` - Filter by single tag (case-insensitive)
- `filterByAllTags(items, tags)` - Filter items with ALL specified tags
- `filterByAnyTag(items, tags)` - Filter items with ANY of the tags
- `getAllTags(items)` - Extract all unique tags, sorted alphabetically
- `getTagCounts(items)` - Count occurrences of each tag
- Case-insensitive tag matching
- TypeScript generics for type safety

### Verification Results
✅ TypeScript check: 0 errors, 0 warnings, 0 hints
✅ All utility functions created with proper TypeScript types
✅ Generic functions support both blog posts and works
✅ Comprehensive functionality for content processing
✅ Case-insensitive tag filtering
✅ Markdown/MDX content handling in reading time

### Important Notes
- **Prerequisites Met**: Content schemas (Phase 1) and sample content (Phase 5) already exist
- **Type Safety**: All utilities use TypeScript generics with proper constraints
- **Reusability**: Functions work with any content that follows the schemas
- **Performance**: All functions create new arrays (immutable approach)
- **Extensibility**: Easy to add more utility functions as needed

### Features Implemented

**Reading Time**:
- Accurate word counting with markdown/HTML cleanup
- Customizable reading speed (225 WPM)
- Both numeric and text output formats

**Date Formatting**:
- Multiple format styles for different use cases
- Relative date display for recent content
- ISO format for semantic HTML

**Sorting**:
- Flexible generic function for any date-based content
- Specialized functions for blog posts and works
- Bidirectional sorting (newest/oldest first)

**Tag Filtering**:
- Single and multiple tag filtering
- AND/OR logic for complex queries
- Tag extraction and counting utilities
- Case-insensitive matching

### Files Created
```
src/utils/
├── readingTime.ts    # Reading time calculation
├── formatDate.ts     # Date formatting utilities
├── sortByDate.ts     # Content sorting utilities
└── filterByTag.ts    # Tag filtering utilities
```

### Next Phase
**Phase 7: Blog System**
- Blog list page (`src/pages/blog/index.astro`)
- Blog post page (`src/pages/blog/[slug].astro`)
- Blog card component
- Table of contents component
- Configure MDX with syntax highlighting
- Use new utilities for reading time, date formatting, and sorting

### Issues Encountered
None! All utilities built successfully with zero TypeScript errors.

---

**Last Updated**: 2025-12-18
**Phase Duration**: ~15 minutes
**Status**: ✅ Complete, Ready for Phase 7

---

## Phase 7: Blog System
**Date**: 2025-12-18
**Status**: ✅ Completed

### Objective
Build complete blog functionality with list page, detail pages, and rich MDX content rendering.

### What Was Built

**1. Blog Card Component** (`src/components/blog/BlogCard.astro`):
- Displays blog post preview in a card format
- Shows title, description, publication date
- Displays author, reading time (calculated dynamically)
- Tag list with Tag components
- Optional featured image with hover zoom effect
- Hover effects and smooth transitions
- Responsive design with proper accessibility
- SVG icons for metadata (calendar, clock, author)
- Line-clamp for description (max 3 lines)
- Linked card that navigates to full post

**2. Blog List Page** (`src/pages/blog/index.astro`):
- Fetches all published blog posts (excludes drafts)
- Sorts by publication date (newest first) using sortBlogPosts utility
- Displays posts in responsive grid (1 col mobile, 2 cols desktop)
- Tag filtering via URL query params (?tag=tagname)
- Shows post count
- "Browse by tag" section at bottom with tag counts
- Clear filter button when tag is selected
- Empty state handling with helpful messages
- Uses BlogCard component for consistent display
- Full SEO optimization (title/description change with tag)

**3. Table of Contents Component** (`src/components/blog/TableOfContents.astro`):
- Auto-generates from h2 and h3 headings
- Sticky positioning on desktop (top-24)
- Smooth scroll to sections
- Active section highlighting via IntersectionObserver
- Responsive: hidden on mobile, visible on desktop (lg breakpoint)
- Border indicator for active link
- Proper ARIA labels for accessibility
- Works with Astro's ClientRouter (view transitions)
- Clean hierarchical display (h3 indented)

**4. Blog Post Page** (`src/pages/blog/[slug].astro`):
- Dynamic routes using getStaticPaths
- Uses BlogLayout for consistent structure
- Renders MDX content with proper styling
- Two-column layout: content (left) + TOC (right) on desktop
- Previous/Next post navigation at bottom
- Displays full post metadata (title, date, reading time, tags, author)
- Prose typography for readable content
- Responsive: single column on mobile, two columns on desktop
- Smooth transitions between posts

**5. MDX Configuration**:

**Astro Config** (astro.config.mjs):
- Shiki syntax highlighting configured
- Theme: github-dark for code blocks
- Word wrap enabled to prevent horizontal scrolling
- Ready for custom languages if needed

**Tailwind Typography Plugin**:
- Installed @tailwindcss/typography
- Added to tailwind.config.mjs plugins
- Provides prose classes for rich content

**Global Styles** (src/styles/global.css):
- Custom prose styling for dark mode compatibility
- Link styling (primary color, hover underline)
- Inline code styling (background, padding, rounded)
- Code block styling (dark background, overflow handling)
- Blockquote styling (border, italic, muted color)
- Heading styling (bold, proper colors)
- Table styling (borders for thead/tbody)
- All elements work in both light and dark modes

### Features Implemented

**Blog List Page**:
- ✅ Fetch and display all published posts
- ✅ Sort by date (newest first)
- ✅ Grid layout with responsive columns
- ✅ Tag filtering (optional, via URL params)
- ✅ Tag browsing section with counts
- ✅ Empty states and helpful messages
- ✅ Post count display
- ✅ SEO optimized for each view

**Blog Card**:
- ✅ Title, description, metadata display
- ✅ Reading time calculation
- ✅ Tag list
- ✅ Optional featured image
- ✅ Hover effects
- ✅ Accessibility features

**Blog Post Page**:
- ✅ Full MDX rendering with syntax highlighting
- ✅ Table of contents (auto-generated, sticky)
- ✅ Author info and metadata
- ✅ Previous/Next navigation
- ✅ Responsive layout
- ✅ Prose typography

**MDX & Syntax Highlighting**:
- ✅ Shiki configured with github-dark theme
- ✅ Custom prose styling for dark mode
- ✅ Code blocks with proper formatting
- ✅ Inline code styling
- ✅ Blockquotes, tables, headings styled
- ✅ Typography plugin installed

### Verification Results
✅ Build successful: 7 pages generated (3 blog posts + list + static pages)
✅ TypeScript check: 0 errors, 0 warnings, 0 hints
✅ All blog routes working correctly
✅ Tag filtering functional
✅ Table of contents working with smooth scroll
✅ Previous/Next navigation working
✅ MDX content rendering properly
✅ Syntax highlighting active

### Important Notes
- **Reading Time**: Calculated dynamically from post content using getReadingTime utility
- **Tag Filtering**: Case-insensitive, accessible via ?tag=name query param
- **TOC Active State**: Uses IntersectionObserver for scroll-based highlighting
- **Typography**: @tailwindcss/typography plugin provides prose classes
- **Syntax Highlighting**: Shiki built-in, no additional dependencies needed
- **Responsive Design**: Mobile-first, TOC hidden on mobile
- **Navigation**: Previous/Next based on publication date order

### Files Created
```
src/components/blog/
├── BlogCard.astro           # Blog post preview card
└── TableOfContents.astro    # Auto-generated TOC with sticky positioning

src/pages/blog/
├── index.astro              # Blog list page with filtering
└── [slug].astro             # Blog post detail page
```

### Files Modified
```
astro.config.mjs             # Added Shiki syntax highlighting config
tailwind.config.mjs          # Added typography plugin
src/styles/global.css        # Added custom prose styling
package.json                 # Added @tailwindcss/typography
```

### Dependencies Added
```json
{
  "@tailwindcss/typography": "^0.5.15"
}
```

### Next Phase
**Phase 8: Works Section**
- Works list page (src/pages/works/index.astro)
- Work detail page (src/pages/works/[slug].astro)
- Work card component
- Support for different work types (research, project, other)
- Display venue, abstract for research papers
- Display tech stack, links for projects

### Issues Encountered & Resolved

**TypeScript Error - Reading Time Type Mismatch**:
- BlogLayout expected readingTime as number, passed string
- Fixed: Use getReadingTime() instead of getReadingTimeText()
- BlogLayout formats the display ("{number} min read")

**Warning - Unused Destructuring**:
- blog/index.astro destructured unused Content and remarkPluginFrontmatter
- Fixed: Removed post.render() call, directly access post.body
- Simplified code, eliminated warning

---

**Last Updated**: 2025-12-18
**Phase Duration**: ~30 minutes
**Status**: ✅ Complete, Ready for Phase 8
