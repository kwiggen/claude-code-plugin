/**
 * Show PR size analysis with merge time correlation.
 */

import { fetchMergedPRs, getPRStats } from '../../github/index.js';
import type { PRSizeData } from '../../github/index.js';
import { formatDuration, truncate } from '../utils.js';

export function prSize(
  owner: string,
  repo: string,
  since: Date
): void {
  const prs = fetchMergedPRs(owner, repo, since);

  if (prs.length === 0) {
    console.log('No PRs merged in the specified time range.');
    return;
  }

  const sizeBuckets: Record<string, PRSizeData[]> = {
    'Small (<100)': [],
    'Medium (100-500)': [],
    'Large (500+)': [],
  };

  for (const pr of prs) {
    if (!pr.merged_at) continue;
    const stats = getPRStats(owner, repo, pr.number);
    const totalLines = stats.additions + stats.deletions;
    const created = new Date(pr.created_at).getTime();
    const merged = new Date(pr.merged_at).getTime();
    const mergeTimeMs = merged - created;

    const prData: PRSizeData = {
      number: pr.number,
      title: pr.title,
      author: pr.user.login,
      additions: stats.additions,
      deletions: stats.deletions,
      total: totalLines,
      mergeTimeMs,
    };

    if (totalLines < 100) {
      sizeBuckets['Small (<100)'].push(prData);
    } else if (totalLines < 500) {
      sizeBuckets['Medium (100-500)'].push(prData);
    } else {
      sizeBuckets['Large (500+)'].push(prData);
    }
  }

  console.log('## PR Size Analysis');
  console.log('*PRs merged to develop*');
  console.log();
  console.log('### Size Distribution\n');
  console.log('| Size | Count | Avg Merge Time |');
  console.log('|------|-------|----------------|');

  const bucketAvgs: Record<string, number> = {};
  const bucketNames = ['Small (<100)', 'Medium (100-500)', 'Large (500+)'];

  for (const bucketName of bucketNames) {
    const bucketPRs = sizeBuckets[bucketName];
    const count = bucketPRs.length;
    if (count > 0) {
      const totalMs = bucketPRs.reduce((sum, p) => sum + p.mergeTimeMs, 0);
      const avgMs = totalMs / count;
      bucketAvgs[bucketName] = avgMs;
      console.log(`| ${bucketName} | ${count} | ${formatDuration(avgMs)} |`);
    } else {
      console.log(`| ${bucketName} | 0 | - |`);
    }
  }

  const largePRs = sizeBuckets['Large (500+)'];
  if (largePRs.length > 0) {
    console.log('\n### Large PRs (potential bottlenecks)\n');
    console.log('| PR | Author | Lines | Time to Merge |');
    console.log('|----|--------|-------|---------------|');

    const sortedLarge = [...largePRs].sort((a, b) => b.total - a.total).slice(0, 5);
    for (const prData of sortedLarge) {
      const title = truncate(prData.title, 40);
      console.log(
        `| #${prData.number} ${title} | @${prData.author} | ` +
        `+${prData.additions}/-${prData.deletions} | ` +
        `${formatDuration(prData.mergeTimeMs)} |`
      );
    }
  }

  if (bucketAvgs['Small (<100)'] && bucketAvgs['Large (500+)']) {
    if (bucketAvgs['Small (<100)'] > 0) {
      const ratio = bucketAvgs['Large (500+)'] / bucketAvgs['Small (<100)'];
      console.log('\n### Correlation\n');
      console.log(
        `Large PRs take **${ratio.toFixed(1)}x longer** to merge than small PRs.`
      );
    }
  }
}
