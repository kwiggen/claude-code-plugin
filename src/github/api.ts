/**
 * GitHub API wrapper using `gh` CLI.
 * Replaces Python subprocess calls with Node.js child_process.
 */

import { execFileSync } from 'child_process';
import type {
  PRResponse,
  PRStatsResponse,
  ReviewResponse,
  CommentResponse,
} from './types.js';

/**
 * Get owner/repo from git remote via `gh repo view`.
 */
export function getRepoInfo(): { owner: string; repo: string } {
  try {
    const result = execFileSync('gh', ['repo', 'view', '--json', 'owner,name'], {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    const data = JSON.parse(result) as { owner: { login: string }; name: string };
    return { owner: data.owner.login, repo: data.name };
  } catch {
    console.error(
      'Error: Could not determine repository. Are you in a git repo with `gh` authenticated?'
    );
    process.exit(1);
  }
}

/**
 * Run a `gh api` call and return parsed JSON.
 */
function ghApi<T>(endpoint: string, params?: Record<string, string>): T {
  const args = ['api', endpoint, '-X', 'GET'];
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      args.push('-f', `${key}=${value}`);
    }
  }
  const result = execFileSync('gh', args, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(result) as T;
}

/**
 * Fetch all items from a paginated gh api endpoint.
 */
function ghApiPaginated<T>(endpoint: string, perPage = 100): T[] {
  const results: T[] = [];
  let page = 1;

  while (true) {
    const pageItems = ghApi<T[]>(endpoint, {
      per_page: String(perPage),
      page: String(page),
    });

    if (!pageItems || pageItems.length === 0) break;
    results.push(...pageItems);
    if (pageItems.length < perPage) break;
    page++;
  }

  return results;
}

/**
 * Fetch all merged PRs to develop branch since the given date.
 * Sorts by updated descending so recently-merged PRs appear first,
 * and stops pagination once all PRs on a page were updated before `since`.
 */
export function fetchMergedPRs(
  owner: string,
  repo: string,
  since: Date
): PRResponse[] {
  const prs: PRResponse[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const pagePRs = ghApi<PRResponse[]>(
      `repos/${owner}/${repo}/pulls`,
      {
        state: 'closed',
        base: 'develop',
        sort: 'updated',
        direction: 'desc',
        per_page: String(perPage),
        page: String(page),
      }
    );

    if (!pagePRs || pagePRs.length === 0) break;

    let anyInRange = false;
    for (const pr of pagePRs) {
      if (pr.merged_at) {
        const mergedAt = new Date(pr.merged_at);
        if (mergedAt >= since) {
          prs.push(pr);
          anyInRange = true;
        }
      }
    }

    // If no PR on this page was in range and we sort by updated desc,
    // all subsequent pages will be even older — safe to stop.
    if (!anyInRange) break;

    page++;
    if (pagePRs.length < perPage) break;
  }

  return prs;
}

/**
 * Get additions/deletions for a PR.
 */
export function getPRStats(
  owner: string,
  repo: string,
  prNumber: number
): PRStatsResponse {
  try {
    const data = ghApi<{ additions?: number; deletions?: number }>(
      `repos/${owner}/${repo}/pulls/${prNumber}`
    );
    return {
      additions: data.additions ?? 0,
      deletions: data.deletions ?? 0,
    };
  } catch {
    return { additions: 0, deletions: 0 };
  }
}

/**
 * Fetch reviews for a specific PR (paginated).
 */
export function fetchPRReviews(
  owner: string,
  repo: string,
  prNumber: number
): ReviewResponse[] {
  try {
    return ghApiPaginated<ReviewResponse>(
      `repos/${owner}/${repo}/pulls/${prNumber}/reviews`
    );
  } catch {
    return [];
  }
}

/**
 * Fetch review comments for a specific PR (paginated).
 */
export function fetchPRComments(
  owner: string,
  repo: string,
  prNumber: number
): CommentResponse[] {
  try {
    return ghApiPaginated<CommentResponse>(
      `repos/${owner}/${repo}/pulls/${prNumber}/comments`
    );
  } catch {
    return [];
  }
}
