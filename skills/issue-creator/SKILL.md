---
name: issue-creator
description: |
  Creates GitHub issues and adds them to the ExamJam V.Next 25 project (project 19)
  with custom field values. Handles the complete workflow of gathering issue details,
  fetching project field options dynamically, creating the issue, adding it to the
  project, and setting Priority, Type, Initiative, and Status fields.
---

# Issue Creator Skill

Create GitHub issues and add them to GitHub Projects V2 with custom field values.

## Target Project

- **Organization:** atypical-ai
- **Project Number:** 19
- **Project Name:** ExamJam V.Next 25
- **URL:** https://github.com/orgs/atypical-ai/projects/19/

## Prerequisites

### Authentication

Requires `gh` CLI authenticated with `project` scope. Verify with:

```bash
gh auth status
```

If missing project scope, user must run:

```bash
gh auth refresh -s project
```

### Required Fields in Project

The skill expects these single-select fields in project 19:
- **Priority** - P0, P1, P2, P3
- **Type** - dynamically fetched
- **Initiative** - dynamically fetched
- **Status** - dynamically fetched (e.g., Todo, In Progress, Done)

## Workflow Steps

### Step 1: Fetch Project Configuration

**Get project GraphQL ID (required for item-edit):**

```bash
gh project view 19 --owner atypical-ai --format json --jq '.id'
```

Store the result as `PROJECT_ID` (format: `PVT_kwDOxxxxxx`).

**Get field definitions with options:**

```bash
gh project field-list 19 --owner atypical-ai --format json
```

**Expected JSON structure:**

```json
{
  "fields": [
    {
      "id": "PVTSSF_lADOxxxxxx",
      "name": "Priority",
      "type": "ProjectV2SingleSelectField",
      "options": [
        { "id": "option-id-1", "name": "P0" },
        { "id": "option-id-2", "name": "P1" },
        { "id": "option-id-3", "name": "P2" },
        { "id": "option-id-4", "name": "P3" }
      ]
    },
    {
      "id": "PVTSSF_lADOxxxxxx",
      "name": "Type",
      "type": "ProjectV2SingleSelectField",
      "options": [...]
    },
    {
      "id": "PVTSSF_lADOxxxxxx",
      "name": "Initiative",
      "type": "ProjectV2SingleSelectField",
      "options": [...]
    },
    {
      "id": "PVTSSF_lADOxxxxxx",
      "name": "Status",
      "type": "ProjectV2SingleSelectField",
      "options": [
        { "id": "option-id-1", "name": "Todo" },
        { "id": "option-id-2", "name": "In Progress" },
        { "id": "option-id-3", "name": "Done" }
      ]
    }
  ]
}
```

**Parse with jq:**

```bash
# Get Priority field ID and options
gh project field-list 19 --owner atypical-ai --format json \
  --jq '.fields[] | select(.name == "Priority")'

# Get Type field and options
gh project field-list 19 --owner atypical-ai --format json \
  --jq '.fields[] | select(.name == "Type")'

# Get Initiative field and options
gh project field-list 19 --owner atypical-ai --format json \
  --jq '.fields[] | select(.name == "Initiative")'

# Get Status field and options
gh project field-list 19 --owner atypical-ai --format json \
  --jq '.fields[] | select(.name == "Status")'
```

### Step 2: Gather Issue Details

**Title:**
- Use command argument if provided
- Otherwise, use `AskUserQuestion` to prompt the user

**Description:**
- Use `AskUserQuestion` to prompt for issue body (supports multi-line markdown)

### Step 3: Present Field Options to User

Use `AskUserQuestion` for each field:

**Priority:**

Present fixed options:
- P0 - Critical/Blocking
- P1 - High
- P2 - Medium
- P3 - Low

**Type:**

Present dynamically fetched options from the project field.

**Initiative:**

Present dynamically fetched options from the project field.

**Status:**

Present dynamically fetched options from the project field (e.g., Todo, In Progress, Done).

### Step 4: Create the Issue

```bash
gh issue create --title "<title>" --body "$(cat <<'EOF'
<description>
EOF
)"
```

**Important:** Use a heredoc for the body to handle multi-line content and special characters.

Capture the issue URL from the output (format: `https://github.com/owner/repo/issues/123`).

### Step 5: Add Issue to Project

```bash
gh project item-add 19 --owner atypical-ai --url <issue-url> --format json --jq '.id'
```

Store the returned item ID as `ITEM_ID` (format: `PVTI_lADOxxxxxx`).

### Step 6: Set Field Values

**Important:** Each `item-edit` call can only set ONE field value. Run four separate commands.

**Set Priority:**

```bash
gh project item-edit \
  --id "<ITEM_ID>" \
  --project-id "<PROJECT_ID>" \
  --field-id "<PRIORITY_FIELD_ID>" \
  --single-select-option-id "<SELECTED_PRIORITY_OPTION_ID>"
```

**Set Type:**

```bash
gh project item-edit \
  --id "<ITEM_ID>" \
  --project-id "<PROJECT_ID>" \
  --field-id "<TYPE_FIELD_ID>" \
  --single-select-option-id "<SELECTED_TYPE_OPTION_ID>"
```

**Set Initiative:**

```bash
gh project item-edit \
  --id "<ITEM_ID>" \
  --project-id "<PROJECT_ID>" \
  --field-id "<INITIATIVE_FIELD_ID>" \
  --single-select-option-id "<SELECTED_INITIATIVE_OPTION_ID>"
```

**Set Status:**

```bash
gh project item-edit \
  --id "<ITEM_ID>" \
  --project-id "<PROJECT_ID>" \
  --field-id "<STATUS_FIELD_ID>" \
  --single-select-option-id "<SELECTED_STATUS_OPTION_ID>"
```

### Step 7: Confirm Success

Display confirmation to user:

```markdown
## Issue Created

**Title:** <title>
**URL:** <issue-url>

**Project Assignment:**
- Added to: ExamJam V.Next 25 (Project #19)
- Priority: <selected priority>
- Type: <selected type>
- Initiative: <selected initiative>
- Status: <selected status>
```

## Error Handling

### Authentication Scope Error

If you see:
```
error: your authentication token is missing required scopes [read:project]
```

Inform user:
```
Your GitHub CLI needs the project scope. Run:
  gh auth refresh -s project
Then try again.
```

### Field Not Found

If Priority, Type, Initiative, or Status field is not found in project:

1. List available fields to user:
   ```bash
   gh project field-list 19 --owner atypical-ai --format json --jq '.fields[].name'
   ```
2. Ask if they want to continue without setting that field
3. Proceed with available fields

### Project Not Found

If project 19 doesn't exist or isn't accessible:

```
Could not access project 19 in atypical-ai organization.
Verify you have access to: https://github.com/orgs/atypical-ai/projects/19/
```

### Issue Creation Failed

Show the gh CLI error and suggest:
- Check if you're in a valid git repository
- Verify repository permissions
- Check if issue creation is enabled for the repo

### Item Add Failed

If adding issue to project fails:
- Verify the issue URL is correct
- Check project permissions
- Ensure the project accepts issues from this repository

## Complete Example Session

**User:** `/create-issue Add dark mode support`

**Claude:**
1. Fetches project 19 configuration
2. Prompts for description:
   > "Provide the issue description:"
3. User enters: "Users need dark mode for better visibility in low-light conditions"
4. Fetches Type options: Bug, Feature, Tech Debt, Spike
5. Fetches Initiative options: User Experience, Performance, Tech Debt
6. Fetches Status options: Todo, In Progress, Done
7. Asks for Priority: **P2 (Medium)**
8. Asks for Type: **Feature**
9. Asks for Initiative: **User Experience**
10. Asks for Status: **Todo**
11. Creates issue: `gh issue create --title "Add dark mode support" --body "..."`
12. Adds to project 19
13. Sets Priority to P2, Type to Feature, Initiative to User Experience, Status to Todo
14. Displays confirmation:
    ```
    ## Issue Created

    **Title:** Add dark mode support
    **URL:** https://github.com/atypical-ai/repo/issues/42

    **Project Assignment:**
    - Added to: ExamJam V.Next 25 (Project #19)
    - Priority: P2
    - Type: Feature
    - Initiative: User Experience
    - Status: Todo
    ```

## Customization

To adapt this skill for a different organization or project:

1. **Update Target Project** - Change the organization and project number in the "Target Project" section
2. **Modify Field Names** - Update the field names (Priority, Type, Initiative, Status) to match your project's custom fields
3. **Adjust Priority Options** - If your project uses different priority levels, update the Priority options in Step 3

Example for a different project:
```bash
# Replace these values throughout the skill:
ORGANIZATION="your-org"
PROJECT_NUMBER="42"

# Then use:
gh project view $PROJECT_NUMBER --owner $ORGANIZATION --format json
gh project field-list $PROJECT_NUMBER --owner $ORGANIZATION --format json
```

## Notes

- All IDs are GraphQL node IDs (base64-encoded strings)
- The `--jq` flag filters JSON output directly
- Heredocs (`<<'EOF'`) prevent shell interpretation of special characters in issue body
