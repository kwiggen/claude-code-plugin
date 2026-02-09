---
name: antipattern-detector
description: |
  Detects common failure patterns in proposals, architectures, plans, and
  decisions. Use when reviewing any plan to identify red flags before they
  become problems. Covers architecture, timeline, team, process, and
  technology anti-patterns. Works on any domain — not just code.
---

# Anti-Pattern Detector

Identifies recurring failure patterns in plans and decisions. Anti-patterns look reasonable on the surface but lead to predictable problems. Detecting them early saves months of pain.

## Anti-Pattern Categories

### 1. Architecture Anti-Patterns

| Pattern | Description | Symptoms |
|---------|-------------|----------|
| **Big Ball of Mud** | No clear structure, everything coupled | Can't change X without breaking Y |
| **Golden Hammer** | Using one approach for everything | "We'll use [tool] for that too" |
| **Premature Microservices** | Splitting before understanding boundaries | 3 people managing 20 services |
| **Distributed Monolith** | Microservices with tight coupling | Must deploy all services together |
| **Resume-Driven Development** | Choices for career, not product | "Let's use Rust for the admin panel" |

### 2. Timeline Anti-Patterns

| Pattern | Description | Symptoms |
|---------|-------------|----------|
| **Timeline Fantasy** | Optimistic estimates ignoring reality | "6 weeks if everything goes well" |
| **Scope Creep Blindness** | Not accounting for inevitable growth | Same deadline, 2x scope |
| **Parallel Path Delusion** | Assuming unlimited parallelization | "Add more people to go faster" |
| **MVP Maximalism** | MVP that's actually V3 | 47 features in "minimum" product |
| **Demo-Driven Development** | Building for demos, not production | "It works on my machine" |

### 3. Team Anti-Patterns

| Pattern | Description | Symptoms |
|---------|-------------|----------|
| **Hero Culture** | Reliance on key individuals | "Only Sarah can fix that" |
| **Knowledge Silos** | Critical info in one person's head | Bus factor of 1 |
| **Conway's Law Violation** | Structure doesn't match team | Boundaries don't align |
| **Understaffed Ambition** | Big plans with tiny teams | 2 people building "the platform" |
| **Absent Ownership** | No clear owner for components | Issues fall through cracks |

### 4. Process Anti-Patterns

| Pattern | Description | Symptoms |
|---------|-------------|----------|
| **Cargo Cult Agile** | Ceremonies without principles | Standups but no shipping |
| **Analysis Paralysis** | Over-planning, under-executing | Month 3 of "finalizing requirements" |
| **Infinite Refactoring** | Never shipping, always improving | "One more cleanup before release" |
| **Documentation Theater** | Docs that no one reads | 200-page spec, outdated day 1 |
| **Meeting Madness** | More meetings than doing | "Let's schedule a meeting" |

### 5. Technology Anti-Patterns

| Pattern | Description | Symptoms |
|---------|-------------|----------|
| **Shiny Object Syndrome** | Chasing latest tech without reason | "Rewrite in [new hotness]" |
| **Not Invented Here** | Building what should be bought | Custom auth, custom logging, custom everything |
| **Vendor Lock-in Denial** | Ignoring exit costs | "We can always migrate later" |
| **Premature Optimization** | Optimizing before measuring | Caching layer with 10 users |
| **Framework Overload** | Too many frameworks/libraries | 47 dependencies for a button |

---

## Detection Process

### Step 1: Scan for Signals

Look for phrases that indicate anti-patterns:

**Timeline signals**: "If everything goes well...", "We can do it faster if...", "Just need to hire...", "Should only take..."

**Architecture signals**: "We'll figure out boundaries later...", "Everything talks to everything...", "It's only temporary...", "We can always refactor..."

**Team signals**: "Only [person] knows...", "We'll hire for that...", "[Person] will handle all of...", "The team can absorb..."

**Process signals**: "We don't need docs...", "We'll add tests later...", "Let's discuss in the meeting...", "Requirements are evolving..."

### Step 2: Verify Pattern Match

For each suspected anti-pattern:
1. **Identify**: Which specific pattern?
2. **Evidence**: What in the plan matches?
3. **Severity**: How bad? (Critical / High / Medium / Low)
4. **Context**: Could this be a reasonable exception?

### Step 3: Check for Combinations

Certain patterns appear together and compound risk:

**Startup Death Spiral**: Timeline Fantasy + Understaffed Ambition + Hero Culture
- Result: Burnout, missed deadlines, key person leaves

**Enterprise Trap**: Analysis Paralysis + Documentation Theater + Meeting Madness
- Result: Nothing ships, team frustrated, competition wins

**Tech Debt Avalanche**: "Refactor later" + No ownership + Premature optimization
- Result: System unmaintainable, rewrite required

**Microservices Mistake**: Premature Microservices + Distributed Monolith + Understaffed
- Result: Complexity explosion, slower than monolith

---

## Severity Framework

| Level | Meaning | Action |
|-------|---------|--------|
| **Critical** | Will cause failure if not addressed | Stop and fix before proceeding |
| **High** | Will cause significant problems | Address in planning phase |
| **Medium** | Will cause friction and delays | Include in risk mitigation |
| **Low** | Worth noting but manageable | Track and address opportunistically |

---

## Output Format

```markdown
# Anti-Pattern Analysis: [Plan Name]

## Summary
- **Patterns Detected**: [Count]
- **Critical**: [Count] | **High**: [Count] | **Medium**: [Count] | **Low**: [Count]
- **Overall Risk Level**: Critical / High / Medium / Low
- **Pattern Combinations Found**: [List any compound patterns]

## Critical Issues (Must Address)

### [Pattern Name]
**Category**: [Category] | **Severity**: Critical
**Evidence**: [What triggered detection]
**Risk**: [What will go wrong]
**Fix**: [How to address]

---

## High-Priority Issues (Should Address)
[Same format]

## Medium-Priority Issues (Consider Addressing)
[Same format]

## Patterns NOT Detected
[List patterns checked but not found — builds confidence]

## Recommendations
### Before Proceeding
1. [Critical action]
### During Execution
1. [Mitigation]
### Warning Signs to Monitor
- [Metric or signal to watch]
```
