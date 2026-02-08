/**
 * kw-plugin — Claude Code Plugin
 *
 * Code reviews, PR creation, team analytics, and release management.
 * TypeScript infrastructure for hooks, config, and future features.
 */

// Config
export {
  loadConfig,
  loadJsoncFile,
  loadEnvConfig,
  getConfigPaths,
  deepMerge,
  DEFAULT_CONFIG,
} from './config/index.js';

// Hooks
export {
  buildSessionStartContext,
  discoverCommands,
  parseCommandFrontmatter,
} from './hooks/index.js';
export type { SessionStartResult } from './hooks/index.js';

// Features
export {
  loadKeywords,
  loadKeywordsFromFile,
  sanitizePrompt,
  detectKeywords,
  applyKeywordOverrides,
  buildKeywordOutput,
  processKeywords,
} from './features/index.js';

// HUD
export {
  render,
  renderModel,
  renderContextBar,
  renderTokens,
  renderCost,
} from './hud/index.js';

// State
export {
  getStateDir,
  getStatePath,
  ensureStateDir,
  readState,
  writeState,
  updateState,
  appendState,
  readAppendLog,
  stateExists,
  clearState,
  StateManager,
} from './state/index.js';

// Notepad
export {
  getNotepadPath,
  initNotepad,
  readNotepad,
  getPriorityContext,
  setPriorityContext,
  addWorkingMemoryEntry,
  getWorkingMemory,
  addManualEntry,
  getManualSection,
  pruneOldEntries,
  getNotepadStats,
  formatNotepadContext,
} from './notepad/index.js';
export type {
  NotepadData,
  NotepadEntry,
  NotepadStats,
  SetPriorityResult,
} from './notepad/index.js';

// Boulder
export {
  readBoulderState,
  writeBoulderState,
  clearBoulderState,
  hasBoulder,
  getActivePlanPath,
  appendSessionId,
  createBoulderState,
  getPlanProgress,
  formatBoulderContext,
} from './boulder/index.js';
export type {
  BoulderState,
  PlanProgress,
  PlanItem,
} from './boulder/index.js';

// Types
export type {
  PluginConfig,
  HookInput,
  HookOutput,
  SessionStartOutput,
  UserPromptSubmitOutput,
  StatuslineInput,
  CommandInfo,
  MagicKeyword,
  StateLocation,
  StateReadResult,
  StateWriteResult,
} from './shared/types.js';
