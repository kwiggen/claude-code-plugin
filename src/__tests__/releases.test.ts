import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import type { ReleasePR, TrendEntry } from '../releases/types.js';

// Mock child_process for all data/git-utils functions
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

const mockExecFileSync = vi.mocked(execFileSync);

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePR(overrides: Partial<ReleasePR> & { number: number }): ReleasePR {
  return {
    title: `PR #${overrides.number}`,
    user: { login: 'dev1' },
    created_at: '2025-01-10T00:00:00Z',
    merged_at: '2025-01-12T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// classify.ts
// ---------------------------------------------------------------------------

import {
  isReleaseTrain,
  isPromotion,
  isBackmerge,
  isHotfixToStaging,
  isHotfixToRelease,
  classifyPRType,
} from '../releases/classify.js';

describe('isReleaseTrain', () => {
  it('should detect staging-MM-DD-YY pattern', () => {
    const pr = makePR({
      number: 1,
      base: { ref: 'staging' },
      head: { ref: 'staging-12-21-25' },
    });
    expect(isReleaseTrain(pr)).toBe(true);
  });

  it('should detect release-MM-DD-YY pattern', () => {
    const pr = makePR({
      number: 1,
      base: { ref: 'staging' },
      head: { ref: 'release-2-3-26' },
    });
    expect(isReleaseTrain(pr)).toBe(true);
  });

  it('should detect release-to-staging', () => {
    const pr = makePR({
      number: 1,
      base: { ref: 'staging' },
      head: { ref: 'release-to-staging' },
    });
    expect(isReleaseTrain(pr)).toBe(true);
  });

  it('should reject when base is not staging', () => {
    const pr = makePR({
      number: 1,
      base: { ref: 'develop' },
      head: { ref: 'staging-12-21-25' },
    });
    expect(isReleaseTrain(pr)).toBe(false);
  });

  it('should reject feature branches', () => {
    const pr = makePR({
      number: 1,
      base: { ref: 'staging' },
      head: { ref: 'fix/some-bug' },
    });
    expect(isReleaseTrain(pr)).toBe(false);
  });
});

describe('isPromotion', () => {
  it('should detect staging → release', () => {
    const pr = makePR({
      number: 1,
      base: { ref: 'release' },
      head: { ref: 'staging' },
    });
    expect(isPromotion(pr)).toBe(true);
  });

  it('should detect release-MM-DD-YY → release', () => {
    const pr = makePR({
      number: 1,
      base: { ref: 'release' },
      head: { ref: 'release-12-22-25' },
    });
    expect(isPromotion(pr)).toBe(true);
  });

  it('should reject when base is not release', () => {
    const pr = makePR({
      number: 1,
      base: { ref: 'staging' },
      head: { ref: 'staging' },
    });
    expect(isPromotion(pr)).toBe(false);
  });
});

describe('isBackmerge', () => {
  it('should detect staging → develop', () => {
    const pr = makePR({
      number: 1,
      base: { ref: 'develop' },
      head: { ref: 'staging' },
    });
    expect(isBackmerge(pr)).toBe(true);
  });

  it('should reject non-backmerge PRs', () => {
    const pr = makePR({
      number: 1,
      base: { ref: 'develop' },
      head: { ref: 'fix/something' },
    });
    expect(isBackmerge(pr)).toBe(false);
  });
});

describe('isHotfixToStaging', () => {
  it('should detect hotfix to staging', () => {
    const pr = makePR({
      number: 1,
      base: { ref: 'staging' },
      head: { ref: 'fix/urgent-bug' },
    });
    expect(isHotfixToStaging(pr)).toBe(true);
  });

  it('should exclude release trains', () => {
    const pr = makePR({
      number: 1,
      base: { ref: 'staging' },
      head: { ref: 'staging-12-21-25' },
    });
    expect(isHotfixToStaging(pr)).toBe(false);
  });

  it('should exclude release → staging backmerges', () => {
    const pr = makePR({
      number: 1,
      base: { ref: 'staging' },
      head: { ref: 'release' },
    });
    expect(isHotfixToStaging(pr)).toBe(false);
  });
});

describe('isHotfixToRelease', () => {
  it('should detect hotfix to release', () => {
    const pr = makePR({
      number: 1,
      base: { ref: 'release' },
      head: { ref: 'hotfix/prod-fix' },
    });
    expect(isHotfixToRelease(pr)).toBe(true);
  });

  it('should exclude promotions', () => {
    const pr = makePR({
      number: 1,
      base: { ref: 'release' },
      head: { ref: 'staging' },
    });
    expect(isHotfixToRelease(pr)).toBe(false);
  });
});

describe('classifyPRType', () => {
  it('should detect conventional commit prefixes', () => {
    expect(classifyPRType(makePR({ number: 1, title: 'feat: add login' }))).toBe('feature');
    expect(classifyPRType(makePR({ number: 2, title: 'fix: crash on load' }))).toBe('fix');
    expect(classifyPRType(makePR({ number: 3, title: 'refactor: cleanup' }))).toBe('improvement');
    expect(classifyPRType(makePR({ number: 4, title: 'docs: update readme' }))).toBe('docs');
    expect(classifyPRType(makePR({ number: 5, title: 'chore: bump deps' }))).toBe('chore');
  });

  it('should detect keyword-based classification', () => {
    expect(classifyPRType(makePR({ number: 1, title: 'Add new dashboard' }))).toBe('feature');
    expect(classifyPRType(makePR({ number: 2, title: 'Fix login bug' }))).toBe('fix');
    expect(classifyPRType(makePR({ number: 3, title: 'Update error handling' }))).toBe('improvement');
  });

  it('should return other for unclassifiable', () => {
    expect(classifyPRType(makePR({ number: 1, title: 'Misc changes' }))).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// format.ts
// ---------------------------------------------------------------------------

import {
  prLink,
  slackPrLink,
  formatAreaBreakdown,
  formatSlackAreaBreakdown,
  formatPRSlackBlock,
  formatHotfixSlackBlock,
} from '../releases/format.js';

describe('prLink', () => {
  it('should return GitHub PR URL', () => {
    expect(prLink('myorg', 'myrepo', 42)).toBe(
      'https://github.com/myorg/myrepo/pull/42'
    );
  });
});

describe('slackPrLink', () => {
  it('should return Slack-formatted link', () => {
    expect(slackPrLink('myorg', 'myrepo', 42)).toBe(
      '<https://github.com/myorg/myrepo/pull/42|#42>'
    );
  });
});

describe('formatAreaBreakdown', () => {
  it('should format non-zero areas', () => {
    const stats = {
      FE: { additions: 100, deletions: 20 },
      BE: { additions: 50, deletions: 10 },
      CT: { additions: 0, deletions: 0 },
      other: { additions: 0, deletions: 0 },
    };
    expect(formatAreaBreakdown(stats)).toBe('FE:+100/-20, BE:+50/-10');
  });

  it('should return dash for all-zero areas', () => {
    const stats = {
      FE: { additions: 0, deletions: 0 },
      BE: { additions: 0, deletions: 0 },
      CT: { additions: 0, deletions: 0 },
      other: { additions: 0, deletions: 0 },
    };
    expect(formatAreaBreakdown(stats)).toBe('—');
  });
});

describe('formatSlackAreaBreakdown', () => {
  it('should format as inline code', () => {
    const stats = {
      FE: { additions: 100, deletions: 20 },
      BE: { additions: 0, deletions: 0 },
      CT: { additions: 0, deletions: 0 },
      other: { additions: 5, deletions: 0 },
    };
    expect(formatSlackAreaBreakdown(stats)).toBe('`FE:+100/-20` `other:+5/-0`');
  });
});

describe('formatPRSlackBlock', () => {
  it('should format PR with stats and areas', () => {
    const pr = makePR({
      number: 42,
      title: 'Add amazing feature',
      stats: { additions: 200, deletions: 50 },
      areaStats: {
        FE: { additions: 200, deletions: 50 },
        BE: { additions: 0, deletions: 0 },
        CT: { additions: 0, deletions: 0 },
        other: { additions: 0, deletions: 0 },
      },
    });

    const result = formatPRSlackBlock(pr, 'myorg', 'myrepo');
    expect(result).toContain('<https://github.com/myorg/myrepo/pull/42|#42>');
    expect(result).toContain('+200/-50');
    expect(result).toContain('@dev1');
    expect(result).toContain('Add amazing feature');
    expect(result).toContain('`FE:+200/-50`');
  });

  it('should truncate long titles', () => {
    const pr = makePR({
      number: 1,
      title: 'A'.repeat(60),
      stats: { additions: 10, deletions: 5 },
      areaStats: {},
    });

    const result = formatPRSlackBlock(pr, 'org', 'repo');
    expect(result).toContain('A'.repeat(50) + '...');
  });
});

describe('formatHotfixSlackBlock', () => {
  it('should show backmerge status when enabled', () => {
    const hf = makePR({
      number: 99,
      title: 'Fix prod crash',
      backmerged: false,
    });
    const result = formatHotfixSlackBlock(hf, 'org', 'repo');
    expect(result).toContain('❌ BACKMERGE');
  });

  it('should show checkmark for backmerged', () => {
    const hf = makePR({
      number: 99,
      title: 'Fix prod crash',
      backmerged: true,
    });
    const result = formatHotfixSlackBlock(hf, 'org', 'repo');
    expect(result).toContain('✅');
    expect(result).not.toContain('BACKMERGE');
  });

  it('should hide status when disabled', () => {
    const hf = makePR({
      number: 99,
      title: 'Fix prod crash',
      backmerged: false,
    });
    const result = formatHotfixSlackBlock(hf, 'org', 'repo', false);
    expect(result).not.toContain('❌');
    expect(result).not.toContain('✅');
  });
});

// ---------------------------------------------------------------------------
// git-utils.ts
// ---------------------------------------------------------------------------

import {
  ensureRemoteUpdated,
  isCommitReachableFromDevelop,
  hasBackmergeAfter,
  resetRemoteFetched,
} from '../releases/git-utils.js';

describe('ensureRemoteUpdated', () => {
  beforeEach(() => {
    resetRemoteFetched();
  });

  it('should call git fetch and return true', () => {
    mockExecFileSync.mockReturnValue('');
    expect(ensureRemoteUpdated()).toBe(true);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['fetch', 'origin', 'develop'],
      expect.objectContaining({ timeout: 30000 })
    );
  });

  it('should only fetch once per session', () => {
    mockExecFileSync.mockReturnValue('');
    ensureRemoteUpdated();
    ensureRemoteUpdated();
    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
  });

  it('should return false on error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('network error');
    });
    expect(ensureRemoteUpdated()).toBe(false);
  });
});

describe('isCommitReachableFromDevelop', () => {
  it('should return true when merge-base succeeds', () => {
    mockExecFileSync.mockReturnValue('');
    expect(isCommitReachableFromDevelop('abc123')).toBe(true);
  });

  it('should return false when merge-base fails', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('not ancestor');
    });
    expect(isCommitReachableFromDevelop('abc123')).toBe(false);
  });

  it('should return false for empty sha', () => {
    expect(isCommitReachableFromDevelop('')).toBe(false);
  });
});

describe('hasBackmergeAfter', () => {
  it('should use reachable commits set when provided', () => {
    const hotfix = makePR({
      number: 1,
      merge_commit_sha: 'sha1',
    });
    const reachable = new Set(['sha1']);
    expect(hasBackmergeAfter(hotfix, [], reachable)).toBe(true);
  });

  it('should fall back to text matching', () => {
    const hotfix = makePR({
      number: 42,
      merged_at: '2025-01-10T00:00:00Z',
      merge_commit_sha: null,
    });
    const backmerge = makePR({
      number: 50,
      title: 'Backmerge #42 to develop',
      merged_at: '2025-01-11T00:00:00Z',
      base: { ref: 'develop' },
      head: { ref: 'staging' },
    });
    expect(hasBackmergeAfter(hotfix, [backmerge], new Set())).toBe(true);
  });

  it('should return false when no backmerge found', () => {
    const hotfix = makePR({
      number: 42,
      merge_commit_sha: null,
    });
    expect(hasBackmergeAfter(hotfix, [], new Set())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// data.ts
// ---------------------------------------------------------------------------

import { filterFeaturePRs } from '../releases/data.js';

describe('filterFeaturePRs', () => {
  it('should exclude staging/release/empty head refs', () => {
    const prs = [
      makePR({ number: 1, head: { ref: 'feat/login' } }),
      makePR({ number: 2, head: { ref: 'staging' } }),
      makePR({ number: 3, head: { ref: 'release' } }),
      makePR({ number: 4, head: { ref: '' } }),
      makePR({ number: 5, head: { ref: 'fix/bug' } }),
    ];
    const filtered = filterFeaturePRs(prs);
    expect(filtered).toHaveLength(2);
    expect(filtered.map(p => p.number)).toEqual([1, 5]);
  });
});

// ---------------------------------------------------------------------------
// retro.ts helpers
// ---------------------------------------------------------------------------

import { summarizeTrend, generateActionItems } from '../releases/retro.js';

describe('summarizeTrend', () => {
  it('should return empty for no trend data', () => {
    expect(summarizeTrend([])).toBe('');
  });

  it('should report all consecutive hotfixes', () => {
    const trend: TrendEntry[] = [
      { date: '01/12', prCount: 10, stagingHF: 2, releaseHF: 1, outcome: 'hotfix' },
      { date: '01/05', prCount: 8, stagingHF: 1, releaseHF: 0, outcome: 'hotfix' },
    ];
    expect(summarizeTrend(trend)).toContain('2 consecutive releases with hotfixes');
    expect(summarizeTrend(trend)).toContain('4 total over 2 weeks');
  });

  it('should report partial consecutive hotfixes', () => {
    const trend: TrendEntry[] = [
      { date: '01/12', prCount: 10, stagingHF: 1, releaseHF: 0, outcome: 'hotfix' },
      { date: '01/05', prCount: 8, stagingHF: 0, releaseHF: 0, outcome: 'clean' },
    ];
    expect(summarizeTrend(trend)).toContain('Last 1 release(s) had hotfixes');
  });

  it('should report clean when last release was clean', () => {
    const trend: TrendEntry[] = [
      { date: '01/12', prCount: 10, stagingHF: 0, releaseHF: 0, outcome: 'clean' },
      { date: '01/05', prCount: 8, stagingHF: 1, releaseHF: 0, outcome: 'hotfix' },
    ];
    expect(summarizeTrend(trend)).toContain('Last release was clean');
  });
});

describe('generateActionItems', () => {
  it('should list un-backmerged hotfixes', () => {
    const staging = [
      makePR({ number: 10, backmerged: false }),
      makePR({ number: 11, backmerged: true }),
    ];
    const release = [
      makePR({ number: 20, backmerged: false }),
    ];
    const items = generateActionItems(staging, release);
    expect(items).toHaveLength(2);
    expect(items[0]).toContain('#10');
    expect(items[1]).toContain('#20');
  });

  it('should return empty when all backmerged', () => {
    const staging = [makePR({ number: 10, backmerged: true })];
    const items = generateActionItems(staging, []);
    expect(items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// data.ts — fetchPRsByBase
// ---------------------------------------------------------------------------

import { fetchPRsByBase, enrichPRs, findQuickApprovals } from '../releases/data.js';

describe('fetchPRsByBase', () => {
  it('should return empty for no results', () => {
    mockExecFileSync.mockReturnValueOnce(JSON.stringify([]));
    const result = fetchPRsByBase('org', 'repo', 'develop', new Date('2025-01-01'));
    expect(result).toEqual([]);
  });

  it('should filter by date range', () => {
    const prs = [
      { number: 1, merged_at: '2025-01-15T00:00:00Z', title: 'PR 1', user: { login: 'dev1' }, created_at: '2025-01-14T00:00:00Z' },
      { number: 2, merged_at: null, title: 'PR 2 (unmerged)', user: { login: 'dev1' }, created_at: '2025-01-14T00:00:00Z' },
      { number: 3, merged_at: '2024-12-01T00:00:00Z', title: 'PR 3 (too old)', user: { login: 'dev1' }, created_at: '2024-11-30T00:00:00Z' },
    ];
    mockExecFileSync.mockReturnValueOnce(JSON.stringify(prs));
    const result = fetchPRsByBase('org', 'repo', 'develop', new Date('2025-01-01'));
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(1);
  });

  it('should respect until parameter', () => {
    const prs = [
      { number: 1, merged_at: '2025-01-20T00:00:00Z', title: 'PR 1 (after until)', user: { login: 'dev1' }, created_at: '2025-01-19T00:00:00Z' },
      { number: 2, merged_at: '2025-01-10T00:00:00Z', title: 'PR 2 (in range)', user: { login: 'dev1' }, created_at: '2025-01-09T00:00:00Z' },
    ];
    mockExecFileSync.mockReturnValueOnce(JSON.stringify(prs));
    const result = fetchPRsByBase(
      'org', 'repo', 'develop',
      new Date('2025-01-01'),
      new Date('2025-01-15')
    );
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(2);
  });

  it('should stop pagination when no PRs in range', () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      number: i + 1,
      merged_at: '2025-01-10T00:00:00Z',
      title: `PR ${i + 1}`,
      user: { login: 'dev1' },
      created_at: '2025-01-09T00:00:00Z',
    }));
    const page2 = Array.from({ length: 50 }, (_, i) => ({
      number: i + 101,
      merged_at: '2024-11-01T00:00:00Z',
      title: `Old PR ${i + 101}`,
      user: { login: 'dev1' },
      created_at: '2024-10-31T00:00:00Z',
    }));
    mockExecFileSync
      .mockReturnValueOnce(JSON.stringify(page1))
      .mockReturnValueOnce(JSON.stringify(page2));

    const result = fetchPRsByBase('org', 'repo', 'develop', new Date('2025-01-01'));
    expect(result).toHaveLength(100);
    expect(mockExecFileSync).toHaveBeenCalledTimes(2);
  });

  it('should paginate through multiple pages', () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      number: i + 1,
      merged_at: '2025-01-10T00:00:00Z',
      title: `PR ${i + 1}`,
      user: { login: 'dev1' },
      created_at: '2025-01-09T00:00:00Z',
    }));
    const page2 = [
      { number: 101, merged_at: '2025-01-05T00:00:00Z', title: 'PR 101', user: { login: 'dev1' }, created_at: '2025-01-04T00:00:00Z' },
    ];
    mockExecFileSync
      .mockReturnValueOnce(JSON.stringify(page1))
      .mockReturnValueOnce(JSON.stringify(page2));

    const result = fetchPRsByBase('org', 'repo', 'develop', new Date('2025-01-01'));
    expect(result).toHaveLength(101);
  });

  it('should skip unmerged PRs', () => {
    const prs = [
      { number: 1, merged_at: '2025-01-10T00:00:00Z', title: 'Merged', user: { login: 'dev1' }, created_at: '2025-01-09T00:00:00Z' },
      { number: 2, merged_at: null, title: 'Open', user: { login: 'dev1' }, created_at: '2025-01-09T00:00:00Z' },
      { number: 3, merged_at: null, title: 'Also open', user: { login: 'dev2' }, created_at: '2025-01-08T00:00:00Z' },
    ];
    mockExecFileSync.mockReturnValueOnce(JSON.stringify(prs));
    const result = fetchPRsByBase('org', 'repo', 'develop', new Date('2025-01-01'));
    expect(result).toHaveLength(1);
  });

  it('should stop on empty page', () => {
    const page1 = [
      { number: 1, merged_at: '2025-01-10T00:00:00Z', title: 'PR 1', user: { login: 'dev1' }, created_at: '2025-01-09T00:00:00Z' },
    ];
    mockExecFileSync
      .mockReturnValueOnce(JSON.stringify(page1))
      .mockReturnValueOnce(JSON.stringify([]));
    // Second page would never be reached because page1.length < perPage
    const result = fetchPRsByBase('org', 'repo', 'develop', new Date('2025-01-01'));
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// data.ts — enrichPRs
// ---------------------------------------------------------------------------

describe('enrichPRs', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('should populate stats and areaStats on each PR', () => {
    const prs = [makePR({ number: 10 }), makePR({ number: 20 })];
    // getPRStats calls: 2 PRs × 1 call each
    mockExecFileSync
      .mockReturnValueOnce(JSON.stringify({ additions: 100, deletions: 50 }))
      .mockReturnValueOnce(JSON.stringify([{ filename: 'frontend/app.ts', additions: 100, deletions: 50 }]))
      .mockReturnValueOnce(JSON.stringify({ additions: 200, deletions: 75 }))
      .mockReturnValueOnce(JSON.stringify([{ filename: 'backend/api.ts', additions: 200, deletions: 75 }]));

    const totals = enrichPRs('org', 'repo', prs);
    expect(prs[0].stats).toEqual({ additions: 100, deletions: 50 });
    expect(prs[1].stats).toEqual({ additions: 200, deletions: 75 });
    expect(totals).toEqual({ totalAdditions: 300, totalDeletions: 125 });
  });

  it('should return zero totals for empty array', () => {
    const totals = enrichPRs('org', 'repo', []);
    expect(totals).toEqual({ totalAdditions: 0, totalDeletions: 0 });
  });

  it('should populate areaStats correctly', () => {
    const prs = [makePR({ number: 1 })];
    mockExecFileSync
      .mockReturnValueOnce(JSON.stringify({ additions: 50, deletions: 10 }))
      .mockReturnValueOnce(JSON.stringify([
        { filename: 'frontend/page.tsx', additions: 30, deletions: 5 },
        { filename: 'backend/handler.ts', additions: 20, deletions: 5 },
      ]));

    enrichPRs('org', 'repo', prs);
    expect(prs[0].areaStats?.FE).toEqual({ additions: 30, deletions: 5 });
    expect(prs[0].areaStats?.BE).toEqual({ additions: 20, deletions: 5 });
  });

  it('should pre-fetch reviews and comments when fetchReviews is true', () => {
    const prs = [makePR({ number: 1 })];
    // getPRStats + getPRAreaStats + fetchPRReviews + fetchPRComments
    mockExecFileSync
      .mockReturnValueOnce(JSON.stringify({ additions: 10, deletions: 5 }))
      .mockReturnValueOnce(JSON.stringify([]))
      .mockReturnValueOnce(JSON.stringify([
        { user: { login: 'reviewer1' }, state: 'APPROVED', submitted_at: '2025-01-11T00:00:00Z' },
      ]))
      .mockReturnValueOnce(JSON.stringify([
        { user: { login: 'commenter1' } },
      ]));

    enrichPRs('org', 'repo', prs, true);
    expect(prs[0].reviews).toHaveLength(1);
    expect(prs[0].reviews![0].state).toBe('APPROVED');
    expect(prs[0].comments).toHaveLength(1);
    expect(prs[0].comments![0].user.login).toBe('commenter1');
  });

  it('should not fetch reviews when fetchReviews is false', () => {
    const prs = [makePR({ number: 1 })];
    mockExecFileSync
      .mockReturnValueOnce(JSON.stringify({ additions: 10, deletions: 5 }))
      .mockReturnValueOnce(JSON.stringify([]));

    enrichPRs('org', 'repo', prs, false);
    expect(prs[0].reviews).toBeUndefined();
    expect(prs[0].comments).toBeUndefined();
    // Only 2 calls: getPRStats + getPRAreaStats (no reviews/comments)
    expect(mockExecFileSync).toHaveBeenCalledTimes(2);
  });

  it('should log progress to stderr', () => {
    const prs = [makePR({ number: 1 })];
    mockExecFileSync
      .mockReturnValueOnce(JSON.stringify({ additions: 10, deletions: 5 }))
      .mockReturnValueOnce(JSON.stringify([]));

    enrichPRs('org', 'repo', prs);
    expect(stderrSpy).toHaveBeenCalledWith('Fetching stats for 1 PRs...\n');
    expect(stderrSpy).toHaveBeenCalledWith('  [1/1] #1\n');
  });
});

// ---------------------------------------------------------------------------
// data.ts — findQuickApprovals
// ---------------------------------------------------------------------------

describe('findQuickApprovals', () => {
  // ghApiPaginated makes exactly 1 execFileSync call per invocation
  // when the first page has < 100 items (always the case in tests).
  // So per PR: 1 call for fetchPRReviews + 1 call for fetchPRComments = 2 mocks.

  it('should detect quick approval on large PR', () => {
    const prs = [makePR({
      number: 1,
      created_at: '2025-01-10T00:00:00Z',
      stats: { additions: 400, deletions: 200 },
    })];
    mockExecFileSync
      .mockReturnValueOnce(JSON.stringify([
        { user: { login: 'reviewer1' }, state: 'APPROVED', submitted_at: '2025-01-10T00:02:00Z' },
      ]))
      .mockReturnValueOnce(JSON.stringify([]));

    const result = findQuickApprovals('org', 'repo', prs);
    expect(result).toHaveLength(1);
    expect(result[0].reviewTimeMin).toBeLessThan(5);
    expect(result[0].isLarge).toBe(true);
  });

  it('should detect quick approval with zero comments', () => {
    const prs = [makePR({
      number: 1,
      created_at: '2025-01-10T00:00:00Z',
      stats: { additions: 10, deletions: 5 },
    })];
    mockExecFileSync
      .mockReturnValueOnce(JSON.stringify([
        { user: { login: 'reviewer1' }, state: 'APPROVED', submitted_at: '2025-01-10T00:01:00Z' },
      ]))
      .mockReturnValueOnce(JSON.stringify([]));

    const result = findQuickApprovals('org', 'repo', prs);
    expect(result).toHaveLength(1);
    expect(result[0].commentCount).toBe(0);
  });

  it('should ignore non-APPROVED reviews', () => {
    const prs = [makePR({
      number: 1,
      created_at: '2025-01-10T00:00:00Z',
      stats: { additions: 400, deletions: 200 },
    })];
    mockExecFileSync
      .mockReturnValueOnce(JSON.stringify([
        { user: { login: 'reviewer1' }, state: 'CHANGES_REQUESTED', submitted_at: '2025-01-10T00:01:00Z' },
      ]))
      .mockReturnValueOnce(JSON.stringify([]));

    const result = findQuickApprovals('org', 'repo', prs);
    expect(result).toHaveLength(0);
  });

  it('should ignore slow reviews', () => {
    const prs = [makePR({
      number: 1,
      created_at: '2025-01-10T00:00:00Z',
      stats: { additions: 400, deletions: 200 },
    })];
    mockExecFileSync
      .mockReturnValueOnce(JSON.stringify([
        { user: { login: 'reviewer1' }, state: 'APPROVED', submitted_at: '2025-01-10T01:00:00Z' },
      ]))
      .mockReturnValueOnce(JSON.stringify([]));

    const result = findQuickApprovals('org', 'repo', prs);
    expect(result).toHaveLength(0);
  });

  it('should set enriched fields correctly', () => {
    const prs = [makePR({
      number: 42,
      created_at: '2025-01-10T00:00:00Z',
      stats: { additions: 300, deletions: 250 },
    })];
    mockExecFileSync
      .mockReturnValueOnce(JSON.stringify([
        { user: { login: 'r1' }, state: 'APPROVED', submitted_at: '2025-01-10T00:03:00Z' },
      ]))
      .mockReturnValueOnce(JSON.stringify([{ user: { login: 'someone' } }]));

    const result = findQuickApprovals('org', 'repo', prs);
    // Large (550 lines) + quick (3 min) = quick approval
    expect(result).toHaveLength(1);
    expect(result[0].isLarge).toBe(true);
    expect(result[0].commentCount).toBe(1);
    expect(result[0].reviewTimeMin).toBeCloseTo(3, 0);
  });
});

// ---------------------------------------------------------------------------
// retro.ts — getReleaseTrend
// ---------------------------------------------------------------------------

import { getReleaseTrend } from '../releases/retro.js';

describe('getReleaseTrend', () => {
  // Pin Date.now() so tests don't drift with real time.
  // getReleaseTrend calculates since = now - 90 days internally.
  const FAKE_NOW = new Date('2025-03-15T00:00:00Z').getTime();

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FAKE_NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty for fewer than 2 trains', () => {
    const trains = [
      { number: 1, merged_at: '2025-02-15T00:00:00Z', title: 'staging-02-15-25', user: { login: 'dev1' }, created_at: '2025-02-14T00:00:00Z', base: { ref: 'staging' }, head: { ref: 'staging-02-15-25' } },
    ];
    mockExecFileSync.mockReturnValueOnce(JSON.stringify(trains));
    const result = getReleaseTrend('org', 'repo', 4);
    expect(result).toEqual([]);
  });

  it('should return correct trend entries', () => {
    const trains = [
      { number: 2, merged_at: '2025-03-08T00:00:00Z', title: 'staging-03-08-25', user: { login: 'dev1' }, created_at: '2025-03-07T00:00:00Z', base: { ref: 'staging' }, head: { ref: 'staging-03-08-25' } },
      { number: 1, merged_at: '2025-03-01T00:00:00Z', title: 'staging-03-01-25', user: { login: 'dev1' }, created_at: '2025-02-28T00:00:00Z', base: { ref: 'staging' }, head: { ref: 'staging-03-01-25' } },
    ];
    mockExecFileSync.mockReturnValueOnce(JSON.stringify(trains));
    // fetchPRsByBase('develop', prev, current)
    mockExecFileSync.mockReturnValueOnce(JSON.stringify([
      { number: 10, merged_at: '2025-03-05T00:00:00Z', title: 'feat: login', user: { login: 'dev1' }, created_at: '2025-03-04T00:00:00Z', head: { ref: 'feat/login' } },
    ]));
    // fetchPRsByBase('staging', currentDate, nextTrainDate) → no hotfixes
    mockExecFileSync.mockReturnValueOnce(JSON.stringify([]));
    // fetchPRsByBase('release', currentDate, nextTrainDate) → no hotfixes
    mockExecFileSync.mockReturnValueOnce(JSON.stringify([]));

    const result = getReleaseTrend('org', 'repo', 4);
    expect(result).toHaveLength(1);
    expect(result[0].prCount).toBe(1);
    expect(result[0].outcome).toBe('clean');
  });

  it('should detect hotfix outcomes', () => {
    const trains = [
      { number: 2, merged_at: '2025-03-08T00:00:00Z', title: 'staging-03-08-25', user: { login: 'dev1' }, created_at: '2025-03-07T00:00:00Z', base: { ref: 'staging' }, head: { ref: 'staging-03-08-25' } },
      { number: 1, merged_at: '2025-03-01T00:00:00Z', title: 'staging-03-01-25', user: { login: 'dev1' }, created_at: '2025-02-28T00:00:00Z', base: { ref: 'staging' }, head: { ref: 'staging-03-01-25' } },
    ];
    mockExecFileSync.mockReturnValueOnce(JSON.stringify(trains));
    // develop PRs
    mockExecFileSync.mockReturnValueOnce(JSON.stringify([]));
    // staging PRs (contains a hotfix)
    mockExecFileSync.mockReturnValueOnce(JSON.stringify([
      { number: 50, merged_at: '2025-03-09T00:00:00Z', title: 'fix: urgent', user: { login: 'dev1' }, created_at: '2025-03-09T00:00:00Z', base: { ref: 'staging' }, head: { ref: 'fix/urgent' } },
    ]));
    // release PRs
    mockExecFileSync.mockReturnValueOnce(JSON.stringify([]));

    const result = getReleaseTrend('org', 'repo', 4);
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe('hotfix');
    expect(result[0].stagingHF).toBe(1);
  });

  it('should handle multiple train pairs', () => {
    const trains = [
      { number: 3, merged_at: '2025-03-10T00:00:00Z', title: 'staging-03-10-25', user: { login: 'dev1' }, created_at: '2025-03-09T00:00:00Z', base: { ref: 'staging' }, head: { ref: 'staging-03-10-25' } },
      { number: 2, merged_at: '2025-03-03T00:00:00Z', title: 'staging-03-03-25', user: { login: 'dev1' }, created_at: '2025-03-02T00:00:00Z', base: { ref: 'staging' }, head: { ref: 'staging-03-03-25' } },
      { number: 1, merged_at: '2025-02-24T00:00:00Z', title: 'staging-02-24-25', user: { login: 'dev1' }, created_at: '2025-02-23T00:00:00Z', base: { ref: 'staging' }, head: { ref: 'staging-02-24-25' } },
    ];
    mockExecFileSync.mockReturnValueOnce(JSON.stringify(trains));
    // Pair 0 (train[0] vs train[1]): develop, staging, release
    mockExecFileSync.mockReturnValueOnce(JSON.stringify([]));
    mockExecFileSync.mockReturnValueOnce(JSON.stringify([]));
    mockExecFileSync.mockReturnValueOnce(JSON.stringify([]));
    // Pair 1 (train[1] vs train[2]): develop, staging, release
    mockExecFileSync.mockReturnValueOnce(JSON.stringify([]));
    mockExecFileSync.mockReturnValueOnce(JSON.stringify([]));
    mockExecFileSync.mockReturnValueOnce(JSON.stringify([]));

    const result = getReleaseTrend('org', 'repo', 4);
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// releases/cli.ts — parseArgs
// ---------------------------------------------------------------------------

import { parseArgs as releaseParseArgs } from '../releases/cli.js';

describe('releases parseArgs', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('should parse preview action', () => {
    const args = releaseParseArgs(['--action', 'preview']);
    expect(args).toEqual({ action: 'preview', days: 30 });
  });

  it('should parse retro action', () => {
    const args = releaseParseArgs(['--action', 'retro']);
    expect(args).toEqual({ action: 'retro', days: 30 });
  });

  it('should exit on invalid action', () => {
    releaseParseArgs(['--action', 'invalid']);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit when no action provided', () => {
    releaseParseArgs([]);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should parse --days flag', () => {
    const args = releaseParseArgs(['--action', 'preview', '--days', '14']);
    expect(args.days).toBe(14);
  });

  it('should use default days when invalid', () => {
    const args = releaseParseArgs(['--action', 'preview', '--days', 'abc']);
    expect(args.days).toBe(30);
  });
});
