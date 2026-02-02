/**
 * Magic Keywords Feature
 *
 * Detects trigger words in user prompts and injects behavioral instructions.
 *
 * The prompt goes through four stages:
 *   1. Sanitize — strip code blocks, URLs, paths (prevent false positives)
 *   2. Detect   — test against word-boundary regex patterns
 *   3. Resolve  — pick winner(s) by priority when multiple match
 *   4. Build    — format the additionalContext injection text
 *
 * Keyword definitions live in keywords.json at the plugin root — edit that
 * file to add/remove/modify keywords without touching any code.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type {
  MagicKeyword,
  PluginConfig,
  UserPromptSubmitOutput,
} from '../shared/types.js';

// ---------------------------------------------------------------------------
// Keyword loading
// ---------------------------------------------------------------------------

/**
 * Load keywords from a JSON file.
 * Returns empty array if file doesn't exist or can't be parsed.
 */
export function loadKeywordsFromFile(filePath: string): MagicKeyword[] {
  try {
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as MagicKeyword[];
  } catch {
    return [];
  }
}

/**
 * Load keywords from the plugin's keywords.json file.
 * Falls back to empty array if not found.
 */
export function loadKeywords(pluginRoot: string): MagicKeyword[] {
  return loadKeywordsFromFile(join(pluginRoot, 'keywords.json'));
}

// ---------------------------------------------------------------------------
// Prompt sanitization
// ---------------------------------------------------------------------------

/**
 * Remove content that might contain false positive keywords.
 *
 * Strips: XML tags, URLs, file paths, code blocks, inline code.
 * This prevents "review" inside a code example from triggering review mode.
 */
export function sanitizePrompt(prompt: string): string {
  let sanitized = prompt;

  // Remove fenced code blocks (```...```)
  sanitized = sanitized.replace(/```[\s\S]*?```/g, '');

  // Remove inline code (`...`)
  sanitized = sanitized.replace(/`[^`]+`/g, '');

  // Remove URLs
  sanitized = sanitized.replace(/https?:\/\/\S+/g, '');

  // Remove file paths (anything starting with / or ./ with multiple segments)
  sanitized = sanitized.replace(/(?:\.?\/[\w.-]+){2,}/g, '');

  // Remove XML-style tags
  sanitized = sanitized.replace(/<[^>]+>/g, '');

  return sanitized;
}

// ---------------------------------------------------------------------------
// Keyword detection
// ---------------------------------------------------------------------------

/**
 * Build regex patterns for a keyword's triggers.
 * Uses word boundaries so "review" matches but "preview" doesn't.
 */
function buildTriggerRegex(triggers: string[]): RegExp {
  const escaped = triggers.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  return new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'i');
}

/**
 * Detect which magic keywords are present in a prompt.
 * Returns matched keywords sorted by priority (lowest number = highest priority).
 */
export function detectKeywords(
  prompt: string,
  keywords: MagicKeyword[]
): MagicKeyword[] {
  const sanitized = sanitizePrompt(prompt);

  const matches = keywords.filter((kw) => {
    const regex = buildTriggerRegex(kw.triggers);
    return regex.test(sanitized);
  });

  return matches.sort((a, b) => a.priority - b.priority);
}

/**
 * Apply config overrides to keyword triggers.
 *
 * Users can customize triggers in their config without editing keywords.json:
 *   { "magicKeywords": { "review": ["review", "rv", "check"] } }
 */
export function applyKeywordOverrides(
  keywords: MagicKeyword[],
  overrides?: Record<string, string[]>
): MagicKeyword[] {
  if (!overrides) return keywords;

  return keywords.map((kw) => {
    const customTriggers = overrides[kw.name];
    if (customTriggers) {
      return { ...kw, triggers: customTriggers };
    }
    return kw;
  });
}

// ---------------------------------------------------------------------------
// Output building
// ---------------------------------------------------------------------------

/**
 * Build the hook output for detected keywords.
 *
 * The additionalContext tells Claude what to do. Claude sees this
 * PLUS the original prompt — we don't modify the prompt itself.
 */
export function buildKeywordOutput(
  matchedKeywords: MagicKeyword[]
): UserPromptSubmitOutput {
  if (matchedKeywords.length === 0) {
    return { continue: true };
  }

  const lines: string[] = [];

  if (matchedKeywords.length === 1) {
    const kw = matchedKeywords[0];
    lines.push(`[MAGIC KEYWORD: ${kw.name.toUpperCase()}]`);
    lines.push('');
    lines.push(kw.instruction);

    if (kw.skill) {
      lines.push('');
      lines.push(`Skill: ${kw.skill}`);
      if (kw.skillArgs) {
        lines.push(`Arguments: ${kw.skillArgs}`);
      }
      lines.push('');
      lines.push('IMPORTANT: Invoke the skill IMMEDIATELY using the Skill tool.');
    }
  } else {
    const names = matchedKeywords.map((k) => k.name.toUpperCase()).join(', ');
    lines.push(`[MAGIC KEYWORDS: ${names}]`);

    for (const kw of matchedKeywords) {
      lines.push('');
      lines.push(`### ${kw.name.toUpperCase()}`);
      lines.push(kw.instruction);

      if (kw.skill) {
        lines.push(`Skill: ${kw.skill}`);
        if (kw.skillArgs) {
          lines.push(`Arguments: ${kw.skillArgs}`);
        }
      }
    }

    const skills = matchedKeywords.filter((k) => k.skill);
    if (skills.length > 0) {
      lines.push('');
      lines.push(
        'IMPORTANT: Invoke all skills listed above using the Skill tool.'
      );
    }
  }

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: lines.join('\n'),
    },
  };
}

// ---------------------------------------------------------------------------
// Main processor (called by hook script)
// ---------------------------------------------------------------------------

/**
 * Process a prompt through the magic keyword system.
 *
 * @param prompt - The user's prompt text
 * @param config - Plugin config (for feature toggle + trigger overrides)
 * @param pluginRoot - Path to plugin root (for loading keywords.json)
 */
export function processKeywords(
  prompt: string,
  config?: PluginConfig,
  pluginRoot?: string
): UserPromptSubmitOutput {
  // Feature toggle
  if (config?.features?.magicKeywords === false) {
    return { continue: true };
  }

  // Load keywords from file
  const root = pluginRoot ?? join(import.meta.dirname ?? '.', '..', '..');
  const baseKeywords = loadKeywords(root);

  if (baseKeywords.length === 0) {
    return { continue: true };
  }

  // Apply config trigger overrides
  const keywords = applyKeywordOverrides(baseKeywords, config?.magicKeywords);

  // Detect and build output
  const matches = detectKeywords(prompt, keywords);
  return buildKeywordOutput(matches);
}
