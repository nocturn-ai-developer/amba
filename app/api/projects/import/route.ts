import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, parseJson, requireUser, route } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { IMPORT_MAX_BYTES, filesSchema, importProjectForUser } from "@/lib/projects/import";
import { getProjectDomain } from "@/lib/deployment/domain";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(280).optional(),
  files: filesSchema,
});

/**
 * POST /api/projects/import — creates a project from existing files without an AI run.
 * Used by the desktop app's Publish (with a stardoom_sk_ key); works with a browser session too.
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  await enforceRateLimit(`project:create:${user.id}`, LIMITS.projectCreate);
  const body = await parseJson(req, schema, IMPORT_MAX_BYTES);
  const project = await importProjectForUser(user, body);
  return NextResponse.json({ id: project.id, slug: project.slug, domain: getProjectDomain(project.slug) }, { status: 201 });
});
