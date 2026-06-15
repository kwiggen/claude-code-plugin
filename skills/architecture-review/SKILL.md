---
name: architecture-review
description: |
  Review codebase architecture for deepening opportunities — modules where the
  interface is nearly as complex as the implementation. Uses depth-as-leverage
  model and the deletion test. Use when the codebase feels tangled, after a
  burst of fast development, or when asked to review architecture.
---

# Architecture Review — Find Deepening Opportunities

Surface architectural friction and propose refactors that turn shallow modules
into deep ones. A deep module has a small interface hiding a lot of behavior.
A shallow module has an interface nearly as complex as its implementation — the
abstraction isn't earning its keep.

## Vocabulary

Use these terms exactly. Do not drift to synonyms.

| Term | Definition |
|---|---|
| **Module** | Anything with an interface + implementation: function, class, package, file, slice |
| **Interface** | Everything a caller must know: types, invariants, error modes, ordering constraints, config |
| **Implementation** | The code inside the module |
| **Depth** | Leverage at the interface. Deep = small interface, lots of behavior. Shallow = interface nearly as complex as implementation |
| **Seam** | Where the interface lives; the point where behavior can be altered without editing the module's internals |
| **Adapter** | A concrete thing that satisfies an interface at a seam |
| **Leverage** | What callers get from depth — how much behavior they can exercise per unit of interface they must learn |
| **Locality** | What maintainers get from depth — change, bugs, and knowledge concentrated in one place |

**Do not use:** "component" (too vague), "service" (implies network), "API" (overloaded), "boundary" (use "seam").

## The Core Diagnostic: The Deletion Test

For any module you suspect is shallow, ask:

**Would deleting this module concentrate complexity into a meaningful new
abstraction, or just move the same code somewhere else?**

- If deleting it **concentrates** complexity into something better: the module was earning its keep. Leave it.
- If deleting it **just relocates** the same logic to callers: it was shallow. Candidate for deepening or removal.

## Before Starting

1. **Read CLAUDE.md** and any existing architecture docs, ADRs, or CONTEXT.md
2. **Walk the codebase organically** — don't start with a checklist. Read the code. Note friction. Where do things feel tangled? Where does a simple change require touching many files?
3. **Apply the deletion test** to modules that feel off
4. **Check dependency patterns** — are there modules that everything depends on? Modules that depend on everything?

## What to Look For

### Shallow Module Symptoms
- Interface is a thin wrapper over the implementation (pass-through methods)
- Callers need to understand the implementation to use the interface correctly
- Changing the implementation always requires changing callers
- The module name describes HOW it works, not WHAT it does

### Depth Opportunities
- Multiple callers doing the same multi-step sequence (logic wants to be pulled into a deeper module)
- Error handling scattered across callers instead of concentrated in one place
- Configuration or setup that every caller repeats
- Knowledge that's spread across files instead of concentrated

### Dependency Classification

When proposing a deepened module, classify its dependencies:

| Dependency Type | Testing Approach |
|---|---|
| **Pure computation** (no I/O) | Test directly, no mocking needed |
| **Local stand-in available** (PGLite, in-memory FS, test DB) | Use the stand-in in tests |
| **Network boundary** | Define a port at the seam, inject transport as an adapter |

## Output

Present findings as a numbered list of **deepening opportunities**, ranked by leverage (highest first).

For each opportunity:

```markdown
### [N]. [Module or area name]

**Files:** `path/to/file.ts`, `path/to/other.ts`
**Problem:** [What's shallow and why — be specific]
**Deletion test:** [What happens if you delete it? Concentrates or relocates?]
**Proposed deepening:** [How to make the interface smaller or the behavior richer]
**Leverage gain:** [What callers or maintainers get from this change]
**Risk:** [What could go wrong, dependencies that might break]
**Recommendation strength:** Strong / Moderate / Worth discussing
```

## After Presenting

Do NOT propose interfaces or start coding. Present the candidates and ask which
to explore. When the user picks one:

1. Enter a grilling conversation about the interface design
2. Walk the decision tree: What should the interface expose? What should it hide? What are the seams?
3. If the deepening introduces a new domain concept, suggest adding it to CONTEXT.md

Only write code after the design conversation resolves.

## When to Run This

- After a burst of fast, agent-assisted development (entropy accumulates)
- When a simple feature change requires touching 5+ files
- When onboarding someone new and they can't find where things live
- When the same bug pattern keeps appearing in different places
- Periodically (every few weeks) on active codebases
