/**
 * Formatting helpers for release reports.
 */

import type { ReleasePR, AreaStats } from './types.js';
import { classifyPRType } from './classify.js';

export function prLink(owner: string, repo: string, prNumber: number): string {
  return `https://github.com/${owner}/${repo}/pull/${prNumber}`;
}

export function slackPrLink(owner: string, repo: string, prNumber: number): string {
  const url = `https://github.com/${owner}/${repo}/pull/${prNumber}`;
  return `<${url}|#${prNumber}>`;
}

export function formatAreaBreakdown(areaStats: Record<string, AreaStats>): string {
  const parts: string[] = [];
  for (const area of ['FE', 'BE', 'CT', 'other']) {
    const stats = areaStats[area];
    if (!stats) continue;
    if (stats.additions > 0 || stats.deletions > 0) {
      parts.push(`${area}:+${stats.additions}/-${stats.deletions}`);
    }
  }
  return parts.length > 0 ? parts.join(', ') : '—';
}

export function formatSlackAreaBreakdown(areaStats: Record<string, AreaStats>): string {
  const parts: string[] = [];
  for (const area of ['FE', 'BE', 'CT', 'other']) {
    const stats = areaStats[area];
    if (!stats) continue;
    if (stats.additions > 0 || stats.deletions > 0) {
      parts.push(`\`${area}:+${stats.additions}/-${stats.deletions}\``);
    }
  }
  return parts.join(' ');
}

export function formatPRSlackBlock(pr: ReleasePR, owner: string, repo: string): string {
  const add = pr.stats?.additions ?? 0;
  const del = pr.stats?.deletions ?? 0;
  const link = slackPrLink(owner, repo, pr.number);
  const title = pr.title.length > 50 ? pr.title.slice(0, 50) + '...' : pr.title;
  const areas = pr.areaStats ? formatSlackAreaBreakdown(pr.areaStats) : '';
  const lines = [
    `*${link}* +${add}/-${del} by @${pr.user.login}`,
    title,
  ];
  if (areas) {
    lines.push(areas);
  }
  return lines.join('\n');
}

export function formatHotfixSlackBlock(
  hf: ReleasePR,
  owner: string,
  repo: string,
  showStatus = true
): string {
  const link = slackPrLink(owner, repo, hf.number);
  const title = hf.title.length > 40 ? hf.title.slice(0, 40) + '...' : hf.title;
  let status = '';
  if (showStatus) {
    status = ' ' + (hf.backmerged ? '✅' : '❌ BACKMERGE');
  }
  return `*${link}* @${hf.user.login} - ${title}${status}`;
}

/** Output structured PR data for Claude to generate release notes. */
export function outputReleaseNotesData(prs: ReleasePR[]): void {
  if (prs.length === 0) return;

  const grouped: Record<string, ReleasePR[]> = {
    feature: [],
    fix: [],
    improvement: [],
    docs: [],
    chore: [],
    other: [],
  };

  for (const pr of prs) {
    const prType = classifyPRType(pr);
    grouped[prType].push(pr);
  }

  console.log();
  console.log('━'.repeat(40));
  console.log();
  console.log('<release-notes-data>');

  const typeLabels: Record<string, string> = {
    feature: 'Features',
    fix: 'Bug Fixes',
    improvement: 'Improvements',
    docs: 'Documentation',
    chore: 'Chores',
    other: 'Other',
  };

  for (const [prType, label] of Object.entries(typeLabels)) {
    const typePRs = grouped[prType];
    if (typePRs.length === 0) continue;

    console.log(`## ${label} (${typePRs.length})`);
    for (const pr of typePRs) {
      console.log(`- TITLE: ${pr.title}`);
      if (pr.body) {
        let truncated = pr.body.slice(0, 500).replace(/\n/g, ' ').trim();
        if (pr.body.length > 500) {
          truncated += '...';
        }
        console.log(`  BODY: ${truncated}`);
      }
      console.log();
    }
  }

  console.log('</release-notes-data>');
  console.log();
  console.log('<release-notes-instructions>');
  console.log('Generate polished release notes from the above data. For each item:');
  console.log('1. Write a clear, user-facing one-line summary (not the raw title)');
  console.log('2. Focus on user impact, not implementation details');
  console.log('3. Group by category (What\'s New, Bug Fixes, Improvements)');
  console.log('4. No PR links - this is for external sharing');
  console.log('5. Skip empty categories');
  console.log('</release-notes-instructions>');
}
