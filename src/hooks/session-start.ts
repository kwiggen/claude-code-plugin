/**
 * Session Start Hook Logic
 *
 * Pure functions that build the context injected at session start.
 * No I/O here — the scripts/session-start.mjs handles stdin/stdout.
 *
 * OMC Pattern: Separate "what to do" (TypeScript) from "how to run" (shell script).
 * This makes the logic testable without mocking process.stdin/stdout.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { CommandInfo, SessionStartOutput } from '../shared/types.js';

export interface SessionStartResult {
  pluginName: string;
  version: string;
  commands: CommandInfo[];
}

/**
 * Parse YAML frontmatter from a command markdown file.
 * Extracts description and argument-hint fields.
 *
 * This reads the same frontmatter format your existing commands use:
 * ---
 * description: "Short description"
 * argument-hint: "[optional-arg]"
 * ---
 */
export function parseCommandFrontmatter(content: string): {
  description: string;
  argumentHint?: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return { description: '' };
  }

  const frontmatter = match[1];
  const descMatch = frontmatter.match(/description:\s*"([^"]+)"/);
  const hintMatch = frontmatter.match(/argument-hint:\s*"([^"]+)"/);

  return {
    description: descMatch?.[1] ?? '',
    argumentHint: hintMatch?.[1],
  };
}

/**
 * Discover available slash commands by scanning a commands directory.
 * Returns sorted list of command metadata.
 */
export function discoverCommands(commandsDir: string): CommandInfo[] {
  if (!existsSync(commandsDir)) return [];

  try {
    return readdirSync(commandsDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const name = f.replace('.md', '');
        try {
          const content = readFileSync(join(commandsDir, f), 'utf-8');
          const { description, argumentHint } = parseCommandFrontmatter(content);
          return { name, description, argumentHint };
        } catch {
          return { name, description: '' };
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/**
 * Build the SessionStart context output.
 *
 * This is the core function — it reads plugin metadata and commands,
 * then formats a context message that Claude will see at the start
 * of every session. The hookSpecificOutput.additionalContext field
 * is how Claude Code injects text into the model's context window.
 */
export function buildSessionStartContext(
  pluginRoot: string
): SessionStartOutput {
  // Read plugin metadata
  let version = 'unknown';
  let pluginName = 'kw-plugin';

  try {
    const pluginJsonPath = join(pluginRoot, '.claude-plugin', 'plugin.json');
    if (existsSync(pluginJsonPath)) {
      const raw = readFileSync(pluginJsonPath, 'utf-8');
      const pluginJson = JSON.parse(raw) as Record<string, unknown>;
      if (typeof pluginJson.version === 'string') version = pluginJson.version;
      if (typeof pluginJson.name === 'string') pluginName = pluginJson.name;
    }
  } catch {
    // Use defaults on any error
  }

  // Discover commands
  const commands = discoverCommands(join(pluginRoot, 'commands'));

  // Build context message
  const lines: string[] = [];
  lines.push(`[${pluginName} v${version}] Plugin active.`);

  if (commands.length > 0) {
    lines.push('');
    lines.push('Available commands:');
    for (const cmd of commands) {
      const desc = cmd.description ? ` - ${cmd.description}` : '';
      lines.push(`  /${cmd.name}${desc}`);
    }
  }

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: lines.join('\n'),
    },
  };
}
