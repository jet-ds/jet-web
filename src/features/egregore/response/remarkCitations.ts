import type { ListItem, Root, RootContent, Text } from 'mdast';
import remarkParse from 'remark-parse';
import type { Plugin } from 'unified';
import { unified } from 'unified';

const CITATION_PATTERN = /\[(S\d+)\]/g;

const PARSED_NODE_ALLOWLIST = new Set([
  'root',
  'paragraph',
  'text',
  'emphasis',
  'strong',
  'list',
  'listItem',
  'blockquote',
  'inlineCode',
  'code',
  'heading',
  'break',
  'link',
  'image',
]);

const CITATION_BLOCKING_ANCESTORS = new Set([
  'code',
  'inlineCode',
  'link',
  'image',
]);

interface RemarkCitationsOptions {
  citationIds: readonly `S${number}`[];
}

type CitationText = Text & {
  data: {
    hName: 'span';
    hProperties: { 'data-egregore-citation': `S${number}` };
  };
};

interface MutableParent {
  children: RootContent[];
}

const rawTextDecoder = unified().use(remarkParse);

const VOID_HTML_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function isParent<T extends RootContent | Root>(
  node: T,
): node is T & MutableParent {
  return 'children' in node && Array.isArray(node.children);
}

function textFromUnsupported(node: RootContent, source: string): string {
  if ('value' in node && typeof node.value === 'string') return node.value;
  if (node.type === 'image' || node.type === 'imageReference') {
    return node.alt ?? '';
  }

  if (isParent(node)) {
    const separator =
      node.type === 'table' ||
      node.type === 'tableRow' ||
      node.type === 'tableCell'
        ? ' '
        : '';
    return node.children
      .map((child) => textFromUnsupported(child as RootContent, source))
      .filter(Boolean)
      .join(separator);
  }

  if (
    node.position?.start.offset !== undefined &&
    node.position.end.offset !== undefined &&
    node.type === 'footnoteReference'
  ) {
    return source.slice(node.position.start.offset, node.position.end.offset);
  }

  return '';
}

function containsImage(node: RootContent): boolean {
  if (node.type === 'image' || node.type === 'imageReference') return true;
  return isParent(node)
    ? node.children.some((child) => containsImage(child as RootContent))
    : false;
}

function parsedTextValue(node: Root | RootContent): string {
  if (
    node.type === 'text' ||
    node.type === 'inlineCode' ||
    node.type === 'code'
  ) {
    return node.value;
  }
  if (node.type === 'break') return '\n';
  if (node.type === 'image' || node.type === 'imageReference') {
    return node.alt ?? '';
  }
  return isParent(node)
    ? node.children
        .map((child) => parsedTextValue(child as RootContent))
        .join('')
    : '';
}

function decodedTextSource(value: string): string {
  const sentinel = '\uE000';
  const decoded = parsedTextValue(
    rawTextDecoder.parse(`${value}${sentinel}`) as Root,
  );
  return decoded.endsWith(sentinel) ? decoded.slice(0, -sentinel.length) : '';
}

function isEscapedAt(raw: string, markerIndex: number): boolean {
  let backslashes = 0;
  let cursor = markerIndex - 1;
  while (cursor >= 0 && raw[cursor] === '\\') {
    backslashes += 1;
    cursor -= 1;
  }
  return backslashes % 2 === 1;
}

function rawCitationOffsets(
  node: Text,
  source: string,
): ReadonlyMap<number, `S${number}`> | null {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return null;

  const raw = source.slice(start, end);
  const offsets = new Map<number, `S${number}`>();

  for (const match of raw.matchAll(CITATION_PATTERN)) {
    const rawIndex = match.index;
    if (isEscapedAt(raw, rawIndex)) continue;

    const marker = match[0];
    const decodedIndex = decodedTextSource(raw.slice(0, rawIndex)).length;
    if (
      node.value.slice(decodedIndex, decodedIndex + marker.length) !== marker
    ) {
      continue;
    }
    offsets.set(decodedIndex, match[1] as `S${number}`);
  }

  return offsets;
}

function citationTextNodes(
  node: Text,
  source: string,
  citationIds: ReadonlySet<string>,
): Text[] {
  const rawOffsets = rawCitationOffsets(node, source);
  if (rawOffsets === null) return [node];

  const children: Text[] = [];
  let cursor = 0;

  for (const match of node.value.matchAll(CITATION_PATTERN)) {
    const marker = match[0];
    const id = match[1] as `S${number}`;
    const index = match.index;

    if (index > cursor) {
      children.push({ type: 'text', value: node.value.slice(cursor, index) });
    }

    if (citationIds.has(id) && rawOffsets.get(index) === id) {
      children.push({
        type: 'text',
        value: marker,
        data: {
          hName: 'span',
          hProperties: { 'data-egregore-citation': id },
        },
      } as CitationText);
    } else {
      children.push({ type: 'text', value: marker });
    }
    cursor = index + marker.length;
  }

  if (cursor === 0) return [node];
  if (cursor < node.value.length) {
    children.push({ type: 'text', value: node.value.slice(cursor) });
  }
  return children;
}

function updateRawHtmlStack(value: string, stack: string[]): void {
  const tagPattern = /<\/?([A-Za-z][A-Za-z0-9-]*)\b[^>]*>/gu;
  for (const match of value.matchAll(tagPattern)) {
    const tag = match[1].toLowerCase();
    const token = match[0];
    if (token.startsWith('</')) {
      const matchIndex = stack.lastIndexOf(tag);
      if (matchIndex >= 0) stack.splice(matchIndex);
    } else if (!token.endsWith('/>') && !VOID_HTML_ELEMENTS.has(tag)) {
      stack.push(tag);
    }
  }
}

function constrainChildren(
  parent: MutableParent,
  source: string,
  citationIds: ReadonlySet<string>,
  ancestors: readonly string[],
): void {
  const nextChildren: RootContent[] = [];
  const rawHtmlStack: string[] = [];

  for (const child of parent.children) {
    if (child.type === 'link' && containsImage(child)) {
      const value = textFromUnsupported(child, source);
      if (value) nextChildren.push({ type: 'text', value });
      continue;
    }

    if (!PARSED_NODE_ALLOWLIST.has(child.type)) {
      const value = textFromUnsupported(child, source);
      if (value) nextChildren.push({ type: 'text', value });
      if (child.type === 'html') updateRawHtmlStack(child.value, rawHtmlStack);
      continue;
    }

    if (child.type === 'text') {
      const citationsBlocked =
        rawHtmlStack.length > 0 ||
        ancestors.some((type) => CITATION_BLOCKING_ANCESTORS.has(type));
      nextChildren.push(
        ...(citationsBlocked
          ? [child]
          : citationTextNodes(child, source, citationIds)),
      );
      continue;
    }

    if (child.type === 'listItem') {
      delete (child as ListItem).checked;
    }

    if (isParent(child)) {
      constrainChildren(child, source, citationIds, [...ancestors, child.type]);
    }
    nextChildren.push(child);
  }

  parent.children = nextChildren;
}

export const remarkCitations: Plugin<[RemarkCitationsOptions], Root> =
  function remarkCitationsPlugin(options) {
    const citationIds = new Set(options.citationIds);

    return (tree, file) => {
      constrainChildren(tree, String(file.value), citationIds, ['root']);
    };
  };
