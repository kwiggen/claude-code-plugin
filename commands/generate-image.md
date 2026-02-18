---
description: "Generate images using Gemini (Nano Banana) with AI-enhanced prompts"
argument-hint: "[prompt or reference-image + prompt]"
allowed-tools: ["Bash(node:*)", "Bash(test:*)", "Bash(mkdir:*)", "Bash(ls:*)", "Bash(npm:*)", "AskUserQuestion"]
---

# /generate-image

Generate an image using the **image-generator** skill with Gemini's image generation models.

## Input

User request: {{#if $ARGUMENTS}}$ARGUMENTS{{else}}(none provided){{/if}}

> **Template variable:** `$ARGUMENTS` contains any text passed after the command (e.g., `/generate-image a sunset over mountains` sets `$ARGUMENTS` to "a sunset over mountains").

If no argument was provided, use AskUserQuestion to ask what they'd like to generate:
- Option 1: "Text to image" - Describe what you want to create
- Option 2: "Image to image" - Provide a reference image and describe modifications
- Option 3: "Quick concept" - Fast draft for iteration

## Execute

Apply the **image-generator** skill:

1. Check prerequisites (API key, built CLI)
2. Parse the user's request for intent (text-to-image vs image-to-image)
3. If image-to-image, identify the reference image path in the request
4. Enhance the prompt using the 6-element formula
5. Show the enhanced prompt
6. Generate using the CLI
7. Present the result and offer iteration

## Plugin Directory

The plugin directory containing `dist/image-gen/cli.js` is the directory where this command file lives, one level up from `commands/`. Use this to construct the CLI path.
