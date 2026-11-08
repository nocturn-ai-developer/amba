import "server-only";
import { z } from "zod";
import type { Project } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, type SessionUser } from "@/lib/api";
import { planLimits } from "@/lib/plans";
import * as fsx from "@/lib/projects/filesystem";
import { PROTECTED_FILES as MANAGED, PathError, assertWritablePath } from "@/lib/projects/paths";
import { createProjectForUser } from "@/lib/projects/service";
import { log } from "@/lib/logger";

export const filesSchema = z
  .array(z.object({ path: z.string().min(1).max(200), content: z.string().max(512 * 1024) }))
  .min(1)
  .max(400);

export type ImportFile = z.infer<typeof filesSchema>[number];

/** Max JSON body for an import: 400 files of up to 512 KB would be far more; real projects are small. */
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024;

/**
 * Replaces a project's files with `files`. Every path goes through the normal write rules
 * (normalization, confinement, allowed extensions, size limits); managed toolchain files are left alone.
 */
export async function replaceFiles(project: Pick<Project, "id">, user: Pick<SessionUser, "plan">, files: ImportFile[]) {
  const wanted = new Map<string, string>();
  for (const f of files) {
    if (MANAGED.has(f.path)) continue;
    let p: string;
    try {
      p = assertWritablePath(f.path);
    } catch (err) {
      if (err instanceof PathError) throw new ApiError(400, `${f.path}: ${err.message}`);
      throw err;
    }
    wanted.set(p, f.content);
  }
  if (!wanted.has("index.html") || ![...wanted.keys()].some((p) => p.startsWith("src/"))) {
    throw new ApiError(400, "A project needs index.html and a src/ folder.");
  }
  const total = [...wanted.values()].reduce((s, c) => s + Buffer.byteLength(c), 0);
  const limits = planLimits(user.plan);
  if (total > limits.maxProjectSizeBytes) throw new ApiError(413, "The project is larger than your plan allows.");

  await fsx.ensureWorkingCopy(project.id);
  for (const f of await fsx.listFiles(project.id)) {
    if (!wanted.has(f.path) && !MANAGED.has(f.path)) await fsx.deleteFile(project.id, f.path);
  }
  for (const [p, content] of wanted) await fsx.writeFile(project.id, p, content);
  await fsx.syncSize(project.id);
  return wanted.size;
}

/** Creates a ready project from existing files (e.g. published from the desktop app). No AI run. */
export async function importProjectForUser(user: SessionUser, input: { name: string; description?: string; files: ImportFile[] }) {
  const project = await createProjectForUser(user, { prompt: input.description?.trim() || input.name, name: input.name });
  try {
    await replaceFiles(project, user, input.files);
  } catch (err) {
    await prisma.project.delete({ where: { id: project.id } }).catch(() => undefined);
    await fsx.removeProject(project.id).catch(() => undefined);
    throw err;
  }
  const ready = await prisma.project.update({ where: { id: project.id }, data: { status: "READY", initialPrompt: null } });
  log.info("project.imported", { userId: user.id, projectId: project.id, files: input.files.length });
  return ready;
}
