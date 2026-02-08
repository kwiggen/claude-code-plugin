/**
 * Shared utility functions for insights actions.
 */

/**
 * Format ISO date to readable format (e.g., "Jan 15").
 */
export function formatDate(isoDate: string): string {
  const dt = new Date(isoDate);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[dt.getUTCMonth()]} ${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Format milliseconds to human readable string.
 */
export function formatDuration(ms: number): string {
  const totalHours = ms / (1000 * 60 * 60);
  if (totalHours < 1) {
    const minutes = Math.floor(ms / (1000 * 60));
    return `${minutes} min`;
  } else if (totalHours < 24) {
    return `${totalHours.toFixed(1)} hrs`;
  } else {
    const days = totalHours / 24;
    return `${days.toFixed(1)} days`;
  }
}

/**
 * Calculate median of a number array.
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Truncate a string to a max length, appending "..." if truncated.
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length > maxLen) {
    return str.slice(0, maxLen) + '...';
  }
  return str;
}

/**
 * Print a visual separator between reports.
 */
export function printReportSeparator(title: string): void {
  console.log('\n');
  console.log('='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
  console.log();
}

/**
 * Format a number with commas (e.g., 1234 → "1,234").
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Day names indexed by getUTCDay() (0=Sunday).
 */
export const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

/**
 * Weekday names in Monday-Friday order for reporting.
 */
export const WEEKDAY_NAMES = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
];
