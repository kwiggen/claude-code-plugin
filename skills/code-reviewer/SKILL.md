---
name: code-reviewer
description: |
  Reviews code for logic flaws, edge cases, performance bottlenecks,
  security vulnerabilities, maintainability concerns, architecture best practices,
  and adherence to local patterns and CLAUDE.md guidelines. Use when users ask
  for code review or analysis, including reviewing uncommitted changes, the last
  local commit, unpushed code, or a specific GitHub pull request.
---

# Code Reviewer Skill

## Before Reviewing

1. **Gather context** – Read related files to understand existing patterns,
   naming conventions, and architectural decisions in the codebase.
2. **Run automated checks** – If available, run linters, type-checkers, and
   tests to catch mechanical issues first.
3. **Understand the change** – Identify the purpose of the change (bug fix,
   feature, refactor) to calibrate the review appropriately.
4. **Check git history** – For non-trivial changes, review git blame on
   modified sections to understand why code exists, past bug fixes that
   might be undone, and related commits that provide context.

## Evaluation Criteria

Review the code against these categories:

1. **Correctness** – Logic bugs, incorrect assumptions, unhandled edge cases,
   race conditions, error handling gaps.
2. **Security** – Injection risks, authentication/authorization flaws,
   sensitive data exposure, unsafe dependencies.
3. **Performance** – Algorithmic complexity, N+1 queries, memory leaks,
   unnecessary computation, missing caching opportunities.
4. **Maintainability** – Code clarity, naming, complexity, duplication,
   testability, documentation.
5. **Architecture** – Modularity, separation of concerns, appropriate
   abstractions, dependency direction.
6. **Testing** – Test coverage for new code, test quality, edge case coverage.
7. **Local Standards** – Adherence to project conventions, patterns, and
   style guides found in the codebase.
8. **Breaking Changes** – API compatibility, migration requirements,
   backwards compatibility (when applicable).
9. **CLAUDE.md Compliance** – Check changes against CLAUDE.md files in:
   - Repository root
   - Directories containing modified files
   - Parent directories of modified files

   Only flag violations explicitly stated in CLAUDE.md. Quote the guideline when flagging.

## Output Format

### Summary
Brief overview of the change quality and key concerns.

### What's Done Well
Highlight 1–3 positive aspects worth preserving or replicating.

### Findings
Organize findings by severity (only report issues with confidence ≥50):

- **🔴 Critical (confidence%)** – Must fix before merge (security, data loss, crashes)
- **🟠 Major (confidence%)** – Should fix, significant quality/maintainability impact
- **🟡 Minor (confidence%)** – Suggested improvements, lower priority
- **⚪ Nit (confidence%)** – Style preferences, optional polish

For each finding include:
- File and line reference (e.g., `src/auth.ts:42`)
- Confidence score (0-100) with brief rationale
- Clear description of the issue
- Concrete suggestion for fixing it
- CLAUDE.md reference if applicable (quote the specific guideline)

**Confidence scale:**
- **90-100**: Verified real issue, will cause problems in practice
- **70-89**: Likely real issue, worth fixing
- **50-69**: Possibly real, author should evaluate
- **Below 50**: Do not report – too uncertain

### Pre-existing Issues Worth Noting
(Optional) Issues spotted that predate this change – for awareness only.

### Recommended Next Steps
Prioritized action items for the author.

## What NOT to Flag

Avoid false positives by NOT flagging:
- Pre-existing issues not introduced by this change
- Issues that linters, type-checkers, or tests will catch
- Pedantic nitpicks a senior engineer wouldn't mention
- General code quality concerns (unless explicitly required in CLAUDE.md)
- Issues with lint ignore comments or explicit suppressions
- Changes in functionality that are clearly intentional
- Issues on lines the author didn't modify in this change

## Scope of Review

- Focus ONLY on code that was added or modified in this change
- If you spot a pre-existing issue, note it separately under "Pre-existing
  Issues Worth Noting" but do NOT include in the main findings
- When in doubt whether an issue is new or pre-existing, check the diff
  carefully – if the line wasn't touched, don't flag it

## Guidelines

- Focus primarily on the changed code, but flag systemic issues if they
  impact the change.
- Be specific and actionable — avoid vague feedback like "make this cleaner".
- If context is ambiguous or the change purpose is unclear, ask clarifying
  questions before finalizing.
- Calibrate depth to change size: small fixes get lighter review, large
  features get thorough analysis.
