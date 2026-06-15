const { app, BrowserWindow, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

let mainWindow;

function configureAutoUpdates() {
  if (!app.isPackaged || process.env.MYRCON_DISABLE_AUTO_UPDATE === "1") {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (error) => {
    console.warn("MyRcon updater error:", error);
  });

  autoUpdater.on("update-downloaded", () => {
    console.info("MyRcon update downloaded. It will install after the app closes.");
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.warn("MyRcon update check failed:", error);
    });
  }, 10000);
}

function ensureSecret(filePath) {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8").trim();
  }

  const value = crypto.randomBytes(32).toString("base64");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, { encoding: "utf8", mode: 0o600 });
  return value;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 3000;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function waitForHttp(url, timeoutMs = 30000) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      fetch(url)
        .then((response) => {
          if (response.ok) {
            resolve();
          } else {
            retry();
          }
        })
        .catch(retry);
    };

    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error("The local MyRcon service did not start in time."));
        return;
      }
      setTimeout(check, 350);
    };

    check();
  });
}

function resolveResource(...parts) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app.asar.unpacked", ...parts);
  }

  return path.join(app.getAppPath(), ...parts);
}

function resolveMigrationsDir() {
  const candidates = [
    resolveResource("prisma", "migrations"),
    path.join(resolveResource(".next", "standalone"), "prisma", "migrations"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

async function startServer() {
  if (!app.isPackaged && process.env.MYRCON_DEV_SERVER_URL) {
    return process.env.MYRCON_DEV_SERVER_URL;
  }

  const dataDir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const port = await freePort();
  process.env.PORT = String(port);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.DATABASE_URL = `file:${path.join(dataDir, "myrcon.db").replace(/\\/g, "/")}`;
  process.env.MYRCON_MIGRATIONS_DIR = resolveMigrationsDir();
  process.env.RCON_ENCRYPTION_KEY = ensureSecret(path.join(app.getPath("userData"), "rcon-encryption.key"));
  process.env.AUTH_COOKIE_NAME = "myrcon_desktop_session";
  process.env.NODE_ENV = "production";

  const standaloneDir = resolveResource(".next", "standalone");
  process.chdir(standaloneDir);
  require(path.join(standaloneDir, "server.js"));

  const url = `http://127.0.0.1:${port}`;
  await waitForHttp(`${url}/api/health`);
  return url;
}

async function createWindow() {
  const url = await startServer();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#090b10",
    title: "MyRcon",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: externalUrl }) => {
    shell.openExternal(externalUrl);
    return { action: "deny" };
  });

  await mainWindow.loadURL(url);
}

app.whenReady().then(async () => {
  try {
    await createWindow();
    configureAutoUpdates();
  } catch (error) {
    dialog.showErrorBox("MyRcon failed to start", error instanceof Error ? error.message : String(error));
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
