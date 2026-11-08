// Stardoom AI desktop: runs the Stardoom AI server (Next.js standalone) on this computer with its own
// PostgreSQL, then shows it in a window. No Docker, no login: one local user, projects on this disk.
const { app, BrowserWindow, dialog, safeStorage, session, shell, utilityProcess } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const isDev = !app.isPackaged;
const RES = isDev ? path.join(__dirname, "app") : process.resourcesPath;
const SERVER_DIR = path.join(RES, "server");
const TOOLCHAIN_DIR = path.join(RES, "runtime");
const MIGRATIONS_DIR = path.join(RES, "migrations");
const DATA = app.getPath("userData");
const LOG_FILE = path.join(DATA, "logs", "main.log");

let pg = null;
let server = null;
let mainWindow = null;
let quitting = false;

function logLine(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.join(" ")}\n`;
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line);
  } catch {}
  if (isDev) process.stdout.write(line);
}

/* ---------------------------------------------------------------- secrets */

/** Long-lived secrets, encrypted with the OS keychain (DPAPI / Keychain) when available. */
function loadSecrets() {
  const file = path.join(DATA, "secrets.bin");
  const plainFile = path.join(DATA, "secrets.json");
  const canEncrypt = safeStorage.isEncryptionAvailable();
  try {
    if (canEncrypt && fs.existsSync(file)) return JSON.parse(safeStorage.decryptString(fs.readFileSync(file)));
    if (fs.existsSync(plainFile)) return JSON.parse(fs.readFileSync(plainFile, "utf8"));
  } catch (err) {
    logLine("secrets.read_failed", String(err));
  }
  const secrets = {
    authSecret: crypto.randomBytes(32).toString("base64"),
    encryptionKey: crypto.randomBytes(32).toString("base64"),
    pgPassword: crypto.randomBytes(24).toString("hex"),
  };
  fs.mkdirSync(DATA, { recursive: true });
  if (canEncrypt) fs.writeFileSync(file, safeStorage.encryptString(JSON.stringify(secrets)));
  else fs.writeFileSync(plainFile, JSON.stringify(secrets), { mode: 0o600 });
  return secrets;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

/* ---------------------------------------------------------------- database */

async function startDatabase(secrets) {
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const port = await freePort();
  const dir = path.join(DATA, "pg");
  pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "stardoom",
    password: secrets.pgPassword,
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: (m) => logLine("pg", String(m).trim()),
    onError: (m) => logLine("pg.error", String(m).trim()),
  });
  if (!fs.existsSync(path.join(dir, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  await pg.createDatabase("stardoom").catch(() => undefined); // exists after the first run
  const url = `postgresql://stardoom:${secrets.pgPassword}@127.0.0.1:${port}/stardoom`;
  await migrate(url);
  return url;
}

/** Applies prisma/migrations/*\/migration.sql in order, once each. */
async function migrate(url) {
  const { Client } = require("pg");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('CREATE TABLE IF NOT EXISTS "_stardoom_migrations" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const done = new Set((await client.query('SELECT name FROM "_stardoom_migrations"')).rows.map((r) => r.name));
    const names = fs
      .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(MIGRATIONS_DIR, d.name, "migration.sql")))
      .map((d) => d.name)
      .sort();
    for (const name of names) {
      if (done.has(name)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query('INSERT INTO "_stardoom_migrations" (name) VALUES ($1)', [name]);
        await client.query("COMMIT");
        logLine("migrate.applied", name);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${name} failed: ${err.message}`);
      }
    }
  } finally {
    await client.end();
  }
}

/* ---------------------------------------------------------------- server */

async function startServer(databaseUrl, secrets) {
  const port = await freePort();
  const token = crypto.randomBytes(32).toString("hex");
  const origin = `http://127.0.0.1:${port}`;
  const env = {
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    STARDOOM_MODE: "desktop",
    STARDOOM_DESKTOP_TOKEN: token,
    STARDOOM_TOOLCHAIN_DIR: TOOLCHAIN_DIR,
    DATABASE_URL: databaseUrl,
    AUTH_SECRET: secrets.authSecret,
    AUTH_TRUST_HOST: "true",
    NEXTAUTH_URL: origin,
    SECRET_ENCRYPTION_KEY: secrets.encryptionKey,
    STORAGE_PATH: path.join(DATA, "projects-data"),
    DEPLOYMENT_MODE: "local",
    PATH: process.env.PATH || "",
    SYSTEMROOT: process.env.SYSTEMROOT || "",
    HOME: process.env.HOME || "",
    USERPROFILE: process.env.USERPROFILE || "",
    TEMP: process.env.TEMP || "",
    TMP: process.env.TMP || "",
  };
  server = utilityProcess.fork(path.join(SERVER_DIR, "server.js"), [], { cwd: SERVER_DIR, env, stdio: "pipe", serviceName: "Stardoom AI server" });
  server.stdout?.on("data", (d) => logLine("server", String(d).trim()));
  server.stderr?.on("data", (d) => logLine("server.err", String(d).trim()));
  server.on("exit", (code) => {
    logLine("server.exit", String(code));
    server = null;
    if (!quitting) {
      dialog.showErrorBox("Stardoom AI stopped", `The Stardoom AI server stopped unexpectedly (code ${code}). Details: ${LOG_FILE}`);
      app.quit();
    }
  });

  // Ready when it answers at all (it answers 403 without the token cookie).
  const deadline = Date.now() + 90_000;
  for (;;) {
    try {
      await fetch(`${origin}/`, { signal: AbortSignal.timeout(2000) });
      break;
    } catch {
      if (Date.now() > deadline) throw new Error("The Stardoom AI server did not start in time.");
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  await session.defaultSession.cookies.set({ url: origin, name: "stardoom_desktop", value: token, httpOnly: true, sameSite: "strict", path: "/" });
  return origin;
}

/* ---------------------------------------------------------------- windows */

function splash() {
  const w = new BrowserWindow({ width: 420, height: 260, frame: false, resizable: false, show: true, backgroundColor: "#0b0b0c" });
  w.loadURL(
    "data:text/html;charset=utf-8," +
      encodeURIComponent(
        `<body style="margin:0;display:grid;place-items:center;height:100vh;background:#0b0b0c;color:#f4f4f5;font:600 13px system-ui;letter-spacing:.18em;text-transform:uppercase">
          <div style="text-align:center"><div style="font-size:22px;font-weight:900;letter-spacing:.2em">STARDOOM AI</div><div style="margin-top:14px;opacity:.6">Starting…</div></div></body>`,
      ),
  );
  return w;
}

function createWindow(origin) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: "Stardoom AI",
    show: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  const appOrigin = new URL(origin).origin;
  // Only the app itself opens inside the window; everything else (published sites, docs) goes to the browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (new URL(url).origin !== appOrigin) {
      e.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL(`${origin}/dashboard`);
}

/* ---------------------------------------------------------------- lifecycle */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const s = splash();
    try {
      logLine("start", app.getVersion(), process.platform, process.arch);
      const secrets = loadSecrets();
      const databaseUrl = await startDatabase(secrets);
      const origin = await startServer(databaseUrl, secrets);
      createWindow(origin);
    } catch (err) {
      logLine("start.failed", err && err.stack ? err.stack : String(err));
      dialog.showErrorBox("Stardoom AI could not start", `${err && err.message ? err.message : err}\n\nDetails: ${LOG_FILE}`);
      quitting = true;
      app.quit();
    } finally {
      s.destroy();
    }
  });

  app.on("window-all-closed", () => app.quit());

  app.on("before-quit", async (e) => {
    if (quitting && !pg && !server) return;
    if (!quitting) {
      quitting = true;
      e.preventDefault();
      try {
        server?.kill();
        await pg?.stop();
      } catch (err) {
        logLine("stop.failed", String(err));
      }
      pg = null;
      server = null;
      app.quit();
    }
  });
}
