/**
 * List merged PRs to develop branch.
 */

import { fetchMergedPRs, getPRStats } from '../../github/index.js';
import type { PRResponse } from '../../github/index.js';
import { formatDate } from '../utils.js';

export function prsMerged(
  owner: string,
  repo: string,
  since: Date,
  prefetchedPrs?: PRResponse[],
  showStats = true
): void {
  const prs = prefetchedPrs ?? fetchMergedPRs(owner, repo, since);

  if (prs.length === 0) {
    console.log('No PRs merged in the specified time range.');
    return;
  }

  console.log(`## PRs Merged (${prs.length} total)`);
  console.log('*PRs merged to develop*');
  console.log();

  if (showStats) {
    console.log('| PR | Author | Merged | +/- |');
    console.log('|----|--------|--------|-----|');
  } else {
    console.log('| PR | Author | Merged |');
    console.log('|----|--------|--------|');
  }

  for (const pr of prs) {
    const title = pr.title.length > 50 ? pr.title.slice(0, 50) + '...' : pr.title;
    const author = pr.user.login;
    const merged = formatDate(pr.merged_at!);

    if (showStats) {
      const stats = getPRStats(owner, repo, pr.number);
      const changes = `+${stats.additions}/-${stats.deletions}`;
      console.log(`| #${pr.number} ${title} | @${author} | ${merged} | ${changes} |`);
    } else {
      console.log(`| #${pr.number} ${title} | @${author} | ${merged} |`);
    }
  }
}
