import "server-only";
import type { Project } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { log, errorMessage } from "@/lib/logger";
import { planLimits } from "@/lib/plans";
import type { SessionUser } from "@/lib/api";
import * as fsx from "@/lib/projects/filesystem";
import { addLog } from "@/lib/projects/logs";
import { refreshPreview } from "@/lib/runtime/preview";
import { getProjectDomain } from "@/lib/deployment/domain";
import { AGENT_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT } from "./prompts";
import { RECENT_MESSAGES, renderContext, selectRelevantFiles } from "./context";
import { TOOL_DEFINITIONS, executeTool, type FileOperation } from "./tools";
import { recordUsage } from "./usage";
import { normalizeSkills } from "@/lib/skills";
import { skillPrompts } from "./skill-prompts";
import type { ResolvedAi } from "./settings";
import { AiProviderError, type ChatMessage, type ToolResult, type TurnResult, type Usage } from "./providers/types";

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "text"; delta: string }
  | { type: "tool"; id: string; name: string; status: "running" | "done" | "error"; label?: string }
  | { type: "build"; status: "running" | "ok" | "failed" | "unavailable"; attempt?: number; errors?: string }
  | { type: "preview"; url: string | null }
  | { type: "done"; messageId: string; summary: string; operations: FileOperation[]; buildOk: boolean | null }
  | { type: "error"; message: string };

/** The base prompt plus the project's enabled skills (Anthropic puts its cache breakpoint on the last block). */
export function systemFor(skills: readonly string[]): string[] {
  return [AGENT_SYSTEM_PROMPT, ...skillPrompts(normalizeSkills(skills))];
}

// One agent run per project at a time (per app instance).
const running = new Set<string>();
export function isAgentRunning(projectId: string) {
  return running.has(projectId);
}

type Totals = Usage;

/** Folds older messages into the rolling summary. Returns the usage it caused, if any. */
async function maybeSummarize(ai: ResolvedAi, conversationId: string, userId: string, projectId: string): Promise<Totals | null> {
  const convo = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!convo) return null;
  const pending = await prisma.message.findMany({
    where: { conversationId, ...(convo.summarizedUntil ? { createdAt: { gt: convo.summarizedUntil } } : {}) },
    orderBy: { createdAt: "asc" },
  });
  // Keep the live window small; fold everything older into the rolling summary.
  if (pending.length <= RECENT_MESSAGES * 2) return null;
  const toFold = pending.slice(0, pending.length - RECENT_MESSAGES);
  const transcript = toFold.map((m) => `${m.role}: ${m.content.slice(0, 2000)}`).join("\n\n");
  const started = Date.now();
  try {
    const msg = await ai.provider.turn({
      system: [SUMMARY_SYSTEM_PROMPT],
      messages: [
        {
          role: "user",
          content: `<previous_summary>\n${convo.summary}\n</previous_summary>\n<conversation>\n${transcript}\n</conversation>`,
        },
      ],
      maxTokens: 2000,
      effort: "low",
    });
    const u = msg.usage;
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { summary: msg.text.slice(0, 4000), summarizedUntil: toFold[toFold.length - 1].createdAt },
    });
    await recordUsage({ userId, projectId, kind: "ai.summarize", model: ai.provider.model, ...u, durationMs: Date.now() - started, success: true });
    return u;
  } catch (err) {
    log.warn("ai.summarize.failed", { projectId, error: errorMessage(err) });
    return null;
  }
}

/** Loads source contents used for relevance scoring (small text files only). */
async function loadForScoring(projectId: string, files: fsx.FileEntry[]) {
  const map = new Map<string, string>();
  for (const f of files) {
    if (f.size > 64 * 1024 || !/\.(tsx?|jsx?|css|html|md|json)$/.test(f.path)) continue;
    map.set(f.path, await fsx.readFile(projectId, f.path).catch(() => ""));
  }
  return map;
}

export interface RunAgentInput {
  user: SessionUser;
  project: Project;
  prompt: string;
  emit: (e: AgentEvent) => void;
  /** The user's own AI provider (their Anthropic key, or a local model in the desktop app). */
  ai: ResolvedAi;
}

export async function runAgent({ user, project, prompt, emit, ai }: RunAgentInput): Promise<void> {
  if (running.has(project.id)) {
    emit({ type: "error", message: "The AI is already working on this project." });
    return;
  }
  running.add(project.id);
  const started = Date.now();
  const totals: Totals = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const operations: FileOperation[] = [];
  const activity: string[] = [];
  let finalText = "";
  let buildOk: boolean | null = null;
  let success = false;
  const wasDeployed = project.status === "DEPLOYED";
  const isFirstRun = project.status === "CREATING";

  const conversation =
    (await prisma.conversation.findUnique({ where: { projectId: project.id } })) ??
    (await prisma.conversation.create({ data: { projectId: project.id } }));

  try {
    await prisma.message.create({ data: { conversationId: conversation.id, role: "USER", content: prompt } });
    await prisma.project.update({ where: { id: project.id }, data: { status: "BUILDING" } });
    await addLog(project.id, "AI", "INFO", `Working on your request (${ai.provider.model})`);
    emit({ type: "status", message: "Reading your project" });

    await maybeSummarize(ai, conversation.id, user.id, project.id);
    await fsx.ensureWorkingCopy(project.id);

    // ---- Context ----
    const convo = await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } });
    const recent = (
      await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
        take: RECENT_MESSAGES + 1,
      })
    )
      .reverse()
      .slice(0, -1) // exclude the request we just stored
      .map((m) => ({ role: m.role, content: m.content }));
    const files = await fsx.listFiles(project.id);
    const contents = await loadForScoring(project.id, files);
    const relevantPaths = selectRelevantFiles(files, prompt, (p) => contents.get(p), {
      isNewProject: isFirstRun,
      budgetChars: ai.limits.budgetChars,
      maxFiles: ai.limits.maxFiles,
    });
    const relevant = relevantPaths.map((p) => ({ path: p, content: contents.get(p) ?? "" }));
    const contextText = renderContext({
      project: {
        name: project.name,
        slug: project.slug,
        description: project.description,
        framework: project.framework,
        domain: getProjectDomain(project.slug),
        deployed: wasDeployed,
      },
      files,
      relevant,
      summary: convo.summary,
      recent,
      request: prompt,
    });

    const messages: ChatMessage[] = [{ role: "user", content: contextText }];
    const system = systemFor(project.skills);
    const limits = planLimits(user.plan);

    let dirtySinceBuild = isFirstRun;
    let repairAttempts = 0;
    let lastBuildErrors = "";
    let buildUnavailable = false;

    const runBuild = async () => {
      const attempt = repairAttempts + 1;
      emit({ type: "build", status: "running", attempt });
      const res = await refreshPreview(project);
      if (res.infrastructure) {
        buildUnavailable = true;
        emit({ type: "build", status: "unavailable", errors: res.errors });
        return { ok: true, errors: "" }; // cannot verify; don't make Claude chase infrastructure errors
      }
      buildOk = res.ok;
      dirtySinceBuild = !res.ok;
      lastBuildErrors = res.errors;
      emit({ type: "build", status: res.ok ? "ok" : "failed", attempt, errors: res.ok ? undefined : res.errors.slice(0, 4000) });
      if (res.ok) emit({ type: "preview", url: res.previewUrl });
      return { ok: res.ok, errors: res.errors };
    };

    let jsonRetries = 0;
    for (let step = 0; step < env.aiMaxAgentSteps; step++) {
      emit({ type: "status", message: step === 0 ? "The AI is thinking" : "The AI is working" });
      let message: TurnResult;
      try {
        message = await ai.provider.turn(
          { system, messages, tools: TOOL_DEFINITIONS },
          {
            onText: (delta) => emit({ type: "text", delta }),
            onToolStart: (id, name) => emit({ type: "tool", id, name, status: "running" }),
          },
        );
        jsonRetries = 0;
      } catch (err) {
        // Streaming can surface unparseable output; retry the turn a couple of times. Provider errors are final.
        if (err instanceof AiProviderError || jsonRetries++ >= 2) throw err;
        log.warn("ai.turn.retry", { projectId: project.id, error: errorMessage(err) });
        continue;
      }
      totals.inputTokens += message.usage.inputTokens;
      totals.outputTokens += message.usage.outputTokens;
      totals.cacheReadTokens += message.usage.cacheReadTokens;
      totals.cacheWriteTokens += message.usage.cacheWriteTokens;
      if (message.text) finalText = message.text;

      messages.push({ role: "assistant", text: message.text, toolCalls: message.toolCalls, native: message.native });
      if (message.stop === "pause") continue;

      if (message.toolCalls.length > 0) {
        const results: ToolResult[] = [];
        for (const tu of message.toolCalls) {
          if (message.stop === "max_tokens") {
            // A tool input cut off at max_tokens may parse as a valid but truncated object: never apply it.
            results.push({ id: tu.id, name: tu.name, isError: true, content: "Output was truncated before this call finished. Split the change into smaller files or use edit_file." });
            emit({ type: "tool", id: tu.id, name: tu.name, status: "error", label: "Output truncated" });
            continue;
          }
          const outcome = await executeTool(tu.name, tu.input, {
            projectId: project.id,
            maxProjectSizeBytes: limits.maxProjectSizeBytes,
            runBuild,
          });
          if (outcome.operation) {
            operations.push(outcome.operation);
            dirtySinceBuild = true;
          }
          activity.push(outcome.label);
          emit({ type: "tool", id: tu.id, name: tu.name, status: outcome.isError ? "error" : "done", label: outcome.label });
          results.push({ id: tu.id, name: tu.name, content: outcome.content, isError: outcome.isError || undefined });
        }
        messages.push({ role: "tool", results });
        continue;
      }

      // The model finished. Verify the build unless the last thing it did was a passing build.
      if (dirtySinceBuild && !buildUnavailable) {
        const res = await runBuild();
        if (!res.ok) {
          if (repairAttempts < env.aiMaxRepairAttempts) {
            repairAttempts++;
            emit({ type: "status", message: `Your application failed to build. The AI is attempting to fix it (${repairAttempts}/${env.aiMaxRepairAttempts}).` });
            await addLog(project.id, "AI", "WARN", `Automatic repair attempt ${repairAttempts}`);
            messages.push({
              role: "user",
              content: `Automatic check from the platform: the build failed after your changes. Fix the errors with minimal changes, then run_build again.\n<build_errors>\n${res.errors.slice(0, 8000)}\n</build_errors>`,
            });
            continue;
          }
          throw new BuildFailedError(lastBuildErrors);
        }
      }
      success = true;
      break;
    }
    if (!success) throw new Error("Agent step limit reached");

    const summary = finalText || (operations.length ? "Applied your changes." : "No changes were needed.");
    const saved = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: summary,
        metadata: { operations, activity, buildOk, repairAttempts, buildUnavailable } as object,
      },
    });
    await fsx.syncSize(project.id);
    await addLog(project.id, "AI", "SUCCESS", `AI finished: ${operations.length} file operation(s)`);
    emit({ type: "done", messageId: saved.id, summary, operations, buildOk });
  } catch (err) {
    const userMessage =
      err instanceof BuildFailedError
        ? "Your application failed to build after 3 automatic repair attempts. The preview still shows the last working version — try describing the change differently."
        : err instanceof AiProviderError
          ? err.message
          : "The AI could not complete this change.";
    log.error("ai.run.failed", { userId: user.id, projectId: project.id, error: errorMessage(err) });
    await addLog(project.id, "AI", "ERROR", userMessage);
    await prisma.message
      .create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: userMessage,
          metadata: { operations, activity, error: true } as object,
        },
      })
      .catch(() => undefined);
    emit({ type: "error", message: userMessage });
  } finally {
    running.delete(project.id);
    const durationMs = Date.now() - started;
    // Record token usage for runs that reached the model (shown to the user; no billing).
    if (totals.inputTokens + totals.outputTokens > 0) {
      await recordUsage({
        userId: user.id,
        projectId: project.id,
        kind: "ai.generate",
        model: ai.provider.model,
        ...totals,
        durationMs,
        success,
      }).catch(() => undefined);
    }
    const live = await prisma.deployment.count({ where: { projectId: project.id, kind: "PRODUCTION", status: "RUNNING" } });
    const status = live > 0 ? "DEPLOYED" : success || !isFirstRun ? "READY" : "ERROR";
    await prisma.project.update({ where: { id: project.id }, data: { status } }).catch(() => undefined);
    log.info("ai.run.finished", {
      userId: user.id,
      projectId: project.id,
      success,
      durationMs,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      cacheReadTokens: totals.cacheReadTokens,
      operations: operations.length,
      buildOk,
    });
  }
}

class BuildFailedError extends Error {
  constructor(public errors: string) {
    super("Build failed after repair attempts");
  }
}
