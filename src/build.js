const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const buildDir = path.join(repoRoot, "build");
const appBarDir = path.join(__dirname, "AppBarHelper");
const appBarOutDir = path.join(appBarDir, "bin", "Release", "net8.0-windows");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      windowsHide: true,
      ...options,
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function cleanBuildDir() {
  await fs.promises.rm(buildDir, { recursive: true, force: true });
  await fs.promises.mkdir(buildDir, { recursive: true });
}

async function buildAppBarHelper() {
  const args = [
    "publish",
    "-c",
    "Release",
    "-r",
    "win-x64",
    "--self-contained",
    "false",
    "-o",
    appBarOutDir,
  ];
  await run("dotnet", args, { cwd: appBarDir });
}

async function buildElectronApp() {
  const packagerScript = path.join(
    __dirname,
    "node_modules",
    "electron-packager",
    "bin",
    "electron-packager.js",
  );

  if (!fs.existsSync(packagerScript)) {
    throw new Error(`electron-packager not found at ${packagerScript}`);
  }

  const ignore = [
    "^/build",
    "^/AppBarHelper/obj",
    "^/AppBarHelper/bin/Debug",
    "^/AppBarHelper/bin/Release/net9.0",
    "^/AppBarHelper/bin/Release/net8.0-windows/.*\\.pdb$",
    "^/AppBarHelper/bin/Release/net8.0-windows/.*\\.xml$",
  ].join("|");

  const args = [
    ".",
    "aprl-wsbar",
    "--platform=win32",
    "--arch=x64",
    `--out=${buildDir}`,
    "--overwrite",
    "--prune=true",
    `--ignore=${ignore}`,
  ];

  await run("node", [packagerScript, ...args], { cwd: __dirname });
}

async function main() {
  await cleanBuildDir();
  await buildAppBarHelper();
  await buildElectronApp();
}

main().catch((error) => {
  console.error("build failed:", error);
  process.exitCode = 1;
});
