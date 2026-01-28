const {
  app,
  BrowserWindow,
  screen,
  globalShortcut,
  ipcMain,
} = require("electron");
const { spawn } = require("child_process");
const path = require("node:path");

let mainWindow;
let trayWindow;

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

  // dev tools
  //mainWindow.webContents.openDevTools();
}

function createTrayWindow() {
  const display = screen.getPrimaryDisplay();
  const scaleFactor = display.scaleFactor;
  const BAR_HEIGHT = 24;
  const TRAY_WIDTH = Math.round(500 * scaleFactor);

  const trayY = Math.round(BAR_HEIGHT * scaleFactor);
  const trayHeight = 400;

  trayWindow = new BrowserWindow({
    width: TRAY_WIDTH,
    height: trayHeight,
    x: display.bounds.x + 10,
    y: display.bounds.y + trayY + 10,
    frame: false,
    transparent: true,
    resizable: false,
    fullscreenable: false,
    show: false, // hidden on startup
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
  // dev tools
  mainWindow.webContents.openDevTools();
  trayWindow.on("closed", () => {
    trayWindow = null;
  });
}

function toggleTrayWindow() {
  if (!trayWindow) return;

  if (trayWindow.isVisible()) {
    trayWindow.hide();
  } else {
    trayWindow.show();
    trayWindow.focus();
  }
}

const { Worker } = require("worker_threads");

const smtcWorker = new Worker(path.join(__dirname, "media.js"));

smtcWorker.on("message", (msg) => {
  if (msg.type === "media") {
    mainWindow.webContents.send("now-playing", {
      ...msg.mediaProps,
      albumArt: msg.albumDataUrl
    });
  }

  if (msg.type === "playback") {
    mainWindow.webContents.send("playback-state", msg.playbackInfo);
  }

  if (msg.type === "initial") {
    mainWindow.webContents.send("initial-session", msg.current);
  }
});


ipcMain.on("tray-click", () => {
  toggleTrayWindow();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  appbar = spawn(
    path.join(
      __dirname,
      "./AppBarHelper/bin/Release/net8.0-windows/AppBarHelper.exe",
    ),
    { windowsHide: true },
  );

  createWindow();
  createTrayWindow();

  globalShortcut.register("Home", toggleTrayWindow);

  app.on("quit", () => {
    globalShortcut.unregisterAll();
    appbar?.kill();
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
