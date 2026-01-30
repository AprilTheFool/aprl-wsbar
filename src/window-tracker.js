const activeWin = require('active-win');

let mainWindow;
let trackingInterval = null;
let lastWindowTitle = '';
let lastBoundsKey = '';

async function getActiveWindowInfo() {
  try {
    const result = await activeWin();
    return result || null;
  } catch (error) {
    console.error('Error getting active window:', error);
    return null;
  }
}

function initWindowTracking(window, onActiveWindow) {
  mainWindow = window;

  if (trackingInterval) {
    clearInterval(trackingInterval);
  }

  // check focus every 500ms
  trackingInterval = setInterval(async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const info = await getActiveWindowInfo();
      const title = info?.title || '';
      const bounds = info?.bounds;
      const boundsKey = bounds ? `${bounds.x},${bounds.y},${bounds.width},${bounds.height}` : '';
      const titleChanged = title !== lastWindowTitle;
      const boundsChanged = boundsKey !== lastBoundsKey;

      if (titleChanged) {
        lastWindowTitle = title;
        mainWindow.webContents.send('active-window', title);
      }

      if (titleChanged || boundsChanged) {
        lastBoundsKey = boundsKey;
        if (typeof onActiveWindow === 'function') {
          onActiveWindow(info);
        }
      }
    }
  }, 500);

  // initial window title
  getActiveWindowInfo().then(info => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const title = info?.title || '';
      const bounds = info?.bounds;
      lastWindowTitle = title;
      lastBoundsKey = bounds ? `${bounds.x},${bounds.y},${bounds.width},${bounds.height}` : '';
      mainWindow.webContents.send('active-window', title);
      if (typeof onActiveWindow === 'function') {
        onActiveWindow(info);
      }
    }
  });

  // clean up
  mainWindow.on('closed', () => {
    stopWindowTracking();
  });
}
function stopWindowTracking() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  lastWindowTitle = '';
  lastBoundsKey = '';
}

module.exports = { initWindowTracking, stopWindowTracking };
