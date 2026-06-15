---
description: "Test-driven development with vertical slices"
argument-hint: "[feature or behavior to build]"
allowed-tools: ["Bash", "Read", "Edit", "Write", "Glob", "Grep", "AskUserQuestion"]
effort: high
---

# /tdd

Build or test a feature using vertical-slice test-driven development via the **tdd** skill.

## Input

What to build test-first: {{#if $ARGUMENTS}}$ARGUMENTS{{else}}(none provided){{/if}}

If no argument was provided, use AskUserQuestion to ask what they'd like to build:
- Option 1: "A new feature" - Build something new with tests leading the way
- Option 2: "Add tests to existing code" - Cover existing behavior with tests first, then improve
- Option 3: "Fix a bug test-first" - Write a failing test for the bug, then fix it

## Gathering Context

Before starting:

1. **Read CLAUDE.md** and understand project conventions
2. **Find existing tests** — `find . -name "*.test.*" -o -name "*.spec.*" -o -name "__tests__"` — understand the testing framework, patterns, and conventions already in use
3. **Identify the test runner** — check package.json scripts, Makefile, or similar
4. **Read the code under test** (or where the new code will live) to understand the public interface
5. **If CONTEXT.md exists**, read it for domain terminology

## Execute

Apply the **tdd** skill:

1. Identify the behaviors to test — list them as plain-English specifications
2. Confirm the list with the user: "Here are the behaviors I'll build. Want to adjust?"
3. Execute the vertical slice loop: RED (one failing test) -> GREEN (minimal code) -> REFACTOR (clean up)
4. One complete cycle before starting the next behavior
5. Run the full test suite after completing all cycles
6. Report: what behaviors are covered, what the test names read as (the specification)
