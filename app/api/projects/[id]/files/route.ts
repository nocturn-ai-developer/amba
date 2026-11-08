import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, parseJson, requireProject, requireUser, route } from "@/lib/api";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { LIMITS } from "@/lib/rate-limit";
import { isAgentRunning } from "@/lib/ai/agent";
import { IMPORT_MAX_BYTES, filesSchema, replaceFiles } from "@/lib/projects/import";
import { ensureWorkingCopy, listFiles, readFile } from "@/lib/projects/filesystem";

export const runtime = "nodejs";

/**
 * GET /api/projects/:id/files           -> file tree
 * GET /api/projects/:id/files?path=...  -> one file's contents (read-only code view)
 * Paths are validated and confined to the project root by the filesystem layer.
 */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  await ensureWorkingCopy(project.id);
  const path = new URL(req.url).searchParams.get("path");
  if (path) {
    const content = await readFile(project.id, path);
    return NextResponse.json({ path, content });
  }
  return NextResponse.json({ files: await listFiles(project.id) });
});

/**
 * PUT /api/projects/:id/files  { files: [{ path, content }] } — replaces every project file.
 * Used to republish from the desktop app. Paths go through the normal write rules.
 */
export const PUT = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  await enforceRateLimit(`deploy:${user.id}`, LIMITS.deploy);
  if (isAgentRunning(project.id)) throw new ApiError(409, "The AI is working on this project. Try again when it finishes.");
  const { files } = await parseJson(req, z.object({ files: filesSchema }), IMPORT_MAX_BYTES);
  const count = await replaceFiles(project, user, files);
  if (project.status === "CREATING" || project.status === "ERROR") {
    await prisma.project.update({ where: { id: project.id }, data: { status: "READY", initialPrompt: null } });
  }
  return NextResponse.json({ ok: true, files: count });
});
