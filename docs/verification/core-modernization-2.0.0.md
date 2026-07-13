# Core Modernization 2.0.0 Verification

- Node: `24.x`
- `npm run verify`: passed
- `npm run verify:browser`: passed
- OpenRouter key: revoked and absent from Vercel
- `/api/chat`: unavailable in production
- Legacy chatbot Blob prefix: empty
- Canonical contract: Astro `trailingSlash: 'always'`; Vercel `"trailingSlash": true`; HTML canonical/OG/JSON-LD/navigation/sitemap URLs agree; machine endpoints retain their exact extensions
- `/about`: exact permanent `308` to `/about/`
- `/about/`: `200`, index-follow, exact canonical/`og:url` `https://jetsanchez.com/about/`, matching JSON-LD, and exactly one sitemap entry
- Retired `/blog/the-future-of-ai/` and `/blog/building-with-astro/`: exact `404`, absent from internal links, sitemap, and RSS
- `/chatbot`: interim core-`2.0.0` permanent redirect to noindexed `/tools/chatbot/` (reversed by Jet's Ghost `2.1.0`)
- Draft route: absent
- SSRN action: DOI-backed View action only
- Default OpenGraph image: deterministic first-frame homepage hero JPEG, exact `1920x1080` metadata and alt text verified
- Grainient: 24fps, hidden/offscreen pause, reduced-motion fallback verified
- Visual baseline: preview-to-baseline comparison is a required release artifact; it is not claimed complete in this commit
- Postdeployment binding and artifact checksums: required in the `v2.0.0` annotated tag and downloaded release readback
