# Personal Website & Blog V2 - Project Specification

## Project Positioning

`v2` is a new codebase and a new platform architecture for jetsanchez.com.

It is not a maintenance pass on the current site. It is a deliberate rebuild that preserves the current site's visual identity, information architecture, and public-facing URL structure while replacing the underlying content, storage, and deployment model.

The current site remains the `v1` reference implementation and stays live on Vercel until `v2` is ready to replace it.

`v2` lives in a **separate repository**. The initial codebase is cloned from `v1` for visual and structural continuity, then stripped of `v1`-specific platform assumptions before `v2` architecture is introduced.

---

## The EmDash Bet

`v2` is built on EmDash CMS. This is an explicit, acknowledged bet.

EmDash launched as v0.1.0 preview on April 1, 2026 — the same day this spec was written. It is not a mature platform. Breaking changes are likely. The ecosystem (themes, plugins, community) is early by the project's own admission.

The bet is worth making because:

- EmDash is Cloudflare-native by design, which aligns with the platform direction
- Live Collections eliminate the need for rebuild-on-publish, which is a real architectural improvement
- The plugin isolation model and Portable Text content format represent a cleaner long-term foundation than WordPress-derived approaches
- Building on EmDash now means genuine early-adopter leverage, not just adoption lag

The bet is bounded because:

- `v1` stays live and functional until `v2` ships
- The `v2` repo is separate, so `v1` is never at risk during `v2` development
- EmDash fluency should be built through either the parallel news theme exercise (see `docs/emdash-news-theme-spec.md`) or a smaller focused EmDash spike before core `v2` implementation depends on platform assumptions
- Any feature that cannot be built cleanly on EmDash today can be deferred without blocking launch

This spec should be read with that context. Decisions favor pragmatic parity over platform idealism.

---

## Executive Summary

The `v2` site will:

- Preserve the current site's look and feel as closely as possible on first release
- Keep the existing core sections: Home, About, Blog, Works, Tools, Contact
- Remain built with Astro
- Adopt EmDash CMS as the editorial source of truth
- Adopt Cloudflare as the native deployment and storage platform
- Preserve SEO quality, structured data quality, and route continuity
- Rebuild the chatbot ("Jet's Ghost") from scratch as a native `v2` feature, deferred until after content parity

The `v2` site will not attempt to preserve `v1`'s file-native, database-less content architecture. That architectural break is intentional.

---

## Why V2 Exists

`v1` established the site's design language, editorial framing, and product shape. It proved out a file-native, git-authored Astro architecture and a production-grade RAG chatbot.

`v2` exists to:

- Align the site with Astro's Cloudflare-native future
- Explore EmDash as an early adopter and foundational CMS choice
- Create a more integrated publishing stack around Cloudflare and EmDash
- Preserve what already works in the user experience while enabling a different long-term platform direction

---

## Product Goals

### Primary Goals

1. Recreate the existing `v1` presentation and IA with near-1:1 fidelity
2. Replatform content management onto EmDash
3. Replatform deployment, storage, and runtime infrastructure onto Cloudflare
4. Preserve or improve current SEO quality, metadata coverage, and structured data quality
5. Preserve stable public URLs for core sections and content

### Secondary Goals

1. Improve editorial ergonomics through a CMS-backed workflow
2. Create a cleaner foundation for future AI-native publishing workflows
3. Establish a `v2` architecture that is honest about its CMS-backed, Cloudflare-native design

### Non-Goals For Initial Release

1. Redesigning the visual identity
2. Reimagining the IA
3. Shipping a materially different homepage or navigation
4. Preserving the `v1` build-time, database-less content architecture
5. Achieving feature expansion before parity on core content and pages
6. Porting the `v1` chatbot implementation — it will be rebuilt, not ported

---

## Constraints

### Product Constraints

- `v2` must feel visually equivalent to `v1` on launch
- Existing page categories and route structure should be preserved where feasible
- The site should continue to represent Jet Sanchez's current positioning: research, systems, tools, and applied AI

### Architectural Constraints

- `v2` lives in a separate repository from `v1`
- The initial `v2` repo is cloned from `v1` for speed and visual parity
- The cloned frontend is a bootstrap, not the final architectural model
- EmDash is the source of truth for editorial content
- Cloudflare is the production deployment target and native storage/runtime platform
- The Vercel adapter and Cloudflare adapter are mutually exclusive — `v2` uses only `@astrojs/cloudflare`
- EmDash theme code cannot perform database operations — all content reads must go through EmDash's query layer, not direct DB access from theme/page components
- The chatbot is rebuilt for `v2` and is not a launch blocker

### Platform Constraints

- EmDash v0.1.0 is a preview release. Features may change. The spec should be revisited if EmDash introduces breaking changes before `v2` ships.
- Sandboxed EmDash plugins require a paid Cloudflare account ($5/mo minimum). If plugins are not used, this does not apply.
- The blank EmDash starter is the realistic base for `v2`. The blog template approximates some of the content model but does not match the site's information architecture. Custom work is required.

---

## Guiding Principles

### 1. Preserve the surface, change the substrate

Users should experience continuity. Internally, `v2` is allowed to be materially different.

### 2. Port capabilities, not assumptions

What worked in `v1` should be carried forward intentionally. What only existed because of the `v1` stack should be reevaluated. Specifically:

- The visual system, component library, and design tokens carry forward
- The file-native content assumptions do not
- The chatbot concept carries forward; the implementation does not

### 3. Parity before expansion

The first `v2` milestone is a faithful reproduction of the current site with the new platform underneath it.

### 4. CMS-native means CMS-native

`v2` pages query content through EmDash's Live Collections. No page or component reads content from the filesystem or directly from a database. EmDash is the interface.

### 5. Acknowledge the bet, don't hide it

EmDash is v0.1.0. This spec is written with that reality. Decisions should be taken knowing that the platform may evolve under the project.

---

## Functional Requirements

### Core Sections

- Home
- About
- Blog
- Works
- Tools
- Contact
- Chatbot (deferred — not a launch blocker)

### Editorial Requirements

- Blog content managed through EmDash
- Works content managed through EmDash via a custom collection
- Draft and published states
- Featured works and metadata-rich entries
- Static page content (About, Home, Contact) may remain code-authored initially; the long-term source of truth should be decided explicitly rather than inherited accidentally
- Tools are **always code-authored** — they are built features, not editorial content, and are never managed through EmDash

### Route Requirements

The following route shapes must be preserved or introduced:

- `/`
- `/about`
- `/blog`
- `/blog/[slug]`
- `/works`
- `/works/[slug]`
- `/tools` — tools hub, code-authored index
- `/tools/[slug]` — individual tool pages, code-authored
- `/tools/chatbot` — permanent home for the chatbot; under-construction page until Phase 6, then replaced in place with the rebuilt chatbot
- `/chatbot` — permanent redirect to `/tools/chatbot`
- `/contact`

Additional routes may be introduced only when they do not break existing expectations.

---

## Design Requirements

### Visual Parity

The launch version of `v2` should preserve:

- Current overall aesthetic
- Current OKLCH color system and semantic token usage
- Current Utopia fluid typography and spacing system
- Current layout structure and spacing intent
- Current navigation behavior (LiquidGlassDock) and footer structure
- Current page hierarchy and card treatments

### Acceptable Deviations

Small deviations are acceptable where required by EmDash content rendering mechanics, Cloudflare integration details, accessibility improvements, or bug fixes that do not change the site's identity.

### Portable Text Rendering

EmDash stores body content as Portable Text (structured JSON), not HTML or MDX. The `v2` blog and works detail pages must render Portable Text to HTML. A Portable Text renderer for Astro/React is required. This replaces the MDX rendering pipeline from `v1`.

Acceptable libraries: `@portabletext/react`, `@portabletext/to-html`, or a custom renderer. The choice should be made during Phase 3 based on what EmDash's Astro integration exposes.

---

## Technical Requirements

### Framework

- Astro (latest stable)
- TypeScript
- Tailwind CSS v3.x (preserving v1 config)

### Platform

- Cloudflare Pages as the deployment target
- Cloudflare D1 for EmDash database (Cloudflare variant)
- Cloudflare R2 for media storage (replaces Vercel Blob)
- `@astrojs/cloudflare` adapter (replaces `@astrojs/vercel`)

### CMS

- EmDash integrated into the Astro application via the `emdash/astro` integration
- Blank EmDash starter as the structural reference
- Custom collection for `works` (not approximated by any official EmDash template)
- Content queries via Astro Live Collections — no rebuild required on publish

### SEO

- Titles, descriptions, canonical URLs
- OpenGraph and Twitter metadata
- Sitemap — runtime-generated (Live Collections enables this without rebuild-on-publish)
- RSS — runtime-generated for the same reason
- Structured data for homepage, blog posts, works, and navigation (preserve `v1` quality)

---

## Content Model

### Blog

Preserve the semantic shape of `v1`, modeled as an EmDash collection:

| Field | Type | Notes |
|---|---|---|
| title | string | required |
| description | string | required |
| pubDate | datetime | required |
| updatedDate | datetime | optional |
| author | string | optional |
| tags | array | optional |
| draft | boolean | optional |
| image | object `{ url, alt }` | optional, stored in R2 |
| body | Portable Text | required — replaces MDX body |

### Works

Preserve the semantic shape of `v1`, modeled as a custom EmDash collection:

| Field | Type | Notes |
|---|---|---|
| title | string | required |
| description | string | required |
| type | enum `research \| project \| other` | required |
| date | datetime | required |
| tags | array | optional |
| featured | boolean | optional |
| image | object `{ url, alt }` | optional, stored in R2 |
| links | array `{ label, url }` | optional |
| venue | string | research only |
| abstract | string | research only |
| technologies | array | project only |
| repository | string | project only |
| demo | string | project only |
| body | Portable Text | optional |

### Pages

Home, About, and Contact may remain code-authored in `v2`. If EmDash page content management is used, it should be an explicit decision, not an inherited accident.

---

## Architecture

### Repository Strategy

`v2` is developed in a separate repository.

Bootstrap process:

1. Clone `v1` into a new repository
2. Confirm local visual and route parity
3. Remove `v1`-specific platform assumptions (Vercel adapter, Vercel Blob, `@vercel/blob`, MDX content pipeline, `astro:content` as editorial source)
4. Introduce EmDash + Cloudflare adapter

### Frontend Layer

The presentation layer reuses the following from `v1` directly:

- Layout components (`BaseLayout`, `PageWrapper`, `Section`, `Container`)
- SEO components (`SEO.astro`, `StructuredData.astro`)
- Navigation (`LiquidGlassDock`, `GlassSurface`, `DockWrapper`)
- UI primitives (`Button`, `Card`, `Tag`, `Link`, `OptimizedImage`)
- Blog and works card components
- Design tokens (`tailwind.config.mjs`, `global.css` OKLCH + Utopia system)
- Site config (`src/config/site.ts`)
- Route structure

### Content Layer

The `v1` content collection pattern is replaced entirely.

`v2` content is retrieved via EmDash Live Collections. This means:

- No `src/data/blog/` or `src/data/works/` directories
- No `astro:content` as the editorial source
- No `getCollection()` / `getEntry()` — replaced by EmDash query functions
- No build-time content discovery — content is live at runtime
- Portable Text bodies replace MDX bodies — a renderer is required in page components

Content types must be defined as EmDash collections, not Zod schemas. The existing `src/schemas/content.ts` is no longer the source of truth for content shape.

### Storage Layer

Vercel Blob is replaced with Cloudflare R2.

- Media assets (blog images, works images) stored in R2
- `OptimizedImage` component updated to resolve R2 URLs
- `upload-image.ts` script updated or replaced for R2 uploads
- No other Cloudflare KV or D1 usage required at launch — EmDash manages D1 internally

### Deployment Layer

`v2` deploys to Cloudflare Pages, not Vercel.

- `@astrojs/cloudflare` adapter replaces `@astrojs/vercel`
- `wrangler.jsonc` configures D1 and R2 bindings
- Environment variables move from Vercel to Cloudflare Pages settings
- `OPENROUTER_API_KEY` and any future chatbot keys are set in Cloudflare Pages

### Chatbot Architecture

The `v1` chatbot ("Jet's Ghost") is **not ported**. It is rebuilt.

The `v1` implementation made three assumptions that do not hold in `v2`:

1. **Content is plain MDX text** — chunked by heading boundaries. EmDash stores content as Portable Text JSON. A `v2` chatbot must either serialize Portable Text to plain text at index time, or adopt a different chunking strategy.
2. **Artifacts are generated at build time** — from `src/data/` filesystem reads. In `v2`, content is live in EmDash. Artifact generation must be triggered by a content event (webhook) or run on a Cloudflare Worker schedule, not at Astro build time.
3. **Artifacts are stored in Vercel Blob** — replaced by Cloudflare R2 in `v2`.

The `v2` chatbot architecture must be designed around these realities before implementation begins. The implementation is deferred until after content parity.

Key design questions for Phase 6:

- How are embedding artifacts generated when content is CMS-backed? (Webhook → Worker, scheduled Worker, or manual trigger)
- Are embeddings stored in R2 (same as `v1` pattern, just different provider) or in a vector store?
- Does the hybrid BM25 + semantic retrieval approach from `v1` remain appropriate, or does the CMS-backed model suggest a different retrieval strategy?

### Analytics

Google Analytics (GA4 via Partytown) can be preserved as-is. Partytown is compatible with Cloudflare Pages.

---

## Migration Strategy

### What Carries Forward

- Visual system (OKLCH colors, Utopia spacing, typography)
- Page structure and route shapes
- SEO intent and structured data strategy
- Existing published content (migrated to EmDash)
- Tone and site positioning
- Component library and layout system
- LiquidGlassDock navigation

### What Is Replaced

- `@astrojs/vercel` adapter → `@astrojs/cloudflare`
- Vercel Blob storage → Cloudflare R2
- `astro:content` + MDX as editorial source → EmDash Live Collections
- Filesystem-based content discovery → EmDash collection queries
- Build-time content pipeline → live runtime content
- `src/data/blog/` and `src/data/works/` directories

### What Is Rebuilt

- Chatbot: rebuilt from scratch for `v2` content architecture (deferred)
- Image upload workflow: updated for R2

### What Is Reevaluated

- Whether static pages (About, Home, Contact) belong in EmDash or remain code-authored
- Whether RSS and sitemap stay as Astro file endpoints or move to runtime routes
- Chatbot retrieval strategy in the context of Portable Text and CMS-backed content

---

## Implementation Plan

### Phase 0: EmDash Spike (Prerequisite)

**Objective**: Build working knowledge of EmDash before committing `v2` architecture to it.

This is a focused, time-boxed spike — not a full project. One session. The goal is to validate the assumptions Phase 3 depends on, not to build something publishable.

**Tasks**:

1. Run `npm create emdash@latest` locally against the blank starter
2. Create a custom collection with a non-trivial schema (approximate the works model)
3. Query it from an Astro page via Live Collections
4. Render a Portable Text body field in a page component
5. Get Wrangler + D1 + R2 bindings working in local dev

**Exit criteria before Phase 3 begins**:

- Can create a custom EmDash collection and query it from an Astro page
- Understand the Portable Text rendering path
- Have a working Cloudflare D1 + R2 local dev setup via Wrangler
- Know what EmDash theme code can and cannot do (DB boundary)

---

### Phase 1: Bootstrap V2 Repository

**Objective**: Establish the new codebase with visual parity as the immediate target.

**Pre-phase: V1 cleanup (do in the v1 repo before cloning)**

1. Disable the chatbot in `v1`: replace `src/pages/chatbot.astro` with a redirect to `/tools/chatbot`
2. Add `src/pages/tools/chatbot.astro` as a minimal under-construction page
3. Add `src/pages/tools/index.astro` as a stub Tools hub
4. Deploy the chatbot disable to production before beginning `v2` work

**V2 bootstrap tasks**:

5. Create a new repository for `v2`
6. Clone `v1` into `v2` (post-cleanup, so the Tools stub and chatbot redirect are included)
7. Confirm local visual and route parity (`npm run dev`, check all pages)
8. Remove `@astrojs/vercel` and `@vercel/blob` from `package.json`
9. Remove `scripts/upload-image.ts` Vercel Blob references
10. Remove `scripts/build-embeddings.ts` and chatbot pipeline code
11. Remove `src/services/`, `src/stores/`, `src/workers/`, `src/types/chatbot.ts`
12. Remove `src/data/blog/` and `src/data/works/` content files
13. Remove `src/content/config.ts` and `src/schemas/content.ts`
14. Stub out blog and works pages so the site still builds (empty collections)
15. Update documentation and `CLAUDE.md` to reflect `v2` architecture

**Deliverables**:

- Running `v2` baseline that builds cleanly without `v1` platform dependencies
- No Vercel adapter, no Vercel Blob, no chatbot code, no file-based content

---

### Phase 2: Cloudflare Platform Setup

**Objective**: Replace Vercel deployment with Cloudflare Pages.

**Tasks**:

1. Install `@astrojs/cloudflare` adapter
2. Update `astro.config.mjs` to use Cloudflare adapter
3. Create `wrangler.jsonc` with D1 and R2 bindings
4. Update image remote patterns from Vercel Blob to R2 hostnames
5. Set up local dev with Wrangler (`wrangler dev` alongside `astro dev`)
6. Update `scripts/upload-image.ts` for R2 (using `wrangler r2` or `@aws-sdk/client-s3` with R2 S3 API)
7. Configure Cloudflare Pages project and connect repository
8. Set environment variables in Cloudflare Pages (move from Vercel)
9. Confirm build and deploy pipeline works end-to-end

**Deliverables**:

- `v2` repo deploying to Cloudflare Pages
- R2 bucket configured for media
- Wrangler-based local dev workflow documented

---

### Phase 3: EmDash Integration

**Objective**: Rebase editorial content onto EmDash. Requires Phase 0 exit criteria to be met.

**Tasks**:

1. Install EmDash (`npm create emdash@latest` as reference, then integrate manually into `v2`)
2. Configure `emdash/astro` integration in `astro.config.mjs` with D1 binding
3. Define blog collection in EmDash admin
4. Define works collection in EmDash admin (custom — no official template approximation)
5. Identify and integrate a Portable Text renderer for Astro/React
6. Update `src/pages/blog/index.astro` to query EmDash Live Collections
7. Update `src/pages/blog/[slug].astro` to query EmDash and render Portable Text
8. Update `src/pages/works/index.astro` to query EmDash Live Collections
9. Update `src/pages/works/[slug].astro` to query EmDash and render Portable Text
10. Update `src/pages/index.astro` to pull featured blog and works from EmDash
11. Implement runtime RSS endpoint (`/rss.xml`) using Live Collections
12. Implement runtime sitemap using Live Collections or verify `@astrojs/sitemap` works in this context
13. Decide on static page ownership (About, Home, Contact): code-authored or EmDash

**Deliverables**:

- EmDash-backed blog and works pages
- Portable Text rendering in place
- Runtime RSS and sitemap

---

### Phase 4: Content Migration

**Objective**: Move existing published content from `v1` MDX files into EmDash.

**Tasks**:

1. Migrate blog posts: convert MDX body to Portable Text, preserve all frontmatter fields
2. Migrate works entries: convert to EmDash custom collection, preserve all metadata
3. Migrate media assets from Vercel Blob to R2, preserve URLs or update references
4. Preserve slugs to maintain canonical URLs
5. Verify structured data output matches `v1` quality for each content type

**Deliverables**:

- All published `v1` content live in `v2` EmDash instance
- Route continuity confirmed for all existing content

---

### Phase 5: Parity QA

**Objective**: Validate that `v2` matches `v1` where intended.

**Tasks**:

1. Visual comparison against `v1` across all pages
2. Route and navigation verification (all routes resolve, no 404s)
3. Metadata and structured data verification (JSON-LD output matches or exceeds `v1`)
4. RSS feed validity
5. Sitemap completeness
6. Canonical URL correctness
7. Dark mode parity
8. Responsive design checks (mobile, tablet, desktop)
9. LiquidGlassDock behavior parity
10. Lighthouse scores (target: match or exceed `v1` 100/100)

**Deliverables**:

- Parity signoff across all launch-critical surfaces
- `v2` ready to replace `v1` in production

---

### Phase 6: Chatbot Rebuild

**Objective**: Reintroduce Jet's Ghost as a native `v2` feature, rebuilt for the CMS-backed architecture.

**Prerequisite**: Complete Phase 5. Chatbot is not a launch blocker.

**Design decisions to resolve before implementation**:

1. How are embedding artifacts generated? Options:
   - EmDash webhook → Cloudflare Worker → generate embeddings → store in R2
   - Scheduled Cloudflare Worker that polls EmDash for new/updated content
   - Manual trigger via admin action
2. Where are embeddings stored? Options:
   - R2 (same client-side download pattern as `v1`, different provider)
   - Cloudflare Vectorize (native vector store, avoids client-side download)
3. How is Portable Text handled for chunking?
   - Serialize to plain text before chunking (simple, loses structure)
   - Chunk at Portable Text block boundaries (preserves structure, more complex)
4. Does the hybrid BM25 + semantic retrieval pattern from `v1` remain appropriate?

**Tasks**:

1. Resolve all four design questions above
2. Implement content indexing pipeline (artifact generation on content events)
3. Implement retrieval layer against `v2` content source
4. Rebuild chatbot UI components (preserve `v1.5` UX improvements: superscript citations, 3-source limit, mobile full-screen, WelcomeScreen on close)
5. Rebuild `/api/chat` endpoint on Cloudflare Workers
6. Reintroduce streaming generation UX

**Deliverables**:

- `v2` chatbot architecture document
- Rebuilt chatbot feature on `v2` content source

---

## Launch Criteria

`v2` is launch-ready when:

1. The site visually matches `v1` to an acceptable degree across all pages
2. Core routes and content types are present and functional
3. EmDash is the editorial source of truth for all launch content
4. Cloudflare Pages is the deployment platform
5. SEO, structured data, sitemap, RSS, and metadata quality match or exceed `v1`
6. Lighthouse scores match or exceed `v1`

The chatbot is not a launch blocker.

---

## Risks

### Platform Risk

- **EmDash v0.1.0 introduces breaking changes before `v2` ships.** Mitigation: Phase 0 builds fluency early so breaking changes are caught before deep integration. `v1` stays live as fallback.
- **EmDash custom collection model is insufficient for the works schema.** Mitigation: Evaluate during Phase 0. If custom fields or content modeling is too constrained, assess whether a plugin or workaround is clean enough, or whether a different content strategy is needed.

### Product Risk

- **Accidentally changing the site's identity while replatforming.** Mitigation: Phase 5 parity QA with explicit `v1` comparison.
- **Expanding scope before parity is achieved.** Mitigation: Chatbot is explicitly deferred. No new features before Phase 5 signoff.

### Technical Risk

- **Portable Text renderer introduces visual regressions in blog/works body content.** Mitigation: Allocate testing time in Phase 3 for renderer selection and styling.
- **Live Collections query ergonomics differ enough from `getCollection()` that page components need significant rework.** Mitigation: Treat as expected work, not a surprise. Budget time in Phase 3.
- **R2 image optimization differs from Vercel Blob behavior.** Mitigation: Verify `OptimizedImage` component behavior with R2 URLs early in Phase 2.

---

## Success Criteria

The `v2` effort is successful if:

- The public site feels like the same site to users
- The internal architecture is clearly and intentionally different from `v1`
- EmDash and Cloudflare alignment is genuine, not a confused hybrid
- The chatbot, when shipped, is designed honestly around the `v2` content model

---

## Tools Section

Tools are built features, not editorial content. They are code-authored React islands wrapped in Astro pages. No EmDash collection, no content migration, no CMS dependency.

**Initial tool**: Schema markup visualizer (`/tools/schema-visualizer`) — takes structured data input and renders a visual representation.

**Hub page** (`/tools`): Code-authored index listing available tools. Not CMS-managed.

**Chatbot slot** (`/tools/chatbot`): Under-construction page until Phase 6. Replaced in place with the rebuilt chatbot. The `/chatbot` route permanently redirects here.

Tools built in `v1` carry forward to `v2` unchanged — they are page files and React components with no platform coupling.

---

## Notes

- `v1` remains the canonical reference for initial visual parity and stays in production until `v2` replaces it
- `v2` is a new architecture, not a hidden refactor
- The initial priority is parity with structural honesty
- EmDash is v0.1.0 — treat it accordingly: verify, don't assume

---

**Last Updated**: 2026-04-10
**Spec Version**: 3.1
**Previous Version**: 3.0 (2026-04-06)
