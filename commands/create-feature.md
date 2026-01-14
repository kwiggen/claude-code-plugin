---
description: "Guide feature definition through discussion, generate a 1-pager, and create a GitHub issue"
argument-hint: "[feature-name]"
allowed-tools: ["Bash(git rev-parse:*)", "Bash(gh auth:*)", "Bash(gh issue:*)", "Bash(gh project:*)", "AskUserQuestion"]
---

# /create-feature

Guide the user through defining a feature via adaptive discussion, generate a structured 1-pager as the issue description, and create a GitHub issue in the ExamJam V.Next 25 project.

## Input

Feature name (optional): {{#if $ARGUMENTS}}$ARGUMENTS{{else}}(none provided){{/if}}

> **Template variable:** `$ARGUMENTS` contains any text passed after the command (e.g., `/create-feature Dark mode support` sets `$ARGUMENTS` to "Dark mode support").

## Workflow

### Step 1: Verify Prerequisites

Check that we're in a git repository and gh CLI is authenticated:

```bash
# Verify git repository
git rev-parse --show-toplevel

# Check gh CLI authentication
gh auth status
```

If not in a git repository, inform the user and stop.

If you see an error about missing `project` scope, inform the user to run:
```bash
gh auth refresh -s project
```

### Step 2: Execute Feature Writer Skill

Using the **feature-writer** skill:

1. **Conduct adaptive discussion** to understand the feature
2. **Generate a 1-pager** with Problem Statement, Proposed Solution, and Key Features
3. **Review and refine** until the user is satisfied

See the **feature-writer** skill for detailed guidance on adaptive discussion.

### Step 3: Create GitHub Issue

Once the 1-pager is confirmed, use the **issue-creator** patterns to:

1. Create the issue with feature name as title and 1-pager as body
2. Add to project 19 (ExamJam V.Next 25)
3. Set Type = Feature (automatic)
4. Prompt for Priority (P0-P3)
5. Prompt for Initiative (dynamic options from project)
6. Prompt for Status (dynamic options from project)

## Output Format

After creating the issue, display:

```markdown
## Feature Issue Created

**Title:** <feature-name>
**URL:** <issue-url>

**Project Assignment:**
- Added to: ExamJam V.Next 25 (Project #19)
- Type: Feature
- Priority: <selected-priority>
- Initiative: <selected-initiative>
- Status: <selected-status>
```

## Error Handling

| Error | Action |
|-------|--------|
| Not in git repository | Tell user to run from within a git repository |
| Missing project scope | Tell user to run `gh auth refresh -s project` |
| User cancels during discussion | Acknowledge and stop without creating issue |
| Field not found | List available fields, ask if user wants to continue |
| Issue creation failed | Show gh error message |
