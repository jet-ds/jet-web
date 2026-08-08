import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const tsxExecutable = resolve(repositoryRoot, 'node_modules/.bin/tsx');
const verifyContentScript = resolve(
  repositoryRoot,
  'scripts/verify-content.ts',
);

const validBlog = `---
title: Example blog
description: Example blog description
pubDate: 2026-07-11
status: draft
assistant: false
---

Draft body.
`;

const validWork = `---
title: Example work
description: Example work description
type: project
date: 2026-07-11
status: draft
assistant: false
---

Draft body.
`;

const untrackedPublishedAssistant = `---
title: Untracked assistant source
description: This source must stop the production build chain.
pubDate: 2026-07-12
status: published
assistant: true
---

Untracked body.
`;

const untrackedPublishedProfile = `---
title: Jet Sanchez
description: Canonical public profile.
date: 2026-07-26
author: Jet Sanchez
status: published
assistant: true
role: Marketing Engineer & AI Researcher
organization: Digital Squad
researchAreas:
  - Artificial Intelligence
technicalFocus:
  - Marketing Engineering
connectText: Connect about applied AI.
---

Profile body.
`;

interface Fixture {
  root: string;
  blogDirectory: string;
  worksDirectory: string;
  profileDirectory: string;
}

function fixtureGitEnvironment(root: string): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const key of [
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
    'GIT_DIR',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_WORK_TREE',
  ]) {
    delete environment[key];
  }
  environment.GIT_CEILING_DIRECTORIES = dirname(root);
  return environment;
}

function createFixture(): Fixture {
  const root = mkdtempSync(resolve(tmpdir(), 'jet-web-content-'));
  const blogDirectory = resolve(root, 'src/data/blog');
  const worksDirectory = resolve(root, 'src/data/works');
  const profileDirectory = resolve(root, 'src/data/profile');
  mkdirSync(blogDirectory, { recursive: true });
  mkdirSync(worksDirectory, { recursive: true });
  mkdirSync(profileDirectory, { recursive: true });

  const initialized = spawnSync('git', ['init', '--quiet'], {
    cwd: root,
    encoding: 'utf8',
    env: fixtureGitEnvironment(root),
    shell: false,
  });
  if (initialized.status !== 0) {
    throw new Error(
      initialized.stderr || 'Failed to initialize fixture Git repository.',
    );
  }

  return { root, blogDirectory, worksDirectory, profileDirectory };
}

function stageBaseline(
  fixture: Fixture,
  blog: string = validBlog,
  work: string = validWork,
): void {
  writeFileSync(resolve(fixture.blogDirectory, 'baseline-blog.mdx'), blog);
  writeFileSync(resolve(fixture.worksDirectory, 'baseline-work.mdx'), work);

  const staged = spawnSync(
    'git',
    [
      'add',
      '--',
      'src/data/blog/baseline-blog.mdx',
      'src/data/works/baseline-work.mdx',
    ],
    {
      cwd: fixture.root,
      encoding: 'utf8',
      env: fixtureGitEnvironment(fixture.root),
      shell: false,
    },
  );
  if (staged.status !== 0) {
    throw new Error(staged.stderr || 'Failed to stage fixture baseline.');
  }
}

function runContentVerification(root: string): SpawnSyncReturns<string> {
  return spawnSync(tsxExecutable, [verifyContentScript, `--root=${root}`], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: process.env,
    shell: false,
  });
}

function runBuildChain(
  root: string,
  sentinel: string,
): SpawnSyncReturns<string> {
  const result = runContentVerification(root);
  if (result.status === 0) writeFileSync(sentinel, 'astro build reached\n');
  return result;
}

describe('production content verification', () => {
  it('stops before Astro when a published assistant source is untracked', () => {
    const fixture = createFixture();
    const sentinel = resolve(fixture.root, 'astro-step-reached');

    try {
      stageBaseline(fixture);
      writeFileSync(
        resolve(fixture.blogDirectory, 'untracked-assistant.mdx'),
        untrackedPublishedAssistant,
      );

      const result = runBuildChain(fixture.root, sentinel);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'src/data/blog/untracked-assistant.mdx [published-untracked]',
      );
      expect(existsSync(sentinel)).toBe(false);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('stops before Astro when the published canonical profile is untracked', () => {
    const fixture = createFixture();
    const sentinel = resolve(fixture.root, 'astro-step-reached');

    try {
      stageBaseline(fixture);
      writeFileSync(
        resolve(fixture.profileDirectory, 'jet-sanchez.mdx'),
        untrackedPublishedProfile,
      );

      const result = runBuildChain(fixture.root, sentinel);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'src/data/profile/jet-sanchez.mdx [published-untracked]',
      );
      expect(existsSync(sentinel)).toBe(false);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('reports schema errors with the repository-relative content path', () => {
    const fixture = createFixture();

    try {
      stageBaseline(
        fixture,
        `---
description: Missing title
pubDate: 2026-07-11
status: draft
assistant: false
---
`,
      );

      const result = runContentVerification(fixture.root);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'src/data/blog/baseline-blog.mdx [schema-invalid]',
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('reports invalid raw policy fields before attempting schema validation', () => {
    const fixture = createFixture();

    try {
      stageBaseline(
        fixture,
        `---
description: Missing title and publication status
pubDate: 2026-07-11
assistant: false
---
`,
      );

      const result = runContentVerification(fixture.root);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'src/data/blog/baseline-blog.mdx [missing-status]',
      );
      expect(result.stderr).not.toContain(
        'src/data/blog/baseline-blog.mdx [schema-invalid]',
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('validates every published URL-bearing frontmatter field', () => {
    const fixture = createFixture();

    try {
      stageBaseline(
        fixture,
        `---
title: Published blog
description: Published blog description
pubDate: 2026-07-11
status: published
assistant: false
image:
  url: http://example.com/image.png
  alt: Example image
---
`,
        `---
title: Published work
description: Published work description
type: project
date: 2026-07-11
status: published
assistant: false
image:
  url: https://example.com/light.png
  darkUrl: http://example.com/dark.png
  alt: Example theme-aware image
links:
  - label: Reference
    url: /reference
repository: git://example.com/repository
demo: http://example.com/demo
---
`,
      );

      const result = runContentVerification(fixture.root);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'image.url must use an absolute HTTPS URL',
      );
      expect(result.stderr).toContain(
        'image.darkUrl must use an absolute HTTPS URL',
      );
      expect(result.stderr).toContain(
        'Reference must use an absolute HTTPS URL',
      );
      expect(result.stderr).toContain(
        'repository must use an absolute HTTPS URL',
      );
      expect(result.stderr).toContain('demo must use an absolute HTTPS URL');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('parses NUL-delimited Git output without splitting tracked newline paths', () => {
    const fixture = createFixture();
    const newlinePath = 'src/data/blog/line\nbreak.mdx';

    try {
      stageBaseline(fixture);
      writeFileSync(resolve(fixture.root, newlinePath), validBlog);
      const staged = spawnSync('git', ['add', '--', newlinePath], {
        cwd: fixture.root,
        encoding: 'utf8',
        env: fixtureGitEnvironment(fixture.root),
        shell: false,
      });
      expect(staged.status).toBe(0);

      const result = runContentVerification(fixture.root);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(
        'Content policy verified: 3 entries; 0 tracked assistant sources',
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('renders a newline-bearing invalid path as one escaped diagnostic line', () => {
    const fixture = createFixture();
    const newlinePath = 'src/data/blog/line\nbreak.mdx';

    try {
      stageBaseline(fixture);
      writeFileSync(
        resolve(fixture.root, newlinePath),
        untrackedPublishedAssistant,
      );

      const result = runContentVerification(fixture.root);

      expect(result.status).toBe(1);
      expect(result.stderr.trim().split('\n')).toEqual([
        'src/data/blog/line\\nbreak.mdx [published-untracked]: Published content must be tracked by Git.',
      ]);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('owns its fixture repository under hostile ambient Git controls', () => {
    const hostileRoot = mkdtempSync(resolve(tmpdir(), 'jet-web-hostile-git-'));
    const hostileGitDirectory = resolve(hostileRoot, 'redirected.git');
    const previousGitDirectory = process.env.GIT_DIR;
    const previousWorkTree = process.env.GIT_WORK_TREE;
    let fixture: Fixture | undefined;

    try {
      process.env.GIT_DIR = hostileGitDirectory;
      process.env.GIT_WORK_TREE = hostileRoot;
      fixture = createFixture();
      stageBaseline(fixture);

      expect(existsSync(resolve(fixture.root, '.git'))).toBe(true);
      expect(existsSync(hostileGitDirectory)).toBe(false);
      expect(runContentVerification(fixture.root).status).toBe(0);
    } finally {
      if (previousGitDirectory === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = previousGitDirectory;
      if (previousWorkTree === undefined) delete process.env.GIT_WORK_TREE;
      else process.env.GIT_WORK_TREE = previousWorkTree;
      if (fixture !== undefined) {
        rmSync(fixture.root, { recursive: true, force: true });
      }
      rmSync(hostileRoot, { recursive: true, force: true });
    }
  });

  it('fails closed when the root is not a Git repository', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'jet-web-no-git-'));

    try {
      mkdirSync(resolve(root, 'src/data/blog'), { recursive: true });
      mkdirSync(resolve(root, 'src/data/works'), { recursive: true });

      const result = runContentVerification(root);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Unable to read Git tracked content');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects an invalid non-directory root', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'jet-web-invalid-root-'));
    const file = resolve(root, 'not-a-directory');

    try {
      writeFileSync(file, 'invalid root\n');

      const result = runContentVerification(file);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'Content verification root is not a directory',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects content directories that escape the root through a symbolic link', () => {
    const fixture = createFixture();
    const outside = mkdtempSync(resolve(tmpdir(), 'jet-web-outside-content-'));

    try {
      rmSync(fixture.blogDirectory, { recursive: true });
      symlinkSync(outside, fixture.blogDirectory, 'dir');

      const result = runContentVerification(fixture.root);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'Content directory escapes the repository root',
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
