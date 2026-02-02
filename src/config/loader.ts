/**
 * Configuration Loader
 *
 * Loads and merges configuration from multiple sources with a clear precedence:
 *   defaults → user config → project config → env vars
 *
 * OMC Pattern: Every module reads from a single PluginConfig object. The loader
 * handles all the merging so consumers never worry about where a value came from.
 *
 * Config files use JSONC (JSON with Comments) so users can annotate their config:
 *
 *   // ~/.config/kw-plugin/config.jsonc
 *   {
 *     // Disable session start banner
 *     "features": {
 *       "sessionStartContext": false
 *     }
 *   }
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import * as jsonc from 'jsonc-parser';
import type { PluginConfig } from '../shared/types.js';

// ---------------------------------------------------------------------------
// Defaults — the baseline config. Every property has a sane default here.
// Users only override what they want to change.
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG: PluginConfig = {
  features: {
    sessionStartContext: true,
    magicKeywords: true,
  },
  permissions: {
    maxBackgroundTasks: 5,
  },
};

// ---------------------------------------------------------------------------
// Config file paths
// ---------------------------------------------------------------------------

/**
 * Get paths for user-level and project-level config files.
 *
 * OMC Pattern: Two config scopes —
 *   User:    ~/.config/kw-plugin/config.jsonc   (your personal preferences)
 *   Project: .claude/kw-plugin.jsonc             (shared with the team via git)
 *
 * XDG_CONFIG_HOME is respected if set (Linux convention).
 */
export function getConfigPaths(workingDirectory?: string): {
  user: string;
  project: string;
} {
  const userConfigDir =
    process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');

  return {
    user: join(userConfigDir, 'kw-plugin', 'config.jsonc'),
    project: join(
      workingDirectory ?? process.cwd(),
      '.claude',
      'kw-plugin.jsonc'
    ),
  };
}

// ---------------------------------------------------------------------------
// JSONC file loader
// ---------------------------------------------------------------------------

/**
 * Load and parse a JSONC file. Returns null if the file doesn't exist or can't be parsed.
 *
 * JSONC = JSON with Comments. The jsonc-parser library handles:
 * - // single-line comments
 * - /* multi-line comments * /
 * - Trailing commas
 *
 * OMC uses this exact same approach — config files should be human-friendly.
 */
export function loadJsoncFile(path: string): PluginConfig | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    const errors: jsonc.ParseError[] = [];
    const result = jsonc.parse(content, errors, {
      allowTrailingComma: true,
      allowEmptyContent: true,
    });

    if (errors.length > 0) {
      // Warn but don't fail — a partially valid config is better than no config
      console.warn(`Warning: Parse errors in ${path}:`, errors);
    }

    return result as PluginConfig;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Deep merge
// ---------------------------------------------------------------------------

/**
 * Recursively merge source into target. Objects are merged key-by-key,
 * primitives and arrays are replaced wholesale.
 *
 * This is critical for the config cascade to work correctly. Example:
 *
 *   deepMerge(
 *     { features: { sessionStartContext: true }, permissions: { maxBackgroundTasks: 5 } },
 *     { features: { sessionStartContext: false } }
 *   )
 *   // Result: { features: { sessionStartContext: false }, permissions: { maxBackgroundTasks: 5 } }
 *
 * Note how permissions.maxBackgroundTasks is preserved even though the source
 * didn't mention it. That's the whole point — you only specify what you override.
 */
export function deepMerge<T extends object>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      // Both are non-array objects → recurse
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      // Primitive, array, or null → replace entirely
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Environment variable overrides
// ---------------------------------------------------------------------------

/**
 * Load config overrides from environment variables.
 * Highest precedence — useful for CI, Docker, or quick overrides.
 *
 * OMC Pattern: Env vars use a prefix (OMC_*) and map to specific config paths.
 * We use KW_PLUGIN_* as our prefix.
 */
export function loadEnvConfig(): Partial<PluginConfig> {
  const config: Partial<PluginConfig> = {};

  // Feature flags
  const sessionContext = process.env.KW_PLUGIN_SESSION_CONTEXT;
  if (sessionContext !== undefined) {
    config.features = {
      ...config.features,
      sessionStartContext: sessionContext === 'true',
    };
  }

  // Permissions
  const maxTasks = process.env.KW_PLUGIN_MAX_BACKGROUND_TASKS;
  if (maxTasks !== undefined) {
    const parsed = parseInt(maxTasks, 10);
    if (!isNaN(parsed)) {
      config.permissions = {
        ...config.permissions,
        maxBackgroundTasks: parsed,
      };
    }
  }

  return config;
}

// ---------------------------------------------------------------------------
// Main loader
// ---------------------------------------------------------------------------

/**
 * Load the fully merged plugin configuration.
 *
 * Merge order (lowest to highest precedence):
 *   1. DEFAULT_CONFIG       — sane defaults for everything
 *   2. User config          — ~/.config/kw-plugin/config.jsonc
 *   3. Project config       — .claude/kw-plugin.jsonc
 *   4. Environment vars     — KW_PLUGIN_* variables
 *
 * Each layer only needs to specify what it wants to override.
 * Everything else falls through from the layer below.
 */
export function loadConfig(workingDirectory?: string): PluginConfig {
  let config: PluginConfig = { ...DEFAULT_CONFIG };

  const paths = getConfigPaths(workingDirectory);

  // Layer 2: User-level config
  const userConfig = loadJsoncFile(paths.user);
  if (userConfig) {
    config = deepMerge(config, userConfig);
  }

  // Layer 3: Project-level config
  const projectConfig = loadJsoncFile(paths.project);
  if (projectConfig) {
    config = deepMerge(config, projectConfig);
  }

  // Layer 4: Environment variables (highest precedence)
  const envConfig = loadEnvConfig();
  if (Object.keys(envConfig).length > 0) {
    config = deepMerge(config, envConfig);
  }

  return config;
}
