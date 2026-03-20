---
description: "Validate plans, proposals, roadmaps, or architecture with parallel team analysis"
argument-hint: "[plan description, @file, or topic]"
allowed-tools: ["AskUserQuestion", "Task", "TeamCreate", "TeamDelete", "TaskCreate", "TaskUpdate", "TaskList", "SendMessage"]
effort: max
---

# /validate

Stress-test any plan, proposal, roadmap, or architecture with structured parallel analysis and deliver an 8-section validation report.

## Input

What to validate: {{#if $ARGUMENTS}}$ARGUMENTS{{else}}(none provided){{/if}}

> **Template variable:** `$ARGUMENTS` contains any text passed after the command (e.g., `/validate our Q3 migration plan` sets `$ARGUMENTS` to "our Q3 migration plan").

If no argument was provided, use AskUserQuestion to ask what they'd like validated:
- Option 1: "A plan or roadmap" - Validate timeline, scope, and feasibility
- Option 2: "An architecture or design" - Validate technical approach and trade-offs
- Option 3: "A proposal or decision" - Validate reasoning and assumptions

Then ask them to describe or paste the content.

## Workflow

### Step 1: Gather the Plan

Collect the material to validate:
- If `$ARGUMENTS` references a file (starts with `@` or looks like a path), read that file
- If `$ARGUMENTS` contains inline text, use it directly
- If the plan is vague or short (under ~50 words), ask 2-3 clarifying questions:
  - What's the goal or desired outcome?
  - What's the timeline and team size?
  - What constraints exist (budget, tech stack, dependencies)?

### Step 2: Decide — Team or Solo

**Use Agent Team** (default for substantive plans):
- Plan has multiple components, phases, or workstreams
- Plan is longer than a few sentences
- Plan involves timeline, budget, team, or architecture decisions

**Use Solo validation** (for quick questions):
- Simple "should we use X or Y?" questions
- Single-dimension validation (just timeline, just tech choice)
- Plan is a single sentence or very focused

### Step 3a: Team Validation (Default)

Create an Agent Team with 2 specialized teammates working in parallel:

**Teammate 1 — "assumption-challenger"**
- Type: general-purpose agent
- Instructions: Apply the **assumption-challenger** skill against the plan
- Goal: Find all implicit assumptions (timeline, resource, technical, business, external), stress-test each, and rate as valid/questionable/invalid
- Return: Structured assumption analysis with verdicts

**Teammate 2 — "antipattern-scout"**
- Type: general-purpose agent
- Instructions: Apply the **antipattern-detector** skill against the plan
- Goal: Scan for failure patterns across 5 categories (architecture, timeline, team, process, technology), rate severity, identify pattern combinations
- Return: Structured anti-pattern analysis with severity ratings

Both teammates receive the full plan text. They work in parallel.

### Step 3b: Solo Validation (Quick)

If the plan is simple, skip the team. Apply all three skills yourself sequentially:
1. Run **assumption-challenger** skill (brief version — top 3 assumptions)
2. Run **antipattern-detector** skill (brief version — top patterns only)
3. Synthesize with **validator** skill

### Step 4: Synthesize Report

Once both teammates return (or solo analysis is done), apply the **validator** skill to synthesize everything into the 8-section validation report:

1. **Verdict**: GOOD / NEEDS MAJOR WORK / BAD (with confidence level)
2. **What You Got Right**: 2-3 genuine strengths
3. **Critical Flaws**: Each with impact and consequence
4. **What You're Not Considering**: Blindspots and hidden assumptions
5. **The Real Question**: Reframe if solving wrong problem
6. **What Bulletproof Looks Like**: Measurable success criteria
7. **Recommended Path Forward**: Concrete next steps
8. **Questions to Answer First**: Information gaps

### Step 5: Deliver

Present the full 8-section report. End with:

> Want me to dig deeper into any section, or validate a revised version?

## What This Works On

- Project roadmaps and timelines
- Architecture proposals and designs
- Build vs buy decisions
- Migration strategies
- Team structure changes
- Business plans and strategies
- Feature proposals and PRDs
- Budget and resource plans
- Any plan where assumptions matter
