/**
 * State Manager
 *
 * Lightweight file-based persistence layer for plugin state.
 *
 * OMC Pattern: State lives in two places:
 *   - "local"  → .kw-plugin/state/ in the project root (project-scoped)
 *   - "global" → ~/.config/kw-plugin/state/ (user-scoped, survives across projects)
 *
 * Three storage primitives:
 *   - JSON: read/write complete objects (most state)
 *   - JSONL: append-only line-delimited log (analytics, history)
 *   - exists/clear: lifecycle helpers
 *
 * All operations are synchronous (matches OMC's approach — hooks run in
 * subprocesses where async adds complexity for no benefit).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { StateLocation, StateReadResult, StateWriteResult } from '../shared/types.js';

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/**
 * Get the directory for a given state location.
 *
 * @param location - "local" for project-scoped, "global" for user-scoped
 * @param cwd - Project root (only needed for "local")
 */
export function getStateDir(location: StateLocation, cwd?: string): string {
  if (location === 'global') {
    return join(homedir(), '.config', 'kw-plugin', 'state');
  }
  const root = cwd ?? process.cwd();
  return join(root, '.kw-plugin', 'state');
}

/**
 * Get the full path for a named state file.
 */
export function getStatePath(
  name: string,
  location: StateLocation,
  cwd?: string
): string {
  const dir = getStateDir(location, cwd);
  // Append .json if no extension provided
  const fileName = name.includes('.') ? name : `${name}.json`;
  return join(dir, fileName);
}

/**
 * Ensure the state directory exists.
 */
export function ensureStateDir(location: StateLocation, cwd?: string): void {
  const dir = getStateDir(location, cwd);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// JSON read/write
// ---------------------------------------------------------------------------

/**
 * Read a JSON state file.
 * Returns { exists: false } if file doesn't exist or can't be parsed.
 */
export function readState<T>(
  name: string,
  location: StateLocation = 'local',
  cwd?: string
): StateReadResult<T> {
  const path = getStatePath(name, location, cwd);
  try {
    if (!existsSync(path)) {
      return { exists: false };
    }
    const raw = readFileSync(path, 'utf-8');
    const data = JSON.parse(raw) as T;
    return { exists: true, data, foundAt: path };
  } catch {
    return { exists: false };
  }
}

/**
 * Write a JSON state file. Creates directories if needed.
 */
export function writeState<T>(
  name: string,
  data: T,
  location: StateLocation = 'local',
  cwd?: string
): StateWriteResult {
  const path = getStatePath(name, location, cwd);
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true, path };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, path, error: message };
  }
}

/**
 * Functional update: read → transform → write.
 * If the state doesn't exist, updater receives undefined.
 */
export function updateState<T>(
  name: string,
  updater: (current: T | undefined) => T,
  location: StateLocation = 'local',
  cwd?: string
): StateWriteResult {
  const { data } = readState<T>(name, location, cwd);
  const updated = updater(data);
  return writeState(name, updated, location, cwd);
}

// ---------------------------------------------------------------------------
// JSONL append (for logs/analytics)
// ---------------------------------------------------------------------------

/**
 * Append a line to a JSONL file. Each call adds one JSON object per line.
 * Creates directories and file if needed.
 */
export function appendState<T>(
  name: string,
  entry: T,
  location: StateLocation = 'global',
  cwd?: string
): StateWriteResult {
  // JSONL files must have .jsonl extension
  const fileName = name.endsWith('.jsonl') ? name : `${name}.jsonl`;
  const path = getStatePath(fileName, location, cwd);
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    appendFileSync(path, JSON.stringify(entry) + '\n', 'utf-8');
    return { success: true, path };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, path, error: message };
  }
}

/**
 * Read all entries from a JSONL file.
 * Returns empty array if file doesn't exist.
 */
export function readAppendLog<T>(
  name: string,
  location: StateLocation = 'global',
  cwd?: string
): T[] {
  const fileName = name.endsWith('.jsonl') ? name : `${name}.jsonl`;
  const path = getStatePath(fileName, location, cwd);
  try {
    if (!existsSync(path)) return [];
    const raw = readFileSync(path, 'utf-8');
    return raw
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Lifecycle helpers
// ---------------------------------------------------------------------------

/**
 * Check if a state file exists.
 */
export function stateExists(
  name: string,
  location: StateLocation = 'local',
  cwd?: string
): boolean {
  const path = getStatePath(name, location, cwd);
  return existsSync(path);
}

/**
 * Delete a state file. Returns true if the file existed and was removed.
 */
export function clearState(
  name: string,
  location: StateLocation = 'local',
  cwd?: string
): boolean {
  const path = getStatePath(name, location, cwd);
  try {
    if (!existsSync(path)) return false;
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// StateManager class (convenience wrapper)
// ---------------------------------------------------------------------------

/**
 * Object-oriented wrapper around the state functions.
 *
 * Usage:
 *   const mode = new StateManager<ModeState>('autopilot', 'local', cwd);
 *   const state = mode.get();
 *   mode.set({ ...state, phase: 'execution' });
 *   mode.update(s => ({ ...s, iteration: (s?.iteration ?? 0) + 1 }));
 */
export class StateManager<T> {
  constructor(
    private readonly name: string,
    private readonly location: StateLocation = 'local',
    private readonly cwd?: string
  ) {}

  /** Read state, returning the full result with metadata. */
  read(): StateReadResult<T> {
    return readState<T>(this.name, this.location, this.cwd);
  }

  /** Get the data directly, or undefined if not found. */
  get(): T | undefined {
    return readState<T>(this.name, this.location, this.cwd).data;
  }

  /** Write state, replacing the entire file. */
  set(data: T): StateWriteResult {
    return writeState(this.name, data, this.location, this.cwd);
  }

  /** Functional update: read → transform → write. */
  update(updater: (current: T | undefined) => T): StateWriteResult {
    return updateState(this.name, updater, this.location, this.cwd);
  }

  /** Check if the state file exists. */
  exists(): boolean {
    return stateExists(this.name, this.location, this.cwd);
  }

  /** Delete the state file. */
  clear(): boolean {
    return clearState(this.name, this.location, this.cwd);
  }

  /** Get the full file path (useful for debugging). */
  path(): string {
    return getStatePath(this.name, this.location, this.cwd);
  }
}
