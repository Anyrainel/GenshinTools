#!/usr/bin/env node
/**
 * Pull new production feedback into gitignored local reports.
 *
 * Reports are indexed by fetch time under feedback-reports/. Each incremental
 * run only asks D1 for feedback created after the previous fetch cutoff.
 */

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const REPORT_DIR = resolve(ROOT, "feedback-reports");
const RUN_DIR = resolve(REPORT_DIR, "runs");
const INDEX_PATH = resolve(REPORT_DIR, "index.json");
const INDEX_MD_PATH = resolve(REPORT_DIR, "index.md");
const LEGACY_JSON_PATH = resolve(REPORT_DIR, "current-feedback.json");
const LEGACY_MD_PATH = resolve(REPORT_DIR, "current-feedback.md");
const CLOSED_FEEDBACK_PATH = resolve(REPORT_DIR, "closed-feedback.json");
const DATABASE = "ggartifact-backup";

const QUERY_BASE = `
SELECT
  f.id,
  f.user_id,
  COALESCE(u.display_name, i.identity_display_name) AS display_name,
  i.email,
  f.rating,
  f.suggestion,
  f.bug_report,
  f.metadata_json,
  f.created_at
FROM feedback_submissions f
LEFT JOIN app_users u ON u.id = f.user_id
LEFT JOIN (
  SELECT
    user_id,
    MAX(email) AS email,
    MAX(display_name) AS identity_display_name
  FROM auth_identities
  GROUP BY user_id
) i ON i.user_id = f.user_id
`;

function main() {
  mkdirSync(RUN_DIR, { recursive: true });

  let index = readIndex();
  if (!index) {
    index = bootstrapIndexFromLegacyReport();
  }

  const fetchStartedAt = Date.now();
  const queryCreatedAtGt = latestFetchCutoff(index);
  const rows = fetchFeedbackRows(queryCreatedAtGt);
  const fetchCompletedAt = Date.now();
  const normalizedRows = rows.map(normalizeRow);
  const run = {
    fetchStartedAt,
    fetchStartedAtUtc: new Date(fetchStartedAt).toISOString(),
    fetchCompletedAt,
    fetchCompletedAtUtc: new Date(fetchCompletedAt).toISOString(),
    queryCreatedAtGt,
    queryCreatedAtGtUtc: queryCreatedAtGt
      ? new Date(queryCreatedAtGt).toISOString()
      : null,
    fetchedThroughCreatedAt: fetchStartedAt,
    fetchedThroughCreatedAtUtc: new Date(fetchStartedAt).toISOString(),
    rowCount: normalizedRows.length,
    firstFeedbackCreatedAt:
      normalizedRows[normalizedRows.length - 1]?.createdAtMs ?? null,
    lastFeedbackCreatedAt: normalizedRows[0]?.createdAtMs ?? null,
  };

  const runName = stamp(fetchStartedAt);
  const runJsonPath = resolve(RUN_DIR, `${runName}.json`);
  const runMdPath = resolve(RUN_DIR, `${runName}.md`);
  const closedFeedback = readClosedFeedback();
  const report = {
    run,
    source: `remote D1 ${DATABASE}.feedback_submissions`,
    rows: normalizedRows,
  };

  writeFileSync(runJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(runMdPath, renderReport(report, closedFeedback), "utf8");

  index.runs.push({
    ...run,
    jsonPath: relativeReportPath(runJsonPath),
    mdPath: relativeReportPath(runMdPath),
  });
  writeIndex(index);

  console.log(
    `[feedback] wrote ${normalizedRows.length} new rows to ${relativeReportPath(
      runMdPath
    )}`
  );
  if (normalizedRows.length === 0) {
    console.log("[feedback] no new feedback since the previous fetch cutoff");
  }
}

function readIndex() {
  if (!existsSync(INDEX_PATH)) return null;
  return JSON.parse(readFileSync(INDEX_PATH, "utf8"));
}

function writeIndex(index) {
  writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  writeFileSync(INDEX_MD_PATH, renderIndex(index), "utf8");
}

function bootstrapIndexFromLegacyReport() {
  const index = {
    schemaVersion: 1,
    source: `remote D1 ${DATABASE}.feedback_submissions`,
    runs: [],
  };

  if (!existsSync(LEGACY_JSON_PATH)) {
    writeIndex(index);
    return index;
  }

  const legacy = JSON.parse(readFileSync(LEGACY_JSON_PATH, "utf8"));
  const generatedAt = Date.parse(legacy.generatedAt);
  if (!Number.isFinite(generatedAt)) {
    writeIndex(index);
    return index;
  }

  const rows = Array.isArray(legacy.rows) ? legacy.rows : [];
  const runName = stamp(generatedAt);
  const runJsonPath = resolve(RUN_DIR, `${runName}.json`);
  const runMdPath = resolve(RUN_DIR, `${runName}.md`);
  const normalizedRows = rows.map(normalizeLegacyRow);
  const run = {
    fetchStartedAt: generatedAt,
    fetchStartedAtUtc: new Date(generatedAt).toISOString(),
    fetchCompletedAt: generatedAt,
    fetchCompletedAtUtc: new Date(generatedAt).toISOString(),
    queryCreatedAtGt: null,
    queryCreatedAtGtUtc: null,
    fetchedThroughCreatedAt: generatedAt,
    fetchedThroughCreatedAtUtc: new Date(generatedAt).toISOString(),
    rowCount: normalizedRows.length,
    firstFeedbackCreatedAt:
      normalizedRows[normalizedRows.length - 1]?.createdAtMs ?? null,
    lastFeedbackCreatedAt: normalizedRows[0]?.createdAtMs ?? null,
    bootstrappedFrom: relativeReportPath(LEGACY_JSON_PATH),
  };
  const report = {
    run,
    source: legacy.source ?? `remote D1 ${DATABASE}.feedback_submissions`,
    rows: normalizedRows,
  };

  writeFileSync(runJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(runMdPath, renderReport(report, readClosedFeedback()), "utf8");

  index.runs.push({
    ...run,
    jsonPath: relativeReportPath(runJsonPath),
    mdPath: relativeReportPath(runMdPath),
  });
  writeIndex(index);
  return index;
}

function latestFetchCutoff(index) {
  if (!index.runs.length) return null;
  return Math.max(...index.runs.map((run) => run.fetchedThroughCreatedAt ?? 0));
}

function fetchFeedbackRows(createdAtGt) {
  const where =
    createdAtGt == null
      ? ""
      : `WHERE f.created_at > ${Math.trunc(createdAtGt)}`;
  const sql = `${QUERY_BASE}\n${where}\nORDER BY f.created_at DESC;`
    .replace(/\s+/g, " ")
    .trim();
  const wranglerBin =
    process.platform === "win32"
      ? resolve(ROOT, "node_modules/.bin/wrangler.cmd")
      : resolve(ROOT, "node_modules/.bin/wrangler");
  const output = execSync(
    `"${wranglerBin}" d1 execute ${DATABASE} --remote --json --command "${sql.replaceAll('"', '\\"')}"`,
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["ignore", "pipe", "inherit"],
    }
  );
  const payload = parseWranglerJson(output);
  return payload[0]?.results ?? [];
}

function parseWranglerJson(output) {
  const jsonStart = output.search(/\[\s*\{/);
  if (jsonStart < 0) {
    throw new Error(`Wrangler did not return JSON output: ${output.slice(0, 200)}`);
  }
  return JSON.parse(output.slice(jsonStart));
}

function normalizeRow(row) {
  const createdAtMs = Number(row.created_at);
  const metadata = parseMetadata(row.metadata_json);
  return {
    id: row.id,
    createdAtMs,
    createdAtUtc: new Date(createdAtMs).toISOString(),
    createdAtLocal: formatLocal(createdAtMs),
    userId: row.user_id,
    displayName: row.display_name ?? null,
    email: row.email ?? null,
    contactMethod: metadata.contactMethod ?? null,
    rating: row.rating,
    suggestion: row.suggestion ?? null,
    bugReport: row.bug_report ?? null,
    metadata,
  };
}

function normalizeLegacyRow(row) {
  const createdAtMs = row.createdAtMs ?? Date.parse(row.createdAtUtc);
  return {
    ...row,
    createdAtMs,
    createdAtUtc: row.createdAtUtc ?? new Date(createdAtMs).toISOString(),
    createdAtLocal: row.createdAtLocal ?? formatLocal(createdAtMs),
  };
}

function parseMetadata(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return { parseError: true, raw };
  }
}

function readClosedFeedback() {
  if (!existsSync(CLOSED_FEEDBACK_PATH)) return {};
  return JSON.parse(readFileSync(CLOSED_FEEDBACK_PATH, "utf8"));
}

function renderReport(report, closedFeedback) {
  const openRows = report.rows.filter((row) => !closedFeedback[row.id]);
  const closedRows = report.rows.filter((row) => closedFeedback[row.id]);
  const avgRating = report.rows.length
    ? report.rows.reduce((sum, row) => sum + row.rating, 0) / report.rows.length
    : 0;
  const ratingCounts = [5, 4, 3, 2, 1]
    .map(
      (rating) =>
        `${rating}: ${report.rows.filter((row) => row.rating === rating).length}`
    )
    .join(", ");

  return `# Feedback Fetch ${report.run.fetchStartedAtUtc}

Source: ${report.source}
New rows: ${report.rows.length}
Open rows in this run: ${openRows.length}
Closed rows in this run: ${closedRows.length}
Query cutoff: ${report.run.queryCreatedAtGtUtc ?? "none"}
Fetched through: ${report.run.fetchedThroughCreatedAtUtc}
Average rating: ${avgRating.toFixed(1)}/5
Rating distribution: ${ratingCounts}

${closedRows.length ? renderClosedRows(closedRows, closedFeedback) : ""}
## New Open Submissions

${openRows.length ? openRows.map(renderSubmission).join("\n") : "_No new open feedback in this fetch._\n"}
`;
}

function renderClosedRows(rows, closedFeedback) {
  return `## Already Closed

${rows
  .map(
    (row) =>
      `- ${row.id} (${row.createdAtLocal}, rating ${row.rating}/5): ${closedFeedback[row.id]}`
  )
  .join("\n")}

`;
}

function renderSubmission(row, index) {
  return `### ${index == null ? "" : `${index + 1}. `}${row.id}

- Created: ${row.createdAtLocal} (${row.createdAtUtc})
- Rating: ${row.rating}/5
- User: ${row.userId}
- Contact: ${contactLine(row)}

Suggestion:
${quoteBlock(row.suggestion)}

Bug report:
${quoteBlock(row.bugReport)}
`;
}

function renderIndex(index) {
  return `# Feedback Report Index

Source: ${index.source}
Runs: ${index.runs.length}
Last fetch cutoff: ${
    latestFetchCutoff(index)
      ? new Date(latestFetchCutoff(index)).toISOString()
      : "none"
  }

| Fetch time | New rows | Query cutoff | Report |
| --- | ---: | --- | --- |
${index.runs
  .slice()
  .reverse()
  .map(
    (run) =>
      `| ${run.fetchStartedAtUtc} | ${run.rowCount} | ${
        run.queryCreatedAtGtUtc ?? "none"
      } | ${run.mdPath} |`
  )
  .join("\n")}
`;
}

function quoteBlock(value) {
  if (!value) return "_None_";
  return value
    .split("\n")
    .map((line) => `> ${line || " "}`)
    .join("\n");
}

function contactLine(row) {
  const pieces = [];
  if (row.displayName) pieces.push(`name: ${row.displayName}`);
  if (row.email) pieces.push(`email: ${row.email}`);
  if (row.contactMethod) pieces.push(`contact: ${row.contactMethod}`);
  return pieces.length ? pieces.join("; ") : "_No contact metadata_";
}

function formatLocal(ms) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

function stamp(ms) {
  return new Date(ms).toISOString().replace(/[:.]/g, "-");
}

function relativeReportPath(filePath) {
  return filePath.replace(`${REPORT_DIR}\\`, "").replace(`${REPORT_DIR}/`, "");
}

main();
