/**
 * Show review participation report.
 */

import { fetchMergedPRs, fetchPRReviews } from '../../github/index.js';
import type { PRResponse } from '../../github/index.js';

export function reviews(
  owner: string,
  repo: string,
  since: Date,
  prefetchedPrs?: PRResponse[]
): void {
  const prs = prefetchedPrs ?? fetchMergedPRs(owner, repo, since);

  if (prs.length === 0) {
    console.log('No PRs merged in the specified time range.');
    return;
  }

  const reviewerStats = new Map<string, Map<string, number>>();
  const reviewerTotals = new Map<string, number>();

  for (const pr of prs) {
    const author = pr.user.login;
    const prReviews = fetchPRReviews(owner, repo, pr.number);

    const seenReviewers = new Set<string>();
    for (const review of prReviews) {
      const reviewer = review.user.login;
      if (reviewer !== author && !seenReviewers.has(reviewer)) {
        if (!reviewerStats.has(reviewer)) {
          reviewerStats.set(reviewer, new Map());
        }
        const authorMap = reviewerStats.get(reviewer)!;
        authorMap.set(author, (authorMap.get(author) ?? 0) + 1);
        reviewerTotals.set(reviewer, (reviewerTotals.get(reviewer) ?? 0) + 1);
        seenReviewers.add(reviewer);
      }
    }
  }

  if (reviewerTotals.size === 0) {
    console.log('No reviews found in the specified time range.');
    return;
  }

  console.log('## Review Participation');
  console.log('*PRs merged to develop*');
  console.log();
  console.log('| Reviewer | Reviews Given | Authors Reviewed |');
  console.log('|----------|---------------|------------------|');

  const sorted = [...reviewerTotals.entries()].sort(
    (a, b) => b[1] - a[1]
  );

  for (const [reviewer, total] of sorted) {
    const authorMap = reviewerStats.get(reviewer)!;
    const authorsReviewed = [...authorMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([a, c]) => `@${a} (${c})`)
      .join(', ');
    console.log(`| @${reviewer} | ${total} | ${authorsReviewed || '-'} |`);
  }
}
