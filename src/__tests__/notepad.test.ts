import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
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
} from '../notepad/notepad.js';

// ---------------------------------------------------------------------------
// Test fixture: temp directory for all file I/O
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'kw-notepad-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

describe('getNotepadPath', () => {
  it('should return path under .kw-plugin', () => {
    const path = getNotepadPath(tmpDir);
    expect(path).toBe(join(tmpDir, '.kw-plugin', 'notepad.md'));
  });
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

describe('initNotepad', () => {
  it('should create notepad.md with empty template', () => {
    initNotepad(tmpDir);
    const path = getNotepadPath(tmpDir);
    expect(existsSync(path)).toBe(true);

    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('## Priority Context');
    expect(content).toContain('## Working Memory');
    expect(content).toContain('## Manual');
  });

  it('should create .kw-plugin directory if missing', () => {
    initNotepad(tmpDir);
    expect(existsSync(join(tmpDir, '.kw-plugin'))).toBe(true);
  });

  it('should not overwrite existing notepad', () => {
    initNotepad(tmpDir);
    setPriorityContext('important stuff', tmpDir);

    initNotepad(tmpDir); // should be a no-op
    expect(getPriorityContext(tmpDir)).toBe('important stuff');
  });
});

// ---------------------------------------------------------------------------
// Read / Parse
// ---------------------------------------------------------------------------

describe('readNotepad', () => {
  it('should return empty data when file does not exist', () => {
    const data = readNotepad(tmpDir);
    expect(data.priorityContext).toBe('');
    expect(data.workingMemory).toEqual([]);
    expect(data.manualSection).toBe('');
  });

  it('should parse a populated notepad', () => {
    initNotepad(tmpDir);
    setPriorityContext('This repo uses NestJS', tmpDir);
    addWorkingMemoryEntry('Found auth pattern', tmpDir);
    addManualEntry('Always check edge cases', tmpDir);

    const data = readNotepad(tmpDir);
    expect(data.priorityContext).toBe('This repo uses NestJS');
    expect(data.workingMemory).toHaveLength(1);
    expect(data.workingMemory[0].text).toBe('Found auth pattern');
    expect(data.manualSection).toBe('Always check edge cases');
  });

  it('should skip malformed working memory lines', () => {
    initNotepad(tmpDir);
    addWorkingMemoryEntry('Valid entry', tmpDir);

    // Manually inject a malformed line
    const path = getNotepadPath(tmpDir);
    const content = readFileSync(path, 'utf-8');
    const modified = content.replace(
      '## Working Memory',
      '## Working Memory\n\nNot a valid entry line'
    );
    writeFileSync(path, modified, 'utf-8');

    const data = readNotepad(tmpDir);
    // Should have only the valid entry, malformed line skipped
    expect(data.workingMemory).toHaveLength(1);
    expect(data.workingMemory[0].text).toBe('Valid entry');
  });
});

// ---------------------------------------------------------------------------
// Priority Context
// ---------------------------------------------------------------------------

describe('setPriorityContext / getPriorityContext', () => {
  it('should write and read priority context', () => {
    setPriorityContext('Uses TypeScript strict mode', tmpDir);
    expect(getPriorityContext(tmpDir)).toBe('Uses TypeScript strict mode');
  });

  it('should return warning when exceeding 500 chars', () => {
    const longText = 'x'.repeat(501);
    const result = setPriorityContext(longText, tmpDir);
    expect(result.success).toBe(true);
    expect(result.warning).toBeDefined();
    expect(result.warning).toContain('501');
  });

  it('should still write when exceeding 500 chars', () => {
    const longText = 'x'.repeat(501);
    setPriorityContext(longText, tmpDir);
    expect(getPriorityContext(tmpDir)).toBe(longText);
  });

  it('should not warn when under 500 chars', () => {
    const result = setPriorityContext('short', tmpDir);
    expect(result.success).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('should replace existing priority context', () => {
    setPriorityContext('first', tmpDir);
    setPriorityContext('second', tmpDir);
    expect(getPriorityContext(tmpDir)).toBe('second');
  });

  it('should auto-initialize notepad if missing', () => {
    setPriorityContext('auto-init test', tmpDir);
    expect(existsSync(getNotepadPath(tmpDir))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Working Memory
// ---------------------------------------------------------------------------

describe('addWorkingMemoryEntry / getWorkingMemory', () => {
  it('should add a timestamped entry', () => {
    addWorkingMemoryEntry('Discovered the auth pattern', tmpDir);
    const entries = getWorkingMemory(tmpDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe('Discovered the auth pattern');
    expect(entries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should append multiple entries', () => {
    addWorkingMemoryEntry('First note', tmpDir);
    addWorkingMemoryEntry('Second note', tmpDir);
    const entries = getWorkingMemory(tmpDir);
    expect(entries).toHaveLength(2);
    expect(entries[0].text).toBe('First note');
    expect(entries[1].text).toBe('Second note');
  });

  it('should preserve other sections when adding entries', () => {
    setPriorityContext('Keep this', tmpDir);
    addManualEntry('And this', tmpDir);
    addWorkingMemoryEntry('New entry', tmpDir);

    const data = readNotepad(tmpDir);
    expect(data.priorityContext).toBe('Keep this');
    expect(data.manualSection).toBe('And this');
    expect(data.workingMemory).toHaveLength(1);
  });

  it('should auto-initialize notepad if missing', () => {
    addWorkingMemoryEntry('auto-init', tmpDir);
    expect(existsSync(getNotepadPath(tmpDir))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Manual Section
// ---------------------------------------------------------------------------

describe('addManualEntry / getManualSection', () => {
  it('should add text to manual section', () => {
    addManualEntry('User note here', tmpDir);
    expect(getManualSection(tmpDir)).toBe('User note here');
  });

  it('should append to existing manual content', () => {
    addManualEntry('First note', tmpDir);
    addManualEntry('Second note', tmpDir);
    expect(getManualSection(tmpDir)).toBe('First note\nSecond note');
  });

  it('should auto-initialize notepad if missing', () => {
    addManualEntry('auto-init', tmpDir);
    expect(existsSync(getNotepadPath(tmpDir))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pruning
// ---------------------------------------------------------------------------

describe('pruneOldEntries', () => {
  it('should remove entries older than N days', () => {
    initNotepad(tmpDir);

    // Manually write an old entry (30 days ago)
    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const data = readNotepad(tmpDir);
    data.workingMemory.push({ timestamp: oldDate, text: 'Old entry' });
    data.workingMemory.push({
      timestamp: new Date().toISOString(),
      text: 'Recent entry',
    });

    // Write the data directly so we control timestamps
    const path = getNotepadPath(tmpDir);
    const lines = [
      '## Priority Context',
      '',
      '',
      '## Working Memory',
      '',
      `- [${oldDate}] Old entry`,
      `- [${data.workingMemory[1].timestamp}] Recent entry`,
      '',
      '## Manual',
      '',
    ];
    writeFileSync(path, lines.join('\n'), 'utf-8');

    const pruned = pruneOldEntries(7, tmpDir);
    expect(pruned).toBe(1);

    const remaining = getWorkingMemory(tmpDir);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].text).toBe('Recent entry');
  });

  it('should keep entries newer than N days', () => {
    addWorkingMemoryEntry('Fresh entry', tmpDir);
    const pruned = pruneOldEntries(7, tmpDir);
    expect(pruned).toBe(0);
    expect(getWorkingMemory(tmpDir)).toHaveLength(1);
  });

  it('should return 0 when notepad does not exist', () => {
    const pruned = pruneOldEntries(7, tmpDir);
    expect(pruned).toBe(0);
  });

  it('should handle empty working memory', () => {
    initNotepad(tmpDir);
    const pruned = pruneOldEntries(7, tmpDir);
    expect(pruned).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

describe('getNotepadStats', () => {
  it('should return zeroes for empty/missing notepad', () => {
    const stats = getNotepadStats(tmpDir);
    expect(stats.priorityContextLength).toBe(0);
    expect(stats.workingMemoryCount).toBe(0);
    expect(stats.manualSectionLength).toBe(0);
    expect(stats.oldestEntry).toBeNull();
  });

  it('should return correct counts and lengths', () => {
    setPriorityContext('Hello', tmpDir);
    addWorkingMemoryEntry('Entry one', tmpDir);
    addWorkingMemoryEntry('Entry two', tmpDir);
    addManualEntry('Manual text', tmpDir);

    const stats = getNotepadStats(tmpDir);
    expect(stats.priorityContextLength).toBe(5);
    expect(stats.workingMemoryCount).toBe(2);
    expect(stats.manualSectionLength).toBe(11);
    expect(stats.oldestEntry).not.toBeNull();
  });

  it('should report the oldest entry timestamp', () => {
    addWorkingMemoryEntry('First', tmpDir);
    const firstTimestamp = getWorkingMemory(tmpDir)[0].timestamp;

    // Small delay to ensure different timestamps
    addWorkingMemoryEntry('Second', tmpDir);

    const stats = getNotepadStats(tmpDir);
    expect(stats.oldestEntry).toBe(firstTimestamp);
  });
});

// ---------------------------------------------------------------------------
// Context injection formatting
// ---------------------------------------------------------------------------

describe('formatNotepadContext', () => {
  it('should wrap priority context in XML tags', () => {
    const result = formatNotepadContext({
      priorityContext: 'This repo uses NestJS',
      workingMemory: [],
      manualSection: '',
    });
    expect(result).toContain('<notepad-priority>');
    expect(result).toContain('This repo uses NestJS');
    expect(result).toContain('</notepad-priority>');
  });

  it('should return empty string when priority context is empty', () => {
    const result = formatNotepadContext({
      priorityContext: '',
      workingMemory: [],
      manualSection: '',
    });
    expect(result).toBe('');
  });

  it('should return empty string when priority context is whitespace-only', () => {
    const result = formatNotepadContext({
      priorityContext: '   \n  ',
      workingMemory: [],
      manualSection: '',
    });
    expect(result).toBe('');
  });
});
