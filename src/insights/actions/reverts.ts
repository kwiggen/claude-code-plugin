/**
 * Track reverts and hotfixes.
 */

import { fetchMergedPRs } from '../../github/index.js';
import type { PRResponse, RevertData } from '../../github/index.js';
import { formatDate, truncate } from '../utils.js';

export function reverts(
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

  const revertPattern = /\b(revert|rollback|undo)\b/i;
  const hotfixPattern = /\b(hotfix|hot-fix|emergency|urgent)\b/i;
  const revertRefPattern = /reverts?\s+#(\d+)/i;

  const revertList: RevertData[] = [];
  const hotfixList: RevertData[] = [];

  for (const pr of prs) {
    if (!pr.merged_at) continue;
    const title = pr.title ?? '';
    const body = pr.body ?? '';

    const isRevert = revertPattern.test(title);
    const isHotfix = hotfixPattern.test(title);

    let originalPR: string | null = null;
    const titleMatch = revertRefPattern.exec(title);
    const bodyMatch = revertRefPattern.exec(body);
    const refMatch = titleMatch ?? bodyMatch;
    if (refMatch) {
      originalPR = refMatch[1];
    }

    const prData: RevertData = {
      number: pr.number,
      title: pr.title,
      author: pr.user.login,
      merged_at: pr.merged_at,
      original_pr: originalPR,
    };

    if (isRevert) {
      revertList.push(prData);
    } else if (isHotfix) {
      hotfixList.push(prData);
    }
  }

  const totalPRs = prs.length;
  const revertCount = revertList.length;
  const hotfixCount = hotfixList.length;

  console.log('## Reverts & Hotfixes');
  console.log('*PRs merged to develop*');
  console.log();
  console.log('### Summary\n');

  if (totalPRs > 0) {
    const revertPct = (revertCount / totalPRs) * 100;
    const hotfixPct = (hotfixCount / totalPRs) * 100;
    console.log(`- **Reverts:** ${revertCount} (${revertPct.toFixed(1)}%)`);
    console.log(`- **Hotfixes:** ${hotfixCount} (${hotfixPct.toFixed(1)}%)`);
  } else {
    console.log('- **Reverts:** 0');
    console.log('- **Hotfixes:** 0');
  }

  if (revertList.length > 0 || hotfixList.length > 0) {
    console.log('\n### Details\n');
    console.log('| PR | Type | Author | Original PR | Merged |');
    console.log('|----|------|--------|-------------|--------|');

    const allItems: { data: RevertData; type: string }[] = [
      ...revertList.map(d => ({ data: d, type: 'Revert' })),
      ...hotfixList.map(d => ({ data: d, type: 'Hotfix' })),
    ];

    allItems.sort((a, b) => b.data.merged_at.localeCompare(a.data.merged_at));

    for (const { data, type } of allItems) {
      const original = data.original_pr ? `#${data.original_pr}` : '-';
      const merged = formatDate(data.merged_at);
      const title = truncate(data.title, 30);
      console.log(
        `| #${data.number} ${title} | ${type} | ` +
        `@${data.author} | ${original} | ${merged} |`
      );
    }
  } else {
    console.log('\n*No reverts or hotfixes found in this time range.*');
  }
}
