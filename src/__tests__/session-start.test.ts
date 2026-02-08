import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import {
  parseCommandFrontmatter,
  discoverCommands,
  buildSessionStartContext,
} from '../hooks/session-start.js';
import { initNotepad, setPriorityContext } from '../notepad/notepad.js';
import { writeBoulderState } from '../boulder/boulder.js';
import type { BoulderState } from '../boulder/types.js';

describe('parseCommandFrontmatter', () => {
  it('should parse description from frontmatter', () => {
    const content = `---
description: "Run code review"
argument-hint: "1|2|3"
allowed-tools: ["Bash"]
---

# Review Code`;

    const result = parseCommandFrontmatter(content);
    expect(result.description).toBe('Run code review');
    expect(result.argumentHint).toBe('1|2|3');
  });

  it('should return empty description when no frontmatter', () => {
    const content = '# Just a heading\n\nSome content';
    const result = parseCommandFrontmatter(content);
    expect(result.description).toBe('');
    expect(result.argumentHint).toBeUndefined();
  });

  it('should handle frontmatter without description', () => {
    const content = `---
allowed-tools: ["Bash"]
---

# Command`;

    const result = parseCommandFrontmatter(content);
    expect(result.description).toBe('');
  });
});

describe('discoverCommands', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kw-plugin-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should discover .md files in the commands directory', () => {
    const commandsDir = join(tempDir, 'commands');
    mkdirSync(commandsDir);

    writeFileSync(
      join(commandsDir, 'review-code.md'),
      `---\ndescription: "Review code"\n---\n\n# Review`
    );
    writeFileSync(
      join(commandsDir, 'create-pr.md'),
      `---\ndescription: "Create PR"\n---\n\n# PR`
    );

    const commands = discoverCommands(commandsDir);
    expect(commands).toHaveLength(2);
    expect(commands[0].name).toBe('create-pr');
    expect(commands[0].description).toBe('Create PR');
    expect(commands[1].name).toBe('review-code');
    expect(commands[1].description).toBe('Review code');
  });

  it('should return empty array for nonexistent directory', () => {
    const commands = discoverCommands(join(tempDir, 'nonexistent'));
    expect(commands).toHaveLength(0);
  });

  it('should ignore non-.md files', () => {
    const commandsDir = join(tempDir, 'commands');
    mkdirSync(commandsDir);
    writeFileSync(join(commandsDir, 'readme.txt'), 'not a command');
    writeFileSync(
      join(commandsDir, 'test.md'),
      `---\ndescription: "Test"\n---\n\n# Test`
    );

    const commands = discoverCommands(commandsDir);
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('test');
  });

  it('should sort commands alphabetically', () => {
    const commandsDir = join(tempDir, 'commands');
    mkdirSync(commandsDir);

    writeFileSync(join(commandsDir, 'zebra.md'), `---\ndescription: "Z"\n---`);
    writeFileSync(join(commandsDir, 'alpha.md'), `---\ndescription: "A"\n---`);
    writeFileSync(join(commandsDir, 'middle.md'), `---\ndescription: "M"\n---`);

    const commands = discoverCommands(commandsDir);
    expect(commands.map((c) => c.name)).toEqual(['alpha', 'middle', 'zebra']);
  });
});

describe('buildSessionStartContext', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kw-plugin-test-'));
    mkdirSync(join(tempDir, '.claude-plugin'));
    mkdirSync(join(tempDir, 'commands'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should build context with plugin version and commands', () => {
    writeFileSync(
      join(tempDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'test-plugin', version: '1.2.3' })
    );
    writeFileSync(
      join(tempDir, 'commands', 'hello.md'),
      `---\ndescription: "Say hello"\n---\n\n# Hello`
    );

    const output = buildSessionStartContext(tempDir);

    expect(output.continue).toBe(true);
    expect(output.hookSpecificOutput).toBeDefined();
    expect(output.hookSpecificOutput?.hookEventName).toBe('SessionStart');

    const context = output.hookSpecificOutput?.additionalContext ?? '';
    expect(context).toContain('test-plugin v1.2.3');
    expect(context).toContain('/hello');
    expect(context).toContain('Say hello');
  });

  it('should handle missing plugin.json gracefully', () => {
    rmSync(join(tempDir, '.claude-plugin'), { recursive: true, force: true });

    const output = buildSessionStartContext(tempDir);
    expect(output.continue).toBe(true);

    const context = output.hookSpecificOutput?.additionalContext ?? '';
    expect(context).toContain('kw-plugin');
    expect(context).toContain('unknown');
  });

  it('should always return continue: true even with bad path', () => {
    const output = buildSessionStartContext('/nonexistent/path');
    expect(output.continue).toBe(true);
  });

  it('should list multiple commands sorted', () => {
    writeFileSync(
      join(tempDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'kw-plugin', version: '0.7.0' })
    );
    writeFileSync(
      join(tempDir, 'commands', 'beta.md'),
      `---\ndescription: "Beta cmd"\n---`
    );
    writeFileSync(
      join(tempDir, 'commands', 'alpha.md'),
      `---\ndescription: "Alpha cmd"\n---`
    );

    const output = buildSessionStartContext(tempDir);
    const context = output.hookSpecificOutput?.additionalContext ?? '';

    // Alpha should appear before Beta (sorted)
    const alphaIndex = context.indexOf('/alpha');
    const betaIndex = context.indexOf('/beta');
    expect(alphaIndex).toBeLessThan(betaIndex);
  });

  it('should skip context injection when feature is disabled', () => {
    writeFileSync(
      join(tempDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'kw-plugin', version: '0.7.0' })
    );
    writeFileSync(
      join(tempDir, 'commands', 'test.md'),
      `---\ndescription: "Test"\n---`
    );

    const output = buildSessionStartContext(tempDir, {
      features: { sessionStartContext: false },
    });

    // Should still continue, but no context injected
    expect(output.continue).toBe(true);
    expect(output.hookSpecificOutput).toBeUndefined();
  });

  it('should inject context when feature is explicitly enabled', () => {
    writeFileSync(
      join(tempDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'kw-plugin', version: '0.7.0' })
    );

    const output = buildSessionStartContext(tempDir, {
      features: { sessionStartContext: true },
    });

    expect(output.continue).toBe(true);
    expect(output.hookSpecificOutput).toBeDefined();
  });

  // --- Notepad integration ---

  it('should inject notepad priority context when present', () => {
    writeFileSync(
      join(tempDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'kw-plugin', version: '0.9.0' })
    );

    initNotepad(tempDir);
    setPriorityContext('This repo uses NestJS guards for auth', tempDir);

    const output = buildSessionStartContext(tempDir);
    const context = output.hookSpecificOutput?.additionalContext ?? '';
    expect(context).toContain('<notepad-priority>');
    expect(context).toContain('This repo uses NestJS guards for auth');
    expect(context).toContain('</notepad-priority>');
  });

  it('should skip notepad when feature is disabled', () => {
    writeFileSync(
      join(tempDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'kw-plugin', version: '0.9.0' })
    );

    initNotepad(tempDir);
    setPriorityContext('Should not appear', tempDir);

    const output = buildSessionStartContext(tempDir, {
      features: { notepad: false },
    });
    const context = output.hookSpecificOutput?.additionalContext ?? '';
    expect(context).not.toContain('<notepad-priority>');
  });

  it('should skip notepad when priority context is empty', () => {
    writeFileSync(
      join(tempDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'kw-plugin', version: '0.9.0' })
    );

    initNotepad(tempDir);

    const output = buildSessionStartContext(tempDir);
    const context = output.hookSpecificOutput?.additionalContext ?? '';
    expect(context).not.toContain('<notepad-priority>');
  });

  // --- Boulder state integration ---

  it('should inject boulder state when active', () => {
    writeFileSync(
      join(tempDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'kw-plugin', version: '0.9.0' })
    );

    // Create a plan file with checkboxes
    const planPath = join(tempDir, 'plan.md');
    writeFileSync(
      planPath,
      '- [x] First task\n- [ ] Second task\n- [ ] Third task'
    );

    const boulderState: BoulderState = {
      active_plan: planPath,
      started_at: '2025-02-08T10:00:00.000Z',
      session_ids: ['session-1'],
      plan_name: 'test-plan',
    };
    writeBoulderState(boulderState, tempDir);

    const output = buildSessionStartContext(tempDir);
    const context = output.hookSpecificOutput?.additionalContext ?? '';
    expect(context).toContain('<boulder-state>');
    expect(context).toContain('test-plan');
    expect(context).toContain('33%');
    expect(context).toContain('1/3');
    expect(context).toContain('</boulder-state>');
  });

  it('should skip boulder when feature is disabled', () => {
    writeFileSync(
      join(tempDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'kw-plugin', version: '0.9.0' })
    );

    const planPath = join(tempDir, 'plan.md');
    writeFileSync(planPath, '- [x] Done');

    writeBoulderState(
      {
        active_plan: planPath,
        started_at: '2025-02-08T10:00:00.000Z',
        session_ids: ['s1'],
        plan_name: 'plan',
      },
      tempDir
    );

    const output = buildSessionStartContext(tempDir, {
      features: { boulderState: false },
    });
    const context = output.hookSpecificOutput?.additionalContext ?? '';
    expect(context).not.toContain('<boulder-state>');
  });

  it('should skip boulder when no state exists', () => {
    writeFileSync(
      join(tempDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'kw-plugin', version: '0.9.0' })
    );

    const output = buildSessionStartContext(tempDir);
    const context = output.hookSpecificOutput?.additionalContext ?? '';
    expect(context).not.toContain('<boulder-state>');
  });

  it('should handle errors in notepad/boulder without blocking', () => {
    // Use a path that will cause file system errors
    const output = buildSessionStartContext('/nonexistent/path');
    expect(output.continue).toBe(true);
  });
});
