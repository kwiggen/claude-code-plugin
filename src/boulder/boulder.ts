/**
 * Boulder State System
 *
 * Plan progress persistence across sessions. Tracks which plan is active,
 * which sessions have worked on it, and calculates completion progress
 * from markdown checkboxes in the plan file.
 *
 * Inspired by OMC's boulder-state feature (src/features/boulder-state/).
 *
 * Uses the existing StateManager for JSON persistence — boulder state is
 * structured data, unlike the notepad which is human-editable markdown.
 */

import { existsSync, readFileSync } from 'fs';
import { StateManager } from '../state/index.js';
import type { BoulderState, PlanProgress, PlanItem } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOULDER_STATE_NAME = 'boulder';

/**
 * Regex for matching markdown checkboxes:
 *   - [x] Completed task
 *   - [ ] Incomplete task
 * Captures: group 1 = 'x' or ' ', group 2 = task text
 */
const CHECKBOX_REGEX = /^[-*]\s+\[([ xX])\]\s+(.+)$/;

// ---------------------------------------------------------------------------
// Internal: StateManager wrapper
// ---------------------------------------------------------------------------

function getBoulderManager(cwd?: string): StateManager<BoulderState> {
  return new StateManager<BoulderState>(BOULDER_STATE_NAME, 'local', cwd);
}

// ---------------------------------------------------------------------------
// Core state operations
// ---------------------------------------------------------------------------

/** Read the boulder state. Returns undefined if no active boulder. */
export function readBoulderState(cwd?: string): BoulderState | undefined {
  return getBoulderManager(cwd).get();
}

/** Write boulder state. */
export function writeBoulderState(
  state: BoulderState,
  cwd?: string
): { success: boolean; path: string; error?: string } {
  return getBoulderManager(cwd).set(state);
}

/** Delete the boulder state file. Returns true if it existed. */
export function clearBoulderState(cwd?: string): boolean {
  return getBoulderManager(cwd).clear();
}

/** Check whether a boulder state exists. */
export function hasBoulder(cwd?: string): boolean {
  return getBoulderManager(cwd).exists();
}

/** Get the active plan path, or undefined if no boulder. */
export function getActivePlanPath(cwd?: string): string | undefined {
  return readBoulderState(cwd)?.active_plan;
}

// ---------------------------------------------------------------------------
// Session tracking
// ---------------------------------------------------------------------------

/**
 * Add a session ID to the boulder state. No-ops if already present.
 * Returns undefined if no boulder exists.
 */
export function appendSessionId(
  sessionId: string,
  cwd?: string
): { success: boolean; path: string; error?: string } | undefined {
  const manager = getBoulderManager(cwd);
  const state = manager.get();
  if (!state) return undefined;

  if (!state.session_ids.includes(sessionId)) {
    state.session_ids.push(sessionId);
    return manager.set(state);
  }

  return { success: true, path: manager.path() };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a new boulder state for a plan. */
export function createBoulderState(
  planPath: string,
  planName: string,
  sessionId: string,
  cwd?: string
): { success: boolean; path: string; error?: string } {
  const state: BoulderState = {
    active_plan: planPath,
    started_at: new Date().toISOString(),
    session_ids: [sessionId],
    plan_name: planName,
  };
  return writeBoulderState(state, cwd);
}

// ---------------------------------------------------------------------------
// Plan progress
// ---------------------------------------------------------------------------

/**
 * Parse a plan file and count checkbox progress.
 * Returns zeroes if the file doesn't exist or has no checkboxes.
 */
export function getPlanProgress(planPath: string): PlanProgress {
  if (!existsSync(planPath)) {
    return { completed: 0, total: 0, percentage: 0, items: [] };
  }

  const content = readFileSync(planPath, 'utf-8');
  const items: PlanItem[] = [];

  for (const line of content.split('\n')) {
    const match = line.trim().match(CHECKBOX_REGEX);
    if (match) {
      items.push({
        done: match[1].toLowerCase() === 'x',
        text: match[2].trim(),
      });
    }
  }

  const total = items.length;
  const completed = items.filter((item) => item.done).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { completed, total, percentage, items };
}

// ---------------------------------------------------------------------------
// Context injection
// ---------------------------------------------------------------------------

/**
 * Format boulder state + plan progress for injection into SessionStart.
 * Returns an XML-tagged string with plan name, progress, and path.
 */
export function formatBoulderContext(
  state: BoulderState,
  progress: PlanProgress
): string {
  const lines = [
    '<boulder-state>',
    `Plan: ${state.plan_name} (${progress.percentage}% complete, ${progress.completed}/${progress.total} tasks)`,
    `Path: ${state.active_plan}`,
    `Started: ${state.started_at}`,
    `Sessions: ${state.session_ids.length}`,
    '</boulder-state>',
  ];
  return lines.join('\n');
}
