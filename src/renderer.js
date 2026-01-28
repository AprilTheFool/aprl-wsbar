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