---
description: "Generate publication-quality illustrations using a 5-agent pipeline"
argument-hint: "[description of illustration needed]"
allowed-tools: ["Task", "TeamCreate", "TeamDelete", "TaskCreate", "TaskUpdate", "TaskList", "SendMessage", "AskUserQuestion", "Bash(node:*)", "Bash(test:*)", "Bash(mkdir:*)", "Bash(ls:*)", "Bash(npm:*)"]
---

# /paper-banana

Generate a publication-quality illustration using the **paper-banana** skill's 5-agent pipeline.

## Input

Illustration request: {{#if $ARGUMENTS}}$ARGUMENTS{{else}}(none provided){{/if}}

> **Template variable:** `$ARGUMENTS` contains any text passed after the command (e.g., `/paper-banana a system architecture diagram` sets `$ARGUMENTS` to "a system architecture diagram").

If no argument was provided, use AskUserQuestion to ask what they need:
- Option 1: "Architecture diagram" - System design, component relationships
- Option 2: "Concept illustration" - Abstract ideas, metaphors, editorial style
- Option 3: "Technical figure" - Charts, workflows, data visualization
- Option 4: "Other" - Describe what you need

Then ask them to describe the illustration in detail.

## Execute

Apply the **paper-banana** skill:

1. Parse the user's request
2. Create the agent team with 5 specialized roles
3. Run the pipeline: Retriever → Planner → Stylist → Visualizer → Critic
4. Iterate based on Critic feedback (max 3 rounds)
5. Deliver the final result
6. Clean up the team

## Plugin Directory

The plugin directory containing `dist/image-gen/cli.js` is the directory where this command file lives, one level up from `commands/`. Pass this to the Visualizer agent so it can invoke the CLI.
