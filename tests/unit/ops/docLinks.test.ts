import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  verifyTrackedMarkdownLinks,
  type DocLinkDependencies,
} from '../../../scripts/verify-doc-links';

const temporaryRoots: string[] = [];

function fixture(files: Record<string, string>, tracked = Object.keys(files)) {
  const root = mkdtempSync(join(tmpdir(), 'jet-web-doc-links-'));
  temporaryRoots.push(root);
  for (const [path, contents] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
  const dependencies: DocLinkDependencies = {
    trackedMarkdown: () => tracked,
    readFile: (path) => files[path],
    exists: (path) => Object.hasOwn(files, path),
  };
  return { dependencies, root };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('documentation link verification', () => {
  it('checks both active plans and specs plus the archive index', async () => {
    const files = {
      'docs/superpowers/plans/core.md': '[Core design](../specs/core.md)\n',
      'docs/superpowers/plans/ghost.md': '[Ghost design](../specs/ghost.md)\n',
      'docs/superpowers/specs/core.md': '[Ghost plan](../plans/ghost.md)\n',
      'docs/superpowers/specs/ghost.md': '[Core plan](../plans/core.md)\n',
      'docs/archive/README.md': '[History](site/history.md)\n',
      'docs/archive/site/history.md': '# Archived history\n',
    };
    const { dependencies, root } = fixture(files);

    await expect(
      verifyTrackedMarkdownLinks({ repositoryRoot: root }, dependencies),
    ).resolves.toEqual({ checkedDocuments: 5, checkedLinks: 5 });
  });

  it('ignores fenced code, inline code, plain examples, external URLs, mailto, and fragments', async () => {
    const files = {
      'README.md': [
        '# Readme',
        '',
        '```markdown',
        '[not real](missing-in-code.md)',
        '```',
        '',
        '`[not real](missing-inline.md)`',
        '',
        'Plain example: docs/missing-example.md',
        '',
        '[External](https://example.com)',
        '[Email](mailto:jet@example.com)',
        '[Section](#content)',
        '[Public license](/licenses/apache-2.0.txt)',
        '',
      ].join('\n'),
      'docs/archive/README.md': '# Archive\n',
    };
    const { dependencies, root } = fixture(files);

    await expect(
      verifyTrackedMarkdownLinks({ repositoryRoot: root }, dependencies),
    ).resolves.toEqual({ checkedDocuments: 2, checkedLinks: 0 });
  });

  it('strips queries/fragments and safely decodes relative paths', async () => {
    const files = {
      'README.md': [
        '[Guide](docs/My%20Guide.md?view=compact#start)',
        '![Image](public/image%20one.png#asset)',
        '',
      ].join('\n'),
      'docs/My Guide.md': '# Guide\n',
      'public/image one.png': 'not really an image',
      'docs/archive/README.md': '# Archive\n',
    };
    const { dependencies, root } = fixture(files);

    await expect(
      verifyTrackedMarkdownLinks({ repositoryRoot: root }, dependencies),
    ).resolves.toEqual({ checkedDocuments: 3, checkedLinks: 2 });
  });

  it('reports missing real link and image nodes with their source document', async () => {
    const files = {
      'README.md':
        '[Missing](docs/missing.md)\n![Missing image](public/missing.png)\n',
      'docs/archive/README.md': '# Archive\n',
    };
    const { dependencies, root } = fixture(files);

    await expect(
      verifyTrackedMarkdownLinks({ repositoryRoot: root }, dependencies),
    ).rejects.toThrow('README.md: docs/missing.md, public/missing.png');
  });

  it('rejects repository escape and malformed URL encoding', async () => {
    const escaped = fixture({
      'docs/guide.md': '[Escape](../../outside.md)\n',
      'docs/archive/README.md': '# Archive\n',
    });
    await expect(
      verifyTrackedMarkdownLinks(
        { repositoryRoot: escaped.root },
        escaped.dependencies,
      ),
    ).rejects.toThrow('LINK_ESCAPES_REPOSITORY');

    const malformed = fixture({
      'README.md': '[Malformed](docs/%E0%A4%A.md)\n',
      'docs/archive/README.md': '# Archive\n',
    });
    await expect(
      verifyTrackedMarkdownLinks(
        { repositoryRoot: malformed.root },
        malformed.dependencies,
      ),
    ).rejects.toThrow('INVALID_LINK_ENCODING');
  });

  it('excludes archived bodies while still validating docs/archive/README.md', async () => {
    const files = {
      'README.md': '[Archive](docs/archive/README.md)\n',
      'docs/archive/README.md': '[History](site/history.md)\n',
      'docs/archive/site/history.md': '[Intentionally stale](missing.md)\n',
    };
    const { dependencies, root } = fixture(files);

    await expect(
      verifyTrackedMarkdownLinks({ repositoryRoot: root }, dependencies),
    ).resolves.toEqual({ checkedDocuments: 2, checkedLinks: 2 });
  });

  it('validates the new archive index before it has been staged', async () => {
    const files = {
      'README.md': '# Readme\n',
      'docs/archive/README.md': '[Missing history](site/missing.md)\n',
    };
    const { dependencies, root } = fixture(files, ['README.md']);

    await expect(
      verifyTrackedMarkdownLinks({ repositoryRoot: root }, dependencies),
    ).rejects.toThrow('docs/archive/README.md: docs/archive/site/missing.md');
  });
});
