/**
 * HUD Renderer
 *
 * Takes the raw StatuslineInput from Claude Code and produces a formatted
 * text string with ANSI colors for the statusbar.
 *
 * OMC Pattern: Each piece of the statusline is an "element" — a pure function
 * that takes data and returns a colored string or null (if nothing to show).
 * The renderer collects non-null elements and joins them with separators.
 *
 * Output uses non-breaking spaces (\u00A0) for terminal alignment stability.
 */

import { openSync, readSync, closeSync, statSync } from 'fs';
import { execFileSync } from 'child_process';
import type { StatuslineInput } from '../shared/types.js';
import { bold, dim, cyan, green, yellow, red, magenta } from './colors.js';

// ---------------------------------------------------------------------------
// Model pricing (USD per million tokens)
// ---------------------------------------------------------------------------

interface ModelPricing {
  input: number;
  cacheRead: number;
  output: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  opus: { input: 15, cacheRead: 1.5, output: 75 },
  sonnet: { input: 3, cacheRead: 0.3, output: 15 },
  haiku: { input: 0.8, cacheRead: 0.08, output: 4 },
};

function getPricing(modelId: string): ModelPricing {
  const lower = modelId.toLowerCase();
  if (lower.includes('opus')) return MODEL_PRICING.opus;
  if (lower.includes('haiku')) return MODEL_PRICING.haiku;
  return MODEL_PRICING.sonnet; // default
}

// ---------------------------------------------------------------------------
// Element: Model name
// ---------------------------------------------------------------------------

export function renderModel(modelId: string | undefined): string | null {
  if (!modelId) return null;

  const lower = modelId.toLowerCase();
  let name: string;
  let colorFn: (s: string) => string;

  if (lower.includes('opus')) {
    name = 'Opus';
    colorFn = magenta;
  } else if (lower.includes('haiku')) {
    name = 'Haiku';
    colorFn = cyan;
  } else if (lower.includes('sonnet')) {
    name = 'Sonnet';
    colorFn = green;
  } else {
    name = modelId;
    colorFn = dim;
  }

  return colorFn(name);
}

// ---------------------------------------------------------------------------
// Element: Context window usage bar
// ---------------------------------------------------------------------------

export function renderContextBar(
  usedPercentage: number | undefined
): string | null {
  if (usedPercentage === undefined || usedPercentage < 0) return null;

  const pct = Math.min(Math.round(usedPercentage), 100);
  const barWidth = 10;
  const filled = Math.round((pct / 100) * barWidth);
  const empty = barWidth - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  let colorFn: (s: string) => string;
  if (pct >= 85) {
    colorFn = red;
  } else if (pct >= 70) {
    colorFn = yellow;
  } else {
    colorFn = green;
  }

  return `${dim('ctx:')}${colorFn(`[${bar}]`)}${dim(`${pct}%`)}`;
}

// ---------------------------------------------------------------------------
// Element: Token count (compact)
// ---------------------------------------------------------------------------

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}k`;
  return `${count}`;
}

/**
 * Render token count and cache hit rate.
 *
 * Claude Code reports tokens as:
 *   input_tokens           — non-cached input tokens
 *   cache_creation_input_tokens — tokens written to cache this turn
 *   cache_read_input_tokens     — tokens read from cache
 *
 * Total input = all three summed.
 * Cache hit rate = cache_read / (input + cache_creation) (OMC formula).
 */
export function renderTokens(
  inputTokens: number | undefined,
  cacheCreationTokens: number | undefined,
  cacheReadTokens: number | undefined
): string | null {
  const input = inputTokens ?? 0;
  const cacheCreation = cacheCreationTokens ?? 0;
  const cacheRead = cacheReadTokens ?? 0;
  const total = input + cacheCreation + cacheRead;

  if (total === 0) return null;

  const parts: string[] = [];
  parts.push(`${dim('in:')}${formatTokens(total)}`);

  // Cache hit rate: reads / (non-cached + creation) — OMC's formula
  const denominator = input + cacheCreation;
  if (cacheRead > 0 && denominator > 0) {
    const hitRate = Math.round((cacheRead / denominator) * 100);
    parts.push(`${dim('cache:')}${green(`${hitRate}%`)}`);
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Element: Estimated cost
// ---------------------------------------------------------------------------

/**
 * Render estimated session cost.
 *
 * Uses the same three-field token breakdown as renderTokens.
 * input_tokens + cache_creation → billed at input rate
 * cache_read → billed at cache read rate
 * Output estimated at 25% of total input (OMC heuristic).
 */
export function renderCost(
  modelId: string | undefined,
  inputTokens: number | undefined,
  cacheCreationTokens: number | undefined,
  cacheReadTokens: number | undefined
): string | null {
  const input = inputTokens ?? 0;
  const cacheCreation = cacheCreationTokens ?? 0;
  const cacheRead = cacheReadTokens ?? 0;
  const totalInput = input + cacheCreation + cacheRead;

  if (!modelId || totalInput === 0) return null;

  const pricing = getPricing(modelId);

  // Non-cached + cache creation both billed at full input rate
  const regularInput = input + cacheCreation;
  const estimatedOutput = Math.round(totalInput * 0.25);

  const inputCost = (regularInput / 1_000_000) * pricing.input;
  const cacheCost = (cacheRead / 1_000_000) * pricing.cacheRead;
  const outputCost = (estimatedOutput / 1_000_000) * pricing.output;
  const total = inputCost + cacheCost + outputCost;

  if (total < 0.005) return null; // Skip if less than half a cent

  let colorFn: (s: string) => string;
  if (total >= 5) {
    colorFn = red;
  } else if (total >= 2) {
    colorFn = yellow;
  } else {
    colorFn = dim;
  }

  return `${dim('$')}${colorFn(total.toFixed(2))}`;
}

// ---------------------------------------------------------------------------
// Helpers (private)
// ---------------------------------------------------------------------------

/**
 * Read only the first line of a file without loading the whole thing.
 * Transcript JSONL files can be very large — we only need line 1.
 */
function readFirstLine(filePath: string): string | null {
  let fd: number | undefined;
  try {
    fd = openSync(filePath, 'r');
    const buf = Buffer.alloc(4096);
    const bytesRead = readSync(fd, buf, 0, 4096, 0);
    const content = buf.toString('utf-8', 0, bytesRead);
    const newlineIdx = content.indexOf('\n');
    return newlineIdx >= 0 ? content.substring(0, newlineIdx) : content;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function formatElapsed(ms: number): string {
  if (ms < 0) return '<1m';
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return '<1m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function parseShortstat(output: string): { insertions: number; deletions: number } {
  const insMatch = output.match(/(\d+) insertions?\(\+\)/);
  const delMatch = output.match(/(\d+) deletions?\(-\)/);
  return {
    insertions: insMatch ? parseInt(insMatch[1], 10) : 0,
    deletions: delMatch ? parseInt(delMatch[1], 10) : 0,
  };
}

// ---------------------------------------------------------------------------
// Element: Session clock
// ---------------------------------------------------------------------------

/**
 * Render elapsed session time from the transcript file.
 * Reads the first JSONL line for its timestamp, falls back to file birthtime.
 */
export function renderSessionClock(
  transcriptPath: string | undefined
): string | null {
  if (!transcriptPath) return null;

  let startTime: number | undefined;

  // Try to extract timestamp from first JSONL line
  const firstLine = readFirstLine(transcriptPath);
  if (firstLine) {
    try {
      const parsed = JSON.parse(firstLine) as Record<string, unknown>;
      if (typeof parsed.timestamp === 'string') {
        const ts = new Date(parsed.timestamp).getTime();
        if (!isNaN(ts)) startTime = ts;
      }
    } catch {
      // Fall through to birthtime fallback
    }
  }

  // Fallback: use file creation time
  if (startTime === undefined) {
    try {
      startTime = statSync(transcriptPath).birthtime.getTime();
    } catch {
      return null;
    }
  }

  const elapsed = Date.now() - startTime;
  return `${dim('t:')}${cyan(formatElapsed(elapsed))}`;
}

// ---------------------------------------------------------------------------
// Element: Git branch + changes
// ---------------------------------------------------------------------------

/**
 * Render current git branch and change counts.
 * Shows branch name, and (+N,-N) for combined staged/unstaged changes.
 */
export function renderGitBranch(cwd: string | undefined): string | null {
  if (!cwd) return null;

  const execOpts = { cwd, encoding: 'utf-8' as const, timeout: 5000 };

  let branch: string;
  try {
    branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], execOpts).trim();
  } catch {
    return null; // Not a git repo
  }

  let unstaged = { insertions: 0, deletions: 0 };
  let staged = { insertions: 0, deletions: 0 };

  try {
    unstaged = parseShortstat(execFileSync('git', ['diff', '--shortstat'], execOpts));
  } catch {
    // No unstaged changes or git error
  }

  try {
    staged = parseShortstat(execFileSync('git', ['diff', '--cached', '--shortstat'], execOpts));
  } catch {
    // No staged changes or git error
  }

  const totalIns = unstaged.insertions + staged.insertions;
  const totalDel = unstaged.deletions + staged.deletions;

  if (totalIns === 0 && totalDel === 0) {
    return cyan(branch);
  }

  return `${cyan(branch)} ${dim('(')}${green(`+${totalIns}`)}${dim(',')}${red(`-${totalDel}`)}${dim(')')}`;
}

// ---------------------------------------------------------------------------
// Element: Usable context percentage
// ---------------------------------------------------------------------------

/**
 * Render how close the session is to the auto-compact threshold.
 * Claude Code auto-compacts at ~80% of the context window.
 */
export function renderUsableContext(
  contextWindowSize: number | undefined,
  usedPercentage: number | undefined
): string | null {
  if (contextWindowSize === undefined || usedPercentage === undefined) return null;

  const usableLimit = contextWindowSize * 0.8;
  const currentTokens = contextWindowSize * (usedPercentage / 100);
  const usablePct = Math.min(Math.round((currentTokens / usableLimit) * 100), 100);

  let colorFn: (s: string) => string;
  if (usablePct >= 90) {
    colorFn = red;
  } else if (usablePct >= 70) {
    colorFn = yellow;
  } else {
    colorFn = green;
  }

  return `${dim('usable:')}${colorFn(`${usablePct}%`)}`;
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render the statusline from Claude Code's input.
 *
 * Returns a plain text string with ANSI color codes.
 * OMC replaces spaces with non-breaking spaces for terminal stability.
 */
export function render(input: StatuslineInput): string {
  const elements: string[] = [];

  // Model name
  const model = renderModel(input.model?.id);
  if (model) elements.push(model);

  // Session clock
  const clock = renderSessionClock(input.transcript_path);
  if (clock) elements.push(clock);

  // Git branch + changes
  const git = renderGitBranch(input.cwd);
  if (git) elements.push(git);

  // Context bar
  const contextBar = renderContextBar(input.context_window?.used_percentage);
  if (contextBar) elements.push(contextBar);

  // Usable context percentage
  const usable = renderUsableContext(
    input.context_window?.context_window_size,
    input.context_window?.used_percentage
  );
  if (usable) elements.push(usable);

  // Token count
  const usage = input.context_window?.current_usage;
  const tokens = renderTokens(
    usage?.input_tokens,
    usage?.cache_creation_input_tokens,
    usage?.cache_read_input_tokens
  );
  if (tokens) elements.push(tokens);

  // Cost estimate
  const cost = renderCost(
    input.model?.id,
    usage?.input_tokens,
    usage?.cache_creation_input_tokens,
    usage?.cache_read_input_tokens
  );
  if (cost) elements.push(cost);

  if (elements.length === 0) {
    return bold('[kw]');
  }

  // Join with separator and add prefix
  const line = `${bold('[kw]')} ${elements.join(dim(' | '))}`;

  // Replace spaces with non-breaking spaces for terminal alignment
  return line.replace(/ /g, '\u00A0');
}
