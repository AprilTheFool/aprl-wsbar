import { parentPort } from 'worker_threads';
import { SMTCMonitor } from '@coooookies/windows-smtc-monitor';

const monitor = new SMTCMonitor();

// Listen for media metadata changes
monitor.on('session-media-changed', (appId, mediaProps) => {
  parentPort.postMessage({ type: 'media', appId, mediaProps });
});

// Listen for playback state changes
monitor.on('session-playback-changed', (appId, playbackInfo) => {
  parentPort.postMessage({ type: 'playback', appId, playbackInfo });
});

// Optionally send initial current session
const current = SMTCMonitor.getCurrentMediaSession();
if (current) {
  parentPort.postMessage({ type: 'initial', current });
}

monitor.on('session-media-changed', (appId, mediaProps) => {
    let albumDataUrl = null;

    if (mediaProps.thumbnail) {
        // Convert Buffer / Uint8Array to base64
        const base64 = Buffer.from(mediaProps.thumbnail).toString('base64');
        albumDataUrl = `data:image/png;base64,${base64}`;
    }

    // Send the media info + album art to main process
    parentPort.postMessage({ type: 'media', appId, mediaProps, albumDataUrl });
});
