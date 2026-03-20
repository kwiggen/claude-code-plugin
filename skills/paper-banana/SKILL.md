---
name: paper-banana
description: |
  Generates publication-quality illustrations using a 5-agent pipeline
  inspired by PaperBanana (academic illustration framework). Orchestrates
  specialized agents: Retriever, Planner, Stylist, Visualizer, and Critic.
  Use when users need high-quality, iterative image generation with
  style consistency and quality review.
---

# PaperBanana Pipeline Skill

You are the orchestrator for a 5-agent image generation pipeline. Your role is to coordinate specialized agents that work together to produce publication-quality illustrations.

## Architecture

| Agent | Role | Responsibility |
|-------|------|---------------|
| **retriever** | Reference Scout | Searches codebase and available resources for reference images, examples, and style inspiration matching the requested output |
| **planner** | Content Architect | Converts the user's description into a detailed, structured image specification with composition, elements, and requirements |
| **stylist** | Style Enforcer | Synthesizes style guidelines from references, defines color palette, typography, layout rules, and visual consistency standards |
| **visualizer** | Image Creator | Uses the **image-generator** skill to generate the actual image based on the spec and style guide |
| **critic** | Quality Reviewer | Evaluates output against the specification, provides structured refinement feedback, decides if another iteration is needed |

## Pipeline Flow

```
User Request
    → Retriever (find references)
    → Planner (create spec)
    → Stylist (define style)
    → Visualizer (generate image)
    → Critic (evaluate)
    → [Loop back to Visualizer if needed, max 3 iterations]
    → Final Output
```

## Workflow

### Step 1: Understand the Request

Parse the user's request to extract:
- **Subject**: What needs to be illustrated
- **Purpose**: Where it will be used (blog, docs, presentation, paper)
- **Style hints**: Any style preferences mentioned
- **Constraints**: Size, format, color scheme requirements

If the request is vague, ask 2-3 clarifying questions using AskUserQuestion.

### Step 2: Create the Team

Use `TeamCreate` to create a team named `paper-banana`:

Then create 5 tasks with `TaskCreate` — one for each agent's work:

1. **Retrieve References** — Find relevant visual references and style examples
2. **Create Image Specification** — Write detailed composition and content spec
3. **Define Style Guide** — Create style rules, palette, and visual standards
4. **Generate Image** — Produce the image using the image-generator skill
5. **Review and Critique** — Evaluate quality and provide feedback

Set up dependencies:
- Task 2 (Planner) is blocked by Task 1 (Retriever)
- Task 3 (Stylist) is blocked by Task 1 (Retriever)
- Task 4 (Visualizer) is blocked by Tasks 2 and 3
- Task 5 (Critic) is blocked by Task 4

### Step 3: Spawn Agents

Spawn teammates using the `Task` tool with `team_name: "paper-banana"`:

**Retriever** (general-purpose agent):
```
Search the current project and codebase for visual references, existing images,
or style examples that match: [user request].

Look for:
- Existing images in the project (PNG, JPG, SVG files)
- Style guides or brand guidelines
- Color schemes in CSS/config files
- Similar illustrations in docs/

Return a structured report with:
- Found references (file paths)
- Recommended style direction
- Color palette suggestions
```

**Planner** (general-purpose agent):
```
Create a detailed image specification for: [user request]

Using references from the Retriever, write a spec covering:
- Composition layout (rule of thirds, symmetry, etc.)
- Primary and secondary elements
- Background treatment
- Text placement (if any)
- Required visual elements
- Mood and tone
- Dimensions and aspect ratio
```

**Stylist** (general-purpose agent):
```
Create a style guide for the illustration based on references and spec.

Define:
- Color palette (primary, secondary, accent — hex values)
- Visual style (flat, gradient, 3D, hand-drawn, etc.)
- Line weight and treatment
- Typography style (if text is needed)
- Consistency rules for maintaining visual coherence
- Do's and Don'ts
```

**Visualizer** (general-purpose agent):
```
Generate the image using the image-generator skill.

Use the spec from Planner and style guide from Stylist to create
an enhanced prompt. Then invoke the CLI:

node {pluginDir}/dist/image-gen/cli.js \
  --prompt "[enhanced prompt from spec + style]" \
  --output "[output path]" \
  --size 4K

If reference images were found by the Retriever, include them
with --reference flags.
```

**Critic** (general-purpose agent):
```
Evaluate the generated image against the specification.

Check:
- Does it match the composition spec?
- Does it follow the style guide?
- Is the quality sufficient for the intended purpose?
- Are there artifacts, distortions, or unwanted elements?

Report status using the standard subagent protocol:

| Status | Meaning | Action |
|--------|---------|--------|
| **DONE** | Image meets spec, ready for delivery | Proceed to delivery |
| **DONE_WITH_CONCERNS** | Image is acceptable but has minor issues worth noting | Deliver with notes |
| **NEEDS_CONTEXT** | Cannot evaluate — missing spec, style guide, or reference | Request missing input |
| **BLOCKED** | Fundamental problems — needs a completely new approach | Report to orchestrator |

If status is DONE_WITH_CONCERNS, include specific issues and suggest prompt
adjustments for an optional refinement pass.
```

### Step 4: Monitor and Iterate

- Wait for agents to complete in dependency order
- If Critic returns NEEDS_REVISION, send feedback to Visualizer and regenerate
- Maximum 3 iterations before delivering the best result
- If Critic returns APPROVED, proceed to delivery

### Step 5: Deliver

Present the final result to the user:

> **Image generated**: `[path]`
>
> **Specification**: [brief summary of what was created]
> **Style**: [brief style description]
> **Iterations**: [number of iterations taken]
> **Critic verdict**: [final verdict]
>
> Want me to make any adjustments?

### Step 6: Clean Up

Shut down all teammates and delete the team when done.

## Error Handling

- If Retriever finds no references, proceed with Planner and Stylist using the user's description alone
- If Visualizer fails (API key, rate limit), report the error and suggest fixes
- If Critic rejects after 3 iterations, deliver the best result with a note about limitations
- If any agent fails, report which step failed and offer to retry or adjust

## When to Use This vs /generate-image

- Use `/generate-image` for quick, single-shot image generation
- Use `/paper-banana` when you need:
  - Style consistency with existing project visuals
  - Iterative refinement with quality review
  - Publication-quality output
  - Complex illustrations with multiple elements
