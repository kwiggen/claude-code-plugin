---
description: "Show team GitHub activity - PRs, reviews, merge times, bottlenecks, quality signals"
argument-hint: "[action] [days]"
allowed-tools: ["Bash(python:*)", "Bash(gh:*)"]
---

# /team-stats

Show team GitHub activity for the current repository.

## Input

Arguments: {{#if $ARGUMENTS}}$ARGUMENTS{{else}}(none){{/if}}

## Argument Parsing

Parse `$ARGUMENTS` to determine action and time range:

| Pattern | Action | Days |
|---------|--------|------|
| `prs` or `prs N` | prs-merged | N or 30 |
| `leaderboard` or `leaderboard N` | leaderboard | N or 30 |
| `activity` or `activity N` | activity | N or 30 |
| `merge-time` or `merge-time N` | time-to-merge | N or 30 |
| `reviews` or `reviews N` | reviews | N or 30 |
| `size` or `size N` | pr-size | N or 30 |
| `first-review` or `first-review N` | first-review | N or 30 |
| `balance` or `balance N` | review-balance | N or 30 |
| `reverts` or `reverts N` | reverts | N or 30 |
| `depth` or `depth N` | review-depth | N or 30 |
| `cycles` or `cycles N` | review-cycles | N or 30 |
| Just a number (e.g., `7`) | activity | N |
| Empty | activity | 30 |

**Examples:**
- `/team-stats` → activity for last 30 days
- `/team-stats 7` → activity for last 7 days
- `/team-stats prs` → PRs merged in last 30 days
- `/team-stats leaderboard 14` → leaderboard for last 14 days
- `/team-stats merge-time` → time-to-merge analysis
- `/team-stats reviews` → review participation report
- `/team-stats size` → PR size analysis with bottleneck detection
- `/team-stats first-review` → time to first review per developer
- `/team-stats balance` → reviews given vs received ratio
- `/team-stats reverts` → track reverts and hotfixes
- `/team-stats depth` → detect rubber stamp reviews
- `/team-stats cycles` → rounds of feedback before merge

## Execution

1. Parse arguments to determine action and days
2. Run the github-insights skill script:

```bash
python {baseDir}/skills/github-insights/scripts/gh_stats.py --action <ACTION> --days <DAYS>
```

3. Display the output directly (it's already formatted as markdown)

## Error Handling

- If not in a git repo: inform user to navigate to a repository
- If `gh` not authenticated: suggest running `gh auth login`
- If no PRs found: report the empty result with the time range searched
