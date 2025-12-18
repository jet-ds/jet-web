/**
 * Type for items that have a date property
 */
export interface DateItem {
  data: {
    date?: Date;
    pubDate?: Date;
    [key: string]: any;
  };
}

/**
 * Sort items by date in descending order (newest first)
 * Works with both blog posts (pubDate) and works (date)
 * @param items - Array of items with date properties
 * @param order - Sort order ('desc' for newest first, 'asc' for oldest first)
 * @returns Sorted array
 */
export function sortByDate<T extends DateItem>(
  items: T[],
  order: 'desc' | 'asc' = 'desc'
): T[] {
  return [...items].sort((a, b) => {
    // Get the date from either 'date' or 'pubDate' property
    const dateA = a.data.pubDate || a.data.date;
    const dateB = b.data.pubDate || b.data.date;

    // Handle missing dates (push to end)
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    const timeA = new Date(dateA).getTime();
    const timeB = new Date(dateB).getTime();

    // Sort based on order
    return order === 'desc' ? timeB - timeA : timeA - timeB;
  });
}

/**
 * Sort blog posts by publication date (newest first)
 * @param posts - Array of blog posts
 * @param order - Sort order
 * @returns Sorted array
 */
export function sortBlogPosts<T extends { data: { pubDate: Date } }>(
  posts: T[],
  order: 'desc' | 'asc' = 'desc'
): T[] {
  return [...posts].sort((a, b) => {
    const timeA = new Date(a.data.pubDate).getTime();
    const timeB = new Date(b.data.pubDate).getTime();
    return order === 'desc' ? timeB - timeA : timeA - timeB;
  });
}

/**
 * Sort works by date (newest first)
 * @param works - Array of works
 * @param order - Sort order
 * @returns Sorted array
 */
export function sortWorks<T extends { data: { date: Date } }>(
  works: T[],
  order: 'desc' | 'asc' = 'desc'
): T[] {
  return [...works].sort((a, b) => {
    const timeA = new Date(a.data.date).getTime();
    const timeB = new Date(b.data.date).getTime();
    return order === 'desc' ? timeB - timeA : timeA - timeB;
  });
}
