import { createHash } from "node:crypto";
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const port = Number(process.env.BACKUP_SMOKE_PORT ?? 8795);
const accessToken = process.env.BACKUP_SMOKE_ACCESS_TOKEN?.trim() ?? "";
const root = process.cwd();
const testResultsDir = path.join(root, "test-results");
const persistDir = path.join(testResultsDir, "backup-smoke-state");
const stdoutPath = path.join(testResultsDir, "backup-smoke-wrangler.out.log");
const stderrPath = path.join(testResultsDir, "backup-smoke-wrangler.err.log");
const wranglerBin = path.resolve(
  "node_modules/.bin",
  process.platform === "win32" ? "wrangler.cmd" : "wrangler"
);

mkdirSync(testResultsDir, { recursive: true });
rmSync(persistDir, { recursive: true, force: true });
rmSync(stdoutPath, { force: true });
rmSync(stderrPath, { force: true });
let stdoutFd;
let stderrFd;

async function main() {
  if (!accessToken) {
    throw new Error(
      "BACKUP_SMOKE_ACCESS_TOKEN is required. Sign in locally with Logto and provide a Worker API access token for the configured API resource."
    );
  }

  applyLocalMigration();

  const server = startWranglerDev();
  let failed = false;
  try {
    await waitForHead();
    await runBackupSmoke();
  } catch (error) {
    failed = true;
    closeLogFiles();
    printLogsOnFailure();
    throw error;
  } finally {
    stopProcessTree(server.pid);
    rmSync(persistDir, { recursive: true, force: true });
    closeLogFiles();
    if (!failed) {
      rmSync(stdoutPath, { force: true });
      rmSync(stderrPath, { force: true });
    }
  }
}

function applyLocalMigration() {
  const result = spawnSync(
    wranglerBin,
    [
      "--config",
      "wrangler.jsonc",
      "d1",
      "migrations",
      "apply",
      "ggartifact-backup",
      "--local",
      "--persist-to",
      persistDir,
      "--env",
      "dev",
    ],
    {
      cwd: root,
      shell: process.platform === "win32",
      stdio: "inherit",
    }
  );
  if (result.status !== 0) {
    throw new Error("local D1 migration failed");
  }
}

function startWranglerDev() {
  writeFileSync(stdoutPath, "");
  writeFileSync(stderrPath, "");
  stdoutFd = openSync(stdoutPath, "a");
  stderrFd = openSync(stderrPath, "a");

  return spawn(
    wranglerBin,
    [
      "--config",
      "wrangler.jsonc",
      "dev",
      "--env",
      "dev",
      "--port",
      String(port),
      "--local",
      "--persist-to",
      persistDir,
      "--log-level",
      "error",
      "--show-interactive-dev-session=false",
    ],
    {
      cwd: root,
      shell: process.platform === "win32",
      detached: process.platform !== "win32",
      stdio: ["ignore", stdoutFd, stderrFd],
    }
  );
}

async function waitForHead() {
  const startedAt = Date.now();
  let lastError = "";
  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(`${baseUrl()}/head`, { headers: authHeaders() });
      if (response.ok) return;
      lastError = `${response.status} ${await response.text()}`;
    } catch (error) {
      lastError = String(error);
    }
    await sleep(500);
  }
  throw new Error(`wrangler dev did not become ready: ${lastError}`);
}

async function runBackupSmoke() {
  const initialHead = await readJson(
    await must(fetch(`${baseUrl()}/head`, { headers: authHeaders() }), "head")
  );
  if (!initialHead.changed || !Array.isArray(initialHead.heads)) {
    throw new Error(`unexpected head response: ${JSON.stringify(initialHead)}`);
  }

  const objectText = "local worker smoke backup body";
  const objectBytes = new TextEncoder().encode(objectText);
  const logicalBytes = new TextEncoder().encode(JSON.stringify({ smoke: true }));
  const form = new FormData();
  const manifest = {
    idempotencyKey: `smoke_${Date.now()}`,
    deviceId: "smoke-device",
    deviceLabel: "Wrangler smoke test",
    puts: [
      {
        commitObjectKey: "builds",
        partitionKey: "builds/all",
        schemaVersion: 1,
        contentHash: sha256(logicalBytes),
        compressedHash: sha256(objectBytes),
        logicalBytes: logicalBytes.byteLength,
        compressedBytes: objectBytes.byteLength,
        metadata: {
          schemaVersion: 1,
          records: [{ kind: "builds", count: 1, updatedAt: Date.now() }],
        },
        writeMode: { kind: "overwrite" },
      },
    ],
    deletes: [],
  };

  form.append(
    "manifest",
    new Blob([JSON.stringify(manifest)], { type: "application/json" }),
    "manifest.json"
  );
  form.append(
    "builds",
    new Blob([objectBytes], { type: "application/gzip" }),
    "builds.json.gz"
  );

  const commit = await readJson(
    await must(
      fetch(`${baseUrl()}/commits`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      }),
      "commit"
    )
  );
  const head = commit.heads?.[0];
  if (head?.partitionKey !== "builds/all" || !head.objectId) {
    throw new Error(`unexpected commit response: ${JSON.stringify(commit)}`);
  }

  const noChange = await readJson(
    await must(
      fetch(`${baseUrl()}/head?headSetRev=${encodeURIComponent(commit.headSetRev)}`, {
        headers: authHeaders(),
      }),
      "no-change head"
    )
  );
  if (noChange.changed !== false) {
    throw new Error(`expected no-change head: ${JSON.stringify(noChange)}`);
  }

  const objectsResponse = await must(
    fetch(`${baseUrl()}/objects`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ objectIds: [head.objectId] }),
    }),
    "objects"
  );
  const objectForm = await objectsResponse.formData();
  const objectPart = objectForm.get(head.objectId);
  if (!(objectPart instanceof Blob)) {
    throw new Error("download response did not include object blob");
  }
  const downloadedText = await objectPart.text();
  if (downloadedText !== objectText) {
    throw new Error(`unexpected downloaded object body: ${downloadedText}`);
  }

  console.log(
    `Backup smoke passed: ${head.partitionKey} ${head.objectId} ${commit.headSetRev}`
  );
}

async function must(responsePromise, label) {
  const response = await responsePromise;
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${await response.text()}`);
  }
  return response;
}

async function readJson(response) {
  return response.json();
}

function authHeaders() {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function baseUrl() {
  return `http://127.0.0.1:${port}/api/backup/v1`;
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopProcessTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
      stdio: "ignore",
    });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
  }
}

function printLogsOnFailure() {
  for (const [label, filePath] of [
    ["stdout", stdoutPath],
    ["stderr", stderrPath],
  ]) {
    try {
      const content = readFileSync(filePath, "utf8");
      console.error(`--- wrangler ${label} ---\n${content.slice(-8000)}`);
    } catch {}
  }
}

function closeLogFiles() {
  for (const fd of [stdoutFd, stderrFd]) {
    if (typeof fd === "number") {
      try {
        closeSync(fd);
      } catch {}
    }
  }
  stdoutFd = undefined;
  stderrFd = undefined;
}

main().catch((error) => {
  process.exitCode = 1;
  console.error(error);
  closeLogFiles();
});
