/**
 * Show time to first review per developer.
 */

import { fetchMergedPRs, fetchPRReviews } from '../../github/index.js';
import { formatDuration, median } from '../utils.js';

export function firstReview(
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
    const prReviews = fetchPRReviews(owner, repo, pr.number);
    if (prReviews.length === 0) continue;

    const created = new Date(pr.created_at).getTime();
    const author = pr.user.login;

    let firstReviewTime: number | null = null;
    for (const review of prReviews) {
      if (review.submitted_at) {
        const reviewTime = new Date(review.submitted_at).getTime();
        if (firstReviewTime === null || reviewTime < firstReviewTime) {
          firstReviewTime = reviewTime;
        }
      }
    }

    if (firstReviewTime !== null) {
      const waitTimeMs = firstReviewTime - created;
      if (waitTimeMs > 0) {
        if (!authorTimes.has(author)) {
          authorTimes.set(author, []);
        }
        authorTimes.get(author)!.push(waitTimeMs);
        allTimes.push(waitTimeMs);
      }
    }
  }

  if (allTimes.length === 0) {
    console.log('No reviews found in the specified time range.');
    return;
  }

  console.log('## Time to First Review');
  console.log('*PRs merged to develop*');
  console.log();
  console.log('| Developer | PRs | Avg Wait | Median Wait | Fastest | Slowest |');
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
