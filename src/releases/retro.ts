/**
 * Release retro report.
 * Run Tuesday after production stabilizes.
 */

import {
  findReleaseTrains,
  findLastPromotion,
  fetchPRsByBase,
  enrichPRs,
  filterFeaturePRs,
  getStagingHotfixes,
  getBackmergesSince,
  sortBySize,
} from './data.js';
import { isHotfixToRelease, isHotfixToStaging } from './classify.js';
import { getBackmergedCommits, hasBackmergeAfter } from './git-utils.js';
import { formatPRSlackBlock, formatHotfixSlackBlock } from './format.js';
import type { ReleasePR, TrendEntry } from './types.js';

function formatPacificDate(date: Date): string {
  const formatted = date.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return formatted + ' PT';
}

export function getReleaseTrend(
  owner: string,
  repo: string,
  count = 4
): TrendEntry[] {
  const trains = findReleaseTrains(owner, repo, count + 1, 90);

  if (trains.length < 2) return [];

  const trend: TrendEntry[] = [];
  for (let i = 0; i < trains.length - 1; i++) {
    const current = trains[i];
    const previous = trains[i + 1];

    const currentDate = new Date(current.merged_at);
    const previousDate = new Date(previous.merged_at);

    const prs = fetchPRsByBase(owner, repo, 'develop', previousDate, currentDate);
    const filteredPRs = filterFeaturePRs(prs);

    // Hotfix window: from current train until next train (or now)
    const nextTrainDate = i > 0 ? new Date(trains[i - 1].merged_at) : undefined;

    const stagingPRs = fetchPRsByBase(
      owner, repo, 'staging', currentDate, nextTrainDate
    );
    const stagingHF = stagingPRs.filter(pr => isHotfixToStaging(pr));

    const releasePRs = fetchPRsByBase(
      owner, repo, 'release', currentDate, nextTrainDate
    );
    const releaseHF = releasePRs.filter(pr => isHotfixToRelease(pr));

    const hasHotfixes = stagingHF.length > 0 || releaseHF.length > 0;
    trend.push({
      date: `${String(currentDate.getMonth() + 1).padStart(2, '0')}/${String(currentDate.getDate()).padStart(2, '0')}`,
      prCount: filteredPRs.length,
      stagingHF: stagingHF.length,
      releaseHF: releaseHF.length,
      outcome: hasHotfixes ? 'hotfix' : 'clean',
    });
  }

  return trend;
}

export function summarizeTrend(trend: TrendEntry[]): string {
  if (trend.length === 0) return '';

  let consecutive = 0;
  for (const t of trend) {
    if (t.outcome === 'hotfix') {
      consecutive++;
    } else {
      break;
    }
  }

  const total = trend.reduce((sum, t) => sum + t.stagingHF + t.releaseHF, 0);

  if (consecutive === trend.length) {
    return (
      `${consecutive} consecutive releases with hotfixes ` +
      `(${total} total over ${trend.length} weeks)`
    );
  } else if (consecutive > 0) {
    return (
      `Last ${consecutive} release(s) had hotfixes ` +
      `(${total} total over ${trend.length} weeks)`
    );
  }
  return `Last release was clean (${total} hotfixes over ${trend.length} weeks)`;
}

export function generateActionItems(
  stagingHotfixes: ReleasePR[],
  releaseHotfixes: ReleasePR[]
): string[] {
  const items: string[] = [];
  for (const hf of [...stagingHotfixes, ...releaseHotfixes]) {
    if (!hf.backmerged) {
      items.push(`@${hf.user.login} — backmerge #${hf.number} to develop`);
    }
  }
  return items;
}

export function cmdRetro(owner: string, repo: string, days = 30): void {
  const trains = findReleaseTrains(owner, repo, 2, days);

  if (trains.length === 0) {
    console.log(`No release train found in last ${days} days.`);
    console.log('Run this command after a release train is merged.');
    return;
  }

  const releaseTrain = trains[0];
  const stagingDate = new Date(releaseTrain.merged_at);

  const promotion = findLastPromotion(owner, repo, days);
  let prodDate: Date | undefined;
  if (promotion) {
    const pd = new Date(promotion.merged_at);
    // Promotion must be after staging to be for this cycle
    if (pd >= stagingDate) {
      prodDate = pd;
    }
  }

  let sinceDate: Date;
  if (trains.length > 1) {
    sinceDate = new Date(trains[1].merged_at);
  } else {
    sinceDate = new Date(stagingDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  // Feature PRs (what shipped)
  const allPRs = fetchPRsByBase(owner, repo, 'develop', sinceDate, stagingDate);
  const featurePRs = filterFeaturePRs(allPRs);

  const { totalAdditions, totalDeletions } = enrichPRs(owner, repo, featurePRs);
  const contributorCounts: Record<string, number> = {};
  for (const pr of featurePRs) {
    const author = pr.user.login;
    contributorCounts[author] = (contributorCounts[author] ?? 0) + 1;
  }

  const sortedPRs = sortBySize(featurePRs);

  // Staging hotfixes (during QA)
  const stagingHotfixes = getStagingHotfixes(owner, repo, stagingDate);

  // Release hotfixes (to prod)
  const releasePRs = fetchPRsByBase(owner, repo, 'release', stagingDate);
  const releaseHotfixes = releasePRs.filter(pr => isHotfixToRelease(pr));

  // Check backmerge status for all hotfixes
  const allHotfixes = [...stagingHotfixes, ...releaseHotfixes];
  const reachable = getBackmergedCommits(allHotfixes);
  const backmerges = getBackmergesSince(owner, repo, stagingDate);

  for (const hf of stagingHotfixes) {
    hf.backmerged = hasBackmergeAfter(hf, backmerges, reachable);
  }
  for (const hf of releaseHotfixes) {
    hf.backmerged = hasBackmergeAfter(hf, backmerges, reachable);
  }

  const hasHotfixes = stagingHotfixes.length > 0 || releaseHotfixes.length > 0;

  const trend = getReleaseTrend(owner, repo, 4);
  const actionItems = generateActionItems(stagingHotfixes, releaseHotfixes);

  // --- Output ---
  const prevDateStr = sinceDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const currDateStr = stagingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  console.log(`📦 *Release Retro: ${prevDateStr} → ${currDateStr}*`);
  console.log('(All times Pacific)');
  console.log();

  console.log(`Staging: ${formatPacificDate(stagingDate)} ✅`);
  if (prodDate) {
    console.log(`Prod: ${formatPacificDate(prodDate)} ✅`);
  } else {
    console.log('Prod: Pending');
  }
  console.log();

  console.log('━'.repeat(40));
  console.log();

  // Outcome
  if (!hasHotfixes) {
    console.log('🚦 *Outcome: ✅ Clean Release*');
  } else {
    console.log('🚦 *Outcome: ⚠️ Hotfixes Required*');
    console.log();
    if (stagingHotfixes.length > 0) {
      console.log(`  ${stagingHotfixes.length} hotfix(es) to staging (during QA)`);
    }
    if (releaseHotfixes.length > 0) {
      console.log(`  ${releaseHotfixes.length} hotfix(es) to release (prod)`);
    }
  }
  console.log();

  console.log('━'.repeat(40));
  console.log();

  // What Shipped
  console.log('📊 *What Shipped*');
  console.log();
  const contribCount = Object.keys(contributorCounts).length;
  console.log(`${featurePRs.length} PRs from ${contribCount} contributors`);
  console.log(`Lines: +${totalAdditions.toLocaleString()} / -${totalDeletions.toLocaleString()}`);
  console.log();

  if (contribCount > 0) {
    console.log('Top contributors:');
    const sortedContribs = Object.entries(contributorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    for (const [author, count] of sortedContribs) {
      console.log(`  @${author}    ${count} PRs`);
    }
  }
  console.log();

  console.log('📋 *All PRs* (sorted by lines changed)');
  console.log();
  for (const pr of sortedPRs) {
    console.log(formatPRSlackBlock(pr, owner, repo));
    console.log();
  }

  console.log('━'.repeat(40));
  console.log();

  // Staging Hotfixes
  console.log(`🚨 *Staging Hotfixes* (${stagingHotfixes.length} PRs during QA)`);
  console.log();
  if (stagingHotfixes.length > 0) {
    for (const hf of stagingHotfixes) {
      console.log(formatHotfixSlackBlock(hf, owner, repo));
    }
  } else {
    console.log('None 🎉');
  }
  console.log();

  console.log('━'.repeat(40));
  console.log();

  // Release Hotfixes
  console.log(`🔥 *Release Hotfixes* (${releaseHotfixes.length} PRs to prod)`);
  console.log();
  if (releaseHotfixes.length > 0) {
    for (const hf of releaseHotfixes) {
      console.log(formatHotfixSlackBlock(hf, owner, repo));
    }
  } else {
    console.log('None 🎉');
  }
  console.log();

  console.log('━'.repeat(40));
  console.log();

  // Trend
  console.log('📈 *Trend (Last 4 Releases)*');
  console.log();
  if (trend.length > 0) {
    for (const t of trend) {
      const icon = t.outcome === 'clean' ? '✅' : '⚠️';
      console.log(
        `*${t.date}* - ${t.prCount} PRs, ` +
        `${t.stagingHF} staging HF, ` +
        `${t.releaseHF} release HF ${icon}`
      );
    }
    console.log();
    const trendSummary = summarizeTrend(trend);
    if (trendSummary) {
      console.log(trendSummary);
    }
  } else {
    console.log('Not enough release history for trend data.');
  }
  console.log();

  // Action Items
  if (actionItems.length > 0) {
    console.log('━'.repeat(40));
    console.log();
    console.log('🎯 *Action Items*');
    console.log();
    for (const item of actionItems) {
      console.log(`- ${item}`);
    }
  }
}
