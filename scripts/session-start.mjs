#!/usr/bin/env node

/**
 * kw-plugin Session Start Hook
 *
 * This is the STANDALONE version — uses only Node.js builtins, no compilation needed.
 * Claude Code runs this via hooks/hooks.json on every session start.
 *
 * The contract:
 *   stdin  → JSON { sessionId, directory }
 *   stdout → JSON { continue: true, hookSpecificOutput: { hookEventName, additionalContext } }
 *
 * OMC Pattern: This script is intentionally self-contained. The TypeScript version
 * in src/hooks/session-start.ts has the same logic but is testable via vitest.
 * In future phases, this script will import from dist/ for complex logic.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PLUGIN_ROOT = join(__dirname, '..');

/**
 * Read all of stdin as a string.
 * Claude Code pipes JSON into our script this way.
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Parse YAML frontmatter description from a command .md file.
 */
function parseDescription(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return '';
  const descMatch = match[1].match(/description:\s*"([^"]+)"/);
  return descMatch ? descMatch[1] : '';
}

/**
 * Discover slash commands from the commands/ directory.
 */
function discoverCommands(pluginRoot) {
  const commandsDir = join(pluginRoot, 'commands');
  if (!existsSync(commandsDir)) return [];

  try {
    return readdirSync(commandsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const name = f.replace('.md', '');
        try {
          const content = readFileSync(join(commandsDir, f), 'utf-8');
          return { name, description: parseDescription(content) };
        } catch {
          return { name, description: '' };
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function main() {
  try {
    // Read input from Claude Code (we don't use it yet, but the contract requires reading it)
    const input = await readStdin();
    let _data = {};
    try { _data = JSON.parse(input); } catch { /* empty input is fine */ }

    // Read plugin metadata
    let version = 'unknown';
    let pluginName = 'kw-plugin';
    try {
      const pluginJsonPath = join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json');
      if (existsSync(pluginJsonPath)) {
        const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf-8'));
        version = pluginJson.version ?? version;
        pluginName = pluginJson.name ?? pluginName;
      }
    } catch { /* use defaults */ }

    // Discover commands
    const commands = discoverCommands(PLUGIN_ROOT);

    // Build context message
    const lines = [];
    lines.push(`[${pluginName} v${version}] Plugin active.`);

    if (commands.length > 0) {
      lines.push('');
      lines.push('Available commands:');
      for (const cmd of commands) {
        const desc = cmd.description ? ` - ${cmd.description}` : '';
        lines.push(`  /${cmd.name}${desc}`);
      }
    }

    // Write output — this is what Claude Code reads
    console.log(JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: lines.join('\n')
      }
    }));

  } catch (error) {
    // CRITICAL: Never block session start. Always return continue: true.
    // OMC follows this same pattern — hooks must be resilient.
    console.log(JSON.stringify({ continue: true }));
  }
}

main();
