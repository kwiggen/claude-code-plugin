# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Claude Code plugin that provides two commands (`/review-code`, `/create-pr`) backed by two skills (`code-reviewer`, `pr-writer`).

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
