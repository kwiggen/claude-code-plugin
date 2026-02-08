/**
 * Show review balance - reviews given vs received per developer.
 */

import { fetchMergedPRs, fetchPRReviews } from '../../github/index.js';

export function reviewBalance(
  owner: string,
  repo: string,
  since: Date
): void {
  const prs = fetchMergedPRs(owner, repo, since);

  if (prs.length === 0) {
    console.log('No PRs merged in the specified time range.');
    return;
  }

  const reviewsGiven = new Map<string, number>();
  const reviewsReceived = new Map<string, number>();

  for (const pr of prs) {
    const author = pr.user.login;
    const prReviews = fetchPRReviews(owner, repo, pr.number);

    const seenReviewers = new Set<string>();
    for (const review of prReviews) {
      const reviewer = review.user.login;
      if (reviewer !== author && !seenReviewers.has(reviewer)) {
        reviewsGiven.set(reviewer, (reviewsGiven.get(reviewer) ?? 0) + 1);
        seenReviewers.add(reviewer);
      }
    }

    if (seenReviewers.size > 0) {
      reviewsReceived.set(author, (reviewsReceived.get(author) ?? 0) + seenReviewers.size);
    }
  }

  const allUsers = new Set([...reviewsGiven.keys(), ...reviewsReceived.keys()]);

  if (allUsers.size === 0) {
    console.log('No reviews found in the specified time range.');
    return;
  }

  console.log('## Review Balance');
  console.log('*PRs merged to develop*');
  console.log();
  console.log('| Developer | Reviews Given | Reviews Received | Ratio |');
  console.log('|-----------|---------------|------------------|-------|');

  const userData: { user: string; given: number; received: number; ratio: number }[] = [];
  for (const user of allUsers) {
    const given = reviewsGiven.get(user) ?? 0;
    const received = reviewsReceived.get(user) ?? 0;
    let ratio: number;
    if (received > 0) {
      ratio = given / received;
    } else if (given > 0) {
      ratio = Infinity;
    } else {
      ratio = 0;
    }
    userData.push({ user, given, received, ratio });
  }

  userData.sort((a, b) => b.given - a.given);

  for (const { user, given, received, ratio } of userData) {
    const ratioStr = ratio === Infinity ? 'inf' : `${ratio.toFixed(1)}x`;
    console.log(`| @${user} | ${given} | ${received} | ${ratioStr} |`);
  }

  let totalGiven = 0;
  let totalReceived = 0;
  for (const v of reviewsGiven.values()) totalGiven += v;
  for (const v of reviewsReceived.values()) totalReceived += v;

  if (totalReceived > 0) {
    const avgRatio = totalGiven / totalReceived;
    let balanceStatus: string;
    if (avgRatio >= 0.8 && avgRatio <= 1.2) {
      balanceStatus = 'Balanced';
    } else if (avgRatio < 0.8) {
      balanceStatus = 'Under-reviewing';
    } else {
      balanceStatus = 'Over-reviewing';
    }
    console.log(`\n**Team Balance:** ${balanceStatus} (avg ratio: ${avgRatio.toFixed(1)}x)`);
  }
}
