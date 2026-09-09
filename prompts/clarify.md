---
description: Clarify objective before implementation — gather context via scout + researcher, then ask user detailed questions and produce a clarified spec.
model: openrouter/openai/gpt-5.6-luna
thinking: medium
---
# Clarify: $1 → $2

You are running a clarification workflow. The user wants to clarify an objective before implementation.

## Args
- $1: path to input objective document (markdown)
- $2: path to write clarified output spec (markdown)

## Workflow

### Phase 1: Read input
Read the objective document at `$1`. Understand what the user wants to achieve.

### Phase 2: Gather context
Launch two subagents **in parallel** to build context:

1. **scout** — explore the codebase.
   Call: `subagent({ agent: "scout", task: "Explore codebase for context relevant to this objective: read $1 first, find related files, key types, constraints." })`

2. **researcher** — gather external context.
   Call: `subagent({ agent: "researcher", task: "Research best practices, alternatives, and relevant patterns for this objective: read $1 first, search the web." })`

Call both via the subagent tool. Wait for both before proceeding.

### Phase 3: Ask clarifying questions
Use the ask_user_question tool to clarify:
- What is in scope vs explicitly out of scope
- Acceptance criteria / how success is measured
- Constraints (time, tech, team, compatibility)
- Risks the user is aware of
- Priorities if tradeoffs exist

Ask 2-4 questions, grouping related concerns. Each question should have 2-4 concrete options.

### Phase 4: Synthesize and write
Synthesize everything into a clarified spec document at `$2`.

## Output format for $2

```markdown
# Clarified Spec: [Title]

## Objective
What are we doing and why.

## Scope
- In scope: ...
- Out of scope: ...

## Acceptance Criteria
How we know it's done.

## Context
Key codebase findings from scout + research brief from researcher.

## Constraints
Time, tech, compatibility, security, etc.

## Risks
Known risks and mitigations.

## User Decisions
Key decisions the user made during clarification.
```

## Handle errors gracefully
If scout or researcher fail, proceed with what you have and note the gap. If the objective doc is missing, report the error clearly and stop.
