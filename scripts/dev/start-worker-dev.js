import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const shouldResetBackupState = process.argv.includes("--reset-backup-db");

const bin = (name) =>
  path.resolve(
    root,
    "node_modules",
    ".bin",
    process.platform === "win32" ? `${name}.cmd` : name
  );

if (shouldResetBackupState) {
  resetLocalBackupState();
}

const migration = spawnSync(
  bin("wrangler"),
  [
    "d1",
    "migrations",
    "apply",
    "ggartifact-backup",
    "--local",
    "--env",
    "dev",
  ],
  {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  }
);

if (migration.status !== 0) {
  process.exit(migration.status ?? 1);
}

const vite = spawn(bin("vite"), {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

vite.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

function resetLocalBackupState() {
  const targets = [
    path.join(root, ".wrangler", "state", "v3", "d1"),
    path.join(root, ".wrangler", "state", "v3", "r2", "ggartifact-backup"),
  ];
  for (const target of targets) {
    if (!existsSync(target)) continue;
    rmSync(target, { recursive: true, force: true });
  }
}
