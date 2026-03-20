---
description: "Dual code review from Claude + Gemini. Pass 1-3 for local changes or a PR number directly."
argument-hint: "1|2|3|<PR#>"
allowed-tools: ["AskUserQuestion", "Bash(node:*)", "Bash(gh pr comment:*)", "Bash(git:*)", "Bash(echo:*)"]
effort: high
---

# /gemini-review

Run a dual code review using both Claude and the **gemini-reviewer** skill.

## Options
1) Uncommitted changes
2) Last local commit
3) Unpushed local commits
4+) GitHub pull request (pass PR number directly, e.g., `/gemini-review 8275`)

## Input
User argument: {{#if $ARGUMENTS}}$ARGUMENTS{{else}}(none provided){{/if}}

> **Template variable:** `$ARGUMENTS` contains any text passed after the command (e.g., `/gemini-review 2` sets `$ARGUMENTS` to "2").

**Argument interpretation:**
- `1` → Review uncommitted changes
- `2` → Review last local commit
- `3` → Review unpushed local commits
- Any number > 3 → Treat as a GitHub PR number and review that PR

If no argument was provided, use the AskUserQuestion tool to prompt the user with these choices:
- Option 1: "Uncommitted changes" - Review working tree changes not yet committed
- Option 2: "Last local commit" - Review the most recent commit on current branch
- Option 3: "Unpushed local commits" - Review all commits ahead of upstream
- Option 4: "GitHub pull request" - Review a PR (will ask for PR number)

## Scope resolution rules
- **1 (Uncommitted):** collect the uncommitted diff/changed files in the working tree.
- **2 (Last commit):** collect the diff for the most recent local commit on the current branch.
- **3 (Unpushed):** collect the combined diff for commits that exist locally but are not pushed to the upstream tracking branch.
  - If no upstream tracking branch exists, ask which remote branch to compare against (e.g., `origin/main`).
- **PR number (>3):** assume the current git repository and fetch the PR with that number.
  - Validate the PR number is a positive integer before use
  - If validation fails, inform the user and prompt for a valid number
  - If the repo cannot be determined from git remotes, ask for `owner/repo` as a fallback.

## Execute
Once the diff is gathered, apply the **gemini-reviewer** skill to perform a dual review from both Claude and Gemini, producing the synthesis output format.

## Post to GitHub (Option 4 only)

After completing the review for a GitHub PR, ask the user:

> "Post this review to the PR?"

1) Post full review
2) Post summary only
3) Don't post

### Comment formatting

When posting to GitHub (options 1 or 2), format the comment as:

```markdown
## Dual Code Review (Claude + Gemini)

<Synthesis section>

### Claude's Findings
<Key findings>

### Gemini's Findings
<Key findings>

### Recommended Next Steps
<Action items – omit for option 2>

```

Use `gh pr comment <PR_NUMBER> --body "$(cat <<'EOF' ... EOF)"` to post.
