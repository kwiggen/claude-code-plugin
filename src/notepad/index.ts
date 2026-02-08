/**
 * Notepad Memory Module
 *
 * 3-tier compaction-resilient memory stored as markdown.
 * See notepad.ts for full documentation.
 */

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
} from './notepad.js';

export type {
  NotepadData,
  NotepadEntry,
  NotepadStats,
  SetPriorityResult,
} from './types.js';
