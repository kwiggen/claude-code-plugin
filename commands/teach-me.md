---
description: "Pedagogical code walkthrough - teaches you about your own code changes"
argument-hint: "[1|2|3|<PR#>] [--staged] [path/prefix]"
allowed-tools: ["AskUserQuestion"]
effort: high
---

# /teach-me

Run a pedagogical walkthrough using the **teach-me** skill.

## Options
1) Uncommitted changes
2) Last local commit
3) Unpushed local commits
4+) GitHub pull request (pass PR number directly, e.g., `/teach-me 8275`)

## Input
User argument: {{#if $ARGUMENTS}}$ARGUMENTS{{else}}(none provided){{/if}}

> **Template variable:** `$ARGUMENTS` contains any text passed after the command (e.g., `/teach-me 2` sets `$ARGUMENTS` to "2").

**Argument interpretation:**
- `1` → Teach about uncommitted changes
- `2` → Teach about last local commit
- `3` → Teach about unpushed local commits
- Any number > 3 → Treat as a GitHub PR number and teach about that PR
- `--staged` → Only include staged changes (works with scope 1)
- Path prefix (e.g., `src/`) → Filter to files under that path

Arguments can be combined: `/teach-me 3 src/` teaches about unpushed commits filtered to `src/`.

If no argument was provided, default to scope **1** (uncommitted changes). Do NOT prompt the user for scope selection — just proceed with uncommitted changes.

> **Note:** `AskUserQuestion` is available only for scope resolution fallbacks (e.g., no upstream branch for scope 3, invalid PR number). Never use it to ask which scope to use.

## Scope resolution rules
- **1 (Uncommitted):** collect the uncommitted diff/changed files in the working tree.
  - If `--staged` is present, use `git diff --cached` instead of `git diff`.
  - If a path prefix is provided, append it to the diff command.
- **2 (Last commit):** collect the diff for the most recent local commit on the current branch.
- **3 (Unpushed):** collect the combined diff for commits that exist locally but are not pushed to the upstream tracking branch.
  - If no upstream tracking branch exists, ask which remote branch to compare against (e.g., `origin/main`).
- **PR number (>3):** assume the current git repository and fetch the PR with that number.
  - Validate the PR number is a positive integer before use.
  - If validation fails, inform the user and prompt for a valid number.
  - If the repo cannot be determined from git remotes, ask for `owner/repo` as a fallback.

## Execute
Once the code context is gathered:

1. **Collect the diff** — Get the patch/diff for the selected scope.
2. **Read full files** — For new/untracked files, read the entire file. For modified files, read enough context to understand the changes.
3. **Identify file status** — Classify each file as "new" (untracked/added) or "modified" (has a diff against a previous version).
4. **Apply the teach-me skill** — Process all files through the skill's teaching methodology.
5. **Deliver in one pass** — Present the complete walkthrough without interruptions.

Do NOT ask the user questions during the walkthrough. Deliver the full teaching in a single response.
