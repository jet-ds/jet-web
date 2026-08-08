import { createHash } from 'node:crypto';
import { estimateTokens } from '../tokenEstimate';
import type {
  ChunkId,
  DocumentId,
  KnowledgeChunk,
  KnowledgeSection,
  NormalizedSection,
  SectionId,
} from './types';

export { estimateTokens } from '../tokenEstimate';

export const SEGMENTATION_VERSION = '1.0.0' as const;
export const SEGMENTATION = {
  targetTokens: 256,
  maxTokens: 512,
  overlapTokens: 32,
} as const;

interface SegmentDocumentInput {
  documentId: DocumentId;
  sections: NormalizedSection[];
}

interface SegmentDocumentOptions {
  digest?: (text: string) => string;
}

interface SegmentedDocument {
  sections: KnowledgeSection[];
  chunks: KnowledgeChunk[];
}

interface TextBlock {
  text: string;
  code: boolean;
}

const TARGET_CHARACTERS = SEGMENTATION.targetTokens * 4;
const MAX_CHARACTERS = SEGMENTATION.maxTokens * 4;
const OVERLAP_CHARACTERS = SEGMENTATION.overlapTokens * 4;

function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .normalize('NFC');
}

function defaultDigest(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function readBlocks(text: string): TextBlock[] {
  const lines = normalizeText(text).split('\n');
  const blocks: TextBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    while (index < lines.length && lines[index].trim() === '') {
      index += 1;
    }
    if (index >= lines.length) {
      break;
    }

    const openingFence = lines[index].match(/^\s*(`{3,}|~{3,})/);
    if (openingFence) {
      const fenceCharacter = openingFence[1][0];
      const fenceLength = openingFence[1].length;
      const codeLines = [lines[index]];
      index += 1;

      while (index < lines.length) {
        const line = lines[index];
        codeLines.push(line);
        index += 1;

        const closingFence = line.trim().match(/^(`+|~+)\s*$/);
        if (
          closingFence &&
          closingFence[1][0] === fenceCharacter &&
          closingFence[1].length >= fenceLength
        ) {
          break;
        }
      }

      blocks.push({ text: normalizeText(codeLines.join('\n')), code: true });
      continue;
    }

    const proseLines: string[] = [];
    while (index < lines.length && lines[index].trim() !== '') {
      proseLines.push(lines[index]);
      index += 1;
    }
    const block = normalizeText(proseLines.join('\n'));
    if (block) {
      blocks.push({ text: block, code: false });
    }
  }

  return blocks;
}

function preferredCut(text: string, limit: number): number {
  if (text.length <= limit) {
    return text.length;
  }

  const lineBoundary = text.lastIndexOf('\n', limit);
  const wordBoundary = text.lastIndexOf(' ', limit);
  const boundary = Math.max(lineBoundary, wordBoundary);
  return boundary >= Math.floor(limit / 2) ? boundary : limit;
}

function splitText(text: string, limit: number): string[] {
  const parts: string[] = [];
  let remaining = normalizeText(text);

  while (remaining.length > limit) {
    const cut = preferredCut(remaining, limit);
    const part = remaining.slice(0, cut).trim();
    if (part) {
      parts.push(part);
    }
    remaining = remaining.slice(cut).trimStart();
  }

  if (remaining) {
    parts.push(remaining);
  }
  return parts;
}

function splitCodeBlock(text: string): string[] {
  if (estimateTokens(text) <= SEGMENTATION.maxTokens) {
    return [text];
  }

  const lines = text.split('\n');
  const opening = lines[0];
  const openingMatch = opening.match(/^\s*(`{3,}|~{3,})(.*)$/);
  const closing = lines.at(-1)?.trim() ?? '';
  if (
    !openingMatch ||
    !new RegExp(`^\\${openingMatch[1][0]}{${openingMatch[1].length},}$`).test(
      closing,
    )
  ) {
    return splitText(text, MAX_CHARACTERS);
  }

  const fence = openingMatch[1];
  const language = openingMatch[2].trim();
  const wrapperLength = fence.length * 2 + language.length + 2;
  const contentLimit = MAX_CHARACTERS - wrapperLength;
  if (contentLimit < 1) {
    return splitText(text, MAX_CHARACTERS);
  }

  const content = lines.slice(1, -1).join('\n');
  return splitText(content, contentLimit).map(
    (part) => `${fence}${language}\n${part}\n${fence}`,
  );
}

function overlapTail(text: string): string {
  if (text.length <= OVERLAP_CHARACTERS) {
    return text;
  }

  const tail = text.slice(-OVERLAP_CHARACTERS);
  const firstBoundary = tail.search(/\s/);
  return firstBoundary >= 0 ? tail.slice(firstBoundary + 1).trimStart() : tail;
}

function joinBlocks(left: string, right: string): string {
  return left ? `${left}\n\n${right}` : right;
}

function chunkSection(text: string): string[] {
  const chunks: string[] = [];
  let current = '';

  const flush = (): string => {
    const chunk = normalizeText(current);
    if (chunk) {
      chunks.push(chunk);
    }
    current = '';
    return chunk;
  };

  for (const block of readBlocks(text)) {
    if (block.code) {
      flush();
      chunks.push(...splitCodeBlock(block.text));
      continue;
    }

    for (const unit of splitText(block.text, TARGET_CHARACTERS)) {
      const candidate = joinBlocks(current, unit);
      if (!current || estimateTokens(candidate) <= SEGMENTATION.targetTokens) {
        current = candidate;
        continue;
      }

      const previous = flush();
      const overlap = overlapTail(previous);
      const overlappedCandidate = joinBlocks(overlap, unit);
      current =
        estimateTokens(overlappedCandidate) <= SEGMENTATION.maxTokens
          ? overlappedCandidate
          : unit;
    }
  }

  flush();

  for (const chunk of chunks) {
    if (estimateTokens(chunk) > SEGMENTATION.maxTokens) {
      throw new Error('Knowledge chunk exceeds the 512-token hard limit.');
    }
  }
  return chunks;
}

function slugifyHeadingPath(headingPath: string[]): string {
  const slug = headingPath
    .join(' ')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

function sectionId(
  documentId: DocumentId,
  headingPath: string[],
  occurrences: Map<string, number>,
  reservedIds: Set<SectionId>,
): SectionId {
  const slug = slugifyHeadingPath(headingPath);
  let occurrence = (occurrences.get(slug) ?? 0) + 1;
  let uniqueSlug = occurrence === 1 ? slug : `${slug}-${occurrence}`;
  let id = `${documentId}#${uniqueSlug}` as SectionId;
  while (reservedIds.has(id)) {
    occurrence += 1;
    uniqueSlug = `${slug}-${occurrence}`;
    id = `${documentId}#${uniqueSlug}`;
  }

  occurrences.set(slug, occurrence);
  reservedIds.add(id);
  return id;
}

export function segmentDocument(
  input: SegmentDocumentInput,
  options: SegmentDocumentOptions = {},
): SegmentedDocument {
  const digest = options.digest ?? defaultDigest;
  const sectionOccurrences = new Map<string, number>();
  const reservedSectionIds = new Set<SectionId>();
  const finalChunkIds = new Set<ChunkId>();
  const sections: KnowledgeSection[] = [];
  const chunks: KnowledgeChunk[] = [];

  for (const normalizedSection of input.sections) {
    const id = sectionId(
      input.documentId,
      normalizedSection.headingPath,
      sectionOccurrences,
      reservedSectionIds,
    );
    sections.push({
      id,
      documentId: input.documentId,
      heading: normalizedSection.heading,
      headingPath: [...normalizedSection.headingPath],
      order: normalizedSection.order,
    });

    const sameTextOccurrences = new Map<string, number>();
    for (const text of chunkSection(normalizedSection.text)) {
      const normalizedText = normalizeText(text);
      const contentHash = digest(normalizedText).toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(contentHash)) {
        throw new Error('Digest provider must return a full SHA-256 digest.');
      }

      const sameTextOccurrence = sameTextOccurrences.get(normalizedText) ?? 0;
      sameTextOccurrences.set(normalizedText, sameTextOccurrence + 1);
      const chunkId = `${id}:${contentHash}:${sameTextOccurrence}` as ChunkId;
      if (finalChunkIds.has(chunkId)) {
        throw new Error(`Duplicate chunk id: ${chunkId}`);
      }
      finalChunkIds.add(chunkId);

      chunks.push({
        id: chunkId,
        documentId: input.documentId,
        sectionId: id,
        text: normalizedText,
        estimatedTokens: estimateTokens(normalizedText),
        order: chunks.length,
        contentHash,
        sameTextOccurrence,
      });
    }
  }

  return { sections, chunks };
}
