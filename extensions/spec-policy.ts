import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type ShipDecision = { question: string; answer: string };

function extractGateQuestions(plan: string): string[] {
  const match = plan.match(
    /## Owner decisions \/ implementation gate[\s\S]*?(?=\n## |$)/i,
  );
  if (!match) return [];

  return match[0]
    .split("\n")
    .map((line) => line.match(/^\s*(?:\d+[.)]|[-*])\s+(.+?)\s*$/)?.[1]?.trim())
    .filter((question): question is string => Boolean(question));
}

function extractResolvedDecisions(plan: string): ShipDecision[] {
  const match = plan.match(
    /## Resolved implementation decisions[\s\S]*?(?=\n## |$)/i,
  );
  if (!match) return [];

  return match[0]
    .split("\n")
    .map((line) => {
      const decision = line.match(/^\s*[-*]\s+(.+?)\s+—\s+(.+?)\s*$/);
      return decision
        ? { question: decision[1].trim(), answer: decision[2].trim() }
        : undefined;
    })
    .filter((decision): decision is ShipDecision => Boolean(decision));
}

function normalizeDecisionText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[?.:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAllResolvedDecisions(plan: string, questions: string[]): boolean {
  const resolved = extractResolvedDecisions(plan);
  return questions.every((question) =>
    resolved.some(
      (decision) =>
        normalizeDecisionText(decision.question) ===
        normalizeDecisionText(question),
    ),
  );
}

async function collectShipDecisions(
  ctx: any,
  plan: string,
): Promise<ShipDecision[] | undefined> {
  const questions = extractGateQuestions(plan);
  const resolved = extractResolvedDecisions(plan);
  if (hasAllResolvedDecisions(plan, questions)) return resolved;

  const decisions = [...resolved];
  const unresolved = questions.filter(
    (question) =>
      !resolved.some(
        (decision) =>
          normalizeDecisionText(decision.question) ===
          normalizeDecisionText(question),
      ),
  );

  for (let index = 0; index < unresolved.length; index++) {
    const answer = await ctx.ui.input(
      `Decision ${index + 1}/${unresolved.length}: ${unresolved[index]}`,
      "Enter decision",
    );
    if (!answer?.trim()) return undefined;
    decisions.push({ question: unresolved[index], answer: answer.trim() });
  }
  return decisions;
}

function resolvePlanGates(
  planPath: string,
  plan: string,
  decisions: ShipDecision[],
): void {
  if (decisions.length === 0) return;
  const decisionBlock = [
    "## Resolved implementation decisions",
    "",
    ...decisions.map(({ question, answer }) => `- ${question} — ${answer}`),
    "",
    "Implementation gate resolved interactively by `/spec-ship`. These decisions are approved for this run.",
    "",
  ].join("\n");
  const gatePattern =
    /## Owner decisions \/ implementation gate[\s\S]*?(?=\n## |$)/i;
  const nextPlan = gatePattern.test(plan)
    ? plan.replace(gatePattern, decisionBlock.trimEnd())
    : `${plan.trimEnd()}\n\n${decisionBlock}`;
  writeFileSync(planPath, nextPlan.endsWith("\n") ? nextPlan : `${nextPlan}\n`);
}

type Targets = { specPath: string; planPath: string };

type HarnessCheck = {
  errors: string[];
  warnings: string[];
  info: string[];
};

const requiredWorkflowAgents = [
  "scout",
  "design-critic",
  "planner",
  "plan-writer",
  "researcher",
  "worker",
  "reviewer",
  "auditor",
];

function harnessRoot(): string {
  return resolve(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"));
}

function frontmatterValue(frontmatter: string, key: string): string | undefined {
  return frontmatter
    .split("\n")
    .map((line) => line.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`)))
    .find((match): match is RegExpMatchArray => Boolean(match))?.[1];
}

function readAgentFrontmatter(path: string): string | undefined {
  const source = readFileSync(path, "utf8");
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  return match?.[1];
}

function npmPackageName(source: string): string | undefined {
  if (!source.startsWith("npm:")) return undefined;
  const raw = source.slice(4);
  if (raw.startsWith("@")) {
    const slash = raw.indexOf("/");
    if (slash < 0) return undefined;
    const version = raw.indexOf("@", slash);
    return version < 0 ? raw : raw.slice(0, version);
  }
  const version = raw.indexOf("@");
  return version < 0 ? raw : raw.slice(0, version);
}

function runHarnessCheck(): HarnessCheck {
  const result: HarnessCheck = { errors: [], warnings: [], info: [] };
  if (process.env.PI_SANDBOXED !== "1") {
    result.warnings.push(
      "Pi process is not marked PI_SANDBOXED=1; use pi-sandbox.sh for untrusted workspaces. Child workflows do not enforce sandboxing.",
    );
  }
  const root = harnessRoot();
  const agentsDir = join(root, "agents");
  const customAgents = new Set<string>();

  if (!existsSync(agentsDir)) {
    result.errors.push(`Missing agents directory: ${agentsDir}`);
  } else {
    for (const filename of readdirSync(agentsDir).filter((name) => name.endsWith(".md"))) {
      const path = join(agentsDir, filename);
      try {
        const frontmatter = readAgentFrontmatter(path);
        if (!frontmatter) {
          result.errors.push(`${filename}: missing YAML frontmatter`);
          continue;
        }
        const name = frontmatterValue(frontmatter, "name");
        const model = frontmatterValue(frontmatter, "model");
        const thinking = frontmatterValue(frontmatter, "thinking");
        if (!name) result.errors.push(`${filename}: missing name`);
        else customAgents.add(name);
        if (!model) result.errors.push(`${filename}: missing model`);
        else if (!/^[^/\s]+\/.+/.test(model)) {
          result.errors.push(`${filename}: malformed model '${model}'`);
        }
        if (thinking && !["off", "low", "medium", "high"].includes(thinking)) {
          result.errors.push(`${filename}: unsupported thinking level '${thinking}'`);
        }
      } catch (error) {
        result.errors.push(`${filename}: cannot read (${error instanceof Error ? error.message : String(error)})`);
      }
    }
  }

  for (const agent of requiredWorkflowAgents) {
    if (["design-critic", "planner", "plan-writer", "auditor"].includes(agent) && !customAgents.has(agent)) {
      result.errors.push(`Workflow references missing custom agent '${agent}'`);
    }
  }

  const settingsPath = join(root, "settings.json");
  if (!existsSync(settingsPath)) {
    result.errors.push(`Missing settings file: ${settingsPath}`);
  } else {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
        packages?: Array<string | { source?: string }>;
      };
      if (!Array.isArray(settings.packages) || settings.packages.length === 0) {
        result.errors.push("settings.json: packages must contain at least one entry");
      } else {
        for (const entry of settings.packages) {
          const source = typeof entry === "string" ? entry : entry.source;
          if (!source) {
            result.errors.push("settings.json: package entry has no source");
            continue;
          }
          const packageName = npmPackageName(source);
          if (packageName && !existsSync(join(root, "npm", "node_modules", packageName))) {
            result.errors.push(`Package not installed locally: ${source}`);
          } else if (source.startsWith("git:") || /^https?:/.test(source)) {
            result.warnings.push(`Package install not locally verified: ${source}`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`settings.json: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  const extensionPath = join(root, "extensions", "spec-policy.ts");
  if (!existsSync(extensionPath)) {
    result.errors.push(`Missing workflow extension: ${extensionPath}`);
  } else {
    const extension = readFileSync(extensionPath, "utf8");
    for (const command of ["spec-plan", "spec-plan-research", "spec-ship", "harness-check"]) {
      if (!extension.includes(`registerCommand("${command}"`)) {
        result.errors.push(`Workflow extension missing /${command} command`);
      }
    }
    for (const agent of requiredWorkflowAgents) {
      if (!extension.includes(agent)) {
        result.warnings.push(`Workflow extension does not name '${agent}' directly; verify runtime workflow mapping`);
      }
    }
  }

  if (result.errors.length === 0) result.info.push(`Harness root valid: ${root}`);
  return result;
}

function isContainedPath(candidate: string, root: string): boolean {
  const rootPath = resolve(root);
  const relativePath = relative(rootPath, candidate);
  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

function safeExistingFile(path: string, cwd: string): string | undefined {
  const candidate = resolve(cwd, path);
  if (!isContainedPath(candidate, cwd)) return undefined;
  try {
    const realPath = realpathSync(candidate);
    return isContainedPath(realPath, realpathSync(cwd)) && statSync(realPath).isFile()
      ? realPath
      : undefined;
  } catch {
    return undefined;
  }
}

function safePlanPath(path: string, cwd: string): string | undefined {
  const candidate = resolve(cwd, path);
  if (!isContainedPath(candidate, cwd)) return undefined;
  try {
    const realPath = realpathSync(candidate);
    return isContainedPath(realPath, realpathSync(cwd)) && statSync(realPath).isFile()
      ? realPath
      : undefined;
  } catch {
    try {
      const parent = realpathSync(dirname(candidate));
      return isContainedPath(parent, realpathSync(cwd)) && statSync(parent).isDirectory()
        ? candidate
        : undefined;
    } catch {
      return undefined;
    }
  }
}

type ParsedTargets = { targets?: Targets; error?: string };

function parseTargets(args: string, cwd: string): ParsedTargets {
  const words = args.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { error: "Usage requires a specification path." };
  const specPath = safeExistingFile(words[0], cwd);
  if (!specPath) {
    return {
      error: `Specification must be a regular file inside current working directory: ${words[0]}`,
    };
  }
  const planInput = words[1] ?? "PLAN.md";
  const planPath = safePlanPath(planInput, cwd);
  if (!planPath) {
    return {
      error: `Plan path must be inside current working directory with an existing parent directory: ${planInput}`,
    };
  }
  return { targets: { specPath, planPath } };
}

function privateDataMarker(specification: string): string | undefined {
  const lines = specification.split(/\r?\n/);
  const secretName =
    /(?:api[_ -]?key|access[_ -]?key|api[_ -]?secret|client[_ -]?secret|private[_ -]?key|secret[_ -]?key|encryption[_ -]?key|password|credential|token|aws_access_key_id|openai|anthropic|openrouter|github|gitlab|google|azure|aws|stripe|slack|sentry|database[_ -]?url)/i;
  const assignment =
    /(?:^|[\s{,])([A-Za-z_][A-Za-z0-9 _-]{0,48})\s*(?:=|:)\s*(?:["'][^"'\n]{3,}["']|[A-Za-z0-9_./:+-]{8,})/;
  const quotedJsonAssignment =
    /["']([A-Za-z_][A-Za-z0-9_-]{0,64})["']\s*:\s*(?:["'][^"'\n]{3,}["']|[A-Za-z0-9_./:+-]{8,})/;
  const envSecretAssignment =
    /\b([A-Z][A-Z0-9]*(?:_TOKEN|_API_KEY|_SECRET|_PASSWORD|_ACCESS_KEY_ID|_SECRET_KEY|_PRIVATE_KEY))\s*=\s*(?:["'][^"'\n]{3,}["']|[A-Za-z0-9_./:+-]{3,})/;
  const bearer = /\bauthorization\s*:\s*bearer\s+[A-Za-z0-9._~+/=-]{8,}/i;
  const privateKeyBlock = /-----BEGIN [A-Z ]*PRIVATE KEY-----/i;

  for (const line of lines) {
    const normalized = line.trim();
    if (!normalized || normalized.startsWith("#") || normalized.startsWith("//")) continue;
    if (privateKeyBlock.test(normalized)) return "private-key material";
    if (bearer.test(normalized)) return "authorization bearer token";
    const assignmentMatch = normalized.match(assignment);
    if (assignmentMatch && secretName.test(assignmentMatch[1])) {
      return `credential-like field: ${assignmentMatch[1].trim()}`;
    }
    const quotedJsonMatch = normalized.match(quotedJsonAssignment);
    if (quotedJsonMatch && secretName.test(quotedJsonMatch[1])) {
      return `credential-like field: ${quotedJsonMatch[1].trim()}`;
    }
    if (envSecretAssignment.test(normalized)) return "credential-like environment variable";
  }
  return undefined;
}

function localPlanRequest(targets: Targets): string {
  return [
    "Run one parent-controlled workflowScript for local planning.",
    `Specification: ${JSON.stringify(targets.specPath)}`,
    `Output plan path: ${JSON.stringify(targets.planPath)}`,
    "Do not launch external web research.",
    "Use fresh-context read-only scout and design-critic children in parallel.",
    "Then run planner with both child reports and the specification path.",
    "Then run plan-writer with the specification path, output plan path, planner report, and both review reports.",
    "Plan-writer may write only the requested plan path. No project source edits.",
    "Return the exact written plan path and summary.",
  ].join("\n");
}

function externalPlanRequest(targets: Targets): string {
  return [
    "Run one parent-controlled workflowScript for approved external-research planning.",
    `Specification: ${JSON.stringify(targets.specPath)}`,
    `Output plan path: ${JSON.stringify(targets.planPath)}`,
    "Use fresh-context read-only researcher, scout, and design-critic children in parallel.",
    "Then run planner with all three reports and the specification path.",
    "Then run plan-writer with the specification path, output plan path, planner report, and all review reports.",
    "Plan-writer may write only the requested plan path. No project source edits.",
    "Return the exact written plan path and summary. Do not implement.",
  ].join("\n");
}

function shipRequest(planPath: string, decisions: ShipDecision[]): string {
  return [
    "Run one parent-controlled workflowScript for an approved implementation plan.",
    `Approved plan: ${JSON.stringify(planPath)}`,
    "Resolved implementation decisions are authoritative. Do not reopen them or block on stale acceptance-report wording.",
    `Resolved decisions: ${JSON.stringify(decisions)}`,
    "Run one worker first. Worker is only writer for implementation.",
    "After worker settles, run fresh-context read-only reviewers in parallel for correctness/regressions, tests/validation, simplicity/refactoring, and security/performance audit using the auditor agent.",
    "Then run one fix worker, still within approved plan scope. Give it reviewer reports and current diff.",
    "Fix worker may automatically apply only concrete P0 findings that are safe, in scope, and sufficiently specified. Re-check each finding against current code before editing.",
    "Do not apply P1 or P2 findings automatically. Report P1 findings as explicit approval requests for a later targeted pass; report P2 cleanup and unresolved product, security, API, or architecture decisions as deferred.",
    "Run focused project validation after fixes. Return implementation, review, fix, and validation reports.",
  ].join("\n");
}

/** Parent-side commands for guarded, reusable planning and shipping workflows. */
export default function registerSpecPolicy(pi: ExtensionAPI) {
  pi.registerCommand("spec-plan", {
    description: "Scout and challenge a spec, then write PLAN.md",
    handler: async (args, ctx) => {
      const parsed = parseTargets(args, ctx.cwd);
      if (!parsed.targets) {
        ctx.ui.notify(parsed.error ?? "Invalid plan targets.", "error");
        return;
      }
      const specification = readFileSync(parsed.targets.specPath, "utf8");
      const marker = privateDataMarker(specification);
      if (marker) {
        ctx.ui.notify(
          `Local planning refused: specification contains possible private credential data (${marker}). Remove or redact it before retrying.`,
          "error",
        );
        return;
      }
      await pi.sendUserMessage(localPlanRequest(parsed.targets));
    },
  });

  pi.registerCommand("spec-ship", {
    description:
      "Implement approved plan, review, and fix P0 findings; P1 requires approval",
    handler: async (args, ctx) => {
      const words = args.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        ctx.ui.notify("Usage: /spec-ship <PLAN.md>", "error");
        return;
      }
      const planPath = safeExistingFile(words[0], ctx.cwd);
      if (!planPath) {
        ctx.ui.notify(
          `Plan must be a regular file inside current working directory: ${words[0]}`,
          "error",
        );
        return;
      }
      let decisions: ShipDecision[] | undefined;
      try {
        const plan = readFileSync(planPath, "utf8");
        const questions = extractGateQuestions(plan);
        const alreadyResolved = hasAllResolvedDecisions(plan, questions);
        if (!alreadyResolved && !ctx.hasUI) {
          ctx.ui.notify(
            "spec-ship needs unresolved implementation decisions; run with interactive UI or resolve them in plan.",
            "error",
          );
          return;
        }

        decisions = await collectShipDecisions(ctx, plan);
        if (!decisions) {
          ctx.ui.notify(
            "spec-ship stopped: unresolved implementation decision.",
            "warning",
          );
          return;
        }
        if (!alreadyResolved) resolvePlanGates(planPath, plan, decisions);
      } catch (error) {
        ctx.ui.notify(
          `spec-ship gate failed: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
        return;
      }

      await pi.sendUserMessage(shipRequest(planPath, decisions));
    },
  });

  pi.registerCommand("harness-check", {
    description: "Validate harness agents, packages, and workflow references",
    handler: async (_args, ctx) => {
      try {
        const check = runHarnessCheck();
        for (const message of check.info) ctx.ui.notify(`harness-check: ${message}`, "info");
        for (const message of check.warnings) ctx.ui.notify(`harness-check warning: ${message}`, "warning");
        for (const message of check.errors) ctx.ui.notify(`harness-check error: ${message}`, "error");
        const status = check.errors.length > 0
          ? "failed"
          : check.warnings.length > 0
            ? "warning"
            : "passed";
        ctx.ui.notify(
          `harness-check ${status}: ${check.errors.length} error(s), ${check.warnings.length} warning(s)`,
          check.errors.length > 0 ? "error" : check.warnings.length > 0 ? "warning" : "info",
        );
      } catch (error) {
        ctx.ui.notify(
          `harness-check failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    },
  });

  pi.registerCommand("spec-plan-research", {
    description: "Run external-research planning after explicit approval",
    handler: async (args, ctx) => {
      const parsed = parseTargets(args, ctx.cwd);
      if (!parsed.targets) {
        ctx.ui.notify(parsed.error ?? "Invalid plan targets.", "error");
        return;
      }
      const targets = parsed.targets;
      const specification = readFileSync(targets.specPath, "utf8");
      const marker = privateDataMarker(specification);
      if (marker) {
        ctx.ui.notify(
          `External research refused: specification contains possible private credential data (${marker}). Remove or redact it before retrying.`,
          "error",
        );
        return;
      }

      const approved = ctx.hasUI
        ? await ctx.ui.confirm(
            "Allow external specification research?",
            "Specification context will be sent to remote research/model providers. Do not continue with secrets, private source, customer data, or restricted plans.",
          )
        : process.env.PI_ALLOW_EXTERNAL_RESEARCH === "1";

      if (!approved) {
        ctx.ui.notify(
          "External research cancelled. Headless mode requires PI_ALLOW_EXTERNAL_RESEARCH=1.",
          "warning",
        );
        return;
      }

      const finalSpecification = readFileSync(targets.specPath, "utf8");
      const finalMarker = privateDataMarker(finalSpecification);
      if (finalMarker) {
        ctx.ui.notify(
          `External research refused: specification now contains possible private credential data (${finalMarker}). Remove or redact it before retrying.`,
          "error",
        );
        return;
      }
      await pi.sendUserMessage(externalPlanRequest(targets));
    },
  });
}
