/**
 * Show time-to-merge statistics per developer.
 */

import { fetchMergedPRs } from '../../github/index.js';
import { formatDuration, median } from '../utils.js';

export function timeToMerge(
  owner: string,
  repo: string,
  since: Date
): void {
  const prs = fetchMergedPRs(owner, repo, since);

  if (prs.length === 0) {
    console.log('No PRs merged in the specified time range.');
    return;
  }

  const authorTimes = new Map<string, number[]>();
  const allTimes: number[] = [];

  for (const pr of prs) {
    if (!pr.merged_at) continue;
    const created = new Date(pr.created_at).getTime();
    const merged = new Date(pr.merged_at).getTime();
    const mergeTimeMs = merged - created;
    const author = pr.user.login;

    if (!authorTimes.has(author)) {
      authorTimes.set(author, []);
    }
    authorTimes.get(author)!.push(mergeTimeMs);
    allTimes.push(mergeTimeMs);
  }

  console.log('## Time to Merge');
  console.log('*PRs merged to develop*');
  console.log();
  console.log('| Developer | PRs | Avg Time | Median Time | Fastest | Slowest |');
  console.log('|-----------|-----|----------|-------------|---------|---------|');

  const sorted = [...authorTimes.entries()].sort(
    (a, b) => b[1].length - a[1].length
  );

  for (const [author, times] of sorted) {
    const count = times.length;
    const avg = times.reduce((a, b) => a + b, 0) / count;
    const med = median(times);
    const fastest = Math.min(...times);
    const slowest = Math.max(...times);
    console.log(
      `| @${author} | ${count} | ${formatDuration(avg)} | ` +
      `${formatDuration(med)} | ${formatDuration(fastest)} | ` +
      `${formatDuration(slowest)} |`
    );
  }

  if (allTimes.length > 0) {
    console.log();
    const teamAvg = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
    const teamMedian = median(allTimes);
    console.log(
      `**Team Average:** ${formatDuration(teamAvg)} | ` +
      `**Team Median:** ${formatDuration(teamMedian)}`
    );
  }
}
