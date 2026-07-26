# jetsanchez.com contributor instructions

`AGENTS.md` is the canonical repository guide for human and automated contributors. `CLAUDE.md` is a compatibility symlink to this file.

## Project

jetsanchez.com is Jet Sanchez's personal website, writing archive, research portfolio, and home for local-first AI experiments. It uses Astro 7, MDX, React 19 islands, Tailwind CSS 4, strict TypeScript 6, and Vercel static hosting.

Primary routes are Home, About, Blog, Works, Egregore, and Contact. Egregore is released at canonical `/chatbot/`; its local runtime remains behind explicit visitor actions. `/tools/` remains a dormant, noindexed route outside primary navigation.

## Runtime and commands

Use Node.js 24.x and npm. `package.json` is authoritative for executable commands.

The supported browser floor is Chrome 111+, Safari 16.4+, and Firefox 128+.

```bash
npm install
npm run dev
npm run check
npm run test
npm run test:e2e
npm run verify:content
npm run verify:docs
npm run verify:build-purity
npm run build
npm run preview
npm run verify
```

Other intentional commands include `verify:browser`, `verify:production`, `validate-images`, `upload-image`, and `capture:og`. Do not document or invoke a script that is not present in `package.json`.

The production build is pure. `npm run build` may validate repository inputs and write local build output, but it must not upload files, modify credentials, call deployment APIs, or perform any other external write.

## Architecture

- Prefer Astro components for static presentation and React only for stateful browser interactions.
- Content sources live in `src/data/blog/` and `src/data/works/`; loaders are defined in `src/content.config.ts`, with shared schemas in `src/schemas/content.ts`.
- Use `getCollection()` and `getEntry()` for type-safe content access.
- Shared site metadata and navigation live in `src/config/site.ts`.
- `BaseLayout` owns the page-level WebPage schema. Content pages add their specific linked schema, such as BlogPosting, ScholarlyArticle, SoftwareApplication, or CreativeWork.
- Use trailing-slash canonical URLs throughout page metadata, navigation, sitemap output, and structured data.
- Vercel serves the static Astro output. Do not add a server adapter or hosted generation fallback without a newly approved architecture decision.

## Code conventions

- Use 2-space indentation, LF line endings, single quotes in TypeScript, double quotes for JSX attributes, and semicolons.
- Keep TypeScript strict. Avoid `any`; when an external boundary requires it, narrow the value immediately and explain the exception.
- Name components with PascalCase, utilities and hooks with camelCase, hooks with a `use` prefix, and MDX content with kebab-case.
- Keep components focused and prefer composition over prop drilling.
- Preserve semantic HTML, keyboard access, visible focus, descriptive labels, reduced-motion behavior, and responsive layouts.
- External links that open a new tab need `rel="noopener noreferrer"`.

## Design system

- Use semantic color tokens from `src/styles/global.css` and `tailwind.config.mjs`; do not hard-code the underlying OKLCH scale in components.
- Keep semantic colors mapped to the established numbered OKLCH steps. `brand-base` is a solid interactive fill, while `brand-text` is the readable branded foreground for links and normal text; neither role is interchangeable. Dark code surfaces use the dedicated palette-derived `code-block-text` role.
- Slate blue is the primary interactive family. Mustard is an accent for deliberate calls to action, progress, particles, and citation emphasis.
- Use `section-brand` for broad blue section surfaces. Keep that role distinct from `brand-subtle`, which remains the `soft` action fill in both themes.
- Use the framework-neutral `.text-link` recipe for inline prose destinations: branded medium-weight text, no resting underline, and the shared hover, focus-visible, and reduced-motion behavior. `Link.astro` primary links and Blog/Works `.prose` links consume it. Do not apply it to cards, navigation/footer, actions, the dock, citation markers, or source-disclosure controls.
- Use the framework-neutral `.action` recipes for button-like controls in Astro, React, or plain HTML. Variants are `brand`, `accent`, `soft`, `neutral`, `outline`, `ghost`, `filter`, `stop`, and `disabled`; `filter` state is expressed with `aria-pressed`, never color alone.
- Action densities are `compact` (44×44px minimum target, 8px radius), `default` (44×44px minimum target, 8px radius), and `immersive` (48×48px minimum target, 12px radius). Egregore primary lifecycle actions use `immersive`; small labels do not justify targets below 44×44px. `Button.astro` exposes the same taxonomy through `variant` and `density`.
- Write visible action copy in sentence case while preserving product names, platform names, personal names, and acronyms.
- Preserve the shared action focus, disabled, reduced-motion, and forced-colors behavior. Add only role-specific layout or typography utilities; do not recreate a second React-only visual taxonomy.
- Use Utopia fluid type and spacing tokens. Prefer `px-gutter`, `py-section`, `py-section-lg`, `p-card`, and fluid gap/type tokens over breakpoint-based spacing.
- Use `svh` for viewport-height layouts. Responsive utilities are acceptable when behavior, rather than spacing, genuinely changes.
- Preserve the Liquid Glass dock's specialized compatibility behavior.
- Dark mode uses the `.dark` class, persisted visitor choice, system preference fallback, and the early head script that prevents a theme flash.

## Content policy

All blog and work records are MDX under `src/data/` and must satisfy the shared schema. Publication state is explicit and required:

```yaml
status: draft
assistant: false
```

- Public content requires `status: published`.
- Egregore inclusion requires both `status: published` and `assistant: true`.
- Draft, untracked, malformed, or implicitly configured content must never enter the production site or assistant corpus.
- Blog fields include title, optional short display title, description, optional card summary, optional search title and description overrides, publication date, author, tags, publication state, assistant eligibility, and optional image metadata.
- Work fields include title, optional short display title, description, optional card summary, optional search title and description overrides, type, date, tags, publication state, assistant eligibility, optional featured/image/link fields, and type-specific research or project fields.
- Every content image requires a stable URL and descriptive `alt` text. Blog images also record their verified intrinsic pixel `width` and `height` so custom OpenGraph metadata never borrows false default dimensions.
- Run `npm run verify:content` after changing frontmatter or content-policy code.

## Image workflow

`AGENTS.md` is the sole active image-workflow authority. The upload script is the only checked-in command authorized to mutate Vercel Blob.

### Prepare

- Supported source formats are `jpg`, `jpeg`, `png`, `webp`, `avif`, and `gif`.
- Stage files in exactly one lane: `public/images-staging/about/`, `public/images-staging/blog/`, or `public/images-staging/works/`.
- Use a descriptive kebab-case slug tied to the destination page or content slug, for example `local-ai-retrieval.jpg`.
- Blog and work featured images should be `16:9` and under 2 MB before upload.
- The current About portrait lane uses `3:4`, with `1200x1600` as the reference size.
- Do not replace the `.gitkeep` files with a second workflow document.

### Upload

Set `BLOB_READ_WRITE_TOKEN` in `.env.local`, then run:

```bash
npm run upload-image blog/local-ai-retrieval.jpg
npm run upload-image works/research-project.png
npm run upload-image about/about-hero.jpg
```

The command reads only from `public/images-staging/<type>/`, hashes the bytes, uploads to `images/<type>/<slug>-<hash>.<ext>`, and returns the immutable public URL. Do not call Vercel Blob write APIs from a build, content loader, page, or ad hoc replacement script.

### Reference

For blog records, copy the returned URL and verified intrinsic dimensions into the matching file under `src/data/blog/`:

```yaml
image:
  url: 'https://example.public.blob.vercel-storage.com/images/blog/example-12345678.jpg'
  alt: 'A descriptive account of the visible image'
  width: 1920
  height: 1080
```

Work records use `url`, optional `darkUrl`, `alt`, and optional verified intrinsic `width` and `height` under `src/data/works/`.

The About portrait is not content frontmatter. Update the direct `OptimizedImage` source in `src/pages/about.astro`, retaining the actual dimensions and descriptive alternative text.

### Verify and clean up

1. Run `npm run validate-images` when remote content-image references change.
2. Run `npm run build`, then inspect the affected page with `npm run preview` at representative desktop and mobile widths in light and dark mode.
3. Confirm the intended crop, intrinsic dimensions, alternative text, and production Blob response.
4. A changed file produces a new hash URL rather than overwriting the old object. Update every repository reference and verify the replacement before any explicit operator-side deletion of the obsolete Blob.
5. The upload script does not delete or replace old objects. Blob removal is a separate external operation and must not occur while a live page or deployment references the URL.
6. Remove the local staged source after the new URL is adopted and verified; leave each lane's `.gitkeep` in place.

The default social image is the committed `public/images/og-default.jpg`. Recreate it only through `npm run capture:og -- --overwrite`, visually inspect the result, and retain the exact shared metadata contract in `src/config/site.ts`.

## Egregore

Egregore is a local-first technical showcase and experimental personal assistant, not a general website-support widget.

The released `2.1.0` runtime and interaction boundaries remain in force during `2.2.0` work:

- The semantic route is the canonical `200` document at `/chatbot/`; platform normalization owns slashless variants, and one explicit legacy `/tools/chatbot/` rule redirects to `/chatbot/`.
- Vercel Production serves `/chatbot/` as index-follow and includes it once in the sitemap. Local and Preview builds keep it noindex and outside the sitemap.
- Egregore occupies the former Tools navigation slot; `/tools/` stays dormant, noindexed, and out of primary navigation.
- Use the pinned Gemma 4 E2B LiteRT-LM browser runtime only. Do not add E4B switching or a hosted fallback.
- Preserve the explicit boundary: route rendering and compatibility checks do not authorize model/corpus download or GPU allocation. Only “Load Egregore” may start those operations; prompt assembly begins only when the visitor sends a message.
- Use the immutable, versioned eligible corpus and one deterministic MiniSearch rank-and-pack pipeline with provenance and citations. Embeddings, Gemma reranking, PGlite, pgvector, EntityDB, and the legacy multi-stage RAG implementation are not part of the approved production path.
- The fake runtime is permanent deterministic development and test architecture. Preserve its lifecycle, failure, privacy, responsive, and interaction scenarios; it must remain unavailable and absent from Production artifacts.
- `/api/chat`, hosted generation, and the OpenRouter production credential remain removed.
- The distributed license bundle, pinned package and runtime identities, public notice routes, and applicable notice text are current product contracts. Historical legal analysis is evidence, not an executable input.

Preserve the released interaction model: a full-screen local-first experience, explicit compatibility and load actions, stable lifecycle controls, deterministic citations, keyboard-operable disclosures, responsive layouts, reduced-motion behavior, and the established semantic color roles. The active [2.2.0 design](./docs/superpowers/specs/2026-07-18-jet-web-2.2.0-design.md) governs subsequent product changes.

## SEO and release behavior

- Every public page needs a unique title, description, canonical URL, OpenGraph URL/image, Twitter metadata, and correct linked JSON-LD identities.
- Canonical routes use trailing slashes. Slashless variants normalize with permanent redirects.
- `/about/` remains index-follow, canonical, and present in the sitemap; `/about` redirects to it.
- Retired `/blog/the-future-of-ai` and `/blog/building-with-astro/` routes remain intentional 404 responses and must not appear in internal links, RSS, or the sitemap.
- Release verification must prove route redirects, canonical/OpenGraph/JSON-LD agreement, navigation, robots, sitemap, RSS exclusions, and index state against the deployed site before Search Console follow-up.
- Do not request indexing for a Preview deployment or RSS feed. Search Console validation happens only after verified production deployment and recrawl.

## Testing and verification

Tests are organized by boundary:

- `tests/unit/` covers utilities, content policy, components, and operational scripts.
- `tests/e2e/` covers built-site behavior in Playwright.
- `tests/deployment/` covers Vercel and production-only routing or header behavior.

> **Contract-Coupling Principle:** Every test must derive its assertions from an observable, durable contract at the narrowest appropriate boundary. For components, this includes public APIs, rendered semantics, interaction, accessibility, and explicitly standardized visual behavior. For modules, scripts, builds, CI, and security controls, it includes declared inputs, outputs, failure modes, generated artifacts, and invariants. Private helpers, source layout, call graphs, intermediate representations, CSS classes, and implementation choices are not valid test targets unless explicitly designated as compatibility or artifact contracts. A behavior-preserving refactor should not ordinarily break a test.

GitHub Actions owns two stable routine jobs, `verify` and `browser`. They run for pull requests, pushes to `main`, manual dispatch, and nightly at `17 18 * * *` (`02:17` Asia/Manila). Configure both as strict required checks on `main`. Keep the approximately 2 GB real-model qualification outside routine and nightly CI; run it only through the explicit release workflow.

For ordinary changes, run the smallest focused RED test first, implement, rerun it GREEN, then run `npm run verify`. Add `npm run verify:browser`, build-purity, deployment, real-device, or production checks in proportion to the boundary changed. Do not claim a deployed behavior from an Astro preview test.

Before deployment, verify light and dark modes, keyboard/focus behavior, responsive layouts, navigation, metadata, structured data, and the affected production route. Preserve existing user changes in a dirty worktree and do not broaden the commit beyond the approved task.

## Versioning and commits

- Follow [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).
- `package.json` is the authoritative application version. The current versioning baseline starts at `1.0.0`; use annotated `v<major>.<minor>.<patch>` release tags.
- Content-only or documentation-only deployments do not require a version change unless they accompany an application release.
- Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/): `type(optional-scope)!: description`.
- Common types are `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, and `revert`.
- Mark incompatible changes with `!` and a `BREAKING CHANGE:` footer. Use commit bodies to record intent, constraints, and verification where useful.
- Do not add automated-tool, co-author, or generated-by attribution unless a human explicitly requests it for that commit.

## Canonical documentation

- [Jet Web 2.2.0 design](./docs/superpowers/specs/2026-07-18-jet-web-2.2.0-design.md)
- [Jet Web 2.2.0 implementation plan](./docs/superpowers/plans/2026-07-18-jet-web-2.2.0.md)
- [Jet Web 2.2.0 verification record](./docs/verification/jet-web-2.2.0.md)
- [Documentation archive](./docs/archive/README.md)

Historical documents under `docs/archive/` are evidence, not current instructions. Do not cite an archived design as the active target when a canonical successor is listed.
