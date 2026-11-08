// electron-builder afterPack hook: copies the assembled server, build toolchain and migrations into the app's
// resources folder. (extraResources silently drops node_modules and dot-folders like .next, which the
// Next.js standalone server and the toolchain both need.)
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName, packager } = context;
  const resources =
    electronPlatformName === "darwin"
      ? path.join(appOutDir, `${packager.appInfo.productFilename}.app`, "Contents", "Resources")
      : path.join(appOutDir, "resources");
  const src = path.join(__dirname, "app");
  for (const dir of ["server", "runtime", "migrations"]) {
    const from = path.join(src, dir);
    if (!fs.existsSync(from)) throw new Error(`Missing ${from}: run node desktop/build.mjs first.`);
    const to = path.join(resources, dir);
    fs.rmSync(to, { recursive: true, force: true });
    fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true });
    console.log(`  • copied ${dir} → ${path.relative(appOutDir, to)}`);
  }
};
