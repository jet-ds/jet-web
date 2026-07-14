import { describe, expect, it } from 'vitest';
import { normalizeMdx } from '../../../src/features/jets-ghost/corpus/normalize';

describe('MDX normalization', () => {
  it('preserves prose hierarchy while excluding executable syntax', () => {
    const sections = normalizeMdx(`
import Widget from './Widget';

Intro paragraph.

## Install

Run the command.

\`\`\`bash
npm install example
\`\`\`

<Callout title="Important">Read the warning.</Callout>

| Item | Value |
| --- | --- |
| Mode | Local |

<Widget label="decorative"><span>Nested prose survives.</span></Widget>
`);

    expect(sections[0]).toMatchObject({
      heading: 'Introduction',
      headingPath: ['Introduction'],
      text: 'Intro paragraph.',
      order: 0,
    });
    expect(sections[1].text).toContain('```bash\nnpm install example\n```');
    expect(sections[1].text).toContain('Important\n\nRead the warning.');
    expect(sections[1].text).toContain('| Item | Value |');
    expect(sections[1].text).toContain('Nested prose survives.');
    expect(sections[1].text).not.toContain('decorative');
  });

  it('maintains heading paths for levels two through four', () => {
    const sections = normalizeMdx(`Before.

## Install
Install overview.

### Linux
Linux overview.

#### Shell
Shell details.

### macOS
macOS details.

## Usage
Usage details.`);

    expect(sections.map(({ heading, headingPath, order }) => ({ heading, headingPath, order }))).toEqual([
      { heading: 'Introduction', headingPath: ['Introduction'], order: 0 },
      { heading: 'Install', headingPath: ['Install'], order: 1 },
      { heading: 'Linux', headingPath: ['Install', 'Linux'], order: 2 },
      { heading: 'Shell', headingPath: ['Install', 'Linux', 'Shell'], order: 3 },
      { heading: 'macOS', headingPath: ['Install', 'macOS'], order: 4 },
      { heading: 'Usage', headingPath: ['Usage'], order: 5 },
    ]);
  });

  it('recognizes qualifying headings inside unknown MDX flow wrappers', () => {
    const sections = normalizeMdx(`<Wrapper>

Before nested heading.

## Nested

Nested body.

### Child

Child body.

</Wrapper>`);

    expect(sections).toEqual([
      {
        heading: 'Introduction',
        headingPath: ['Introduction'],
        text: 'Before nested heading.',
        order: 0,
      },
      { heading: 'Nested', headingPath: ['Nested'], text: 'Nested body.', order: 1 },
      { heading: 'Child', headingPath: ['Nested', 'Child'], text: 'Child body.', order: 2 },
    ]);
  });

  it('emits an explicit introduction when a document begins with a qualifying heading', () => {
    const sections = normalizeMdx('## First\n\nBody.');

    expect(sections).toEqual([
      { heading: 'Introduction', headingPath: ['Introduction'], text: '', order: 0 },
      { heading: 'First', headingPath: ['First'], text: 'Body.', order: 1 },
    ]);
  });

  it('retains only approved static component props and never evaluates expressions', () => {
    const sections = normalizeMdx(`
{secretValue}

<Callout title="Safe" className="hidden" onClick={() => secretValue} detail={secretValue}>
  Child {secretValue} text.
</Callout>

<Callout title={42}>Numeric title.</Callout>

<Unknown label="discarded">Unknown child survives.</Unknown>
`);

    expect(sections[0].text).toBe([
      'Safe',
      'Child  text.',
      '42',
      'Numeric title.',
      'Unknown child survives.',
    ].join('\n\n'));
    expect(sections[0].text).not.toContain('secretValue');
    expect(sections[0].text).not.toContain('hidden');
    expect(sections[0].text).not.toContain('discarded');
  });

  it('serializes prose blocks and GFM structures deterministically', () => {
    const sections = normalizeMdx(`
Paragraph with *emphasis*, **strength**, [a link](https://example.com), and \`inline code\`.

- First
- Second
  - Nested

> Quoted line
>
> Second line

| Key | Value |
| --- | --- |
| A | B |
`);

    expect(sections[0].text).toBe(`Paragraph with *emphasis*, **strength**, [a link](https://example.com), and \`inline code\`.

- First
- Second
  - Nested

> Quoted line
>
> Second line

| Key | Value |
| --- | --- |
| A | B |`);
  });

  it('normalizes line endings and excessive blank lines while preserving fenced code', () => {
    const sections = normalizeMdx('Intro.\r\n\r\n\r\n\r\n```ts\r\nconst value = 1;\r\n```');

    expect(sections[0].text).toBe('Intro.\n\n```ts\nconst value = 1;\n```');
    expect(sections[0].text).not.toContain('\r');
  });
});
