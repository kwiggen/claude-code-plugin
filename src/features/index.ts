/**
 * Features Module
 *
 * Each feature is a self-contained module that plugs into the hook system.
 */

export {
  loadKeywords,
  loadKeywordsFromFile,
  sanitizePrompt,
  detectKeywords,
  applyKeywordOverrides,
  buildKeywordOutput,
  processKeywords,
} from './magic-keywords.js';
