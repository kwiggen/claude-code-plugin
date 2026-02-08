/**
 * CLI entrypoint for release reports.
 * Invoked as: node dist/releases/cli.js --action preview|retro [--days N]
 */

import { getRepoInfo } from '../github/index.js';
import { cmdPreview } from './preview.js';
import { cmdRetro } from './retro.js';

export function parseArgs(argv: string[]): { action: string; days: number } {
  let action = '';
  let days = 30;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--action' && i + 1 < argv.length) {
      action = argv[i + 1];
      i++;
    } else if (argv[i] === '--days' && i + 1 < argv.length) {
      const parsed = parseInt(argv[i + 1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        days = parsed;
      }
      i++;
    }
  }

  if (!action || !['preview', 'retro'].includes(action)) {
    console.error('Usage: node dist/releases/cli.js --action preview|retro [--days N]');
    process.exit(1);
  }

  return { action, days };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const { owner, repo } = getRepoInfo();

  if (args.action === 'preview') {
    cmdPreview(owner, repo, args.days);
  } else if (args.action === 'retro') {
    cmdRetro(owner, repo, args.days);
  }
}

/* istanbul ignore next -- CLI entrypoint guard */
if (process.argv[1]?.endsWith('cli.js')) {
  main();
}
