/**
 * Boulder State Module
 *
 * Plan progress persistence across sessions.
 * See boulder.ts for full documentation.
 */

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
} from './boulder.js';

export type {
  BoulderState,
  PlanProgress,
  PlanItem,
} from './types.js';
