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

// Types
export type {
  PluginConfig,
  HookInput,
  HookOutput,
  SessionStartOutput,
  CommandInfo,
} from './shared/types.js';
