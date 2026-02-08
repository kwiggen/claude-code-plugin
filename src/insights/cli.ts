#!/usr/bin/env node
/**
 * CLI entrypoint for GitHub insights.
 * Replaces: python gh_stats.py --action <ACTION> [OPTIONS]
 * Usage:    node dist/insights/cli.js --action <ACTION> [OPTIONS]
 */

import { getRepoInfo } from '../github/index.js';
import { printReportSeparator } from './utils.js';
import { prsMerged } from './actions/prs-merged.js';
import { leaderboard } from './actions/leaderboard.js';
import { activity } from './actions/activity.js';
import { timeToMerge } from './actions/time-to-merge.js';
import { reviews } from './actions/reviews.js';
import { prSize } from './actions/pr-size.js';
import { firstReview } from './actions/first-review.js';
import { reviewBalance } from './actions/review-balance.js';
import { reverts } from './actions/reverts.js';
import { reviewDepth } from './actions/review-depth.js';
import { reviewCycles } from './actions/review-cycles.js';

const VALID_ACTIONS = [
  'all',
  'prs-merged',
  'leaderboard',
  'activity',
  'time-to-merge',
  'reviews',
  'pr-size',
  'first-review',
  'review-balance',
  'reverts',
  'review-depth',
  'review-cycles',
] as const;

type Action = (typeof VALID_ACTIONS)[number];

interface CliArgs {
  action: Action;
  days: number;
  start: string | null;
  noStats: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let action: Action | null = null;
  let days = 30;
  let start: string | null = null;
  let noStats = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--action' && i + 1 < argv.length) {
      const val = argv[++i];
      if (VALID_ACTIONS.includes(val as Action)) {
        action = val as Action;
      } else {
        console.error(`Invalid action: ${val}`);
        console.error(`Valid actions: ${VALID_ACTIONS.join(', ')}`);
        process.exit(1);
      }
    } else if (arg === '--days' && i + 1 < argv.length) {
      days = parseInt(argv[++i], 10);
      if (isNaN(days) || days <= 0) {
        console.error('--days must be a positive integer');
        process.exit(1);
      }
    } else if (arg === '--start' && i + 1 < argv.length) {
      start = argv[++i];
    } else if (arg === '--no-stats') {
      noStats = true;
    }
  }

  if (!action) {
    console.error('--action is required');
    console.error(`Valid actions: ${VALID_ACTIONS.join(', ')}`);
    process.exit(1);
  }

  return { action, days, start, noStats };
}

function runAll(
  owner: string,
  repo: string,
  since: Date,
  showStats: boolean
): void {
  printReportSeparator('PRs Merged Overview');
  prsMerged(owner, repo, since, showStats);

  printReportSeparator('Contributor Leaderboard');
  leaderboard(owner, repo, since);

  printReportSeparator('Activity Patterns');
  activity(owner, repo, since);

  printReportSeparator('Time to Merge');
  timeToMerge(owner, repo, since);

  printReportSeparator('PR Size Analysis');
  prSize(owner, repo, since);

  printReportSeparator('Time to First Review');
  firstReview(owner, repo, since);

  printReportSeparator('Review Activity');
  reviews(owner, repo, since);

  printReportSeparator('Review Balance');
  reviewBalance(owner, repo, since);

  printReportSeparator('Review Depth');
  reviewDepth(owner, repo, since);

  printReportSeparator('Review Cycles');
  reviewCycles(owner, repo, since);

  printReportSeparator('Reverts');
  reverts(owner, repo, since);

  console.log('\n' + '='.repeat(60));
  console.log('  All Reports Complete');
  console.log('='.repeat(60));
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const { owner, repo } = getRepoInfo();

  let since: Date;
  if (args.start) {
    since = new Date(args.start + 'T00:00:00Z');
    if (isNaN(since.getTime())) {
      console.error(`Invalid --start date: ${args.start} (expected YYYY-MM-DD)`);
      process.exit(1);
    }
  } else {
    since = new Date(Date.now() - args.days * 24 * 60 * 60 * 1000);
  }

  const actionMap: Record<Action, () => void> = {
    'all': () => runAll(owner, repo, since, !args.noStats),
    'prs-merged': () => prsMerged(owner, repo, since, !args.noStats),
    'leaderboard': () => leaderboard(owner, repo, since),
    'activity': () => activity(owner, repo, since),
    'time-to-merge': () => timeToMerge(owner, repo, since),
    'reviews': () => reviews(owner, repo, since),
    'pr-size': () => prSize(owner, repo, since),
    'first-review': () => firstReview(owner, repo, since),
    'review-balance': () => reviewBalance(owner, repo, since),
    'reverts': () => reverts(owner, repo, since),
    'review-depth': () => reviewDepth(owner, repo, since),
    'review-cycles': () => reviewCycles(owner, repo, since),
  };

  actionMap[args.action]();
}

main();
