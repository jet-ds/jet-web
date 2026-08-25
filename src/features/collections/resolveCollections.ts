import { isPublished, type PublicationData } from '../../content/policy';
import { formatDate } from '../../utils/formatDate';
import { getReadingTimeText } from '../../utils/readingTime';
import type { CollectionDisplayRecord, CollectionImage } from './types';

interface BlogEntryData extends PublicationData {
  title?: string;
  shortTitle?: string;
  description?: string;
  summary?: string;
  pubDate?: Date;
  tags?: readonly string[];
  image?: EntryImage;
}

interface WorkEntryData extends PublicationData {
  title?: string;
  shortTitle?: string;
  description?: string;
  summary?: string;
  type?: 'research' | 'project' | 'other';
  date?: Date;
  tags?: readonly string[];
  image?: EntryImage;
  venue?: string;
  homepagePriority?: number;
}

export interface BlogEntry {
  id: string;
  body?: string;
  data: BlogEntryData;
}

export interface WorkEntry {
  id: string;
  body?: string;
  data: WorkEntryData;
}

const HOMEPAGE_MAXIMUM = 5;

interface EntryImage {
  url: string;
  darkUrl?: string;
  alt: string;
  width: number;
  height: number;
}

function compareCodeUnitIds(left: string, right: string): number {
  const normalizedLeft = left.normalize('NFC');
  const normalizedRight = right.normalize('NFC');
  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  return 0;
}

function compareDatesDescending(left: Date, right: Date): number {
  return right.getTime() - left.getTime();
}

function requireField<T>(
  entryId: string,
  field: string,
  value: T | undefined,
): T {
  if (value === undefined) {
    throw new Error(`Published content ${entryId} is missing ${field}.`);
  }
  return value;
}

function resolveLimit(limit: number | undefined): number {
  const resolved = limit ?? HOMEPAGE_MAXIMUM;
  if (
    !Number.isInteger(resolved) ||
    resolved <= 0 ||
    resolved > HOMEPAGE_MAXIMUM
  ) {
    throw new RangeError(
      `Homepage collection limit must be an integer from 1 to ${HOMEPAGE_MAXIMUM}.`,
    );
  }
  return resolved;
}

function adaptImage(entryId: string, image: EntryImage): CollectionImage {
  if (image.width !== 1920) {
    throw new Error(`Published content ${entryId} image.width must be 1920.`);
  }
  if (image.height !== 1080) {
    throw new Error(`Published content ${entryId} image.height must be 1080.`);
  }
  return {
    url: image.url,
    ...(image.darkUrl === undefined ? {} : { darkUrl: image.darkUrl }),
    alt: image.alt,
    width: 1920,
    height: 1080,
  };
}

function compareBlogEntries(left: BlogEntry, right: BlogEntry): number {
  const leftDate = requireField(left.id, 'pubDate', left.data.pubDate);
  const rightDate = requireField(right.id, 'pubDate', right.data.pubDate);
  return (
    compareDatesDescending(leftDate, rightDate) ||
    compareCodeUnitIds(left.id, right.id)
  );
}

function compareWorkEntries(left: WorkEntry, right: WorkEntry): number {
  const leftDate = requireField(left.id, 'date', left.data.date);
  const rightDate = requireField(right.id, 'date', right.data.date);
  return (
    compareDatesDescending(leftDate, rightDate) ||
    compareCodeUnitIds(left.id, right.id)
  );
}

function compareHomepageWorks(left: WorkEntry, right: WorkEntry): number {
  const leftPriority = left.data.homepagePriority;
  const rightPriority = right.data.homepagePriority;
  if (leftPriority !== undefined || rightPriority !== undefined) {
    if (leftPriority === undefined) return 1;
    if (rightPriority === undefined) return -1;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
  }
  return compareWorkEntries(left, right);
}

function adaptBlog(entry: BlogEntry): CollectionDisplayRecord {
  const data = entry.data;
  const title = requireField(entry.id, 'title', data.title);
  const description = requireField(entry.id, 'description', data.description);
  const summary = requireField(entry.id, 'summary', data.summary);
  const pubDate = requireField(entry.id, 'pubDate', data.pubDate);
  const tags = requireField(entry.id, 'tags', data.tags);
  const image = adaptImage(
    entry.id,
    requireField(entry.id, 'image', data.image),
  );

  return {
    id: entry.id,
    href: `/blog/${entry.id}/`,
    kind: 'blog',
    title: data.shortTitle ?? title,
    summary,
    image,
    date: pubDate.toISOString(),
    facts: [formatDate(pubDate), getReadingTimeText(entry.body ?? '')],
    search: {
      title,
      shortTitle: data.shortTitle,
      description,
      summary,
      tags: [...tags],
    },
  };
}

function adaptWork(entry: WorkEntry): CollectionDisplayRecord {
  const data = entry.data;
  const title = requireField(entry.id, 'title', data.title);
  const summary = requireField(entry.id, 'summary', data.summary);
  const type = requireField(entry.id, 'type', data.type);
  const date = requireField(entry.id, 'date', data.date);
  const image = adaptImage(
    entry.id,
    requireField(entry.id, 'image', data.image),
  );
  const facts = [formatDate(date)];
  if (type === 'research' && data.venue) facts.push(data.venue);

  return {
    id: entry.id,
    href: `/works/${entry.id}/`,
    kind: type,
    title: data.shortTitle ?? title,
    summary,
    image,
    date: date.toISOString(),
    facts,
  };
}

function publishedBlogs(entries: readonly BlogEntry[]): BlogEntry[] {
  return entries.filter((entry) => isPublished(entry.data));
}

function publishedWorks(entries: readonly WorkEntry[]): WorkEntry[] {
  return entries.filter((entry) => isPublished(entry.data));
}

export function resolveBlogCollection(
  entries: readonly BlogEntry[],
): readonly CollectionDisplayRecord[] {
  return publishedBlogs(entries).sort(compareBlogEntries).map(adaptBlog);
}

export function resolveWorksCollection(
  entries: readonly WorkEntry[],
): readonly CollectionDisplayRecord[] {
  return publishedWorks(entries).sort(compareWorkEntries).map(adaptWork);
}

export function resolveHomepageBlog(
  entries: readonly BlogEntry[],
  limit?: number,
): readonly CollectionDisplayRecord[] {
  const resolvedLimit = resolveLimit(limit);
  return resolveBlogCollection(entries).slice(0, resolvedLimit);
}

export function resolveHomepageWorks(
  entries: readonly WorkEntry[],
  limit?: number,
): readonly CollectionDisplayRecord[] {
  const resolvedLimit = resolveLimit(limit);
  return publishedWorks(entries)
    .sort(compareHomepageWorks)
    .slice(0, resolvedLimit)
    .map(adaptWork);
}
