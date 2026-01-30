////////////////////////////////////////////////////////////////////////////////
//  music widget listener
////////////////////////////////////////////////////////////////////////////////

import { parentPort } from 'worker_threads';
import { SMTCMonitor } from '@coooookies/windows-smtc-monitor';
// https://npm.io/package/@coooookies/windows-smtc-monitor

const monitor = new SMTCMonitor();

function isSpotify(appId) {
  // spotify filter (change later to include other music players)
  if (!appId) return false;

  return (
    appId.includes('Spotify') ||
    appId === 'Spotify.exe'
  );
}


// listen for playback changes
monitor.on('session-playback-changed', (appId, playbackInfo) => {
  if (!isSpotify(appId)) return;

  parentPort.postMessage({
    type: 'playback',
    appId,
    playbackInfo
  });
});

// send initial session if it exists
const current = SMTCMonitor.getCurrentMediaSession();
if (current && isSpotify(current.appId)) {
  parentPort.postMessage({
    type: 'initial',
    current
  });
}


// check metadata changes
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

