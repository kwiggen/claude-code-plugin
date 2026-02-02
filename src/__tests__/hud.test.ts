import { describe, it, expect } from 'vitest';
import {
  render,
  renderModel,
  renderContextBar,
  renderTokens,
  renderCost,
} from '../hud/render.js';
import type { StatuslineInput } from '../shared/types.js';

// Helper: strip ANSI codes for easier assertions
const ESC = String.fromCharCode(0x1b);
const ANSI_RE = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');
function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}

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
    // 20k non-cached, 0 creation, 80k cache read → 80k / (20k + 0) = 400%? No.
    // Correct scenario: 20k non-cached, 0 creation, 80k cache read
    //   hit rate = 80k / (20k + 0) * 100 = 400% — that's if cache > input
    // More realistic: 10k non-cached, 0 creation, 90k cache read
    //   total = 100k, hit rate = 90k / 10k = 900% — still wrong thinking
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
});
