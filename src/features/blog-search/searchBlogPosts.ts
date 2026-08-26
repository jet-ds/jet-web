export interface SearchableBlogRecord {
  id: string;
  title: string;
  shortTitle?: string;
  description: string;
  summary: string;
  tags: readonly string[];
  pubDate: string;
}

type SearchScore = readonly [
  exactTitle: number,
  titlePhrase: number,
  exactTitleTokens: number,
  prefixTitleTokens: number,
  exactTags: number,
  exactTagTokens: number,
  prefixTagTokens: number,
  exactSummaryTokens: number,
  prefixSummaryTokens: number,
  exactDescriptionTokens: number,
  prefixDescriptionTokens: number,
];

type ScoredRecord = {
  record: SearchableBlogRecord;
  score: SearchScore;
};

const TOKEN_BOUNDARY = /[^\p{L}\p{N}]+/u;
const COMBINING_MARK = /\p{M}/gu;

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(COMBINING_MARK, '')
    .trim();
}

function tokens(value: string): string[] {
  const normalized = normalizeSearchText(value);
  return normalized === ''
    ? []
    : normalized.split(TOKEN_BOUNDARY).filter(Boolean);
}

function distinctTokens(value: string): string[] {
  return [...new Set(tokens(value))];
}

function countPresent(queryTokens: readonly string[], field: Set<string>) {
  return queryTokens.filter((token) => field.has(token)).length;
}

function hasTokenPrefix(field: Set<string>, queryToken: string): boolean {
  for (const fieldToken of field) {
    if (fieldToken.startsWith(queryToken)) return true;
  }
  return false;
}

function countPrefixPresent(
  queryTokens: readonly string[],
  field: Set<string>,
): number {
  return queryTokens.filter((queryToken) => hasTokenPrefix(field, queryToken))
    .length;
}

function compareCodeUnitIds(left: string, right: string): number {
  const normalizedLeft = left.normalize('NFC');
  const normalizedRight = right.normalize('NFC');
  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  return 0;
}

function compareCanonicalDates(
  left: SearchableBlogRecord,
  right: SearchableBlogRecord,
): number {
  return (
    Date.parse(right.pubDate) - Date.parse(left.pubDate) ||
    compareCodeUnitIds(left.id, right.id)
  );
}

function compareScores(left: SearchScore, right: SearchScore): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = right[index] - left[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

function scoreRecord(
  record: SearchableBlogRecord,
  normalizedQuery: string,
  queryTokens: readonly string[],
): SearchScore | undefined {
  const normalizedTitles = [record.title, record.shortTitle]
    .filter((title): title is string => title !== undefined)
    .map(normalizeSearchText);
  const titleTokens = new Set(normalizedTitles.flatMap(tokens));
  const summaryTokens = new Set(tokens(record.summary));
  const descriptionTokens = new Set(tokens(record.description));
  const normalizedTags = record.tags.map(normalizeSearchText);
  const tagTokens = new Set(normalizedTags.flatMap(tokens));
  const indexedTokens = new Set([
    ...titleTokens,
    ...tagTokens,
    ...summaryTokens,
    ...descriptionTokens,
  ]);

  if (
    queryTokens.some((queryToken) => !hasTokenPrefix(indexedTokens, queryToken))
  ) {
    return undefined;
  }

  const queryTokenSet = new Set(queryTokens);
  return [
    Number(normalizedTitles.some((title) => title === normalizedQuery)),
    Number(normalizedTitles.some((title) => title.includes(normalizedQuery))),
    countPresent(queryTokens, titleTokens),
    countPrefixPresent(queryTokens, titleTokens),
    normalizedTags.filter(
      (tag) => tag === normalizedQuery || queryTokenSet.has(tag),
    ).length,
    countPresent(queryTokens, tagTokens),
    countPrefixPresent(queryTokens, tagTokens),
    countPresent(queryTokens, summaryTokens),
    countPrefixPresent(queryTokens, summaryTokens),
    countPresent(queryTokens, descriptionTokens),
    countPrefixPresent(queryTokens, descriptionTokens),
  ];
}

export function searchBlogPosts(
  records: readonly SearchableBlogRecord[],
  query: string,
): readonly SearchableBlogRecord[] {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = distinctTokens(normalizedQuery);

  if (queryTokens.length === 0) {
    return [...records].sort(compareCanonicalDates);
  }

  return records
    .flatMap((record): ScoredRecord[] => {
      const score = scoreRecord(record, normalizedQuery, queryTokens);
      return score === undefined ? [] : [{ record, score }];
    })
    .sort(
      (left, right) =>
        compareScores(left.score, right.score) ||
        compareCanonicalDates(left.record, right.record),
    )
    .map(({ record }) => record);
}
