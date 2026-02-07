////////////////////////////////////////////////////////////////////////////////
//
//  aprl-wsbar
//
////////////////////////////////////////////////////////////////////////////////

const {
  app,
  BrowserWindow,
  screen,
  globalShortcut,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const { spawn, exec, execFile } = require("child_process");
const path = require("node:path");
const fs = require("node:fs");
const https = require("node:https");
const { initSystemMonitoring, stopSystemMonitoring } = require("./system");
const { initWindowTracking, stopWindowTracking } = require("./window-tracker");
const { initHardwareInfo } = require("./hardware-info");

////////////////////////////////////////////////////////////////////////////////
//  globals / states
////////////////////////////////////////////////////////////////////////////////

let mainWindow;
let trayWindow;
let trayIcon;
let isBarHiddenForFullscreen = false;
let lastMediaPath = null;
let smtcWorker;
let pingInterval;
let lastPingResults = null;
let speedTestInFlight = false;
let lastSpeedTestPath = null;
let commandsConfigPath = null;
const appBarExePath = path.join(
  __dirname,
  "./AppBarHelper/bin/Release/net8.0-windows/AppBarHelper.exe",
);
const commandLauncherPath = path.join(__dirname, "command-launcher.js");
const trayIconPath = path.join(__dirname, "Assets", "ico.png");

const defaultCommands = [
  {
    label: "Open Repo",
    command: "cd $env:USERPROFILE\\Documents\\aprl-wsbar; ls",
  },
  {
    label: "Ping Cloudflare",
    command: "ping 1.1.1.1 -n 4",
  },
  {
    label: "Show IP",
    command: "ipconfig",
  },
];


////////////////////////////////////////////////////////////////////////////////
//  profile image helpers
////////////////////////////////////////////////////////////////////////////////

function getProfileImagePathFromHelper() {
  return new Promise((resolve) => {
    execFile(
      appBarExePath,
      ["get-profile-image"],
      { windowsHide: true },
      (error, stdout) => {
        if (error) {
          console.warn("Failed to get profile image:", error);
          resolve(null);
          return;
        }

        const candidate = String(stdout || "").trim();
        resolve(candidate.length ? candidate : null);
      },
    );
  });
}

async function loadImageAsDataUrl(imagePath) {
  if (!imagePath) return null;

  try {
    const buffer = await fs.promises.readFile(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    let mime = "image/png";

    if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
    if (ext === ".bmp") mime = "image/bmp";
    if (ext === ".gif") mime = "image/gif";

    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.warn("Failed to read profile image:", error);
    return null;
  }
}

////////////////////////////////////////////////////////////////////////////////
//  store last media / speed test results
////////////////////////////////////////////////////////////////////////////////

async function persistLastMedia(media) {
  if (!lastMediaPath) return;

  try {
    const payload = {
      media,
      savedAt: Date.now(),
    };

    await fs.promises.mkdir(path.dirname(lastMediaPath), { recursive: true });
    await fs.promises.writeFile(
      lastMediaPath,
      JSON.stringify(payload),
      "utf8",
    );
  } catch (error) {
    console.warn("Failed to persist last media:", error);
  }
}

async function persistLastSpeedTest(result) {
  if (!lastSpeedTestPath || !result) return;

  try {
    const payload = {
      result,
      savedAt: Date.now(),
    };

    await fs.promises.mkdir(path.dirname(lastSpeedTestPath), { recursive: true });
    await fs.promises.writeFile(
      lastSpeedTestPath,
      JSON.stringify(payload),
      "utf8",
    );
  } catch (error) {
    console.warn("Failed to persist speed test:", error);
  }
}

async function loadLastMedia() {
  if (!lastMediaPath) return null;

  try {
    const raw = await fs.promises.readFile(lastMediaPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Failed to load last media:", error);
    }
    return null;
  }
}

async function loadLastSpeedTest() {
  if (!lastSpeedTestPath) return null;

  try {
    const raw = await fs.promises.readFile(lastSpeedTestPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Failed to load speed test:", error);
    }
    return null;
  }
}

////////////////////////////////////////////////////////////////////////////////
//  command runner config
////////////////////////////////////////////////////////////////////////////////

async function ensureCommandsConfig() {
  if (!commandsConfigPath) return;

  try {
    await fs.promises.mkdir(path.dirname(commandsConfigPath), { recursive: true });
    await fs.promises.access(commandsConfigPath, fs.constants.F_OK);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Failed to access commands config:", error);
      return;
    }

    try {
      await fs.promises.writeFile(
        commandsConfigPath,
        JSON.stringify(defaultCommands, null, 2),
        "utf8",
      );
    } catch (writeError) {
      console.warn("Failed to create commands config:", writeError);
    }
  }
}

async function loadCommandsConfig() {
  if (!commandsConfigPath) return [];

  try {
    const raw = await fs.promises.readFile(commandsConfigPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry.command === "string")
      .map((entry) => ({
        label: typeof entry.label === "string" ? entry.label : entry.command,
        command: entry.command,
        cwd: typeof entry.cwd === "string" ? entry.cwd : null,
      }));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Failed to load commands config:", error);
    }
    return [];
  }
}

function spawnAlacritty(command, cwd) {
  if (!command || typeof command !== "string") return false;

  try {
    const child = spawn(process.execPath, [
      commandLauncherPath,
      "--command",
      command,
      "--cwd",
      cwd || "",
    ], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
      },
      cwd: cwd || undefined,
    });

    child.unref();
    return true;
  } catch (error) {
    console.warn("Failed to launch Alacritty:", error);
    return false;
  }
}


////////////////////////////////////////////////////////////////////////////////
//  ping checks
////////////////////////////////////////////////////////////////////////////////

function sendPingStatus(results) {
  lastPingResults = results;

  if (trayWindow && !trayWindow.isDestroyed()) {
    trayWindow.webContents.send("ping-status", {
      results,
      timestamp: Date.now(),
    });
  }
}

function pingHost(host) {
  return new Promise((resolve) => {
    exec(`ping -n 1 -w 1000 ${host}`, (error, stdout) => {
      let timeMs = null;

      if (stdout) {
        const match = stdout.match(/time[=<]\s*(\d+)ms/i);
        if (match) {
          timeMs = Number(match[1]);
        }
      }

      resolve({ ok: !error, timeMs });
    });
  });
}

async function runPingChecks() {
  const hosts = ["8.8.8.8", "1.1.1.1", "aprl.online"];
  const results = {};

  await Promise.all(
    hosts.map(async (host) => {
      results[host] = await pingHost(host);
    }),
  );

  sendPingStatus(results);
}

function measurePingMs() {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const req = https.get("https://speed.cloudflare.com/cdn-cgi/trace", (res) => {
      res.on("data", () => {});
      res.on("end", () => {
        const end = process.hrtime.bigint();
        const ms = Number(end - start) / 1e6;
        resolve(Math.round(ms));
      });
    });

    req.on("error", reject);
  });
}

function measureDownloadMbps(byteCount = 3_000_000) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    let received = 0;
    const url = `https://speed.cloudflare.com/__down?bytes=${byteCount}`;

    const req = https.get(url, (res) => {
      res.on("data", (chunk) => {
        received += chunk.length;
      });
      res.on("end", () => {
        const end = process.hrtime.bigint();
        const seconds = Number(end - start) / 1e9;
        const mbps = seconds > 0 ? (received * 8) / seconds / 1_000_000 : null;
        resolve(mbps);
      });
    });

    req.on("error", reject);
  });
}

function measureUploadMbps(byteCount = 1_000_000) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.alloc(byteCount, 0);
    const start = process.hrtime.bigint();
    const req = https.request(
      {
        method: "POST",
        hostname: "speed.cloudflare.com",
        path: "/__up",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": payload.length,
        },
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => {
          const end = process.hrtime.bigint();
          const seconds = Number(end - start) / 1e9;
          const mbps = seconds > 0 ? (payload.length * 8) / seconds / 1_000_000 : null;
          resolve(mbps);
        });
      },
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

////////////////////////////////////////////////////////////////////////////////
//  spawn windows
////////////////////////////////////////////////////////////////////////////////

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const scaleFactor = display.scaleFactor;
  const BAR_HEIGHT = 24;

  mainWindow = new BrowserWindow({
    width: display.bounds.width,
    height: Math.round(BAR_HEIGHT * scaleFactor),
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setSkipTaskbar(true);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMovable(false);
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  mainWindow.once("ready-to-show", () => {
    const { x, y } = display.bounds;
    mainWindow.setPosition(x, y, false);
  });

  mainWindow.loadFile("index.html");

  mainWindow.webContents.once("did-finish-load", async () => {
    const cached = await loadLastMedia();
    if (cached?.media) {
      mainWindow.webContents.send("now-playing", cached.media);
    }
  });

  // dev tools
  //mainWindow.webContents.openDevTools();
}

function createTrayWindow() {
  const display = screen.getPrimaryDisplay();
  const scaleFactor = display.scaleFactor;
  const BAR_HEIGHT = 24;
  const TRAY_WIDTH = Math.round(750 * scaleFactor);

  const trayY = Math.round(BAR_HEIGHT * scaleFactor);
  const trayHeight = 400;
  const trayX = Math.round(
    display.bounds.x + (display.bounds.width - TRAY_WIDTH) / 2,
  );

  trayWindow = new BrowserWindow({
    width: TRAY_WIDTH,
    height: trayHeight,
    x: trayX,
    y: display.bounds.y + trayY + 10,
    frame: false,
    transparent: true,
    resizable: false,
    fullscreenable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  trayWindow.setAlwaysOnTop(true, "screen-saver");
  trayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  trayWindow.setMenuBarVisibility(false);
  trayWindow.setMovable(false);

  trayWindow.loadFile("tray.html");

  trayWindow.webContents.once("did-finish-load", () => {
    if (lastPingResults) {
      trayWindow.webContents.send("ping-status", {
        results: lastPingResults,
        timestamp: Date.now(),
      });
    }
  });
  trayWindow.webContents.once("did-finish-load", async () => {
    const profileImagePath = await getProfileImagePathFromHelper();
    const profileImageDataUrl = await loadImageAsDataUrl(profileImagePath);
    if (profileImageDataUrl && trayWindow && !trayWindow.isDestroyed()) {
      trayWindow.webContents.send("profile-image", profileImageDataUrl);
    }
  });
  trayWindow.webContents.once("did-finish-load", async () => {
    const cached = await loadLastSpeedTest();
    if (cached?.result && trayWindow && !trayWindow.isDestroyed()) {
      trayWindow.webContents.send("speedtest-result", cached.result);
    }
  });
  // hide tray window when you click outside of it, unless dev tools are open
  //trayWindow.webContents.openDevTools();
  trayWindow.on("blur", () => {
    if (
      trayWindow &&
      trayWindow.isVisible() &&
      !trayWindow.webContents.isDevToolsOpened()
    ) {
      trayWindow.hide();
    }
  });
  trayWindow.on("closed", () => {
    trayWindow = null;
  });
}

function createSystemTray() {
  if (trayIcon) return;

  const image = nativeImage.createFromPath(trayIconPath);
  if (!image || image.isEmpty()) {
    console.warn("Tray icon not found:", trayIconPath);
    return;
  }

  trayIcon = new Tray(image);
  trayIcon.setToolTip("aprl-wsbar");
  trayIcon.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Restart",
        click: () => {
          app.relaunch();
          app.exit(0);
        },
      },
      {
        label: "Quit",
        click: () => {
          app.quit();
        },
      },
    ]),
  );
}

////////////////////////////////////////////////////////////////////////////////
//  visibility states for fullscreen stuff
////////////////////////////////////////////////////////////////////////////////

function toggleTrayWindow() {
  if (!trayWindow) return;

  if (trayWindow.isVisible()) {
    trayWindow.hide();
  } else {
    trayWindow.show();
    trayWindow.focus();
  }
}

function setBarVisibility(visible) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (visible) {
    if (!mainWindow.isVisible()) {
      mainWindow.showInactive();
    }
    mainWindow.setAlwaysOnTop(true, "screen-saver");
  } else {
    if (trayWindow && trayWindow.isVisible()) {
      trayWindow.hide();
    }
    mainWindow.hide();
  }
}

function handleActiveWindow(info) {
  if (!info || !info.bounds) return;

  const { bounds } = info;
  const display = screen.getDisplayMatching(bounds);
  const tolerance = 2;
  const isFullscreen =
    Math.abs(bounds.width - display.bounds.width) <= tolerance &&
    Math.abs(bounds.height - display.bounds.height) <= tolerance &&
    Math.abs(bounds.x - display.bounds.x) <= tolerance &&
    Math.abs(bounds.y - display.bounds.y) <= tolerance;

  if (isFullscreen && !isBarHiddenForFullscreen) {
    isBarHiddenForFullscreen = true;
    setBarVisibility(false);
  } else if (!isFullscreen && isBarHiddenForFullscreen) {
    isBarHiddenForFullscreen = false;
    setBarVisibility(true);
  }
}

////////////////////////////////////////////////////////////////////////////////
//  worker threads
////////////////////////////////////////////////////////////////////////////////

const { Worker } = require("worker_threads");

////////////////////////////////////////////////////////////////////////////////
//  ipc handlers
////////////////////////////////////////////////////////////////////////////////

ipcMain.on("tray-click", () => {
  toggleTrayWindow();
});

ipcMain.handle("get-profile-image", async () => {
  const profileImagePath = await getProfileImagePathFromHelper();
  return await loadImageAsDataUrl(profileImagePath);
});

ipcMain.handle("run-speedtest", async () => {
  if (speedTestInFlight) {
    return { status: "running" };
  }

  speedTestInFlight = true;

  try {
    let lastResult = null;
    let lastError = null;

    for (let i = 0; i < 3; i += 1) {
      try {
        const pingMs = await measurePingMs();
        const downloadMbps = await measureDownloadMbps();
        const uploadMbps = await measureUploadMbps();
        lastResult = {
          pingMs,
          downloadMbps,
          uploadMbps,
          isp: null,
          serverName: "Cloudflare",
        };
      } catch (attemptError) {
        lastError = attemptError;
      }
    }

    if (!lastResult) {
      return {
        status: "error",
        message: lastError?.message || "Speed test failed.",
      };
    }

    await persistLastSpeedTest(lastResult);
    return lastResult;
  } catch (error) {
    return {
      status: "error",
      message: error?.message || "Speed test failed.",
    };
  } finally {
    speedTestInFlight = false;
  }
});

ipcMain.handle("get-hardware-info", () => {
  console.log('get-hardware-info IPC handler called');
  const { getHardwareInfoSync } = require("./hardware-info");
  const info = getHardwareInfoSync();
  console.log('Returning hardware info:', info);
  return info;
});

ipcMain.handle("get-commands-config", async () => {
  const commands = await loadCommandsConfig();
  return {
    path: commandsConfigPath,
    commands,
  };
});

ipcMain.handle("run-command", async (_event, payload) => {
  if (!payload || typeof payload.command !== "string") {
    return { ok: false, message: "Invalid command." };
  }

  setImmediate(() => {
    const ok = spawnAlacritty(payload.command, payload.cwd || null);
    if (!ok) {
      console.warn("Failed to launch Alacritty for command.");
    }
  });

  return { ok: true, status: "launching" };
});

ipcMain.handle("open-system-tool", async (_event, tool) => {
  const toolMap = {
    "control-panel": { file: "control.exe", args: [] },
    "windows-terminal": { file: "wt.exe", args: [] },
    "registry-editor": { file: "regedit.exe", args: [] },
    "system-variables": {
      file: "rundll32.exe",
      args: ["sysdm.cpl,EditEnvironmentVariables"],
    },
  };

  const entry = toolMap[tool];
  if (!entry) {
    return { ok: false, message: "Unknown tool." };
  }

  return new Promise((resolve) => {
    const launchFile = tool === "registry-editor" ? "powershell.exe" : "cmd.exe";
    const launchArgs =
      tool === "registry-editor"
        ? ["-NoProfile", "-Command", "Start-Process regedit.exe -Verb RunAs"]
        : ["/c", "start", "", entry.file, ...entry.args];

    execFile(launchFile, launchArgs, { windowsHide: true }, (error) => {
      if (error) {
        console.warn("Failed to open system tool:", error);
        resolve({ ok: false, message: error.message || "Failed to open." });
        return;
      }
      resolve({ ok: true });
    });
  });
});

////////////////////////////////////////////////////////////////////////////////
//  lifecycle
////////////////////////////////////////////////////////////////////////////////

app.whenReady().then(async () => {
  if (process.platform === "win32") {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
      args: [],
    });
  }

  lastMediaPath = path.join(app.getPath("userData"), "last-media.json");
  lastSpeedTestPath = path.join(app.getPath("userData"), "last-speedtest.json");
  commandsConfigPath = path.join(app.getPath("home"), ".aprl-wsbar", "commands.json");
  await ensureCommandsConfig();

  smtcWorker = new Worker(path.join(__dirname, "media.js"));

  smtcWorker.on("message", (msg) => {
    if (msg.type === "media") {
      const mediaPayload = {
        ...msg.mediaProps,
        albumArt: msg.albumDataUrl
      };

      mainWindow.webContents.send("now-playing", mediaPayload);
      persistLastMedia(mediaPayload);
    }

    if (msg.type === "playback") {
      mainWindow.webContents.send("playback-state", msg.playbackInfo);
    }

    if (msg.type === "initial") {
      mainWindow.webContents.send("initial-session", msg.current);
    }
  });

  appbar = spawn(appBarExePath, { windowsHide: true });

  createWindow();
  createTrayWindow();
  createSystemTray();

  runPingChecks();
  pingInterval = setInterval(runPingChecks, 15000);

  initSystemMonitoring(mainWindow);
  initWindowTracking(mainWindow, handleActiveWindow);
  await initHardwareInfo().then(() => {
    if (trayWindow && !trayWindow.isDestroyed()) {
      const { getHardwareInfoSync } = require("./hardware-info");
      const info = getHardwareInfoSync();
      trayWindow.webContents.send("hardware-info", info);
    }
  });

  globalShortcut.register("Home", toggleTrayWindow);

  app.on("quit", () => {
    stopSystemMonitoring();
    stopWindowTracking();
    globalShortcut.unregisterAll();
    appbar?.kill();
    smtcWorker?.terminate();
    if (pingInterval) {
      clearInterval(pingInterval);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      createTrayWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
