// My Life for Windows: the same My Life screens, backed by Google Calendar directly.
// Desktop extras: tray icon, native notifications for new alerts, start with Windows.
const { app, BrowserWindow, ipcMain, shell, Tray, Menu, Notification, safeStorage, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { Calendar } = require("./calendar");

// Self-updates: the installed app checks the public release feed, downloads new versions in the background
// (only the changed blocks), and installs them on the next restart. No reinstalling by hand.
let updateReady = null;
function setupUpdates() {
  if (!app.isPackaged) return;
  let autoUpdater; try { ({ autoUpdater } = require("electron-updater")); } catch { return; }
  autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-downloaded", (info) => {
    updateReady = info.version; refreshTrayMenu();
    // the window hides to the tray instead of quitting, so restart it ourselves when it's not on screen
    const n = new Notification({ title: "My Life updated", body: `Version ${info.version} is ready. Click to restart now, or it installs next time My Life starts.`, icon: path.join(__dirname, "build", "icon.png") });
    n.on("click", () => { quitting = true; autoUpdater.quitAndInstall(true, true); }); n.show();
    if (win && !win.isVisible()) { quitting = true; setTimeout(() => autoUpdater.quitAndInstall(true, false), 5000); }
  });
  autoUpdater.on("error", (e) => console.log("update check failed:", e?.message || e));
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check(); setInterval(check, 30 * 60e3);
  app.on("browser-window-focus", () => { if (!updateReady) check(); });
}

app.setAppUserModelId("com.lostak.mylife"); // needed for Windows notifications
if (!app.requestSingleInstanceLock()) app.quit();

const dataDir = () => app.getPath("userData");
const cfgPath = () => path.join(dataDir(), "config.bin");
const statePath = () => path.join(dataDir(), "state.json");

// Credentials and the refresh token are encrypted with Windows DPAPI via safeStorage.
const store = {
  get() {
    try {
      const raw = fs.readFileSync(cfgPath());
      return JSON.parse(safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString());
    } catch { return {}; }
  },
  set(obj) {
    const s = JSON.stringify(obj);
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(cfgPath(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(s) : s);
  },
};
const state = {
  get() { try { return JSON.parse(fs.readFileSync(statePath(), "utf8")); } catch { return { notify: true, seen: [] }; } },
  set(s) { fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(statePath(), JSON.stringify(s)); },
};

const cal = new Calendar(store, (u) => shell.openExternal(u));
let win = null, tray = null, quitting = false;

function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 880, minWidth: 380, minHeight: 560, backgroundColor: "#0b1220", title: "My Life", autoHideMenuBar: true,
    icon: path.join(__dirname, "build", process.platform === "win32" ? "icon.ico" : "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // Taskbar identity: a pinned icon relaunches My Life (not bare Electron) and shows the My Life icon,
  // even when this copy was started with "npm start".
  if (process.platform === "win32") {
    const ico = app.isPackaged ? process.execPath : path.join(__dirname, "build", "icon.ico");
    const cmd = app.isPackaged ? `"${process.execPath}"` : `"${process.execPath}" "${path.resolve(__dirname)}"`;
    try { win.setAppDetails({ appId: "com.lostak.mylife", appIconPath: ico, appIconIndex: 0, relaunchCommand: cmd, relaunchDisplayName: "My Life" }); } catch {}
  }
  loadPage();
  win.webContents.on("did-finish-load", () => { if (pendingOpen) { const w = pendingOpen; pendingOpen = null; setTimeout(() => win.webContents.send("open", w), 1500); } });
  win.on("close", (e) => { if (!quitting) { e.preventDefault(); win.hide(); } });
  // links inside the page open in the real browser
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file:")) { e.preventDefault(); shell.openExternal(url); } });
}
// Taskbar right-click shortcuts (Windows jump list). Each relaunches with --open=<screen>.
function setJumpList() {
  if (process.platform !== "win32") return;
  const exe = process.execPath, base = app.isPackaged ? [] : [path.resolve(__dirname)];
  const icon = app.isPackaged ? exe : path.join(__dirname, "build", "icon.ico");
  const task = (title, what, description) => ({ program: exe, arguments: [...base, `--open=${what}`].map(a => `"${a}"`).join(" "), iconPath: icon, iconIndex: 0, title, description });
  app.setUserTasks([
    task("Start ski workout", "ski", "Open tonight's workout with the timer"),
    task("Start pool session", "pool", "Open today's pool focus and counters"),
    task("Tonight's betting lesson", "bet", "Open tonight's lesson"),
    task("Today", "today", "Open the Today screen"),
  ]);
}
let pendingOpen = null;
const openArg = (argv) => (argv.find(a => a.startsWith("--open=")) || "").slice(7) || null;
function openScreen(what) {
  if (!what) return;
  show();
  if (!win.webContents.isLoading()) win.webContents.send("open", what); else pendingOpen = what;
}

function loadPage() { win.loadFile(path.join(__dirname, "renderer", cal.signedIn ? "index.html" : "setup.html")); }
function show() { if (!win) createWindow(); win.show(); win.focus(); }

function buildTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "build", "tray.png")));
  tray.setToolTip("My Life");
  tray.on("click", show);
  refreshTrayMenu();
}
function refreshTrayMenu() {
  const s = state.get();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open My Life", click: show },
    { type: "separator" },
    { label: "Alert notifications", type: "checkbox", checked: s.notify !== false, click: (i) => { state.set({ ...state.get(), notify: i.checked }); } },
    { label: "Start with Windows", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin, click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked, args: ["--hidden"] }) },
    { label: "Sign out of Google", enabled: cal.signedIn, click: () => { cal.signOut(); loadPage(); refreshTrayMenu(); } },
    { type: "separator" },
    ...(updateReady ? [{ label: `Restart to update (v${updateReady})`, click: () => { quitting = true; require("electron-updater").autoUpdater.quitAndInstall(true, true); } }] : []),
    { label: `Version ${app.getVersion()}`, enabled: false },
    { label: "Quit", click: () => { quitting = true; app.quit(); } },
  ]));
}

// ---------- notifications for new alerts (powder, tickets, price/fare drops, shows) ----------
const ALERT = /^Personal: (powder (alert|day)|ticket drop|game-day ticket drop|price drop|fare drop|show announced|on-sale now)/;
async function checkAlerts(first = false) {
  if (!cal.signedIn) return;
  const s = state.get();
  try {
    const now = new Date();
    const { events } = await cal.list_events({ fullText: "Personal", startTime: new Date(now - 2 * 864e5).toISOString(), endTime: new Date(+now + 3 * 864e5).toISOString() });
    const seen = new Set(s.seen || []);
    const fresh = events.filter(e => ALERT.test(e.summary || "") && !seen.has(e.id) && now - new Date(e.created) < 24 * 3600e3);
    fresh.forEach(e => seen.add(e.id));
    state.set({ ...s, seen: [...seen].slice(-300) });
    if (first || s.notify === false || !Notification.isSupported()) return;
    for (const e of fresh.slice(0, 3)) {
      const body = String(e.description || "").split("\n").find(l => l.trim() && !/^[A-Z0-9-]+:?\s/.test(l) && !/Pocket ID/.test(l)) || "";
      const n = new Notification({ title: e.summary.replace(/^Personal:\s*/, ""), body: body.slice(0, 180), icon: path.join(__dirname, "build", "icon.png") });
      n.on("click", show); n.show();
    }
  } catch { /* offline or signed out: try again next time */ }
}

// ---------- IPC from the page ----------
const wrap = (fn) => async (_e, ...a) => { try { return { ok: await fn(...a) }; } catch (err) { return { error: { code: err.code || "upstream_error", message: err.message } }; } };
ipcMain.handle("cal", wrap((tool, input) => {
  if (!["list_events", "create_event", "update_event"].includes(tool)) throw Object.assign(new Error("not allowed"), { code: "not_in_manifest" });
  return cal[tool](input || {});
}));
ipcMain.handle("ski", wrap(async () => {
  const base = (store.get().skiUrl || "").replace(/\/+$/, "").replace(/\/mcp$/, "");
  if (!base) throw Object.assign(new Error("Ski Outlook not set up"), { code: "server_not_connected" });
  const r = await fetch(base + "/api/weekend"); if (!r.ok) throw Object.assign(new Error("Ski Outlook " + r.status), { code: "server_unavailable" });
  return r.json();
}));
ipcMain.handle("openClaude", wrap(async (prompt) => {
  const q = encodeURIComponent(String(prompt || "").slice(0, 3000));
  // Claude desktop app if installed, otherwise the browser. Runs on your Claude plan.
  try { await shell.openExternal(`claude://claude.ai/new?q=${q}`); } catch { await shell.openExternal(`https://claude.ai/new?q=${q}`); }
  return true;
}));
ipcMain.handle("setup:get", wrap(async () => { const c = store.get(); return { clientId: c.clientId || "", hasSecret: !!c.clientSecret, skiUrl: c.skiUrl || "", signedIn: cal.signedIn }; }));
ipcMain.handle("setup:save", wrap(async (v) => { const c = store.get(); store.set({ ...c, clientId: v.clientId?.trim() || c.clientId, clientSecret: v.clientSecret?.trim() || c.clientSecret, skiUrl: (v.skiUrl ?? c.skiUrl ?? "").trim() }); return true; }));
ipcMain.handle("setup:signin", wrap(async () => { await cal.signIn(); refreshTrayMenu(); await checkAlerts(true); loadPage(); return true; }));
ipcMain.handle("setup:open", wrap(async () => { win.loadFile(path.join(__dirname, "renderer", "setup.html")); return true; }));

app.on("second-instance", (_e, argv) => { const w = openArg(argv); w ? openScreen(w) : show(); });
app.whenReady().then(() => {
  createWindow();
  setJumpList();
  pendingOpen = openArg(process.argv);
  if (process.argv.includes("--hidden") && !pendingOpen) win.hide();
  buildTray();
  checkAlerts(true);
  setInterval(() => checkAlerts(false), 15 * 60e3);
  setupUpdates();
  // "Start with Windows" may still point at an old npm-start copy (bare electron.exe). Both copies use the same
  // startup entry (named after the app id), so re-registering from the installed app points it back here.
  if (app.isPackaged && process.platform === "win32" && app.getLoginItemSettings().openAtLogin)
    app.setLoginItemSettings({ openAtLogin: true, path: process.execPath, args: ["--hidden"] });
});
app.on("before-quit", () => { quitting = true; });
app.on("window-all-closed", (e) => e.preventDefault()); // keep running in the tray
