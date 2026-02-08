/**
 * Show PR leaderboard by author.
 */

import { fetchMergedPRs, getPRStats } from '../../github/index.js';
import type { AuthorStats, PRResponse, PRStatsResponse } from '../../github/index.js';
import { formatNumber } from '../utils.js';

/**
 * Build author stats from pre-fetched PR data.
 * If `statsMap` is provided, uses those instead of re-fetching from the API.
 */
export function buildAuthorStats(
  owner: string,
  repo: string,
  prs: PRResponse[],
  statsMap?: Map<number, PRStatsResponse>
): Map<string, AuthorStats> {
  const authorStats = new Map<string, AuthorStats>();

  for (const pr of prs) {
    const author = pr.user.login;
    if (!authorStats.has(author)) {
      authorStats.set(author, { count: 0, additions: 0, deletions: 0 });
    }

    const entry = authorStats.get(author)!;
    entry.count += 1;
    const stats = statsMap?.get(pr.number) ?? getPRStats(owner, repo, pr.number);
    entry.additions += stats.additions;
    entry.deletions += stats.deletions;
  }

  return authorStats;
}

/**
 * Print leaderboard table from author stats.
 */
export function printLeaderboard(authorStats: Map<string, AuthorStats>): void {
  const sorted = [...authorStats.entries()].sort(
    (a, b) => b[1].count - a[1].count
  );

  console.log('## Leaderboard');
  console.log('*PRs merged to develop*');
  console.log();
  console.log('| Developer | PRs | Lines Changed |');
  console.log('|-----------|-----|---------------|');

  for (const [author, stats] of sorted) {
    const changes = `+${formatNumber(stats.additions)}/-${formatNumber(stats.deletions)}`;
    console.log(`| @${author} | ${stats.count} | ${changes} |`);
  }
}

/**
 * Full leaderboard: fetch PRs, compute stats, print table.
 */
export function leaderboard(
  owner: string,
  repo: string,
  since: Date
): void {
  const prs = fetchMergedPRs(owner, repo, since);

  if (prs.length === 0) {
    console.log('No PRs merged in the specified time range.');
    return;
  }

  const authorStats = buildAuthorStats(owner, repo, prs);
  printLeaderboard(authorStats);
}
