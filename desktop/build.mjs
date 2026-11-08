// Builds the Stardoom desktop app for the current OS:
//   1. next build (standalone) in the repo root
//   2. assemble desktop/app/{server,runtime,migrations}
//   3. electron-builder → desktop/dist (Windows: NSIS .exe, macOS: .dmg)
//
// Native pieces (PostgreSQL, rollup/esbuild/tailwind binaries, the Prisma engine) are per-platform, so run
// this on each target OS (CI does: .github/workflows/desktop.yml).
//
//   node desktop/build.mjs            full build + installer
//   node desktop/build.mjs --no-pack  assemble only (then: cd desktop && npx electron .)
//   node desktop/build.mjs --skip-next  reuse an existing .next/standalone
//   node desktop/build.mjs --pack-only  reuse an already assembled desktop/app (installer only)
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DESKTOP = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DESKTOP, "..");
const APP = join(DESKTOP, "app");
const args = new Set(process.argv.slice(2));
const run = (cmd, cwd = ROOT, env = {}) => {
  console.log(`\n$ ${cmd}  (${cwd})`);
  execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
};

const packOnly = args.has("--pack-only");

// 1. Next.js standalone server
if (!args.has("--skip-next") && !packOnly) {
  run("npx prisma generate");
  run("npx next build", ROOT, {
    NEXT_TELEMETRY_DISABLED: "1",
    // Placeholders for the build step only; the desktop shell provides real values at runtime.
    AUTH_SECRET: "build-placeholder",
    DATABASE_URL: "postgresql://build:build@127.0.0.1:5432/build",
  });
}
const standalone = join(ROOT, ".next", "standalone");
if (packOnly) {
  if (!existsSync(join(APP, "server", "server.js"))) throw new Error("Nothing assembled in desktop/app yet: run without --pack-only.");
} else {
if (!existsSync(join(standalone, "server.js"))) throw new Error("Missing .next/standalone/server.js — did next build run?");

// 2. Assemble
rmSync(APP, { recursive: true, force: true });
const server = join(APP, "server");
mkdirSync(server, { recursive: true });
console.log("\nAssembling server…");
cpSync(standalone, server, {
  recursive: true,
  // Never ship local data or secrets that happen to be in the repo folder.
  // (runtime/ ships separately as the toolchain; tracing pulls it in through lib/runtime/local.ts.)
  filter: (src) => {
    const rel = src.slice(standalone.length);
    return !/^[\\/](storage|desktop|marketing|runtime)$/.test(rel) && !/[\\/]\.env[^\\/]*$/.test(rel);
  },
});
cpSync(join(ROOT, ".next", "static"), join(server, ".next", "static"), { recursive: true });
cpSync(join(ROOT, "public"), join(server, "public"), { recursive: true });
// Prisma client + only this platform's query engine.
for (const dir of [join("node_modules", "@prisma"), join("node_modules", ".prisma")]) {
  cpSync(join(ROOT, dir), join(server, dir), { recursive: true });
}
const engines = join(server, "node_modules", ".prisma", "client");
const keep = process.platform === "win32" ? /windows/ : process.platform === "darwin" ? (process.arch === "arm64" ? /darwin-arm64/ : /darwin\.dylib/) : /linux|debian|rhel/;
for (const f of readdirSync(engines)) if ((/query_engine|libquery_engine/.test(f) && !keep.test(f)) || f.includes(".tmp")) rmSync(join(engines, f));

console.log("Copying migrations…");
cpSync(join(ROOT, "prisma", "migrations"), join(APP, "migrations"), { recursive: true });

console.log("Preparing the project build toolchain…");
const runtime = join(APP, "runtime");
mkdirSync(runtime, { recursive: true });
for (const f of ["package.json", "package-lock.json", "build.mjs", "tsconfig.base.json"]) cpSync(join(ROOT, "runtime", f), join(runtime, f));
if (existsSync(join(ROOT, "runtime", "node_modules", "vite")) && !args.has("--fresh-toolchain")) {
  cpSync(join(ROOT, "runtime", "node_modules"), join(runtime, "node_modules"), { recursive: true });
} else {
  run("npm ci --no-audit --no-fund", runtime);
}

}

// 3. Installer
if (!args.has("--no-pack")) {
  const target = process.platform === "darwin" ? "--mac" : process.platform === "win32" ? "--win" : "--linux";
  run(`npx electron-builder ${target} --publish never`, DESKTOP);
  console.log(`\nDone: ${join(DESKTOP, "dist")}`);
} else {
  console.log(`\nAssembled in ${APP}. Try it: cd desktop && npx electron .`);
}
