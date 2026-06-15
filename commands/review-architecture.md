---
description: "Review architecture for deepening opportunities"
argument-hint: "[area, module, or path to focus on]"
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "AskUserQuestion", "Agent"]
effort: max
---

# /review-architecture

Review codebase architecture using the **architecture-review** skill.

## Input

Focus area: {{#if $ARGUMENTS}}$ARGUMENTS{{else}}(none provided — will review the whole codebase){{/if}}

If no argument was provided, review the entire codebase. If an argument was provided, focus the review on that area but note cross-cutting concerns.

## Gathering Context

Before starting:

1. **Read CLAUDE.md** and any existing architecture docs
2. **If CONTEXT.md exists**, read it for domain terminology and prior architectural decisions
3. **Check for ADRs** in `docs/adr/` — understand decisions already made
4. **Walk the directory structure** to understand the high-level organization
5. **If a specific area was given**, read the files in that area and their immediate dependencies

## Execute

Apply the **architecture-review** skill:

1. Walk the codebase organically — note friction points, tangled dependencies, shallow modules
2. Apply the deletion test to suspect modules
3. Classify dependencies for each candidate
4. Present numbered deepening opportunities ranked by leverage
5. Wait for the user to pick which to explore
6. Enter a grilling conversation about the interface design for the chosen candidate
7. Only write code after the design conversation resolves
