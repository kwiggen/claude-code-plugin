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
