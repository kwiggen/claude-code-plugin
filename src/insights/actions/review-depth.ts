/**
 * Detect rubber stamp reviews vs thorough reviews.
 */

import {
  fetchMergedPRs,
  getPRStats,
  fetchPRReviews,
  fetchPRComments,
} from '../../github/index.js';
import type { PRResponse, RubberStampData, ReviewerStatsData } from '../../github/index.js';
import { truncate } from '../utils.js';

export function reviewDepth(
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

  const rubberStamps: RubberStampData[] = [];
  let prsWithReviews = 0;
  const rubberStampedPRs = new Set<number>();
  const reviewerStats = new Map<string, ReviewerStatsData>();

  for (const pr of prs) {
    const created = new Date(pr.created_at).getTime();
    const author = pr.user.login;
    const stats = getPRStats(owner, repo, pr.number);
    const totalLines = stats.additions + stats.deletions;

    const prReviews = fetchPRReviews(owner, repo, pr.number);
    const comments = fetchPRComments(owner, repo, pr.number);

    if (prReviews.length > 0) {
      prsWithReviews++;
    }

    for (const review of prReviews) {
      const reviewer = review.user.login;
      if (reviewer === author) continue;

      if (!review.submitted_at) continue;

      const reviewTime = new Date(review.submitted_at).getTime();
      const reviewMinutes = (reviewTime - created) / (1000 * 60);

      const reviewerComments = comments.filter(
        c => c.user.login === reviewer
      ).length;

      if (!reviewerStats.has(reviewer)) {
        reviewerStats.set(reviewer, { reviewTimes: [], commentCounts: [] });
      }
      const revStats = reviewerStats.get(reviewer)!;
      revStats.reviewTimes.push(reviewMinutes);
      revStats.commentCounts.push(reviewerComments);

      const isApproval = review.state === 'APPROVED';
      const isQuick = reviewMinutes < 5;
      const isLarge = totalLines > 500;
      const noComments = reviewerComments === 0;

      if (isApproval && isQuick && (isLarge || noComments)) {
        rubberStampedPRs.add(pr.number);
        rubberStamps.push({
          number: pr.number,
          title: pr.title,
          author,
          reviewer,
          lines: totalLines,
          reviewTime: reviewMinutes,
        });
      }
    }
  }

  if (prsWithReviews === 0) {
    console.log('No reviews found in the specified time range.');
    return;
  }

  const rubberPRCount = rubberStampedPRs.size;
  const thoroughPct =
    prsWithReviews > 0
      ? ((prsWithReviews - rubberPRCount) / prsWithReviews) * 100
      : 0;
  const rubberPct = 100 - thoroughPct;

  console.log('## Review Depth Analysis');
  console.log('*PRs merged to develop*');
  console.log();
  console.log('### Summary\n');
  console.log(`- **Thorough Reviews:** ${thoroughPct.toFixed(0)}%`);
  console.log(`- **Potential Rubber Stamps:** ${rubberPct.toFixed(0)}%`);

  if (rubberStamps.length > 0) {
    console.log('\n### Potential Rubber Stamps\n');
    console.log('| PR | Author | Reviewer | Lines | Review Time |');
    console.log('|----|--------|----------|-------|-------------|');

    const sortedStamps = [...rubberStamps]
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 10);

    for (const rs of sortedStamps) {
      const title = truncate(rs.title, 25);
      console.log(
        `| #${rs.number} ${title} | @${rs.author} | ` +
        `@${rs.reviewer} | ${rs.lines.toLocaleString('en-US')} | ` +
        `${rs.reviewTime.toFixed(0)} min |`
      );
    }
  }

  if (reviewerStats.size > 0) {
    console.log('\n### Thorough Review Champions\n');
    console.log('| Reviewer | Avg Review Time | Comments/Review |');
    console.log('|----------|-----------------|-----------------|');

    const champions: { reviewer: string; avgTime: number; avgComments: number }[] = [];
    for (const [reviewer, data] of reviewerStats.entries()) {
      if (data.reviewTimes.length > 0) {
        const avgTime =
          data.reviewTimes.reduce((a, b) => a + b, 0) / data.reviewTimes.length;
        const avgComments =
          data.commentCounts.reduce((a, b) => a + b, 0) / data.commentCounts.length;
        if (avgTime >= 10 || avgComments >= 1) {
          champions.push({ reviewer, avgTime, avgComments });
        }
      }
    }

    champions.sort((a, b) => b.avgComments - a.avgComments);

    for (const { reviewer, avgTime, avgComments } of champions.slice(0, 5)) {
      console.log(
        `| @${reviewer} | ${avgTime.toFixed(0)} min | ${avgComments.toFixed(1)} |`
      );
    }
  }
}
