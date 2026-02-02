import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
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
} from '../state/manager.js';

// ---------------------------------------------------------------------------
// Test fixture: use a temp directory for all file I/O
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'kw-state-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

describe('getStateDir', () => {
  it('should return local path under project root', () => {
    const dir = getStateDir('local', '/my/project');
    expect(dir).toBe('/my/project/.kw-plugin/state');
  });

  it('should return global path under home config', () => {
    const dir = getStateDir('global');
    expect(dir).toContain('.config/kw-plugin/state');
  });
});

describe('getStatePath', () => {
  it('should append .json if no extension', () => {
    const path = getStatePath('my-state', 'local', tmpDir);
    expect(path).toBe(join(tmpDir, '.kw-plugin', 'state', 'my-state.json'));
  });

  it('should preserve extension if provided', () => {
    const path = getStatePath('log.jsonl', 'local', tmpDir);
    expect(path).toBe(join(tmpDir, '.kw-plugin', 'state', 'log.jsonl'));
  });
});

describe('ensureStateDir', () => {
  it('should create the state directory', () => {
    ensureStateDir('local', tmpDir);
    expect(existsSync(join(tmpDir, '.kw-plugin', 'state'))).toBe(true);
  });

  it('should be idempotent', () => {
    ensureStateDir('local', tmpDir);
    ensureStateDir('local', tmpDir);
    expect(existsSync(join(tmpDir, '.kw-plugin', 'state'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// JSON read/write
// ---------------------------------------------------------------------------

interface TestState {
  phase: string;
  iteration: number;
  active: boolean;
}

describe('writeState', () => {
  it('should create file and directories', () => {
    const result = writeState('test', { hello: 'world' }, 'local', tmpDir);
    expect(result.success).toBe(true);
    expect(existsSync(result.path)).toBe(true);
  });

  it('should write valid JSON', () => {
    writeState('test', { count: 42 }, 'local', tmpDir);
    const path = getStatePath('test', 'local', tmpDir);
    const raw = readFileSync(path, 'utf-8');
    expect(JSON.parse(raw)).toEqual({ count: 42 });
  });

  it('should pretty-print JSON', () => {
    writeState('test', { a: 1 }, 'local', tmpDir);
    const path = getStatePath('test', 'local', tmpDir);
    const raw = readFileSync(path, 'utf-8');
    expect(raw).toContain('\n'); // Not minified
  });
});

describe('readState', () => {
  it('should return exists: false for missing file', () => {
    const result = readState('nonexistent', 'local', tmpDir);
    expect(result.exists).toBe(false);
    expect(result.data).toBeUndefined();
  });

  it('should read back written state', () => {
    const data: TestState = { phase: 'planning', iteration: 3, active: true };
    writeState('mode', data, 'local', tmpDir);

    const result = readState<TestState>('mode', 'local', tmpDir);
    expect(result.exists).toBe(true);
    expect(result.data).toEqual(data);
    expect(result.foundAt).toContain('mode.json');
  });

  it('should return exists: false for invalid JSON', () => {
    // Write garbage directly to the file
    ensureStateDir('local', tmpDir);
    const path = getStatePath('bad', 'local', tmpDir);
    writeFileSync(path, 'not valid json!!!', 'utf-8');

    const result = readState('bad', 'local', tmpDir);
    expect(result.exists).toBe(false);
  });
});

describe('updateState', () => {
  it('should create state if it does not exist', () => {
    const result = updateState<TestState>(
      'new-mode',
      () => ({ phase: 'init', iteration: 0, active: true }),
      'local',
      tmpDir
    );
    expect(result.success).toBe(true);

    const read = readState<TestState>('new-mode', 'local', tmpDir);
    expect(read.data?.phase).toBe('init');
  });

  it('should transform existing state', () => {
    writeState<TestState>(
      'mode',
      { phase: 'planning', iteration: 1, active: true },
      'local',
      tmpDir
    );

    updateState<TestState>(
      'mode',
      (current) => ({
        ...current!,
        phase: 'execution',
        iteration: (current?.iteration ?? 0) + 1,
      }),
      'local',
      tmpDir
    );

    const result = readState<TestState>('mode', 'local', tmpDir);
    expect(result.data?.phase).toBe('execution');
    expect(result.data?.iteration).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// JSONL append log
// ---------------------------------------------------------------------------

interface LogEntry {
  timestamp: string;
  tokens: number;
}

describe('appendState', () => {
  it('should create file and append an entry', () => {
    const entry: LogEntry = { timestamp: '2025-01-01T00:00:00Z', tokens: 100 };
    const result = appendState('usage', entry, 'local', tmpDir);
    expect(result.success).toBe(true);
    expect(result.path).toContain('usage.jsonl');
  });

  it('should append multiple entries as separate lines', () => {
    appendState('log', { tokens: 1 }, 'local', tmpDir);
    appendState('log', { tokens: 2 }, 'local', tmpDir);
    appendState('log', { tokens: 3 }, 'local', tmpDir);

    const path = getStatePath('log.jsonl', 'local', tmpDir);
    const raw = readFileSync(path, 'utf-8');
    const lines = raw.trim().split('\n');
    expect(lines).toHaveLength(3);
  });
});

describe('readAppendLog', () => {
  it('should return empty array for missing file', () => {
    const entries = readAppendLog('nonexistent', 'local', tmpDir);
    expect(entries).toEqual([]);
  });

  it('should parse all entries', () => {
    appendState('usage', { tokens: 10 }, 'local', tmpDir);
    appendState('usage', { tokens: 20 }, 'local', tmpDir);

    const entries = readAppendLog<LogEntry>('usage', 'local', tmpDir);
    expect(entries).toHaveLength(2);
    expect(entries[0].tokens).toBe(10);
    expect(entries[1].tokens).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Lifecycle helpers
// ---------------------------------------------------------------------------

describe('stateExists', () => {
  it('should return false for missing state', () => {
    expect(stateExists('missing', 'local', tmpDir)).toBe(false);
  });

  it('should return true after writing', () => {
    writeState('exists-test', { ok: true }, 'local', tmpDir);
    expect(stateExists('exists-test', 'local', tmpDir)).toBe(true);
  });
});

describe('clearState', () => {
  it('should return false for missing state', () => {
    expect(clearState('missing', 'local', tmpDir)).toBe(false);
  });

  it('should delete the file and return true', () => {
    writeState('to-delete', { bye: true }, 'local', tmpDir);
    expect(clearState('to-delete', 'local', tmpDir)).toBe(true);
    expect(stateExists('to-delete', 'local', tmpDir)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// StateManager class
// ---------------------------------------------------------------------------

describe('StateManager', () => {
  it('should get/set state', () => {
    const mgr = new StateManager<TestState>('class-test', 'local', tmpDir);

    expect(mgr.get()).toBeUndefined();
    expect(mgr.exists()).toBe(false);

    mgr.set({ phase: 'init', iteration: 0, active: true });
    expect(mgr.exists()).toBe(true);
    expect(mgr.get()?.phase).toBe('init');
  });

  it('should update state functionally', () => {
    const mgr = new StateManager<TestState>('update-test', 'local', tmpDir);
    mgr.set({ phase: 'planning', iteration: 1, active: true });

    mgr.update((s) => ({ ...s!, iteration: s!.iteration + 1 }));
    expect(mgr.get()?.iteration).toBe(2);
  });

  it('should clear state', () => {
    const mgr = new StateManager<TestState>('clear-test', 'local', tmpDir);
    mgr.set({ phase: 'done', iteration: 5, active: false });
    expect(mgr.clear()).toBe(true);
    expect(mgr.exists()).toBe(false);
  });

  it('should expose the file path', () => {
    const mgr = new StateManager<TestState>('path-test', 'local', tmpDir);
    expect(mgr.path()).toContain('path-test.json');
    expect(mgr.path()).toContain('.kw-plugin');
  });

  it('should return full read result', () => {
    const mgr = new StateManager<TestState>('read-test', 'local', tmpDir);
    mgr.set({ phase: 'qa', iteration: 3, active: true });

    const result = mgr.read();
    expect(result.exists).toBe(true);
    expect(result.data?.phase).toBe('qa');
    expect(result.foundAt).toContain('read-test.json');
  });
});
