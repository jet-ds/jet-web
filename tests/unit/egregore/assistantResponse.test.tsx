import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AssistantResponse } from '../../../src/features/egregore/response/AssistantResponse';
import { ResponseRenderBoundary } from '../../../src/features/egregore/response/ResponseRenderBoundary';
import type { ConversationTurn } from '../../../src/features/egregore/state/types';
import type { SelectedSource } from '../../../src/features/egregore/selection/types';

function source(id: `S${number}`): SelectedSource {
  const suffix = id.slice(1);

  return {
    citationId: id,
    documentId: `blog:source-${suffix}`,
    documentOrder: Number(suffix),
    sectionId: `blog:source-${suffix}#section`,
    sectionOrder: 0,
    chunkId: `blog:source-${suffix}#section:${suffix.padStart(64, '0')}:0`,
    chunkOrder: 0,
    title: `Source ${suffix}`,
    canonicalUrl: `https://jetsanchez.com/blog/source-${suffix}/`,
    heading: 'Section',
    text: `Evidence ${suffix}`,
    estimatedTokens: 2,
    selectionReason: 'lexical-match',
    provenance: {
      sourcePath: `src/data/blog/source-${suffix}.mdx`,
      sourceHash: suffix.padStart(64, 'a'),
      chunkContentHash: suffix.padStart(64, 'b'),
      sourceCommit: 'commit-sha',
      corpusVersion: 'c'.repeat(64),
    },
  } as SelectedSource;
}

function turn(
  content: string,
  citationIds: readonly `S${number}`[] = [],
): ConversationTurn {
  return {
    id: 'assistant-1',
    role: 'assistant',
    content,
    citations: citationIds.map((id) => ({ id, source: source(id) })),
  };
}

function Throws({ children: _children }: { children?: ReactNode }): never {
  throw new Error('forced response render failure');
}

describe('AssistantResponse', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the supported prose hierarchy below the page heading', () => {
    const { container } = render(
      <AssistantResponse
        turn={turn(`# Response heading

First line
soft continuation with *emphasis* and **importance**.

1. Ordered item
2. Second item

- Unordered item

> Quoted text

Use \`inline()\` here.

\`\`\`ts
const safe = true;
\`\`\`

###### Deep heading`)}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'Response heading' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 6, name: 'Deep heading' }),
    ).toBeVisible();
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('em')).toHaveTextContent('emphasis');
    expect(container.querySelector('strong')).toHaveTextContent('importance');
    expect(container.querySelector('ol')).toHaveTextContent('Ordered item');
    expect(container.querySelector('ul')).toHaveTextContent('Unordered item');
    expect(container.querySelector('blockquote')).toHaveTextContent(
      'Quoted text',
    );
    expect(container.querySelector('p')).toHaveTextContent(
      'First line soft continuation',
    );
    expect(container.querySelector('p')).toHaveClass('whitespace-pre-wrap');
    expect(container.querySelector('p')?.textContent).toContain(
      'First line\nsoft continuation',
    );
    expect(container.querySelector('p > code')).toHaveTextContent('inline()');
    expect(container.querySelector('pre > code')).toHaveTextContent(
      'const safe = true;',
    );
  });

  it('preserves an authored ordered-list start value', () => {
    const { container } = render(
      <AssistantResponse turn={turn('4. Fourth\n5. Fifth')} />,
    );

    expect(container.querySelector('ol')).toHaveAttribute('start', '4');
  });

  it('activates only allowed destinations with external-link isolation', () => {
    render(
      <AssistantResponse
        turn={turn(
          '[HTTPS](https://example.com/path) [HTTP](http://example.com/) [mail](mailto:jet@example.com) [section](#details)',
        )}
      />,
    );

    for (const name of ['HTTPS', 'HTTP']) {
      expect(screen.getByRole('link', { name })).toHaveAttribute(
        'target',
        '_blank',
      );
      expect(screen.getByRole('link', { name })).toHaveAttribute(
        'rel',
        'noopener noreferrer',
      );
    }
    for (const name of ['mail', 'section']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('target');
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('rel');
    }
  });

  it('renders unsafe, malformed, relative, and unsupported destinations as text', () => {
    const { container } = render(
      <AssistantResponse
        turn={turn(
          '[script](javascript:unsafe()) [data](data:text/html,unsafe) [malformed](https://[bad) [relative](/about/) [phone](tel:+1234)',
        )}
      />,
    );

    for (const label of ['script', 'data', 'malformed', 'relative', 'phone']) {
      expect(container).toHaveTextContent(label);
      expect(screen.queryByRole('link', { name: label })).toBeNull();
    }
  });

  it('rejects raw and percent-decoded C0, DEL, and C1 controls in every link form', () => {
    const { container } = render(
      <AssistantResponse
        turn={turn(
          '[explicit-c0](https://example.com/a%0Db) [explicit-del](https://example.com/a%7Fb) [explicit-c1](https://example.com/a%C2%85b) [explicit-raw-c1](https://example.com/a\u0085b) [mail-control](mailto:jet@example.com?subject=a%0Ab) [fragment-control](#a%0Db) <https://example.com/auto%0Ab> https://example.com/bare%7Fb',
        )}
      />,
    );

    for (const text of [
      'explicit-c0',
      'explicit-del',
      'explicit-c1',
      'explicit-raw-c1',
      'mail-control',
      'fragment-control',
      'https://example.com/auto%0Ab',
      'https://example.com/bare%7Fb',
    ]) {
      expect(container).toHaveTextContent(text);
    }
    expect(container.querySelector('a')).toBeNull();
  });

  it('keeps raw HTML and remote images inert while retaining readable text', () => {
    const { container } = render(
      <AssistantResponse
        turn={turn(
          'Before <script>unsafe()</script> ![remote diagram](https://egregore.invalid/remote.png) after.',
        )}
      />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('<script>unsafe()</script>');
    expect(container).toHaveTextContent('remote diagram');
  });

  it('retains inert alt text for reference-style images', () => {
    const { container } = render(
      <AssistantResponse
        turn={turn(
          'Before ![reference diagram][asset] after.\n\n[asset]: https://egregore.invalid/reference.png',
        )}
      />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('reference diagram');
  });

  it.each([
    [
      'direct',
      '[![linked direct alt](https://egregore.invalid/direct.png)](https://example.com/)',
      'linked direct alt',
    ],
    [
      'reference',
      '[![linked reference alt][asset]](https://example.com/)\n\n[asset]: https://egregore.invalid/reference.png',
      'linked reference alt',
    ],
  ])('flattens linked %s images to inert alt text', (_kind, content, alt) => {
    const { container } = render(<AssistantResponse turn={turn(content)} />);

    expect(container).toHaveTextContent(alt);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });

  it('flattens unsupported GFM without controls or lost ordinary text', () => {
    const { container } = render(
      <AssistantResponse
        turn={turn(`| Name | Value |
| --- | --- |
| Alpha | Beta |

- [x] Finished task

~~Retained strike text~~`)}
      />,
    );

    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('del')).toBeNull();
    expect(container).toHaveTextContent('Name');
    expect(container).toHaveTextContent('Value');
    expect(container).toHaveTextContent('Alpha');
    expect(container).toHaveTextContent('Beta');
    expect(container).toHaveTextContent('Finished task');
    expect(container).toHaveTextContent('Retained strike text');
  });

  it('preserves mixed textual leaves while flattening unsupported ancestry', () => {
    const { container } = render(
      <AssistantResponse
        turn={turn(`| Mixed |
| --- |
| table ordinary and \`table inline\` |

~~strike ordinary and \`strike inline\` [^note]~~

[^note]:
    footnote ordinary

    \`\`\`txt
    fenced leaf
    \`\`\``)}
      />,
    );

    for (const leaf of [
      'table ordinary',
      'table inline',
      'strike ordinary',
      'strike inline',
      '[^note]',
      'footnote ordinary',
      'fenced leaf',
    ]) {
      expect(container).toHaveTextContent(leaf);
    }
    expect(
      container.querySelector('table, del, code, input, a, sup'),
    ).toBeNull();
  });

  it('links only current-turn citations outside protected Markdown ancestry', () => {
    const { container } = render(
      <AssistantResponse
        turn={turn(
          'Valid [S1], unknown [S9], escaped \\[S1], `inline [S1]`, [linked [S1]](https://example.com/), ![image [S1]](https://egregore.invalid/source.png).\n\n```txt\nfenced [S1]\n```',
          ['S1'],
        )}
      />,
    );

    const citation = screen.getByRole('link', { name: '[S1] Source 1' });
    expect(citation).toHaveAttribute(
      'href',
      'https://jetsanchez.com/blog/source-1/',
    );
    expect(citation).toHaveAttribute('target', '_blank');
    expect(citation).toHaveAttribute('rel', 'noopener noreferrer');
    expect(citation).toHaveClass('text-accent-text');
    expect(screen.getByRole('link', { name: 'linked [S1]' })).toHaveAttribute(
      'href',
      'https://example.com/',
    );
    expect(
      screen.getAllByText('[S1]', { exact: false }).length,
    ).toBeGreaterThan(1);
    expect(container.querySelectorAll('a')).toHaveLength(2);
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('image [S1]');
    expect(container).toHaveTextContent('fenced [S1]');
    expect(container).toHaveTextContent('unknown [S9]');
  });

  it('maps citations to exact literal source spans outside raw HTML regions', () => {
    const { container } = render(
      <AssistantResponse
        turn={turn('Encoded &#91;S1], literal [S1], raw <span>[S1]</span>.', [
          'S1',
        ])}
      />,
    );

    const paragraph = container.querySelector('p');
    const citation = screen.getByRole('link', { name: '[S1] Source 1' });
    const prefix = document.createRange();
    prefix.setStart(paragraph!, 0);
    prefix.setEndBefore(citation);
    expect(prefix.toString()).toBe('Encoded [S1], literal ');
    expect(paragraph).toHaveTextContent(
      'Encoded [S1], literal [S1], raw <span>[S1]</span>.',
    );
  });

  it.each([
    ['strong sibling', '**bold** [S1]', 'bold '],
    ['emphasis sibling', 'prefix *emphasis* [S1]', 'prefix emphasis '],
    [
      'link sibling',
      '[ordinary link](https://example.com/) [S1]',
      'ordinary link ',
    ],
    ['raw HTML sibling', '<span>[S1]</span> [S1]', '<span>[S1]</span> '],
  ])(
    'maps citations in leading-whitespace %s text',
    (_shape, content, expectedPrefix) => {
      const { container } = render(
        <AssistantResponse turn={turn(content, ['S1'])} />,
      );

      const paragraph = container.querySelector('p');
      const citation = screen.getByRole('link', { name: '[S1] Source 1' });
      const prefix = document.createRange();
      prefix.setStart(paragraph!, 0);
      prefix.setEndBefore(citation);
      expect(prefix.toString()).toBe(expectedPrefix);
      expect(citation).toHaveAttribute(
        'href',
        'https://jetsanchez.com/blog/source-1/',
      );
    },
  );

  it.each([
    [
      'quoted greater-than',
      '<span title="quoted>delimiter"><em>nested</em>[S1]</span> [S1]',
      '<span title="quoted>delimiter"><em>nested</em>[S1]</span> ',
    ],
    [
      'quoted self-close lookalike',
      "<span title='quoted/>delimiter'><em>nested</em>[S1]</span> [S1]",
      "<span title='quoted/>delimiter'><em>nested</em>[S1]</span> ",
    ],
  ])(
    'keeps nested raw HTML citations inert with a %s attribute',
    (_shape, content, expectedPrefix) => {
      const { container } = render(
        <AssistantResponse turn={turn(content, ['S1'])} />,
      );

      const paragraph = container.querySelector('p');
      const citation = screen.getByRole('link', { name: '[S1] Source 1' });
      const prefix = document.createRange();
      prefix.setStart(paragraph!, 0);
      prefix.setEndBefore(citation);
      expect(prefix.toString()).toBe(expectedPrefix);
      expect(paragraph).toHaveTextContent(content);
    },
  );

  it('keeps citations inert in Markdown ancestry nested inside raw HTML', () => {
    const content = '<span title="quoted>delimiter">*nested [S1]*</span> [S1]';
    const { container } = render(
      <AssistantResponse turn={turn(content, ['S1'])} />,
    );

    const paragraph = container.querySelector('p');
    const citation = screen.getByRole('link', { name: '[S1] Source 1' });
    const prefix = document.createRange();
    prefix.setStart(paragraph!, 0);
    prefix.setEndBefore(citation);
    expect(prefix.toString()).toBe(
      '<span title="quoted>delimiter">nested [S1]</span> ',
    );
  });

  it.each([
    ['an opening tag in Markdown ancestry', '*<span>nested* [S1]</span> [S1]'],
    ['a closing tag in Markdown ancestry', '<span>*nested [S1]</span>* [S1]'],
    [
      'an opening tag in nested strong/emphasis ancestry',
      '***<span>nested*** [S1]</span> [S1]',
    ],
    [
      'a closing tag in nested strong/emphasis ancestry',
      '<span>***nested [S1]</span>*** [S1]',
    ],
  ])('shares raw HTML scope when %s crosses a boundary', (_shape, content) => {
    const { container } = render(
      <AssistantResponse turn={turn(content, ['S1'])} />,
    );

    const paragraph = container.querySelector('p');
    const citation = screen.getByRole('link', { name: '[S1] Source 1' });
    const prefix = document.createRange();
    prefix.setStart(paragraph!, 0);
    prefix.setEndBefore(citation);
    expect(prefix.toString()).toBe('<span>nested [S1]</span> ');
  });

  it.each([
    [
      'delete opening tag',
      '~~<span>nested~~ [S1]</span> [S1]',
      '<span>nested [S1]</span> ',
    ],
    [
      'delete closing tag',
      '<span>~~nested [S1]</span>~~ [S1]',
      '<span>nested [S1]</span> ',
    ],
    [
      'table opening tag',
      '| H |\n| --- |\n| <span>nested |\n\n[S1]</span> [S1]',
      'H <span> nested\n[S1]</span> ',
    ],
    [
      'table closing tag',
      '<span>\n\n| H |\n| --- |\n| nested [S1]</span> |\n\n[S1]',
      '<span>\nH nested [S1] </span>\n',
    ],
  ])(
    'tracks a raw HTML %s through flattened unsupported ancestry',
    (_shape, content, expectedPrefix) => {
      const { container } = render(
        <AssistantResponse turn={turn(content, ['S1'])} />,
      );

      const citation = screen.getByRole('link', { name: '[S1] Source 1' });
      const prefix = document.createRange();
      prefix.setStart(container, 0);
      prefix.setEndBefore(citation);
      expect(prefix.toString()).toBe(expectedPrefix);
      expect(container.querySelectorAll('a')).toHaveLength(1);
      expect(container.querySelector('table')).toBeNull();
      expect(container.querySelector('del')).toBeNull();
    },
  );

  it('does not activate citations while flattening unsupported nodes', () => {
    const { container } = render(
      <AssistantResponse
        turn={turn('~~Struck [S1]~~\n\n| Source |\n| --- |\n| Table [S1] |', [
          'S1',
        ])}
      />,
    );

    expect(screen.queryByRole('link', { name: '[S1] Source 1' })).toBeNull();
    expect(container).toHaveTextContent('Struck [S1]');
    expect(container).toHaveTextContent('Table [S1]');
  });

  it('preserves incomplete streamed Markdown characters without throwing', () => {
    const content =
      'Incomplete **bold and `code and [link](https://example.com';
    const { container } = render(<AssistantResponse turn={turn(content)} />);

    expect(container.textContent).toBe(content);
  });
});

describe('ResponseRenderBoundary', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('preserves the exact plain response when its renderer throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fallback = 'First line\n  indented line\nfinal line';

    render(
      <ResponseRenderBoundary fallback={fallback}>
        <Throws />
      </ResponseRenderBoundary>,
    );

    const response = screen.getByTestId('assistant-response-fallback');
    expect(response.textContent).toBe(fallback);
    expect(response).toHaveClass('whitespace-pre-wrap');
  });
});
