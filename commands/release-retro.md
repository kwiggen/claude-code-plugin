---
description: "Show what happened - run Tuesday after prod stabilizes"
argument-hint: "[days]"
allowed-tools: ["Bash(python:*)", "Bash(gh:*)"]
---

# /release-retro

Generate a release retrospective report showing what happened during the release.

## When to Run

Run this **Tuesday morning** after production has been stable.

## Input

Arguments: {{#if $ARGUMENTS}}$ARGUMENTS{{else}}(none){{/if}}

## Argument Parsing

| Pattern | Days Lookback |
|---------|---------------|
| Empty | 30 |
| Number (e.g., `60`) | N |

## Execution

```bash
python {baseDir}/skills/release-reports/scripts/release_reports.py --action retro --days <DAYS>
```

## What It Shows

- **Timeline**: Staging date, prod date
- **Outcome**: Clean release or hotfixes required
- **What Shipped**: PRs, contributors, lines changed
- **Hotfixes During QA**: Direct PRs to staging with backmerge status
- **Trend**: Last 4 releases showing pattern

## Error Handling

- If no release train found: inform user to run after develop → staging is merged
- If promotion pending: show partial report
- If `gh` not authenticated: suggest running `gh auth login`
