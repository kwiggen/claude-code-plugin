/**
 * Boulder State Types
 *
 * Tracks active plan progress across sessions.
 * Stored as JSON via StateManager at .kw-plugin/state/boulder.json
 *
 * The metaphor: Like Sisyphus pushing a boulder uphill, the plan keeps
 * making progress even across session boundaries. When a session starts,
 * it picks up where the last one left off.
 *
 * OMC Pattern: File-based persistence, structured JSON, managed by StateManager.
 */

/** Persisted boulder state — tracks which plan is active. */
export interface BoulderState {
  /** Absolute path to the plan file */
  active_plan: string;
  /** ISO 8601 timestamp when the boulder was started */
  started_at: string;
  /** Session IDs that have worked on this boulder */
  session_ids: string[];
  /** Human-readable plan name (derived from filename) */
  plan_name: string;
}

/** Progress extracted from checkbox items in a plan file. */
export interface PlanProgress {
  /** Number of checked items (- [x]) */
  completed: number;
  /** Total checkbox items (- [x] + - [ ]) */
  total: number;
  /** Percentage complete (0-100), 0 if no items */
  percentage: number;
  /** Individual checklist items */
  items: PlanItem[];
}

/** A single checkbox item from a plan file. */
export interface PlanItem {
  /** The text content of the checkbox item */
  text: string;
  /** Whether the item is checked */
  done: boolean;
}
