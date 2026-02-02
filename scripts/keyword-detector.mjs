#!/usr/bin/env node

/**
 * kw-plugin Keyword Detector Hook
 *
 * Thin wrapper — reads stdin, delegates to compiled TypeScript, writes stdout.
 * All keyword logic lives in src/features/magic-keywords.ts (single source of truth).
 *
 * Requires `npm run build` to have run (imports from dist/).
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
    const input = await readStdin();
    let data = {};
    try { data = JSON.parse(input); } catch { /* empty input */ }

    const prompt = data.prompt || '';
    if (!prompt) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Import compiled TypeScript — single source of truth for keyword logic
    const { processKeywords } = await import(join(PLUGIN_ROOT, 'dist', 'features', 'magic-keywords.js'));
    const { loadConfig } = await import(join(PLUGIN_ROOT, 'dist', 'config', 'loader.js'));

    const config = loadConfig(data.directory || process.cwd());
    const output = processKeywords(prompt, config, PLUGIN_ROOT);

    console.log(JSON.stringify(output));
  } catch (error) {
    // Never block prompt submission
    console.log(JSON.stringify({ continue: true }));
  }
}

main();
