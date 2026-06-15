---
description: "Convert markdown to portable, shareable HTML"
argument-hint: "[file.md | topic] [--template report|review|briefing] [--tabs|--no-tabs]"
allowed-tools: ["Bash(node *)", "Bash(open *)", "Bash(cat *)", "Read", "Write"]
---

# /publish

Convert markdown content to a self-contained, portable HTML document with syntax highlighting and optional tabbed navigation. Apply the **publish** skill.

## Input

User argument: {{#if $ARGUMENTS}}$ARGUMENTS{{else}}(none provided){{/if}}

## Determine Mode

Parse the user's argument to determine the mode:

1. **File path** — argument ends in `.md` or is a path to an existing file → convert that file
2. **Content generation** — argument is a topic, question, or description → generate markdown first, then convert
3. **No argument** — ask the user what they want to publish

## Template Selection

If `--template` is specified, use it. Otherwise, infer from context:
- Release reports, metrics, analytics → `report`
- Code reviews, diffs, technical walkthroughs → `review`
- Stakeholder summaries, exec updates → `briefing`
- Everything else → `default`

## Execute

### For file conversion:

1. Read the markdown file
2. Determine the output path (same directory, `.html` extension)
3. Run the publish CLI:
   ```bash
   node {pluginDir}/dist/publish/cli.js --input "path/to/file.md" --output "path/to/file.html" --template <template>
   ```
4. Parse the JSON result
5. Open the HTML: `open path/to/file.html`

### For content generation:

1. **Gather context** — read relevant files, git history, project state
2. **Write structured markdown** following the publish skill's writing guidelines:
   - Clear H1 title
   - 3–6 H2 sections (for tab support)
   - Tables for data, blockquotes for takeaways
   - Prose aimed at the target audience
3. **Write the markdown** to a file in the current directory (e.g., `<topic-slug>.md`)
4. **Convert to HTML:**
   ```bash
   node {pluginDir}/dist/publish/cli.js --input "<topic-slug>.md" --output "<topic-slug>.html" --template <template>
   ```
5. **Parse the JSON result and open:** `open <topic-slug>.html`

## Report

After conversion, report:
- Output file path
- Template used
- Whether tabs are active
- Section count and word count
