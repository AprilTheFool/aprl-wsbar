/**
 * This file is loaded via the <script> tag in the index.html file and will
 * be executed in the renderer process for that window. No Node.js APIs are
 * available in this process because `nodeIntegration` is turned off and
 * `contextIsolation` is turned on. Use the contextBridge API in `preload.js`
 * to expose Node.js functionality from the main process.
 */



// window.electronAPI.onNowPlaying((event, media) => {
//   const nowPlayingEl = document.getElementById('now-playing');
//   nowPlayingEl.innerText = `${media.title} - ${media.artist}`;

//   const albumImg = document.getElementById('album-art');
//   if (media.albumArt) {
//     albumImg.src = media.albumArt;
//   } else {
//     albumImg.src = ''; // or a default placeholder
//   }
// });



window.electronAPI.onPlaybackState((event, state) => {
  console.log('Playback state changed:', state.playbackStatus);
});

window.electronAPI.onInitialSession((event, current) => {
  if (current && current.media) {
    document.getElementById('title').innerText = current.media.title;
    document.getElementById('artist').innerText = current.media.artist;
  }
});


document.addEventListener('DOMContentLoaded', () => {
  const trayButton = document.querySelector('.icon')

  if (!trayButton) return

  trayButton.addEventListener('click', () => {
    window.electronAPI.toggleTray()
  })
})

function setTrayProfileImage(imageSource) {
  if (!imageSource) return;
  const img = document.querySelector('.tray-profile-image img');
  if (!img) return;

  const trimmed = String(imageSource).trim();
  if (!trimmed) return;

  img.src = trimmed;
}

window.electronAPI.onProfileImage((_event, imagePath) => {
  setTrayProfileImage(imagePath);
});

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.electronAPI.getProfileImage) return;
  try {
    const imagePath = await window.electronAPI.getProfileImage();
    setTrayProfileImage(imagePath);
  } catch (error) {
    console.warn('Failed to load profile image:', error);
  }
});

function updateSpeedTestResults(result) {
  const pingEl = document.getElementById('speedtest-ping');
  const downEl = document.getElementById('speedtest-download');
  const upEl = document.getElementById('speedtest-upload');
  const serverEl = document.getElementById('speedtest-server');

  if (!pingEl || !downEl || !upEl || !serverEl) return;

  if (!result) {
    pingEl.textContent = '-- ms';
    downEl.textContent = '-- Mbps';
    upEl.textContent = '-- Mbps';
    serverEl.textContent = '--';
    return;
  }

  pingEl.textContent =
    typeof result.pingMs === 'number' ? `${result.pingMs} ms` : '-- ms';
  downEl.textContent =
    typeof result.downloadMbps === 'number'
      ? `${result.downloadMbps.toFixed(1)} Mbps`
      : '-- Mbps';
  upEl.textContent =
    typeof result.uploadMbps === 'number'
      ? `${result.uploadMbps.toFixed(1)} Mbps`
      : '-- Mbps';
  serverEl.textContent = result.serverName || '--';
}

window.electronAPI.onSpeedTestResult((_event, result) => {
  updateSpeedTestResults(result);
  const statusEl = document.getElementById('speedtest-status');
  if (statusEl) {
    statusEl.textContent = 'Last result';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('speedtest-btn');
  const statusEl = document.getElementById('speedtest-status');

  if (!button || !statusEl || !window.electronAPI.runSpeedTest) return;

  button.addEventListener('click', async () => {
    button.disabled = true;
    statusEl.textContent = 'Running...';

    try {
      const result = await window.electronAPI.runSpeedTest();

      if (!result) {
        statusEl.textContent = 'No result.';
        updateSpeedTestResults(null);
      } else if (result.status === 'running') {
        statusEl.textContent = 'Already running.';
      } else if (result.status === 'error') {
        statusEl.textContent = result.message || 'Failed.';
        updateSpeedTestResults(null);
      } else {
        statusEl.textContent = 'Complete';
        updateSpeedTestResults(result);
      }
    } catch (error) {
      statusEl.textContent = 'Failed.';
      updateSpeedTestResults(null);
    } finally {
      button.disabled = false;
    }
  });
});

async function loadCommandsPanel() {
  const listEl = document.getElementById('commands-list');
  const pathEl = document.getElementById('commands-path');
  if (!listEl || !window.electronAPI.getCommandsConfig) return;

  listEl.innerHTML = '';
  if (pathEl) pathEl.textContent = '';

  try {
    const config = await window.electronAPI.getCommandsConfig();
    const commands = Array.isArray(config?.commands) ? config.commands : [];

    if (pathEl && config?.path) {
      pathEl.textContent = `Config: ${config.path}`;
    }

    if (!commands.length) {
      const empty = document.createElement('div');
      empty.className = 'tray-command-text';
      empty.textContent = 'No commands configured.';
      listEl.appendChild(empty);
      return;
    }

    commands.forEach((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tray-command-button';

      const label = document.createElement('span');
      label.className = 'tray-command-label';
      label.textContent = entry.label || entry.command;

      const text = document.createElement('span');
      text.className = 'tray-command-text';
      text.textContent = entry.command;

      button.appendChild(label);
      button.appendChild(text);

      button.addEventListener('click', async () => {
        if (!window.electronAPI.runCommand) return;
        const payload = {
          command: entry.command,
          cwd: entry.cwd || null,
        };
        try {
          window.electronAPI.runCommand(payload).catch((error) => {
            console.warn('Failed to run command:', error);
          });
        } catch (error) {
          console.warn('Failed to run command:', error);
        }
      });

      listEl.appendChild(button);
    });
  } catch (error) {
    const errorEl = document.createElement('div');
    errorEl.className = 'tray-command-text';
    errorEl.textContent = 'Failed to load commands.';
    listEl.appendChild(errorEl);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadCommandsPanel();

  const refreshButton = document.getElementById('commands-refresh');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      loadCommandsPanel();
    });
  }

  const footerButtons = document.querySelectorAll('[data-system-tool]');
  if (footerButtons.length && window.electronAPI.openSystemTool) {
    footerButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        const tool = button.getAttribute('data-system-tool');
        if (!tool) return;
        try {
          await window.electronAPI.openSystemTool(tool);
        } catch (error) {
          console.warn('Failed to open system tool:', error);
        }
      });
    });
  }
});


const musicEl = document.getElementById("music-widget");
const nowPlayingEl = document.getElementById("now-playing");

window.electronAPI.onNowPlaying((_event, data) => {
  if (data.albumArt) {
    musicEl.style.backgroundImage = `url(${data.albumArt})`;
  }

  if (data.title && data.artist) {
    nowPlayingEl.textContent = `${data.artist} – ${data.title}`;
  } else if (data.title) {
    nowPlayingEl.textContent = data.title;
  }
});

// System stats monitoring
window.electronAPI.onSystemStats((_event, stats) => {
  document.getElementById('cpu-usage').textContent = `CPU ${stats.cpu}%`;
  document.getElementById('memory-usage').textContent = `MEM ${stats.memory}%`;
  document.getElementById('network-usage').textContent = `↓${stats.rxMbps} ↑${stats.txMbps}`;
});

// Active window tracking
window.electronAPI.onActiveWindow((_event, title) => {
  document.getElementById('active-window').textContent = title;
});

// Ping status (tray only)
window.electronAPI.onPingStatus((_event, payload) => {
  if (!payload || !payload.results) return;

  const dots = document.querySelectorAll('[data-ping-host]');
  if (!dots.length) return;

  const logEntries = [];

  dots.forEach((dot) => {
    const host = dot.getAttribute('data-ping-host');
    if (!host) return;

    const result = payload.results[host];
    const isOnline = typeof result === 'object' ? result.ok : result;
    const timeMs = typeof result === 'object' ? result.timeMs : null;
    if (isOnline) {
      dot.classList.add('is-online');
    } else {
      dot.classList.remove('is-online');
    }

    logEntries.push({ host, ok: !!isOnline, timeMs });
  });

  console.log('Ping results:', logEntries);
});