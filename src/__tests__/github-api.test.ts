import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFileSync } from 'child_process';
import {
  getRepoInfo,
  fetchMergedPRs,
  getPRStats,
  fetchPRReviews,
  fetchPRComments,
} from '../github/api.js';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

const mockExecFileSync = vi.mocked(execFileSync);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getRepoInfo
// ---------------------------------------------------------------------------

describe('getRepoInfo', () => {
  it('should parse owner and repo from gh output', () => {
    mockExecFileSync.mockReturnValue(
      JSON.stringify({ owner: { login: 'myorg' }, name: 'myrepo' })
    );

    const result = getRepoInfo();
    expect(result).toEqual({ owner: 'myorg', repo: 'myrepo' });
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['repo', 'view', '--json', 'owner,name'],
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
  });

  it('should exit with error if gh fails', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('not a git repo');
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    getRepoInfo();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not determine repository')
    );
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// fetchMergedPRs
// ---------------------------------------------------------------------------

describe('fetchMergedPRs', () => {
  it('should return merged PRs after since date', () => {
    const prs = [
      {
        number: 1,
        title: 'PR 1',
        user: { login: 'dev1' },
        created_at: '2025-01-10T00:00:00Z',
        merged_at: '2025-01-12T00:00:00Z',
        body: null,
      },
      {
        number: 2,
        title: 'PR 2',
        user: { login: 'dev2' },
        created_at: '2025-01-01T00:00:00Z',
        merged_at: '2025-01-02T00:00:00Z',
        body: null,
      },
    ];

    mockExecFileSync.mockReturnValue(JSON.stringify(prs));

    const since = new Date('2025-01-05T00:00:00Z');
    const result = fetchMergedPRs('owner', 'repo', since);

    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(1);
  });

  it('should stop pagination when page is empty', () => {
    // First call: returns data, second call: returns empty
    mockExecFileSync
      .mockReturnValueOnce(
        JSON.stringify([
          {
            number: 1,
            title: 'PR 1',
            user: { login: 'dev1' },
            created_at: '2025-01-10T00:00:00Z',
            merged_at: '2025-01-12T00:00:00Z',
            body: null,
          },
        ])
      )
      .mockReturnValueOnce(JSON.stringify([]));

    const since = new Date('2025-01-01T00:00:00Z');
    const result = fetchMergedPRs('owner', 'repo', since);

    expect(result).toHaveLength(1);
  });

  it('should pass sort=updated&direction=desc to API', () => {
    mockExecFileSync.mockReturnValue(JSON.stringify([]));

    const since = new Date('2025-01-05T00:00:00Z');
    fetchMergedPRs('owner', 'repo', since);

    const callArgs = mockExecFileSync.mock.calls[0][1] as string[];
    expect(callArgs).toContain('-f');
    expect(callArgs).toContain('sort=updated');
    expect(callArgs).toContain('direction=desc');
  });

  it('should collect all in-range PRs even if out of merge order', () => {
    // Page has a mix: one old-merge, one in-range — both should be checked
    const prs = [
      {
        number: 1,
        title: 'PR 1',
        user: { login: 'dev1' },
        created_at: '2025-01-01T00:00:00Z',
        merged_at: '2025-01-02T00:00:00Z', // out of range
        body: null,
      },
      {
        number: 2,
        title: 'PR 2',
        user: { login: 'dev2' },
        created_at: '2025-01-01T00:00:00Z',
        merged_at: '2025-01-12T00:00:00Z', // in range
        body: null,
      },
    ];

    mockExecFileSync.mockReturnValue(JSON.stringify(prs));

    const since = new Date('2025-01-05T00:00:00Z');
    const result = fetchMergedPRs('owner', 'repo', since);

    // Should collect PR 2 even though PR 1 (appearing first) is out of range
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(2);
  });

  it('should filter out non-merged PRs', () => {
    const prs = [
      {
        number: 1,
        title: 'Open PR',
        user: { login: 'dev1' },
        created_at: '2025-01-10T00:00:00Z',
        merged_at: null,
        body: null,
      },
    ];

    mockExecFileSync.mockReturnValue(JSON.stringify(prs));

    const since = new Date('2025-01-01T00:00:00Z');
    const result = fetchMergedPRs('owner', 'repo', since);

    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getPRStats
// ---------------------------------------------------------------------------

describe('getPRStats', () => {
  it('should return additions and deletions', () => {
    mockExecFileSync.mockReturnValue(
      JSON.stringify({ additions: 100, deletions: 50 })
    );

    const result = getPRStats('owner', 'repo', 42);
    expect(result).toEqual({ additions: 100, deletions: 50 });
  });

  it('should return zeros on error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('API error');
    });
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const result = getPRStats('owner', 'repo', 42);
    expect(result).toEqual({ additions: 0, deletions: 0 });
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Warning: failed to fetch stats'));
    stderrSpy.mockRestore();
  });

  it('should default missing fields to 0', () => {
    mockExecFileSync.mockReturnValue(JSON.stringify({}));

    const result = getPRStats('owner', 'repo', 42);
    expect(result).toEqual({ additions: 0, deletions: 0 });
  });
});

// ---------------------------------------------------------------------------
// fetchPRReviews
// ---------------------------------------------------------------------------

describe('fetchPRReviews', () => {
  it('should return reviews array', () => {
    const reviews = [
      { user: { login: 'reviewer1' }, state: 'APPROVED', submitted_at: '2025-01-12T00:00:00Z' },
    ];
    mockExecFileSync.mockReturnValue(JSON.stringify(reviews));

    const result = fetchPRReviews('owner', 'repo', 1);
    expect(result).toHaveLength(1);
    expect(result[0].user.login).toBe('reviewer1');
  });

  it('should return empty on error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fail');
    });

    const result = fetchPRReviews('owner', 'repo', 1);
    expect(result).toEqual([]);
  });

  it('should paginate when results fill a page', () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      user: { login: `reviewer${i}` },
      state: 'APPROVED',
      submitted_at: '2025-01-12T00:00:00Z',
    }));
    const page2 = [
      { user: { login: 'reviewer100' }, state: 'APPROVED', submitted_at: '2025-01-12T00:00:00Z' },
    ];

    mockExecFileSync
      .mockReturnValueOnce(JSON.stringify(page1))
      .mockReturnValueOnce(JSON.stringify(page2));

    const result = fetchPRReviews('owner', 'repo', 1);
    expect(result).toHaveLength(101);
  });
});

// ---------------------------------------------------------------------------
// fetchPRComments
// ---------------------------------------------------------------------------

describe('fetchPRComments', () => {
  it('should return comments array', () => {
    const comments = [{ user: { login: 'commenter' } }];
    mockExecFileSync.mockReturnValue(JSON.stringify(comments));

    const result = fetchPRComments('owner', 'repo', 1);
    expect(result).toHaveLength(1);
  });

  it('should return empty on error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fail');
    });

    const result = fetchPRComments('owner', 'repo', 1);
    expect(result).toEqual([]);
  });
});
