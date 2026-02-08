/**
 * Show activity summary with day/hour breakdown.
 */

import { fetchMergedPRs, getPRStats } from '../../github/index.js';
import type { PRResponse, PRStatsResponse } from '../../github/index.js';
import { formatNumber, DAY_NAMES, WEEKDAY_NAMES } from '../utils.js';
import { buildAuthorStats, printLeaderboard } from './leaderboard.js';

export function activity(
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

  let totalAdditions = 0;
  let totalDeletions = 0;
  const authors = new Set<string>();
  const dayCounts = new Map<string, number>();
  const hourCounts = new Map<number, number>();
  const statsMap = new Map<number, PRStatsResponse>();

  for (const pr of prs) {
    authors.add(pr.user.login);
    const stats = getPRStats(owner, repo, pr.number);
    statsMap.set(pr.number, stats);
    totalAdditions += stats.additions;
    totalDeletions += stats.deletions;

    if (pr.merged_at) {
      const mergedAt = new Date(pr.merged_at);
      const dayName = DAY_NAMES[mergedAt.getUTCDay()];
      dayCounts.set(dayName, (dayCounts.get(dayName) ?? 0) + 1);
      const hour = mergedAt.getUTCHours();
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    }
  }

  const days = Math.max(
    1,
    Math.floor((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24))
  );

  console.log('## Activity Summary');
  console.log('*PRs merged to develop*');
  console.log();
  console.log(`- **PRs Merged:** ${prs.length}`);
  console.log(`- **Contributors:** ${authors.size}`);
  console.log(`- **Lines Added:** +${formatNumber(totalAdditions)}`);
  console.log(`- **Lines Removed:** -${formatNumber(totalDeletions)}`);
  const netChange = totalAdditions - totalDeletions;
  const netStr = netChange >= 0 ? `+${formatNumber(netChange)}` : `-${formatNumber(Math.abs(netChange))}`;
  console.log(`- **Net Change:** ${netStr}`);
  console.log(`- **PRs/Day:** ${(prs.length / days).toFixed(1)}`);
  console.log();

  console.log('### Merge Distribution by Day\n');
  console.log('| Day | PRs Merged | Percentage |');
  console.log('|-----|------------|------------|');

  const totalPRs = prs.length;
  for (const day of WEEKDAY_NAMES) {
    const count = dayCounts.get(day) ?? 0;
    const pct = totalPRs > 0 ? (count / totalPRs) * 100 : 0;
    console.log(`| ${day} | ${count} | ${pct.toFixed(0)}% |`);
  }

  const weekendCount = (dayCounts.get('Saturday') ?? 0) + (dayCounts.get('Sunday') ?? 0);
  const weekendPct = totalPRs > 0 ? (weekendCount / totalPRs) * 100 : 0;
  console.log(`| Weekend | ${weekendCount} | ${weekendPct.toFixed(0)}% |`);

  if (hourCounts.size > 0) {
    console.log('\n### Busiest Hours (UTC)\n');
    console.log('| Hour | PRs Merged |');
    console.log('|------|------------|');

    const sortedHours = [...hourCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [hour, count] of sortedHours) {
      const hh = String(hour).padStart(2, '0');
      console.log(`| ${hh}:00-${hh}:59 | ${count} |`);
    }
  }

  console.log();
  // Reuse already-fetched stats to avoid double API calls
  const authorStats = buildAuthorStats(owner, repo, prs, statsMap);
  printLeaderboard(authorStats);
}
