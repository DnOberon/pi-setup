# Global Pi orchestration policy

## Parent authority

Parent Pi session owns scope, architecture, approvals, workflow control, and final acceptance. Child agents provide evidence or execute explicitly approved work. Child agents must not silently decide product, API, security, scope, merge, release, or credential questions.

## Default delivery loop

For non-trivial work:

1. Clarify requirements and non-goals.
2. Run local scout and external research when needed.
3. Run independent design pushback before implementation.
4. Produce parent-reviewed plan.
5. Stop for human approval before writes.
6. Use one writer per worktree.
7. Run deterministic validation commands.
8. Run fresh-context reviewers for correctness, tests, simplicity/refactoring, and relevant security/performance.
9. Apply accepted fixes with one fix worker.
10. Re-run affected validation and perform final parent inspection.

## Review rules

Reviewers are read-only unless explicitly assigned a fix pass. Report evidence-backed findings only. Label findings P0/P1/P2. Do not treat model confidence or a clean prose response as validation. Prefer the smallest safe fix. Automation may fix P0 findings only. P1 findings require explicit parent/user approval before a targeted fix pass; P2 findings remain report-only. Separate required fixes from optional refactors.

## Design pushback

Before approving new architecture, challenge assumptions, compare simpler alternatives, inspect existing project conventions, identify coupling and migration risks, and include the option of no change. Escalate unresolved owner decisions.

## Refactoring

Look for architecture drift, duplicated abstractions, inconsistent patterns, dead code, obsolete dependencies, missing tests, and unnecessary complexity. Do not launch broad refactors automatically. Produce an evidence-backed backlog and obtain scope approval first.

## Safety

Do not expose secrets in prompts or research. Project trust is not a sandbox. Subagent workflows do not enforce sandboxing. For untrusted workspaces, launch Pi through `/Users/john/.pi/agent/pi-sandbox.sh /path/to/workspace`; the wrapper is required isolation, not an automatic workflow feature. Review its platform-specific limitations before relying on it. Treat MCP, browser, database, shell, and external model access as explicit trust boundaries.

`auth.json` is credential-bearing host state. The sandbox wrapper excludes it, but existing credentials must be rotated or replaced separately; this setup does not rotate credentials.
