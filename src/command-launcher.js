const { spawn } = require("node:child_process");

function parseArgs(argv) {
  const result = { command: null, cwd: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--command") {
      result.command = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg === "--cwd") {
      result.cwd = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
  }
  return result;
}

function launchAlacritty(command, cwd) {
  if (!command || typeof command !== "string") return false;

  const args = [
    "/c",
    "start",
    "\"\"",
    "alacritty",
    "-e",
    "powershell",
    "-NoExit",
    "-Command",
    command,
  ];

  const child = spawn("cmd.exe", args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    cwd: cwd || undefined,
  });

  child.unref();
  return true;
}

try {
  const { command, cwd } = parseArgs(process.argv.slice(2));
  launchAlacritty(command, cwd || null);
} catch (error) {
  // no-op
}
