---
description: "Show what's shipping - run Sunday after release train is merged"
argument-hint: "[days]"
allowed-tools: ["Bash(python:*)", "Bash(gh:*)"]
---

# /release-preview

Generate a release preview report showing what's shipping in the upcoming release.

## When to Run

Run this **Sunday evening** after the release train PR (develop → staging) is merged.

## Input

Arguments: {{#if $ARGUMENTS}}$ARGUMENTS{{else}}(none){{/if}}

## Argument Parsing

| Pattern | Days Lookback |
|---------|---------------|
| Empty | 30 |
| Number (e.g., `60`) | N |

## Execution

```bash
python {baseDir}/skills/release-reports/scripts/release_reports.py --action preview --days <DAYS>
```

## What It Shows

- **Release Train**: The develop → staging PR that triggered this release
- **Feature PRs**: All PRs in this release (merged to develop since last train)
- **Risk Flags**:
  - Large PRs (500+ lines)
  - Quick approvals (<5 min with no comments)
- **Hotfixes needing backmerge**: From previous cycle
- **Monday QA Focus**: Areas to watch

## Error Handling

- If no release train found: inform user to run after develop → staging is merged
- If `gh` not authenticated: suggest running `gh auth login`

## Output Instructions

**IMPORTANT**: Display the script output VERBATIM to the user. Do NOT summarize, paraphrase, or reformat the output. The report contains markdown tables and formatting that should be shown exactly as produced. Simply run the command and show the complete raw output.
