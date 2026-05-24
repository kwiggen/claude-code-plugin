---
description: "Stress-test a plan or design with relentless interviewing"
argument-hint: "[plan description, @file, or topic]"
allowed-tools: ["AskUserQuestion", "Agent", "Bash", "Read", "Glob", "Grep"]
effort: max
---

# /grill-me

Run a relentless design interview using the **grill-me** skill.

## Input

What to grill: {{#if $ARGUMENTS}}$ARGUMENTS{{else}}(none provided){{/if}}

> **Template variable:** `$ARGUMENTS` contains any text passed after the command (e.g., `/grill-me our caching strategy` sets `$ARGUMENTS` to "our caching strategy").

If no argument was provided, use AskUserQuestion to ask what they'd like grilled:
- Option 1: "A design or architecture" - Stress-test technical decisions and trade-offs
- Option 2: "A plan or roadmap" - Challenge timeline, scope, and feasibility
- Option 3: "A proposal or RFC" - Probe reasoning, assumptions, and alternatives

Then ask them to describe or paste the content.

## Gathering Context

Before starting the interview:

1. **If `$ARGUMENTS` references a file** (starts with `@` or looks like a path), read that file
2. **If `$ARGUMENTS` contains inline text**, use it as the subject
3. **Read CLAUDE.md files** and relevant codebase context to inform your questions
4. **Explore the codebase** proactively — understand the existing architecture, patterns, and constraints so your questions are grounded in reality, not hypotheticals

## Execute

Apply the **grill-me** skill:

1. Map the decision tree for the subject
2. Begin the interview — one question at a time, depth-first
3. For each question, explore the codebase first if possible, then provide your recommended answer
4. Track resolved vs. open branches
5. Continue until all branches are resolved or the user ends the session
6. Deliver the Decision Summary
