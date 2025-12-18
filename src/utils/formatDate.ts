/**
 * Format a date to a readable string
 * @param date - Date to format (Date object or string)
 * @param format - Format style ('long', 'medium', 'short')
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string,
  format: 'long' | 'medium' | 'short' = 'medium'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Validate date
  if (isNaN(dateObj.getTime())) {
    console.error('Invalid date:', date);
    return 'Invalid Date';
  }

  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'UTC', // Use UTC to avoid timezone shifts
  };

  switch (format) {
    case 'long':
      // Example: "December 18, 2025"
      options.year = 'numeric';
      options.month = 'long';
      options.day = 'numeric';
      break;
    case 'medium':
      // Example: "Dec 18, 2025"
      options.year = 'numeric';
      options.month = 'short';
      options.day = 'numeric';
      break;
    case 'short':
      // Example: "12/18/2025"
      options.year = 'numeric';
      options.month = 'numeric';
      options.day = 'numeric';
      break;
  }

  return dateObj.toLocaleDateString('en-US', options);
}

/**
 * Format a date relative to now (e.g., "2 days ago", "3 months ago")
 * @param date - Date to format
 * @returns Relative time string
 */
export function formatRelativeDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) {
    return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
  } else if (diffMonths > 0) {
    return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
  } else if (diffWeeks > 0) {
    return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
  } else if (diffDays > 0) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
  } else {
    return 'just now';
  }
}

/**
 * Get ISO date string (YYYY-MM-DD) for HTML time elements
 * @param date - Date to format
 * @returns ISO date string
 */
export function getISODate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().split('T')[0];
}
