// Generate detailed V1 vs V2 comparison doc with artifact assignments
// Usage: node scripts/gen-comparison-doc.cjs [output-file]

const fs = require("fs");
const path = require("path");

const outputDir = path.resolve("scripts/output");
const v1 = JSON.parse(fs.readFileSync(path.join(outputDir, "optimizer-v1-results-baseline.json"), "utf-8"));
const v2 = JSON.parse(fs.readFileSync(path.join(outputDir, "optimizer-v2-results.json"), "utf-8"));

// Load account data to resolve artifact details
// GOOD format: artifacts are indexed sequentially as artifact-0, artifact-1, ...
// during conversion. We rebuild the same index here.
const accountFile = v1.accountFile;
const accountData = JSON.parse(fs.readFileSync(accountFile, "utf-8"));
const goodArtifacts = accountData.artifacts || [];

// Build artifact lookup matching goodConversion.ts indexing
const artById = new Map();
for (let i = 0; i < goodArtifacts.length; i++) {
  artById.set(`artifact-${i}`, goodArtifacts[i]);
}

function fmt(n) {
  return Math.round(n).toLocaleString("en-US");
}

function pct(a, b) {
  if (b === 0) return "N/A";
  return ((a - b) / b * 100).toFixed(2) + "%";
}

function describeArtifact(id) {
  const art = artById.get(id);
  if (!art) return `${id} (not found in account)`;

  const mainVal = art.mainStatKey;
  // GOOD format substats can be either { key, value } array or { stat: value } object
  let subs = "";
  if (Array.isArray(art.substats)) {
    subs = art.substats
      .filter(s => s && s.value)
      .map(s => `${s.key}:${s.value}`)
      .join(", ");
  } else if (art.substats && typeof art.substats === "object") {
    subs = Object.entries(art.substats)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");
  }
  return `${art.setKey} ${art.slotKey} [${mainVal}] lv${art.level} (${subs})`;
}

const lines = [];
lines.push("# V1 vs V2 Optimizer Comparison: Detailed Artifact Analysis");
lines.push("");
lines.push(`> V1: ${v1.timestamp} (timeout: inferred from results)`);
lines.push(`> V2: ${v2.timestamp}`);
lines.push("");

// Index v2 by teamId
const v2ByTeamId = new Map();
for (const r of v2.results) v2ByTeamId.set(r.teamId, r);

// Categorize teams
const v1Wins = [];
const v2Wins = [];
const ties = [];
const v1Errors = [];

for (const t1 of v1.results) {
  const t2 = v2ByTeamId.get(t1.teamId);
  if (!t2) continue;

  if (t1.error) {
    v1Errors.push({ t1, t2 });
    continue;
  }

  const diff = t2.optimizedDamage - t1.optimizedDamage;
  const diffPct = t1.optimizedDamage > 0 ? (diff / t1.optimizedDamage) * 100 : 0;

  if (Math.abs(diffPct) < 0.01) {
    ties.push({ t1, t2, diffPct });
  } else if (diffPct > 0) {
    v2Wins.push({ t1, t2, diffPct });
  } else {
    v1Wins.push({ t1, t2, diffPct });
  }
}

v1Wins.sort((a, b) => a.diffPct - b.diffPct); // most negative first
v2Wins.sort((a, b) => b.diffPct - a.diffPct); // most positive first

lines.push("## Summary");
lines.push("");
lines.push(`- **V1 wins (V1 > V2):** ${v1Wins.length} teams`);
lines.push(`- **V2 wins (V2 > V1):** ${v2Wins.length} teams`);
lines.push(`- **Ties:** ${ties.length} teams`);
lines.push(`- **V1 timed out:** ${v1Errors.length} teams (V2 handled these)`);
lines.push("");

// Helper to print team comparison
function printTeamComparison(entry, label) {
  const { t1, t2, diffPct } = entry;
  const slots = ["flower", "plume", "sands", "goblet", "circlet"];

  lines.push(`### ${t1.teamName || t1.characters.join(" / ")}`);
  lines.push("");
  lines.push(`**${label}** | Carry: \`${t1.carryCharId}\` | Formula: \`${t1.optimizedFormulaId}\``);
  lines.push("");
  lines.push(`| Metric | V1 | V2 | Diff |`);
  lines.push(`|--------|----|----|------|`);
  lines.push(`| Optimized Damage | ${fmt(t1.optimizedDamage)} | ${fmt(t2.optimizedDamage)} | ${pct(t2.optimizedDamage, t1.optimizedDamage)} |`);
  lines.push(`| Time | ${t1.optimizeTimeSec.toFixed(1)}s | ${t2.optimizeTimeSec.toFixed(1)}s | ${(t2.optimizeTimeSec / t1.optimizeTimeSec).toFixed(1)}x |`);
  lines.push("");

  // All formula results
  if (t1.formulaResults.length > 0 || t2.formulaResults.length > 0) {
    lines.push("**All formula results:**");
    lines.push("");
    lines.push("| Formula | V1 | V2 | Diff |");
    lines.push("|---------|----|----|------|");

    const allFormulas = new Set([
      ...t1.formulaResults.map(f => f.formulaId),
      ...t2.formulaResults.map(f => f.formulaId),
    ]);

    for (const fid of allFormulas) {
      const f1 = t1.formulaResults.find(f => f.formulaId === fid);
      const f2 = t2.formulaResults.find(f => f.formulaId === fid);
      const d1 = f1?.damage ?? 0;
      const d2 = f2?.damage ?? 0;
      lines.push(`| \`${fid}\` | ${fmt(d1)} | ${fmt(d2)} | ${pct(d2, d1)} |`);
    }
    lines.push("");
  }

  // Artifact assignments per character
  lines.push("**Artifact assignments:**");
  lines.push("");

  for (const cid of t1.characters) {
    const v1Arts = t1.artifactAssignment[cid] || {};
    const v2Arts = t2.artifactAssignment[cid] || {};

    lines.push(`#### \`${cid}\``);
    lines.push("");
    lines.push("| Slot | V1 Artifact | V2 Artifact | Same? |");
    lines.push("|------|-------------|-------------|-------|");

    for (const slot of slots) {
      const id1 = v1Arts[slot] || "(none)";
      const id2 = v2Arts[slot] || "(none)";
      const same = id1 === id2 ? "YES" : "**NO**";

      if (id1 === id2) {
        lines.push(`| ${slot} | ${id1} | ${id2} | ${same} |`);
      } else {
        lines.push(`| ${slot} | ${id1} | ${id2} | ${same} |`);
      }
    }
    lines.push("");

    // Show details for differing artifacts
    const diffs = slots.filter(s => (v1Arts[s] || "") !== (v2Arts[s] || ""));
    if (diffs.length > 0) {
      lines.push("Differing artifacts detail:");
      lines.push("");
      for (const slot of diffs) {
        if (v1Arts[slot]) {
          lines.push(`- V1 ${slot}: ${describeArtifact(v1Arts[slot])}`);
        }
        if (v2Arts[slot]) {
          lines.push(`- V2 ${slot}: ${describeArtifact(v2Arts[slot])}`);
        }
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
}

// Print V1 wins (where V2 needs improvement)
lines.push("## Teams Where V1 Found Better Solutions (V2 regressions)");
lines.push("");
lines.push("These are the cases where V2's algorithm fails to find what V1 finds.");
lines.push("");

for (const entry of v1Wins) {
  printTeamComparison(entry, `V1 wins by ${(-entry.diffPct).toFixed(2)}%`);
}

if (v1Wins.length === 0) {
  lines.push("(none)");
  lines.push("");
}

// Print V2 wins
lines.push("## Teams Where V2 Found Better Solutions (V2 improvements)");
lines.push("");
lines.push("These show where V2's deeper search finds better artifacts than V1.");
lines.push("");

for (const entry of v2Wins) {
  printTeamComparison(entry, `V2 wins by ${entry.diffPct.toFixed(2)}%`);
}

if (v2Wins.length === 0) {
  lines.push("(none)");
  lines.push("");
}

// Print ties
if (ties.length > 0) {
  lines.push("## Ties");
  lines.push("");
  for (const entry of ties) {
    lines.push(`- **${entry.t1.teamName}**: V1=${fmt(entry.t1.optimizedDamage)}, V2=${fmt(entry.t2.optimizedDamage)}`);
  }
  lines.push("");
}

// Print V1 timeouts (V2 only)
if (v1Errors.length > 0) {
  lines.push("## Teams Where V1 Timed Out (V2 only)");
  lines.push("");
  for (const { t1, t2 } of v1Errors) {
    lines.push(`- **${t1.teamName}**: V1 error: ${t1.error} | V2: ${fmt(t2.optimizedDamage)} in ${t2.optimizeTimeSec.toFixed(1)}s`);
  }
  lines.push("");
}

const outFile = process.argv[2] || path.join(outputDir, "v1-vs-v2-detailed.md");
fs.writeFileSync(outFile, lines.join("\n"), "utf-8");
console.log(`Written to ${outFile}`);
console.log(`V1 wins: ${v1Wins.length}, V2 wins: ${v2Wins.length}, Ties: ${ties.length}, V1 errors: ${v1Errors.length}`);
