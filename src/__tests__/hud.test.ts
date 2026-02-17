import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFileSync } from 'child_process';
import { openSync, readSync, closeSync, statSync } from 'fs';
import {
  render,
  renderModel,
  renderContextBar,
  renderTokens,
  renderCost,
  renderSessionClock,
  renderGitBranch,
  renderUsableContext,
} from '../hud/render.js';
import type { StatuslineInput } from '../shared/types.js';

// Mock child_process and fs for git/transcript operations
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('fs', () => ({
  openSync: vi.fn(),
  readSync: vi.fn(),
  closeSync: vi.fn(),
  statSync: vi.fn(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

const mockExecFileSync = vi.mocked(execFileSync);
const mockOpenSync = vi.mocked(openSync);
const mockReadSync = vi.mocked(readSync);
const mockCloseSync = vi.mocked(closeSync);
const mockStatSync = vi.mocked(statSync);

// Helper: strip ANSI codes for easier assertions
const ESC = String.fromCharCode(0x1b);
const ANSI_RE = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');
function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}

/**
 * Helper: mock readFirstLine to return a JSONL line with a given timestamp.
 */
function mockTranscriptLine(timestamp: string): void {
  const jsonLine = JSON.stringify({ timestamp, type: 'user' });
  const buf = Buffer.from(jsonLine + '\n');

  mockOpenSync.mockReturnValue(3);
  mockReadSync.mockImplementation((_fd, target) => {
    buf.copy(target as Buffer);
    return buf.length;
  });
  mockCloseSync.mockReturnValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// renderModel
// ---------------------------------------------------------------------------

describe('renderModel', () => {
  it('should return "Opus" for opus model', () => {
    const result = renderModel('claude-opus-4-20250514');
    expect(stripAnsi(result!)).toBe('Opus');
  });

  it('should return "Sonnet" for sonnet model', () => {
    const result = renderModel('claude-sonnet-4-20250514');
    expect(stripAnsi(result!)).toBe('Sonnet');
  });

  it('should return "Haiku" for haiku model', () => {
    const result = renderModel('claude-haiku-4-5-20251001');
    expect(stripAnsi(result!)).toBe('Haiku');
  });

  it('should return null for undefined', () => {
    expect(renderModel(undefined)).toBeNull();
  });

  it('should fall back to raw ID for unknown model', () => {
    const result = renderModel('some-other-model');
    expect(stripAnsi(result!)).toBe('some-other-model');
  });
});

// ---------------------------------------------------------------------------
// renderContextBar
// ---------------------------------------------------------------------------

describe('renderContextBar', () => {
  it('should render a bar for 50%', () => {
    const result = stripAnsi(renderContextBar(50)!);
    expect(result).toContain('ctx:');
    expect(result).toContain('50%');
    expect(result).toContain('█████░░░░░'); // 5 filled, 5 empty
  });

  it('should render full bar at 100%', () => {
    const result = stripAnsi(renderContextBar(100)!);
    expect(result).toContain('100%');
    expect(result).toContain('██████████');
  });

  it('should cap at 100%', () => {
    const result = stripAnsi(renderContextBar(150)!);
    expect(result).toContain('100%');
  });

  it('should return null for undefined', () => {
    expect(renderContextBar(undefined)).toBeNull();
  });

  it('should return null for negative', () => {
    expect(renderContextBar(-5)).toBeNull();
  });

  it('should use green for low usage', () => {
    const result = renderContextBar(30)!;
    // Green ANSI code: \x1b[32m
    expect(result).toContain('\x1b[32m');
  });

  it('should use yellow for 70%+', () => {
    const result = renderContextBar(75)!;
    expect(result).toContain('\x1b[33m');
  });

  it('should use red for 85%+', () => {
    const result = renderContextBar(90)!;
    expect(result).toContain('\x1b[31m');
  });
});

// ---------------------------------------------------------------------------
// renderTokens
// ---------------------------------------------------------------------------

describe('renderTokens', () => {
  it('should show total tokens (input + cacheCreation + cacheRead)', () => {
    // 3 non-cached + 0 creation + 50_000 cache read = 50k total
    const result = stripAnsi(renderTokens(3, 0, 50_000)!);
    expect(result).toContain('in:50k');
  });

  it('should format thousands as k', () => {
    const result = stripAnsi(renderTokens(50_000, 0, 0)!);
    expect(result).toContain('in:50k');
  });

  it('should format millions as M', () => {
    const result = stripAnsi(renderTokens(500_000, 0, 1_000_000)!);
    expect(result).toContain('in:1.5M');
  });

  it('should show cache hit rate using OMC formula', () => {
    // OMC formula: cache_read / (input + cache_creation) * 100
    // So 100k input, 0 creation, 80k cache read → 80k / 100k = 80%
    const result = stripAnsi(renderTokens(100_000, 0, 80_000)!);
    expect(result).toContain('cache:80%');
  });

  it('should include cache creation in denominator', () => {
    // 50k input, 50k creation, 100k read → 100k / (50k + 50k) = 100%
    const result = stripAnsi(renderTokens(50_000, 50_000, 100_000)!);
    expect(result).toContain('cache:100%');
    // Total should be 200k
    expect(result).toContain('in:200k');
  });

  it('should return null for zero tokens', () => {
    expect(renderTokens(0, 0, 0)).toBeNull();
  });

  it('should return null for all undefined', () => {
    expect(renderTokens(undefined, undefined, undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// renderCost
// ---------------------------------------------------------------------------

describe('renderCost', () => {
  it('should estimate cost for opus model', () => {
    // 100k non-cached input tokens on Opus
    const result = stripAnsi(renderCost('claude-opus-4', 100_000, 0, 0)!);
    expect(result).toMatch(/\$\d+\.\d{2}/);
  });

  it('should be cheaper for haiku', () => {
    const opusResult = renderCost('claude-opus-4', 100_000, 0, 0);
    const haikuResult = renderCost('claude-haiku-4', 100_000, 0, 0);

    const opusCost = parseFloat(stripAnsi(opusResult!).replace('$', ''));
    const haikuCost = parseFloat(stripAnsi(haikuResult!).replace('$', ''));
    expect(haikuCost).toBeLessThan(opusCost);
  });

  it('should be cheaper with cache reads', () => {
    // All non-cached: 100k at full input rate
    const noCacheResult = renderCost('claude-opus-4', 100_000, 0, 0);
    // Same total but 90k from cache: cheaper cache rate
    const cachedResult = renderCost('claude-opus-4', 10_000, 0, 90_000);

    const noCacheCost = parseFloat(stripAnsi(noCacheResult!).replace('$', ''));
    const cachedCost = parseFloat(stripAnsi(cachedResult!).replace('$', ''));
    expect(cachedCost).toBeLessThan(noCacheCost);
  });

  it('should return null for zero tokens', () => {
    expect(renderCost('claude-opus-4', 0, 0, 0)).toBeNull();
  });

  it('should return null for undefined model', () => {
    expect(renderCost(undefined, 100_000, 0, 0)).toBeNull();
  });

  it('should return null for tiny cost', () => {
    // Very few tokens = less than half a cent = null
    expect(renderCost('claude-haiku-4', 100, 0, 0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// renderSessionClock
// ---------------------------------------------------------------------------

describe('renderSessionClock', () => {
  it('should return null for undefined transcript path', () => {
    expect(renderSessionClock(undefined)).toBeNull();
  });

  it('should return null for empty transcript path', () => {
    expect(renderSessionClock('')).toBeNull();
  });

  it('should show <1m for recent session', () => {
    const timestamp = new Date(Date.now() - 30_000).toISOString();
    mockTranscriptLine(timestamp);

    const result = stripAnsi(renderSessionClock('/path/to/transcript.jsonl')!);
    expect(result).toContain('t:');
    expect(result).toContain('<1m');
  });

  it('should show minutes for session under an hour', () => {
    const timestamp = new Date(Date.now() - 15 * 60_000).toISOString();
    mockTranscriptLine(timestamp);

    const result = stripAnsi(renderSessionClock('/path/to/transcript.jsonl')!);
    expect(result).toContain('t:');
    expect(result).toContain('15m');
  });

  it('should show hours and minutes for long session', () => {
    const timestamp = new Date(Date.now() - 90 * 60_000).toISOString();
    mockTranscriptLine(timestamp);

    const result = stripAnsi(renderSessionClock('/path/to/transcript.jsonl')!);
    expect(result).toContain('1h 30m');
  });

  it('should use cyan color for elapsed time', () => {
    const timestamp = new Date(Date.now() - 5 * 60_000).toISOString();
    mockTranscriptLine(timestamp);

    const result = renderSessionClock('/path/to/transcript.jsonl')!;
    expect(result).toContain('\x1b[36m'); // cyan
  });

  it('should fallback to file birthtime when JSON has no timestamp', () => {
    const birthtime = new Date(Date.now() - 10 * 60_000);
    const jsonLine = JSON.stringify({ type: 'user' }); // no timestamp
    const buf = Buffer.from(jsonLine + '\n');

    mockOpenSync.mockReturnValue(3);
    mockReadSync.mockImplementation((_fd, target) => {
      buf.copy(target as Buffer);
      return buf.length;
    });
    mockCloseSync.mockReturnValue(undefined);
    mockStatSync.mockReturnValue({ birthtime } as ReturnType<typeof statSync>);

    const result = stripAnsi(renderSessionClock('/path/to/transcript.jsonl')!);
    expect(result).toContain('10m');
  });

  it('should return null when file cannot be read and stat fails', () => {
    mockOpenSync.mockImplementation(() => { throw new Error('ENOENT'); });
    mockStatSync.mockImplementation(() => { throw new Error('ENOENT'); });

    expect(renderSessionClock('/nonexistent/path.jsonl')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// renderGitBranch
// ---------------------------------------------------------------------------

describe('renderGitBranch', () => {
  it('should return null for undefined cwd', () => {
    expect(renderGitBranch(undefined)).toBeNull();
  });

  it('should show branch name with no changes', () => {
    mockExecFileSync
      .mockReturnValueOnce('main\n')  // rev-parse
      .mockReturnValueOnce('')         // diff --shortstat (unstaged)
      .mockReturnValueOnce('');        // diff --cached --shortstat (staged)

    const result = stripAnsi(renderGitBranch('/some/dir')!);
    expect(result).toBe('main');
  });

  it('should show branch with insertions and deletions', () => {
    mockExecFileSync
      .mockReturnValueOnce('feature/cool\n')
      .mockReturnValueOnce(' 3 files changed, 42 insertions(+), 10 deletions(-)\n')
      .mockReturnValueOnce('');

    const result = stripAnsi(renderGitBranch('/some/dir')!);
    expect(result).toContain('feature/cool');
    expect(result).toContain('+42');
    expect(result).toContain('-10');
  });

  it('should combine staged and unstaged changes', () => {
    mockExecFileSync
      .mockReturnValueOnce('dev\n')
      .mockReturnValueOnce(' 2 files changed, 20 insertions(+), 5 deletions(-)\n')
      .mockReturnValueOnce(' 1 file changed, 10 insertions(+), 3 deletions(-)\n');

    const result = stripAnsi(renderGitBranch('/some/dir')!);
    expect(result).toContain('dev');
    expect(result).toContain('+30');
    expect(result).toContain('-8');
  });

  it('should return null if not in a git repo', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('not a git repository');
    });

    expect(renderGitBranch('/not/a/repo')).toBeNull();
  });

  it('should handle insertions only (no deletions)', () => {
    mockExecFileSync
      .mockReturnValueOnce('main\n')
      .mockReturnValueOnce(' 1 file changed, 5 insertions(+)\n')
      .mockReturnValueOnce('');

    const result = stripAnsi(renderGitBranch('/some/dir')!);
    expect(result).toContain('+5');
    expect(result).toContain('-0');
  });

  it('should use cyan for branch name', () => {
    mockExecFileSync
      .mockReturnValueOnce('main\n')
      .mockReturnValueOnce('')
      .mockReturnValueOnce('');

    const result = renderGitBranch('/some/dir')!;
    expect(result).toContain('\x1b[36m'); // cyan
  });

  it('should pass cwd to execFileSync', () => {
    mockExecFileSync
      .mockReturnValueOnce('main\n')
      .mockReturnValueOnce('')
      .mockReturnValueOnce('');

    renderGitBranch('/my/project');

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      expect.objectContaining({ cwd: '/my/project' })
    );
  });
});

// ---------------------------------------------------------------------------
// renderUsableContext
// ---------------------------------------------------------------------------

describe('renderUsableContext', () => {
  it('should return null if contextWindowSize is undefined', () => {
    expect(renderUsableContext(undefined, 50)).toBeNull();
  });

  it('should return null if usedPercentage is undefined', () => {
    expect(renderUsableContext(200_000, undefined)).toBeNull();
  });

  it('should calculate usable percentage correctly', () => {
    // 200k window, 40% used = 80k tokens used
    // Usable limit = 200k * 0.8 = 160k
    // Usable pct = 80k / 160k * 100 = 50%
    const result = stripAnsi(renderUsableContext(200_000, 40)!);
    expect(result).toContain('usable:');
    expect(result).toContain('50%');
  });

  it('should show 100% when at the compact threshold', () => {
    // 80% used = 160k out of 200k = exactly at the 160k usable limit
    const result = stripAnsi(renderUsableContext(200_000, 80)!);
    expect(result).toContain('100%');
  });

  it('should cap at 100% even when over threshold', () => {
    // 90% used = 180k, usable limit = 160k, raw pct = 112.5%
    const result = stripAnsi(renderUsableContext(200_000, 90)!);
    expect(result).toContain('100%');
  });

  it('should use green for low usable percentage', () => {
    // 40% raw = 50% usable → green
    const result = renderUsableContext(200_000, 40)!;
    expect(result).toContain('\x1b[32m'); // green
  });

  it('should use yellow at 70%+ usable', () => {
    // 56% raw = 70% usable → yellow
    const result = renderUsableContext(200_000, 56)!;
    expect(result).toContain('\x1b[33m'); // yellow
  });

  it('should use red at 90%+ usable', () => {
    // 72% raw = 90% usable → red
    const result = renderUsableContext(200_000, 72)!;
    expect(result).toContain('\x1b[31m'); // red
  });
});

// ---------------------------------------------------------------------------
// render (full pipeline)
// ---------------------------------------------------------------------------

describe('render', () => {
  it('should render all elements for full input', () => {
    const input: StatuslineInput = {
      model: { id: 'claude-sonnet-4-20250514' },
      context_window: {
        context_window_size: 200_000,
        used_percentage: 45,
        current_usage: {
          input_tokens: 60_000,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 30_000,
        },
      },
    };

    const result = stripAnsi(render(input));
    expect(result).toContain('[kw]');
    expect(result).toContain('Sonnet');
    expect(result).toContain('ctx:');
    expect(result).toContain('45%');
    // Total = 60k + 0 + 30k = 90k
    expect(result).toContain('in:90k');
  });

  it('should show just [kw] for empty input', () => {
    const result = stripAnsi(render({}));
    expect(result).toBe('[kw]');
  });

  it('should use non-breaking spaces', () => {
    const input: StatuslineInput = {
      model: { id: 'claude-sonnet-4' },
      context_window: { used_percentage: 50 },
    };

    const result = render(input);
    // Should contain non-breaking spaces, not regular ones
    // (except inside ANSI codes)
    const withoutAnsi = stripAnsi(result);
    expect(withoutAnsi).toContain('\u00A0');
  });

  it('should handle model-only input', () => {
    const input: StatuslineInput = {
      model: { id: 'claude-opus-4' },
    };

    const result = stripAnsi(render(input));
    expect(result).toContain('[kw]');
    expect(result).toContain('Opus');
  });

  it('should include session clock when transcript_path is provided', () => {
    const timestamp = new Date(Date.now() - 5 * 60_000).toISOString();
    mockTranscriptLine(timestamp);

    const input: StatuslineInput = {
      transcript_path: '/path/to/transcript.jsonl',
      model: { id: 'claude-sonnet-4' },
    };

    const result = stripAnsi(render(input));
    expect(result).toContain('t:5m');
  });

  it('should include git branch when cwd is provided', () => {
    mockExecFileSync
      .mockReturnValueOnce('main\n')
      .mockReturnValueOnce('')
      .mockReturnValueOnce('');

    const input: StatuslineInput = {
      cwd: '/some/dir',
      model: { id: 'claude-sonnet-4' },
    };

    const result = stripAnsi(render(input));
    expect(result).toContain('main');
  });

  it('should include usable context when context_window data is present', () => {
    const input: StatuslineInput = {
      model: { id: 'claude-sonnet-4' },
      context_window: {
        context_window_size: 200_000,
        used_percentage: 40,
      },
    };

    const result = stripAnsi(render(input));
    expect(result).toContain('usable:50%');
  });
});
