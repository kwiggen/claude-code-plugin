/**
 * Release preview report.
 * Run Sunday after the release train (develop → staging) is merged.
 */

import {
  findReleaseTrains,
  fetchPRsByBase,
  enrichPRs,
  filterFeaturePRs,
  findQuickApprovals,
  getStagingHotfixes,
  getBackmergesSince,
  sortBySize,
} from './data.js';
import { getBackmergedCommits, hasBackmergeAfter } from './git-utils.js';
import {
  prLink,
  formatPRSlackBlock,
  outputReleaseNotesData,
} from './format.js';

export function cmdPreview(owner: string, repo: string, days = 30): void {
  const trains = findReleaseTrains(owner, repo, 2, days);

  if (trains.length === 0) {
    console.log(`No release train found in last ${days} days.`);
    console.log('Run this command after a release train is merged.');
    return;
  }

  const currentTrain = trains[0];
  const currentDate = new Date(currentTrain.merged_at);

  let sinceDate: Date;
  if (trains.length > 1) {
    sinceDate = new Date(trains[1].merged_at);
  } else {
    sinceDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const allPRs = fetchPRsByBase(owner, repo, 'develop', sinceDate, currentDate);
  const featurePRs = filterFeaturePRs(allPRs);

  const { totalAdditions, totalDeletions } = enrichPRs(owner, repo, featurePRs, true);
  const contributors = new Set(featurePRs.map(pr => pr.user.login));

  const sortedPRs = sortBySize(featurePRs);
  const quickApprovals = findQuickApprovals(owner, repo, featurePRs);

  const hotfixes = getStagingHotfixes(owner, repo, sinceDate);
  const backmerges = getBackmergesSince(owner, repo, sinceDate);
  const reachable = getBackmergedCommits(hotfixes);
  const missingBackmerge = hotfixes.filter(
    hf => !hasBackmergeAfter(hf, backmerges, reachable)
  );

  const trainDate = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });

  console.log(`📦 *Release Preview: ${trainDate}*`);
  console.log();
  console.log(`Release Train: #${currentTrain.number} merged ${trainDate}`);
  console.log();
  console.log(`${featurePRs.length} PRs from ${contributors.size} contributors`);
  console.log(`Lines: +${totalAdditions.toLocaleString()} / -${totalDeletions.toLocaleString()}`);
  console.log();

  console.log('📋 *All PRs* (sorted by lines changed)');
  console.log();
  for (const pr of sortedPRs) {
    console.log(formatPRSlackBlock(pr, owner, repo));
    console.log();
  }

  console.log('━'.repeat(40));
  console.log();

  console.log('⚠️ *Risk Flags*');
  console.log();

  const largePRs = sortedPRs.filter(pr => {
    const total = (pr.stats?.additions ?? 0) + (pr.stats?.deletions ?? 0);
    return total >= 500;
  });

  if (largePRs.length > 0) {
    console.log(`Large PRs (500+ lines): ${largePRs.length} PRs`);
    for (const pr of largePRs.slice(0, 3)) {
      const lines = (pr.stats?.additions ?? 0) + (pr.stats?.deletions ?? 0);
      console.log(`  #${pr.number} (${lines} lines)`);
    }
  } else {
    console.log('Large PRs (500+ lines): None ✅');
  }
  console.log();

  if (quickApprovals.length > 0) {
    console.log(
      `Quick approvals (<5 min, large or no comments): ${quickApprovals.length} PRs`
    );
    for (const pr of quickApprovals.slice(0, 3)) {
      console.log(`  #${pr.number} @${pr.user.login}`);
    }
  } else {
    console.log('Quick approvals: None ✅');
  }
  console.log();

  if (missingBackmerge.length > 0) {
    console.log(`Hotfixes needing backmerge: ${missingBackmerge.length} PRs`);
    for (const hf of missingBackmerge) {
      const link = prLink(owner, repo, hf.number);
      console.log(`  #${hf.number} @${hf.user.login} ${link}`);
    }
  } else {
    console.log('Hotfixes needing backmerge: None ✅');
  }
  console.log();

  console.log('🎯 *Monday QA Focus*');
  if (largePRs.length > 0) {
    console.log('- Review large PRs for potential regressions:');
    for (const pr of largePRs.slice(0, 3)) {
      const title = pr.title.length > 40 ? pr.title.slice(0, 40) + '...' : pr.title;
      console.log(`  - #${pr.number}: ${title}`);
    }
  } else {
    console.log('- No high-risk items identified');
  }

  outputReleaseNotesData(featurePRs);
}
