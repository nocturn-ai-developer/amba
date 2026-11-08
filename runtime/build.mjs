// STARDOOM project build: type-check + Vite production build of the workspace.
//
// In the Docker sandbox this runs as the unprivileged `node` user with no network, with the paths below.
// The desktop app runs the same script on the user's machine and passes its own paths through env
// (WORKSPACE, SITE_DIR, BUILD_STAGING, VITE_CACHE_DIR); the toolchain is always the directory of this file.
// The Vite config is fixed here; the project's own vite.config.ts is ignored so a project
// cannot add plugins or change the toolchain. Output is written to a staging directory
// and swapped into SITE_DIR only on success, so a failed build never breaks the live preview.
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { spawnSync } from "node:child_process";
import { rmSync, renameSync, existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOOLCHAIN = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = process.env.WORKSPACE || "/workspace";
const SITE_DIR = process.env.SITE_DIR || "/srv/prismatic/site";
const STAGING = process.env.BUILD_STAGING || "/tmp/prismatic-build";
const CACHE = process.env.VITE_CACHE_DIR || "/tmp/vite-cache";

function out(kind, message) {
  process.stdout.write(JSON.stringify({ kind, message }) + "\n");
}

// The base tsconfig points at /workspace/src; elsewhere, write an equivalent config next to the sources.
let tsconfig = join(TOOLCHAIN, "tsconfig.base.json");
if (WORKSPACE !== "/workspace") {
  const base = JSON.parse(readFileSync(tsconfig, "utf8"));
  // Inside the workspace so type packages resolve through its node_modules link to the toolchain.
  tsconfig = join(WORKSPACE, ".stardoom-tsconfig.json");
  writeFileSync(tsconfig, JSON.stringify({ ...base, include: [join(WORKSPACE, "src")] }));
}

out("step", "Type-checking");
const tsc = spawnSync(process.execPath, [join(TOOLCHAIN, "node_modules", "typescript", "bin", "tsc"), "-p", tsconfig, "--pretty", "false"], {
  encoding: "utf8",
  cwd: WORKSPACE,
  timeout: 120_000,
});
const strip = (s) => s.replaceAll(WORKSPACE.replaceAll("\\", "/") + "/", "").replaceAll(WORKSPACE + "\\", "").replaceAll("/workspace/", "");
if (tsc.status !== 0) {
  const text = strip(`${tsc.stdout || ""}${tsc.stderr || ""}`).trim();
  out("error", text.split("\n").slice(0, 60).join("\n") || "TypeScript failed");
  process.exit(1);
}

out("step", "Building application");
rmSync(STAGING, { recursive: true, force: true });
try {
  await build({
    root: WORKSPACE,
    configFile: false,
    cacheDir: CACHE,
    logLevel: "error",
    plugins: [react(), tailwindcss()],
    build: { outDir: STAGING, emptyOutDir: true, reportCompressedSize: false, sourcemap: false },
  });
} catch (err) {
  const msg = strip(String(err && err.message ? err.message : err));
  out("error", msg.split("\n").slice(0, 40).join("\n"));
  process.exit(1);
}

if (!existsSync(`${STAGING}/index.html`)) {
  out("error", "Build produced no index.html");
  process.exit(1);
}

// Swap: copy into SITE_DIR contents (SITE_DIR itself may be a mount point).
mkdirSync(SITE_DIR, { recursive: true });
const OLD = `${SITE_DIR}.old`;
rmSync(OLD, { recursive: true, force: true });
try {
  renameSync(SITE_DIR, OLD);
  renameSync(STAGING, SITE_DIR);
  rmSync(OLD, { recursive: true, force: true });
} catch {
  rmSync(SITE_DIR, { recursive: true, force: true });
  mkdirSync(SITE_DIR, { recursive: true });
  cpSync(STAGING, SITE_DIR, { recursive: true });
}
out("done", "Build completed");
