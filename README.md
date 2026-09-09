# pi-agent

My Pi coding agent config — multi-agent planning and shipping workflows.

## How it works

Pi (the main session) stays the decision-maker. Child agents do bounded work: reconnaissance, design critique, planning, implementation, review, fixing. Writes are single-threaded — one worker at a time. Reviewers are read-only.

The core loop: spec → clarify → scout → design pushback → plan → human approval → implement → review → fix → validate → accept.

## Agents

| Agent | Role | Read-only? |
| --- | --- | --- |
| `scout` | Local repo recon — maps the codebase | yes |
| `researcher` | Web research (opt-in, needs approval) | yes |
| `design-critic` | Bounded pre-implementation adversarial review | yes |
| `planner` | Synthesizes evidence into a plan | yes |
| `plan-writer` | Writes the plan markdown file | no (writes only plan) |
| `worker` / `implementer` | Implements the approved plan | no (single writer) |
| `reviewer` | Correctness + regression review | yes |
| `auditor` | Security, style, structure audit | yes |
| `oracle` | Hard decisions, deep architecture | yes |

## Models

| Role | Model | Thinking |
| --- | --- | --- |
| scout, researcher, delegate | DeepSeek V4 Flash (OpenRouter) | off |
| planner, worker, reviewer, design-critic | GPT-5.6 Luna (OpenRouter) | low–medium |
| oracle | GPT-5.6 Sol (OpenRouter) | high |

Copilot Luna is fallback when OpenRouter is unavailable. Local providers (ollama, lmstudio, llama-cpp) are opt-in overrides for sensitive projects.

## Commands

- `/spec-plan <spec.md> [plan.md]` — local planning (scout → design-critic → planner). No web research, safe for private specs.
- `/spec-plan-research <spec.md> [plan.md]` — same but includes web research. Requires explicit approval. Don't use with secrets.
- `/spec-ship <plan.md>` — implement an approved plan. Runs worker, reviewers, auditor, then a fix worker for P0 findings. P1 needs approval, P2 is report-only.
- `/harness-check` — validate agents, packages, models, and extension commands after making changes.
- `/prompt-workflow <name>` — invoke saved prompt templates from `prompts/`.

Plans stop after writing. Human approval required before shipping. No auto-merge, no auto-release.

## Safety notes

- **Untrusted workspace** — launch through `pi-sandbox.sh /path/to/workspace`. The wrapper strips auth.json and restricts filesystem scope. Subagent workflows do not enforce sandboxing on their own.
- **Secrets in specs** — the planning commands scan for credential patterns and refuse to run if they find any. Don't put API keys, tokens, or private data in specs sent to remote providers.
- **Project trust** controls what Pi loads from a project directory — it's not a sandbox. Extensions, MCP servers, and child agents run with your user permissions.
- **Tidewave MCP** is globally disabled (exposes eval, SQL, and mutation tools). Opt in per-project by enabling it in `.pi/mcp.json`.

## Skills

- `harness-audit` — detailed audit of agents, models, packages, workflows
- `session-retrospective` — analyze session logs for reliability and waste
- `release-gate` — final acceptance checks before merge/release

## Local development

Custom agents live in `agents/`. Prompt templates in `prompts/`. The main workflow extension is `extensions/spec-policy.ts`. Skills load on demand from `skills/`.

After changing anything global, restart Pi or run `/reload`.
