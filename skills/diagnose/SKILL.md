---
name: diagnose
description: |
  Structured debugging as a state machine: reproduce, minimize, hypothesize,
  instrument, fix, regression-test. Use when something is broken, a bug needs
  fixing, tests are failing unexpectedly, or behavior doesn't match expectations.
---

# Diagnose — Structured Debugging

Debug methodically. No guessing. No "let me try changing this and see."
Follow the state machine: reproduce -> minimize -> hypothesize -> instrument -> fix -> regression-test.

## The One Rule

**If you have a fast, deterministic, agent-runnable pass/fail signal for the bug,
you will find the cause.** Bisection, hypothesis-testing, and instrumentation all
consume that signal. If you don't have one, no amount of staring at code will
save you. Spend disproportionate effort building the feedback loop.

## Phase 1 — Build a Feedback Loop

Before anything else, establish a way to trigger the bug on command. Try these
in order, from best to acceptable:

1. **Failing test** (unit, integration, or e2e) — ideal; fast, isolated, survives the fix
2. **Curl/HTTP script** against a running dev server
3. **CLI invocation** with fixture input, diff against known-good output
4. **Headless browser script** (Playwright/Puppeteer)
5. **Replay a captured trace** (HAR file, recorded request)
6. **Throwaway harness** — minimal script that exercises just the broken path
7. **Property/fuzz loop** — when the trigger is non-obvious
8. **Bisection harness** — `git bisect run <script>` to find the breaking commit
9. **Differential loop** — compare output of two versions (before/after, branch/main)
10. **Manual HITL script** — bash script that sets up state and tells you what to check (last resort)

Once you have a loop, optimize it: Can it run faster? Is the signal sharper?
Is it deterministic?

## Phase 2 — Reproduce

Run the feedback loop. Confirm:

- [ ] The bug appears
- [ ] It matches the user's description
- [ ] It's reproducible (runs 3+ times with same result)

**If the bug is non-deterministic:** Your goal is NOT to fix it yet. Your goal
is to raise the reproduction rate until it's debuggable. Try: increase load,
tighten timing, add contention, remove caching, pin to a single thread.

**If reproduction fails entirely:** Stop and say so explicitly. List what you
tried. Ask the user for:
- Access to whatever environment reproduces it
- A captured artifact (HAR file, log dump, core dump, screen recording)
- Permission to add temporary instrumentation to the environment that reproduces it

**Do not proceed to hypothesize without a working feedback loop.**

## Phase 3 — Minimize

Shrink the reproduction to the smallest possible case:

- Remove unrelated setup code
- Simplify inputs to the minimal trigger
- Isolate the failing path from the rest of the system

A minimal reproduction makes the cause obvious more often than you'd expect.

## Phase 4 — Hypothesize

Generate 3-5 ranked hypotheses BEFORE changing any code. For each:

- State the hypothesis clearly: "The bug is caused by X"
- State a falsifiable prediction: "If X is the cause, then doing Y will make the bug disappear"
- Rank by likelihood based on the evidence so far

**Do not skip to fixing.** You may be right about hypothesis #1. You may be
wrong. Prove it first.

## Phase 5 — Instrument

Test your top hypothesis. One variable at a time.

**Prefer in this order:**
1. **Debugger breakpoint** — inspect state directly
2. **Targeted log/print** — one or two specific values at the suspected failure point
3. **Assertion** — add a runtime check that will fail loudly if your hypothesis is wrong
4. **Broader logging** — only if targeted approaches aren't conclusive

**Tag all debug instrumentation** with a unique prefix (e.g., `[DEBUG-x7f2]`)
so you can find and remove every piece of it later.

If hypothesis #1 is disproven, move to #2. If all hypotheses are disproven,
return to Phase 4 with new information from the instrumentation.

## Phase 6 — Fix

Now — and only now — modify production code.

1. **Write a regression test FIRST** — turn the minimal reproduction from Phase 3 into a failing test
2. Run the test, confirm it fails
3. Apply the fix — the smallest change that addresses the root cause
4. Run the regression test, confirm it passes
5. Run the full test suite, confirm nothing else broke

**The fix should address the root cause, not the symptom.** If the bug is "null
pointer in function X," the fix isn't a null check in X. It's figuring out why
X received null and preventing that upstream.

## Phase 7 — Cleanup

- Remove ALL debug instrumentation (search for your `[DEBUG-...]` tag)
- Remove any temporary test harnesses that aren't part of the permanent suite
- If the bug revealed an architectural problem, note it for the user — suggest running `/review-architecture`

## When to Escalate

Escalate to the user (don't keep flailing) when:

- Reproduction fails after exhausting Phase 1 options
- All hypotheses are disproven and you have no new theories
- The fix requires changing a system you don't have context for
- The root cause is in a dependency or third-party service
- The bug is environment-specific and you can't reproduce the environment

Escalation is the right move, not a failure. State what you know, what you tried,
and what you need.
