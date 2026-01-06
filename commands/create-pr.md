---
description: "Create a PR with an AI-generated best-in-class description based on commits"
argument-hint: "[base-branch]"
allowed-tools: ["Bash(git:*)", "Bash(gh pr create:*)", "Bash(gh pr view:*)", "AskUserQuestion"]
---

# /create-pr

Create a pull request with an AI-generated, industry best-in-class description.

## Input

Base branch (optional): {{#if $ARGUMENTS}}$ARGUMENTS{{else}}develop{{/if}}

> **Template variable:** `$ARGUMENTS` contains any text passed after the command (e.g., `/create-pr main` sets `$ARGUMENTS` to "main"). If empty, defaults to "develop".

## Workflow

### Step 1: Verify Prerequisites

Check the current state:

```bash
# Current branch
git branch --show-current

# Check for unpushed commits (handles missing upstream gracefully)
git log @{upstream}..HEAD --oneline 2>/dev/null || git log origin/develop..HEAD --oneline 2>/dev/null || echo "No upstream branch found"

# Check for uncommitted changes
git status --porcelain
```

**If on main/master/develop:**
- Ask user for a branch name or suggest one based on the changes
- Create and checkout the new branch

**If there are uncommitted changes:**
- Ask user if they want to commit them first or proceed with only pushed commits

**If no unpushed commits exist:**
- Inform user there's nothing to create a PR for

### Step 2: Gather Commit Information

Collect all information needed for the PR description:

```bash
# Get the base branch (use argument or default to develop)
BASE_BRANCH="${BASE_BRANCH:-develop}"

# List commits that will be in the PR
git log origin/$BASE_BRANCH..HEAD --pretty=format:"%h %s"

# Get the full diff stats
git diff origin/$BASE_BRANCH...HEAD --stat

# Get the detailed diff for analysis
git diff origin/$BASE_BRANCH...HEAD
```

### Step 3: Analyze and Generate PR Content

Using the **pr-writer** skill, analyze the commits and generate:

1. **PR Title** - Following conventional commits format:
   - Determine the primary type (feat, fix, refactor, etc.)
   - Identify the scope (module, feature area)
   - Write a concise description

2. **PR Description** - Following the best-in-class template:
   - Summary (2-3 sentences)
   - Motivation (why this change)
   - Changes (bullet list)
   - Testing (how to verify)
   - Related Issues (if mentioned in commits)
   - Breaking Changes (if any)

### Step 4: Push and Create PR

```bash
# Push the branch (with upstream tracking)
git push -u origin $(git branch --show-current)

# Create the PR
gh pr create --base $BASE_BRANCH --title "<generated-title>" --body "<generated-body>"
```

### Step 5: Return the PR URL

After creating the PR, display:
- The PR URL
- A summary of what was included

## PR Description Format

Generate the description following this structure:

```markdown
## Summary

<2-3 sentences explaining what changed>

## Motivation

<Why this change is needed>

## Changes

- <Key change 1>
- <Key change 2>
- <Key change 3>

## Testing

- [ ] Unit tests pass
- [ ] <Specific testing performed>

## Related Issues

<Any issues referenced in commits>

---
Generated with [Claude Code](https://claude.ai/code)

@summon-the-kraken
```

## Examples

### Simple Bug Fix

**Commits:**
```
abc1234 fix null pointer in user service
def5678 add test for null case
```

**Generated Title:** `fix(user): handle null pointer in user service`

**Generated Description:**
```markdown
## Summary

Fix a null pointer exception that occurred when the user service received an empty response.
Added defensive null checking and a corresponding unit test.

## Motivation

Users were experiencing crashes when their profile failed to load due to network issues.
This fix ensures graceful handling of missing data.

## Changes

- Add null check in UserService.getProfile()
- Add unit test covering null response scenario

## Testing

- [ ] Unit tests pass
- [ ] Manual testing with network disabled
```

### Feature Addition

**Commits:**
```
111aaaa feat: add dark mode toggle
222bbbb feat: implement theme context
333cccc feat: persist theme preference
444dddd test: add theme toggle tests
```

**Generated Title:** `feat(ui): add dark mode toggle with preference persistence`

**Generated Description:**
```markdown
## Summary

Add a dark mode toggle to the application settings that persists user preferences
across sessions. Implements a theme context provider for global theme state management.

## Motivation

Users have requested dark mode support for better visibility in low-light conditions
and reduced eye strain during extended use.

## Changes

- Add ThemeContext provider for global theme state
- Implement dark mode toggle component in Settings
- Persist theme preference to localStorage
- Add comprehensive unit tests for theme functionality

## Testing

- [ ] Unit tests pass (4 new tests added)
- [ ] Manual testing of toggle functionality
- [ ] Verified preference persists across browser refresh

## Screenshots

<Add before/after screenshots here>
```

## Error Handling

- If `gh` CLI is not authenticated, prompt user to run `gh auth login`
- If push fails due to upstream issues, provide guidance
- If PR creation fails, show the error and suggest manual creation
