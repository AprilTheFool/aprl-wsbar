const { parentPort } = require('worker_threads');
const si = require('systeminformation');

async function getSystemStats() {
  try {
    // fetch stats
    const [cpu, mem, networkStats] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.networkStats()
    ]);

    const cpuUsage = Math.round(cpu.currentLoad);
    const memUsage = Math.round((mem.used / mem.total) * 100);
    
    // network stats, convert to mbps
    const netStats = networkStats.length > 0 ? networkStats[0] : { rx_sec: 0, tx_sec: 0 };
    const rxMbps = (netStats.rx_sec * 8 / 1000000).toFixed(1);
    const txMbps = (netStats.tx_sec * 8 / 1000000).toFixed(1);

    return {
      cpu: cpuUsage,
      memory: memUsage,
      rxMbps: parseFloat(rxMbps),
      txMbps: parseFloat(txMbps)
    };
  } catch (error) {
    console.error('Error getting system stats:', error);
    return {
      cpu: 0,
      memory: 0,
      rxMbps: 0,
      txMbps: 0
    };
  }
}

// check every 3 seconds
setInterval(async () => {
  const stats = await getSystemStats();
  parentPort.postMessage(stats);
}, 3000);

// send initial stats
getSystemStats().then(stats => {
  parentPort.postMessage(stats);
});
