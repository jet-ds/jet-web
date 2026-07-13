> **Completed historical TODO.** Resolved on 2026-07-13 by the committed [default OpenGraph image](../../../../public/images/og-default.jpg), its [deterministic capture script](../../../../scripts/capture-og-image.ts), and the canonical [image workflow](../../../../AGENTS.md#image-workflow).

# TODO

## SEO Enhancements

### Default OpenGraph Image
Add a default OpenGraph image for pages without featured images (homepage, about, contact, etc.).

**Current state:**
- `generateSEOProps()` in `src/utils/seo.ts` has a fallback: `image: props.image || '${SITE.siteUrl}/images/og-default.jpg'`
- This image doesn't exist yet

**Tasks:**
- [ ] Design or source a default OG image (1920×1080, 16:9 ratio)
- [ ] Upload to Vercel Blob or place in `public/images/`
- [ ] Update fallback path in `src/utils/seo.ts` to match actual location
- [ ] Test social previews for pages without featured images

**Priority:** Medium - improves social sharing quality for non-content pages

**Notes:**
- Consider branding (logo, color scheme matching site design)
- Should work well on both light and dark backgrounds (social platforms vary)
- Keep under 2MB for fast loading
