window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }
})

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onNowPlaying: (callback) => ipcRenderer.on('now-playing', callback),
  onPlaybackState: (callback) => ipcRenderer.on('playback-state', callback),
  onInitialSession: (callback) => ipcRenderer.on('initial-session', callback),
  onSystemStats: (callback) => ipcRenderer.on('system-stats', callback),
  onActiveWindow: (callback) => ipcRenderer.on('active-window', callback),
  onHardwareInfo: (callback) => ipcRenderer.on('hardware-info', callback),
  onPingStatus: (callback) => ipcRenderer.on('ping-status', callback),
  onProfileImage: (callback) => ipcRenderer.on('profile-image', callback),
  onSpeedTestResult: (callback) => ipcRenderer.on('speedtest-result', callback),

  toggleTray: () => ipcRenderer.send('toggle-tray'),
  getHardwareInfo: () => ipcRenderer.invoke('get-hardware-info'),
  getProfileImage: () => ipcRenderer.invoke('get-profile-image'),
  runSpeedTest: () => ipcRenderer.invoke('run-speedtest'),
  getCommandsConfig: () => ipcRenderer.invoke('get-commands-config'),
  runCommand: (payload) => ipcRenderer.invoke('run-command', payload),
  openSystemTool: (tool) => ipcRenderer.invoke('open-system-tool', tool)
});

