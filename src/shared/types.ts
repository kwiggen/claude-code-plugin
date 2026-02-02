/**
 * Shared types for kw-plugin
 *
 * These types define the hook contract between Claude Code and our plugin.
 * Claude Code sends HookInput via stdin, we respond with HookOutput via stdout.
 *
 * This mirrors OMC's pattern from src/shared/types.ts — every hook in the system
 * uses these same interfaces, which is what makes the hook system composable.
 */

// ---------------------------------------------------------------------------
// Hook Contract Types
// ---------------------------------------------------------------------------

/**
 * Input from Claude Code hooks (received via stdin as JSON).
 * Different hook events populate different fields.
 */
export interface HookInput {
  /** Unique session identifier */
  sessionId?: string;
  /** Working directory for the session */
  directory?: string;
  /** User's prompt text (populated for UserPromptSubmit) */
  prompt?: string;
  /** Tool being used (populated for PreToolUse/PostToolUse) */
  toolName?: string;
  /** Tool input parameters (populated for PreToolUse/PostToolUse) */
  toolInput?: unknown;
  /** Tool output (populated for PostToolUse only) */
  toolOutput?: unknown;
}

/**
 * Base output for most hooks (written to stdout as JSON).
 * - continue: true  → Claude Code proceeds normally
 * - continue: false → Claude Code blocks the operation
 */
export interface HookOutput {
  /** Whether to continue with the operation */
  continue: boolean;
  /** Optional message to inject into conversation context */
  message?: string;
  /** Reason for blocking (when continue is false) */
  reason?: string;
}

/**
 * SessionStart has a special output shape — it uses hookSpecificOutput
 * instead of the generic message field. This is how you inject context
 * at the start of every session.
 */
export interface SessionStartOutput {
  continue: boolean;
  hookSpecificOutput?: {
    hookEventName: 'SessionStart';
    /** This text gets injected into the model's context */
    additionalContext: string;
  };
}

// ---------------------------------------------------------------------------
// Plugin Types
// ---------------------------------------------------------------------------

/**
 * Command metadata parsed from YAML frontmatter in command .md files.
 */
export interface CommandInfo {
  /** Command name without leading / */
  name: string;
  /** Description from frontmatter */
  description: string;
  /** Argument hint (e.g. "1|2|3|<PR#>") */
  argumentHint?: string;
}

/**
 * UserPromptSubmit hook output — injects context before Claude sees the prompt.
 */
export interface UserPromptSubmitOutput {
  continue: boolean;
  hookSpecificOutput?: {
    hookEventName: 'UserPromptSubmit';
    /** Text appended to the conversation context (Claude sees this + the original prompt) */
    additionalContext: string;
  };
}

/**
 * A magic keyword definition.
 * Each keyword has trigger patterns and an instruction to inject when detected.
 */
export interface MagicKeyword {
  /** Unique identifier */
  name: string;
  /** Regex patterns that trigger this keyword (tested against sanitized prompt) */
  triggers: string[];
  /** Priority (lower = higher priority). Used when multiple keywords match. */
  priority: number;
  /** Instruction text injected into additionalContext when triggered */
  instruction: string;
  /** Optional: skill to invoke (e.g. "kw-plugin:review-code") */
  skill?: string;
  /** Optional: skill arguments */
  skillArgs?: string;
}

/**
 * Plugin configuration.
 *
 * OMC Pattern: Every property is optional. Defaults are defined in config/loader.ts.
 * The config is built by merging: defaults → user config → project config → env vars.
 * Each layer only needs to specify what it wants to override.
 */
export interface PluginConfig {
  /** Feature toggles */
  features?: {
    /** Inject plugin context at session start (default: true) */
    sessionStartContext?: boolean;
    /** Enable magic keyword detection in prompts (default: true) */
    magicKeywords?: boolean;
  };

  /** Permission controls */
  permissions?: {
    /** Max concurrent background tasks (default: 5) */
    maxBackgroundTasks?: number;
  };

  /** Custom keyword trigger overrides. Keys are keyword names, values are trigger arrays. */
  magicKeywords?: Record<string, string[]>;

  // Future phases will add:
  // agents?: { ... }        — model overrides per agent
  // routing?: { ... }       — smart model routing rules
  // mcpServers?: { ... }    — external MCP server config
}

// ---------------------------------------------------------------------------
// State Management Types
// ---------------------------------------------------------------------------

/** Where state files are stored. */
export type StateLocation = 'local' | 'global';

/** Result of reading a state file. */
export interface StateReadResult<T> {
  /** Whether the file existed */
  exists: boolean;
  /** Parsed data (undefined if not found) */
  data?: T;
  /** Path where the file was found */
  foundAt?: string;
}

/** Result of writing a state file. */
export interface StateWriteResult {
  /** Whether the write succeeded */
  success: boolean;
  /** Path the file was written to */
  path: string;
  /** Error message if write failed */
  error?: string;
}

// ---------------------------------------------------------------------------
// HUD / Statusline Types
// ---------------------------------------------------------------------------

/**
 * JSON that Claude Code pipes to the statusline command via stdin.
 * This is the raw data we work with to render the statusbar.
 */
export interface StatuslineInput {
  /** Path to the session transcript (JSONL file) */
  transcript_path?: string;
  /** Current working directory */
  cwd?: string;
  /** Model information */
  model?: {
    id?: string;
    display_name?: string;
  };
  /** Context window usage */
  context_window?: {
    context_window_size?: number;
    used_percentage?: number;
    current_usage?: {
      input_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
}
