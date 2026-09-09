---
description: Take high-level spec and produce detailed implementation plan with codebase exploration via scout.
model: openrouter/openai/gpt-5.6-luna
thinking: high 
---
# Plan: $1 → $2

You are running a planning workflow. Take the high-level spec and produce a low-level implementation plan.

## Args
- $1: path to high-level spec document (markdown)
- $2: path to write detailed implementation plan (markdown)

## Workflow

### Phase 1: Read spec
Read the high-level spec at `$1`. Understand the full scope, acceptance criteria, and constraints.

### Phase 2: Explore codebase
Use the **scout** subagent to explore the codebase. Provide a detailed task including:
- The full spec content
- Ask scout to find: relevant entry points, key types/interfaces, data flow, files likely needing changes, existing patterns to follow, test files, config files
- Target output: a compressed context markdown

Call: `subagent({ agent: "scout", task: "<detailed task>" })`

Wait for scout's output.

### Phase 3: Ask clarifying questions (if needed)
If the spec has gaps that prevent a detailed plan, use `ask_user_question` to resolve them. Ask no more than 2 questions and only about genuinely blocking unknowns.

### Phase 4: Write implementation plan
Write the detailed plan to `$2`. Do not write any code.

## Output format for $2

```markdown
# Implementation Plan: [Feature/Change]

## Overview
Brief description of the change.

## Codebase Context
Key files, types, and patterns found by scout.

## Implementation Steps
Numbered steps in dependency order:

1. **Step Name**
   - Files to modify: path/to/file.ts (lines X-Y for each change)
   - What to change: precise description
   - Why: rationale
   - Risks: what could go wrong
   - Tests: what to add/update

2. **Step Name**
   - ...

## Data Flow
How data moves through the change. Include key types/interfaces.

## Testing Strategy
What tests to add, modify, or verify.

## Migration / Rollback
If applicable, how to deploy safely and roll back.

## Open Questions
Any decisions the implementer must make.

## Dependencies
List of steps that must happen before others.
```

## Constraints
- Do not write any code. Only output the plan markdown.
- Be precise about file paths and line ranges.
- If scout fails, proceed with what you know and note the gap.
