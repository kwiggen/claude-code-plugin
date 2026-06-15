---
description: "Structured debugging — reproduce first, guess never"
argument-hint: "[bug description, error message, or failing test]"
allowed-tools: ["Bash", "Read", "Edit", "Write", "Glob", "Grep", "AskUserQuestion"]
effort: high
---

# /diagnose

Debug a problem methodically using the **diagnose** skill. No guessing.

## Input

The bug: {{#if $ARGUMENTS}}$ARGUMENTS{{else}}(none provided){{/if}}

If no argument was provided, use AskUserQuestion to ask:
- Option 1: "A failing test or error" - Something that's broken and needs fixing
- Option 2: "Unexpected behavior" - The code runs but does the wrong thing
- Option 3: "Intermittent failure" - Something that fails sometimes but not always

Then ask them to describe what they're seeing (error message, expected vs actual, steps to reproduce).

## Gathering Context

Before starting the diagnosis:

1. **Read CLAUDE.md** and relevant codebase context
2. **If an error message or stack trace was provided**, read the files referenced in it
3. **Check recent changes** — `git log --oneline -10` and `git diff` — did something just change?
4. **If CONTEXT.md exists**, read it for domain context that may inform the diagnosis

## Execute

Apply the **diagnose** skill:

1. **Build a feedback loop** — establish a fast, deterministic way to trigger the bug
2. **Reproduce** — confirm the bug appears and matches the description
3. **Minimize** — shrink the reproduction to the smallest case
4. **Hypothesize** — generate 3-5 ranked hypotheses before changing any code
5. **Instrument** — test the top hypothesis, one variable at a time
6. **Fix** — write a regression test, then apply the minimal fix
7. **Cleanup** — remove all debug instrumentation, run the full suite

If reproduction fails, say so explicitly and escalate to the user with what was tried.
