import { SITE } from '../../config/site';
import {
  resolveBlogCollection,
  resolveWorksCollection,
  type BlogEntry,
  type WorkEntry,
} from '../collections/resolveCollections';
import type { CollectionDisplayRecord } from '../collections/types';

export interface LlmsTextInput {
  siteName: string;
  siteDescription: string;
  blog: readonly CollectionDisplayRecord[];
  works: readonly CollectionDisplayRecord[];
}

export interface ResolveLlmsTextInput {
  siteName: string;
  siteDescription: string;
  blogEntries: readonly BlogEntry[];
  workEntries: readonly WorkEntry[];
}

function escapeLinkLabel(value: string): string {
  return value.replace(/[[\]\\]/gu, '\\$&');
}

function oneLine(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function canonicalUrl(href: string): string {
  return href.startsWith('/') ? new URL(href, SITE.siteUrl).toString() : href;
}

function renderItems(records: readonly CollectionDisplayRecord[]): string {
  return records
    .map(
      (record) =>
        `- [${escapeLinkLabel(oneLine(record.title))}](${canonicalUrl(record.href)}): ${oneLine(record.summary)}`,
    )
    .join('\n');
}

export function renderLlmsText(input: LlmsTextInput): string {
  return `# ${input.siteName}
> ${oneLine(input.siteDescription)}

## Main
- [About](https://jetsanchez.com/about/): About Jet Sanchez
- [Blog](https://jetsanchez.com/blog/): Essays and analysis
- [Works](https://jetsanchez.com/works/): Research and projects
- [Egregore](https://jetsanchez.com/chatbot/): A local-first personal assistant

## Articles
${renderItems(input.blog)}

## Works
${renderItems(input.works)}
`;
}

export function resolveLlmsText(input: ResolveLlmsTextInput): string {
  return renderLlmsText({
    siteName: input.siteName,
    siteDescription: input.siteDescription,
    blog: resolveBlogCollection(input.blogEntries),
    works: resolveWorksCollection(input.workEntries),
  });
}
