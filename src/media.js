import { parentPort } from 'worker_threads';
import { SMTCMonitor } from '@coooookies/windows-smtc-monitor';

const monitor = new SMTCMonitor();

function isSpotify(appId) {
  if (!appId) return false;

  return (
    appId.includes('Spotify') ||
    appId === 'Spotify.exe'
  );
}


// Listen for media metadata changes
monitor.on('session-playback-changed', (appId, playbackInfo) => {
  if (!isSpotify(appId)) return;

  parentPort.postMessage({
    type: 'playback',
    appId,
    playbackInfo
  });
});

// Optionally send initial current session
const current = SMTCMonitor.getCurrentMediaSession();
if (current && isSpotify(current.appId)) {
  parentPort.postMessage({
    type: 'initial',
    current
  });
}


monitor.on('session-media-changed', (appId, mediaProps) => {
  if (!isSpotify(appId)) return;

  let albumDataUrl = null;

  if (mediaProps.thumbnail) {
    const base64 = Buffer.from(mediaProps.thumbnail).toString('base64');
    albumDataUrl = `data:image/png;base64,${base64}`;
  }

  parentPort.postMessage({
    type: 'media',
    appId,
    mediaProps,
    albumDataUrl
  });
});

