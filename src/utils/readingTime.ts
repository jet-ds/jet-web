/**
 * Calculate reading time for content
 * @param content - The content to analyze (string or markdown)
 * @returns Reading time in minutes
 */
export function getReadingTime(content: string): number {
  // Remove markdown syntax and HTML tags for accurate word count
  const cleanContent = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]*`/g, '') // Remove inline code
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with link text
    .replace(/[#*_~]/g, '') // Remove markdown formatting characters
    .trim();

  // Count words (split by whitespace)
  const words = cleanContent.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;

  // Average reading speed: 200-250 words per minute
  // Using 225 as a middle ground
  const wordsPerMinute = 225;
  const minutes = wordCount / wordsPerMinute;

  // Round up to nearest minute, minimum 1 minute
  return Math.max(1, Math.ceil(minutes));
}

/**
 * Get a formatted reading time string
 * @param content - The content to analyze
 * @returns Formatted string like "5 min read"
 */
export function getReadingTimeText(content: string): string {
  const minutes = getReadingTime(content);
  return `${minutes} min read`;
}
