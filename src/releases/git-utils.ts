/**
 * Git utilities for backmerge detection.
 */

import { execFileSync } from 'child_process';
import type { ReleasePR } from './types.js';

let remoteFetched = false;

export function ensureRemoteUpdated(): boolean {
  if (remoteFetched) return true;
  try {
    execFileSync('git', ['fetch', 'origin', 'develop'], {
      encoding: 'utf-8',
      timeout: 30000,
    });
    remoteFetched = true;
    return true;
  } catch {
    return false;
  }
}

export function isCommitReachableFromDevelop(commitSha: string): boolean {
  if (!commitSha) return false;
  try {
    execFileSync(
      'git',
      ['merge-base', '--is-ancestor', commitSha, 'origin/develop'],
      { encoding: 'utf-8', timeout: 10000 }
    );
    return true;
  } catch {
    return false;
  }
}

export function getBackmergedCommits(hotfixes: ReleasePR[]): Set<string> {
  ensureRemoteUpdated();
  const reachable = new Set<string>();
  for (const hf of hotfixes) {
    const sha = hf.merge_commit_sha;
    if (sha && isCommitReachableFromDevelop(sha)) {
      reachable.add(sha);
    }
  }
  return reachable;
}

export function hasBackmergeAfter(
  hotfix: ReleasePR,
  backmerges: ReleasePR[],
  reachableCommits?: Set<string>
): boolean {
  const mergeSha = hotfix.merge_commit_sha;
  if (mergeSha) {
    if (reachableCommits !== undefined) {
      if (reachableCommits.has(mergeSha)) return true;
    } else {
      ensureRemoteUpdated();
      if (isCommitReachableFromDevelop(mergeSha)) return true;
    }
  }

  const hotfixMerged = new Date(hotfix.merged_at).getTime();
  const hotfixTitle = hotfix.title.toLowerCase();
  const hotfixNumber = hotfix.number;

  for (const bm of backmerges) {
    const bmMerged = new Date(bm.merged_at).getTime();
    if (bmMerged <= hotfixMerged) continue;

    const bmTitle = bm.title.toLowerCase();
    const bmBody = (bm.body ?? '').toLowerCase();

    if (
      bmTitle.includes(String(hotfixNumber)) ||
      bmBody.includes(String(hotfixNumber)) ||
      bmTitle.includes(hotfixTitle)
    ) {
      return true;
    }
  }

  return false;
}

/** Reset the fetch flag (for testing). */
export function resetRemoteFetched(): void {
  remoteFetched = false;
}
