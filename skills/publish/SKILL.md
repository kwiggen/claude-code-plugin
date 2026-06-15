---
name: publish
description: |
  Convert markdown to portable, shareable HTML documents with syntax highlighting
  and optional tabbed navigation. Use when users say "publish", "make HTML",
  "make this shareable", "create a document for the team", or want to share
  output with non-technical audiences.
---

# Publish Skill

## CLI Usage

Convert a markdown file to a self-contained HTML document:

```bash
node {pluginDir}/dist/publish/cli.js \
  --input file.md \
  --output file.html \
  --template default \
  --title "Document Title"
```

Or pipe markdown via stdin:

```bash
echo "# Title\n\nContent" | node {pluginDir}/dist/publish/cli.js --output file.html
```

### Flags

| Flag | Description |
|---|---|
| `--input path` | Input markdown file |
| `--output path` | Output HTML file path (required) |
| `--template name` | `default`, `report`, `review`, or `briefing` |
| `--title "text"` | Override document title (default: first H1) |
| `--tabs` | Force tabbed interface |
| `--no-tabs` | Force single-page layout |

### Output

JSON to stdout:
```json
{ "success": true, "outputPath": "/path/to/file.html", "title": "...", "template": "...", "tabbed": true, "sectionCount": 4, "wordCount": 1200 }
```

## Templates

| Template | Best for | Tabs default |
|---|---|---|
| `default` | General prose, summaries | Off |
| `report` | Release reports, metrics, team stats | On (3+ sections) |
| `review` | Code reviews, diff walkthroughs | On (3+ sections) |
| `briefing` | Stakeholder summaries, larger font | Off |

## Tab Behavior

Tabs activate automatically when the template defaults to tabs AND the document has 3+ H2 sections. Each H2 heading becomes a tab label. Override with `--tabs` or `--no-tabs`.

For print and no-JS contexts, all tab panels display as stacked sections.

## Writing Content for Publishing

When generating markdown that will be published:

- **Use H2 headings** for major sections — they become tabs in report/review templates
- **Aim for 3–6 H2 sections** for optimal tab layout
- **Use tables** for comparative or structured data
- **Use blockquotes** for key takeaways or executive summaries
- **Keep paragraphs to 3–4 sentences** — shorter reads better in HTML
- **Match audience to template** — briefing = non-technical, report = data-forward, review = technical

## After Conversion

Open the HTML in the default browser:

```bash
open file.html
```
