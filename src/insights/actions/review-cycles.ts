/**
 * Track rounds of feedback before merge.
 */

import { fetchMergedPRs, fetchPRReviews } from '../../github/index.js';
import type { PRCycleData } from '../../github/index.js';
import { median, truncate } from '../utils.js';

export function reviewCycles(
  owner: string,
  repo: string,
  since: Date
): void {
  const prs = fetchMergedPRs(owner, repo, since);

  if (prs.length === 0) {
    console.log('No PRs merged in the specified time range.');
    return;
  }

  const cycleCounts = new Map<number, number>();
  const prCycles: PRCycleData[] = [];

  for (const pr of prs) {
    const author = pr.user.login;
    const prReviews = fetchPRReviews(owner, repo, pr.number);

    if (prReviews.length === 0) {
      cycleCounts.set(1, (cycleCounts.get(1) ?? 0) + 1);
      continue;
    }

    const sortedReviews = prReviews
      .filter(r => r.submitted_at)
      .sort((a, b) => (a.submitted_at ?? '').localeCompare(b.submitted_at ?? ''));

    let cycles = 1;
    let lastApprover: string | null = null;

    for (const review of sortedReviews) {
      const reviewer = review.user.login;
      if (reviewer === author) continue;

      const state = review.state ?? '';
      if (state === 'CHANGES_REQUESTED') {
        cycles++;
        lastApprover = null;
      } else if (state === 'APPROVED') {
        lastApprover = reviewer;
      }
    }

    cycleCounts.set(cycles, (cycleCounts.get(cycles) ?? 0) + 1);
    prCycles.push({
      number: pr.number,
      title: pr.title,
      author,
      cycles,
      finalReviewer: lastApprover,
    });
  }

  const totalPRs = prs.length;

  console.log('## Review Cycles');
  console.log('*PRs merged to develop*');
  console.log();
  console.log('### Summary\n');
  console.log('| Cycles | Count | Percentage |');
  console.log('|--------|-------|------------|');

  const firstTry = cycleCounts.get(1) ?? 0;
  const twoCycles = cycleCounts.get(2) ?? 0;
  let threePlus = 0;
  for (const [cyc, count] of cycleCounts.entries()) {
    if (cyc >= 3) threePlus += count;
  }

  const firstPct = totalPRs > 0 ? (firstTry / totalPRs) * 100 : 0;
  const twoPct = totalPRs > 0 ? (twoCycles / totalPRs) * 100 : 0;
  const threePct = totalPRs > 0 ? (threePlus / totalPRs) * 100 : 0;

  console.log(`| 1 (First try) | ${firstTry} | ${firstPct.toFixed(0)}% |`);
  console.log(`| 2 | ${twoCycles} | ${twoPct.toFixed(0)}% |`);
  console.log(`| 3+ | ${threePlus} | ${threePct.toFixed(0)}% |`);

  const highCyclePRs = prCycles.filter(p => p.cycles >= 3);
  if (highCyclePRs.length > 0) {
    console.log('\n### PRs with Most Iterations\n');
    console.log('| PR | Author | Cycles | Final Reviewer |');
    console.log('|----|--------|--------|----------------|');

    const sortedPRs = [...highCyclePRs]
      .sort((a, b) => b.cycles - a.cycles)
      .slice(0, 5);

    for (const prData of sortedPRs) {
      const title = truncate(prData.title, 30);
      const finalRev = prData.finalReviewer ? `@${prData.finalReviewer}` : '-';
      console.log(
        `| #${prData.number} ${title} | @${prData.author} | ` +
        `${prData.cycles} | ${finalRev} |`
      );
    }
  }

  const allCycles = prCycles.map(p => p.cycles);
  if (allCycles.length > 0) {
    const avgCycles = allCycles.reduce((a, b) => a + b, 0) / allCycles.length;
    const medianCycles = median(allCycles);
    console.log(
      `\n**Avg Cycles:** ${avgCycles.toFixed(1)} | **Median:** ${medianCycles.toFixed(0)}`
    );
  }
}
