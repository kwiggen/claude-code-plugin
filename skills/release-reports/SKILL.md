---
name: release-reports
description: |
  Generates weekly release cycle reports for the team.
  - preview: What's shipping (run Sunday after release train)
  - retro: What happened (run Tuesday after prod stabilizes)
---

# Release Reports Skill

Generate reports for weekly release cycles.

## Available Actions

| Action | Description |
|--------|-------------|
| `preview` | Release preview - what's shipping, risk flags |
| `retro` | Release retro - what happened, hotfixes, trends |

## Usage

```bash
python {baseDir}/skills/release-reports/scripts/release_reports.py --action <ACTION> [OPTIONS]
```

### Options

- `--action` (required): `preview` or `retro`
- `--days N`: Days to look back for release trains (default: 30)

### Examples

```bash
# Sunday evening after release train is merged
python {baseDir}/skills/release-reports/scripts/release_reports.py --action preview

# Tuesday morning after prod is stable
python {baseDir}/skills/release-reports/scripts/release_reports.py --action retro
```

## Report Details

### Preview Report

Run after the develop → staging PR is merged (Sunday).

Shows:
- Release train PR details
- All feature PRs in this release
- Risk flags: large PRs (500+ lines), quick approvals
- Hotfixes from previous cycle that need backmerge
- Monday QA focus areas

### Retro Report

Run after production is stable (Tuesday).

Shows:
- Release timeline (staging date, prod date)
- Outcome (clean release or hotfixes required)
- What shipped (PRs, contributors, lines)
- Hotfixes during QA with backmerge status
- Trend of last 4 releases

## Branch Model

| PR Type | Base | Head | Description |
|---------|------|------|-------------|
| Feature | develop | feature/* | Normal development |
| Release train | staging | develop | Weekly release |
| Hotfix | staging | fix/* | Direct fix during QA |
| Promotion | release | staging | Push to production |
| Backmerge | develop | staging | Sync hotfix back |

## Output

Reports include emoji indicators for quick scanning:
- ✅ Clean / Good
- ⚠️ Needs attention
- ❌ Action required
