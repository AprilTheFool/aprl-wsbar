const { Worker } = require('worker_threads');
const path = require('path');

let systemWorker;
let mainWindow;

function initSystemMonitoring(window) {
  mainWindow = window;

  // Create worker thread for system monitoring
  systemWorker = new Worker(path.join(__dirname, 'system-worker.js'));

  systemWorker.on('message', (stats) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system-stats', stats);
    }
  });

  systemWorker.on('error', (err) => {
    console.error('System worker error:', err);
  });

  // Clean up on window close
  mainWindow.on('closed', () => {
    stopSystemMonitoring();
  });
}

function stopSystemMonitoring() {
  if (systemWorker) {
    systemWorker.terminate();
    systemWorker = null;
  }
}

module.exports = { initSystemMonitoring, stopSystemMonitoring };
