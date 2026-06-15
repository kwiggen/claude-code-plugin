# Claude Code Plugin

A Claude Code plugin for automating GitHub workflows: code reviews, PR creation, and multi-model second opinions via Gemini.

## Installation

**1. Add the marketplace:**
```
/plugin marketplace add kwiggen/claude-code-plugin
```

**2. Install the plugin:**
```
/plugin install kw-plugin@claude-code-plugin
```

**3. (Optional) Enable auto-updates:**

Run `/plugin`, go to Marketplaces tab, enable auto-update for `claude-code-plugin`

### Updating

```
/plugin update kw-plugin@claude-code-plugin
```

### Requirements
- Claude Code v2.0.12 or higher
- GitHub CLI (`gh`) authenticated
- Git repository with GitHub remote
- (Optional) `GEMINI_API_KEY` environment variable for Gemini features (dual-review, second opinions, image generation)

## Commands

### Code Review & PRs

| Command | Description |
|---------|-------------|
| `/review-code` | Run structured code reviews on uncommitted changes, commits, or GitHub PRs |
| `/create-pr [base]` | Create pull requests with AI-generated descriptions |

### Gemini Integration

| Command | Description |
|---------|-------------|
| `/gemini-review` | Dual code review from both Claude and Gemini with synthesis |
| `/ask-gemini` | Get Gemini's independent opinion on any file, topic, or question |
| `/generate-image` | Generate images using Gemini with AI-enhanced prompts |
| `/paper-banana` | Publication-quality illustrations via 5-agent pipeline |

> **Requires:** `GEMINI_API_KEY` environment variable. Get a free key at [Google AI Studio](https://aistudio.google.com/apikey). If the API key is not configured, the dual-review and advisor commands gracefully fall back to Claude-only behavior.

### Planning & Validation

| Command | Description |
|---------|-------------|
| `/create-feature` | Guide feature definition through discussion, generate a 1-pager |
| `/create-issue` | Create a GitHub issue with project fields |
| `/validate` | Validate plans, proposals, or architecture with parallel analysis |

### Learning & Publishing

| Command | Description |
|---------|-------------|
| `/teach-me` | Pedagogical code walkthrough tailored to your level |
| `/grill-me` | Stress-test a plan or design with relentless interviewing |
| `/publish` | Convert markdown to portable, shareable HTML with syntax highlighting and tabs |

## Magic Keywords

Type these phrases naturally instead of using slash commands:

| Phrase | Action |
|--------|--------|
| "review", "code review", "cr" | Triggers `/review-code` |
| "gemini review", "dual review" | Triggers `/gemini-review` |
| "ask gemini", "gemini opinion" | Triggers `/ask-gemini` |
| "create pr", "open pr" | Triggers `/create-pr` |
| "use opus" / "use sonnet" / "use haiku" | Sets model preference for subagents |
| "thorough", "deep review" | Enables thorough analysis mode |
| "ship it", "lgtm" | Enables fast-execution mode |

## Skills

| Skill | Used By |
|-------|---------|
| `code-reviewer` | `/review-code` |
| `pr-writer` | `/create-pr` |
| `feature-writer` | `/create-feature` |
| `issue-creator` | `/create-issue` |
| `gemini-reviewer` | `/gemini-review` |
| `gemini-advisor` | `/ask-gemini` |
| `image-generator` | `/generate-image` |
| `paper-banana` | `/paper-banana` |
| `teach-me` | `/teach-me` |
| `grill-me` | `/grill-me` |
| `publish` | `/publish` |
| `assumption-challenger` | `/validate` |
| `antipattern-detector` | `/validate` |
| `validator` | `/validate` |

## Requirements

- [GitHub CLI](https://cli.github.com/) (`gh`) authenticated
- Git repository with GitHub remote

### Optional: Gemini API Key

The `/gemini-review`, `/ask-gemini`, `/generate-image`, and `/paper-banana` commands require a `GEMINI_API_KEY` environment variable:

1. Get a free API key at [Google AI Studio](https://aistudio.google.com/apikey)
2. Set the environment variable:

```bash
export GEMINI_API_KEY="your-key-here"
```

If the API key is not configured, the dual-review and advisor commands gracefully fall back to Claude-only behavior. Image generation commands require the key to function.

## Structure

```
.claude-plugin/plugin.json   # Plugin metadata
commands/                    # Slash command definitions
skills/                      # Skill implementations (SKILL.md files)
src/gemini/                  # Gemini text generation API wrapper
src/image-gen/               # Gemini image generation API wrapper
src/publish/                 # Markdown-to-HTML converter
src/features/                # Magic keywords, hooks
src/config/                  # Config loading & merging
src/state/                   # File-based state management
src/hud/                     # Statusline / HUD rendering
keywords.json                # Magic keyword definitions
```

## License

MIT
