import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import type { NormalizedSection } from './types';

interface AstNode {
  type: string;
  [key: string]: unknown;
}

interface ComponentExtractor {
  staticTextProps: readonly string[];
}

export const APPROVED_MDX_COMPONENT_EXTRACTORS = {
  Callout: { staticTextProps: ['title'] },
} as const satisfies Record<string, ComponentExtractor>;

function isAstNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string'
  );
}

function getChildren(node: AstNode): AstNode[] {
  if (!Array.isArray(node.children)) {
    return [];
  }

  return node.children.filter(isAstNode);
}

function getString(node: AstNode, key: string): string {
  const value = node[key];
  return typeof value === 'string' ? value : '';
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .normalize('NFC');
}

function serializeChildrenAsBlocks(node: AstNode): string {
  return normalizeText(
    getChildren(node).map(serializeBlock).filter(Boolean).join('\n\n'),
  );
}

function serializeChildrenInline(node: AstNode): string {
  return getChildren(node).map(serializeInline).join('');
}

function serializePlainText(node: AstNode): string {
  switch (node.type) {
    case 'text':
    case 'inlineCode':
      return getString(node, 'value');
    case 'break':
      return ' ';
    case 'mdxjsEsm':
    case 'mdxFlowExpression':
    case 'mdxTextExpression':
      return '';
    default:
      return getChildren(node).map(serializePlainText).join('');
  }
}

function staticAttributeText(node: AstNode): string | null {
  const value = node.value;

  if (typeof value === 'string') {
    return normalizeText(value);
  }

  if (!isAstNode(value) || value.type !== 'mdxJsxAttributeValueExpression') {
    return null;
  }

  const expression = getString(value, 'value').trim();
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(expression)
    ? expression
    : null;
}

function approvedComponentPropText(node: AstNode): string[] {
  const name = typeof node.name === 'string' ? node.name : '';
  if (!(name in APPROVED_MDX_COMPONENT_EXTRACTORS)) {
    return [];
  }

  const extractor =
    APPROVED_MDX_COMPONENT_EXTRACTORS[
      name as keyof typeof APPROVED_MDX_COMPONENT_EXTRACTORS
    ];
  const approvedProps = new Set<string>(extractor.staticTextProps);
  if (!Array.isArray(node.attributes)) {
    return [];
  }

  const values: string[] = [];
  for (const attribute of node.attributes) {
    if (!isAstNode(attribute) || attribute.type !== 'mdxJsxAttribute') {
      continue;
    }

    const attributeName = getString(attribute, 'name');
    if (!approvedProps.has(attributeName)) {
      continue;
    }

    const value = staticAttributeText(attribute);
    if (value) {
      values.push(value);
    }
  }

  return values;
}

function serializeMdxElement(node: AstNode, inline: boolean): string {
  const props = approvedComponentPropText(node);
  const children = inline
    ? normalizeText(serializeChildrenInline(node))
    : serializeChildrenAsBlocks(node);

  return normalizeText([...props, children].filter(Boolean).join('\n\n'));
}

function inlineCode(value: string): string {
  const longestRun = Math.max(
    0,
    ...Array.from(value.matchAll(/`+/g), (match) => match[0].length),
  );
  const fence = '`'.repeat(Math.max(1, longestRun + 1));
  return `${fence}${value}${fence}`;
}

function serializeInline(node: AstNode): string {
  switch (node.type) {
    case 'text':
      return getString(node, 'value').replace(/\r\n?/g, '\n');
    case 'inlineCode':
      return inlineCode(getString(node, 'value'));
    case 'emphasis':
      return `*${serializeChildrenInline(node)}*`;
    case 'strong':
      return `**${serializeChildrenInline(node)}**`;
    case 'delete':
      return `~~${serializeChildrenInline(node)}~~`;
    case 'link': {
      const label = serializeChildrenInline(node);
      const url = getString(node, 'url');
      const title = getString(node, 'title');
      return `[${label}](${url}${title ? ` "${title.replaceAll('"', '\\"')}"` : ''})`;
    }
    case 'linkReference':
      return serializeChildrenInline(node);
    case 'image': {
      const alt = getString(node, 'alt');
      const url = getString(node, 'url');
      return alt ? `![${alt}](${url})` : '';
    }
    case 'imageReference':
      return getString(node, 'alt');
    case 'break':
      return '\n';
    case 'mdxJsxTextElement':
    case 'mdxJsxFlowElement':
      return serializeMdxElement(node, true);
    case 'mdxjsEsm':
    case 'mdxFlowExpression':
    case 'mdxTextExpression':
      return '';
    default:
      return serializeChildrenInline(node);
  }
}

function codeFence(node: AstNode): string {
  const value = getString(node, 'value').replace(/\r\n?/g, '\n');
  const longestRun = Math.max(
    0,
    ...Array.from(value.matchAll(/`+/g), (match) => match[0].length),
  );
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  const language = getString(node, 'lang').trim();
  return `${fence}${language}\n${value}\n${fence}`;
}

function indentContinuation(value: string, width: number): string {
  const indentation = ' '.repeat(width);
  return value
    .split('\n')
    .map((line, index) => (index === 0 ? line : `${indentation}${line}`))
    .join('\n');
}

function serializeListItem(node: AstNode, marker: string): string {
  const children = getChildren(node);
  const blocks = children.map(serializeBlock).filter(Boolean);
  if (blocks.length === 0) {
    return marker.trimEnd();
  }

  const checked =
    typeof node.checked === 'boolean' ? `[${node.checked ? 'x' : ' '}] ` : '';
  const content = children.reduce((serialized, child) => {
    const block = serializeBlock(child);
    if (!block) {
      return serialized;
    }

    const separator =
      serialized && child.type === 'list' ? '\n' : serialized ? '\n\n' : '';
    return `${serialized}${separator}${block}`;
  }, '');
  return `${marker}${checked}${indentContinuation(content, marker.length)}`;
}

function serializeList(node: AstNode): string {
  const ordered = node.ordered === true;
  const start = typeof node.start === 'number' ? node.start : 1;

  return getChildren(node)
    .map((item, index) => {
      const marker = ordered ? `${start + index}. ` : '- ';
      return serializeListItem(item, marker);
    })
    .join('\n');
}

function serializeBlockquote(node: AstNode): string {
  const content = serializeChildrenAsBlocks(node);
  return content
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n');
}

function serializeTableCell(node: AstNode): string {
  return normalizeText(serializeChildrenInline(node))
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
}

function serializeTable(node: AstNode): string {
  const rows = getChildren(node).map((row) =>
    getChildren(row).map(serializeTableCell),
  );

  if (rows.length === 0) {
    return '';
  }

  const width = Math.max(...rows.map((row) => row.length));
  const serializeRow = (row: string[]) =>
    `| ${Array.from({ length: width }, (_, index) => row[index] ?? '').join(' | ')} |`;

  return [
    serializeRow(rows[0]),
    serializeRow(Array.from({ length: width }, () => '---')),
    ...rows.slice(1).map(serializeRow),
  ].join('\n');
}

function serializeBlock(node: AstNode): string {
  switch (node.type) {
    case 'paragraph':
      return normalizeText(serializeChildrenInline(node));
    case 'heading':
      return normalizeText(serializeChildrenInline(node));
    case 'code':
      return codeFence(node);
    case 'list':
      return serializeList(node);
    case 'listItem':
      return serializeListItem(node, '- ');
    case 'blockquote':
      return serializeBlockquote(node);
    case 'table':
      return serializeTable(node);
    case 'thematicBreak':
      return '---';
    case 'mdxJsxFlowElement':
      return serializeMdxElement(node, false);
    case 'mdxJsxTextElement':
      return serializeMdxElement(node, true);
    case 'mdxjsEsm':
    case 'mdxFlowExpression':
    case 'mdxTextExpression':
    case 'definition':
    case 'footnoteDefinition':
    case 'html':
      return '';
    default:
      return serializeChildrenAsBlocks(node);
  }
}

function isSectionHeading(node: AstNode): boolean {
  return (
    node.type === 'heading' &&
    typeof node.depth === 'number' &&
    node.depth >= 2 &&
    node.depth <= 4
  );
}

export function normalizeMdx(source: string): NormalizedSection[] {
  const tree = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkGfm)
    .parse(source.replace(/\r\n?/g, '\n')) as unknown as AstNode;

  const sections: NormalizedSection[] = [];
  const headingStack: Array<{ depth: number; heading: string }> = [];
  let heading = 'Introduction';
  let headingPath = ['Introduction'];
  let blocks: string[] = [];

  const emitSection = (): void => {
    sections.push({
      heading,
      headingPath: [...headingPath],
      text: normalizeText(blocks.filter(Boolean).join('\n\n')),
      order: sections.length,
    });
  };

  const beginSection = (node: AstNode): void => {
    emitSection();
    blocks = [];

    const depth = node.depth as number;
    const nextHeading = normalizeText(serializePlainText(node)) || 'Untitled';
    while (
      headingStack.length > 0 &&
      headingStack[headingStack.length - 1].depth >= depth
    ) {
      headingStack.pop();
    }
    headingStack.push({ depth, heading: nextHeading });
    heading = nextHeading;
    headingPath = headingStack.map((item) => item.heading);
  };

  const processFlowNode = (node: AstNode): void => {
    if (isSectionHeading(node)) {
      beginSection(node);
      return;
    }

    if (node.type === 'mdxJsxFlowElement') {
      blocks.push(...approvedComponentPropText(node));
      for (const child of getChildren(node)) {
        processFlowNode(child);
      }
      return;
    }

    const block = serializeBlock(node);
    if (block) {
      blocks.push(block);
    }
  };

  for (const node of getChildren(tree)) {
    processFlowNode(node);
  }

  emitSection();
  return sections;
}
