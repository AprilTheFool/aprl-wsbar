
////////////////////////////////////////////////////////////////////////////////
//  load hardware info and display in trayWindow (.tray-profile-info)
////////////////////////////////////////////////////////////////////////////////

async function loadHardwareInfo() {
  try {
    console.log('Fetching hardware info...');
    const info = await window.electronAPI.getHardwareInfo();
    console.log('Hardware info received:', info);
    displayHardwareInfo(info);
  } catch (error) {
    console.error('Error loading hardware info:', error);
    document.getElementById('os-read').textContent = 'Error: ' + error.message;
    document.getElementById('ip-read').textContent = 'Error';
    document.getElementById('cpu-read').textContent = 'Error';
    document.getElementById('gpu-read').textContent = 'Error';
  }
}

// push info to html
function displayHardwareInfo(info) {
  document.getElementById('os-read').textContent = 'OS: ' + (info.os || 'N/A');
  document.getElementById('ip-read').textContent = 'IP: ' + (info.ip || 'N/A');
  document.getElementById('cpu-read').textContent = 'CPU: ' + (info.cpu || 'N/A');
  document.getElementById('gpu-read').textContent = 'GPU: ' + (info.gpu || 'N/A');
}

// listen for updates
window.electronAPI.onHardwareInfo((_event, info) => {
  console.log('Received hardware info event:', info);
  displayHardwareInfo(info);
});

// run once page has finished loading
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadHardwareInfo);
} else {
  loadHardwareInfo();
}
