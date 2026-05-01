import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const WORKER_DIR = "worker";
const RESTRICTED_IMPORTS = [
  "fs",
  "node:fs",
  "child_process",
  "node:child_process",
  "net",
  "node:net",
  "tls",
  "node:tls",
];

function listTsFiles(dir) {
  const result = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      result.push(...listTsFiles(fullPath));
    } else if (fullPath.endsWith(".ts")) {
      result.push(fullPath);
    }
  }
  return result;
}

function fail(findings) {
  console.error("Worker safety check failed:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

const findings = [];

for (const file of listTsFiles(WORKER_DIR)) {
  const source = readFileSync(file, "utf8");
  const normalized = file.replaceAll("\\", "/");

  for (const importName of RESTRICTED_IMPORTS) {
    const escaped = importName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const importPattern = new RegExp(
      String.raw`(?:from\s+["']${escaped}["']|import\s*\(\s*["']${escaped}["']\s*\)|require\s*\(\s*["']${escaped}["']\s*\))`
    );
    if (importPattern.test(source)) {
      findings.push(`${normalized}: restricted Worker import '${importName}'`);
    }
  }

  if (/\bpassThroughOnException\s*\(/.test(source)) {
    findings.push(`${normalized}: passThroughOnException is fail-open`);
  }

  if (/\bMath\.random\s*\(/.test(source)) {
    findings.push(`${normalized}: use crypto.getRandomValues instead of Math.random`);
  }
}

if (findings.length > 0) {
  fail(findings);
}

console.log("Worker safety check passed.");
