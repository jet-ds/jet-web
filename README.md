# jetsanchez.com

Jet Sanchez's professional website, writing archive, research portfolio, and home for local-first AI experiments.

Production: [jetsanchez.com](https://jetsanchez.com)

## Site

The primary experience is Home (`/`), About (`/about/`), Blog (`/blog/`), Works (`/works/`), Egregore (`/chatbot/`), and Contact (`/contact/`). Canonical public routes use trailing slashes. `/tools/` remains a dormant, noindexed route outside primary navigation.

## Architecture

The site is a statically generated Astro 7 application deployed on Vercel. MDX content lives in `src/data/`, Astro renders public pages, and React 19 is reserved for interactive islands. Tailwind CSS 4 and shared semantic tokens provide the visual foundation; the project uses strict TypeScript 6.

The production build is pure: it validates repository content and writes the static `dist/` output without mutating external services. Vercel Blob uploads are a separate, explicit authoring operation.

## Requirements

- Node.js 24.x
- npm
- Chrome 111+, Safari 16.4+, or Firefox 128+

## Development

Install dependencies and start the local server:

```bash
npm install
npm run dev
```

The development site is available at [http://localhost:4321](http://localhost:4321).

| Command                              | Purpose                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| `npm run dev`                        | Start the Astro development server.                                                  |
| `npm run check`                      | Run Astro and TypeScript checks.                                                     |
| `npm run test`                       | Run the unit and component test suite.                                               |
| `npm run test:e2e`                   | Run the Playwright browser suite.                                                    |
| `npm run verify:content`             | Validate publication policy and tracked content.                                     |
| `npm run verify:docs`                | Validate links in active Markdown documentation.                                     |
| `npm run verify:build-purity`        | Prove the build does not perform external writes.                                    |
| `npm run build`                      | Validate content and build the production site.                                      |
| `npm run preview`                    | Serve the built site locally.                                                        |
| `npm run verify`                     | Run the standard local and CI verification gate.                                     |
| `npm run qualify:egregore:mac`       | Run the release-only Egregore qualification profile on the approved Mac environment. |
| `npm run smoke:egregore`             | Run the explicit Egregore real-model smoke profile.                                  |
| `npm run upload-image <type>/<file>` | Explicitly upload a staged image to Vercel Blob.                                     |
| `npm run capture:og`                 | Recreate the default OpenGraph image with explicit overwrite consent.                |

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

GitHub Actions runs the stable `verify` and `browser` jobs on every pull request, every push to `main`, manual dispatch, and nightly at `18:17 UTC` (`02:17` Asia/Manila). Release setup requires both jobs on `main`. Nightly CI exercises the complete routine gate but deliberately excludes the roughly 2 GB real-model qualification, which remains release-only.

## Content

Blog posts and work records are MDX files in `src/data/blog/` and `src/data/works/`. Their frontmatter is validated by the schemas in `src/schemas/content.ts`.

Every content record declares publication and assistant eligibility explicitly:

```yaml
status: draft
assistant: false
```

Publication requires `status: published`. Inclusion in the Egregore corpus additionally requires `assistant: true`. Draft, untracked, malformed, or implicitly configured content must not enter the production site or assistant corpus.

## Images

Stage authoring images under `public/images-staging/`, then use the explicit upload command to create an immutable Vercel Blob URL. The complete naming, sizing, upload, replacement, verification, and cleanup workflow is maintained in [AGENTS.md](./AGENTS.md#image-workflow).

The default social image is committed at `public/images/og-default.jpg` and can be reproduced with the checked-in capture script.

## Egregore

Egregore is available at canonical `/chatbot/` as a local-first experimental assistant and first-class site experience, not a hosted support widget. Local and Preview builds remain `noindex` and outside the sitemap; only the verified Vercel Production build emits index-follow metadata and one canonical sitemap entry.

The integrated experience uses the pinned Gemma 4 E2B LiteRT-LM runtime in compatible WebGPU browsers with deterministic cited retrieval. The exact model is `litert-community/gemma-4-E2B-it-litert-lm` revision `9262660a1676eed6d0c477ab1a86344430854664`, filename `gemma-4-E2B-it-web.litertlm`, 2,008,432,640 bytes, SHA-256 `3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5`. After explicit visitor action, the browser downloads it directly from Hugging Face at the pinned revision; the site does not mirror or rename the model. See the [pinned model card](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/blob/9262660a1676eed6d0c477ab1a86344430854664/README.md), [Google's Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4), and [Gemma Apache 2.0 license](https://ai.google.dev/gemma/apache_2).

Compatibility checks, model download, and GPU allocation remain behind explicit visitor actions, and there is no hosted generation fallback. The [2.2.0 design](./docs/superpowers/specs/2026-07-18-jet-web-2.2.0-design.md) is the current product authority. Exact package, asset, license, and copyright details are recorded in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) and exposed at the stable public [Egregore model and open-source licenses](https://jetsanchez.com/licenses/egregore/) page.

The `2.2.0` release retains the Apple M4 qualification baseline and adds an accepted Xiaomi 14T qualification on Android 16 and Chrome 150. The phone reused the complete pinned model cache with no model transfer, reached Ready in about 9–12 seconds, completed four substantial grounded and cited turns in one retained conversation, and then surfaced the designed session boundary before another turn could exceed the 8,192-token engine ceiling. Results on other hardware remain environment-dependent rather than inferred from these reviewed devices.

## Deployment

Vercel builds the repository as a static Astro site using Node 24. A release must pass the repository verification gate before deployment; production-only routing, containment, metadata, and indexing behavior are then verified against the deployed URL.

Do not introduce network writes into `npm run build`. Image uploads, credential changes, release promotion, and Search Console actions are explicit operator steps outside the build.

## Documentation

- [Jet Web 2.2.0 design](./docs/superpowers/specs/2026-07-18-jet-web-2.2.0-design.md)
- [Jet Web 2.2.0 implementation plan](./docs/superpowers/plans/2026-07-18-jet-web-2.2.0.md)
- [Jet Web 2.2.0 verification record](./docs/verification/jet-web-2.2.0.md)
- [Documentation archive](./docs/archive/README.md)
- [Agent and contributor guidance](./AGENTS.md)
