/**
 * Notepad Memory System
 *
 * A 3-tier compaction-resilient memory stored as markdown at .kw-plugin/notepad.md.
 * Inspired by OMC's notepad system (src/hooks/notepad/index.ts).
 *
 * The key insight: Claude's context window compacts when full, erasing anything
 * Claude "learned" during the session. The notepad persists critical context
 * across compactions and sessions by injecting it at SessionStart.
 *
 * Tiers:
 *   1. Priority Context — Always injected. Keep under 500 chars.
 *   2. Working Memory — Session notes with timestamps. Auto-pruned after 7 days.
 *   3. Manual — User content. Never auto-pruned.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type {
  NotepadData,
  NotepadEntry,
  NotepadStats,
  SetPriorityResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOTEPAD_DIR = '.kw-plugin';
const NOTEPAD_FILENAME = 'notepad.md';
const PRIORITY_CONTEXT_MAX = 500;
const DEFAULT_MAX_AGE_DAYS = 7;

/** Empty notepad template — the starting point for every project. */
const NOTEPAD_TEMPLATE = `## Priority Context


## Working Memory


## Manual

`;

/**
 * Regex to parse a working memory entry line.
 * Format: "- [2025-02-08T14:30:00.000Z] Some note text here"
 */
const ENTRY_REGEX = /^- \[(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\] (.+)$/;

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Get the absolute path to the notepad file. */
export function getNotepadPath(cwd?: string): string {
  return join(cwd ?? process.cwd(), NOTEPAD_DIR, NOTEPAD_FILENAME);
}

// ---------------------------------------------------------------------------
// Internal: Markdown parsing & serialization
// ---------------------------------------------------------------------------

/**
 * Extract a section's content from the notepad markdown.
 * Returns the text between the given ## heading and the next ## heading (or EOF).
 */
function extractSection(content: string, heading: string): string {
  const regex = new RegExp(
    `## ${heading}\\n([\\s\\S]*?)(?=\\n## \\w|$)`
  );
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

/** Parse working memory text into structured entries. */
function parseWorkingMemoryEntries(text: string): NotepadEntry[] {
  if (!text) return [];

  return text
    .split('\n')
    .map((line) => {
      const match = line.match(ENTRY_REGEX);
      if (!match) return null;
      return { timestamp: match[1], text: match[2] };
    })
    .filter((entry): entry is NotepadEntry => entry !== null);
}

/** Serialize a NotepadData back to markdown. */
function serializeNotepad(data: NotepadData): string {
  const workingMemoryLines = data.workingMemory
    .map((e) => `- [${e.timestamp}] ${e.text}`)
    .join('\n');

  return [
    '## Priority Context',
    data.priorityContext ? `\n${data.priorityContext}` : '',
    '',
    '## Working Memory',
    workingMemoryLines ? `\n${workingMemoryLines}` : '',
    '',
    '## Manual',
    data.manualSection ? `\n${data.manualSection}` : '',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Init / Read
// ---------------------------------------------------------------------------

/**
 * Create the notepad file with an empty template if it doesn't exist.
 * Creates the .kw-plugin directory if needed.
 */
export function initNotepad(cwd?: string): void {
  const path = getNotepadPath(cwd);
  if (existsSync(path)) return;

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, NOTEPAD_TEMPLATE, 'utf-8');
}

/**
 * Read and parse the notepad file into structured data.
 * Returns empty NotepadData if the file doesn't exist (does NOT auto-create).
 */
export function readNotepad(cwd?: string): NotepadData {
  const path = getNotepadPath(cwd);

  if (!existsSync(path)) {
    return { priorityContext: '', workingMemory: [], manualSection: '' };
  }

  const content = readFileSync(path, 'utf-8');
  const priorityContext = extractSection(content, 'Priority Context');
  const workingMemoryText = extractSection(content, 'Working Memory');
  const manualSection = extractSection(content, 'Manual');

  return {
    priorityContext,
    workingMemory: parseWorkingMemoryEntries(workingMemoryText),
    manualSection,
  };
}

// ---------------------------------------------------------------------------
// Priority Context
// ---------------------------------------------------------------------------

/** Read the priority context section only. */
export function getPriorityContext(cwd?: string): string {
  return readNotepad(cwd).priorityContext;
}

/**
 * Set the priority context section. Warns if over 500 chars (but still writes).
 * Auto-initializes the notepad if it doesn't exist.
 */
export function setPriorityContext(
  text: string,
  cwd?: string
): SetPriorityResult {
  initNotepad(cwd);
  const data = readNotepad(cwd);
  data.priorityContext = text;
  writeFileSync(getNotepadPath(cwd), serializeNotepad(data), 'utf-8');

  const result: SetPriorityResult = { success: true };
  if (text.length > PRIORITY_CONTEXT_MAX) {
    result.warning = `Priority context is ${text.length} chars (recommended max: ${PRIORITY_CONTEXT_MAX})`;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Working Memory
// ---------------------------------------------------------------------------

/** Get all working memory entries. */
export function getWorkingMemory(cwd?: string): NotepadEntry[] {
  return readNotepad(cwd).workingMemory;
}

/**
 * Add a timestamped entry to working memory.
 * Auto-initializes the notepad if it doesn't exist.
 */
export function addWorkingMemoryEntry(text: string, cwd?: string): void {
  initNotepad(cwd);
  const data = readNotepad(cwd);
  data.workingMemory.push({
    timestamp: new Date().toISOString(),
    text,
  });
  writeFileSync(getNotepadPath(cwd), serializeNotepad(data), 'utf-8');
}

// ---------------------------------------------------------------------------
// Manual Section
// ---------------------------------------------------------------------------

/** Read the manual section. */
export function getManualSection(cwd?: string): string {
  return readNotepad(cwd).manualSection;
}

/**
 * Add text to the manual section.
 * Auto-initializes the notepad if it doesn't exist.
 */
export function addManualEntry(text: string, cwd?: string): void {
  initNotepad(cwd);
  const data = readNotepad(cwd);
  data.manualSection = data.manualSection
    ? `${data.manualSection}\n${text}`
    : text;
  writeFileSync(getNotepadPath(cwd), serializeNotepad(data), 'utf-8');
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

/**
 * Remove working memory entries older than maxAgeDays (default: 7).
 * Returns the number of pruned entries.
 *
 * Accepts optional pre-read NotepadData to avoid a redundant file read
 * when the caller has already parsed the notepad (e.g. session-start).
 */
export function pruneOldEntries(
  maxAgeDays: number = DEFAULT_MAX_AGE_DAYS,
  cwd?: string,
  existingData?: NotepadData
): number {
  const path = getNotepadPath(cwd);
  if (!existingData && !existsSync(path)) return 0;

  const data = existingData ?? readNotepad(cwd);
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const before = data.workingMemory.length;

  data.workingMemory = data.workingMemory.filter((entry) => {
    const entryTime = new Date(entry.timestamp).getTime();
    return entryTime >= cutoff;
  });

  const pruned = before - data.workingMemory.length;
  if (pruned > 0) {
    writeFileSync(path, serializeNotepad(data), 'utf-8');
  }

  return pruned;
}

/** Get statistics about the notepad contents. */
export function getNotepadStats(cwd?: string): NotepadStats {
  const data = readNotepad(cwd);

  let oldestEntry: string | null = null;
  if (data.workingMemory.length > 0) {
    oldestEntry = data.workingMemory.reduce((oldest, entry) =>
      entry.timestamp < oldest.timestamp ? entry : oldest
    ).timestamp;
  }

  return {
    priorityContextLength: data.priorityContext.length,
    workingMemoryCount: data.workingMemory.length,
    manualSectionLength: data.manualSection.length,
    oldestEntry,
  };
}

// ---------------------------------------------------------------------------
// Context injection
// ---------------------------------------------------------------------------

/**
 * Format notepad priority context for injection into SessionStart.
 * Returns an XML-tagged string, or empty string if no priority context.
 *
 * Only priority context is injected — working memory and manual are too large
 * for routine injection and are available via explicit reads.
 */
export function formatNotepadContext(data: NotepadData): string {
  if (!data.priorityContext.trim()) return '';

  return [
    '<notepad-priority>',
    data.priorityContext.trim(),
    '</notepad-priority>',
  ].join('\n');
}
