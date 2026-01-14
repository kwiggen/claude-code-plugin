---
name: feature-writer
description: |
  Guides users through defining features via adaptive discussion and generates
  structured feature 1-pagers. Use when users want to create a well-documented
  feature request or need help articulating a feature idea. The discussion is
  conversational, not a form - follow threads, ask follow-ups, and refine until
  the user is satisfied.
---

# Feature Writer Skill

Guide users through feature definition via adaptive discussion and generate lightweight feature 1-pagers.

## Philosophy

Features should be defined through **conversation, not forms**. Engage in an adaptive discussion that draws out the feature definition naturally. The 1-pager is synthesized from this discussion.

## Adaptive Discussion Framework

### CRITICAL: This MUST be a conversation, NOT a checklist

- **Follow interesting threads** - if the user mentions something important, dig deeper
- **Ask follow-up questions** based on their actual responses
- **Clarify ambiguity** before moving on
- **Summarize your understanding** periodically
- **Never rigidly ask questions in order like a form**

### Core Areas to Explore

Through natural conversation, understand these areas:

**Problem Space:**
- "What problem are you trying to solve?"
- "Why is this a problem worth solving now?"
- "Can you give me an example of when this is painful?"

**User Impact:**
- "Who will use this feature?"
- "How will this improve their experience?"
- "What can they do after this feature that they can't do now?"

**Solution Vision:**
- "What's your high-level approach to solving this?"
- "What are the key capabilities this feature needs?"
- "Are there any constraints we need to work within?"

### Handling Different User Styles

**Verbose users** (provide lots of detail upfront):
- Acknowledge the information
- Ask targeted clarifying questions
- Move to synthesis faster

**Terse users** (give minimal responses):
- Ask more specific, concrete questions
- Provide examples to prompt thinking
- Use "Can you say more about X?" prompts

**Uncertain users** (don't have all answers):
- Help them think through it
- Suggest common patterns or options
- Mark areas as "TBD" in the 1-pager if needed

## 1-Pager Template

After the discussion, synthesize a lightweight 1-pager:

```markdown
# [Feature Name]

## Problem Statement

<2-3 sentences: What problem are we solving and why does it matter?>

## Proposed Solution

<High-level description of the approach. Focus on WHAT we're building, not HOW we'll implement it. 3-5 sentences.>

## Key Features

<Bullet list of the main capabilities this feature will provide>

- Feature capability 1
- Feature capability 2
- Feature capability 3

---
*Feature 1-pager generated with [Claude Code](https://claude.ai/code)*
```

## Synthesis Guidelines

When creating the 1-pager from the discussion:

1. **Be concise** - each section should be scannable
2. **Use the user's language** - incorporate their terminology
3. **Fill gaps intelligently** - make reasonable inferences or mark as "TBD"
4. **Stay outcome-focused** - emphasize user value, not implementation details
5. **Keep features as capabilities** - not implementation tasks

## Review and Refinement Loop

After generating the 1-pager:

1. **Display the complete 1-pager** formatted in markdown

2. **Ask for confirmation:**
   > "Review this feature 1-pager. Should I create the issue with this content, or would you like to refine it?"

3. **Handle responses:**
   - **Affirmative** ("looks good", "create it"): Proceed to issue creation
   - **Refinement request**: Ask what to change, update the 1-pager
   - **Major changes**: Return to discussion if needed

4. **No iteration limit** - refine until the user is satisfied

## Integration with Issue Creator

Once the 1-pager is confirmed:

1. **Prepare for issue creation:**
   - Feature name becomes issue title
   - 1-pager becomes issue body
   - Type is automatically set to "Feature"

2. **Follow issue-creator patterns:**
   - Create issue with `gh issue create`
   - Add to project 19 with `gh project item-add`
   - Set Type = Feature
   - Prompt user for Priority (P0-P3)
   - Prompt user for Initiative (dynamic options)
   - Prompt user for Status (dynamic options)

3. **Use heredoc for the body:**
   ```bash
   gh issue create --title "<feature-name>" --body "$(cat <<'EOF'
   <1-pager-content>
   EOF
   )"
   ```

## Example Session

**User:** `/create-feature User profile management`

**Claude:** "Let's define this feature. What problem are you trying to solve with user profile management?"

**User:** "Users can't update their personal information after signing up. They have to contact support."

**Claude:** "That's frustrating. What kind of information do they typically want to update?"

**User:** "Name, email, profile picture. Sometimes notification preferences."

**Claude:** "Got it. Any constraints - like things they shouldn't be able to change?"

**User:** "Username and account type need to stay fixed."

**Claude:** "Makes sense. Let me put together a 1-pager based on our discussion."

*(Generates 1-pager)*

```markdown
# User Profile Management

## Problem Statement

Users cannot update their personal information after initial signup, requiring them to contact support for simple changes. This creates friction and generates unnecessary support volume.

## Proposed Solution

Provide a self-service profile management interface where users can update their name, email, profile picture, and notification preferences. Username and account type remain read-only to maintain system integrity.

## Key Features

- Update name and display name
- Change email address (with verification)
- Upload and manage profile picture
- Configure notification preferences
- View but not edit username and account type

---
*Feature 1-pager generated with [Claude Code](https://claude.ai/code)*
```

**Claude:** "Review this feature 1-pager. Should I create the issue with this content, or would you like to refine it?"

**User:** "Add password reset to key features"

**Claude:** *(Updates 1-pager and shows again)*

**User:** "Looks good, create it"

**Claude:** *(Proceeds to create issue via issue-creator patterns)*

## Error Handling

### User Cancels Mid-Discussion

If user indicates they want to stop:
```
Understood. We can resume the feature definition anytime with /create-feature.
```

### Can't Synthesize a Section

If discussion didn't cover something and you can't infer:
```markdown
## [Section]

*TBD - needs further discussion*
```

Ask user to provide more details during review.

## Anti-Patterns to Avoid

**In Discussion:**
- Asking all questions upfront like a form
- Accepting vague answers without follow-up
- Ignoring signals that user has more to say
- Moving too fast through areas

**In 1-Pager:**
- Problem statement that's just the feature name rephrased
- Proposed solution with implementation details (class names, APIs)
- Key features that are implementation tasks, not user capabilities
- Overly long or verbose sections
