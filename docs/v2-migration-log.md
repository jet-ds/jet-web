# V2 Migration — Implementation Log

A running log of decisions made and work completed during the v1 → v2 migration. Appended chronologically.

---

## 2026-04-04 — V2 Spec Created

**Spec version**: 2.0

Wrote the initial `docs/project-spec-v2.md` based on a review of the v1 codebase and the EmDash/Cloudflare external documentation.

Key decisions recorded:

- Separate repository for v2 (Vercel and Cloudflare adapters are mutually exclusive)
- EmDash as CMS, acknowledged explicitly as a v0.1.0-day-one bet
- Cloudflare Pages + D1 + R2 replacing Vercel + Vercel Blob
- Chatbot deferred until after content parity, not ported — rebuilt
- Portable Text (EmDash's content format) breaks v1 RAG chunking assumptions; requires a renderer and a redesigned indexing pipeline
- EmDash theme code cannot perform database operations — content reads go through Live Collections only
- Live Collections enable runtime RSS and sitemap (no rebuild-on-publish required)
- Blank EmDash starter is the realistic base, not the blog template

---

## 2026-04-06 — V2 Spec Updated (3.0)

**Spec version**: 3.0

Revised spec following additional planning discussion.

Changes from 2.0:

- Added "The EmDash Bet" section — names v0.1.0 same-day risk explicitly and bounds it
- Phase 0 replaced: news theme exercise dropped in favour of a focused one-session EmDash spike
- Tools section introduced as a new permanent site section (`/tools`, `/tools/[slug]`)
- `/tools/chatbot` established as the chatbot's permanent URL; `/chatbot` becomes a permanent redirect
- Chatbot pre-phase added to Phase 1: disable chatbot in v1 and stub Tools before cloning
- Content model rendered as explicit field tables
- Chatbot architecture section expanded with four design questions to resolve before Phase 6

---

## 2026-04-10 — V2 Spec Updated (3.1) + V1 Pre-Phase Cleanup

**Spec version**: 3.1

Minor spec update to reflect news theme exercise as optional rather than dropped entirely.

### V1 pre-phase cleanup shipped

Completed the pre-phase tasks specified in the v2 spec before beginning repository bootstrap.

**Chatbot disabled**

- `src/pages/chatbot.astro` replaced with a 301 redirect to `/tools/chatbot`
- Chatbot React component and all related imports removed from the route

**Tools section added**

- `src/pages/tools/index.astro` — Tools hub page; grid layout structured to accept additional tools as cards; currently lists Jet's Ghost with a "Coming soon" status badge
- `src/pages/tools/chatbot.astro` — Under-construction page at the chatbot's permanent URL; explains the rebuild without a fake timeline

**Navigation updated (4 locations)**

- `src/config/site.ts` — `Wrench` icon imported; Tools added to `NAV_ITEMS` between Works and Contact
- `src/components/navigation/LiquidGlassDock.tsx` — `Ghost` icon removed; chatbot nav item replaced with Tools (`Wrench`, same indigo gradient); dock no longer references `/chatbot`
- `src/components/layout/BaseLayout.astro` — Tools added to `SiteNavigationElement` structured data
- `src/components/layout/BaseLayout.astro` — Tools added to noscript fallback nav

**Note**: The dock, `NAV_ITEMS` in `site.ts`, the structured data in BaseLayout, and the noscript fallback are four independent navigation definitions with no shared source of truth. Consolidation is a v2 task.

### Fixes (same day, post-review)

Two regressions identified by automated review of commit `05d0dd7`:

- **P1 — Redirect was prerendered**: `src/pages/chatbot.astro` was being emitted as a static HTML meta-refresh page rather than an HTTP 301. Fixed by adding `export const prerender = false`, forcing server-side execution. Side effect: route no longer appears in the generated sitemap.
- **P2 — Under-construction page was indexed as live assistant**: `src/pages/tools/chatbot.astro` retained the original chatbot title/description and was set to `index, follow`. Fixed by adding `noindex` prop support to `SEO.astro` and `BaseLayout.astro`, marking the page noindex, and updating its title/description to accurately reflect its temporary state.
