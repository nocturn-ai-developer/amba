import fs from "fs/promises";
import path from "path";
import { requireProject, requireUser, route } from "@/lib/api";
import { env } from "@/lib/env";
import { ensureWorkingCopy, readAllFiles } from "@/lib/projects/filesystem";
import { siteDir } from "@/lib/runtime/local";
import { createZip, type ZipEntry } from "@/lib/zip";

export const runtime = "nodejs";

async function walk(root: string, rel = ""): Promise<string[]> {
  const out: string[] = [];
  for (const e of await fs.readdir(path.join(root, rel), { withFileTypes: true }).catch(() => [])) {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walk(root, p)));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/**
 * GET /api/projects/:id/export — a zip of the project's source ({slug}/…). In the desktop app the last
 * successful build is included as {slug}/dist/, ready to host anywhere as static files.
 */
export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  await ensureWorkingCopy(project.id);
  const entries: ZipEntry[] = (await readAllFiles(project.id)).map((f) => ({ path: `${project.slug}/${f.path}`, data: f.content }));
  if (env.appMode === "desktop") {
    const site = siteDir(project.id, "preview");
    for (const p of await walk(site)) entries.push({ path: `${project.slug}/dist/${p}`, data: await fs.readFile(path.join(site, ...p.split("/"))) });
  }
  const zip = createZip(entries);
  return new Response(new Uint8Array(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${project.slug}.zip"`,
      "content-length": String(zip.length),
      "cache-control": "no-store",
    },
  });
});
