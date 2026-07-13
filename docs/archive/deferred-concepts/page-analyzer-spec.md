> **Deferred concept.** Archived 2026-07-13 from `Untracked/docs/page-analyzer-spec.md`.
> Canonical context: [v1 modernization design](../../superpowers/specs/2026-07-11-v1-modernization-design.md).

# Page Analyzer - Feature Specification

## Overview

`Page Analyzer` is the proposed first fully live tool in the `Tools` section of jetsanchez.com.

It is a code-authored feature, not CMS-managed content.

The tool takes a live URL, fetches the page server-side, and returns a structured analysis of the page's visible metadata, heading structure, links, and structured data presence.

This is a deliberately scoped `v1`. It is not a crawler, not a full SEO auditor, and not yet a schema visualization product.

## Product Thesis

The goal is to make it easy to understand the structural shape of a page quickly:

- what is this page?
- how is it titled and described?
- what headings does it use?
- how does it link internally and externally?
- does it contain structured data?

The tool should feel clear, useful, and trustworthy. It should provide meaningful observations without pretending to be a complete SEO scoring engine.

## MVP Scope

### Included

1. Single live URL input
2. Server-side page fetch
3. Page title detection
4. Meta description detection
5. Heading extraction (`h1`, `h2`, `h3`)
6. Link extraction
7. Internal vs external link classification
8. Anchor text extraction
9. Anchor text word-count and character-count metrics
10. Simple page-type heuristic
11. Structured data presence detection
12. Rule-based observations and recommendations

### Excluded

1. Multi-page crawling
2. JavaScript rendering via headless browser
3. Rich results validation
4. Full schema visualization
5. Full schema semantics analysis
6. AI-generated recommendations
7. Sitewide scoring
8. Authentication-protected pages

## Route Placement

The tool lives under the `Tools` section:

- `/tools`
- `/tools/page-analyzer`

The `/tools` hub should surface this as the first fully available tool.

## Target Users

- SEOs
- content strategists
- technical marketers
- developers auditing page structure
- site owners quickly checking on-page structure

## Core Questions The Tool Should Answer

- What title and meta description does this page expose?
- Does it have a clear heading hierarchy?
- How many internal and external links does it contain?
- What anchor text is being used?
- What kind of page is this likely to be?
- Does the page include structured data?

## UX Goals

### Primary UX Goal

Turn a single live URL into a clear structural snapshot of the page.

### Secondary UX Goals

- make the results easy to scan
- separate raw findings from interpreted observations
- keep the tool fast and calm
- avoid “SEO tool spam” aesthetics

## Input Model

### Input

- one URL

### Submission Behavior

- explicit action, such as `Analyze`
- no background crawling
- no auto-analysis while typing

### URL Validation

The tool should:

- require a valid absolute URL
- normalize obvious user input issues where safe
- fail clearly on unsupported or invalid URLs

## Fetching Strategy

The page should be fetched server-side through an API route or server endpoint.

### Why

- avoids browser CORS limitations
- keeps parsing logic centralized
- allows consistent HTML extraction
- makes it possible to enforce timeouts and guardrails

### V1 Constraints

- fetch raw HTML only
- follow normal redirects
- do not execute page JavaScript
- analyze the returned HTML document as-is

This means some JavaScript-heavy pages may produce incomplete results in `v1`. That is acceptable and should be communicated clearly.

## Extraction Scope

### Metadata

The tool should extract:

- page `<title>`
- meta description
- canonical URL, if present
- robots meta, if present

### Headings

The tool should extract:

- `h1`
- `h2`
- `h3`

For each heading:

- level
- text content
- order

### Links

The tool should extract anchor links from `<a>` elements.

For each link:

- raw `href`
- resolved absolute URL
- anchor text
- anchor text word count
- anchor text character count
- internal vs external classification
- nofollow / sponsored / ugc flags if present

### Structured Data Presence

`v1` should detect presence of structured data, not fully visualize it.

The tool should detect at minimum:

- JSON-LD blocks
- Microdata presence, if discoverable cheaply from HTML

For JSON-LD presence, the tool should report:

- count of script blocks
- whether they parse as JSON
- top-level `@type` values when easily detectable

This is presence detection and light summarization, not full schema analysis.

## Classification Rules

### Internal vs External

A URL is internal if it matches the analyzed page's site origin.

The tool should resolve relative links against the analyzed page URL before classification.

### Link Filtering

The tool should decide how to handle:

- fragment-only links
- `mailto:`
- `tel:`
- `javascript:`

My recommendation for `v1`:

- report them separately from standard crawlable links

### Page Type Heuristic

The page-type heuristic should be intentionally lightweight and labeled as heuristic.

Possible signals:

- path patterns such as `/blog/`, `/posts/`, `/category/`
- heading/content shape
- metadata patterns

Example labels:

- blog article
- homepage
- category/archive page
- product page
- general content page

The tool should avoid overclaiming certainty.

## Observations and Recommendations

`v1` may include simple rule-based observations.

These should be:

- transparent
- explainable
- lightweight

Examples:

- “Only 1 internal link detected.”
- “No external links detected.”
- “No `h1` found.”
- “Multiple `h1` elements detected.”
- “Structured data not detected.”
- “Anchor text includes generic phrases such as ‘click here’.”

These should be framed as observations and suggestions, not definitive SEO scores.

## Results Layout

Suggested high-level page structure:

1. Tool intro
2. URL input form
3. Summary snapshot
4. Tabs or sections for:
   - Overview
   - Headings
   - Links
   - Structured Data
   - Observations

The exact IA can change, but the results should separate:

- raw extracted data
- synthesized observations

## Summary Snapshot

The top summary should include:

- page title
- detected page type
- internal link count
- external link count
- heading counts
- structured data presence

## Structured Data V1 Positioning

The structured data portion of `v1` should answer:

- is structured data present?
- in what form?
- how many blocks?
- what top-level types seem to exist?

It should not attempt:

- graph visualization
- entity relationship mapping
- rich validation rules
- full schema.org semantic interpretation

This keeps the feature useful without turning the first tool into the full schema visualizer project.

## Performance Expectations

The tool should feel responsive for single-page analysis.

Guardrails should include:

- request timeout
- maximum response size for `v1`
- graceful error messaging on fetch failure

## Error Handling

The tool should distinguish between:

1. invalid URL input
2. unreachable page
3. non-HTML response
4. fetch timeout
5. page fetched successfully but with limited analyzable content

Structured data presence detection should also distinguish between:

1. no structured data found
2. JSON-LD blocks found but invalid JSON
3. JSON-LD blocks found and parseable

## Accessibility Requirements

- keyboard-accessible form and tabs
- clear heading structure in the UI
- readable tables/lists for link output
- no information conveyed only through color

## Technical Approach

### Frontend

- Astro page shell
- React island for results experience if needed

### Backend / Analysis Layer

- Astro API route or server endpoint
- server-side fetch
- HTML parsing
- normalization utilities
- lightweight rule engine for observations

### Parsing Approach

For `v1`, use HTML parsing and straightforward rule-based extraction.

This tool does not require `jsonld` as a core dependency in `v1` unless the structured-data summary grows beyond presence detection.

## Future Extensions

### Natural Next Steps

- schema block viewer
- full schema visualization
- rendered DOM analysis for JS-heavy pages
- multiple-URL comparison
- crawl mode
- export CSV / JSON

### Relationship To Schema Visualizer

If the schema visualizer is built later, it should likely become:

- a second tool under `/tools`
- or a deeper structured-data sub-view launched from the structured-data results of Page Analyzer

This spec intentionally keeps structured data at the “presence and summary” level so the first tool remains shippable.

## Implementation Plan

### Phase 1: Core Fetch and Parse

1. Create `/tools/page-analyzer`
2. Create server-side analysis endpoint
3. Validate URL input
4. Fetch page HTML with timeout and response guards
5. Parse core metadata, headings, and links

### Phase 2: Results UI

1. Build summary snapshot
2. Build headings section
3. Build links section
4. Build structured data presence section
5. Build observations section
6. Update `/tools/index.astro` to surface Page Analyzer as the first live tool

### Phase 3: Heuristics and Polish

1. Add page-type heuristic
2. Add anchor text metrics
3. Add rule-based observations
4. Improve empty/error states
5. Validate mobile and desktop behavior

## Success Criteria

The MVP is successful if:

1. A user can analyze a live page URL and get reliable structural output
2. The tool cleanly distinguishes metadata, headings, links, and structured data presence
3. The observations feel useful without overclaiming authority
4. The tool feels like a real public product feature, not a scrape dump
5. The tool is discoverable from `/tools`

---

**Last Updated**: 2026-04-10
**Spec Version**: 1.0
