# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Claude Code plugin that provides commands for code review, PR creation, and team GitHub insights.

**Commands:**
- `/review-code` - Code review (backed by `code-reviewer` skill)
- `/create-pr` - PR creation (backed by `pr-writer` skill)
- `/team-stats` - GitHub team activity (backed by `github-insights` skill)

## Architecture

```
.claude-plugin/plugin.json   # Plugin metadata (name, version, author)
commands/                    # Slash command definitions (Markdown with YAML frontmatter)
skills/                      # Skill implementations (SKILL.md files)
```

**Commands** define user-facing slash commands with:
- YAML frontmatter: `description`, `argument-hint`, `allowed-tools`
- Workflow instructions in Markdown
- Template variables: `$ARGUMENTS` contains text passed after the command

**Skills** define reusable capabilities that commands invoke:
- YAML frontmatter: `name`, `description`
- Detailed instructions for how to perform the skill

## Plugin File Patterns

### Command files (`commands/*.md`)
```yaml
---
description: "Short description shown in command list"
argument-hint: "[optional-arg]"
allowed-tools: ["ToolName", "Bash(pattern:*)"]
---
```

### Skill files (`skills/<name>/SKILL.md`)
```yaml
---
name: skill-name
description: |
  Multi-line description of when to use this skill
---
```

## TypeScript Infrastructure

The plugin uses both Python and TypeScript:

- **Python** (`skills/*/scripts/*.py`): Data-intensive scripts (gh_stats.py, release_reports.py)
- **TypeScript** (`src/`): Hooks, config, and future features (agents, HUD, MCP tools)

### Build & Test

```bash
npm install          # Install TypeScript toolchain
npm run build        # Compile src/ -> dist/
npm run test         # Run vitest tests
npm run lint         # ESLint (no any allowed)
npm run typecheck    # tsc --noEmit
npm run check        # All three: typecheck + lint + test
```

### Hook Scripts (`scripts/*.mjs`)

Standalone Node.js scripts invoked by Claude Code via `hooks/hooks.json`.
These use only Node.js builtins (no imports from dist/ or node_modules/).
The TypeScript equivalents in `src/hooks/` provide the same logic in testable form.

### Hook Contract

```
stdin  → JSON { sessionId, directory, prompt?, toolName? }
stdout → JSON { continue: true/false, message?, hookSpecificOutput? }
```

## Version Management

Bump version in `.claude-plugin/plugin.json` when making changes.

## Before Completing Tasks

Always check for lint/type errors before saying you're done:

1. **Python files**:
   - Run `mypy --strict <file>` - must pass with no errors
   - Run `python -m py_compile <file>` - syntax check
2. **TypeScript files**: Run `tsc --noEmit` and check IDE diagnostics
3. **Use `mcp__ide__getDiagnostics`** to check for red squiggles in the IDE (includes Flake8 for Python)

Fix all errors before marking a task complete.
