---
description: Implement from detailed plan — implementer → reviewer loop with tool budgets and max 3 iterations. Fixes P0; P1 requires approval; defers P2.
model: openrouter/openai/gpt-5.6-luna
thinking: high
---
# Implement: $1

You are running an implementation workflow. Take the detailed plan and execute it through a subagent loop with strict limits.

## Args
- $1: path to detailed implementation plan (markdown)

## Priority Policy
- **P0 findings** → fixed inside the workflow loop.
- **P1 findings** → never auto-fixed. Collected as explicit approval requests for a later targeted pass.
- **P2 findings** → never fixed automatically. Reported as deferred items.

## Limits
- **Max loop iterations**: 3 (implement → review cycles). Stop on 3rd regardless of findings.
- **Acceptance evidence**: every implementer pass must report changed files and validation output.
- If P0 issues cannot be resolved in max iterations, stop and report them as blocked.

## Workflow

### Phase 1: Read plan
Read the implementation plan at `$1`. Understand every step, file change, and test requirement.

### Phase 2: Implement pass (limits applied)
Run **implementer** with bounded resources:

```
subagent({
  agent: "implementer",
  task: "Implement this plan: read $1, then execute each step. Write all required code changes, add/update tests, verify with relevant commands.",
  acceptance: { level: "attested", evidence: ["changed-files", "commands-run", "validation-output"] },
  output: true
})
```

Wait for result. Record changed files and validation state.

### Phase 3: Review pass
Run **reviewer** (read-only, no tool budget needed):

```
subagent({
  agent: "reviewer",
  task: "Review this implementation for correctness. Read plan at $1, inspect changed files, verify tests pass, check edge cases. Output structured findings with P0/P1/P2 labels. P0 = must fix before proceeding (bugs, broken tests, security holes). P1 = important but not blocking (minor logic gaps, missing edge cases). P2 = nice-to-have (style, naming, doc comments). DO NOT flag P1/P2 issues as blocking the review.",
  output: true,
  outputSchema: {
    type: "object",
    properties: {
      findings: { type: "array", items: { type: "object", properties: {
        severity: { type: "string", enum: ["P0","P1","P2"] },
        description: { type: "string" },
        location: { type: "string" },
        evidence: { type: "string" }
      }, required: ["severity","description"] } },
      verdict: { type: "string", enum: ["PASS","BLOCKED","CONDITIONAL"] },
      deferred: { type: "array", items: { type: "object", properties: {
        severity: { type: "string", enum: ["P1","P2"] },
        description: { type: "string" },
        location: { type: "string" }
      }, required: ["severity","description"] } }
    },
    required: ["findings","verdict"]
  }
})
```

### Phase 4: Loop control — P0-only fix loop
Extract P0 findings from reviewer output. Ignore P1/P2 for iteration decisions. P1 findings require explicit parent/user approval before any later targeted fix pass; P2 findings go to the report.

- **No P0 findings** (verdict PASS, or CONDITIONAL with only P1/P2) → move to auditor.
- **P0 findings exist** → feed **only P0 findings** to implementer for one targeted fix pass (same tool budget limits), then re-review.
- Track iteration count. **Hard stop at 3 cycles** — report unresolved P0 as blocked if max reached.

Each fix pass must be minimal: only address reported P0 findings, no broad rewrites. Do NOT attempt to fix P1/P2 findings.

Collect all P1/P2 findings across all review passes into a deferred list for the final report.

### Phase 5: Auditor compliance check
Run **auditor** for final security/style/structure check:

```
subagent({
  agent: "auditor",
  task: "Audit implementation driven by plan at $1. Check changed files for security, style, structure compliance. Ignore minor style preferences — focus on real issues. Flag P0 or P1 only.",
  output: true
})
```

If auditor reports P0 issues → one final targeted fix pass to implementer, then re-audit.
If auditor reports P1+ only → append to approval/deferred list; do not fix automatically.

### Phase 6: Final verification
Run available project checks: linters, type checks, tests.
Report final state.

### Phase 7: Report
Output summary:

```
## Implementation Complete

### Files Changed
- path/to/file — what changed and why

### Validation
- Tests: all passing / X passing, Y failing
- Lint: clean / X warnings
- Type check: clean / X errors

### Iterations
- Implement → review cycles completed: N

### Security Audit
- PASS / FAIL — summary

### Deferred Items (for user to implement)
- P1: description — location
- P2: description — location

### Blocked (if any)
- Any P0 issues unresolved after max iterations

### Next Steps
- What user should verify
- Any manual steps needed
- List of deferred P1/P2 items to tackle next
```

## Failure handling
- Implementer fails on any pass → report error, stop. No silent retry.
- P0 blockers unresolved after 3 cycles → report as blocked, stop.
- P1 findings are never auto-fixed; report them for explicit approval. P2 findings are always deferred to the final report.
- Each fix pass must be minimal, targeted to reported P0 findings only.
