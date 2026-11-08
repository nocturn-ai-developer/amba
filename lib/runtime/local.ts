import "server-only";
import { spawn } from "child_process";
import fs from "fs/promises";
import { createReadStream, existsSync, statSync } from "fs";
import http from "http";
import type { AddressInfo } from "net";
import path from "path";
import { env } from "@/lib/env";
import { readAllFiles } from "@/lib/projects/filesystem";
import type { ContainerKind } from "./docker";

/**
 * Desktop runtime: builds and serves projects on the user's own machine, without Docker.
 *
 * - The toolchain (runtime/package.json installed + build.mjs) ships with the app; STARDOOM_TOOLCHAIN_DIR points at it.
 * - Each build copies the working copy to {STORAGE_PATH}/builds/{id}/{kind}/workspace, links node_modules to the
 *   toolchain, and runs build.mjs in a child process (Electron's own Node via ELECTRON_RUN_AS_NODE).
 * - Generated code is only bundled here, never executed in Node; it runs in the preview iframe (browser sandbox).
 * - Built sites are served by a small static server per project on a random 127.0.0.1 port.
 */
export class LocalRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalRuntimeError";
  }
}

export function toolchainDir() {
  return path.resolve(process.env.STARDOOM_TOOLCHAIN_DIR || path.join(process.cwd(), "runtime"));
}

function buildRoot(projectId: string, kind: ContainerKind) {
  if (!/^[a-z0-9]{20,40}$/.test(projectId)) throw new LocalRuntimeError("Invalid project id");
  return path.join(env.storagePath, "builds", projectId, kind);
}

export function siteDir(projectId: string, kind: ContainerKind) {
  return path.join(buildRoot(projectId, kind), "site");
}

async function ensureToolchain() {
  const dir = toolchainDir();
  if (!existsSync(path.join(dir, "build.mjs")) || !existsSync(path.join(dir, "node_modules", "vite"))) {
    throw new LocalRuntimeError(`The build toolchain is missing in ${dir}. Run "npm ci" in runtime/ (or reinstall the app).`);
  }
  return dir;
}

/** Fresh copy of the project's files, with node_modules pointing at the shared toolchain. */
async function prepareWorkspace(projectId: string, kind: ContainerKind, toolchain: string) {
  const root = buildRoot(projectId, kind);
  const workspace = path.join(root, "workspace");
  await fs.rm(workspace, { recursive: true, force: true });
  await fs.mkdir(workspace, { recursive: true });
  for (const f of await readAllFiles(projectId)) {
    const abs = path.join(workspace, ...f.path.split("/"));
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, f.content);
  }
  // A junction needs no admin rights on Windows; elsewhere a directory symlink.
  await fs.symlink(path.join(toolchain, "node_modules"), path.join(workspace, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  return { root, workspace };
}

export interface LocalExec {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Runs build.mjs for the project; resolves when it exits or is killed at the timeout. */
export async function runLocalBuild(projectId: string, kind: ContainerKind, timeoutSec: number): Promise<LocalExec> {
  const toolchain = await ensureToolchain();
  const { root, workspace } = await prepareWorkspace(projectId, kind, toolchain);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(toolchain, "build.mjs")], {
      cwd: workspace,
      env: {
        // Only what the build needs: no app secrets reach the toolchain.
        PATH: process.env.PATH ?? "",
        SYSTEMROOT: process.env.SYSTEMROOT ?? "",
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production",
        WORKSPACE: workspace,
        SITE_DIR: path.join(root, "site"),
        BUILD_STAGING: path.join(root, "staging"),
        VITE_CACHE_DIR: path.join(root, "vite-cache"),
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutSec * 1000);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ exitCode: signal === "SIGKILL" ? 137 : (code ?? 1), stdout: stdout.slice(-200_000), stderr: stderr.slice(-50_000) });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, stdout, stderr: String(err) });
    });
  });
}

/* ------------------------------------------------------------------ */
/* Static servers                                                      */
/* ------------------------------------------------------------------ */

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
};

/** Same behaviour as runtime/serve.mjs: GET/HEAD only, confined to the root, SPA fallback to index.html. */
export function fileFor(root: string, urlPath: string): string | null {
  let rel: string;
  try {
    rel = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  const abs = path.resolve(root, "." + rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  try {
    const st = statSync(abs);
    if (st.isFile()) return abs;
    if (st.isDirectory()) {
      const idx = path.join(abs, "index.html");
      if (statSync(idx).isFile()) return idx;
    }
  } catch {}
  return null;
}

function handler(root: string): http.RequestListener {
  return (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") return void res.writeHead(405).end();
    let file = fileFor(root, req.url || "/");
    if (!file && !path.extname((req.url || "/").split("?")[0])) file = fileFor(root, "/index.html");
    if (!file) return void res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    const ext = path.extname(file);
    res.writeHead(200, {
      "access-control-allow-origin": "*",
      "content-type": TYPES[ext] || "application/octet-stream",
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff",
    });
    if (req.method === "HEAD") return void res.end();
    createReadStream(file).pipe(res);
  };
}

const g = globalThis as unknown as { __stardoomServers?: Map<string, { server: http.Server; port: number }> };
const servers = (g.__stardoomServers ??= new Map());

/** Starts (once) the static server for a project's built site and returns its port. */
export async function ensureServer(projectId: string, kind: ContainerKind): Promise<number> {
  const key = `${projectId}:${kind}`;
  const existing = servers.get(key);
  if (existing) return existing.port;
  const root = path.resolve(siteDir(projectId, kind));
  await fs.mkdir(root, { recursive: true });
  const server = http.createServer(handler(root));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  servers.set(key, { server, port });
  return port;
}

export function serverInfo(projectId: string, kind: ContainerKind) {
  const s = servers.get(`${projectId}:${kind}`);
  const built = existsSync(path.join(siteDir(projectId, kind), "index.html"));
  return s && built ? { name: `local-${kind}-${projectId}`, running: true, hostPort: s.port } : null;
}

export async function stopServer(projectId: string, kind: ContainerKind) {
  const key = `${projectId}:${kind}`;
  const s = servers.get(key);
  if (!s) return;
  servers.delete(key);
  await new Promise<void>((resolve) => s.server.close(() => resolve()));
}

export async function removeLocal(projectId: string, kind: ContainerKind) {
  await stopServer(projectId, kind);
  await fs.rm(buildRoot(projectId, kind), { recursive: true, force: true });
}
