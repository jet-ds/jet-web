# Jet Web v1 Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the existing Astro site in place, contain the retired chatbot exposure, enforce explicit content publication, add verification, and preserve the site's visual identity.

**Architecture:** The site becomes a deterministic static Astro build deployed on Vercel. Astro content collections remain authoritative, shared predicates govern publication and assistant inclusion, and React remains limited to interactive islands. Core `2.0.0` establishes trailing-slash canonical HTML URLs while preserving the approved noindexed Jet's Ghost interface prototype at `/tools/chatbot/` behind an interim `/chatbot` redirect; the companion `2.1.0` plan integrates its real local runtime at semantic route `/chatbot` with canonical URL `https://jetsanchez.com/chatbot/` and reverses the route, navigation, and indexing state together.

**Tech Stack:** Astro 5, MDX, React 19, TypeScript 5.9, Tailwind CSS 3.4, Vitest, Playwright, axe-core, Vercel, Node.js 24.

## Global Constraints

- Preserve the existing visual identity, OKLCH tokens, Utopia spacing, Liquid Glass dock, and Grainient character.
- Keep Tailwind CSS on v3.4.18.
- Use Astro components unless interaction requires React.
- `status` is required; `assistant` defaults to `false`.
- Public content requires `status === 'published'`.
- Assistant content requires `status === 'published' && assistant === true`.
- Ordinary builds must make no remote writes and modify no source file.
- `AGENTS.md` is canonical; `CLAUDE.md` is a relative symlink to it.
- Application versioning follows Semantic Versioning 2.0.0 from baseline `1.0.0`.
- The intentionally incompatible modernization releases as `2.0.0`; Jet's Ghost later targets `2.1.0`.
- Preserve the Jet's Ghost interface, copy, responsive behavior, animation language, and activation boundary from `docs/jets-ghost-chat-experience.md` and commit `d406ed46dfc7cccfa95d0003fcae30f5b9373690`; this plan contains exposure but does not redesign the prototype.
- Task 3 first contains `/chatbot` at `/tools/chatbot` exactly as deployed and recorded. Task 10 changes only that still-interim destination to `/tools/chatbot/` as part of the core trailing-slash contract; it must not reverse or index the prototype early. The companion plan owns the final reversal to `/chatbot/`, Ghost-for-Tools navigation replacement, and `/tools/` dormancy.
- Non-merge commits follow Conventional Commits 1.0.0 and require no agent attribution.
- Never stage or rewrite unrelated user-owned untracked files.
- Perform all implementation in a clean worktree created from the reviewer-approved documentation commit; leave the original checkout untouched.
- Stage only explicit file paths. Broad directory staging and `git add -u` without exact paths are prohibited.
- Production mutation steps require readback verification before completion.
- Revoke the active OpenRouter production key as the first external mutation, before worktree setup, dependency installation, baseline capture, or feature work; sanitize and commit the non-secret revocation readback later after the evidence tooling exists.

---

## File Structure

### Repository governance

- `AGENTS.md` — canonical repository instructions.
- `CLAUDE.md` — relative symlink to `AGENTS.md`.
- `docs/archive/` — indexed historical specifications, research, and completed implementation logs.
- `.nvmrc` — Node 24 selection.
- `package.json` / `package-lock.json` — application version, engines, commands, and dependencies.

### Content policy

- `src/content/policy.ts` — shared publication predicates.
- `src/content/validation.ts` — pure production-content validation.
- `scripts/verify-content.ts` — filesystem/Git adapter for the pure validator.
- `tests/unit/content/policy.test.ts` — schema and predicate tests.
- `tests/unit/content/validation.test.ts` — validation tests.

### Verification

- `vitest.config.ts` — unit/component test configuration.
- `playwright.config.ts` — browser-test configuration.
- `tests/setup.ts` — DOM matcher setup.
- `tests/e2e/site.spec.ts` — route, metadata, redirect, theme, and SSRN checks.
- `tests/e2e/accessibility.spec.ts` — axe and keyboard checks.
- `.github/workflows/verify.yml` — Node 24 CI.
- `docs/verification/baselines/core-1.0.0/` — immutable pre-modernization production screenshots and metadata manifest.

### Shared UI and metadata

- `src/config/site.ts` — canonical navigation data.
- `src/utils/structuredData.ts` — typed JSON-LD builders.
- `src/utils/grainientLifecycle.ts` — pure animation-loop decision.

### Deployment

- `vercel.json` — interim core-`2.0.0` containment redirect plus platform trailing-slash normalization, with only the redirect reversed by the Jet's Ghost `2.1.0` plan.
- `astro.config.mjs` — static Astro configuration without the Vercel server adapter and with trailing-slash HTML output.

---

### Security prerequisite: revoke the OpenRouter key before Task 0

This prerequisite is the first authorized operational action. Local identity checks may precede it; no repository edit, dependency installation, screenshot capture, deployment, Vercel environment mutation, Blob mutation, or feature work may do so.

From the original checkout, validate the existing ignored Vercel link contains exactly non-secret `orgId`, `projectId`, and `projectName` fields and that `projectName` identifies `jet-web`. In the authenticated OpenRouter dashboard, use the key's non-secret record ID/label and the production project association to identify the credential currently used by that deployment. If the project or key cannot be identified unambiguously without exposing its value, stop for explicit operator identification.

Once identified, revoke the key immediately and read the provider record back as revoked or disabled. Before leaving the dashboard, create private mode-`0600` operator evidence beneath a new mode-`0700` `$GIT_COMMON_DIR/codex/v1-modernization/` directory. It contains only provider, non-secret key record ID or final four characters, status, revocation UTC time, and verification UTC time; never the credential value, headers, cookies, or a provider response dump. This private readback is not staged. Task 2 creates the sanitizer, and Task 3 projects this record into committed evidence before removing the now-inert variable name from Vercel.

Expected: the production credential can no longer authorize OpenRouter generation before any longer modernization task begins.

---

### Task 0: Isolate implementation from the dirty original checkout

**Files:**
- Create outside the original checkout: clean Git worktree and branch.
- Complete the private operator state created by the security prerequisite beneath the Git common directory: `codex/v1-modernization/`.
- Record in the clean worktree: `docs/verification/baselines/core-1.0.0/operator-state-attestation.json`.

**Interfaces:**
- Produces: an isolated implementation checkout at the exact reviewer-approved commit.
- Preserves: every user-owned untracked file in the original checkout, including the active Codex draft.

- [ ] **Step 1: Invoke the worktree workflow and inventory the original checkout**

Use `superpowers:using-git-worktrees`. From the original checkout run:

```bash
set -euo pipefail
ORIGINAL_ROOT=$(git rev-parse --show-toplevel)
APPROVED_SHA=$(git rev-parse HEAD)
GIT_COMMON_DIR=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
OPERATOR_STATE_DIR="$GIT_COMMON_DIR/codex/v1-modernization"
umask 077
test -d "$OPERATOR_STATE_DIR"
test "$(find "$OPERATOR_STATE_DIR" -mindepth 1 -maxdepth 1 -type f -print | wc -l | tr -d ' ')" = "1"
test -f "$OPERATOR_STATE_DIR/openrouter-key-revocation.raw.json"
chmod 700 "$OPERATOR_STATE_DIR"
node -e "const fs=require('node:fs'); const p=process.argv[1]; const d=JSON.parse(fs.readFileSync(p,'utf8')); const keys=Object.keys(d).sort(); const allowed=['keyRecord','provider','revokedAt','status','verifiedAt']; if(JSON.stringify(keys)!==JSON.stringify(allowed)||d.provider!=='OpenRouter'||!['revoked','disabled'].includes(d.status)||!d.keyRecord||!/Z$/.test(d.revokedAt)||!/Z$/.test(d.verifiedAt)) process.exit(1)" "$OPERATOR_STATE_DIR/openrouter-key-revocation.raw.json"
git diff --exit-code
git diff --cached --exit-code
git status --porcelain=v1 -uall
git status --porcelain=v1 -z -uall > "$OPERATOR_STATE_DIR/original-status.z"
printf '%s\n' "$ORIGINAL_ROOT" > "$OPERATOR_STATE_DIR/original-root.txt"
printf '%s\n' "$APPROVED_SHA" > "$OPERATOR_STATE_DIR/approved-sha.txt"
shasum -a 256 EMBEDDING_STORAGE_RESEARCH.md docs/jets-ghost-v1.5-spec.md docs/rag-chatbot-implementation-review.md docs/liquid-glass-dock-v2-log.md > "$OPERATOR_STATE_DIR/authorized-archive-source-hashes.txt"
node -e "const p=require('./.vercel/project.json'); const keys=Object.keys(p).sort(); if(JSON.stringify(keys)!==JSON.stringify(['orgId','projectId','projectName'])||!['orgId','projectId','projectName'].every(k=>typeof p[k]==='string'&&p[k])) process.exit(1)"
cp .vercel/project.json "$OPERATOR_STATE_DIR/vercel-project.json"
chmod 600 "$OPERATOR_STATE_DIR"/*
```

Expected: tracked and staged diffs are empty; untracked user files may be listed. The private directory contains the sanitized-shape revocation readback, absolute source root, NUL-delimited inventory, approved SHA, four archival-candidate hashes, and the validated three-field Vercel link. Nothing in that directory is tracked or copied into the clean worktree. If the original project link is absent or has any other shape, stop for explicit project identification rather than running interactive `vercel link`.

- [ ] **Step 2: Create and verify the clean worktree**

Let the worktree skill select a safe sibling path, then create branch `codex/v1-modernization` from `APPROVED_SHA`. In the new worktree run:

```bash
test "$(git rev-parse HEAD)" = "$APPROVED_SHA"
test "$(git branch --show-current)" = "codex/v1-modernization"
test -z "$(git status --porcelain=v1 -uall)"
```

Expected: all checks pass. Every remaining task runs only in this clean worktree. If the branch already exists, stop and reconcile it rather than resetting or overwriting it.

- [ ] **Step 3: Commit only a non-identifying attestation later**

Using the private state, create `operator-state-attestation.json` with only:

```json
{
  "schemaVersion": "1.0.0",
  "approvedSha": "<40-hex commit>",
  "inventory": {
    "sha256": "<SHA-256 of original-status.z>",
    "entryCount": 0
  },
  "authorizedArchiveSources": [
    { "path": "<one of the four approved paths>", "sha256": "<SHA-256>" }
  ]
}
```

Sort the four authorized records by path and calculate `entryCount` from the NUL-delimited private inventory. The attestation contains no absolute path and no unrelated untracked filename. Validate it against the private files before use. No listed user file is copied into the worktree except the four superseded documents explicitly authorized for archival in Task 11. At the end of every task, recalculate the original checkout's NUL-delimited inventory and compare its digest/count with the private state; stop on drift before controlled cleanup.

No commit occurs in Task 0; Task 1 establishes the commit policy and commits only this non-identifying attestation.

---

### Task 1: Establish repository governance and version baseline

**Files:**
- Replace symlink with file: `AGENTS.md`
- Replace file with symlink: `CLAUDE.md`
- Create: `.nvmrc`
- Create: `docs/verification/baselines/core-1.0.0/operator-state-attestation.json`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: canonical instructions at `AGENTS.md`, compatibility link at `CLAUDE.md`, application version `1.0.0`, Node engine `24.x`.
- Consumes: current `CLAUDE.md` contents and current `AGENTS.md -> CLAUDE.md` link.

- [ ] **Step 1: Record the current link and version state**

Run:

```bash
test -L AGENTS.md
test "$(readlink AGENTS.md)" = "CLAUDE.md"
test ! -L CLAUDE.md
node -e "const p=require('./package.json'); if(p.version!=='0.0.1') process.exit(1)"
```

Expected: all commands exit `0`.

- [ ] **Step 2: Invert the canonical instruction file**

Run:

```bash
git rm AGENTS.md
git mv CLAUDE.md AGENTS.md
ln -s AGENTS.md CLAUDE.md
git add CLAUDE.md
```

Expected:

```text
AGENTS.md is a regular tracked file
CLAUDE.md -> AGENTS.md
```

- [ ] **Step 3: Replace the commit policy in `AGENTS.md`**

Replace the existing `Commits` bullet with:

```markdown
- **Versioning**: Follow [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).
  - `package.json` is the authoritative application version.
  - The Semantic Versioning starting point is `1.0.0`.
  - Use `v<major>.<minor>.<patch>` release tags.
  - Content-only and documentation-only deployments do not require a version change unless they accompany an application release.
- **Commits**: Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).
  - Format: `type(optional-scope)!: description`.
  - Common types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
  - Use `!` and a `BREAKING CHANGE:` footer for incompatible changes.
  - Commit bodies describe intent, constraints, and verification when useful.
  - Do not add Claude, Codex, agent, co-author, or generated-by attribution unless a human explicitly requests it for that commit.
```

Also update the directory tree line to:

```text
├── AGENTS.md            # Canonical instructions for agents and contributors
├── CLAUDE.md -> AGENTS.md
```

- [ ] **Step 4: Set Node and application versions**

Create `.nvmrc` with:

```text
24
```

Update `package.json`:

```json
{
  "name": "jet-web",
  "version": "1.0.0",
  "engines": {
    "node": "24.x"
  }
}
```

Run:

```bash
npm install --package-lock-only --ignore-scripts
```

Expected: the root package in `package-lock.json` is `1.0.0` and includes Node `24.x`.

- [ ] **Step 5: Verify the canonical-file and governance contract**

Run:

```bash
test -f AGENTS.md
test ! -L AGENTS.md
test -L CLAUDE.md
test "$(readlink CLAUDE.md)" = "AGENTS.md"
cmp AGENTS.md CLAUDE.md
node -e "const p=require('./package.json'); if(p.version!=='1.0.0'||p.engines.node!=='24.x') process.exit(1)"
rg -n "Semantic Versioning 2.0.0|Conventional Commits 1.0.0|Do not add Claude" AGENTS.md
```

Expected: all checks pass and the three governance phrases are printed.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md CLAUDE.md .nvmrc package.json package-lock.json docs/verification/baselines/core-1.0.0/operator-state-attestation.json
git commit -m "chore(governance): establish repository conventions"
```

### Task 2: Install the verification harness

**Files:**
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/unit/config/site.test.ts`
- Create: `tests/unit/ops/vercelEvidence.test.ts`
- Create: `scripts/capture-production-baseline.ts`
- Create: `scripts/sanitize-vercel-evidence.ts`
- Create: `docs/verification/baselines/core-1.0.0/manifest.json`
- Create: `docs/verification/baselines/core-1.0.0/vercel-inspect.json`
- Create: `docs/verification/baselines/core-1.0.0/vercel-deployment.json`
- Create: `docs/verification/baselines/core-1.0.0/screenshots/*.png`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `npm run check`, `npm run test`, `npm run test:e2e`, and a reusable jsdom test environment.
- Consumes: `SITE` from `src/config/site.ts`.

- [ ] **Step 1: Install exact test categories**

Run:

```bash
npm install --save-dev --save-exact vitest@4.1.10 @vitest/coverage-v8@4.1.10 jsdom@29.1.1 @testing-library/react@16.3.2 @testing-library/jest-dom@6.9.1 @playwright/test@1.61.1 @axe-core/playwright@4.12.1
```

Expected: dependencies are added to `devDependencies` and the lockfile changes.

- [ ] **Step 2: Add scripts to `package.json`**

Use:

```json
{
  "scripts": {
    "dev": "astro dev",
    "check": "astro check",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "build": "npm run build:embeddings && npm run build:site",
    "build:site": "astro build",
    "preview": "astro preview"
  }
}
```

Keep the embedding commands temporarily; Task 3 removes them while testing that boundary.

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/{unit,integration}/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
    },
  },
});
```

- [ ] **Step 4: Create `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
```

Do not run Playwright until Task 3 has replaced the current remote-writing build. From that point onward, every browser test exercises the built static artifact through `astro preview`.

- [ ] **Step 6: Write and run the first unit test**

Create `tests/unit/config/site.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SITE } from '../../../src/config/site';

describe('site configuration', () => {
  it('uses the production HTTPS origin', () => {
    expect(SITE.siteUrl).toBe('https://jetsanchez.com');
  });
});
```

Run:

```bash
npm run test -- tests/unit/config/site.test.ts
```

Expected: `1 passed`.

- [ ] **Step 7: Write and implement the Vercel evidence sanitizer**

Create `tests/unit/ops/vercelEvidence.test.ts` before `scripts/sanitize-vercel-evidence.ts`. The CLI has five explicit modes:

```text
sanitize-inspect     -> { id, name, url, target: string | null, readyState, aliases }
sanitize-deployment  -> { id, url, target: string | null, readyState, createdAt, gitSource: { type, ref, sha }, project: { id, name } }
sanitize-env         -> { scope, envs: [{ key, type, target, gitBranch? }] }
sanitize-openrouter-revocation -> { provider, keyRecord, status, revokedAt, verifiedAt }
verify-safe          -> validates one already-sanitized evidence file without rewriting it
```

Each sanitizing mode validates provider input, constructs a new object from only the listed keys, sorts arrays deterministically, writes canonical JSON, and then runs the same safety verifier. It never copies unknown properties. `sanitize-openrouter-revocation` accepts only provider `OpenRouter`, a non-secret record ID or explicitly labelled final-four value, status `revoked` or `disabled`, and UTC timestamps; it rejects credential-shaped `keyRecord` values and all unknown fields. `verify-safe` can scan these projections plus the purpose-built Blob/result evidence schemas; it recursively rejects property names matching value/secret/token/password/auth/cookie/header/raw/build-env patterns, authorization/cookie/encrypted-value/environment-value containers, and credential-like or high-entropy values outside approved SHA/ID fields. It does not silently bless arbitrary provider fields. Environment-variable *names* remain permitted only as `envs[].key`; their values never are. Tests include realistic Vercel/OpenRouter responses containing nested `value`, `encryptedValue`, `buildEnv`, `env`, headers, cookies, and token-shaped canaries and prove none can survive sanitization. A sanitizer failure must remove a partial output.

URL-shaped fields are never exempted from validation. Parse hostnames by prepending `https://` only when the provider returns a bare host, then require HTTPS semantics, no username/password, no non-root path for deployment/alias hosts, no query, no fragment, no control character, and no percent-decoded secret-shaped component. Deployment URLs must be `*.vercel.app`; aliases must be `jetsanchez.com`, `www.jetsanchez.com`, or `*.vercel.app`; Blob evidence URLs must use the exact public Vercel Blob host established by the known containment inventory and likewise have no userinfo, query, or fragment. Re-emit only the validated normalized hostname/URL form. Add plaintext and percent-encoded token query, userinfo, path, fragment, CRLF, and double-encoding canaries for every URL-bearing evidence schema.

Run:

```bash
npm run test -- tests/unit/ops/vercelEvidence.test.ts
```

- [ ] **Step 8: Capture an immutable production baseline before site behavior changes**

Create `scripts/capture-production-baseline.ts`. It must use Playwright's installed Chromium to capture these production routes at `1440x1000` and a `Pixel 7` viewport:

```text
/
/blog
/blog/how-to-install-claude-code-cli-2026
/works
/works/recursive-convergence-hypothesis
/tools
/contact
```

For each route and viewport, write a full-page PNG and a manifest record containing URL, HTTP status, viewport, title, canonical URL, parsed JSON-LD, and SHA-256 of the response HTML. Sort records by route then viewport and write canonical JSON to the requested output. Require `--expected-commit` plus a sanitizer-approved `--deployment` file and fail unless `gitSource.sha` matches. Support an optional `--compare-to=<immutable-baseline-directory>` that writes `comparison.json` beside the candidate manifest, never into the baseline. In comparison mode, refuse an output path equal to or beneath the baseline and refuse a pre-existing output directory, preventing stale files from entering release evidence.

Raw provider responses are temporary inputs only. Create them under a private temporary directory, sanitize them into the repository, and delete the directory on every exit:

```bash
npx playwright install chromium
umask 077
EVIDENCE_TMP=$(mktemp -d)
chmod 700 "$EVIDENCE_TMP"
trap 'rm -rf "$EVIDENCE_TMP"' EXIT HUP INT TERM
npx --yes vercel@55.0.0 inspect jetsanchez.com --format=json > "$EVIDENCE_TMP/vercel-inspect.raw.json"
npx tsx scripts/sanitize-vercel-evidence.ts sanitize-inspect --input="$EVIDENCE_TMP/vercel-inspect.raw.json" --output=docs/verification/baselines/core-1.0.0/vercel-inspect.json
BASELINE_DEPLOYMENT_ID=$(node -e "const d=require('./docs/verification/baselines/core-1.0.0/vercel-inspect.json'); process.stdout.write(d.id)")
npx --yes vercel@55.0.0 api "/v13/deployments/$BASELINE_DEPLOYMENT_ID" --raw > "$EVIDENCE_TMP/vercel-deployment.raw.json"
npx tsx scripts/sanitize-vercel-evidence.ts sanitize-deployment --input="$EVIDENCE_TMP/vercel-deployment.raw.json" --output=docs/verification/baselines/core-1.0.0/vercel-deployment.json
npx tsx scripts/sanitize-vercel-evidence.ts verify-safe --input=docs/verification/baselines/core-1.0.0/vercel-inspect.json
npx tsx scripts/sanitize-vercel-evidence.ts verify-safe --input=docs/verification/baselines/core-1.0.0/vercel-deployment.json
rm -rf "$EVIDENCE_TMP"
trap - EXIT HUP INT TERM
npx tsx scripts/capture-production-baseline.ts --origin=https://jetsanchez.com --expected-commit=c0d158c2f1ba73c879890fd2a8269f633d1f2d04 --deployment=docs/verification/baselines/core-1.0.0/vercel-deployment.json --output=docs/verification/baselines/core-1.0.0
```

Expected: the Vercel API record is `READY`, targets production, and identifies Git SHA `c0d158c2f1ba73c879890fd2a8269f633d1f2d04`; fourteen predictably named screenshots exist; every route status is `200`; every JSON-LD value parses. If the production SHA has changed, stop and review the new deployment before replacing this expected baseline. These files remain the comparison baseline even after containment and intermediate deployments.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts playwright.config.ts tests/setup.ts tests/unit/config/site.test.ts tests/unit/ops/vercelEvidence.test.ts scripts/capture-production-baseline.ts scripts/sanitize-vercel-evidence.ts docs/verification/baselines/core-1.0.0/manifest.json docs/verification/baselines/core-1.0.0/vercel-inspect.json docs/verification/baselines/core-1.0.0/vercel-deployment.json docs/verification/baselines/core-1.0.0/screenshots/home-desktop.png docs/verification/baselines/core-1.0.0/screenshots/home-mobile.png docs/verification/baselines/core-1.0.0/screenshots/blog-index-desktop.png docs/verification/baselines/core-1.0.0/screenshots/blog-index-mobile.png docs/verification/baselines/core-1.0.0/screenshots/blog-claude-desktop.png docs/verification/baselines/core-1.0.0/screenshots/blog-claude-mobile.png docs/verification/baselines/core-1.0.0/screenshots/works-index-desktop.png docs/verification/baselines/core-1.0.0/screenshots/works-index-mobile.png docs/verification/baselines/core-1.0.0/screenshots/works-rch-desktop.png docs/verification/baselines/core-1.0.0/screenshots/works-rch-mobile.png docs/verification/baselines/core-1.0.0/screenshots/tools-desktop.png docs/verification/baselines/core-1.0.0/screenshots/tools-mobile.png docs/verification/baselines/core-1.0.0/screenshots/contact-desktop.png docs/verification/baselines/core-1.0.0/screenshots/contact-mobile.png
git commit -m "test: establish verification harness"
```

### Task 3: Contain the production chatbot and restore a pure static build

**Files:**
- Create: `tests/unit/build/staticBoundary.test.ts`
- Create: `tests/unit/ops/chatbotContainment.test.ts`
- Create: `tests/unit/ops/productionContainment.test.ts`
- Create: `scripts/verify-build-purity.ts`
- Create: `scripts/contain-chatbot-blobs.ts`
- Create: `scripts/verify-production-containment.ts`
- Create: `docs/verification/containment/`
- Create: `vercel.json`
- Modify: `tests/unit/ops/vercelEvidence.test.ts`
- Modify: `scripts/sanitize-vercel-evidence.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `astro.config.mjs`
- Modify: `.gitignore`
- Modify: `src/utils/artifact-loader.ts`
- Delete: `src/pages/api/chat.ts`
- Delete: `src/pages/chatbot.astro`
- Preserve unchanged: `src/pages/tools/chatbot.astro`, `src/features/jets-ghost/JetsGhostExperience.tsx`, `src/features/jets-ghost/experience.ts`, `tests/jets-ghost-experience.test.ts`
- Ensure absent in the clean worktree: `src/config/chatbot-artifacts.json` (never touch the original checkout's copy)

**Interfaces:**
- Produces: side-effect-free `npm run build`, exact interim static `/chatbot` 308 redirect, preserved noindexed interface prototype, no `/api/chat` route, and asserted containment evidence.
- Consumes: Vercel project link and existing Blob/OpenRouter access for containment only.

- [ ] **Step 1: Write the failing static-boundary test**

Create `tests/unit/build/staticBoundary.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
};
const astroConfig = readFileSync('astro.config.mjs', 'utf8');

describe('static production boundary', () => {
  it('builds Astro without remote-writing embedding work', () => {
    expect(packageJson.scripts.build).toContain('astro build');
    expect(packageJson.scripts.build).not.toContain('embedding');
    expect(packageJson.scripts['build:embeddings']).toBeUndefined();
  });

  it('does not configure the Vercel server adapter', () => {
    expect(packageJson.dependencies['@astrojs/vercel']).toBeUndefined();
    expect(astroConfig).not.toContain("from '@astrojs/vercel'");
    expect(astroConfig).not.toContain('adapter:');
  });
});
```

Run:

```bash
npm run test -- tests/unit/build/staticBoundary.test.ts
```

Expected: FAIL because the old build and adapter remain.

- [ ] **Step 2: Replace the build scripts and adapter**

Set the relevant scripts to:

```json
{
  "build": "astro build",
  "dev": "astro dev",
  "preview": "astro preview"
}
```

Remove `build:embeddings`, `build:site`, and `dev:embeddings`.

Run:

```bash
npm uninstall @astrojs/vercel
```

Remove the `@astrojs/vercel` import and `adapter: vercel()` from `astro.config.mjs`.

- [ ] **Step 3: Remove the active server and generated-artifact boundaries**

Delete the active API route and the old root chatbot route. If an accidental local command created `src/config/chatbot-artifacts.json` in the clean worktree, remove that generated copy only; it should normally be absent:

```text
src/pages/api/chat.ts
src/pages/chatbot.astro
src/config/chatbot-artifacts.json
```

Remove this obsolete ignore entry from `.gitignore`:

```text
src/config/chatbot-artifacts.json
```

Add the generated verification directories that later tasks intentionally keep out of commits:

```text
coverage/
playwright-report/
test-results/
```

Replace the now-orphaned `src/utils/artifact-loader.ts` implementation with an explicitly inert compatibility seam until Task 9 removes the retired runtime. Preserve the `checkCache()` and `fetchArtifacts()` signatures required by dead legacy modules, but make `checkCache()` always return `null` and make `fetchArtifacts()` immediately throw a non-recoverable typed `ChatbotError` stating that hosted artifacts are retired. The seam must not import generated artifact config, open IndexedDB, reuse cached artifacts, or fetch hosted artifacts.

Extend `staticBoundary.test.ts` with an injected `git check-ignore` assertion for one child path beneath each directory. This makes build-purity exclusions explicit rather than assuming the current repository already ignores them.

Create `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "redirects": [
    {
      "source": "/chatbot",
      "destination": "/tools/chatbot",
      "permanent": true
    }
  ]
}
```

This redirect is the core-`2.0.0` containment state, not the final information architecture. Do not reverse it in this task; the companion Jet's Ghost Task 9 coordinates that reversal with the canonical, sitemap, structured-data, navigation, and deployment-test changes.

- [ ] **Step 4: Preserve and verify the approved interface prototype**

Keep the noindexed `/tools/chatbot` prototype from commit `d406ed46dfc7cccfa95d0003fcae30f5b9373690` intact. It is the approved `2.1.0` interface source, not a placeholder to rewrite. Confirm:

```bash
npm run test:jets-ghost-design
rg -n "noindex=\{true\}" src/pages/tools/chatbot.astro
if rg -n "@litert-lm|gemma-4-E2B|assistant/corpus|/api/chat|OPENROUTER" src/pages/tools/chatbot.astro src/features/jets-ghost; then exit 1; fi
```

Expected: the interface tests pass, the prototype remains noindexed, and it has no production model, corpus, engine, or hosted-generation dependency. Its timers and transparent canned response remain design-only seams until the companion plan replaces them.

- [ ] **Step 5: Implement and test every containment tool before committing it**

Create `scripts/verify-build-purity.ts`. It must obtain the NUL-delimited union of tracked and nonignored untracked files with `git ls-files --cached --others --exclude-standard -z`, hash each file's bytes, capture `git status --porcelain=v1 -uall`, run `npm run build` without a shell, repeat both snapshots, and fail with changed paths if either snapshot differs. Ignored build outputs such as `dist/`, `.astro/`, `node_modules/`, Playwright results, and coverage are naturally excluded; no source/config exception is permitted.

Write `tests/unit/ops/chatbotContainment.test.ts` and `tests/unit/ops/productionContainment.test.ts` before their scripts. Refactor `scripts/sanitize-vercel-evidence.ts` so importing it has no CLI side effect and it exports the same Blob-inventory safety validator and canonical serializer used by `verify-safe`; cover that import boundary in `tests/unit/ops/vercelEvidence.test.ts`. `contain-chatbot-blobs.ts` receives injected list/delete/fetch/time plus evidence-exists/read/write and stdout dependencies, defaults to a read-only dry run, and requires `--execute` for deletion. Before stdout, evidence writes, or Blob deletion, validate every current or saved Blob inventory in memory with the shared Task 2 sanitizer rules, including credential-shaped/high-entropy canaries and exact Blob URL rules. A dry run writes the canonical safe current inventory and classified state to stdout and performs no mutation.

Containment execution is an explicit restartable state machine. `FRESH` requires a nonempty current inventory containing all three known objects and no saved before evidence; it atomically creates canonical before evidence without overwriting an existing path, then deletes the full inventory. `RESUME` requires a sanitizer-safe saved before inventory containing all three known objects and a nonempty current inventory that is an exact subset of that proof; it preserves the before file byte-for-byte and deletes only the remaining objects. `ALREADY_CONTAINED` requires an empty current inventory plus the same complete valid before proof; it preserves that proof, validates or creates canonical empty after evidence as needed, and probes every URL from the original before inventory. Empty or partial current state without the complete saved proof fails without output, overwrite, deletion, or probe. Existing valid before evidence is never overwritten. Tests cover complete pagination, additional matching objects, all three states, missing proof, unsafe saved/current/after evidence, interrupted deletion and restartable resume, bounded relists, and cache-busted exact-`404` probes.

`verify-production-containment.ts` receives injected fetch/file readers and result-exists/writer boundaries. It accepts only the normalized exact origin `https://jetsanchez.com`, rejecting every other HTTPS origin before any evidence read or fetch. It refuses a pre-existing result path before reads/fetches and uses atomic no-overwrite creation for canonical sanitizer-safe output. Tests preserve stale-result sentinels and cover every status, redirect, deployment-SHA, environment, revocation, Blob-safety, and Blob assertion—including one failing test per boundary. No test may call Vercel, Blob, OpenRouter, or the public site.

Implement both scripts until those tests pass. This step finishes the scripts that Step 6 stages; the following steps only execute the already-committed tools against authorized external systems.

Add:

```json
{
  "verify:build-purity": "tsx scripts/verify-build-purity.ts"
}
```

Run:

```bash
npm run test -- tests/unit/build/staticBoundary.test.ts
npm run test -- tests/unit/ops/chatbotContainment.test.ts tests/unit/ops/productionContainment.test.ts
npm run check
npm run verify:build-purity
test ! -e dist/api/chat
```

Expected: tests, check, and build pass; the build changes no tracked, staged, or nonignored untracked file; no chat API output exists.

- [ ] **Step 6: Commit the static containment code**

```bash
git add package.json package-lock.json astro.config.mjs .gitignore vercel.json src/utils/artifact-loader.ts tests/unit/build/staticBoundary.test.ts tests/unit/ops/chatbotContainment.test.ts tests/unit/ops/productionContainment.test.ts tests/unit/ops/vercelEvidence.test.ts scripts/verify-build-purity.ts scripts/contain-chatbot-blobs.ts scripts/verify-production-containment.ts scripts/sanitize-vercel-evidence.ts docs/superpowers/plans/2026-07-11-v1-modernization.md
git add -u src/pages/api/chat.ts src/pages/chatbot.astro
git commit -m "fix(security)!: retire hosted chatbot endpoint" -m "BREAKING CHANGE: The public /api/chat generation endpoint is removed."
```

- [ ] **Step 7: Bind and verify the clean worktree's Vercel project**

The clean worktree does not inherit ignored `.vercel/project.json`. Restore only the validated three-field link from private operator state and bind it to the sanitized production baseline before any environment mutation:

```bash
set -euo pipefail
GIT_COMMON_DIR=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
OPERATOR_STATE_DIR="$GIT_COMMON_DIR/codex/v1-modernization"
install -d -m 700 .vercel
install -m 600 "$OPERATOR_STATE_DIR/vercel-project.json" .vercel/project.json
node - <<'NODE'
const link = require('./.vercel/project.json');
const deployment = require('./docs/verification/baselines/core-1.0.0/vercel-deployment.json');
const keys = Object.keys(link).sort();
if (JSON.stringify(keys) !== JSON.stringify(['orgId', 'projectId', 'projectName'])) process.exit(1);
if (link.projectId !== deployment.project.id || link.projectName !== deployment.project.name) process.exit(1);
NODE
git check-ignore -q .vercel/project.json
```

Expected: the ignored local link contains no token and its project ID/name exactly match the sanitizer-approved production deployment. If any assertion fails, stop for explicit project identification; never run interactive `vercel link` in this workflow.

- [ ] **Step 8: Project revocation evidence and remove the inert Vercel credential**

The security prerequisite already revoked the key before Task 0. Re-open the authenticated OpenRouter dashboard and confirm the same non-secret key record remains revoked/disabled; if it is active or cannot be matched, stop immediately. Update only the private verification timestamp, then use the committed sanitizer to project that private record into `docs/verification/containment/openrouter-key-revocation.json`. Never copy a raw provider response or credential value into the worktree. Then remove the now-inert variable from all Vercel scopes and read the names back:

```bash
set -euo pipefail
GIT_COMMON_DIR=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
OPERATOR_STATE_DIR="$GIT_COMMON_DIR/codex/v1-modernization"
node -e "const l=require('./.vercel/project.json'); const d=require('./docs/verification/baselines/core-1.0.0/vercel-deployment.json'); if(l.projectId!==d.project.id||l.projectName!==d.project.name) process.exit(1)"
npx tsx scripts/sanitize-vercel-evidence.ts sanitize-openrouter-revocation --input="$OPERATOR_STATE_DIR/openrouter-key-revocation.raw.json" --output=docs/verification/containment/openrouter-key-revocation.json
npx tsx scripts/sanitize-vercel-evidence.ts verify-safe --input=docs/verification/containment/openrouter-key-revocation.json
node -e "const d=require('./docs/verification/containment/openrouter-key-revocation.json'); if(d.provider!=='OpenRouter'||!['revoked','disabled'].includes(d.status)) process.exit(1)"
npx --yes vercel@55.0.0 env rm OPENROUTER_API_KEY production --yes
npx --yes vercel@55.0.0 env rm OPENROUTER_API_KEY preview --yes
npx --yes vercel@55.0.0 env rm OPENROUTER_API_KEY development --yes
umask 077
EVIDENCE_TMP=$(mktemp -d)
chmod 700 "$EVIDENCE_TMP"
trap 'rm -rf "$EVIDENCE_TMP"' EXIT HUP INT TERM
for scope in production preview development; do
  npx --yes vercel@55.0.0 env ls "$scope" --format=json > "$EVIDENCE_TMP/vercel-env-$scope.raw.json"
  npx tsx scripts/sanitize-vercel-evidence.ts sanitize-env --scope="$scope" --input="$EVIDENCE_TMP/vercel-env-$scope.raw.json" --output="docs/verification/containment/vercel-env-$scope.json"
  npx tsx scripts/sanitize-vercel-evidence.ts verify-safe --input="docs/verification/containment/vercel-env-$scope.json"
  SCOPE="$scope" node -e "const fs=require('node:fs'); const data=JSON.parse(fs.readFileSync('docs/verification/containment/vercel-env-'+process.env.SCOPE+'.json','utf8')); if(data.envs.some(row=>row.key==='OPENROUTER_API_KEY')) process.exit(1)"
done
rm -rf "$EVIDENCE_TMP"
trap - EXIT HUP INT TERM
```

Expected: the committed projection proves the originally identified key remains revoked/disabled, and `OPENROUTER_API_KEY` is absent from all Vercel scopes. This step does not represent the first containment action; it records and completes the already-effective credential containment.

- [ ] **Step 9: Execute the committed Blob containment tool**

The committed `scripts/contain-chatbot-blobs.ts` must:

1. page through the entire `chatbot/` prefix;
2. write a canonical pre-delete inventory containing pathname, URL, size, and upload time to `docs/verification/containment/chatbot-blobs-before.json`;
3. assert that the three known `d70520113a820db7` manifest, chunk, and embedding URLs are present;
4. delete every inventoried URL;
5. relist until the prefix is empty or a bounded retry deadline expires;
6. write the final empty list to `chatbot-blobs-after.json` and fail unless it is `[]`;
7. issue cache-busted GETs to every inventoried URL and fail unless each returns exactly `404`.

The script reads `BLOB_READ_WRITE_TOKEN` from the environment and never prints or persists it. Load the credential into the clean worktree's process without copying or modifying the original `.env.local`, then run:

```bash
npx tsx scripts/contain-chatbot-blobs.ts
npx tsx scripts/contain-chatbot-blobs.ts --execute
```

Expected: every recorded URL returns `404`, the after-inventory is empty, and the three known draft-bearing URLs are explicitly present in the evidence.

- [ ] **Step 10: Deploy the containment commit and read it back**

Use the approved branch/push workflow so Vercel produces a Git-backed deployment with a verifiable source SHA. Never deploy from the dirty original workspace, and do not accept a manual deployment whose source commit cannot be proven.

Capture and verify the deployment rather than merely printing responses:

```bash
EXPECTED_SHA=$(git rev-parse HEAD)
umask 077
EVIDENCE_TMP=$(mktemp -d)
chmod 700 "$EVIDENCE_TMP"
trap 'rm -rf "$EVIDENCE_TMP"' EXIT HUP INT TERM
npx --yes vercel@55.0.0 inspect jetsanchez.com --wait --timeout=5m --format=json > "$EVIDENCE_TMP/vercel-inspect.raw.json"
npx tsx scripts/sanitize-vercel-evidence.ts sanitize-inspect --input="$EVIDENCE_TMP/vercel-inspect.raw.json" --output=docs/verification/containment/vercel-inspect.json
DEPLOYMENT_ID=$(node -e "const d=require('./docs/verification/containment/vercel-inspect.json'); process.stdout.write(d.id)")
npx --yes vercel@55.0.0 api "/v13/deployments/$DEPLOYMENT_ID" --raw > "$EVIDENCE_TMP/vercel-deployment.raw.json"
npx tsx scripts/sanitize-vercel-evidence.ts sanitize-deployment --input="$EVIDENCE_TMP/vercel-deployment.raw.json" --output=docs/verification/containment/vercel-deployment.json
rm -rf "$EVIDENCE_TMP"
trap - EXIT HUP INT TERM
npx tsx scripts/verify-production-containment.ts --origin=https://jetsanchez.com --expected-commit="$EXPECTED_SHA" --deployment=docs/verification/containment/vercel-deployment.json --revocation=docs/verification/containment/openrouter-key-revocation.json --blob-before=docs/verification/containment/chatbot-blobs-before.json --blob-after=docs/verification/containment/chatbot-blobs-after.json --env=docs/verification/containment/vercel-env-production.json --env=docs/verification/containment/vercel-env-preview.json --env=docs/verification/containment/vercel-env-development.json
```

`verify-production-containment.ts` fails unless the deployment is `READY`, targets production, `gitSource.sha` equals `EXPECTED_SHA`, `POST /api/chat` returns exactly `404`, `/chatbot` returns exactly `308` with resolved redirect URL `https://jetsanchez.com/tools/chatbot` for the interim core-`2.0.0` state, every Blob assertion still passes, the revocation record says revoked, and all three environment inventories omit `OPENROUTER_API_KEY`. Construct `result.json` from an explicit schema containing only deployment ID/Git SHA, ready/target state, asserted route status/destination, Blob counts/probe statuses, credential-revoked boolean, environment-name-absence booleans, and UTC verification time; never forward raw responses or headers. Write it to `docs/verification/containment/result.json` and commit the non-secret evidence with explicit paths.

- [ ] **Step 11: Inspect and commit containment evidence**

Run `verify-safe` over every evidence file; do not rely on manual inspection. It must reject credential values, authorization headers, cookies, raw environment/build objects, or local environment contents. Then run:

```bash
for evidence in docs/verification/containment/*.json; do
  npx tsx scripts/sanitize-vercel-evidence.ts verify-safe --input="$evidence"
done
git add docs/verification/containment/openrouter-key-revocation.json docs/verification/containment/chatbot-blobs-before.json docs/verification/containment/chatbot-blobs-after.json docs/verification/containment/vercel-env-production.json docs/verification/containment/vercel-env-preview.json docs/verification/containment/vercel-env-development.json docs/verification/containment/vercel-inspect.json docs/verification/containment/vercel-deployment.json docs/verification/containment/result.json
git commit -m "chore(security): record chatbot containment evidence"
```

### Task 4: Enforce explicit publication and assistant eligibility

**Files:**
- Create: `src/content/policy.ts`
- Create: `tests/unit/content/policy.test.ts`
- Modify: `src/schemas/content.ts`
- Modify tracked content: `src/data/blog/how-to-install-claude-code-cli-2026.mdx`
- Modify tracked content: `src/data/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters.mdx`
- Modify tracked content: `src/data/works/recursive-convergence-hypothesis.mdx`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/blog/index.astro`
- Modify: `src/pages/blog/[slug].astro`
- Modify: `src/pages/works/index.astro`
- Modify: `src/pages/works/[slug].astro`
- Modify: `src/pages/rss.xml.ts`

**Interfaces:**
- Produces: `PublicationStatus`, `isPublished()`, `isAssistantEligible()`.
- Consumes: all Astro collection filters and the later knowledge-package generator.

- [ ] **Step 1: Write failing schema and predicate tests**

Create `tests/unit/content/policy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { blogSchema } from '../../../src/schemas/content';
import { isAssistantEligible, isPublished } from '../../../src/content/policy';

const baseBlog = {
  title: 'Example',
  description: 'Example description',
  pubDate: '2026-07-11',
  tags: [],
};

describe('publication policy', () => {
  it('requires an explicit status', () => {
    expect(blogSchema.safeParse(baseBlog).success).toBe(false);
  });

  it('defaults assistant inclusion to false', () => {
    const parsed = blogSchema.parse({ ...baseBlog, status: 'published' });
    expect(parsed.assistant).toBe(false);
  });

  it('publishes only published entries', () => {
    expect(isPublished({ status: 'published', assistant: false })).toBe(true);
    expect(isPublished({ status: 'draft', assistant: true })).toBe(false);
  });

  it('requires both published and assistant enabled', () => {
    expect(isAssistantEligible({ status: 'published', assistant: true })).toBe(true);
    expect(isAssistantEligible({ status: 'published', assistant: false })).toBe(false);
    expect(isAssistantEligible({ status: 'draft', assistant: true })).toBe(false);
  });
});
```

Run:

```bash
npm run test -- tests/unit/content/policy.test.ts
```

Expected: FAIL because the policy does not exist and status is not required.

- [ ] **Step 2: Implement `src/content/policy.ts`**

```ts
export type PublicationStatus = 'draft' | 'published';

export interface PublicationData {
  status: PublicationStatus;
  assistant?: boolean;
}

export function isPublished(data: PublicationData): boolean {
  return data.status === 'published';
}

export function isAssistantEligible(data: PublicationData): boolean {
  return isPublished(data) && data.assistant === true;
}
```

- [ ] **Step 3: Replace the legacy schema flag**

In `src/schemas/content.ts`, add:

```ts
const publicationFields = {
  status: z.enum(['draft', 'published']),
  assistant: z.boolean().default(false),
};
```

Spread `publicationFields` into both `blogSchema` and `worksSchema`, and remove:

```ts
draft: z.boolean().default(false),
```

- [ ] **Step 4: Migrate tracked content explicitly**

For both tracked blog posts, replace `draft: false` with:

```yaml
status: published
assistant: true
```

For the tracked work, add:

```yaml
status: published
assistant: true
```

The active Codex draft exists only as a user-owned untracked file in the original checkout. Do not edit, copy, parse, build, or stage it. The clean worktree cannot see it, and the production path later proves that deployments originate from the clean tracked commit. If the user eventually chooses to publish or migrate that draft, handle it as a separate content task under the explicit schema.

- [ ] **Step 5: Replace every collection filter**

Import:

```ts
import { isPublished } from '../content/policy';
```

Adjust the relative path per file and use:

```ts
await getCollection('blog', ({ data }) => isPublished(data));
await getCollection('works', ({ data }) => isPublished(data));
```

Apply this to homepage cards, indexes, detail static paths, previous/next navigation, and RSS.

- [ ] **Step 6: Verify public route exclusion**

Run:

```bash
npm run test -- tests/unit/content/policy.test.ts
npm run check
npm run build
test ! -e dist/blog/how-to-install-and-get-started-with-codex-cli-2026/index.html
```

Expected: tests and build pass; no active-draft route is generated.

- [ ] **Step 7: Commit only tracked policy work**

```bash
git add src/content/policy.ts src/schemas/content.ts tests/unit/content/policy.test.ts src/pages/index.astro src/pages/blog/index.astro 'src/pages/blog/[slug].astro' src/pages/works/index.astro 'src/pages/works/[slug].astro' src/pages/rss.xml.ts src/data/blog/how-to-install-claude-code-cli-2026.mdx src/data/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters.mdx src/data/works/recursive-convergence-hypothesis.mdx
git status --short
git commit -m "feat(content)!: require explicit publication status" -m "BREAKING CHANGE: Content authors must use required status and assistant fields instead of draft."
```

Expected before commit: only the explicit paths above are staged; the original checkout's inventory is byte-for-byte unchanged.

### Task 5: Add production content validation and CI

**Files:**
- Create: `src/content/validation.ts`
- Create: `src/content/gitTracking.ts`
- Create: `scripts/verify-content.ts`
- Create: `tests/unit/content/validation.test.ts`
- Create: `tests/integration/content/untrackedBuild.test.ts`
- Create: `.github/workflows/verify.yml`
- Modify: `package.json`
- Modify tracked content: `src/data/works/recursive-convergence-hypothesis.mdx`
- Modify: `docs/superpowers/plans/2026-07-11-v1-modernization.md`

**Interfaces:**
- Produces: `validateContentRecords(records)`, `npm run verify:content`, `npm run verify`.
- Consumes: shared schemas, publication policy, Git tracked-file state.

- [ ] **Step 1: Write failing validation tests**

Create table-driven tests for every approved failure:

- missing `status`;
- unsupported `status`;
- non-boolean explicit `assistant`;
- assistant-enabled draft;
- untracked published entry;
- invalid canonical URL;
- invalid published link URL;
- duplicate canonical ID;
- duplicate canonical URL after URL normalization;
- generated source ID that is missing, ineligible, or untracked.

Also test that an untracked `draft + assistant:false` record is accepted and cannot appear in the returned eligible tracked-source set. Every error assertion includes the repository-relative path and stable rule code.

- [ ] **Step 2: Implement the pure validator**

Create `src/content/validation.ts`:

```ts
export interface ContentValidationRecord {
  path: string;
  tracked: boolean;
  canonicalId: string;
  canonicalUrl: string;
  status: unknown;
  assistant: unknown;
  links: Array<{ label: string; url: unknown }>;
}

export interface ContentPolicyError {
  code:
    | 'missing-status'
    | 'unsupported-status'
    | 'invalid-assistant-flag'
    | 'assistant-not-published'
    | 'published-untracked'
    | 'invalid-canonical-url'
    | 'invalid-link-url'
    | 'duplicate-canonical-id'
    | 'duplicate-canonical-url'
    | 'generated-source-ineligible'
    | 'schema-invalid';
  path: string;
  message: string;
}

export function validateContentRecords(records: ContentValidationRecord[]): ContentPolicyError[];

export function assertGeneratedAssistantSources(
  records: ContentValidationRecord[],
  generatedCanonicalIds: readonly string[],
): ContentPolicyError[];
```

The implementation validates raw publication fields before schema transformation, accepts only absolute `https:` canonical and published-link URLs, normalizes canonical URLs before duplicate comparison, and uses `isPublished()`/`isAssistantEligible()` after the raw fields are proven valid. It fails closed and never silently drops a malformed record.

- [ ] **Step 3: Implement the filesystem/Git adapter**

Create `scripts/verify-content.ts` with a `--root=<absolute-or-relative-path>` option that defaults to the repository root. Every filesystem and Git operation resolves beneath that root; this seam exists for isolated integration testing and does not weaken production defaults. The script:

1. Recursively reads `.md` and `.mdx` files under `src/data/blog` and `src/data/works`.
2. Parses raw frontmatter with `gray-matter`, preserving missing and unsupported values for policy diagnostics.
3. Derives repository-relative path, canonical ID, canonical URL, and every published URL-bearing field, including links, images, repository, and demo values.
4. Calls `loadTrackedContentPaths()` from `src/content/gitTracking.ts`, which runs `git ls-files -z -- src/data/blog src/data/works` once without a shell and fails when Git state is unavailable.
5. Calls `validateContentRecords()` for raw policy, identity, URL, and tracking rules.
6. Parses each otherwise-valid record through the appropriate shared Zod schema and reports Zod issues as path-qualified `schema-invalid` errors.
7. Prints one `<path> [<rule-code>]: <message>` error per line and exits `1` when errors exist.
8. Prints `Content policy verified: <count> entries; <eligible> tracked assistant sources` and exits `0` otherwise.

The main entrypoint must be:

```ts
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
```

- [ ] **Step 4: Correct the published research URLs before enabling the strict gate**

In `recursive-convergence-hypothesis.mdx`, keep only:

```yaml
links:
  - label: "View on SSRN"
    url: "https://doi.org/10.2139/ssrn.5395309"
```

Use the same HTTPS DOI in the citation body:

```text
https://doi.org/10.2139/ssrn.5395309
```

This already-approved correction moves forward from Task 7 because the existing HTTP DOI and placeholder PDF link must not weaken or bypass the strict production URL gate. Task 7 retains its structured-data and SEO work and verifies this correction in the built output, but does not repeat or stage the content edit.

- [ ] **Step 5: Add verification scripts**

Set:

```json
{
  "verify:content": "tsx scripts/verify-content.ts",
  "build": "npm run verify:content && astro build",
  "verify": "npm run check && npm run test && npm run build"
}
```

This makes content verification part of the actual Vercel and local production build, not only an optional CI command. Task 3's static-boundary test must assert that `build` contains `astro build` and contains neither embedding work nor network mutation; it must not require the script to equal a fixed string.

- [ ] **Step 6: Add and run the isolated untracked-build integration test**

Create `tests/integration/content/untrackedBuild.test.ts`. In a `try/finally`, it creates a unique directory with `mkdtemp()`, initializes a Git repository, writes the smallest valid blog/works fixture, stages only those baseline files with `git add --`, then writes an **untracked** `published + assistant:true` MDX entry. No fixture commit or Git identity is required. Invoke `scripts/verify-content.ts --root=<fixture>` in a child process using the repository's pinned `tsx` executable. A test-only wrapper writes an Astro-step sentinel only when that validator exits `0`, matching the production `verify:content && astro build` ordering without a shell; assert exit `1`, the path-qualified `published-untracked` diagnostic, and absence of the sentinel file. Remove the entire fixture directory in `finally`, including after assertion failure. Never copy or read the user's active Codex draft.

Run:

```bash
npm run test -- tests/unit/content/validation.test.ts
npm run test -- tests/integration/content/untrackedBuild.test.ts
npm run verify:content
npm run verify
```

Expected: all pass in the clean worktree; the isolated fixture proves an untracked eligible source stops the production command chain before Astro generation.

- [ ] **Step 7: Add `.github/workflows/verify.yml`**

```yaml
name: Verify

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run verify
```

- [ ] **Step 8: Commit**

```bash
git add src/content/validation.ts src/content/gitTracking.ts scripts/verify-content.ts tests/unit/content/validation.test.ts tests/integration/content/untrackedBuild.test.ts .github/workflows/verify.yml package.json src/data/works/recursive-convergence-hypothesis.mdx docs/superpowers/plans/2026-07-11-v1-modernization.md
git commit -m "ci: enforce production content and build checks"
```

### Task 6: Make navigation configuration canonical and accessible

**Files:**
- Create: `tests/unit/navigation/navigation.test.ts`
- Create: `tests/unit/navigation/LiquidGlassDock.test.tsx`
- Modify: `src/config/site.ts`
- Modify: `src/components/navigation/LiquidGlassDock.tsx`
- Modify: `src/components/layout/BaseLayout.astro`

**Interfaces:**
- Produces: one `NAV_ITEMS` route source and `isActiveNavItem(path, href)`.
- Consumes: dock rendering, JSON-LD navigation, no-script navigation.

- [ ] **Step 1: Write failing navigation tests**

Create `tests/unit/navigation/navigation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isActiveNavItem, NAV_ITEMS } from '../../../src/config/site';

describe('navigation', () => {
  it('keeps unique ids and routes', () => {
    expect(new Set(NAV_ITEMS.map((item) => item.id)).size).toBe(NAV_ITEMS.length);
    expect(new Set(NAV_ITEMS.map((item) => item.href)).size).toBe(NAV_ITEMS.length);
  });

  it('matches nested routes without matching home globally', () => {
    expect(isActiveNavItem('/blog/post', '/blog')).toBe(true);
    expect(isActiveNavItem('/about', '/')).toBe(false);
    expect(isActiveNavItem('/', '/')).toBe(true);
  });
});
```

- [ ] **Step 2: Extend the canonical navigation records**

Each `NAV_ITEMS` record in `src/config/site.ts` must include its current gradient. Add:

```ts
export function isActiveNavItem(currentPath: string, href: string): boolean {
  return currentPath === href || (href !== '/' && currentPath.startsWith(`${href}/`));
}
```

Preserve the existing Tools item during core `2.0.0`; it remains the interim route to the noindexed prototype. Task 10 converts all canonical `NAV_ITEMS` HTML hrefs to trailing-slash form and updates active matching as part of the site-wide contract. The companion `2.1.0` plan replaces that same record with Ghost pointing to `/chatbot/`, so the dock item count does not grow.

- [ ] **Step 3: Remove the local dock array**

In `LiquidGlassDock.tsx`, import:

```ts
import { isActiveNavItem, NAV_ITEMS } from '../../config/site';
```

Delete the component-local `navItems` declaration, map `NAV_ITEMS`, and calculate:

```ts
const isActive = isActiveNavItem(currentPath, item.href);
```

On each navigation link add:

```tsx
aria-current={isActive ? 'page' : undefined}
aria-label={item.label}
```

Add a semantic-token focus ring class:

```text
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-base focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base rounded-xl
```

Give the dock container `id="site-navigation-dock"`. On the mobile disclosure button add:

```tsx
aria-expanded={dockVisible}
aria-controls="site-navigation-dock"
```

The closed mobile dock must not remain an invisible tab stop. When the mobile layout is active and `dockVisible` is false, set `inert`, `aria-hidden="true"`, and the existing pointer-events/visual closed state on the controlled dock (or conditionally omit its interactive descendants). Opening removes `inert`/`aria-hidden`. Closing from the dock restores focus to the disclosure button; closing because the viewport leaves mobile mode clears the mobile-only attributes. The disclosure has an accessible name of `Open navigation` while closed and `Close navigation` while open.

Create `tests/unit/navigation/LiquidGlassDock.test.tsx` with mocked viewport/scroll state. Prove the disclosure is initially discoverable only after the existing mobile scroll threshold, the closed dock is inert and hidden, its links are excluded from sequential focus, opening exposes the dock, and closing restores disclosure focus.

- [ ] **Step 4: Generate BaseLayout navigation from `NAV_ITEMS`**

Import `NAV_ITEMS` alongside `SITE`. Generate structured-data entries:

```ts
const navigationElements = NAV_ITEMS.map((item) => ({
  name: item.label,
  url: new URL(item.href, SITE.siteUrl).toString(),
}));
```

Use the same collection for the no-script `<li>` elements.

- [ ] **Step 5: Verify**

Run:

```bash
npm run test -- tests/unit/navigation/navigation.test.ts
npm run test -- tests/unit/navigation/LiquidGlassDock.test.tsx
npm run check
npm run build
```

Expected: all pass and `NAV_ITEMS` appears only in `src/config/site.ts` as a declaration.

- [ ] **Step 6: Commit**

```bash
git add src/config/site.ts src/components/navigation/LiquidGlassDock.tsx src/components/layout/BaseLayout.astro tests/unit/navigation/navigation.test.ts tests/unit/navigation/LiquidGlassDock.test.tsx
git commit -m "refactor(navigation): centralize route configuration"
```

### Task 7: Correct typed structured metadata

**Files:**
- Create: `src/utils/structuredData.ts`
- Create: `tests/unit/seo/structuredData.test.ts`
- Modify: `src/components/seo/StructuredData.astro`
- Modify: `src/components/seo/SEO.astro`

**Interfaces:**
- Produces: `buildStructuredData(props)` returning JSON-safe typed data.
- Consumes: existing `StructuredData.astro` props and all page layouts.

- [ ] **Step 1: Write failing metadata tests**

Create `tests/unit/seo/structuredData.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildStructuredData } from '../../../src/utils/structuredData';

describe('structured data', () => {
  it('links a scholarly article to its canonical webpage', () => {
    const schema = buildStructuredData({
      type: 'scholarlyarticle',
      id: 'https://jetsanchez.com/works/rch/#scholarlyarticle',
      url: 'https://jetsanchez.com/works/rch/',
      headline: 'RCH',
      description: 'Research description',
      datePublished: '2025-08-27T00:00:00.000Z',
      tags: ['AI'],
    });
    expect(schema['@type']).toBe('ScholarlyArticle');
    expect(schema.mainEntityOfPage).toEqual({
      '@type': 'WebPage',
      '@id': 'https://jetsanchez.com/works/rch/#webpage',
    });
  });
});
```

Before implementation, add a valid typed fixture for each discriminant—`website`, `blogposting`, `person`, `navigation`, `webpage`, `software`, `scholarlyarticle`, and `creativework`. A table-driven test snapshots each complete JSON shape, verifies `JSON.stringify`/`JSON.parse` succeeds, and asserts the expected `@type`. Keep the scholarly-article entity-link assertion above as a focused regression. All eight tests must fail or be impossible to type until the exhaustive builder exists.

- [ ] **Step 2: Move schema construction into a typed utility**

Create `src/utils/structuredData.ts` with:

```ts
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonLd = { '@context': 'https://schema.org'; '@type': string; [key: string]: JsonValue };
```

Define `StructuredDataProps` as a discriminated union keyed by `type`. Move every existing object-construction branch from `StructuredData.astro` into the new utility without changing its JSON shape. Initialize the result as `JsonLd`, return it after the exhaustive switch, and use an exhaustive `never` assertion in the default branch so a new schema type cannot compile without a builder.

```ts
function assertNever(value: never): never {
  throw new Error(`Unsupported structured-data type: ${String(value)}`);
}

export function buildStructuredData(props: StructuredDataProps): JsonLd {
  switch (props.type) {
    case 'website':
      return buildWebsiteSchema(props);
    case 'blogposting':
      return buildBlogPostingSchema(props);
    case 'person':
      return buildPersonSchema(props);
    case 'navigation':
      return buildNavigationSchema(props);
    case 'webpage':
      return buildWebPageSchema(props);
    case 'software':
      return buildSoftwareSchema(props);
    case 'scholarlyarticle':
      return buildScholarlyArticleSchema(props);
    case 'creativework':
      return buildCreativeWorkSchema(props);
    default:
      return assertNever(props);
  }
}
```

Define each named helper in the same file with an `Extract<StructuredDataProps, { type: 'type-name' }>` parameter and the corresponding existing branch body. Do not introduce `any`.

`StructuredData.astro` becomes a thin renderer:

```astro
---
import { buildStructuredData, type StructuredDataProps } from '../../utils/structuredData';
type Props = StructuredDataProps;
const schema = buildStructuredData(Astro.props);
---
<script is:inline type="application/ld+json" set:html={JSON.stringify(schema)} />
```

- [ ] **Step 3: Remove the invalid Twitter creator derivation**

Delete this line from `SEO.astro`:

```astro
{SITE.author && <meta name="twitter:creator" content={`@${SITE.author}`} />}
```

Do not add a replacement until a real handle is configured.

- [ ] **Step 4: Verify**

Run:

```bash
npm run test -- tests/unit/seo/structuredData.test.ts
npm run check
npm run build
rg -n "https://doi.org/10.2139/ssrn.5395309" dist/works/recursive-convergence-hypothesis/index.html
if rg -n "Download PDF|twitter:creator|http://dx.doi.org" dist; then exit 1; fi
```

Expected: the DOI appears; obsolete metadata does not.

- [ ] **Step 5: Commit**

```bash
git add src/utils/structuredData.ts src/components/seo/StructuredData.astro src/components/seo/SEO.astro tests/unit/seo/structuredData.test.ts
git commit -m "fix(seo): correct research and structured metadata"
```

### Task 8: Add reduced-motion control to Grainient

**Files:**
- Create: `src/utils/grainientLifecycle.ts`
- Create: `tests/unit/ui/grainientLifecycle.test.ts`
- Create: `tests/unit/ui/Grainient.test.tsx`
- Modify: `src/components/ui/Grainient.tsx`

**Interfaces:**
- Produces: `shouldRunGrainient(state)` and `getGrainientRendererAction(previous, next)`.
- Consumes: inherited PR #15 lifecycle behavior from `c423ffa`, hidden state, viewport state, and reduced-motion state.

- [ ] **Step 0: Prove the approved baseline already contains PR #15**

Before modifying `Grainient.tsx`, bind the check to Task 0's approved implementation baseline:

```bash
set -euo pipefail
GIT_COMMON_DIR=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
APPROVED_SHA=$(cat "$GIT_COMMON_DIR/codex/v1-modernization/approved-sha.txt")
git cat-file -e "${APPROVED_SHA}^{commit}"
git cat-file -e c423ffa^{commit}
git merge-base --is-ancestor "$APPROVED_SHA" HEAD
git merge-base --is-ancestor c423ffa "$APPROVED_SHA"
git diff --exit-code "$APPROVED_SHA" -- src/components/ui/Grainient.tsx
rg -n "targetFps = 24|IntersectionObserver|visibilitychange" src/components/ui/Grainient.tsx
```

Expected: every command passes, proving the clean implementation lineage already contains `c423ffa` through PR #15 and Tasks 1–7 have not altered `Grainient.tsx`. Preserve that implementation and add only reduced-motion lifecycle behavior. If either ancestry assertion fails, stop Task 8: reconcile PR #15 in a separate reviewed commit and rerun this preflight before writing reduced-motion code. Do not manually recreate, cherry-pick blindly over a changed file, or replace the inherited 24fps and visibility-pause logic.

- [ ] **Step 1: Write the failing lifecycle test**

Create `tests/unit/ui/grainientLifecycle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { shouldRunGrainient } from '../../../src/utils/grainientLifecycle';

describe('Grainient lifecycle', () => {
  it.each([
    [{ documentHidden: true, inViewport: true, reducedMotion: false }, false],
    [{ documentHidden: false, inViewport: false, reducedMotion: false }, false],
    [{ documentHidden: false, inViewport: true, reducedMotion: true }, false],
    [{ documentHidden: false, inViewport: true, reducedMotion: false }, true],
  ] as const)('returns the expected loop state', (state, expected) => {
    expect(shouldRunGrainient(state)).toBe(expected);
  });
});
```

- [ ] **Step 2: Implement the pure decision**

Create `src/utils/grainientLifecycle.ts`:

```ts
export interface GrainientLifecycleState {
  documentHidden: boolean;
  inViewport: boolean;
  reducedMotion: boolean;
}

export function shouldRunGrainient(state: GrainientLifecycleState): boolean {
  return !state.documentHidden && state.inViewport && !state.reducedMotion;
}
```

Also implement a pure renderer-transition decision with actions `initialize`, `start-loop`, `stop-loop`, `dispose`, and `none`. Tests must cover initial reduced/non-reduced states, `reduce -> no-preference`, `no-preference -> reduce`, hidden/visible, offscreen/onscreen, and combinations that must never schedule RAF.

- [ ] **Step 3: Integrate a live reduced-motion query**

In `Grainient.tsx`, create and subscribe to:

```ts
const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = mediaQuery.matches;

const handleReducedMotionChange = (event: MediaQueryListEvent) => {
  reducedMotion = event.matches;
  updateLoopState();
};

mediaQuery.addEventListener('change', handleReducedMotionChange);
```

Replace `canRun()` with one reconciliation function driven by `getGrainientRendererAction()`. When reduced motion is active before renderer creation, render the existing plain hero fallback and create no renderer. When the preference changes to `no-preference`, initialize exactly one renderer only when mounted and visible; if it is hidden/offscreen, defer initialization until eligible. When the preference changes to `reduce`, cancel RAF, detach and dispose the renderer/canvas and GPU resources, and restore the fallback. Hidden/offscreen transitions stop or restart the existing renderer without bypassing reduced motion. Remove the media-query listener and dispose resources during cleanup.

Preserve the deployed 24fps frame interval and IntersectionObserver behavior.

In `Grainient.test.tsx`, inject or mock the renderer factory, `matchMedia`, `IntersectionObserver`, and RAF. Assert exact factory, dispose, and RAF call counts for both live preference directions, visibility changes, viewport changes, and unmount. No test may infer lifecycle solely from canvas presence.

- [ ] **Step 4: Verify**

Run:

```bash
npm run test -- tests/unit/ui/grainientLifecycle.test.ts
npm run test -- tests/unit/ui/Grainient.test.tsx
npm run check
npm run build
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/grainientLifecycle.ts src/components/ui/Grainient.tsx tests/unit/ui/grainientLifecycle.test.ts tests/unit/ui/Grainient.test.tsx
git commit -m "fix(a11y): respect reduced motion in Grainient"
```

### Task 9: Remove the retired RAG implementation and dependencies

**Files:**
- Delete: `scripts/build-embeddings.ts`
- Delete: `scripts/content-loader.ts`
- Delete: `src/components/chatbot/`
- Delete: `src/hooks/useChatbot.ts`
- Delete: `src/services/generation.ts`
- Delete: `src/services/initialization.ts`
- Delete: `src/services/retrieval.ts`
- Delete: `src/services/rrf.ts`
- Delete: `src/stores/chatbot.ts`
- Delete: `src/types/chatbot.ts`
- Delete: `src/utils/artifact-loader.ts`
- Delete: `src/utils/chunking.ts`
- Delete: `src/utils/fp16.ts`
- Delete: `src/utils/retry.ts`
- Delete: `src/workers/retrieval.worker.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: no active imports or dependencies from the retired chatbot.
- Consumes: Git history and historical documents as the preservation mechanism.

This cleanup targets only the retired RAG/runtime paths listed below. Preserve `src/features/jets-ghost/JetsGhostExperience.tsx`, `src/features/jets-ghost/experience.ts`, `src/pages/tools/chatbot.astro`, and `tests/jets-ghost-experience.test.ts`; they are the approved `2.1.0` interface prototype and handoff seam.

- [ ] **Step 1: Prove the old runtime is unreachable**

Run:

```bash
rg -n "components/chatbot|useChatbot|services/(generation|initialization|retrieval|rrf)|artifact-loader|retrieval.worker|types/chatbot" src --glob '!src/components/chatbot/**' --glob '!src/hooks/useChatbot.ts' --glob '!src/services/**' --glob '!src/stores/chatbot.ts' --glob '!src/types/chatbot.ts' --glob '!src/utils/artifact-loader.ts' --glob '!src/workers/**'
```

Expected: no output.

- [ ] **Step 2: Delete retired files with explicit paths**

Run the following only after the import audit is empty:

```bash
git rm scripts/build-embeddings.ts scripts/content-loader.ts src/hooks/useChatbot.ts src/services/generation.ts src/services/initialization.ts src/services/retrieval.ts src/services/rrf.ts src/stores/chatbot.ts src/types/chatbot.ts src/utils/artifact-loader.ts src/utils/chunking.ts src/utils/fp16.ts src/utils/retry.ts src/workers/retrieval.worker.ts
git rm -r src/components/chatbot
```

Do not delete the historical design documents.

- [ ] **Step 3: Remove dependencies used only by the retired runtime**

Run:

```bash
npm uninstall @huggingface/transformers @petamoriken/float16 idb minisearch zustand
```

Keep `gray-matter` for `verify-content`, `@vercel/blob` for explicit image uploads, `framer-motion` for the dock, and `ogl` for Grainient.

- [ ] **Step 4: Verify no stale imports or packages remain**

Run:

```bash
npm run verify
if rg -n "@huggingface/transformers|@petamoriken/float16|from 'idb'|from 'minisearch'|from 'zustand'" src scripts; then exit 1; fi
```

Expected: verification passes and the import scan is empty.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "refactor(chatbot): remove retired RAG runtime"
```

### Task 10: Add browser regression and accessibility coverage

**Files:**
- Create: `tests/unit/seo/canonicalURL.test.ts`
- Create: `tests/e2e/site.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `tests/deployment/core-production.spec.ts`
- Create: `playwright.production.config.ts`
- Modify: `astro.config.mjs`
- Modify: `vercel.json`
- Modify: `src/utils/seo.ts`
- Modify: `src/config/site.ts`
- Modify: `tests/unit/navigation/navigation.test.ts`
- Modify: `tests/unit/ops/productionContainment.test.ts`
- Modify: `scripts/verify-production-containment.ts`
- Modify: `.github/workflows/verify.yml`
- Modify: `package.json`

**Interfaces:**
- Produces: one trailing-slash canonical contract for human-facing HTML plus route, redirect, theme, metadata, sitemap/RSS exclusion, keyboard, mobile-disclosure, and axe verification.
- Consumes: built static output through `playwright.config.ts` and deployed production through `playwright.production.config.ts`.

- [ ] **Step 1: Install the Playwright browser**

Run:

```bash
npx playwright install chromium
```

- [ ] **Step 2: Implement and unit-test the site-wide canonical contract**

Create `tests/unit/seo/canonicalURL.test.ts` before changing implementation. Require these exact results:

```ts
expect(getCanonicalURL('/')).toBe('https://jetsanchez.com/');
expect(getCanonicalURL('/about')).toBe('https://jetsanchez.com/about/');
expect(getCanonicalURL('/about/')).toBe('https://jetsanchez.com/about/');
expect(getCanonicalURL('/blog/example///')).toBe('https://jetsanchez.com/blog/example/');
expect(getCanonicalURL('/rss.xml')).toBe('https://jetsanchez.com/rss.xml');
expect(getCanonicalURL('/robots.txt')).toBe('https://jetsanchez.com/robots.txt');
expect(getCanonicalURL('/sitemap-index.xml')).toBe('https://jetsanchez.com/sitemap-index.xml');
expect(getCanonicalURL('/assistant/runtime/litert-lm/0.14.0/runtime.wasm')).toBe(
  'https://jetsanchez.com/assistant/runtime/litert-lm/0.14.0/runtime.wasm',
);
expect(getCanonicalURL('/api/chat')).toBe('https://jetsanchez.com/api/chat');
```

Update `getCanonicalURL()` so it constructs a URL against `SITE.siteUrl`, strips query/hash state, keeps `/` stable, preserves `/api/` paths and extension-bearing final path segments, and otherwise removes repeated terminal slashes before appending exactly one `/`. This utility owns emitted canonical URL shape; it does not rewrite fetch or API request paths.

Add `trailingSlash: 'always'` beside `site` in `astro.config.mjs`; this makes Astro emit directory-style HTML routes. Merge `"trailingSlash": true` at the top level of the existing `vercel.json`; this makes Vercel normalize incoming human-facing paths. Preserve the interim `/chatbot` redirect direction while changing its Task 3 destination from `/tools/chatbot` to `/tools/chatbot/`; this is canonical normalization, not the Ghost route reversal. Change neither `/api/chat` nor the extension-bearing machine endpoints. Keep the existing `$schema` and redirect array intact.

Convert every human-facing `NAV_ITEMS` href to trailing-slash form, except `/`. Update `isActiveNavItem()` to normalize both arguments to one trailing slash before comparing and to match descendants only for non-root items. Extend `tests/unit/navigation/navigation.test.ts` with exact root, exact section, slashless current-path, trailing-slash current-path, nested-route, and `/toolshed/` non-match cases.

Run the focused red/green gate:

```bash
npm run test -- tests/unit/seo/canonicalURL.test.ts tests/unit/navigation/navigation.test.ts
```

- [ ] **Step 3: Create route and correctness tests**

Create `tests/e2e/site.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const routes = [
  '/',
  '/about/',
  '/blog/',
  '/blog/how-to-install-claude-code-cli-2026/',
  '/works/',
  '/works/recursive-convergence-hypothesis/',
  '/tools/',
  '/contact/',
];

for (const route of routes) {
  test(`${route} renders one main heading`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('h1')).toHaveCount(1);
    const expected = new URL(route, 'https://jetsanchez.com').toString();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', expected);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', expected);
  });
}

test('research exposes one DOI-backed action', async ({ page }) => {
  await page.goto('/works/recursive-convergence-hypothesis/');
  const action = page.getByRole('link', { name: 'View on SSRN' });
  await expect(action).toHaveAttribute('href', 'https://doi.org/10.2139/ssrn.5395309');
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveCount(0);
});

test('theme choice persists across navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /switch to dark mode/i }).click();
  await page.goto('/about/');
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('machine-readable routes are available', async ({ request }) => {
  const rss = await request.get('/rss.xml');
  expect(rss.ok()).toBe(true);
  expect(await rss.text()).toContain('<rss');
  expect((await request.get('/robots.txt')).ok()).toBe(true);
  const sitemapIndex = await request.get('/sitemap-index.xml');
  const sitemapPage = await request.get('/sitemap-0.xml');
  expect(sitemapIndex.ok() || sitemapPage.ok()).toBe(true);
});

test('about metadata and sitemap use one canonical URL', async ({ page, request }) => {
  const canonical = 'https://jetsanchez.com/about/';
  await page.goto('/about/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  const serialized = schemas.map((schema) => JSON.stringify(JSON.parse(schema))).join('\n');
  expect(serialized).toContain(`${canonical}#webpage`);
  expect(serialized).toContain(`"url":"${canonical}"`);
  const sitemap = await request.get('/sitemap-0.xml');
  const matches = (await sitemap.text()).match(/https:\/\/jetsanchez\.com\/about\//g) ?? [];
  expect(matches).toHaveLength(1);
});

test('retired routes stay retired and out of feeds', async ({ request }) => {
  for (const route of ['/blog/the-future-of-ai/', '/blog/building-with-astro/']) {
    expect((await request.get(route)).status()).toBe(404);
  }
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  const rss = await (await request.get('/rss.xml')).text();
  for (const slug of ['the-future-of-ai', 'building-with-astro']) {
    expect(sitemap).not.toContain(slug);
    expect(rss).not.toContain(slug);
  }
});

test('content pages expose parseable typed JSON-LD', async ({ page }) => {
  await page.goto('/works/recursive-convergence-hypothesis/');
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  const parsed = schemas.map((schema) => JSON.parse(schema) as { '@type'?: string });
  expect(parsed.some((schema) => schema['@type'] === 'ScholarlyArticle')).toBe(true);
});

test('draft routes are absent', async ({ request }) => {
  const response = await request.get('/blog/how-to-install-and-get-started-with-codex-cli-2026/');
  expect(response.status()).toBe(404);
});

test('nested routes mark the canonical navigation item active', async ({ page }) => {
  await page.goto('/blog/how-to-install-claude-code-cli-2026/');
  await expect(page.getByRole('link', { name: 'Blog', exact: true })).toHaveAttribute('aria-current', 'page');
});
```

Create `playwright.production.config.ts` with `testDir: './tests/deployment'`, no `webServer`, one Chromium project, and `baseURL: process.env.PRODUCTION_ORIGIN ?? 'https://jetsanchez.com'`. In `core-production.spec.ts`, use requests with `maxRedirects: 0` to require `POST /api/chat === 404`, the interim core-`2.0.0` `GET /chatbot === 308` with exact `location === '/tools/chatbot/'`, and `GET /about === 308` with exact `location === '/about/'`. Then require `/about/ === 200`, no `noindex`, exact canonical/`og:url`/WebPage URL and ID, and exactly one sitemap membership. Require both canonical retired paths to return exact `404`, never a redirect, and remain absent from sitemap/RSS. Also assert `/rss.xml`, `/robots.txt`, and one sitemap XML endpoint respond without an appended slash. The companion Jet's Ghost route-integration task intentionally updates only the chatbot matrix when the redirect is reversed.

Update `tests/unit/ops/productionContainment.test.ts` and `scripts/verify-production-containment.ts` so the core containment verifier expects resolved interim destination `https://jetsanchez.com/tools/chatbot/`; keep every existing deployment-SHA, Blob, credential, environment, and `/api/chat` assertion.

- [ ] **Step 4: Create accessibility tests**

Create `tests/e2e/accessibility.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const route of ['/', '/blog/', '/works/', '/tools/chatbot/']) {
  test(`${route} has no serious axe violations`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    const serious = results.violations.filter((violation) =>
      violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious).toEqual([]);
  });
}

test('dock is keyboard navigable', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus-visible')).toBeVisible();
});

test('reduced motion does not run Grainient animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('mobile disclosure exposes and restores controlled state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, 160));
  const disclosure = page.locator('button[aria-controls="site-navigation-dock"]');
  await expect(disclosure).toBeVisible();
  await expect(disclosure).toHaveAccessibleName('Open navigation');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  const controlledId = await disclosure.getAttribute('aria-controls');
  if (!controlledId) throw new Error('Navigation disclosure lacks aria-controls');
  const dock = page.locator(`#${controlledId}`);
  await expect(dock).toHaveAttribute('inert', '');
  await expect(dock).toHaveAttribute('aria-hidden', 'true');
  await expect(dock.locator('a').first()).not.toBeFocused();
  await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(disclosure).toHaveAccessibleName('Close navigation');
  await expect(dock).not.toHaveAttribute('inert', '');
  await expect(dock).not.toHaveAttribute('aria-hidden', 'true');
  await expect(dock).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(dock.locator(':focus-visible')).toBeVisible();
  await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await expect(disclosure).toHaveAccessibleName('Open navigation');
  await expect(disclosure).toBeFocused();
  await expect(dock).toHaveAttribute('inert', '');
  await page.keyboard.press('Tab');
  await expect(dock.locator(':focus')).toHaveCount(0);
});
```

Color contrast remains a separate manual/browser check because the WebGL background makes automated sampling unreliable; do not claim it passed axe.

- [ ] **Step 5: Add browser verification to the full command**

Set:

```json
{
  "verify:browser": "playwright test",
  "verify:production": "playwright test --config=playwright.production.config.ts",
  "verify:all": "npm run verify && npm run verify:browser"
}
```

Keep routine `verify` browser-free for fast local and Vercel builds; CI adds a separate browser job.

- [ ] **Step 6: Add an executable browser job to `.github/workflows/verify.yml`**

The completed workflow contains this second job:

```yaml
  browser:
    needs: verify
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run verify:browser
```

The production deployment suite is not run against the old production alias in pull-request CI. It is a required postdeployment gate in Task 12 and fails on any status or destination mismatch.

- [ ] **Step 7: Run and commit**

```bash
npm run test:e2e
if rg -n '/blog/(the-future-of-ai|building-with-astro)/?' src; then exit 1; fi
git add astro.config.mjs vercel.json src/utils/seo.ts src/config/site.ts tests/unit/seo/canonicalURL.test.ts tests/unit/navigation/navigation.test.ts tests/unit/ops/productionContainment.test.ts scripts/verify-production-containment.ts tests/e2e/site.spec.ts tests/e2e/accessibility.spec.ts tests/deployment/core-production.spec.ts playwright.production.config.ts package.json .github/workflows/verify.yml
git commit -m "fix(seo): align canonical route identities"
```

### Task 11: Make documentation canonical and rewrite the README

**Files:**
- Rewrite: `README.md`
- Modify: `AGENTS.md`
- Create: `docs/archive/README.md`
- Create: `docs/archive/archive-manifest.json`
- Create: `scripts/archive-legacy-docs.ts`
- Create: `scripts/verify-doc-links.ts`
- Create: `tests/unit/ops/archiveLegacyDocs.test.ts`
- Create: `tests/unit/ops/docLinks.test.ts`
- Move tracked: `docs/project-spec.md` -> `docs/archive/site/project-spec-v1.md`
- Move tracked: `docs/project-spec-v2.md` -> `docs/archive/site/project-spec-v2.md`
- Move tracked: `docs/v2-migration-log.md` -> `docs/archive/site/v2-migration-log.md`
- Move tracked: `docs/implementation-log.md` -> `docs/archive/site/implementation-logs/site-launch.md`
- Move tracked: `docs/liquid-glass-dock-v1-log.md` -> `docs/archive/site/implementation-logs/liquid-glass-dock-v1.md`
- Move tracked RAG docs into: `docs/archive/jets-ghost/legacy-rag/`
- Adopt authorized untracked historical docs into: `docs/archive/jets-ghost/legacy-rag/`
- Adopt authorized untracked dock log into: `docs/archive/site/implementation-logs/liquid-glass-dock-v2.md`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: one canonical architecture path and accurate public contributor documentation.
- Consumes: implemented commands and approved Superpowers designs.

- [ ] **Step 1: Write the professional README**

Use exactly these top-level sections:

```markdown
# jetsanchez.com

Personal website, writing archive, research portfolio, and local-first AI experiments for Jet Sanchez.

Production: [jetsanchez.com](https://jetsanchez.com)

## Architecture
## Requirements
## Development
## Verification
## Content
## Images
## Jet's Ghost
## Deployment
## Documentation
```

Requirements state Node 24 and npm. The command table contains only commands present in `package.json`. Content examples use:

```yaml
status: draft
assistant: false
```

and explain that publication requires `status: published`, while assistant inclusion additionally requires `assistant: true`.

Remove emoji, badges, “perfect performance,” hard-coded Lighthouse metrics, generic cloning tutorials, stale `src/content` paths, and unsupported bundle-size claims.

- [ ] **Step 2: Update `AGENTS.md` to the implemented truth**

Update commands, content fields, static deployment, test locations, pure-build rule, Jet's Ghost status, its approved interface source, the interim core route state and final `2.1.0` route direction, canonical specs, and versioning rules. Remove references to `draft?: boolean`, server OpenRouter generation, v2 as target, and Claude attribution.

- [ ] **Step 3: Move tracked legacy documents into a real archive**

Create the target directories, then use explicit `git mv` commands for the tracked v1/v2 specifications, migration/launch logs, Liquid Glass v1 log, and these RAG records:

```text
docs/rag-chatbot-architecture.md
docs/rag-chatbot-implementation-plan.md
docs/rag-chatbot-implementation-log.md
```

Place site history under `docs/archive/site/` and RAG history under `docs/archive/jets-ghost/legacy-rag/`. Do not move `docs/image-workflow.md` or either active Superpowers design/plan.

```bash
mkdir -p docs/archive/site/implementation-logs docs/archive/jets-ghost/legacy-rag
git mv docs/project-spec.md docs/archive/site/project-spec-v1.md
git mv docs/project-spec-v2.md docs/archive/site/project-spec-v2.md
git mv docs/v2-migration-log.md docs/archive/site/v2-migration-log.md
git mv docs/implementation-log.md docs/archive/site/implementation-logs/site-launch.md
git mv docs/liquid-glass-dock-v1-log.md docs/archive/site/implementation-logs/liquid-glass-dock-v1.md
git mv docs/rag-chatbot-architecture.md docs/archive/jets-ghost/legacy-rag/rag-chatbot-architecture.md
git mv docs/rag-chatbot-implementation-plan.md docs/archive/jets-ghost/legacy-rag/rag-chatbot-implementation-plan.md
git mv docs/rag-chatbot-implementation-log.md docs/archive/jets-ghost/legacy-rag/rag-chatbot-implementation-log.md
```

- [ ] **Step 4: Adopt only the explicitly authorized untracked historical documents**

Create `scripts/archive-legacy-docs.ts` with an exact source-to-destination map for:

```text
EMBEDDING_STORAGE_RESEARCH.md
  -> docs/archive/jets-ghost/legacy-rag/embedding-storage-research.md
docs/jets-ghost-v1.5-spec.md
  -> docs/archive/jets-ghost/legacy-rag/jets-ghost-v1.5-spec.md
docs/rag-chatbot-implementation-review.md
  -> docs/archive/jets-ghost/legacy-rag/rag-chatbot-implementation-review.md
docs/liquid-glass-dock-v2-log.md
  -> docs/archive/site/implementation-logs/liquid-glass-dock-v2.md
```

The script reads those files from the inventoried original checkout, verifies each against the private `$OPERATOR_STATE_DIR/authorized-archive-source-hashes.txt`, refuses symlinks or changed/missing sources, copies its substantive body, prepends the correct historical/superseded banner and active-successor link, and writes source/archived SHA-256 values to `docs/archive/archive-manifest.json`. It also verifies that those four path/hash pairs match the committed non-identifying attestation. Verify mode removes only the exact generated banner before hashing the archived body and requires it to equal the recorded source hash. The script never reads or copies the active Codex article, EmDash Newsroom exercise, Page Analyzer spec, or Schema Visualizer spec.

The same exact map owns a later `--cleanup --release-ref=<tag>` mode; there is no standalone `rm` workflow. Cleanup first performs every check without mutation: all four sources are regular untracked files with the recorded hashes, all four archived bodies match, the tag is annotated and contains the archived paths, the commit that introduced `archive-manifest.json` is an ancestor of the tag, and the current original-worktree porcelain inventory exactly matches the Task 0 inventory. It then removes only the four mapped sources, proves the new inventory equals the original inventory minus exactly those four records, and reports the removed paths. Use private byte backups and restore all four on any unlink/postcondition failure so a partial cleanup is not accepted.

Test the archive script through injected filesystem/Git adapters in `tests/unit/ops/archiveLegacyDocs.test.ts`. Cover exact-map creation and verification, source-hash drift, archived-body drift, symlinks, missing/unexpected files, a release ref that does not contain the archive commit, a pre-cleanup inventory mismatch, successful removal of exactly four paths, and rollback after an injected unlink/postcondition failure.

Recover `ORIGINAL_ROOT` from the private `original-root.txt`, assert it is an absolute Git worktree path, and pass the private source-hash and NUL-delimited inventory paths explicitly to the script. Validate the committed attestation against those private inputs before create or verify mode. Do not delete the original untracked copies yet; cleanup occurs only after the archive commit is integrated.

```bash
GIT_COMMON_DIR=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
OPERATOR_STATE_DIR="$GIT_COMMON_DIR/codex/v1-modernization"
ORIGINAL_ROOT=$(cat "$OPERATOR_STATE_DIR/original-root.txt")
test -n "$ORIGINAL_ROOT" && test "${ORIGINAL_ROOT#/}" != "$ORIGINAL_ROOT"
npx tsx scripts/archive-legacy-docs.ts --create --source-root="$ORIGINAL_ROOT" --source-hashes="$OPERATOR_STATE_DIR/authorized-archive-source-hashes.txt" --inventory="$OPERATOR_STATE_DIR/original-status.z" --attestation=docs/verification/baselines/core-1.0.0/operator-state-attestation.json
npx tsx scripts/archive-legacy-docs.ts --verify --source-root="$ORIGINAL_ROOT" --source-hashes="$OPERATOR_STATE_DIR/authorized-archive-source-hashes.txt" --inventory="$OPERATOR_STATE_DIR/original-status.z" --attestation=docs/verification/baselines/core-1.0.0/operator-state-attestation.json
```

- [ ] **Step 5: Index the archive and repair references**

`docs/archive/README.md` lists every archived path, original path, reason/status, date, and canonical successor. Add a visible banner with a correct relative successor link to every moved tracked document. Update README, AGENTS, both active Superpowers designs, both active Superpowers plans, and all remaining live links so no canonical documentation points at an obsolete path.

Install the parser dependencies as exact regular dependencies because both the checked-in verification script and the later corpus builder use them:

```bash
npm install --save-exact unified@11.0.5 remark-parse@11.0.0 remark-gfm@4.0.1 unist-util-visit@5.0.0
```

Then create `scripts/verify-doc-links.ts` and `tests/unit/ops/docLinks.test.ts`. The verifier obtains tracked Markdown with `git ls-files -z -- '*.md'`, scans every non-archive document plus `docs/archive/README.md`, and uses a Markdown syntax tree to inspect actual link/image nodes—never regex over prose. It therefore ignores fenced code, inline code, and plain path examples. For relative destinations it strips fragments/queries, resolves from the containing document, rejects paths that escape the repository, and requires the target to exist; external, fragment-only, and `mailto:` destinations remain outside this filesystem check. Tests cover both plans, both specs, code literals, fragments, URL-encoded paths, missing files, and archive links.

Add `"verify:docs": "tsx scripts/verify-doc-links.ts"` and include it in `npm run verify` so future link drift fails CI.

- [ ] **Step 6: Verify documentation facts and archive integrity**

Run:

```bash
for script in dev check test test:e2e verify:content build verify upload-image; do node -e "const p=require('./package.json'); if(!p.scripts['$script']) process.exit(1)"; done
if rg -n "0\.0\.1|src/content/blog|src/content/works|Perfect Performance|Claude attribution|Download PDF" README.md AGENTS.md; then exit 1; fi
test "$(readlink CLAUDE.md)" = "AGENTS.md"
GIT_COMMON_DIR=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
OPERATOR_STATE_DIR="$GIT_COMMON_DIR/codex/v1-modernization"
ORIGINAL_ROOT=$(cat "$OPERATOR_STATE_DIR/original-root.txt")
test -n "$ORIGINAL_ROOT" && test "${ORIGINAL_ROOT#/}" != "$ORIGINAL_ROOT"
npx tsx scripts/archive-legacy-docs.ts --verify --source-root="$ORIGINAL_ROOT" --source-hashes="$OPERATOR_STATE_DIR/authorized-archive-source-hashes.txt" --inventory="$OPERATOR_STATE_DIR/original-status.z" --attestation=docs/verification/baselines/core-1.0.0/operator-state-attestation.json
npm run test -- tests/unit/ops/archiveLegacyDocs.test.ts
npm run test -- tests/unit/ops/docLinks.test.ts
npm run verify:docs
```

Expected: no stale claims and all documented commands exist.

- [ ] **Step 7: Commit the canonical documentation and archive**

```bash
git add README.md AGENTS.md package.json package-lock.json scripts/archive-legacy-docs.ts scripts/verify-doc-links.ts tests/unit/ops/archiveLegacyDocs.test.ts tests/unit/ops/docLinks.test.ts docs/archive/README.md docs/archive/archive-manifest.json docs/archive/site/project-spec-v1.md docs/archive/site/project-spec-v2.md docs/archive/site/v2-migration-log.md docs/archive/site/implementation-logs/site-launch.md docs/archive/site/implementation-logs/liquid-glass-dock-v1.md docs/archive/site/implementation-logs/liquid-glass-dock-v2.md docs/archive/jets-ghost/legacy-rag/rag-chatbot-architecture.md docs/archive/jets-ghost/legacy-rag/rag-chatbot-implementation-plan.md docs/archive/jets-ghost/legacy-rag/rag-chatbot-implementation-log.md docs/archive/jets-ghost/legacy-rag/embedding-storage-research.md docs/archive/jets-ghost/legacy-rag/jets-ghost-v1.5-spec.md docs/archive/jets-ghost/legacy-rag/rag-chatbot-implementation-review.md docs/superpowers/specs/2026-07-11-v1-modernization-design.md docs/superpowers/specs/2026-07-11-jets-ghost-local-assistant-design.md docs/superpowers/plans/2026-07-11-v1-modernization.md docs/superpowers/plans/2026-07-11-jets-ghost-local-assistant.md
git commit -m "docs: establish canonical project documentation"
```

### Task 12: Qualify and release core modernization 2.0.0

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `docs/verification/core-modernization-2.0.0.md`

**Interfaces:**
- Produces: verified breaking application release `2.0.0` and evidence record.
- Consumes: all previous core tasks.

- [ ] **Step 1: Bump the major release without tagging**

Run:

```bash
npm version 2.0.0 --no-git-tag-version
```

Expected: `package.json` and the lockfile report `2.0.0`. This major release accounts for removal of `/api/chat` and replacement of the legacy content authoring contract.

- [ ] **Step 2: Run the complete local gate**

Run:

```bash
npm ci
npm run verify:all
git diff --check
git status --short
```

Expected: all checks pass; only the intended version files are uncommitted.

- [ ] **Step 3: Record non-self-referential verification evidence**

Create `docs/verification/core-modernization-2.0.0.md` containing:

```markdown
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
- Grainient: 24fps, hidden/offscreen pause, reduced-motion fallback verified
- Visual baseline: preview-to-baseline comparison is a required release artifact; it is not claimed complete in this commit
- Postdeployment binding and artifact checksums: required in the `v2.0.0` annotated tag and downloaded release readback
```

The Git commit containing this file is the evidence revision; no manually copied SHA is stored inside the file.

- [ ] **Step 4: Commit the release candidate**

```bash
git add package.json package-lock.json docs/verification/core-modernization-2.0.0.md
git commit -m "chore(release): prepare 2.0.0"
```

- [ ] **Step 5: Deploy and compare the exact preview candidate**

After the user-approved branch push, wait for its Git-backed Vercel Preview deployment and set `CANDIDATE_URL` to that preview hostname. Do not capture localhost or the production alias. Sanitize the provider responses and prove the preview was built from the committed candidate before visual capture:

```bash
set -euo pipefail
EXPECTED_SHA=$(git rev-parse HEAD)
test -n "$CANDIDATE_URL"
umask 077
EVIDENCE_TMP=$(mktemp -d)
chmod 700 "$EVIDENCE_TMP"
trap 'rm -rf "$EVIDENCE_TMP"' EXIT HUP INT TERM
npx --yes vercel@55.0.0 inspect "$CANDIDATE_URL" --wait --timeout=5m --format=json > "$EVIDENCE_TMP/candidate-inspect.raw.json"
npx tsx scripts/sanitize-vercel-evidence.ts sanitize-inspect --input="$EVIDENCE_TMP/candidate-inspect.raw.json" --output="$EVIDENCE_TMP/candidate-inspect.json"
CANDIDATE_DEPLOYMENT_ID=$(EVIDENCE_TMP="$EVIDENCE_TMP" node -e "const d=require(process.env.EVIDENCE_TMP+'/candidate-inspect.json'); process.stdout.write(d.id)")
npx --yes vercel@55.0.0 api "/v13/deployments/$CANDIDATE_DEPLOYMENT_ID" --raw > "$EVIDENCE_TMP/candidate-deployment.raw.json"
npx tsx scripts/sanitize-vercel-evidence.ts sanitize-deployment --input="$EVIDENCE_TMP/candidate-deployment.raw.json" --output="$EVIDENCE_TMP/candidate-deployment.json"
EXPECTED_SHA="$EXPECTED_SHA" EVIDENCE_TMP="$EVIDENCE_TMP" node -e "const d=require(process.env.EVIDENCE_TMP+'/candidate-deployment.json'); if(d.readyState!=='READY'||d.target==='production'||d.gitSource?.sha!==process.env.EXPECTED_SHA) process.exit(1)"
CANDIDATE_OUTPUT="test-results/core-2.0.0-candidate-$EXPECTED_SHA"
test "$CANDIDATE_OUTPUT" != "docs/verification/baselines/core-1.0.0"
test ! -e "$CANDIDATE_OUTPUT"
npx tsx scripts/capture-production-baseline.ts --origin="https://$CANDIDATE_URL" --expected-commit="$EXPECTED_SHA" --deployment="$EVIDENCE_TMP/candidate-deployment.json" --output="$CANDIDATE_OUTPUT" --compare-to=docs/verification/baselines/core-1.0.0
rm -rf "$EVIDENCE_TMP"
trap - EXIT HUP INT TERM
```

The capture script refuses an output path inside the immutable baseline, requires the sanitized deployment's `gitSource.sha` to equal `--expected-commit`, and writes screenshots, `manifest.json`, `comparison.json`, and a copied sanitized `deployment.json` under the exact candidate output directory. Compare home, blog index/detail, works index/detail, tools, and contact at both baseline viewports. Reject unexplained changes to palette, typography, Utopia spacing, Liquid Glass geometry, or Grainient appearance for visitors without reduced-motion preferences; record reviewed intentional differences in `comparison.json`. Preserve this directory for the release asset and then remove the private raw-input directory.

- [ ] **Step 6: Promote through the approved production workflow and read it back**

Promote/merge only after the exact preview comparison passes, using a fast-forward/exact-commit workflow so the release commit remains the previewed SHA. After integration, require `test -d "test-results/core-2.0.0-candidate-$(git rev-parse HEAD)"`. If integration creates a merge/squash/rebase SHA, stop: that SHA is a new candidate, and Step 5's deployment binding and visual comparison must be rerun before production promotion or tagging. Wait for CI and the production alias to become ready.

Verify production with exact assertions and bind it to the same release commit. Raw Vercel responses again exist only in a private temporary directory; only sanitized projections feed verification:

```bash
set -euo pipefail
EXPECTED_SHA=$(git rev-parse HEAD)
test -d "test-results/core-2.0.0-candidate-$EXPECTED_SHA"
npm run verify:production
umask 077
EVIDENCE_TMP=$(mktemp -d)
chmod 700 "$EVIDENCE_TMP"
trap 'rm -rf "$EVIDENCE_TMP"' EXIT HUP INT TERM
npx --yes vercel@55.0.0 inspect jetsanchez.com --wait --timeout=5m --format=json > "$EVIDENCE_TMP/release-inspect.raw.json"
npx tsx scripts/sanitize-vercel-evidence.ts sanitize-inspect --input="$EVIDENCE_TMP/release-inspect.raw.json" --output="$EVIDENCE_TMP/release-inspect.json"
DEPLOYMENT_ID=$(EVIDENCE_TMP="$EVIDENCE_TMP" node -e "const d=require(process.env.EVIDENCE_TMP+'/release-inspect.json'); process.stdout.write(d.id)")
npx --yes vercel@55.0.0 api "/v13/deployments/$DEPLOYMENT_ID" --raw > "$EVIDENCE_TMP/release-deployment.raw.json"
npx tsx scripts/sanitize-vercel-evidence.ts sanitize-deployment --input="$EVIDENCE_TMP/release-deployment.raw.json" --output=test-results/core-2.0.0-vercel-deployment.json
for scope in production preview development; do
  npx --yes vercel@55.0.0 env ls "$scope" --format=json > "$EVIDENCE_TMP/release-env-$scope.raw.json"
  npx tsx scripts/sanitize-vercel-evidence.ts sanitize-env --scope="$scope" --input="$EVIDENCE_TMP/release-env-$scope.raw.json" --output="test-results/core-2.0.0-vercel-env-$scope.json"
  npx tsx scripts/sanitize-vercel-evidence.ts verify-safe --input="test-results/core-2.0.0-vercel-env-$scope.json"
done
npx tsx scripts/verify-production-containment.ts --origin=https://jetsanchez.com --expected-commit="$EXPECTED_SHA" --deployment=test-results/core-2.0.0-vercel-deployment.json --revocation=docs/verification/containment/openrouter-key-revocation.json --blob-before=docs/verification/containment/chatbot-blobs-before.json --blob-after=docs/verification/containment/chatbot-blobs-after.json --env=test-results/core-2.0.0-vercel-env-production.json --env=test-results/core-2.0.0-vercel-env-preview.json --env=test-results/core-2.0.0-vercel-env-development.json --output=test-results/core-2.0.0-release-result.json
npx tsx scripts/sanitize-vercel-evidence.ts verify-safe --input=test-results/core-2.0.0-vercel-deployment.json
npx tsx scripts/sanitize-vercel-evidence.ts verify-safe --input=test-results/core-2.0.0-release-result.json
rm -rf "$EVIDENCE_TMP"
trap - EXIT HUP INT TERM
```

Expected: the deployment is `READY`, production-targeted, and built from `EXPECTED_SHA`; home, robots, RSS, and extension-correct sitemap endpoints respond as specified; `POST /api/chat` returns exactly `404`; the interim core-`2.0.0` `/chatbot` route returns exactly `308` to `/tools/chatbot/`; `/about` returns one exact `308` to `/about/`; `/about/` returns `200`, index-follow, exact canonical/OG/JSON-LD identity, and one sitemap membership; both retired canonical blog routes return exact `404` and remain absent from internal links, sitemap, and RSS; Blob and credential assertions remain satisfied.

Keep the deployment/result JSON and visual candidate directory uncommitted. Committing a self-referential deployment ID would create a new SHA and invalidate the binding it records.

- [ ] **Step 7: Request only the approved Search Console indexing action**

Only after Step 6's exact production response, metadata, sitemap, deployment-SHA, and containment readback passes, use URL Inspection for `https://jetsanchez.com/about/` in the `sc-domain:jetsanchez.com` property and request indexing for that URL only. Record the request time in the operator's Search Console follow-up notes; do not add another repository artifact or make the request a substitute for production verification.

Do not request indexing for `/tools/chatbot/`, `/chatbot`, `/chatbot/`, or `/rss.xml`. Do not start validation for the two intentional `404`s, six expected slashless alternate-canonical exclusions, or three expected HTTP/www redirect exclusions. The extra `http://www` hop is not a modernization prerequisite. Wait for recrawl and Page indexing report refresh before interpreting or validating Search Console state; a stale report does not block tagging once the exact production gate is green.

- [ ] **Step 8: Checksum, tag, publish, and download-verify release evidence**

Package the visual evidence, calculate reproducible SHA-256 records, and include the checksum-manifest digest in the annotated tag. Create the GitHub Release as a draft, download and verify every uploaded asset, and publish only after readback passes. These commands require the same explicit authorization as any other tag push or GitHub Release mutation:

```bash
set -euo pipefail
EXPECTED_SHA=$(git rev-parse HEAD)
DEPLOYMENT_ID=$(EXPECTED_SHA="$EXPECTED_SHA" node -e "const d=require('./test-results/core-2.0.0-vercel-deployment.json'); if(d.readyState!=='READY'||d.target!=='production'||d.gitSource?.sha!==process.env.EXPECTED_SHA) process.exit(1); process.stdout.write(d.id)")
test -d "test-results/core-2.0.0-candidate-$EXPECTED_SHA"
for REQUIRED in test-results/core-2.0.0-vercel-deployment.json test-results/core-2.0.0-vercel-env-production.json test-results/core-2.0.0-vercel-env-preview.json test-results/core-2.0.0-vercel-env-development.json test-results/core-2.0.0-release-result.json; do test -f "$REQUIRED"; done
VISUAL_ASSET="test-results/core-2.0.0-candidate-$EXPECTED_SHA.tar.gz"
tar -czf "$VISUAL_ASSET" -C test-results "core-2.0.0-candidate-$EXPECTED_SHA"
CHECKSUMS="test-results/core-2.0.0-SHA256SUMS.txt"
(cd test-results && shasum -a 256 "core-2.0.0-vercel-deployment.json" "core-2.0.0-vercel-env-production.json" "core-2.0.0-vercel-env-preview.json" "core-2.0.0-vercel-env-development.json" "core-2.0.0-release-result.json" "core-2.0.0-candidate-$EXPECTED_SHA.tar.gz" > "core-2.0.0-SHA256SUMS.txt")
CHECKSUMS_SHA256=$(shasum -a 256 "$CHECKSUMS" | awk '{print $1}')
git tag -a v2.0.0 "$EXPECTED_SHA" -m "v2.0.0" -m "Vercel deployment: $DEPLOYMENT_ID" -m "Git SHA: $EXPECTED_SHA" -m "SHA256SUMS: $CHECKSUMS_SHA256"
git push origin v2.0.0
gh release create v2.0.0 --draft --verify-tag --title "v2.0.0" --notes-from-tag "test-results/core-2.0.0-vercel-deployment.json#Sanitized Vercel deployment" "test-results/core-2.0.0-vercel-env-production.json#Sanitized production environment inventory" "test-results/core-2.0.0-vercel-env-preview.json#Sanitized preview environment inventory" "test-results/core-2.0.0-vercel-env-development.json#Sanitized development environment inventory" "test-results/core-2.0.0-release-result.json#Production containment result" "$VISUAL_ASSET#Visual comparison evidence" "$CHECKSUMS#SHA-256 manifest"
VERIFY_DIR=$(mktemp -d)
chmod 700 "$VERIFY_DIR"
trap 'rm -rf "$VERIFY_DIR"' EXIT HUP INT TERM
gh release download v2.0.0 --dir "$VERIFY_DIR" --pattern 'core-2.0.0-*'
(cd "$VERIFY_DIR" && shasum -a 256 -c core-2.0.0-SHA256SUMS.txt)
test "$(shasum -a 256 "$VERIFY_DIR/core-2.0.0-SHA256SUMS.txt" | awk '{print $1}')" = "$CHECKSUMS_SHA256"
test "$(find "$VERIFY_DIR" -mindepth 1 -maxdepth 1 -type f | wc -l | tr -d ' ')" = "7"
gh release edit v2.0.0 --draft=false
rm -rf "$VERIFY_DIR"
trap - EXIT HUP INT TERM
```

Expected: `gh release create --draft --verify-tag` proves the annotated tag already exists remotely; all seven named assets download from the authenticated draft; `shasum -c` passes; the downloaded checksum manifest matches the digest in the tag; and only then does `gh release edit` publish it. Do not commit any release artifact back into the tagged tree. If upload/readback fails, leave the release as a draft and do not continue to archive cleanup.

- [ ] **Step 9: Remove superseded untracked source copies after archive integration**

Only after the archive commit is reachable from the deployed/tagged `2.0.0` commit and the downloaded release evidence passes, use the archive script's guarded cleanup mode. It owns and removes exactly:

```text
EMBEDDING_STORAGE_RESEARCH.md
docs/jets-ghost-v1.5-spec.md
docs/rag-chatbot-implementation-review.md
docs/liquid-glass-dock-v2-log.md
```

Do not remove or modify any other untracked file. The script itself must confirm the remaining original-worktree status differs from the Task 0 inventory only by absence of these four archived paths.

```bash
GIT_COMMON_DIR=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
OPERATOR_STATE_DIR="$GIT_COMMON_DIR/codex/v1-modernization"
ORIGINAL_ROOT=$(cat "$OPERATOR_STATE_DIR/original-root.txt")
test -n "$ORIGINAL_ROOT" && test "${ORIGINAL_ROOT#/}" != "$ORIGINAL_ROOT"
git -C "$ORIGINAL_ROOT" rev-parse --is-inside-work-tree >/dev/null
npx tsx scripts/archive-legacy-docs.ts --cleanup --release-ref=v2.0.0 --source-root="$ORIGINAL_ROOT" --source-hashes="$OPERATOR_STATE_DIR/authorized-archive-source-hashes.txt" --inventory="$OPERATOR_STATE_DIR/original-status.z" --attestation=docs/verification/baselines/core-1.0.0/operator-state-attestation.json
git -C "$ORIGINAL_ROOT" status --porcelain=v1 -uall
```

---

## Core Plan Completion Gate

Before starting the Jet's Ghost implementation plan, confirm:

```text
[ ] Core production is 2.0.0 and healthy
[ ] OpenRouter is revoked and absent
[ ] Public chatbot blobs are deleted
[ ] Content policy and CI are enforced
[ ] Build is static and side-effect-free
[ ] README and AGENTS.md are canonical and accurate
[ ] Superseded tracked and authorized untracked docs are indexed under docs/archive
[ ] The four authorized superseded source copies were removed by guarded archive cleanup
[ ] Active unrelated untracked drafts remain untouched
[ ] Committed provider evidence is sanitized and downloaded release artifacts match the tagged SHA-256 manifest
[ ] Existing visual identity is unchanged
[ ] Astro/Vercel trailing-slash settings, canonical/OG/JSON-LD, every navigation representation, and sitemap HTML URLs agree; machine endpoints remain extension-correct
[ ] /about is one exact 308 to /about/; /about/ is index-follow with exact metadata and one sitemap entry
[ ] Both retired blog canonicals return 404 and remain absent from internal links, sitemap, and RSS
[ ] Search Console indexing was requested for /about/ only after exact production verification; excluded classes were not requested or validated, and report judgment waits for recrawl/refresh
[ ] The approved Jet's Ghost prototype from d406ed46 remains intact and noindexed at /tools/chatbot/
[ ] The 2.1.0 handoff explicitly moves it to semantic /chatbot with canonical https://jetsanchez.com/chatbot/, reverses the redirect, replaces Tools with Ghost, and makes /tools/ dormant
```
