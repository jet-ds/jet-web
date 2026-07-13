# jetsanchez.com contributor instructions

`AGENTS.md` is the canonical repository guide for human and automated contributors. `CLAUDE.md` is a compatibility symlink to this file.

## Project

jetsanchez.com is Jet Sanchez's personal website, writing archive, research portfolio, and home for local-first AI experiments. It uses Astro 5, MDX, React 19 islands, Tailwind CSS 3, strict TypeScript, and Vercel static hosting.

Primary routes are Home, About, Blog, Works, Tools, and Contact. The current core-modernization release keeps the approved Jet's Ghost prototype inert at `/tools/chatbot/`; the companion `2.1.0` work makes it a first-class experience at `/chatbot/`.

## Runtime and commands

Use Node.js 24.x and npm. `package.json` is authoritative for executable commands.

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
- Content sources live in `src/data/blog/` and `src/data/works/`; loaders are defined in `src/content/config.ts`, with shared schemas in `src/schemas/content.ts`.
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
- Slate blue is the primary interactive family. Mustard is an accent for deliberate calls to action, progress, particles, and citation emphasis.
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
- Jet's Ghost inclusion requires both `status: published` and `assistant: true`.
- Draft, untracked, malformed, or implicitly configured content must never enter the production site or assistant corpus.
- Blog fields include title, description, publication date, author, tags, publication state, assistant eligibility, and optional image metadata.
- Work fields include title, description, type, date, tags, publication state, assistant eligibility, optional featured/image/link fields, and type-specific research or project fields.
- Every content image requires a stable URL and descriptive `alt` text.
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

For blog and work records, copy the returned URL into the matching file under `src/data/blog/` or `src/data/works/`:

```yaml
image:
  url: "https://example.public.blob.vercel-storage.com/images/blog/example-12345678.jpg"
  alt: "A descriptive account of the visible image"
```

The About portrait is not content frontmatter. Update the direct `OptimizedImage` source in `src/pages/about.astro`, retaining the actual dimensions and descriptive alternative text.

### Verify and clean up

1. Run `npm run validate-images` when remote content-image references change.
2. Run `npm run build`, then inspect the affected page with `npm run preview` at representative desktop and mobile widths in light and dark mode.
3. Confirm the intended crop, intrinsic dimensions, alternative text, and production Blob response.
4. A changed file produces a new hash URL rather than overwriting the old object. Update every repository reference and verify the replacement before any explicit operator-side deletion of the obsolete Blob.
5. The upload script does not delete or replace old objects. Blob removal is a separate external operation and must not occur while a live page or deployment references the URL.
6. Remove the local staged source after the new URL is adopted and verified; leave each lane's `.gitkeep` in place.

The default social image is the committed `public/images/og-default.jpg`. Recreate it only through `npm run capture:og -- --overwrite`, visually inspect the result, and retain the exact shared metadata contract in `src/config/site.ts`.

## Jet's Ghost

Jet's Ghost is a local-first technical showcase and experimental personal assistant, not a general website-support widget.

Current core `2.0.0` state:

- The approved interface remains at `/tools/chatbot/`, noindexed and excluded from the sitemap.
- `/chatbot` is normalized by Vercel to `/chatbot/`; the single explicit interim rule redirects `/chatbot/` to `/tools/chatbot/`, whose noindexed prototype returns `200` without another redirect.
- The prototype is presentation code only: no production corpus, model engine, or hosted generation endpoint is active.
- `/api/chat` and the OpenRouter production credential remain removed.

Approved `2.1.0` direction:

- Move the semantic route to the canonical `200` document at `/chatbot/`; keep platform normalization for slashless variants and one explicit legacy `/tools/chatbot/` redirect to `/chatbot/`.
- Replace Tools with Ghost in the existing navigation slot; keep `/tools/` dormant, noindexed, and out of primary navigation.
- Use the pinned Gemma 4 E2B LiteRT-LM browser runtime only. Do not add E4B switching or a hosted fallback.
- Preserve the explicit boundary: route rendering and compatibility checks do not authorize model/corpus download or GPU allocation. Only “Load Jet's Ghost” may start those operations; prompt assembly begins only when the visitor sends a message.
- Use the immutable, versioned eligible corpus and one deterministic MiniSearch rank-and-pack pipeline with provenance and citations. Embeddings, Gemma reranking, PGlite, pgvector, EntityDB, and the legacy multi-stage RAG implementation are not part of the approved production path.
- Keep `/chatbot/` noindexed until the model, quality, lifecycle, privacy, accessibility, browser, and deployment qualification gates pass.

Treat [the approved chat experience](./docs/jets-ghost-chat-experience.md) and prototype commit `d406ed46dfc7cccfa95d0003fcae30f5b9373690` as the UI and interaction source of truth. Integrate it; do not redesign it during runtime work.

## SEO and release behavior

- Every public page needs a unique title, description, canonical URL, OpenGraph URL/image, Twitter metadata, and correct linked JSON-LD identities.
- Canonical routes use trailing slashes. Slashless variants normalize with permanent redirects.
- `/about/` remains index-follow, canonical, and present in the sitemap; `/about` redirects to it.
- Retired `/blog/the-future-of-ai` and `/blog/building-with-astro/` routes remain intentional 404 responses and must not appear in internal links, RSS, or the sitemap.
- The final Jet's Ghost release must verify route redirects, canonical/OpenGraph/JSON-LD agreement, navigation, robots, sitemap, RSS exclusions, and index state against the deployed site before Search Console follow-up.
- Do not request indexing for a prototype, Preview deployment, or RSS feed. Search Console validation happens only after verified production deployment and recrawl.

## Testing and verification

Tests are organized by boundary:

- `tests/unit/` covers utilities, content policy, components, and operational scripts.
- `tests/e2e/` covers built-site behavior in Playwright.
- `tests/deployment/` covers Vercel and production-only routing or header behavior.
- `tests/jets-ghost-experience.test.ts` protects the approved interface contract.

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

- [Core modernization design](./docs/superpowers/specs/2026-07-11-v1-modernization-design.md)
- [Core modernization implementation plan](./docs/superpowers/plans/2026-07-11-v1-modernization.md)
- [Jet's Ghost local-assistant design](./docs/superpowers/specs/2026-07-11-jets-ghost-local-assistant-design.md)
- [Jet's Ghost implementation plan](./docs/superpowers/plans/2026-07-11-jets-ghost-local-assistant.md)
- [Approved Jet's Ghost chat experience](./docs/jets-ghost-chat-experience.md)
- [Documentation archive](./docs/archive/README.md)

Historical documents under `docs/archive/` are evidence, not current instructions. Do not cite an archived design as the active target when a canonical successor is listed.
