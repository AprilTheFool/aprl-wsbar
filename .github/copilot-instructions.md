# Windows AppBar Status Bar - AI Coding Instructions

## Architecture Overview

Personal-use Windows-only Electron app creating a macOS-style status bar using Windows AppBar API:

1. **Electron Main Process** ([src/main.js](../src/main.js)): Two frameless, transparent windows - 24px status bar + tray dropdown (toggled via click or `Home` key)

2. **C# AppBar Helper** ([src/AppBarHelper/Program.cs](../src/AppBarHelper/Program.cs)): .NET app reserving 24px screen space via `SHAppBarMessage` API

3. **Media Worker** ([src/media.js](../src/media.js)): Worker thread monitoring **Spotify-only** playback via `@coooookies/windows-smtc-monitor`

## Critical Technical Patterns

### Window Configuration
- Main bar uses `setIgnoreMouseEvents(true, { forward: true })` to be click-through except for interactive elements
- Both windows use `alwaysOnTop: true` with `"screen-saver"` level for z-order priority
- `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` ensures visibility across virtual desktops

### AppBar Integration Process
1. Electron spawns [AppBarHelper.exe](../src/AppBarHelper/bin/Release/net8.0-windows/AppBarHelper.exe) on startup
2. C# helper reserves 24px at screen top using `ABM_NEW` and `ABM_SETPOS`
3. Process runs hidden (`windowsHide: true`) until app quits
4. On quit, helper sends `ABM_REMOVE` to free reserved space

### Media Monitoring
- Worker thread filters events to **Spotify only** via `isSpotify()` check
- Converts album thumbnails to base64 data URLs before IPC transmission
- Main process forwards three event types to renderer:
  - `now-playing`: Media metadata with album art
  - `playback-state`: Play/pause status
  - `initial-session`: Current state on startup

### IPC Communication Pattern
```javascript
// Preload exposes limited API via contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  onNowPlaying: (callback) => ipcRenderer.on('now-playing', callback),
  toggleTray: () => ipcRenderer.send('toggle-tray')
});

// Renderer uses exposed API only
window.electronAPI.onNowPlaying((_event, data) => { ... });
```

## Development Workflow

**Running:** `cd src && npm start`

**C# Changes:** `cd src/AppBarHelper && dotnet build -c Release` (outputs to bin/Release/net8.0-windows/)

**Debugging:** Uncomment `openDevTools()` in main.js (line 48 for main bar, line 89 for tray)

## Project-Specific Conventions

1. **No Generic Media Support**: Only Spotify is supported. The `isSpotify()` filter in [media.js](../src/media.js#L4-L11) is intentional—do not expand to other apps without explicit requirement

2. **Fixed 24px Height**: Hardcoded across both Electron and C# code. Changing requires updates in:
   - [main.js](../src/main.js#L17): `const BAR_HEIGHT = 24`
   - [Program.cs](../src/AppBarHelper/Program.cs#L75): `abd.rc.bottom = 24`

3. **DPI Scaling**: Uses `display.scaleFactor` for window dimensions but C# helper uses `SetProcessDpiAwarenessContext` for proper AppBar registration

4. **No Build System**: Relies on manual Electron execution (`npm start`) and pre-compiled C# binary—no webpack/bundler configuration

5. **Time  Conventions

1. **Spotify-Only**: `isSpotify()` filter in [media.js](../src/media.js#L4-L11) is intentional—don't expand without explicit need

2. **Fixed 24px Height**: Hardcoded in both [main.js](../src/main.js#L17) (`BAR_HEIGHT = 24`) and [Program.cs](../src/AppBarHelper/Program.cs#L75) (`abd.rc.bottom = 24`)

3. **No Build System**: Manual execution via `npm start`, no bundler

4. **Time Format**: 12-hour + DD/MM in [time.js](../src/time.js)