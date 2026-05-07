import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const bin = process.execPath;
const e2eStatePath = path.join(root, ".wrangler", "e2e-state");

resetE2eState();

const child = spawn(
  bin,
  [path.join(root, "scripts", "dev", "start-worker-dev.js")],
  {
    cwd: root,
    env: {
      ...process.env,
      GGARTIFACT_WRANGLER_PERSIST_TO: e2eStatePath,
      VITE_E2E_FAKE_LOGTO: "1",
      VITE_DEV_PORT: process.env.VITE_DEV_PORT ?? "5174",
    },
    stdio: "inherit",
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

function resetE2eState() {
  const resolvedRoot = path.resolve(root);
  const resolvedStatePath = path.resolve(e2eStatePath);
  if (!resolvedStatePath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Refusing to reset E2E state outside workspace: ${resolvedStatePath}`);
  }
  if (existsSync(resolvedStatePath)) {
    rmSync(resolvedStatePath, { recursive: true, force: true });
  }
}
