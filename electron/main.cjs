// Electron main process for Cobblemon Launcher.
// Run locally (not inside Lovable preview):
//   npm install
//   npm run build
//   npx electron .
const { app, BrowserWindow, ipcMain, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");
const auth = require("./auth.cjs");
const installer = require("./installer.cjs");
const launcher = require("./launcher.cjs");

let mainWindow;

const userData = () => app.getPath("userData");
const tokensPath = () => path.join(userData(), "tokens.enc");
const configPath = () => path.join(userData(), "config.json");
const gameDir = () => path.join(userData(), "minecraft");

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), "utf8"));
  } catch {
    return { ramGb: 4 };
  }
}
function saveConfig(cfg) {
  fs.mkdirSync(userData(), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
}

function loadTokens() {
  try {
    const buf = fs.readFileSync(tokensPath());
    return JSON.parse(safeStorage.decryptString(buf));
  } catch {
    return null;
  }
}
function saveTokens(t) {
  fs.mkdirSync(userData(), { recursive: true });
  fs.writeFileSync(tokensPath(), safeStorage.encryptString(JSON.stringify(t)));
}
function clearTokens() {
  try { fs.unlinkSync(tokensPath()); } catch {}
}

function sendProgress(stage, percent) {
  if (mainWindow) mainWindow.webContents.send("launcher:progress", { stage, percent });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 640,
    minWidth: 720,
    minHeight: 540,
    backgroundColor: "#1a2f2a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Built by: npm run build:electron  →  dist-electron/index.html
  const indexHtml = path.join(__dirname, "..", "dist-electron", "index.html");
  mainWindow.loadFile(indexHtml);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// --- IPC handlers ---

ipcMain.handle("launcher:getConfig", () => loadConfig());
ipcMain.handle("launcher:setConfig", (_e, cfg) => { saveConfig(cfg); });

ipcMain.handle("launcher:getProfile", async () => {
  const t = loadTokens();
  if (!t?.mcProfile) return null;
  return { username: t.mcProfile.name, uuid: t.mcProfile.id };
});

ipcMain.handle("launcher:login", async () => {
  const tokens = await auth.loginInteractive();
  saveTokens(tokens);
  return { username: tokens.mcProfile.name, uuid: tokens.mcProfile.id };
});

ipcMain.handle("launcher:logout", async () => { clearTokens(); });

ipcMain.handle("launcher:play", async (_e, opts) => {
  let tokens = loadTokens();
  if (!tokens) throw new Error("로그인이 필요합니다.");

  // Refresh if MC token stale
  tokens = await auth.ensureFresh(tokens);
  saveTokens(tokens);

  const modpack = JSON.parse(fs.readFileSync(path.join(__dirname, "modpack.json"), "utf8"));

  await installer.ensureModpack({
    modpack,
    gameDir: gameDir(),
    onProgress: sendProgress,
  });

  sendProgress("게임 시작 중", 98);
  await launcher.launch({
    modpack,
    gameDir: gameDir(),
    tokens,
    ramGb: opts.ramGb ?? 4,
  });
  sendProgress("실행됨", 100);
});
