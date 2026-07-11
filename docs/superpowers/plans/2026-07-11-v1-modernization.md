# Jet Web v1 Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the existing Astro site in place, contain the retired chatbot exposure, enforce explicit content publication, add verification, and preserve the site's visual identity.

**Architecture:** The site becomes a deterministic static Astro build deployed on Vercel. Astro content collections remain authoritative, shared predicates govern publication and assistant inclusion, and React remains limited to interactive islands. Jet's Ghost is left as a noindexed placeholder until its separate plan is implemented.

**Tech Stack:** Astro 5, MDX, React 19, TypeScript 5.9, Tailwind CSS 3.4, Vitest, Playwright, axe-core, Vercel, Node.js 22.

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
- Non-merge commits follow Conventional Commits 1.0.0 and require no agent attribution.
- Never stage or rewrite unrelated user-owned untracked files.
- Production mutation steps require readback verification before completion.

---

## File Structure

### Repository governance

- `AGENTS.md` — canonical repository instructions.
- `CLAUDE.md` — relative symlink to `AGENTS.md`.
- `.nvmrc` — Node 22 selection.
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
- `.github/workflows/verify.yml` — Node 22 CI.

### Shared UI and metadata

- `src/config/site.ts` — canonical navigation data.
- `src/utils/structuredData.ts` — typed JSON-LD builders.
- `src/utils/grainientLifecycle.ts` — pure animation-loop decision.

### Deployment

- `vercel.json` — permanent legacy-chatbot redirect.
- `astro.config.mjs` — static Astro configuration without the Vercel server adapter.

---

### Task 1: Establish repository governance and version baseline

**Files:**
- Replace symlink with file: `AGENTS.md`
- Replace file with symlink: `CLAUDE.md`
- Create: `.nvmrc`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: canonical instructions at `AGENTS.md`, compatibility link at `CLAUDE.md`, application version `1.0.0`, Node engine `22.x`.
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
  - The current product baseline is `1.0.0`.
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
22
```

Update `package.json`:

```json
{
  "name": "jet-web",
  "version": "1.0.0",
  "engines": {
    "node": "22.x"
  }
}
```

Run:

```bash
npm install --package-lock-only --ignore-scripts
```

Expected: the root package in `package-lock.json` is `1.0.0` and includes Node `22.x`.

- [ ] **Step 5: Verify the canonical-file and governance contract**

Run:

```bash
test -f AGENTS.md
test ! -L AGENTS.md
test -L CLAUDE.md
test "$(readlink CLAUDE.md)" = "AGENTS.md"
cmp AGENTS.md CLAUDE.md
node -e "const p=require('./package.json'); if(p.version!=='1.0.0'||p.engines.node!=='22.x') process.exit(1)"
rg -n "Semantic Versioning 2.0.0|Conventional Commits 1.0.0|Do not add Claude" AGENTS.md
```

Expected: all checks pass and the three governance phrases are printed.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md CLAUDE.md .nvmrc package.json package-lock.json
git commit -m "chore(governance): establish repository conventions"
```

### Task 2: Install the verification harness

**Files:**
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/unit/config/site.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `npm run check`, `npm run test`, `npm run test:e2e`, and a reusable jsdom test environment.
- Consumes: `SITE` from `src/config/site.ts`.

- [ ] **Step 1: Install exact test categories**

Run:

```bash
npm install --save-dev vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @playwright/test @axe-core/playwright
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
    include: ['tests/unit/**/*.test.{ts,tsx}'],
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
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
```

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

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts playwright.config.ts tests/setup.ts tests/unit/config/site.test.ts
git commit -m "test: establish verification harness"
```

### Task 3: Contain the production chatbot and restore a pure static build

**Files:**
- Create: `tests/unit/build/staticBoundary.test.ts`
- Create: `vercel.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `astro.config.mjs`
- Modify: `.gitignore`
- Delete: `src/pages/api/chat.ts`
- Delete: `src/pages/chatbot.astro`
- Remove local generated file: `src/config/chatbot-artifacts.json`

**Interfaces:**
- Produces: side-effect-free `npm run build`, static `/chatbot` 301 redirect, no `/api/chat` route.
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
    expect(packageJson.scripts.build).toBe('astro build');
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

Delete:

```text
src/pages/api/chat.ts
src/pages/chatbot.astro
src/config/chatbot-artifacts.json
```

Remove this obsolete ignore entry from `.gitignore`:

```text
src/config/chatbot-artifacts.json
```

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

- [ ] **Step 4: Make the placeholder describe the approved direction**

In `src/pages/tools/chatbot.astro`, replace the v2 migration paragraph with:

```astro
<p class="text-text-secondary mb-m">
  Jet's Ghost is being rebuilt as a local-first assistant powered in your browser by Gemma 4. It will use only explicitly published site content and will not send conversations to a hosted model.
</p>
```

Keep `noindex={true}` until the companion plan's release gate passes.

- [ ] **Step 5: Run boundary checks**

Run:

```bash
npm run test -- tests/unit/build/staticBoundary.test.ts
npm run check
before_build=$(git diff --binary | shasum -a 256 | cut -d' ' -f1)
npm run build
after_build=$(git diff --binary | shasum -a 256 | cut -d' ' -f1)
test "$before_build" = "$after_build"
test ! -e dist/api/chat
```

Expected: tests, check, and build pass; the build changes no tracked source; no chat API output exists.

- [ ] **Step 6: Commit the static containment code**

```bash
git add package.json package-lock.json astro.config.mjs .gitignore vercel.json src/pages/tools/chatbot.astro tests/unit/build/staticBoundary.test.ts
git add -u src/pages/api/chat.ts src/pages/chatbot.astro
git commit -m "fix(security): retire hosted chatbot endpoint"
```

- [ ] **Step 7: Revoke and remove the production credential**

In the authenticated OpenRouter key dashboard, revoke the key used by `jet-web`. Then run:

```bash
npx vercel env rm OPENROUTER_API_KEY production --yes
npx vercel env rm OPENROUTER_API_KEY preview --yes
npx vercel env rm OPENROUTER_API_KEY development --yes
npx vercel env ls
```

Expected: `OPENROUTER_API_KEY` is absent from all scopes.

- [ ] **Step 8: Delete every obsolete public chatbot Blob**

From the original linked workspace containing `.env.local`, run without printing the token:

```bash
set -a
source .env.local
set +a
node --input-type=module -e "import { del, list } from '@vercel/blob'; let cursor; const urls=[]; do { const page=await list({prefix:'chatbot/',cursor}); urls.push(...page.blobs.map(blob=>blob.url)); cursor=page.hasMore?page.cursor:undefined; } while(cursor); console.log('Deleting', urls.length, 'chatbot blobs'); if(urls.length) await del(urls);"
```

Verify:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' 'https://vyge4wbmw8jgd8rh.public.blob.vercel-storage.com/chatbot/manifest-d70520113a820db7.json'
```

Expected: `404`.

- [ ] **Step 9: Deploy the containment commit and read it back**

Use the approved branch/push workflow or a clean Vercel production deployment. Never deploy from the dirty original workspace.

Verify:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://jetsanchez.com/api/chat
curl -sSI https://jetsanchez.com/chatbot | rg -i '^(HTTP/|location:)'
npx vercel env ls production
```

Expected:

```text
POST /api/chat -> 404 or 405 with no generation
/chatbot -> 301 or 308 to /tools/chatbot
OPENROUTER_API_KEY absent
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
- Locally guard but do not stage: `src/data/blog/how-to-install-and-get-started-with-codex-cli-2026.mdx`

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

Do not stage the active Codex draft. In the original workspace only, replace its `draft: false` with:

```yaml
status: draft
assistant: false
```

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
git add src/content/policy.ts src/schemas/content.ts tests/unit/content/policy.test.ts src/pages src/data/blog/how-to-install-claude-code-cli-2026.mdx src/data/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters.mdx src/data/works/recursive-convergence-hypothesis.mdx
git status --short
git commit -m "feat(content): require explicit publication status"
```

Expected before commit: the Codex draft remains untracked and unstaged.

### Task 5: Add production content validation and CI

**Files:**
- Create: `src/content/validation.ts`
- Create: `scripts/verify-content.ts`
- Create: `tests/unit/content/validation.test.ts`
- Create: `.github/workflows/verify.yml`
- Modify: `package.json`

**Interfaces:**
- Produces: `validateContentRecords(records)`, `npm run verify:content`, `npm run verify`.
- Consumes: shared schemas, publication policy, Git tracked-file state.

- [ ] **Step 1: Write failing validation tests**

Create `tests/unit/content/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateContentRecords } from '../../../src/content/validation';

describe('content validation', () => {
  it('rejects assistant-enabled drafts', () => {
    const errors = validateContentRecords([
      { path: 'src/data/blog/draft.mdx', tracked: true, data: { status: 'draft', assistant: true } },
    ]);
    expect(errors).toContain('src/data/blog/draft.mdx: assistant content must be published');
  });

  it('rejects untracked published content', () => {
    const errors = validateContentRecords([
      { path: 'src/data/blog/new.mdx', tracked: false, data: { status: 'published', assistant: false } },
    ]);
    expect(errors).toContain('src/data/blog/new.mdx: published content must be tracked by Git');
  });

  it('accepts an untracked draft excluded from the assistant', () => {
    expect(validateContentRecords([
      { path: 'src/data/blog/draft.mdx', tracked: false, data: { status: 'draft', assistant: false } },
    ])).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement the pure validator**

Create `src/content/validation.ts`:

```ts
import { isAssistantEligible, isPublished, type PublicationData } from './policy';

export interface ContentValidationRecord {
  path: string;
  tracked: boolean;
  data: PublicationData;
}

export function validateContentRecords(records: ContentValidationRecord[]): string[] {
  const errors: string[] = [];

  for (const record of records) {
    if (record.data.assistant === true && !isAssistantEligible(record.data)) {
      errors.push(`${record.path}: assistant content must be published`);
    }
    if (isPublished(record.data) && !record.tracked) {
      errors.push(`${record.path}: published content must be tracked by Git`);
    }
  }

  return errors;
}
```

- [ ] **Step 3: Implement the filesystem/Git adapter**

Create `scripts/verify-content.ts` that:

1. Recursively reads `.md` and `.mdx` files under `src/data/blog` and `src/data/works`.
2. Parses frontmatter with `gray-matter`.
3. Parses the result through the appropriate shared Zod schema.
4. Calls `git ls-files --error-unmatch <path>` without a shell to determine `tracked`.
5. Calls `validateContentRecords()`.
6. Prints one error per line and exits `1` when errors exist.
7. Prints `Content policy verified: <count> entries` and exits `0` otherwise.

The main entrypoint must be:

```ts
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
```

- [ ] **Step 4: Add verification scripts**

Set:

```json
{
  "verify:content": "tsx scripts/verify-content.ts",
  "verify": "npm run check && npm run test && npm run verify:content && npm run build"
}
```

- [ ] **Step 5: Run the validator against the guarded active draft**

Run:

```bash
npm run test -- tests/unit/content/validation.test.ts
npm run verify:content
npm run verify
```

Expected: all pass; the untracked active draft is accepted only because it is explicitly `draft` and not assistant-enabled.

- [ ] **Step 6: Add `.github/workflows/verify.yml`**

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
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run verify
```

- [ ] **Step 7: Commit**

```bash
git add src/content/validation.ts scripts/verify-content.ts tests/unit/content/validation.test.ts .github/workflows/verify.yml package.json
git commit -m "ci: enforce production content and build checks"
```

### Task 6: Make navigation configuration canonical and accessible

**Files:**
- Create: `tests/unit/navigation/navigation.test.ts`
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
npm run check
npm run build
```

Expected: all pass and `NAV_ITEMS` appears only in `src/config/site.ts` as a declaration.

- [ ] **Step 6: Commit**

```bash
git add src/config/site.ts src/components/navigation/LiquidGlassDock.tsx src/components/layout/BaseLayout.astro tests/unit/navigation/navigation.test.ts
git commit -m "refactor(navigation): centralize route configuration"
```

### Task 7: Correct research links and typed metadata

**Files:**
- Create: `src/utils/structuredData.ts`
- Create: `tests/unit/seo/structuredData.test.ts`
- Modify: `src/components/seo/StructuredData.astro`
- Modify: `src/components/seo/SEO.astro`
- Modify: `src/data/works/recursive-convergence-hypothesis.mdx`

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
      id: 'https://jetsanchez.com/works/rch#scholarlyarticle',
      url: 'https://jetsanchez.com/works/rch',
      headline: 'RCH',
      description: 'Research description',
      datePublished: '2025-08-27T00:00:00.000Z',
      tags: ['AI'],
    });
    expect(schema['@type']).toBe('ScholarlyArticle');
    expect(schema.mainEntityOfPage).toEqual({
      '@type': 'WebPage',
      '@id': 'https://jetsanchez.com/works/rch#webpage',
    });
  });
});
```

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

- [ ] **Step 4: Fix the research action and citation**

In `recursive-convergence-hypothesis.mdx`, keep only:

```yaml
links:
  - label: "View on SSRN"
    url: "https://doi.org/10.2139/ssrn.5395309"
```

Use this URL in the citation body:

```text
https://doi.org/10.2139/ssrn.5395309
```

- [ ] **Step 5: Verify**

Run:

```bash
npm run test -- tests/unit/seo/structuredData.test.ts
npm run check
npm run build
rg -n "https://doi.org/10.2139/ssrn.5395309" dist/works/recursive-convergence-hypothesis/index.html
if rg -n "Download PDF|twitter:creator|http://dx.doi.org" dist; then exit 1; fi
```

Expected: the DOI appears; obsolete metadata does not.

- [ ] **Step 6: Commit**

```bash
git add src/utils/structuredData.ts src/components/seo/StructuredData.astro src/components/seo/SEO.astro src/data/works/recursive-convergence-hypothesis.mdx tests/unit/seo/structuredData.test.ts
git commit -m "fix(seo): correct research and structured metadata"
```

### Task 8: Add reduced-motion control to Grainient

**Files:**
- Create: `src/utils/grainientLifecycle.ts`
- Create: `tests/unit/ui/grainientLifecycle.test.ts`
- Modify: `src/components/ui/Grainient.tsx`

**Interfaces:**
- Produces: `shouldRunGrainient(state)`.
- Consumes: hidden state, viewport state, and reduced-motion state.

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

Replace `canRun()` with `shouldRunGrainient({ documentHidden: document.hidden, inViewport: isInViewport, reducedMotion })`. When reduced motion is active before renderer creation, return the existing plain hero fallback without starting an animation loop. Remove the media-query listener during cleanup.

Preserve the deployed 24fps frame interval and IntersectionObserver behavior.

- [ ] **Step 4: Verify**

Run:

```bash
npm run test -- tests/unit/ui/grainientLifecycle.test.ts
npm run check
npm run build
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/grainientLifecycle.ts src/components/ui/Grainient.tsx tests/unit/ui/grainientLifecycle.test.ts
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

- [ ] **Step 1: Prove the old runtime is unreachable**

Run:

```bash
rg -n "components/chatbot|useChatbot|services/(generation|initialization|retrieval|rrf)|artifact-loader|retrieval.worker|types/chatbot" src --glob '!src/components/chatbot/**' --glob '!src/hooks/useChatbot.ts' --glob '!src/services/**' --glob '!src/stores/chatbot.ts' --glob '!src/types/chatbot.ts' --glob '!src/utils/artifact-loader.ts' --glob '!src/workers/**'
```

Expected: no output.

- [ ] **Step 2: Delete retired files**

Delete the files and directory listed in this task. Do not delete the historical design documents.

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
git add -u scripts src
git commit -m "refactor(chatbot): remove retired RAG runtime"
```

### Task 10: Add browser regression and accessibility coverage

**Files:**
- Create: `tests/e2e/site.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: route, redirect, theme, metadata, keyboard, and axe verification.
- Consumes: dev server through `playwright.config.ts`.

- [ ] **Step 1: Install the Playwright browser**

Run:

```bash
npx playwright install chromium
```

- [ ] **Step 2: Create route and correctness tests**

Create `tests/e2e/site.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const routes = ['/', '/about', '/blog', '/works', '/tools', '/contact'];

for (const route of routes) {
  test(`${route} renders one main heading`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/jetsanchez\.com/);
  });
}

test('research exposes one DOI-backed action', async ({ page }) => {
  await page.goto('/works/recursive-convergence-hypothesis');
  const action = page.getByRole('link', { name: 'View on SSRN' });
  await expect(action).toHaveAttribute('href', 'https://doi.org/10.2139/ssrn.5395309');
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveCount(0);
});

test('theme choice persists across navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /switch to dark mode/i }).click();
  await page.goto('/about');
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('machine-readable routes are available', async ({ request }) => {
  expect((await request.get('/rss.xml')).ok()).toBe(true);
  expect((await request.get('/robots.txt')).ok()).toBe(true);
});

test('content pages expose JSON-LD', async ({ page }) => {
  await page.goto('/works/recursive-convergence-hypothesis');
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(schemas.some((schema) => schema.includes('ScholarlyArticle'))).toBe(true);
});
```

Test the production redirect separately after deployment because Astro dev does not apply `vercel.json`.

- [ ] **Step 3: Create accessibility tests**

Create `tests/e2e/accessibility.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const route of ['/', '/blog', '/works', '/tools/chatbot']) {
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
});
```

On the mobile project, open the navigation disclosure and assert `aria-expanded` changes from `false` to `true`, its controlled dock remains keyboard reachable, and closing it restores the state.

Color contrast remains a separate manual/browser check because the WebGL background makes automated sampling unreliable; do not claim it passed axe.

- [ ] **Step 4: Add browser verification to the full command**

Set:

```json
{
  "verify:browser": "playwright test",
  "verify:all": "npm run verify && npm run verify:browser"
}
```

Keep routine `verify` browser-free for fast local and Vercel builds; CI adds a separate browser job.

- [ ] **Step 5: Add a browser job to `.github/workflows/verify.yml`**

Add a job depending on `verify` that installs Chromium and runs `npm run verify:browser`.

- [ ] **Step 6: Run and commit**

```bash
npm run test:e2e
git add tests/e2e package.json .github/workflows/verify.yml
git commit -m "test(e2e): cover core routes and accessibility"
```

### Task 11: Make documentation canonical and rewrite the README

**Files:**
- Rewrite: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/project-spec-v2.md`
- Modify: `docs/v2-migration-log.md`
- Modify: `docs/rag-chatbot-architecture.md`
- Modify: `docs/rag-chatbot-implementation-plan.md`
- Modify: `docs/rag-chatbot-implementation-log.md`

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

Requirements state Node 22 and npm. The command table contains only commands present in `package.json`. Content examples use:

```yaml
status: draft
assistant: false
```

and explain that publication requires `status: published`, while assistant inclusion additionally requires `assistant: true`.

Remove emoji, badges, “perfect performance,” hard-coded Lighthouse metrics, generic cloning tutorials, stale `src/content` paths, and unsupported bundle-size claims.

- [ ] **Step 2: Update `AGENTS.md` to the implemented truth**

Update commands, content fields, static deployment, test locations, pure-build rule, Jet's Ghost status, canonical specs, and versioning rules. Remove references to `draft?: boolean`, server OpenRouter generation, v2 as target, and Claude attribution.

- [ ] **Step 3: Mark superseded and historical documents**

At the top of `project-spec-v2.md` and `v2-migration-log.md`, add:

```markdown
> **Status: Superseded.** Modernized v1 is the canonical architecture. See [`docs/superpowers/specs/2026-07-11-v1-modernization-design.md`](superpowers/specs/2026-07-11-v1-modernization-design.md).
```

At the top of each old RAG document, add:

```markdown
> **Status: Historical implementation record.** The active Jet's Ghost architecture is [`docs/superpowers/specs/2026-07-11-jets-ghost-local-assistant-design.md`](superpowers/specs/2026-07-11-jets-ghost-local-assistant-design.md).
```

Use a correct relative target from each file location.

- [ ] **Step 4: Verify documentation facts**

Run:

```bash
for script in dev check test test:e2e verify:content build verify upload-image; do node -e "const p=require('./package.json'); if(!p.scripts['$script']) process.exit(1)"; done
if rg -n "0\.0\.1|src/content/blog|src/content/works|Perfect Performance|Claude attribution|Download PDF" README.md AGENTS.md; then exit 1; fi
test "$(readlink CLAUDE.md)" = "AGENTS.md"
```

Expected: no stale claims and all documented commands exist.

- [ ] **Step 5: Commit**

```bash
git add README.md AGENTS.md docs/project-spec-v2.md docs/v2-migration-log.md docs/rag-chatbot-architecture.md docs/rag-chatbot-implementation-plan.md docs/rag-chatbot-implementation-log.md
git commit -m "docs: establish canonical project documentation"
```

### Task 12: Qualify and release core modernization

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `docs/verification/core-modernization-1.0.1.md`

**Interfaces:**
- Produces: verified application release `1.0.1` and evidence record.
- Consumes: all previous core tasks.

- [ ] **Step 1: Bump the patch release without tagging**

Run:

```bash
npm version 1.0.1 --no-git-tag-version
```

Expected: `package.json` and the lockfile report `1.0.1`.

- [ ] **Step 2: Run the complete local gate**

Run:

```bash
npm ci
npm run verify:all
git diff --check
git status --short
```

Expected: all checks pass; only the intended version and verification evidence are uncommitted.

- [ ] **Step 3: Record verification evidence**

Create `docs/verification/core-modernization-1.0.1.md` containing:

```markdown
# Core Modernization 1.0.1 Verification

- Node: `22.x`
- `npm run verify`: passed
- `npm run verify:browser`: passed
- OpenRouter key: revoked and absent from Vercel
- `/api/chat`: unavailable in production
- Legacy chatbot Blob prefix: empty
- `/chatbot`: permanent redirect to `/tools/chatbot`
- Draft route: absent
- SSRN action: DOI-backed View action only
- Grainient: 24fps, hidden/offscreen pause, reduced-motion fallback verified
- Production deployment: ready
```

The Git commit containing this file is the evidence revision; no manually copied SHA is stored inside the file.

- [ ] **Step 4: Perform representative visual comparison**

Compare home, blog index/detail, works index/detail, tools, and contact at mobile and desktop widths against the current production surface. Record only verified intentional differences in the evidence file. Reject changes to palette, typography, Utopia spacing, Liquid Glass geometry, or Grainient appearance for visitors without reduced-motion preferences.

- [ ] **Step 5: Commit the release candidate**

```bash
git add package.json package-lock.json docs/verification/core-modernization-1.0.1.md
git commit -m "chore(release): prepare 1.0.1"
```

- [ ] **Step 6: Deploy through the approved remote workflow**

Push only after the user-approved remote checkpoint. Wait for CI and Vercel to become ready.

Verify production:

```bash
curl -fsS https://jetsanchez.com/ >/dev/null
curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://jetsanchez.com/api/chat
curl -sSI https://jetsanchez.com/chatbot | rg -i '^(HTTP/|location:)'
curl -fsS https://jetsanchez.com/sitemap-index.xml >/dev/null || curl -fsS https://jetsanchez.com/sitemap-0.xml >/dev/null
```

Expected: home and sitemap load, API cannot generate, redirect is permanent.

- [ ] **Step 7: Tag only after production readback**

```bash
git tag -a v1.0.1 -m "v1.0.1"
```

Push the tag only with the same remote authorization used for the release.

---

## Core Plan Completion Gate

Before starting the Jet's Ghost implementation plan, confirm:

```text
[ ] Core production is 1.0.1 and healthy
[ ] OpenRouter is revoked and absent
[ ] Public chatbot blobs are deleted
[ ] Content policy and CI are enforced
[ ] Build is static and side-effect-free
[ ] README and AGENTS.md are canonical and accurate
[ ] Existing visual identity is unchanged
```
