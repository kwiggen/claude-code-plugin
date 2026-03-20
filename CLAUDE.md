# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Claude Code plugin that provides commands for code review, PR creation, team GitHub insights, and multi-model second opinions via Gemini API.

**Commands:**
- `/review-code` - Code review (backed by `code-reviewer` skill)
- `/create-pr` - PR creation (backed by `pr-writer` skill)
- `/team-stats` - GitHub team activity (backed by `github-insights` skill)
- `/create-feature` - Feature definition via discussion (backed by `feature-writer` skill)
- `/create-issue` - GitHub issue creation (backed by `issue-creator` skill)
- `/release-preview` - Release preview report (backed by `release-reports` skill)
- `/release-retro` - Release retrospective (backed by `release-reports` skill)
- `/validate` - Plan/architecture validation (backed by `assumption-challenger`, `antipattern-detector`, `validator` skills)
- `/gemini-review` - Dual code review from Claude + Gemini (backed by `gemini-reviewer` skill)
- `/ask-gemini` - Second opinion from Gemini (backed by `gemini-advisor` skill)
- `/generate-image` - AI image generation with enhanced prompts (backed by `image-generator` skill)
- `/paper-banana` - Publication-quality illustrations via 5-agent pipeline (backed by `paper-banana` skill)
- `/teach-me` - Pedagogical code walkthrough (backed by `teach-me` skill)

**Auto-triggering skills (no command):**
- `assumption-challenger` - Surfaces and stress-tests implicit assumptions in plans and proposals
- `antipattern-detector` - Detects common failure patterns in proposals, architectures, and plans

**Global skills (installed separately, available in all projects):**
- Google Workspace CLI (`gws`) skills — 40 skills, 10 personas, and 40 recipes for Gmail, Calendar, Drive, Sheets, Docs, Chat, Tasks, Meet, Keep, Forms, and more. Installed globally to `~/.claude/skills/` via:
  ```bash
  npm install -g @googleworkspace/cli   # Install the CLI
  gws auth setup                        # Configure OAuth (requires gcloud CLI)
  npx skills add https://github.com/googleworkspace/cli  # Install agent skills
  ```
  Docs: https://github.com/googleworkspace/cli

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

- **TypeScript** (`src/`): Hooks, config, GitHub insights CLI, Gemini API, HUD, release reports
  - `src/github/` — Shared GitHub API wrapper (gh CLI integration, types)
  - `src/gemini/` — Gemini text generation API wrapper (`@google/genai` SDK, CLI entrypoint at `dist/gemini/cli.js`)
  - `src/insights/` — Team analytics (11 report actions, CLI entrypoint at `dist/insights/cli.js`)
  - `src/releases/` — Release report data, classification, formatting, and actions
  - `src/image-gen/` — Gemini image generation API wrapper (CLI entrypoint at `dist/image-gen/cli.js`)

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

1. **TypeScript files**: Run `tsc --noEmit` and check IDE diagnostics
2. **Use `mcp__ide__getDiagnostics`** to check for red squiggles in the IDE

Fix all errors before marking a task complete.
