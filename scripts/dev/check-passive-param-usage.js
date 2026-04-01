/**
 * One-time audit: find character buffs where origin is NOT A/E/Q
 * but the buff value computation references this.param().
 *
 * this.param() reads from talent param tables (A/E/Q). Only buffs whose
 * origin is A, E, or Q should use it. Passives (P1/P2/P3), constellations
 * (C1-C6), and other origins have fixed values in their description text.
 * Using this.param() there is likely reading the wrong data (e.g., CD,
 * duration, or energy cost instead of the intended value).
 *
 * Usage: node scripts/dev/check-passive-param-usage.js
 */

import { readFileSync, globSync } from "fs";
import { resolve, relative } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const implDir = resolve(ROOT, "src/lib/team-comp/impl");

const files = globSync("character*.ts", { cwd: implDir }).map((f) =>
  resolve(implDir, f)
);

// Origins that legitimately use this.param()
const PARAM_ORIGINS = new Set(["A", "E", "Q"]);

const issues = [];

for (const filePath of files) {
  const code = readFileSync(filePath, "utf-8");
  const lines = code.split("\n");
  const relPath = relative(ROOT, filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match cbs(this, "ORIGIN", ...) — origin is the second argument
    const cbsMatch = line.match(/cbs\(this,\s*"([^"]+)"/);
    if (!cbsMatch) continue;

    const origin = cbsMatch[1];
    // Extract the base origin (e.g., "P1/C2" → "P1", "Q/C2" → "Q")
    const baseOrigin = origin.split("/")[0];
    // Skip if origin is A, E, or Q (these legitimately use param tables)
    if (PARAM_ORIGINS.has(baseOrigin)) continue;

    const lineNum = i + 1;

    // Find the enclosing new ...Buff( expression
    let blockStart = i;
    for (let j = i; j >= Math.max(0, i - 30); j--) {
      if (lines[j].match(/new\s+(Stat|Scaling|CrossScaling)Buff\s*\(/)) {
        blockStart = j;
        break;
      }
    }

    // Find the end by counting parens
    let depth = 0;
    let blockEnd = i;
    let foundOpen = false;
    for (let j = blockStart; j < Math.min(lines.length, i + 30); j++) {
      for (const ch of lines[j]) {
        if (ch === "(") { depth++; foundOpen = true; }
        if (ch === ")") depth--;
        if (foundOpen && depth === 0) { blockEnd = j; break; }
      }
      if (foundOpen && depth === 0) break;
    }

    const block = lines.slice(blockStart, blockEnd + 1).join("\n");

    // Check for direct this.param() in the buff block (excluding the cbs() call itself)
    const blockWithoutCbs = block.replace(/cbs\([^)]*\)/g, "");
    if (blockWithoutCbs.includes("this.param(")) {
      issues.push({
        file: relPath,
        line: lineNum,
        origin,
        context: block.trim().substring(0, 200),
      });
      continue;
    }

    // Check if any variable used in the buff was assigned via this.param()
    const varMatches = block.match(/\b([a-zA-Z_]\w*)\b/g) || [];
    const uniqueVars = new Set(varMatches);
    const SKIP = new Set([
      "new", "StatBuff", "ScalingBuff", "CrossScalingBuff", "cbs", "this",
      "const", "let", "var", "true", "false", "null", "undefined",
      "receiver", "filter", "abilities", "reactions", "elements",
      "key", "value", "self", "team", "teamOnField", "selfOnField",
      "otherOnField", "other", "Math", "min", "max", "Number", "String",
    ]);

    for (const varName of uniqueVars) {
      if (SKIP.has(varName)) continue;

      for (let j = blockStart - 1; j >= Math.max(0, blockStart - 50); j--) {
        const assignLine = lines[j];
        const assignPattern = new RegExp(
          `\\b(?:const|let)\\s+${varName}\\s*=.*this\\.param\\(`
        );
        if (assignPattern.test(assignLine)) {
          issues.push({
            file: relPath,
            line: lineNum,
            origin,
            paramVar: varName,
            assignedAt: j + 1,
            context: `${assignLine.trim()} → used in ${origin} buff at L${lineNum}`,
          });
          break;
        }
      }
    }
  }
}

// Deduplicate by file+line
const seen = new Set();
const deduped = issues.filter((issue) => {
  const key = `${issue.file}:${issue.line}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

if (deduped.length === 0) {
  console.log("✓ No non-A/E/Q origin buffs found using this.param() — all clean.");
} else {
  console.log(
    `⚠ Found ${deduped.length} buff(s) with non-A/E/Q origin using this.param():\n`
  );
  for (const issue of deduped) {
    console.log(`  ${issue.file}:${issue.line}`);
    console.log(`    Origin: ${issue.origin}`);
    if (issue.paramVar) {
      console.log(
        `    Variable "${issue.paramVar}" assigned via this.param() at L${issue.assignedAt}`
      );
    }
    console.log(`    ${issue.context}`);
    console.log();
  }
}
