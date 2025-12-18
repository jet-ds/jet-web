/**
 * Type for items that have a tags property
 */
export interface TaggedItem {
  data: {
    tags: string[];
    [key: string]: any;
  };
}

/**
 * Filter items by a specific tag
 * @param items - Array of items with tags property
 * @param tag - Tag to filter by (case-insensitive)
 * @returns Filtered array containing only items with the specified tag
 */
export function filterByTag<T extends TaggedItem>(items: T[], tag: string): T[] {
  const lowerTag = tag.toLowerCase();
  return items.filter((item) =>
    item.data.tags.some((t) => t.toLowerCase() === lowerTag)
  );
}

/**
 * Filter items by multiple tags (items must have ALL tags)
 * @param items - Array of items with tags property
 * @param tags - Array of tags to filter by (case-insensitive)
 * @returns Filtered array containing only items with all specified tags
 */
export function filterByAllTags<T extends TaggedItem>(
  items: T[],
  tags: string[]
): T[] {
  const lowerTags = tags.map((t) => t.toLowerCase());
  return items.filter((item) =>
    lowerTags.every((tag) =>
      item.data.tags.some((t) => t.toLowerCase() === tag)
    )
  );
}

/**
 * Filter items by multiple tags (items must have ANY of the tags)
 * @param items - Array of items with tags property
 * @param tags - Array of tags to filter by (case-insensitive)
 * @returns Filtered array containing items with at least one of the specified tags
 */
export function filterByAnyTag<T extends TaggedItem>(
  items: T[],
  tags: string[]
): T[] {
  const lowerTags = tags.map((t) => t.toLowerCase());
  return items.filter((item) =>
    item.data.tags.some((t) => lowerTags.includes(t.toLowerCase()))
  );
}

/**
 * Get all unique tags from a collection of items
 * @param items - Array of items with tags property
 * @returns Sorted array of unique tags
 */
export function getAllTags<T extends TaggedItem>(items: T[]): string[] {
  const tagSet = new Set<string>();

  items.forEach((item) => {
    item.data.tags.forEach((tag) => {
      tagSet.add(tag);
    });
  });

  // Return sorted array (case-insensitive sort)
  return Array.from(tagSet).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
}

/**
 * Get tag counts for a collection of items
 * @param items - Array of items with tags property
 * @returns Object with tag names as keys and counts as values
 */
export function getTagCounts<T extends TaggedItem>(
  items: T[]
): Record<string, number> {
  const counts: Record<string, number> = {};

  items.forEach((item) => {
    item.data.tags.forEach((tag) => {
      counts[tag] = (counts[tag] || 0) + 1;
    });
  });

  return counts;
}
