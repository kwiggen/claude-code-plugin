/**
 * HUD Entry Point
 *
 * This is the main pipeline for the statusline:
 *   1. Read JSON from stdin (Claude Code sends model/context/transcript info)
 *   2. Parse it into StatuslineInput
 *   3. Pass to render() to produce colored text
 *   4. Write to stdout
 *
 * Claude Code calls this on every render cycle via the statusLine command
 * configured in ~/.claude/settings.json.
 */

export { render, renderModel, renderContextBar, renderTokens, renderCost } from './render.js';
export { bold, dim, cyan, green, yellow, red, magenta, blue } from './colors.js';
