---
name: assumption-challenger
description: |
  Identifies and stress-tests implicit assumptions in plans, proposals, and
  decisions. Use when validating roadmaps, reviewing architecture proposals,
  assessing timelines, or challenging any plan where hidden assumptions could
  cause failure. Works on any domain — code, business, strategy, operations.
---

# Assumption Challenger

Systematically surfaces and stress-tests assumptions treated as facts but never validated. Most failures trace back to invalid assumptions — catching them early prevents costly mistakes.

## Assumption Categories

### 1. Timeline Assumptions
Assumptions about how long things will take.

**Red flags**: "This should only take...", "If everything goes well...", "The team can absorb this..."

**Challenge with**:
- What's this estimate based on? Past experience or hope?
- What similar work has been done before? How long did it actually take?
- What's NOT included? (Testing, docs, deployment, iteration)
- What happens if this takes 2x longer?

### 2. Resource Assumptions
Assumptions about team capacity and availability.

**Red flags**: "We'll hire by Q2...", "The team can support this...", "Sarah can lead this while..."

**Challenge with**:
- What's the actual hiring timeline? What if you can't find the right people?
- What's the team's current utilization? Where does time come from?
- Who's the backup if the key person is unavailable?
- What happens at 50% of expected capacity?

### 3. Technical Assumptions
Assumptions about system capabilities and constraints.

**Red flags**: "The system can handle the load...", "We can integrate easily...", "Our architecture supports..."

**Challenge with**:
- Has this been tested at the required scale?
- What are the documented limits? What happens at those limits?
- What's the failure mode? How do you recover?
- Have you talked to the API provider about your usage patterns?

### 4. Business Assumptions
Assumptions about market, users, and outcomes.

**Red flags**: "Users want this...", "This will reduce churn by...", "The market will wait..."

**Challenge with**:
- What evidence supports this? Research? Data? Or intuition?
- What if users don't adopt? What's the fallback?
- What are competitors doing in this space?
- How will you know if this assumption is wrong?

### 5. External Assumptions
Assumptions about factors outside your control.

**Red flags**: "The vendor will deliver...", "Regulations won't change...", "The market stays stable..."

**Challenge with**:
- What's the contingency if this doesn't happen?
- What's the vendor's track record on commitments?
- What early warning signs would indicate this is wrong?

---

## Process

### Step 1: Surface Assumptions

Read the plan and flag statements treated as facts without validation:

- "We will..." (without evidence)
- "We can..." (without proof)
- "Users want..." (without data)
- "It should..." (without testing)
- "We expect..." (without basis)
- "We assume..." (at least they're honest)

### Step 2: Categorize and Assess

For each assumption, determine:

| Factor | Assessment |
|--------|-----------|
| **Category** | Timeline / Resource / Technical / Business / External |
| **Stated or Implicit** | Was it acknowledged or hidden? |
| **Evidence For** | What supports it? |
| **Evidence Against** | What contradicts it? |
| **Risk if Wrong** | Impact on timeline, cost, success |
| **How to Validate** | What would prove or disprove it? |
| **Verdict** | Valid / Questionable / Invalid / Unknown |

### Step 3: Apply Challenge Patterns

For high-risk assumptions, apply these patterns:

**Reality Check** — Compare to external data:
> "You assume [X]. Industry data shows [Y]. What makes you different?"

**History Test** — Compare to past performance:
> "You assume [X]. Last time you attempted [similar], it took [Y]. What changed?"

**Stress Test** — Push to failure point:
> "You assume [X]. What happens when [stress scenario]?"

**Dependency Audit** — Trace dependencies:
> "For [assumption] to be true, what else must also be true?"

**Inverse Test** — Consider the opposite:
> "If [assumption] is wrong, what's the impact? What's Plan B?"

### Step 4: Prioritize

Focus on assumptions that are:
1. **High impact** — project fails if wrong
2. **Low evidence** — based on hope, not data
3. **Testable** — can be validated before commitment

---

## Wishful Thinking Indicators

Red flags that suggest hope rather than evidence:

- **Optimistic Timeline**: "Should only take...", "If we're focused..." — Reality: add 30-50% buffer
- **Magical Hiring**: "We'll just hire...", "Once we have the team..." — Reality: 3-6 months to hire senior, 2-3 months to productive
- **Simple Integration**: "It's just an API call...", "Should be straightforward..." — Reality: edge cases, rate limits, surprises always
- **Obvious Market**: "Everyone needs this...", "Users have been asking..." — Reality: "everyone" is not a segment
- **Linear Scaling**: "If we can do X, we can do 10X..." — Reality: scaling is non-linear

---

## Output Format

```markdown
# Assumption Analysis: [Plan Name]

## Summary
- **Total Assumptions Identified**: [Count]
- **High-Risk**: [Count] | **Medium-Risk**: [Count] | **Low-Risk**: [Count]

## Critical Assumptions (Must Validate Before Proceeding)

### Assumption: [Statement]
**Category**: [Type] | **Stated or Implicit**: [Which]

**The Problem**: [Why questionable]
**Evidence For**: [Supporting evidence]
**Evidence Against**: [Counter-evidence]
**If Wrong**: Timeline: [impact] | Cost: [impact] | Success: [impact]
**How to Validate**: [Method and cost/time]
**Verdict**: Valid / Questionable / Invalid / Unknown

---

## Medium-Risk Assumptions (Should Validate)
[Brief analysis for each]

## Low-Risk Assumptions (Monitor)
[List]

## Recommendations
### Before Proceeding
1. [Validation action]
### Risk Mitigation
1. [Mitigation for critical assumptions]
### Contingency Plans Needed
1. [Plan B for each critical assumption]
```
