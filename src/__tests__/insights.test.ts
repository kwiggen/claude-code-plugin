import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PRResponse } from '../github/types.js';
import { formatDate, formatDuration, median, truncate, formatNumber } from '../insights/utils.js';

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  it('should format ISO date to "Mon DD"', () => {
    expect(formatDate('2025-01-15T10:30:00Z')).toBe('Jan 15');
    expect(formatDate('2025-12-01T00:00:00Z')).toBe('Dec 01');
  });
});

describe('formatDuration', () => {
  it('should format under 1 hour as minutes', () => {
    expect(formatDuration(30 * 60 * 1000)).toBe('30 min');
    expect(formatDuration(5 * 60 * 1000)).toBe('5 min');
  });

  it('should format under 24 hours as hours', () => {
    expect(formatDuration(2 * 60 * 60 * 1000)).toBe('2.0 hrs');
    expect(formatDuration(12.5 * 60 * 60 * 1000)).toBe('12.5 hrs');
  });

  it('should format 24+ hours as days', () => {
    expect(formatDuration(48 * 60 * 60 * 1000)).toBe('2.0 days');
    expect(formatDuration(36 * 60 * 60 * 1000)).toBe('1.5 days');
  });
});

describe('median', () => {
  it('should return 0 for empty array', () => {
    expect(median([])).toBe(0);
  });

  it('should return middle for odd-length array', () => {
    expect(median([1, 3, 5])).toBe(3);
  });

  it('should return average of two middles for even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('should handle unsorted input', () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it('should handle single element', () => {
    expect(median([42])).toBe(42);
  });
});

describe('truncate', () => {
  it('should not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('should truncate and add ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });

  it('should not truncate at exact length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
});

describe('formatNumber', () => {
  it('should format numbers with commas', () => {
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('should not format small numbers', () => {
    expect(formatNumber(42)).toBe('42');
  });
});

// ---------------------------------------------------------------------------
// Actions (using mocked GitHub API)
// ---------------------------------------------------------------------------

vi.mock('../github/api.js', () => ({
  getRepoInfo: vi.fn(() => ({ owner: 'test-org', repo: 'test-repo' })),
  fetchMergedPRs: vi.fn(),
  getPRStats: vi.fn(),
  fetchPRReviews: vi.fn(),
  fetchPRComments: vi.fn(),
}));

import { fetchMergedPRs, getPRStats, fetchPRReviews, fetchPRComments } from '../github/api.js';

const mockFetchMergedPRs = vi.mocked(fetchMergedPRs);
const mockGetPRStats = vi.mocked(getPRStats);
const mockFetchPRReviews = vi.mocked(fetchPRReviews);
const mockFetchPRComments = vi.mocked(fetchPRComments);

const since = new Date('2025-01-01T00:00:00Z');

const makePR = (overrides: Partial<PRResponse> = {}): PRResponse => ({
  number: 1,
  title: 'Test PR',
  user: { login: 'dev1' },
  created_at: '2025-01-10T00:00:00Z',
  merged_at: '2025-01-12T12:00:00Z',
  body: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('prsMerged action', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should display empty message when no PRs', async () => {
    mockFetchMergedPRs.mockReturnValue([]);

    const { prsMerged } = await import('../insights/actions/prs-merged.js');
    prsMerged('owner', 'repo', since);

    expect(consoleSpy).toHaveBeenCalledWith('No PRs merged in the specified time range.');
  });

  it('should list PRs with stats', async () => {
    mockFetchMergedPRs.mockReturnValue([makePR()]);
    mockGetPRStats.mockReturnValue({ additions: 100, deletions: 50 });

    const { prsMerged } = await import('../insights/actions/prs-merged.js');
    prsMerged('owner', 'repo', since, true);

    const output = consoleSpy.mock.calls.map((c: string[]) => c[0]).join('\n');
    expect(output).toContain('## PRs Merged (1 total)');
    expect(output).toContain('@dev1');
    expect(output).toContain('+100/-50');
  });

  it('should list PRs without stats', async () => {
    mockFetchMergedPRs.mockReturnValue([makePR()]);

    const { prsMerged } = await import('../insights/actions/prs-merged.js');
    prsMerged('owner', 'repo', since, false);

    const output = consoleSpy.mock.calls.map((c: string[]) => c[0]).join('\n');
    expect(output).toContain('@dev1');
    expect(output).not.toContain('+/-');
  });
});

describe('leaderboard action', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should rank authors by PR count', async () => {
    mockFetchMergedPRs.mockReturnValue([
      makePR({ number: 1, user: { login: 'alice' } }),
      makePR({ number: 2, user: { login: 'alice' } }),
      makePR({ number: 3, user: { login: 'bob' } }),
    ]);
    mockGetPRStats.mockReturnValue({ additions: 10, deletions: 5 });

    const { leaderboard } = await import('../insights/actions/leaderboard.js');
    leaderboard('owner', 'repo', since);

    const output = consoleSpy.mock.calls.map((c: string[]) => c[0]).join('\n');
    expect(output).toContain('## Leaderboard');
    expect(output).toContain('@alice');
    expect(output).toContain('@bob');
    // Alice should appear first (2 PRs vs 1)
    const aliceIdx = output.indexOf('@alice');
    const bobIdx = output.indexOf('@bob');
    expect(aliceIdx).toBeLessThan(bobIdx);
  });
});

describe('timeToMerge action', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should calculate merge times', async () => {
    mockFetchMergedPRs.mockReturnValue([
      makePR({
        created_at: '2025-01-10T00:00:00Z',
        merged_at: '2025-01-11T00:00:00Z', // 24 hours
      }),
    ]);

    const { timeToMerge } = await import('../insights/actions/time-to-merge.js');
    timeToMerge('owner', 'repo', since);

    const output = consoleSpy.mock.calls.map((c: string[]) => c[0]).join('\n');
    expect(output).toContain('## Time to Merge');
    expect(output).toContain('1.0 days');
  });
});

describe('reviews action', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should track review participation', async () => {
    mockFetchMergedPRs.mockReturnValue([makePR()]);
    mockFetchPRReviews.mockReturnValue([
      { user: { login: 'reviewer1' }, state: 'APPROVED', submitted_at: '2025-01-11T00:00:00Z' },
    ]);

    const { reviews } = await import('../insights/actions/reviews.js');
    reviews('owner', 'repo', since);

    const output = consoleSpy.mock.calls.map((c: string[]) => c[0]).join('\n');
    expect(output).toContain('## Review Participation');
    expect(output).toContain('@reviewer1');
    expect(output).toContain('@dev1');
  });
});

describe('reverts action', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should detect revert PRs', async () => {
    mockFetchMergedPRs.mockReturnValue([
      makePR({ title: 'Revert: Fix login bug', body: 'reverts #42' }),
      makePR({ number: 2, title: 'Normal feature' }),
    ]);

    const { reverts } = await import('../insights/actions/reverts.js');
    reverts('owner', 'repo', since);

    const output = consoleSpy.mock.calls.map((c: string[]) => c[0]).join('\n');
    expect(output).toContain('## Reverts & Hotfixes');
    expect(output).toContain('Revert');
    expect(output).toContain('#42');
  });

  it('should detect hotfix PRs', async () => {
    mockFetchMergedPRs.mockReturnValue([
      makePR({ title: 'hotfix: urgent production issue' }),
    ]);

    const { reverts } = await import('../insights/actions/reverts.js');
    reverts('owner', 'repo', since);

    const output = consoleSpy.mock.calls.map((c: string[]) => c[0]).join('\n');
    expect(output).toContain('Hotfix');
  });
});

describe('activity action', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should show summary and leaderboard without double fetch', async () => {
    mockFetchMergedPRs.mockReturnValue([
      makePR({ merged_at: '2025-01-13T14:00:00Z' }),
      makePR({ number: 2, user: { login: 'dev2' }, merged_at: '2025-01-14T10:00:00Z' }),
    ]);
    mockGetPRStats.mockReturnValue({ additions: 50, deletions: 20 });

    const { activity } = await import('../insights/actions/activity.js');
    activity('owner', 'repo', since);

    const output = consoleSpy.mock.calls.map((c: string[]) => c[0]).join('\n');
    expect(output).toContain('## Activity Summary');
    expect(output).toContain('**PRs Merged:** 2');
    expect(output).toContain('**Contributors:** 2');
    expect(output).toContain('## Leaderboard');
    // getPRStats should only be called once per PR (not doubled)
    expect(mockGetPRStats).toHaveBeenCalledTimes(2);
  });
});

describe('prSize action', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should categorize PRs into size buckets', async () => {
    mockFetchMergedPRs.mockReturnValue([
      makePR({ number: 1 }),
      makePR({ number: 2 }),
    ]);
    // First call: small PR, second call: large PR
    mockGetPRStats
      .mockReturnValueOnce({ additions: 20, deletions: 10 })
      .mockReturnValueOnce({ additions: 400, deletions: 200 });

    const { prSize } = await import('../insights/actions/pr-size.js');
    prSize('owner', 'repo', since);

    const output = consoleSpy.mock.calls.map((c: string[]) => c[0]).join('\n');
    expect(output).toContain('## PR Size Analysis');
    expect(output).toContain('Small (<100)');
    expect(output).toContain('Large (500+)');
  });
});

describe('firstReview action', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should show wait time for first review', async () => {
    mockFetchMergedPRs.mockReturnValue([makePR()]);
    mockFetchPRReviews.mockReturnValue([
      { user: { login: 'reviewer1' }, state: 'APPROVED', submitted_at: '2025-01-11T00:00:00Z' },
    ]);

    const { firstReview } = await import('../insights/actions/first-review.js');
    firstReview('owner', 'repo', since);

    const output = consoleSpy.mock.calls.map((c: string[]) => c[0]).join('\n');
    expect(output).toContain('## Time to First Review');
    expect(output).toContain('@dev1');
    // Created at Jan 10, first review at Jan 11 = ~24 hours = 1.0 days
    expect(output).toContain('1.0 days');
  });

  it('should show empty message when no reviews', async () => {
    mockFetchMergedPRs.mockReturnValue([makePR()]);
    mockFetchPRReviews.mockReturnValue([]);

    const { firstReview } = await import('../insights/actions/first-review.js');
    firstReview('owner', 'repo', since);

    const output = consoleSpy.mock.calls.map((c: string[]) => c[0]).join('\n');
    expect(output).toContain('No reviews found');
  });
});

describe('reviewBalance action', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should show reviews given vs received', async () => {
    mockFetchMergedPRs.mockReturnValue([
      makePR({ number: 1, user: { login: 'alice' } }),
      makePR({ number: 2, user: { login: 'bob' } }),
    ]);
    mockFetchPRReviews
      .mockReturnValueOnce([
        { user: { login: 'bob' }, state: 'APPROVED', submitted_at: '2025-01-11T00:00:00Z' },
      ])
      .mockReturnValueOnce([
        { user: { login: 'alice' }, state: 'APPROVED', submitted_at: '2025-01-11T00:00:00Z' },
      ]);

    const { reviewBalance } = await import('../insights/actions/review-balance.js');
    reviewBalance('owner', 'repo', since);

    const output = consoleSpy.mock.calls.map((c: string[]) => c[0]).join('\n');
    expect(output).toContain('## Review Balance');
    expect(output).toContain('@alice');
    expect(output).toContain('@bob');
    expect(output).toContain('Balanced');
  });
});

describe('reviewCycles action', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should count review cycles', async () => {
    mockFetchMergedPRs.mockReturnValue([makePR()]);
    mockFetchPRReviews.mockReturnValue([
      { user: { login: 'reviewer1' }, state: 'CHANGES_REQUESTED', submitted_at: '2025-01-11T00:00:00Z' },
      { user: { login: 'reviewer1' }, state: 'APPROVED', submitted_at: '2025-01-12T00:00:00Z' },
    ]);

    const { reviewCycles } = await import('../insights/actions/review-cycles.js');
    reviewCycles('owner', 'repo', since);

    const output = consoleSpy.mock.calls.map((c: string[]) => c[0]).join('\n');
    expect(output).toContain('## Review Cycles');
    // 1 initial + 1 changes_requested = 2 cycles
    expect(output).toContain('| 2 |');
  });
});

describe('reviewDepth action', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should cap rubber stamp % at 100 with multiple stamps per PR', async () => {
    mockFetchMergedPRs.mockReturnValue([makePR()]);
    mockGetPRStats.mockReturnValue({ additions: 600, deletions: 100 });
    mockFetchPRReviews.mockReturnValue([
      { user: { login: 'reviewer1' }, state: 'APPROVED', submitted_at: '2025-01-10T00:01:00Z' },
      { user: { login: 'reviewer2' }, state: 'APPROVED', submitted_at: '2025-01-10T00:02:00Z' },
      { user: { login: 'reviewer3' }, state: 'APPROVED', submitted_at: '2025-01-10T00:03:00Z' },
    ]);
    mockFetchPRComments.mockReturnValue([]);

    const { reviewDepth } = await import('../insights/actions/review-depth.js');
    reviewDepth('owner', 'repo', since);

    const output = consoleSpy.mock.calls.map((c: string[]) => c[0]).join('\n');
    // With the fix, rubber stamp % counts unique PRs, not reviews
    // 1 PR rubber-stamped out of 1 reviewed = 100%, not 300%
    expect(output).toContain('Potential Rubber Stamps:** 100%');
    expect(output).not.toMatch(/Rubber Stamps:\*\* [2-9]\d+%/);
  });

  it('should detect rubber stamp reviews', async () => {
    mockFetchMergedPRs.mockReturnValue([makePR()]);
    mockGetPRStats.mockReturnValue({ additions: 600, deletions: 100 }); // Large PR
    mockFetchPRReviews.mockReturnValue([
      {
        user: { login: 'reviewer1' },
        state: 'APPROVED',
        submitted_at: '2025-01-10T00:02:00Z', // 2 min after creation = rubber stamp
      },
    ]);
    mockFetchPRComments.mockReturnValue([]);

    const { reviewDepth } = await import('../insights/actions/review-depth.js');
    reviewDepth('owner', 'repo', since);

    const output = consoleSpy.mock.calls.map((c: string[]) => c[0]).join('\n');
    expect(output).toContain('## Review Depth Analysis');
    expect(output).toContain('Potential Rubber Stamps');
  });
});
