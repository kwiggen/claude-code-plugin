/**
 * Data fetching functions for release reports.
 * Uses the shared github/api layer, plus release-specific fetch logic.
 */

import {
  ghApi,
  fetchMergedPRsByBase,
  getPRStats,
  fetchPRReviews,
  fetchPRComments,
} from '../github/index.js';
import type { ReleasePR, AreaStats } from './types.js';
import {
  isReleaseTrain,
  isPromotion,
  isBackmerge,
  isHotfixToStaging,
} from './classify.js';

/**
 * Fetch merged PRs to a specific base branch within a date range.
 * Delegates to the shared fetchMergedPRsByBase in github/api.
 */
export function fetchPRsByBase(
  owner: string,
  repo: string,
  base: string,
  since: Date,
  until?: Date
): ReleasePR[] {
  return fetchMergedPRsByBase<ReleasePR>(owner, repo, base, since, until);
}

export function findReleaseTrains(
  owner: string,
  repo: string,
  limit: number = 5,
  days: number = 60
): ReleasePR[] {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const stagingPRs = fetchPRsByBase(owner, repo, 'staging', since);
  return stagingPRs.filter(pr => isReleaseTrain(pr)).slice(0, limit);
}

export function findLastPromotion(
  owner: string,
  repo: string,
  days: number = 30
): ReleasePR | undefined {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const releasePRs = fetchPRsByBase(owner, repo, 'release', since);
  const promotions = releasePRs.filter(pr => isPromotion(pr));
  return promotions[0];
}

export function getBackmergesSince(
  owner: string,
  repo: string,
  since: Date
): ReleasePR[] {
  const developPRs = fetchPRsByBase(owner, repo, 'develop', since);
  return developPRs.filter(pr => isBackmerge(pr));
}

export function getPRAreaStats(
  owner: string,
  repo: string,
  prNumber: number
): Record<string, AreaStats> {
  try {
    const files = ghApi<{ filename?: string; additions?: number; deletions?: number }[]>(
      `repos/${owner}/${repo}/pulls/${prNumber}/files`,
      { per_page: '100' }
    );

    const areaStats: Record<string, AreaStats> = {
      FE: { additions: 0, deletions: 0 },
      BE: { additions: 0, deletions: 0 },
      CT: { additions: 0, deletions: 0 },
      other: { additions: 0, deletions: 0 },
    };

    for (const file of files) {
      const filename = file.filename ?? '';
      const additions = file.additions ?? 0;
      const deletions = file.deletions ?? 0;

      let area: string;
      if (filename.startsWith('frontend/')) area = 'FE';
      else if (filename.startsWith('backend/')) area = 'BE';
      else if (filename.startsWith('content-tool/')) area = 'CT';
      else area = 'other';

      areaStats[area].additions += additions;
      areaStats[area].deletions += deletions;
    }

    return areaStats;
  } catch (err) {
    process.stderr.write(`Warning: failed to fetch area stats for PR #${prNumber}: ${err instanceof Error ? err.message : String(err)}\n`);
    return {};
  }
}

export function findQuickApprovals(
  owner: string,
  repo: string,
  prs: ReleasePR[]
): ReleasePR[] {
  const quickApprovals: ReleasePR[] = [];

  for (const pr of prs) {
    const stats = pr.stats ?? { additions: 0, deletions: 0 };
    const totalLines = stats.additions + stats.deletions;
    const isLarge = totalLines >= 500;

    const reviews = pr.reviews ?? fetchPRReviews(owner, repo, pr.number);
    const comments = pr.comments ?? fetchPRComments(owner, repo, pr.number);
    const created = new Date(pr.created_at).getTime();

    for (const review of reviews) {
      if (review.state !== 'APPROVED') continue;
      if (!review.submitted_at) continue;

      const submitted = new Date(review.submitted_at).getTime();
      const reviewTimeMin = (submitted - created) / (1000 * 60);

      if (reviewTimeMin < 5 && (isLarge || comments.length === 0)) {
        pr.reviewTimeMin = reviewTimeMin;
        pr.isLarge = isLarge;
        pr.commentCount = comments.length;
        quickApprovals.push(pr);
        break;
      }
    }
  }

  return quickApprovals;
}

/** Enrich PRs with stats and area breakdown. Optionally pre-fetches reviews/comments. */
export function enrichPRs(
  owner: string,
  repo: string,
  prs: ReleasePR[],
  fetchReviews = false
): { totalAdditions: number; totalDeletions: number } {
  let totalAdditions = 0;
  let totalDeletions = 0;

  process.stderr.write(`Fetching stats for ${prs.length} PRs...\n`);
  for (let i = 0; i < prs.length; i++) {
    const pr = prs[i];
    process.stderr.write(`  [${i + 1}/${prs.length}] #${pr.number}\n`);
    const stats = getPRStats(owner, repo, pr.number);
    pr.stats = stats;
    pr.areaStats = getPRAreaStats(owner, repo, pr.number);
    totalAdditions += stats.additions;
    totalDeletions += stats.deletions;

    if (fetchReviews) {
      pr.reviews = fetchPRReviews(owner, repo, pr.number);
      pr.comments = fetchPRComments(owner, repo, pr.number);
    }
  }
  process.stderr.write('\n');

  return { totalAdditions, totalDeletions };
}

/** Filter feature PRs from a PR list (excludes backmerges/staging/release branches). */
export function filterFeaturePRs(prs: ReleasePR[]): ReleasePR[] {
  return prs.filter(pr => {
    const headRef = pr.head?.ref ?? '';
    return headRef !== 'staging' && headRef !== 'release' && headRef !== '';
  });
}

/** Sort PRs by total lines changed (descending). */
export function sortBySize(prs: ReleasePR[]): ReleasePR[] {
  return [...prs].sort((a, b) => {
    const aTotal = (a.stats?.additions ?? 0) + (a.stats?.deletions ?? 0);
    const bTotal = (b.stats?.additions ?? 0) + (b.stats?.deletions ?? 0);
    return bTotal - aTotal;
  });
}

/** Get staging hotfixes since a date. */
export function getStagingHotfixes(
  owner: string,
  repo: string,
  since: Date,
  until?: Date
): ReleasePR[] {
  const stagingPRs = fetchPRsByBase(owner, repo, 'staging', since, until);
  return stagingPRs.filter(pr => isHotfixToStaging(pr));
}
