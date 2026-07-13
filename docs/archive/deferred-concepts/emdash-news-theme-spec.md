> **Deferred concept.** Archived 2026-07-13 from `Untracked/docs/emdash-news-theme-spec.md`.
> Canonical context: [v1 modernization design](../../superpowers/specs/2026-07-11-v1-modernization-design.md).

# EmDash News Theme - Project Specification

## Project Overview

This project is a separate public EmDash theme exercise, not part of the `jetsanchez.com v2` migration.

Its purpose is to:

- Learn EmDash by building something real and reusable
- Explore theme architecture on EmDash's own terms
- Produce a public starter that is more editorially ambitious than the current official EmDash offerings
- Capture lessons that can later inform other EmDash work, including but not limited to `v2`

Working title: `Newsroom`

The final project name can change, but the core product thesis should remain stable.

## Product Thesis

Build a serious EmDash theme for editorial and news-style publishing that goes beyond a generic blog starter.

The theme should feel appropriate for:

- digital magazines
- local newsrooms
- niche trade publications
- research/news hybrid publications
- opinion-led editorial sites

It should prove that EmDash can support a denser, more hierarchical editorial experience than the current official starters imply out of the box.

## Why This Exists

The official EmDash starters currently cover:

- Blog
- Marketing
- Portfolio

Those are useful, but they do not fully stress a newsroom-style content surface with:

- dense homepage composition
- multiple editorial priorities
- section-based navigation
- varied card densities
- recency plus curation
- author and byline prominence
- publication-oriented taxonomy patterns

This theme should fill that gap.

## Primary Goals

1. Learn the practical boundaries of EmDash theme development
2. Publish a genuinely useful EmDash theme for editorial/news use cases
3. Explore a richer information architecture than the current blog starter
4. Build a design system that feels intentional and publication-grade
5. Leave behind structured notes so future sessions or collaborators can continue without rediscovering context

## Secondary Goals

1. Clarify which concerns belong in theme code versus EmDash configuration
2. Establish a repeatable workflow for Node and Cloudflare variants
3. Test how far EmDash can be pushed without custom plugins

## Non-Goals

1. Building Jet Sanchez `v2`
2. Preserving any existing personal-site visual language
3. Implementing every possible newsroom feature in version one
4. Solving chatbot, AI retrieval, or paywall workflows in the theme itself
5. Building a plugin marketplace demo

## Audience

### Primary Audience

- Developers evaluating EmDash for editorial or publishing sites
- Teams that want a stronger starter than a simple blog
- Designers and frontend engineers who want a concrete, non-generic theme reference

### Secondary Audience

- EmDash contributors evaluating what the theme surface should support
- AI-assisted builders who want a richer starter to inspect and modify

## Product Shape

This should be an editorial/news publication theme, not just a blog with more cards.

The site should communicate:

- hierarchy
- freshness
- sections
- editorial curation
- credibility
- readability

The tone should be modern, confident, and highly legible. It should avoid looking like:

- a generic startup blog
- a minimal personal blog
- a portfolio disguised as a publication

## Design Direction

### High-Level Direction

The theme should feel like a modern digital publication:

- strong masthead
- deliberate homepage blocks
- visible editorial hierarchy
- good typography for longform and scanning
- card systems that support multiple story weights
- strong image treatment without depending on giant hero images everywhere

### Visual Priorities

- expressive serif/sans pairing
- publication-grade spacing rhythm
- clear section labels and metadata
- differentiated components for lead stories, secondary stories, briefs, and opinion pieces
- polished dark/light mode support if practical

### Visual Constraint

This should not look like a generic CMS starter. If the first impression is "clean Astro template," the design bar has been missed.

## Functional Requirements

### Core Pages

- Homepage
- Article archive
- Single article page
- Single page
- Category or section archive
- Tag archive
- Search results
- Author page or author archive, if EmDash surface allows it cleanly
- 404 page

### Homepage Requirements

The homepage should support multiple editorial zones:

- lead story block
- top stories grid
- section rails
- latest stories or timeline
- editor's picks or featured analysis
- optional opinion or column section

The exact layout can evolve, but it should clearly demonstrate hierarchy instead of just repeating one grid component.

### Article Requirements

Single article pages should support:

- headline
- dek / short summary if available
- author/byline
- publication date and updated date
- category or section display
- tags
- hero image when present
- rich body rendering
- related or more-from-section links

### Taxonomy Requirements

The theme should make categories or sections feel first-class.

Tags should exist, but the site should not depend on tags alone for navigation.

### Search Requirements

Search should be supported if the underlying EmDash starter patterns allow it cleanly.

## Content Model Assumptions

The theme should assume a content model centered on editorial posts plus supporting taxonomies.

At minimum:

- posts
- pages
- categories or sections
- tags

Optional stretch support:

- authors
- article formats
- featured story flags
- editorial priority fields
- homepage curation fields

The theme should prefer content models that can be expressed with EmDash's current admin and collection model without requiring a custom plugin on day one.

## Theme Architecture

### Recommended Starting Point

Start from an official EmDash template only as a structural reference, not as a visual destination.

The likely best base is:

- `templates/blog` for editorial patterns

The public theme itself should become its own template-quality project rather than remaining a thin fork.

### Runtime Strategy

Start Node-first for easier local iteration and lower infrastructure friction.

Then add a Cloudflare variant once the theme shape is stable.

That aligns with EmDash's current official template split:

- base template
- Cloudflare variant

### Code Organization

Expected structure:

- `src/components/`
- `src/layouts/`
- `src/pages/`
- `src/utils/`
- `seed/seed.json`
- `astro.config.mjs`
- `package.json`
- `tsconfig.json`

If published publicly, the project should also include:

- `README.md`
- screenshots or preview assets
- setup instructions
- clear Node and Cloudflare paths

## Feature Scope

### MVP Scope

1. Strong homepage composition
2. Archive page with filters or structured taxonomy navigation
3. High-quality single article template
4. Section/category archive support
5. Search support
6. SEO metadata and JSON-LD
7. Seed content that demonstrates the intended layout
8. Responsive behavior across desktop and mobile

### Stretch Scope

1. Author archive pages
2. Opinion or column layout variants
3. Breaking-news or live-update treatment
4. Reading progress or sticky table of contents for longform
5. More advanced homepage curation blocks
6. Theme options or documented customization tokens

## Seed Content Requirements

The seed content should be treated as part of the product, not placeholder filler.

It should demonstrate:

- a realistic masthead
- multiple sections
- multiple article types
- different article lengths
- rich metadata
- enough content density to validate homepage and archive composition

The seed should be editorially coherent, even if fictional.

## SEO Requirements

The theme should include:

- page titles
- meta descriptions
- canonical URLs
- OpenGraph metadata
- Twitter metadata
- JSON-LD where appropriate
- RSS support if feasible within the theme baseline

For article pages, structured data should be publication-aware rather than generic webpage-only metadata.

## Accessibility Requirements

- semantic heading structure
- keyboard-accessible navigation
- legible contrast in light and dark themes
- visible focus states
- non-decorative alt text support
- sensible reading width and line height for longform

## Performance Requirements

- keep client-side JavaScript modest
- prefer Astro components over unnecessary islands
- do not ship decorative interactivity that weakens publication performance
- ensure homepage density does not become layout thrash or image bloat

## Technical Constraints

### Constraint 1

The theme must be realistic for EmDash's current preview-stage ecosystem.

### Constraint 2

The MVP should avoid depending on custom plugins unless the lack of a plugin would materially weaken the theme thesis.

### Constraint 3

The project should teach EmDash theme architecture, not hide complexity behind one-off hacks.

## Documentation Requirements

The project should include post-build notes capturing:

- what felt easy in EmDash
- what felt immature or awkward
- which patterns belonged in theme code
- which patterns likely want plugin support later
- what a future custom theme author should know before starting

These notes can live in:

- `docs/notes.md`
- `docs/retrospective.md`
- or a similarly explicit handoff document

## Development Phases

### Phase 1: Research and Theme Thesis

**Objective**: Understand EmDash's current theme surface and lock the product direction

**Tasks**:

1. Inspect the official EmDash blog and portfolio starters
2. Decide what makes this theme distinct
3. Define the editorial information architecture
4. Choose a visual direction and typography approach

**Deliverables**:

- clear product thesis
- initial wireframe or block plan

### Phase 2: Structural Prototype

**Objective**: Build the basic route and component structure

**Tasks**:

1. Set up base template structure
2. Create masthead, layout, footer, and homepage zones
3. Build article cards with multiple densities
4. Build archive and single-article scaffolding

**Deliverables**:

- working skeleton theme
- realistic homepage composition

### Phase 3: Editorial Polish

**Objective**: Make the theme feel publication-grade

**Tasks**:

1. Refine typography, spacing, and metadata presentation
2. Improve image treatment and card hierarchy
3. Polish article template and taxonomy pages
4. Validate responsiveness

**Deliverables**:

- coherent visual system
- polished MVP

### Phase 4: Cloudflare Variant

**Objective**: Add a Cloudflare-native variant once the theme is stable

**Tasks**:

1. Add Cloudflare adapter/runtime config
2. Add Cloudflare-specific package and Wrangler configuration
3. Validate storage/runtime assumptions

**Deliverables**:

- Cloudflare-ready theme variant

### Phase 5: Public Packaging

**Objective**: Make the theme usable by others

**Tasks**:

1. Clean up README
2. Add setup instructions
3. Add screenshots
4. Validate seed content
5. Write follow-up notes

**Deliverables**:

- publishable theme repository
- handoff notes for future sessions

## Success Criteria

The project is successful if:

1. It feels meaningfully different from the official EmDash blog starter
2. It demonstrates a convincing newsroom/editorial use case
3. Another developer could install it and understand its structure
4. The project teaches practical EmDash theme-building lessons
5. The resulting artifact is useful in public, not just internally

## Risks

### Risk 1: It becomes too generic

If the theme does not have a strong editorial point of view, it will be forgettable and low-learning.

### Risk 2: It becomes too ambitious

If the project tries to solve memberships, paywalls, AI search, and plugins all at once, it will stop being a focused theme exercise.

### Risk 3: It quietly turns into a migration proxy

This project should inform other work, but it should not become a disguised implementation branch for Jet's `v2`.

## Recommended External Documentation Pointers

These are the primary references another session should use to rehydrate context quickly.

### Read First

- EmDash GitHub README
  https://github.com/emdash-cms/emdash
  Why: best high-level source for current capabilities, plugin model, platform split, and content/query conventions.

- EmDash template documentation
  https://raw.githubusercontent.com/emdash-cms/emdash/main/TEMPLATES.md
  Why: documents the official starter set, Node vs Cloudflare variants, seed structure expectations, and template sync model.

- Cloudflare launch post for EmDash
  https://blog.cloudflare.com/emdash-wordpress/
  Why: strongest source for the product thesis, plugin isolation model, theme expectations, and the current preview status.

### Theme-Specific Context

- EmDash themes evaluation guide
  https://www.emdashcms.dev/themes
  Why: useful independent summary of current theme fit, custom theme justification, and what official starters do and do not prove.

### Astro + Cloudflare Runtime Context

- Astro Cloudflare deployment guide
  https://docs.astro.build/en/guides/deploy/cloudflare/
  Why: deployment and Wrangler workflow reference.

- Astro Cloudflare adapter docs
  https://docs.astro.build/en/guides/integrations-guide/cloudflare/
  Why: adapter behavior, options, and Cloudflare-specific rendering details.

- Astro on-demand rendering guide
  https://docs.astro.build/en/guides/on-demand-rendering/
  Why: useful if the theme leans on server-rendered features or search behavior.

### Cloudflare Platform Docs

- Cloudflare Workers
  https://developers.cloudflare.com/workers/
  Why: runtime baseline for Cloudflare variants.

- Cloudflare D1
  https://developers.cloudflare.com/d1/
  Why: CMS data layer context for Cloudflare EmDash installs.

- Cloudflare R2
  https://developers.cloudflare.com/r2/get-started/workers-api/
  Why: storage path for media and object handling.

- Cloudflare KV
  https://developers.cloudflare.com/kv/
  Why: useful for understanding distributed state in Cloudflare-based EmDash setups.

- Cloudflare Durable Objects
  https://developers.cloudflare.com/durable-objects/
  Why: useful if future theme-adjacent features need coordinated state or richer runtime behavior.

- Cloudflare Workflows
  https://developers.cloudflare.com/workflows/
  Why: useful later if the project expands into editorial automation or publish-time background jobs.

## Handoff Notes For Future Sessions

If another session picks this up, it should assume:

1. This is a standalone public theme exercise
2. The likely base reference is EmDash's official blog starter
3. The product target is a newsroom/editorial publication theme
4. Node-first implementation is preferred before Cloudflare hardening
5. The project should generate follow-up notes after implementation

---

**Last Updated**: 2026-04-04
**Spec Version**: 1.0
