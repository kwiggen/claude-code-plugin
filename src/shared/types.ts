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
 * Plugin configuration — will grow as we add features.
 * Future phases: agent config, magic keywords, model routing, etc.
 */
export interface PluginConfig {
  version?: string;
  features?: {
    /** Enable session start context injection (default: true) */
    sessionStartContext?: boolean;
  };
}
