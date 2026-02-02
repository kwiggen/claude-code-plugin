import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import {
  deepMerge,
  loadJsoncFile,
  loadConfig,
  loadEnvConfig,
  DEFAULT_CONFIG,
  getConfigPaths,
} from '../config/loader.js';

// ---------------------------------------------------------------------------
// deepMerge
// ---------------------------------------------------------------------------

describe('deepMerge', () => {
  it('should merge flat objects', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    const result = deepMerge(target, source);

    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('should recursively merge nested objects', () => {
    const target = {
      features: { sessionStartContext: true },
      permissions: { maxBackgroundTasks: 5 },
    };
    const source = {
      features: { sessionStartContext: false },
    };

    const result = deepMerge(target, source);

    // sessionStartContext overridden, but maxBackgroundTasks preserved
    expect(result.features.sessionStartContext).toBe(false);
    expect(result.permissions.maxBackgroundTasks).toBe(5);
  });

  it('should not mutate the target', () => {
    const target = { a: 1, nested: { b: 2 } };
    const source = { nested: { b: 3 } };

    deepMerge(target, source);

    expect(target.nested.b).toBe(2); // original unchanged
  });

  it('should replace arrays entirely (not merge them)', () => {
    const target = { tags: ['a', 'b'] };
    const source = { tags: ['c'] };
    const result = deepMerge(target, source);

    expect(result.tags).toEqual(['c']);
  });

  it('should skip undefined source values', () => {
    const target = { a: 1, b: 2 };
    const source = { a: undefined, b: 3 };
    const result = deepMerge(target, source);

    expect(result.a).toBe(1); // preserved because source was undefined
    expect(result.b).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// loadJsoncFile
// ---------------------------------------------------------------------------

describe('loadJsoncFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kw-config-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should parse standard JSON', () => {
    const filePath = join(tempDir, 'config.jsonc');
    writeFileSync(filePath, '{ "features": { "sessionStartContext": false } }');

    const result = loadJsoncFile(filePath);
    expect(result?.features?.sessionStartContext).toBe(false);
  });

  it('should parse JSON with comments', () => {
    const filePath = join(tempDir, 'config.jsonc');
    writeFileSync(
      filePath,
      `{
  // This is a comment
  "features": {
    /* Multi-line
       comment */
    "sessionStartContext": false
  }
}`
    );

    const result = loadJsoncFile(filePath);
    expect(result?.features?.sessionStartContext).toBe(false);
  });

  it('should handle trailing commas', () => {
    const filePath = join(tempDir, 'config.jsonc');
    writeFileSync(
      filePath,
      `{
  "features": {
    "sessionStartContext": true,
  },
}`
    );

    const result = loadJsoncFile(filePath);
    expect(result?.features?.sessionStartContext).toBe(true);
  });

  it('should return null for nonexistent file', () => {
    const result = loadJsoncFile(join(tempDir, 'nope.jsonc'));
    expect(result).toBeNull();
  });

  it('should return null for empty file', () => {
    const filePath = join(tempDir, 'empty.jsonc');
    writeFileSync(filePath, '');

    const result = loadJsoncFile(filePath);
    // jsonc-parser with allowEmptyContent returns undefined for empty string
    expect(result).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// loadEnvConfig
// ---------------------------------------------------------------------------

describe('loadEnvConfig', () => {
  afterEach(() => {
    delete process.env.KW_PLUGIN_SESSION_CONTEXT;
    delete process.env.KW_PLUGIN_MAX_BACKGROUND_TASKS;
  });

  it('should read session context flag', () => {
    process.env.KW_PLUGIN_SESSION_CONTEXT = 'false';
    const config = loadEnvConfig();
    expect(config.features?.sessionStartContext).toBe(false);
  });

  it('should read max background tasks', () => {
    process.env.KW_PLUGIN_MAX_BACKGROUND_TASKS = '10';
    const config = loadEnvConfig();
    expect(config.permissions?.maxBackgroundTasks).toBe(10);
  });

  it('should ignore invalid numbers', () => {
    process.env.KW_PLUGIN_MAX_BACKGROUND_TASKS = 'not-a-number';
    const config = loadEnvConfig();
    expect(config.permissions).toBeUndefined();
  });

  it('should return empty object when no env vars set', () => {
    const config = loadEnvConfig();
    expect(Object.keys(config)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// loadConfig (full merge cascade)
// ---------------------------------------------------------------------------

describe('loadConfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kw-config-test-'));
    // Create .claude directory for project config
    mkdirSync(join(tempDir, '.claude'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.KW_PLUGIN_SESSION_CONTEXT;
  });

  it('should return defaults when no config files exist', () => {
    const config = loadConfig(tempDir);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('should merge project config over defaults', () => {
    writeFileSync(
      join(tempDir, '.claude', 'kw-plugin.jsonc'),
      '{ "features": { "sessionStartContext": false } }'
    );

    const config = loadConfig(tempDir);
    expect(config.features?.sessionStartContext).toBe(false);
    // Permissions still come from defaults
    expect(config.permissions?.maxBackgroundTasks).toBe(5);
  });

  it('should let env vars override everything', () => {
    writeFileSync(
      join(tempDir, '.claude', 'kw-plugin.jsonc'),
      '{ "features": { "sessionStartContext": true } }'
    );
    process.env.KW_PLUGIN_SESSION_CONTEXT = 'false';

    const config = loadConfig(tempDir);
    expect(config.features?.sessionStartContext).toBe(false); // env wins
  });
});

// ---------------------------------------------------------------------------
// getConfigPaths
// ---------------------------------------------------------------------------

describe('getConfigPaths', () => {
  it('should use working directory for project config', () => {
    const paths = getConfigPaths('/my/project');
    expect(paths.project).toBe('/my/project/.claude/kw-plugin.jsonc');
  });

  it('should respect XDG_CONFIG_HOME', () => {
    const original = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = '/custom/config';

    const paths = getConfigPaths('/tmp');
    expect(paths.user).toBe('/custom/config/kw-plugin/config.jsonc');

    if (original) {
      process.env.XDG_CONFIG_HOME = original;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }
  });
});
