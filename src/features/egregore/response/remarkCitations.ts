import type { ListItem, Root, RootContent, Text } from 'mdast';
import type { Plugin } from 'unified';

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

function isParent<T extends RootContent | Root>(
  node: T,
): node is T & MutableParent {
  return 'children' in node && Array.isArray(node.children);
}

function textFromUnsupported(node: RootContent, source: string): string {
  if (node.type === 'html') return node.value;
  if (node.type === 'text') return node.value;
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

function rawCitationEscapes(node: Text, source: string): boolean[] | null {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return null;

  const raw = source.slice(start, end);
  const escapes: boolean[] = [];

  for (const match of raw.matchAll(CITATION_PATTERN)) {
    const markerIndex = match.index;
    let backslashes = 0;
    let cursor = markerIndex - 1;
    while (cursor >= 0 && raw[cursor] === '\\') {
      backslashes += 1;
      cursor -= 1;
    }
    escapes.push(backslashes % 2 === 1);
  }

  return escapes;
}

function citationTextNodes(
  node: Text,
  source: string,
  citationIds: ReadonlySet<string>,
): Text[] {
  const rawEscapes = rawCitationEscapes(node, source);
  if (rawEscapes === null) return [node];

  const children: Text[] = [];
  let cursor = 0;
  let citationIndex = 0;

  for (const match of node.value.matchAll(CITATION_PATTERN)) {
    const marker = match[0];
    const id = match[1] as `S${number}`;
    const index = match.index;
    const escaped = rawEscapes[citationIndex] ?? true;
    citationIndex += 1;

    if (index > cursor) {
      children.push({ type: 'text', value: node.value.slice(cursor, index) });
    }

    if (citationIds.has(id) && !escaped) {
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

function constrainChildren(
  parent: MutableParent,
  source: string,
  citationIds: ReadonlySet<string>,
  ancestors: readonly string[],
): void {
  const nextChildren: RootContent[] = [];

  for (const child of parent.children) {
    if (!PARSED_NODE_ALLOWLIST.has(child.type)) {
      const value = textFromUnsupported(child, source);
      if (value) nextChildren.push({ type: 'text', value });
      continue;
    }

    if (child.type === 'text') {
      const citationsBlocked = ancestors.some((type) =>
        CITATION_BLOCKING_ANCESTORS.has(type),
      );
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
