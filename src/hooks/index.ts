/**
 * Hooks Module
 *
 * Phase 1: SessionStart only
 * Future phases will add: keyword-detector, pre-tool-enforcer, post-tool-verifier, etc.
 */

export {
  buildSessionStartContext,
  discoverCommands,
  parseCommandFrontmatter,
} from './session-start.js';

export type { SessionStartResult } from './session-start.js';
