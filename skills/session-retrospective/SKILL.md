---
name: session-retrospective
description: Analyzes Pi JSONL sessions and run history for duration, tool use, child-run reliability, workflow waste, and recurring review findings. Use after several coding sessions or a failed orchestration run.
license: MIT
---

# Session Retrospective

Use read-only analysis. Never modify session files, artifacts, source code, or credentials.

## Scope

Start with recent parent sessions under `~/.pi/agent/sessions/`. Exclude `subagent-artifacts`, nested run transcripts, and unrelated projects unless explicitly requested. Read `run-history.jsonl` for aggregate child status and duration.

## Useful analysis

Use a short Python or Node command to aggregate:

- session count and date range
- user task themes
- tool-call counts by tool
- child agents launched
- completed, failed, and timed-out runs
- duration percentiles and long-tail runs
- repeated validation or discovery work
- reviewer findings and unresolved P1/P2 items

Do not print message content that may contain secrets. Hash or summarize paths and redact tokens, URLs with credentials, and customer data.

## Interpretation

Separate:

- reliability failures from provider or environment failures
- prompt/workflow failures from implementation defects
- useful review work from duplicated analysis
- intentional full pipelines from over-processing small tasks

Compare results with current workflow policy. Pay special attention to implementer timeouts, retry loops, stale agent names, unsupported models, and missing deterministic validation.

## Output

Return:

```markdown
## Period
## Reliability
## Cost and latency signals
## Workflow waste
## Recurring findings
## Recommended changes
## Unknowns and privacy limits
```

Every recommendation needs evidence from counts, durations, or exact session metadata. Never treat a successful model response as proof that code validation passed.
