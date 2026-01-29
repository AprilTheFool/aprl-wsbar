const si = require('systeminformation');
const os = require('os');

async function getHardwareInfo() {
  try {
    const [osInfo, cpu, gpu] = await Promise.all([
      si.osInfo(),
      si.cpu(),
      si.graphics().catch(() => ({ controllers: [] }))
    ]);

    let cpuName = cpu.brand || 'Unknown CPU';
    let gpuName = 'Unknown GPU';
    
    if (gpu.controllers && gpu.controllers.length > 1) {
      gpuName = gpu.controllers[1].model || 'Unknown GPU';
    } else if (gpu.controllers && gpu.controllers.length > 0) {
      gpuName = gpu.controllers[0].model || 'Unknown GPU';
    }

    // Get IP address from local network interfaces
    let ipAddress = 'N/A';
    try {
      const interfaces = os.networkInterfaces();
      for (const [name, addrs] of Object.entries(interfaces)) {
        if (!name.includes('Loopback') && addrs) {
          const ipv4 = addrs.find(addr => addr.family === 'IPv4' && !addr.internal);
          if (ipv4) {
            ipAddress = ipv4.address;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error getting IP:', error);
    }

    const osDisplay = `${osInfo.distro} ${osInfo.release}`;

    return {
      os: osDisplay,
      ip: ipAddress,
      cpu: cpuName,
      gpu: gpuName
    };
  } catch (error) {
    console.error('Error getting hardware info:', error);
    return {
      os: 'Unknown',
      ip: 'N/A',
      cpu: 'Unknown CPU',
      gpu: 'Unknown GPU'
    };
  }
}

let cachedHardwareInfo = null;

async function initHardwareInfo() {
  console.log('Starting hardware info initialization...');
  try {
    cachedHardwareInfo = await getHardwareInfo();
    console.log('Hardware info initialized:', cachedHardwareInfo);
    return cachedHardwareInfo;
  } catch (error) {
    console.error('Failed to initialize hardware info:', error);
    cachedHardwareInfo = {
      os: 'Error',
      ip: 'Error',
      cpu: 'Error',
      gpu: 'Error'
    };
    return cachedHardwareInfo;
  }
}

function getHardwareInfoSync() {
  console.log('getHardwareInfoSync called, cache:', cachedHardwareInfo);
  return cachedHardwareInfo || {
    os: 'Loading...',
    ip: 'Loading...',
    cpu: 'Loading...',
    gpu: 'Loading...'
  };
}

module.exports = { initHardwareInfo, getHardwareInfo, getHardwareInfoSync };
