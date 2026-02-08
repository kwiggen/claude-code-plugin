/**
 * Types for release reports.
 */

import type { UserDict, PRStatsResponse, ReviewResponse, CommentResponse } from '../github/types.js';

export interface BranchRef {
  ref: string;
}

export interface AreaStats {
  additions: number;
  deletions: number;
}

export interface TrendEntry {
  date: string;
  prCount: number;
  stagingHF: number;
  releaseHF: number;
  outcome: string;
}

export interface ReleasePR {
  number: number;
  title: string;
  user: UserDict;
  created_at: string;
  merged_at: string;
  body?: string | null;
  base?: BranchRef;
  head?: BranchRef;
  merge_commit_sha?: string | null;
  stats?: PRStatsResponse;
  areaStats?: Record<string, AreaStats>;
  backmerged?: boolean;
  reviewTimeMin?: number;
  isLarge?: boolean;
  commentCount?: number;
  reviews?: ReviewResponse[];
  comments?: CommentResponse[];
}
