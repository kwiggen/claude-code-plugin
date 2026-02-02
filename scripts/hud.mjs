#!/usr/bin/env node

/**
 * kw-plugin HUD / Statusline Script
 *
 * Claude Code runs this command and pipes JSON via stdin.
 * We output colored text to stdout, which appears in the statusbar.
 *
 * Contract:
 *   stdin  → JSON { model, context_window, cwd, transcript_path }
 *   stdout → ANSI-colored text string
 *
 * Registered in ~/.claude/settings.json:
 *   { "statusLine": { "type": "command", "command": "node /path/to/hud.mjs" } }
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PLUGIN_ROOT = join(__dirname, '..');

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function main() {
  try {
    const raw = await readStdin();
    let input = {};
    try { input = JSON.parse(raw); } catch { /* empty or invalid */ }

    const { render } = await import(join(PLUGIN_ROOT, 'dist', 'hud', 'render.js'));
    const output = render(input);

    process.stdout.write(output);
  } catch {
    // Fallback — always show something
    process.stdout.write('\x1b[1m[kw]\x1b[0m');
  }
}

main();
