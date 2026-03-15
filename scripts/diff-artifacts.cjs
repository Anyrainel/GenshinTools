// Compare V1 vs V2 artifact assignments for a specific team
const v1 = require("./output/optimizer-v1-results.json");
const v2 = require("./output/optimizer-v2-results.json");
const teamName = process.argv[2] || "furina";

const t1 = v1.results.find(r => r.teamName.toLowerCase().includes(teamName));
const t2 = v2.results.find(r => r.teamId === t1.teamId);

console.log(`Team: ${t1.teamName} | Carry: ${t1.carryCharId}`);
console.log(`V1: ${t1.optimizedDamage.toFixed(0)} (${t1.optimizeTimeSec.toFixed(1)}s)`);
console.log(`V2: ${t2.optimizedDamage.toFixed(0)} (${t2.optimizeTimeSec.toFixed(1)}s)`);
console.log();

for (const cid of t1.characters) {
  const v1Arts = t1.artifactAssignment[cid] || {};
  const v2Arts = t2.artifactAssignment[cid] || {};
  const slots = ['flower', 'plume', 'sands', 'goblet', 'circlet'];
  const diffs = slots.filter(s => v1Arts[s] !== v2Arts[s]);
  console.log(`  ${cid}: ${diffs.length === 0 ? 'SAME' : diffs.length + ' slots differ'}`);
  for (const s of diffs) {
    console.log(`    ${s}: V1=${v1Arts[s] || '(none)'} → V2=${v2Arts[s] || '(none)'}`);
  }
}
