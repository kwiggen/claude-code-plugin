---
description: "Ask Gemini for a second opinion on any file, topic, or question"
argument-hint: "[file, topic, or question]"
allowed-tools: ["Bash(node:*)", "Bash(cat:*)"]
effort: medium
---

# /ask-gemini

Get Gemini's independent opinion using the **gemini-advisor** skill.

## Input
User argument: {{#if $ARGUMENTS}}$ARGUMENTS{{else}}(none provided){{/if}}

> **Template variable:** `$ARGUMENTS` contains any text passed after the command (e.g., `/ask-gemini src/auth.ts` or `/ask-gemini should we use Redis or Memcached?`).

**Argument interpretation:**
- If the argument looks like a file path → read the file and ask Gemini to review/analyze it
- If the argument is a question → pass it to Gemini as-is with relevant project context
- If no argument is provided → ask the user what they'd like Gemini's opinion on

## Execute
Apply the **gemini-advisor** skill to get Gemini's perspective and present it alongside Claude's commentary.
