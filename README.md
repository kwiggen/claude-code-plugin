# Claude Code Plugin

A Claude Code plugin for automating GitHub workflows: code reviews, PR creation, team analytics, and release management.

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
- Python 3.11+
- Git repository with GitHub remote


## Commands

### Code Review & PRs

| Command | Description |
|---------|-------------|
| `/review-code` | Run structured code reviews on uncommitted changes, commits, or GitHub PRs |
| `/create-pr [base]` | Create pull requests with AI-generated descriptions |

### Team Analytics

| Command | Description |
|---------|-------------|
| `/team-stats` | Team activity overview (PRs, reviews, contributors) |
| `/team-stats leaderboard` | Top contributors by PRs merged |
| `/team-stats merge-time` | Time-to-merge analysis |
| `/team-stats reviews` | Review participation report |
| `/team-stats size` | PR size analysis with bottleneck detection |
| `/team-stats first-review` | Time to first review per developer |
| `/team-stats balance` | Reviews given vs received ratio |
| `/team-stats reverts` | Track reverts and hotfixes |
| `/team-stats depth` | Detect rubber stamp reviews |
| `/team-stats cycles` | Rounds of feedback before merge |
| `/team-stats all` | Run all reports |

All team-stats commands accept an optional day range: `/team-stats leaderboard 14`

### Release Management

| Command | Description |
|---------|-------------|
| `/release-preview` | What's shipping (run Sunday after release train merges) |
| `/release-retro` | What happened (run Tuesday after prod stabilizes) |

**Release Preview** shows:
- All PRs in the release with size breakdown
- Risk flags (large PRs, quick approvals)
- Hotfixes needing backmerge
- AI-generated release notes

**Release Retro** shows:
- Release timeline and outcome
- Hotfix breakdown (staging vs release)
- 4-week trend analysis
- Action items for pending backmerges

## Skills

| Skill | Used By |
|-------|---------|
| `code-reviewer` | `/review-code` |
| `pr-writer` | `/create-pr` |
| `github-insights` | `/team-stats` |
| `release-reports` | `/release-preview`, `/release-retro` |

## Requirements

- [GitHub CLI](https://cli.github.com/) (`gh`) authenticated
- Python 3.11+
- Git repository with GitHub remote

## Structure

```
.claude-plugin/plugin.json   # Plugin metadata
commands/                    # Slash command definitions
skills/                      # Skill implementations with scripts
```

## License

MIT
