# jetsanchez.com

Personal website, writing archive, research portfolio, and local-first AI experiments for Jet Sanchez.

Production: [jetsanchez.com](https://jetsanchez.com)

## Architecture

The site is a statically generated Astro application deployed on Vercel. MDX content lives in `src/data/`, Astro renders the public pages, and React is reserved for interactive islands. Tailwind CSS and the shared semantic token system provide the visual foundation.

The production build is pure: it validates repository content and writes the static `dist/` output without mutating external services. Vercel Blob uploads are a separate, explicit authoring operation.

## Requirements

- Node.js 24.x
- npm

## Development

Install dependencies and start the local server:

```bash
npm install
npm run dev
```

The development site is available at [http://localhost:4321](http://localhost:4321).

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Astro development server. |
| `npm run check` | Run Astro and TypeScript checks. |
| `npm run test` | Run the unit and component test suite. |
| `npm run test:e2e` | Run the Playwright browser suite. |
| `npm run verify:content` | Validate publication policy and tracked content. |
| `npm run verify:docs` | Validate links in active Markdown documentation. |
| `npm run verify:build-purity` | Prove the build does not perform external writes. |
| `npm run build` | Validate content and build the production site. |
| `npm run preview` | Serve the built site locally. |
| `npm run verify` | Run the standard local and CI verification gate. |
| `npm run upload-image <type>/<file>` | Explicitly upload a staged image to Vercel Blob. |
| `npm run capture:og` | Recreate the default OpenGraph image with explicit overwrite consent. |

## Verification

Run the standard gate before committing:

```bash
npm run verify
```

Browser and external-state checks remain separate because they are slower or require a real deployment:

```bash
npm run verify:browser
npm run verify:production
```

## Content

Blog posts and work records are MDX files in `src/data/blog/` and `src/data/works/`. Their frontmatter is validated by the schemas in `src/schemas/content.ts`.

Every content record declares publication and assistant eligibility explicitly:

```yaml
status: draft
assistant: false
```

Publication requires `status: published`. Inclusion in the Jet's Ghost corpus additionally requires `assistant: true`. Draft, untracked, malformed, or implicitly configured content must not enter the production site or assistant corpus.

## Images

Stage authoring images under `public/images-staging/`, then use the explicit upload command to create an immutable Vercel Blob URL. The complete naming, sizing, upload, replacement, verification, and cleanup workflow is maintained in [AGENTS.md](./AGENTS.md#image-workflow).

The default social image is committed at `public/images/og-default.jpg` and can be reproduced with the checked-in capture script.

## Jet's Ghost

Jet's Ghost is a local-first experimental assistant and a first-class site experience, not a hosted support widget. The current core-modernization state keeps the approved interface prototype inert and noindexed at `/tools/chatbot/`, with `/chatbot` temporarily redirecting to it. It has no production model, corpus, engine, or hosted generation path.

The planned `2.1.0` integration moves the experience to canonical `/chatbot/`, adds the pinned Gemma 4 E2B LiteRT-LM runtime and deterministic cited retrieval, and keeps activation, compatibility checks, model download, and resource lifecycle under explicit visitor control. It remains noindexed until the release qualification gate passes.

## Deployment

Vercel builds the repository as a static Astro site using Node 24. A release must pass the repository verification gate before deployment; production-only routing, containment, metadata, and indexing behavior are then verified against the deployed URL.

Do not introduce network writes into `npm run build`. Image uploads, credential changes, release promotion, and Search Console actions are explicit operator steps outside the build.

## Documentation

- [Core modernization design](./docs/superpowers/specs/2026-07-11-v1-modernization-design.md)
- [Core modernization implementation plan](./docs/superpowers/plans/2026-07-11-v1-modernization.md)
- [Jet's Ghost local-assistant design](./docs/superpowers/specs/2026-07-11-jets-ghost-local-assistant-design.md)
- [Jet's Ghost implementation plan](./docs/superpowers/plans/2026-07-11-jets-ghost-local-assistant.md)
- [Approved Jet's Ghost chat experience](./docs/jets-ghost-chat-experience.md)
- [Documentation archive](./docs/archive/README.md)
- [Agent and contributor guidance](./AGENTS.md)
