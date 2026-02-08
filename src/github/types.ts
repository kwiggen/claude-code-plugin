/**
 * TypeScript types for GitHub API responses.
 * Mirrors the Python TypedDicts from gh_stats.py.
 */

export interface UserDict {
  login: string;
}

export interface PRResponse {
  number: number;
  title: string;
  user: UserDict;
  created_at: string;
  merged_at: string | null;
  body: string | null;
}

export interface PRStatsResponse {
  additions: number;
  deletions: number;
}

export interface ReviewResponse {
  user: UserDict;
  state: string;
  submitted_at?: string | null;
}

export interface CommentResponse {
  user: UserDict;
}

export interface AuthorStats {
  count: number;
  additions: number;
  deletions: number;
}

export interface PRSizeData {
  number: number;
  title: string;
  author: string;
  additions: number;
  deletions: number;
  total: number;
  mergeTimeMs: number;
}

export interface RevertData {
  number: number;
  title: string;
  author: string;
  merged_at: string;
  original_pr: string | null;
}

export interface RubberStampData {
  number: number;
  title: string;
  author: string;
  reviewer: string;
  lines: number;
  reviewTime: number;
}

export interface ReviewerStatsData {
  reviewTimes: number[];
  commentCounts: number[];
}

export interface PRCycleData {
  number: number;
  title: string;
  author: string;
  cycles: number;
  finalReviewer: string | null;
}
