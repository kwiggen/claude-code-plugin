/**
 * PR classification functions for release reports.
 */

import type { ReleasePR } from './types.js';

/** Release train branch patterns (→ staging) */
const RELEASE_TRAIN_PATTERNS = [
  /^staging-\d{1,2}-\d{1,2}-\d{2,4}$/,
  /^release-\d{1,2}-\d{1,2}-\d{2,4}$/,
  /^release-to-staging$/,
];

/** Promotion branch patterns (→ release) */
const PROMOTION_PATTERNS = [
  /^release-\d{1,2}-\d{1,2}-\d{2,4}$/,
  /^staging$/,
];

export function isReleaseTrain(pr: ReleasePR): boolean {
  if (pr.base?.ref !== 'staging') return false;
  const headRef = pr.head?.ref ?? '';
  return RELEASE_TRAIN_PATTERNS.some(p => p.test(headRef));
}

export function isPromotion(pr: ReleasePR): boolean {
  if (pr.base?.ref !== 'release') return false;
  const headRef = pr.head?.ref ?? '';
  return PROMOTION_PATTERNS.some(p => p.test(headRef));
}

export function isBackmerge(pr: ReleasePR): boolean {
  return pr.base?.ref === 'develop' && pr.head?.ref === 'staging';
}

export function isHotfixToStaging(pr: ReleasePR): boolean {
  if (pr.base?.ref !== 'staging') return false;
  if (isReleaseTrain(pr)) return false;
  if (pr.head?.ref === 'release') return false;
  return true;
}

export function isHotfixToRelease(pr: ReleasePR): boolean {
  if (pr.base?.ref !== 'release') return false;
  if (isPromotion(pr)) return false;
  return true;
}

export type PRType = 'feature' | 'fix' | 'improvement' | 'docs' | 'chore' | 'other';

export function classifyPRType(pr: ReleasePR): PRType {
  const title = pr.title.toLowerCase();

  if (title.startsWith('feat:') || title.startsWith('feat(')) return 'feature';
  if (title.startsWith('fix:') || title.startsWith('fix(')) return 'fix';
  if (/^(refactor[:(]|perf[:(]|improve:)/.test(title)) return 'improvement';
  if (title.startsWith('docs:') || title.startsWith('docs(')) return 'docs';
  if (/^(chore[:(]|ci[:(]|build[:(])/.test(title)) return 'chore';

  const featureKW = ['add ', 'implement', 'new ', 'introduce', 'create '];
  const fixKW = ['fix ', 'resolve', 'correct', 'patch', 'bug'];
  const improveKW = ['update ', 'improve', 'optimize', 'enhance', 'refactor'];
  const docsKW = ['documentation', 'readme', 'doc '];
  const choreKW = ['bump', 'upgrade', 'dependency', 'deps'];

  if (featureKW.some(kw => title.includes(kw))) return 'feature';
  if (fixKW.some(kw => title.includes(kw))) return 'fix';
  if (improveKW.some(kw => title.includes(kw))) return 'improvement';
  if (docsKW.some(kw => title.includes(kw))) return 'docs';
  if (choreKW.some(kw => title.includes(kw))) return 'chore';

  return 'other';
}
