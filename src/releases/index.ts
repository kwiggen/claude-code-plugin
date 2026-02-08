export type { ReleasePR, BranchRef, AreaStats, TrendEntry } from './types.js';

export {
  isReleaseTrain,
  isPromotion,
  isBackmerge,
  isHotfixToStaging,
  isHotfixToRelease,
  classifyPRType,
} from './classify.js';

export {
  ensureRemoteUpdated,
  isCommitReachableFromDevelop,
  getBackmergedCommits,
  hasBackmergeAfter,
} from './git-utils.js';

export {
  fetchPRsByBase,
  findReleaseTrains,
  findLastPromotion,
  getBackmergesSince,
  getPRAreaStats,
  findQuickApprovals,
  enrichPRs,
  filterFeaturePRs,
  getStagingHotfixes,
  sortBySize,
} from './data.js';

export {
  prLink,
  slackPrLink,
  formatAreaBreakdown,
  formatSlackAreaBreakdown,
  formatPRSlackBlock,
  formatHotfixSlackBlock,
  outputReleaseNotesData,
} from './format.js';

export { cmdPreview } from './preview.js';
export { cmdRetro, getReleaseTrend, summarizeTrend, generateActionItems } from './retro.js';
