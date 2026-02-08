import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  readBoulderState,
  writeBoulderState,
  clearBoulderState,
  hasBoulder,
  getActivePlanPath,
  appendSessionId,
  createBoulderState,
  getPlanProgress,
  formatBoulderContext,
} from '../boulder/boulder.js';
import type { BoulderState, PlanProgress } from '../boulder/types.js';

// ---------------------------------------------------------------------------
// Test fixture: temp directory for all file I/O
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'kw-boulder-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

/** Helper: create a plan file with checkbox content. */
function writePlanFile(filename: string, content: string): string {
  const planDir = join(tmpDir, 'plans');
  mkdirSync(planDir, { recursive: true });
  const planPath = join(planDir, filename);
  writeFileSync(planPath, content, 'utf-8');
  return planPath;
}

/** Helper: create a sample boulder state. */
function sampleState(overrides?: Partial<BoulderState>): BoulderState {
  return {
    active_plan: join(tmpDir, 'plans', 'test-plan.md'),
    started_at: '2025-02-08T10:00:00.000Z',
    session_ids: ['session-1'],
    plan_name: 'test-plan',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Core state operations
// ---------------------------------------------------------------------------

describe('readBoulderState / writeBoulderState', () => {
  it('should return undefined when no state exists', () => {
    expect(readBoulderState(tmpDir)).toBeUndefined();
  });

  it('should write and read back state', () => {
    const state = sampleState();
    writeBoulderState(state, tmpDir);

    const result = readBoulderState(tmpDir);
    expect(result).toBeDefined();
    expect(result?.plan_name).toBe('test-plan');
    expect(result?.session_ids).toEqual(['session-1']);
  });

  it('should round-trip all fields', () => {
    const state = sampleState({
      session_ids: ['s1', 's2', 's3'],
    });
    writeBoulderState(state, tmpDir);

    const result = readBoulderState(tmpDir);
    expect(result).toEqual(state);
  });
});

// ---------------------------------------------------------------------------
// Clear / Has / GetPath
// ---------------------------------------------------------------------------

describe('clearBoulderState', () => {
  it('should return false when no state exists', () => {
    expect(clearBoulderState(tmpDir)).toBe(false);
  });

  it('should delete existing state and return true', () => {
    writeBoulderState(sampleState(), tmpDir);
    expect(clearBoulderState(tmpDir)).toBe(true);
    expect(readBoulderState(tmpDir)).toBeUndefined();
  });
});

describe('hasBoulder', () => {
  it('should return false initially', () => {
    expect(hasBoulder(tmpDir)).toBe(false);
  });

  it('should return true after creating state', () => {
    writeBoulderState(sampleState(), tmpDir);
    expect(hasBoulder(tmpDir)).toBe(true);
  });
});

describe('getActivePlanPath', () => {
  it('should return undefined when no boulder exists', () => {
    expect(getActivePlanPath(tmpDir)).toBeUndefined();
  });

  it('should return the active plan path', () => {
    const state = sampleState();
    writeBoulderState(state, tmpDir);
    expect(getActivePlanPath(tmpDir)).toBe(state.active_plan);
  });
});

// ---------------------------------------------------------------------------
// Session tracking
// ---------------------------------------------------------------------------

describe('appendSessionId', () => {
  it('should add a new session ID', () => {
    writeBoulderState(sampleState(), tmpDir);
    appendSessionId('session-2', tmpDir);

    const state = readBoulderState(tmpDir);
    expect(state?.session_ids).toEqual(['session-1', 'session-2']);
  });

  it('should not duplicate existing session IDs', () => {
    writeBoulderState(sampleState(), tmpDir);
    appendSessionId('session-1', tmpDir);

    const state = readBoulderState(tmpDir);
    expect(state?.session_ids).toEqual(['session-1']);
  });

  it('should return undefined when no boulder exists', () => {
    const result = appendSessionId('session-1', tmpDir);
    expect(result).toBeUndefined();
  });

  it('should preserve other state fields', () => {
    writeBoulderState(sampleState(), tmpDir);
    appendSessionId('session-2', tmpDir);

    const state = readBoulderState(tmpDir);
    expect(state?.plan_name).toBe('test-plan');
    expect(state?.started_at).toBe('2025-02-08T10:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

describe('createBoulderState', () => {
  it('should create state with all fields populated', () => {
    const planPath = join(tmpDir, 'plans', 'my-plan.md');
    createBoulderState(planPath, 'my-plan', 'session-abc', tmpDir);

    const state = readBoulderState(tmpDir);
    expect(state).toBeDefined();
    expect(state?.active_plan).toBe(planPath);
    expect(state?.plan_name).toBe('my-plan');
    expect(state?.session_ids).toEqual(['session-abc']);
  });

  it('should set started_at to current time', () => {
    const before = new Date().toISOString();
    createBoulderState('/plan.md', 'plan', 'session-1', tmpDir);
    const after = new Date().toISOString();

    const state = readBoulderState(tmpDir);
    expect(state?.started_at).toBeDefined();
    expect(state!.started_at >= before).toBe(true);
    expect(state!.started_at <= after).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Plan progress
// ---------------------------------------------------------------------------

describe('getPlanProgress', () => {
  it('should return zeroes for missing file', () => {
    const progress = getPlanProgress('/nonexistent/plan.md');
    expect(progress.completed).toBe(0);
    expect(progress.total).toBe(0);
    expect(progress.percentage).toBe(0);
    expect(progress.items).toEqual([]);
  });

  it('should count completed and uncompleted checkboxes', () => {
    const planPath = writePlanFile(
      'plan.md',
      [
        '# My Plan',
        '',
        '- [x] First task',
        '- [ ] Second task',
        '- [x] Third task',
        '- [ ] Fourth task',
      ].join('\n')
    );

    const progress = getPlanProgress(planPath);
    expect(progress.completed).toBe(2);
    expect(progress.total).toBe(4);
    expect(progress.percentage).toBe(50);
  });

  it('should extract item text', () => {
    const planPath = writePlanFile(
      'plan.md',
      '- [x] Implement auth\n- [ ] Write tests'
    );

    const progress = getPlanProgress(planPath);
    expect(progress.items).toEqual([
      { done: true, text: 'Implement auth' },
      { done: false, text: 'Write tests' },
    ]);
  });

  it('should handle plan with no checkboxes', () => {
    const planPath = writePlanFile(
      'plan.md',
      '# Plan\n\nSome description text.\n'
    );

    const progress = getPlanProgress(planPath);
    expect(progress.total).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  it('should handle 100% completion', () => {
    const planPath = writePlanFile(
      'plan.md',
      '- [x] Done one\n- [x] Done two\n- [x] Done three'
    );

    const progress = getPlanProgress(planPath);
    expect(progress.completed).toBe(3);
    expect(progress.total).toBe(3);
    expect(progress.percentage).toBe(100);
  });

  it('should handle uppercase X in checkboxes', () => {
    const planPath = writePlanFile('plan.md', '- [X] Done with uppercase');

    const progress = getPlanProgress(planPath);
    expect(progress.completed).toBe(1);
    expect(progress.items[0].done).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Context injection formatting
// ---------------------------------------------------------------------------

describe('formatBoulderContext', () => {
  it('should format as XML-tagged block', () => {
    const state = sampleState();
    const progress: PlanProgress = {
      completed: 3,
      total: 5,
      percentage: 60,
      items: [],
    };

    const result = formatBoulderContext(state, progress);
    expect(result).toContain('<boulder-state>');
    expect(result).toContain('</boulder-state>');
    expect(result).toContain('test-plan');
    expect(result).toContain('60%');
    expect(result).toContain('3/5');
  });

  it('should include plan path and session count', () => {
    const state = sampleState({ session_ids: ['s1', 's2'] });
    const progress: PlanProgress = {
      completed: 0,
      total: 3,
      percentage: 0,
      items: [],
    };

    const result = formatBoulderContext(state, progress);
    expect(result).toContain(state.active_plan);
    expect(result).toContain('Sessions: 2');
  });

  it('should handle 0% progress', () => {
    const state = sampleState();
    const progress: PlanProgress = {
      completed: 0,
      total: 5,
      percentage: 0,
      items: [],
    };

    const result = formatBoulderContext(state, progress);
    expect(result).toContain('0%');
    expect(result).toContain('0/5');
  });

  it('should handle 100% progress', () => {
    const state = sampleState();
    const progress: PlanProgress = {
      completed: 5,
      total: 5,
      percentage: 100,
      items: [],
    };

    const result = formatBoulderContext(state, progress);
    expect(result).toContain('100%');
    expect(result).toContain('5/5');
  });
});
