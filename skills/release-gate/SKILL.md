---
name: release-gate
description: Runs deterministic final acceptance checks for Pi-driven code changes and records tests, skipped checks, findings, and residual risks. Use before merge, release, or parent acceptance.
license: MIT
---

# Release Gate

Use after implementation and review. Parent remains final decision-maker.

## Required evidence

Inspect current diff and record:

- changed files and scope
- implementation and review summaries
- exact test, lint, typecheck, build, integration, and acceptance commands
- exit codes and relevant output
- skipped checks and why
- unresolved P0/P1/P2 findings
- clean or intentionally dirty worktree state

Run only commands appropriate to repository. Detect package manager and scripts from current project files; do not guess commands. Prefer focused checks first, then full project gates when practical.

## Finding policy

- P0 blocks acceptance and needs a targeted fix.
- P1 requires explicit parent/user approval to fix or accept; never auto-fix it.
- P2 is report-only unless scope explicitly includes it.

Reviewers provide evidence, not merge or release authority.

## Output

```markdown
## Release Gate
- Verdict: PASS | BLOCK | PASS WITH NOTES
- Changed files:
- Validation:
  - command — exit code — result
- Skipped checks:
- Findings:
- Residual risks:
- Manual verification:
```

Do not publish, merge, release, or alter credentials. Report blockers to the parent. Re-run affected deterministic checks after any fix.
