---
description: "Create a GitHub issue and add it to ExamJam V.Next 25 project with Priority, Type, Initiative, and Status"
argument-hint: "[title]"
allowed-tools: ["Bash(git rev-parse:*)", "Bash(gh auth:*)", "Bash(gh issue:*)", "Bash(gh project:*)", "AskUserQuestion"]
---

# /create-issue

Create a GitHub issue in the current repository and add it to the ExamJam V.Next 25 project (project 19) with custom field values.

## Input

Issue title (optional): {{#if $ARGUMENTS}}$ARGUMENTS{{else}}(none provided){{/if}}

> **Template variable:** `$ARGUMENTS` contains any text passed after the command (e.g., `/create-issue Add dark mode support` sets `$ARGUMENTS` to "Add dark mode support").

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

### Step 2: Execute Issue Creator Skill

Using the **issue-creator** skill, perform the following:

1. **Gather issue details** - Get title (from argument or prompt) and description
2. **Fetch project configuration** - Get project ID and field definitions dynamically
3. **Collect field values** - Prompt for Priority, Type, Initiative, and Status
4. **Create the issue** - Use `gh issue create`
5. **Add to project** - Use `gh project item-add`
6. **Set field values** - Use `gh project item-edit` for each field
7. **Confirm success** - Display the issue URL and project assignment details

See the **issue-creator** skill for detailed implementation steps and expected output format.

## Error Handling

| Error | Action |
|-------|--------|
| Not in git repository | Tell user to run from within a git repository |
| Missing project scope | Tell user to run `gh auth refresh -s project` |
| Field not found | List available fields, ask if user wants to continue |
| Project inaccessible | Tell user to verify access to project 19 |
| Issue creation failed | Show gh error message |
