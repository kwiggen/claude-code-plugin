/**
 * Notepad Memory Types
 *
 * The notepad is a 3-tier compaction-resilient memory stored as markdown.
 * File location: .kw-plugin/notepad.md
 *
 * Tiers:
 *   1. Priority Context — Always injected on SessionStart. Max 500 chars.
 *   2. Working Memory — Timestamped session notes. Auto-pruned after 7 days.
 *   3. Manual — User-created content. Never pruned.
 *
 * OMC Pattern: File-based persistence, human-readable format, git-friendly.
 */

/** A single timestamped entry in the working memory section. */
export interface NotepadEntry {
  /** ISO 8601 timestamp (e.g. "2025-02-08T14:30:00.000Z") */
  timestamp: string;
  /** Entry text content */
  text: string;
}

/** Parsed notepad data from the markdown file. */
export interface NotepadData {
  /** Critical discoveries. Max 500 chars. Always injected on SessionStart. */
  priorityContext: string;
  /** Timestamped session notes. Auto-pruned after N days. */
  workingMemory: NotepadEntry[];
  /** User-created content. Never pruned. */
  manualSection: string;
}

/** Statistics about the notepad contents. */
export interface NotepadStats {
  /** Character count of priority context section */
  priorityContextLength: number;
  /** Number of working memory entries */
  workingMemoryCount: number;
  /** Character count of manual section */
  manualSectionLength: number;
  /** ISO timestamp of the oldest working memory entry, or null if empty */
  oldestEntry: string | null;
}

/** Result of setting priority context. */
export interface SetPriorityResult {
  /** Whether the write succeeded */
  success: boolean;
  /** Warning when content exceeds 500 chars (still writes, but warns) */
  warning?: string;
}
