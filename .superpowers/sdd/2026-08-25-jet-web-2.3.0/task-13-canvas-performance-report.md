# Supplemental Task 13 — carousel canvas and Home-entry performance report

## Result

Passed the supplemental carousel contract in the production preview. Blog and Works now use their full Homepage sections as the lower card canvas, keep the accepted UI and disclosure treatment above that layer, anchor the active card to the owning section center, and render unique adaptive revolving rails. The current Blog ring is `2 previous + active + 2 next`; Works is `1 + active + 1`; future collections cap at three unique cards per side.

The earlier one-sided/off-centered implementation assumptions were deliberately removed rather than retained under a symmetric wrapper. The controller-owned title-reveal measurement, transform-only disclosure motion, and intermediate-width coverage that predated this supplement remain integrated.

The Home payload also now:

- respects the caller's `lazy`/`eager` choice in `ThemeAwareImage`;
- serves responsive `384w`, `768w`, and `1152w` fallback candidates;
- projects the React surface to a site-local `1152 × 648` maximum justified by a `576 × 324` high-density card;
- omits images from records outside the seven-position visible ring until they enter it;
- prevents a Blog fallback handoff from cascading offscreen Works hydration;
- uses each record's primary image only on Homepage fallback and island props, without changing canonical record metadata or Work hub/detail theme-aware behavior.

## Files changed

- `src/pages/index.astro` — promotes each Blog/Works section to the full carousel canvas while keeping heading UI in its static Astro layer.
- `src/features/depth-carousel/DepthCarousel.tsx` and `types.ts` — centered adaptive ring geometry, observed section bounds, connected bounded drag, hidden-image deferral, stable promotion ownership, and projected image dimensions.
- `src/styles/global.css` — full-section/card/UI layer ownership, centered desktop grid, gutter containment, and retained transform-only disclosure treatment.
- `src/components/content/HomeCollectionCarousel.astro` — primary-image-only Homepage projection, responsive local React assets, and full-width fallback ownership.
- `src/components/content/ContentCard.astro`, `src/components/ui/OptimizedImage.astro`, and `ThemeAwareImage.astro` — responsive compact-card candidates and caller-owned loading.
- `tests/unit/ui/DepthCarousel.test.tsx`, `tests/unit/components/collectionCards.test.ts`, and `tests/e2e/homepage-carousel.spec.ts` — durable rendered, interaction, accessibility, geometry, image, and fallback contracts.
- `task-13-canvas-performance-evidence/*.png` — ordinary browser visual-regression captures, not screenshot-match targets.

## RED → GREEN evidence

1. Theme-aware loading
   - RED: a lazy theme-aware image rendered `[eager, eager]` instead of `[lazy, lazy]`.
   - GREEN: both light and dark sources preserve either requested loading value; explicit eager callers remain eager.
2. Unique visible ring and deferred images
   - RED: a nine-record desktop fixture exposed only four one-sided layers.
   - GREEN: seven unique positions are visible, only those seven own `img` elements, and promotion retains a seven-image cap.
3. Owning-section centerline
   - RED: the active card missed the section center by about 64px at intermediate width and 153px at 1440px.
   - GREEN: rendered Blog and Works active centers equal their section centers at 800, 1024, and 1440px; centering is not inferred from the control grid.
4. Full-canvas drag bounds and UI stacking
   - RED: a large diagonal drag placed the active card at approximately `x = -287px`, outside its section.
   - GREEN: X/Y travel clamps to the observed inner section edges, connected rails move proportionally, fixed UI does not translate, and controls win hit testing above a dragged card.
5. Responsive fallback payload
   - RED: compact fallback markup supplied no responsive width candidates and transferred the full-resolution images.
   - GREEN: rendered markup exposes only `384w`, `768w`, and `1152w` candidates.
6. Homepage-only primary image
   - RED: the theme-aware Work alternate URL and `darkUrl` were present in fallback markup and island props.
   - GREEN: both are absent from built Home in light and dark modes; the general theme-aware component contract remains covered separately.

Developmental frame-count sampling was refactored out. Continuity now records until the incoming canonical card reaches its observable settled geometry, with a timeout only as a failure guard. Permanent tests assert public card identity, geometry, rendered resources, focus, and interaction rather than private helpers or exact animation frames.

## Measured geometry

All measurements came from the final production preview after hydration and animation settlement.

| Viewport/state | Blog center delta | Blog visible | Works center delta | Works visible | Active surface |
| --- | ---: | ---: | ---: | ---: | --- |
| 1440 × 900, light | 0px | 5 | 0px | 3 | 576 × 324 |
| 1440 × 900, dark | 0px | 5 | 0px | 3 | 576 × 324 |
| 800 × 900, light | 0px | 5 | 0px | 3 | 576 × 324 |
| 390 × 844, light | 0px | 3 mobile depths | 0px | 3 mobile depths | 356.78 × 200.69 |
| 390 × 844, dark | 0px | 3 mobile depths | 0px | 3 mobile depths | 356.78 × 200.69 |

The desktop/intermediate browser contract additionally covers 768, 800, 900, 1024, and 1440px, derives rail containment from the computed section gutter, and verifies unique mirrored IDs plus matching left/right depth geometry.

## Home-entry trace

Method: Node `v24.19.0`, final static build, local production preview, 1280 × 720, three fresh cold browser contexts per color scheme, ClientRouter About → Home navigation, `astro:page-load` captured in-page, and Resource Timing read 250ms from navigation start.

| Candidate | `astro:page-load` median / mean | 250ms image requests | 250ms transferred image bytes | Carousel hydration at load / 250ms |
| --- | --- | ---: | ---: | --- |
| `v2.2.2` recorded baseline | 7.6 / 11.0ms | 7 | 206,208 | unhydrated at load |
| pre-fix 2.3.0 candidate | 27.8 / 23.6ms | 9 | 1,103,816 | unhydrated at load |
| final, light | 30.0 / 42.5ms | 8 | 72,540 | 0 / 0 |
| final, dark | 26.8 / 29.4ms | 8 | 72,540 | 0 / 0 |

The decisive immediate payload result is a 93.4% reduction from the pre-fix candidate and a 64.8% reduction from the earlier-release byte baseline, despite the current Home having five Blog fallback cards rather than the earlier three. The request count drops by one from the pre-fix candidate; the built Home contains no alternate dark Work asset in either theme.

Route-completion timing remains noisy and does not establish a timing improvement: the light mean contains a 71.4ms cold outlier, while the remaining light samples were 26.0 and 30.0ms and dark samples were 35.0, 26.5, and 26.8ms. The trace continues to show no carousel hydration at `astro:page-load` or 250ms, so no claim attributes that small route delta to hydrated React, GA, Partytown, or a consistent long task.

## Visual evidence

The supplied diagnostic screenshots were not used as targets. These captures were inspected against the accepted live carousel treatment and the written centered-canvas/ring contract:

- `task-13-canvas-performance-evidence/desktop-light-blog.png`
- `task-13-canvas-performance-evidence/desktop-light-works.png`
- `task-13-canvas-performance-evidence/desktop-dark-blog.png`
- `task-13-canvas-performance-evidence/desktop-dark-works.png`
- `task-13-canvas-performance-evidence/intermediate-light-blog.png`
- `task-13-canvas-performance-evidence/intermediate-light-works.png`
- `task-13-canvas-performance-evidence/mobile-light-blog.png`
- `task-13-canvas-performance-evidence/mobile-light-works.png`
- `task-13-canvas-performance-evidence/mobile-dark-blog.png`
- `task-13-canvas-performance-evidence/mobile-dark-works.png`

Inspection passed for full-section backgrounds, fixed UI layering, exact active centering, adaptive rails, section gutters, crops, surfaces, vignette, shadows, bottom title/metadata disclosure, mustard dots/chevrons, neutral borders, light/dark colors, and established mobile depth/control behavior. No `design-qa.md` was created under the superseded screenshot-matching workflow.

## Verification

- Focused unit: `22/22` across `DepthCarousel.test.tsx` and `collectionCards.test.ts`.
- Final production-preview Homepage carousel suite: `22/22` across desktop Chromium and Pixel 7 mobile Chromium.
- Repository unit suite excluding the unrelated design-system mismatch below: `63 files / 754 tests` passed.
- Format, ESLint, Astro check, documentation links, content policy, build, structured data, production artifacts, and build purity passed.
- Full `npm run verify`: format/lint/check passed, then unit result `63 files passed; 1 file failed — 762 passed / 1 failed` because of the pre-existing `designSystem.test.ts` mismatch described below.

## Residual concerns

1. The branch's existing `tests/unit/designSystem.test.ts` expects `@import 'tailwindcss'` immediately followed by `@import './theme.css'`, while the committed stylesheet already has `@import './fonts.css'` between them. This is unrelated to the carousel slice and is the sole full-gate failure.
2. A pre-existing ignored `.analytics-dist/` generated artifact is lint-visible despite being Git-ignored. It was preserved outside the repository for the scoped lint/verify attempt and restored byte-for-byte afterward; leaving it present makes a direct repository-wide ESLint invocation fail on generated bundles.
3. No physical-device gate was required. Browser qualification covers the supported responsive behavior, including keyboard, focus, reduced motion, forced-color contracts retained by the implementation, and mobile touch scrolling.

## Commit

This report is part of the enclosing conventional supplemental-task commit. Git cannot embed that commit's own hash without changing it; the exact hash is recorded in the task handoff.
