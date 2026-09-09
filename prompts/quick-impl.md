---
description: Quick & dirty implementation — clarify via questions, implement, review, fix. Max 2 loops. No plan doc, no auditor, minimal report.
model: openrouter/openai/gpt-5.6-luna
thinking: medium
---
# Quick Impl: $@

Quick and dirty implementation from user-provided description. Clarify fast, implement, review once or twice, report minimal.

## Args

- `$@`: implementation description (what to build/fix/change)

## Limits

- **Max implement → review cycles**: 2 (hard stop)
- **Implementer tool budget**: soft 40, hard 50
- **P0 findings** only are auto-fixed in the loop. P1/P2 → deferred, never auto-fixed.

## Workflow

### Phase 1: Quick clarification

Use `ask_user_question` to resolve ambiguity. Ask **1-2 questions max** covering:

- What exactly to implement, key edge cases
- Scope: what to include vs skip
- Any specific constraints (style, deps, target files)

If arguments are already unambiguous, skip this phase.

### Phase 2: Implement

Run **implementer** with tight tool budget:

```
subagent({
  agent: "implementer",
  task: "Implement this: $@. Write all required code changes, add/update tests, verify with relevant commands. Keep it simple — ship the minimum that works.",
  acceptance: { level: "attested", evidence: ["changed-files", "commands-run", "validation-output"] },
  toolBudget: { soft: 40, hard: 50 },
  output: true
})
```

Wait for result. Record changed files and validation state.

### Phase 3: Review

Run **reviewer** (read-only):

```
subagent({
  agent: "reviewer",
  task: "Review this implementation quickly. Read changed files, check for correctness, edge cases, test coverage. Output findings as P0/P1/P2. P0 = bugs, broken tests, security holes (must fix). P1 = important gaps. P2 = nice-to-have. Do NOT flag P1/P2 as blocking.",
  output: true,
  outputSchema: {
    type: "object",
    properties: {
      findings: { type: "array", items: { type: "object", properties: {
        severity: { type: "string", enum: ["P0","P1","P2"] },
        description: { type: "string" },
        location: { type: "string" }
      }, required: ["severity","description"] } },
      verdict: { type: "string", enum: ["PASS","BLOCKED","CONDITIONAL"] },
      deferred: { type: "array", items: { type: "object", properties: {
        severity: { type: "string", enum: ["P1","P2"] },
        description: { type: "string" }
      }, required: ["severity","description"] } }
    },
    required: ["findings","verdict"]
  }
})
```

### Phase 4: Fix loop (P0 only)

Extract P0 findings. Ignore P1/P2 for loop decisions.

- **No P0 findings** (PASS or CONDITIONAL with only P1/P2) → done.
- **P0 findings exist** → feed **only P0 findings** to implementer for one targeted fix pass (same tool budget limits), then re-review.
- **Hard stop at 2 cycles total** — report unresolved P0 as blocked.

Collect all P1/P2 into a deferred list. Never auto-fix P1/P2.

### Phase 5: Report

Minimal output:

```
## Quick Impl: [Subject]

### Files Changed
- path/to/file — what and why

### Validation
- Tests: passing / X failing
- Lint/type: clean / X issues

### Cycles
- Implement → review iterations: N

### Deferred (P1/P2)
- P1: description
- P2: description

### Blocked (unresolved P0)
- description — location
```

## Failure handling

- Implementer fails → report error, stop. No retry.
- P0 unresolved after 2 cycles → report blocked, stop.
- Be lazy: ship the minimum that works. Note shortcuts with `ponytail:` comments.
