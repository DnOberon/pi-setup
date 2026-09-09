---
name: harness-audit
description: Audits Pi harness configuration, agent definitions, packages, models, workflows, and safety boundaries. Use when changing ~/.pi/agent or diagnosing child-run failures.
license: MIT
---

# Harness Audit

Audit current Pi configuration before changing orchestration.

## Fast check

Run `/harness-check` after restarting Pi or `/reload`. Record every error and warning. The command checks:

- `agents/*.md` frontmatter, names, model fields, and thinking levels
- custom agents required by `extensions/spec-policy.ts`
- package entries in `settings.json` and locally installed npm packages
- registered workflow commands and referenced agent names

## Manual review

Inspect these files when check reports drift:

```text
AGENTS.md
README.md
settings.json
extensions/spec-policy.ts
agents/*.md
prompts/*.md
```

Compare role names, model IDs, thinking modes, tool permissions, writer ownership, approval gates, and documented commands. Use `pi --list-models` to verify model availability without reading credentials.

## Safety

Do not read or print `auth.json`. Do not send private source, secrets, customer data, or session logs to external research. Review third-party package source before installing. Do not run package updates as part of an audit.

Treat workspace files as credential-bearing even when `.gitignore` excludes them. Check sandbox policy for the workspace `auth.json`, `.env*`, `.envrc`, provider credential files, and package-manager auth files. Verify both macOS and Linux launch paths deny or exclude those files; broad workspace allows must not override later sensitive-file denies. Verify private-data preflight catches all of these forms without flagging ordinary prose:

```text
OPENAI_API_KEY=sk-example-value
AWS_ACCESS_KEY_ID: example-access-key
"OPENAI_API_KEY": "sk-example-value"
{"OPENROUTER_API_KEY": "or-example-value"}
```

Also test quoted YAML/JSON keys with single quotes and ensure documentation text such as `Set OPENAI_API_KEY in your environment` is not treated as a credential assignment.

Run sandbox smoke tests from a temporary workspace containing harmless marker files named `auth.json`, `.env`, `.env.local`, `credentials.json`, and `secrets.json`. Confirm a sandboxed Pi process cannot read them, while ordinary source files remain readable and writable. Also test that exported `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `*_TOKEN`, cloud credentials, npm auth, and proxy credentials are absent inside the sandbox. Do not use real credentials in smoke tests. Network remains enabled for provider access; environment and filesystem restrictions are separate controls.

## Output

Report:

1. `P0` blocking runtime or safety failures
2. `P1` configuration drift requiring deliberate repair
3. `P2` documentation or ergonomic cleanup
4. exact files and validation commands
5. residual risks and checks not run

Fix only approved, in-scope configuration changes. Run `/harness-check` again after edits.
