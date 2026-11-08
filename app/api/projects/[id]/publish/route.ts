import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError, enforceRateLimit, requireProject, requireUser, route } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { getSettings, publishCredentials } from "@/lib/ai/settings";
import { isAgentRunning } from "@/lib/ai/agent";
import { ensureWorkingCopy, readAllFiles } from "@/lib/projects/filesystem";
import { addLog } from "@/lib/projects/logs";
import { log, errorMessage } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Calls the user's Stardoom web account with their stardoom_sk_ key. */
async function remote(base: string, key: string, path: string, init: { method: string; body?: unknown }) {
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: init.method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });
  } catch {
    throw new ApiError(502, `Could not reach ${base}. Check your internet connection.`);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, ok: res.ok, data };
}

/**
 * POST /api/projects/:id/publish (desktop only) — uploads the project to the user's Stardoom web account
 * (creating it there the first time, replacing its files afterwards) and deploys it.
 */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  if (env.appMode !== "desktop") throw new ApiError(404, "Not found.");
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  await enforceRateLimit(`deploy:${user.id}`, LIMITS.deploy);
  if (isAgentRunning(project.id)) throw new ApiError(409, "Wait for the AI to finish before publishing.");
  if (project.status === "CREATING") throw new ApiError(409, "Build the first version before publishing.");

  const { url: base, key } = publishCredentials(await getSettings(user.id));
  if (!key) throw new ApiError(400, "Connect your Stardoom account in Settings first.", "publish_not_configured");

  await ensureWorkingCopy(project.id);
  const files = (await readAllFiles(project.id)).map((f) => ({ path: f.path, content: f.content.toString("utf8") }));
  await addLog(project.id, "DEPLOY", "INFO", `Publishing to ${base}`);

  let remoteId = project.remoteId;
  if (remoteId) {
    const res = await remote(base, key, `/api/projects/${remoteId}/files`, { method: "PUT", body: { files } });
    if (res.status === 404) remoteId = null; // deleted on the web: publish it again as a new project
    else if (!res.ok) throw new ApiError(res.status === 401 ? 401 : 502, String(res.data.error ?? "Publishing failed."));
  }
  if (!remoteId) {
    const res = await remote(base, key, "/api/projects/import", { method: "POST", body: { name: project.name, description: project.description, files } });
    if (!res.ok) throw new ApiError(res.status === 401 ? 401 : 502, String(res.data.error ?? "Publishing failed."));
    remoteId = String(res.data.id);
    await prisma.project.update({ where: { id: project.id }, data: { remoteId } });
  }

  const deploy = await remote(base, key, `/api/projects/${remoteId}/deploy`, { method: "POST", body: {} });
  const liveUrl = typeof deploy.data.url === "string" ? deploy.data.url : null;
  const webUrl = `${base}/project/${remoteId}`;
  if (!deploy.ok || !liveUrl) {
    log.warn("publish.deploy_failed", { projectId: project.id, status: deploy.status, error: errorMessage(deploy.data.error) });
    await addLog(project.id, "DEPLOY", "ERROR", `Uploaded, but the deploy failed: ${String(deploy.data.error ?? "unknown error")}`);
    return NextResponse.json({ ok: false, error: String(deploy.data.error ?? "Uploaded, but the deploy failed."), webUrl }, { status: 502 });
  }
  await prisma.project.update({ where: { id: project.id }, data: { remoteUrl: liveUrl } });
  await addLog(project.id, "DEPLOY", "SUCCESS", `Live at ${liveUrl}`);
  return NextResponse.json({ ok: true, url: liveUrl, webUrl, remoteId });
});
