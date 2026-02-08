import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFileSync } from 'child_process';
import type { ReleasePR, TrendEntry } from '../releases/types.js';

// Mock child_process for all data/git-utils functions
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

const mockExecFileSync = vi.mocked(execFileSync);

beforeEach(() => {
  vi.clearAllMocks();
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
