// Quick script to analyze per-formula testbed results
const fs = require('fs');
const path = require('path');

const outputDir = path.resolve(__dirname, 'output');

function loadResults(filename) {
  const fp = path.join(outputDir, filename);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

const v1 = loadResults('optimizer-v1-results-per-formula.json');
const v2 = loadResults('optimizer-v2-results-per-formula.json');
const mona = loadResults('optimizer-mona-results-per-formula.json');
const combined = loadResults('optimizer-combined-results-per-formula.json');

console.log('=== Per-Formula Results ===\n');

// Build lookup by teamId
function buildLookup(data) {
  if (!data) return {};
  const map = {};
  for (const r of data.results) {
    map[r.teamId] = r;
  }
  return map;
}

const v1Map = buildLookup(v1);
const v2Map = buildLookup(v2);
const monaMap = buildLookup(mona);

// Collect all teamIds
const allIds = new Set([
  ...Object.keys(v1Map),
  ...Object.keys(v2Map),
  ...Object.keys(monaMap),
]);

// Table header
console.log('Team | Formula | V1 Dmg | V1 Time | V2 Dmg | V2 Time | Mona Dmg | Mona Time | Best | V1 vs Best');
console.log('---|---|---|---|---|---|---|---|---|---');

let v1Wins = 0, v2Wins = 0, monaWins = 0, ties = 0;
let v1Total = 0, v2Total = 0, monaTotal = 0;
let v1TotalTime = 0, v2TotalTime = 0, monaTotalTime = 0;
let v1Errors = 0, v2Errors = 0, monaErrors = 0;
const divergences = [];

for (const id of [...allIds].sort()) {
  const r1 = v1Map[id];
  const r2 = v2Map[id];
  const rm = monaMap[id];

  const parts = id.split('::');
  const teamBase = parts[0];
  const formulaId = parts[1] || '?';

  // Get team name from any available result
  const teamName = (r1 || r2 || rm)?.characters?.join('/') || teamBase;

  const d1 = r1 && !r1.error ? Math.round(r1.optimizedDamage) : null;
  const d2 = r2 && !r2.error ? Math.round(r2.optimizedDamage) : null;
  const dm = rm && !rm.error ? Math.round(rm.optimizedDamage) : null;

  const t1 = r1 ? r1.optimizeTimeSec.toFixed(1) : '-';
  const t2 = r2 ? r2.optimizeTimeSec.toFixed(1) : '-';
  const tm = rm ? rm.optimizeTimeSec.toFixed(1) : '-';

  if (r1 && r1.error) v1Errors++;
  if (r2 && r2.error) v2Errors++;
  if (rm && rm.error) monaErrors++;

  const vals = [d1, d2, dm].filter(v => v !== null);
  if (vals.length === 0) continue;

  const best = Math.max(...vals);
  let winner = '-';
  if (d1 === best && d2 !== best && dm !== best) { winner = 'V1'; v1Wins++; }
  else if (d2 === best && d1 !== best && dm !== best) { winner = 'V2'; v2Wins++; }
  else if (dm === best && d1 !== best && d2 !== best) { winner = 'Mona'; monaWins++; }
  else { winner = 'tie'; ties++; }

  const v1VsBest = d1 !== null && best > 0 ? ((d1 / best - 1) * 100).toFixed(1) + '%' : '-';

  if (d1 !== null) { v1Total++; v1TotalTime += r1.optimizeTimeSec; }
  if (d2 !== null) { v2Total++; v2TotalTime += r2.optimizeTimeSec; }
  if (dm !== null) { monaTotal++; monaTotalTime += rm.optimizeTimeSec; }

  // Track significant divergences (>1%)
  if (d1 !== null && best > 0 && (best - d1) / best > 0.01) {
    divergences.push({
      team: teamName,
      formula: formulaId,
      v1: d1,
      best,
      gap: ((best - d1) / best * 100).toFixed(1),
      winner,
    });
  }

  const d1Str = d1 !== null ? d1.toLocaleString() : (r1?.error || '-');
  const d2Str = d2 !== null ? d2.toLocaleString() : (r2?.error || '-');
  const dmStr = dm !== null ? dm.toLocaleString() : (rm?.error || '-');

  console.log(`${teamName} | ${formulaId} | ${d1Str} | ${t1}s | ${d2Str} | ${t2}s | ${dmStr} | ${tm}s | ${winner} | ${v1VsBest}`);
}

console.log('\n=== Summary ===');
console.log(`V1: ${v1Total} results, ${v1Errors} errors, avg ${(v1TotalTime/v1Total).toFixed(1)}s`);
if (v2Total > 0) console.log(`V2: ${v2Total} results, ${v2Errors} errors, avg ${(v2TotalTime/v2Total).toFixed(1)}s`);
if (monaTotal > 0) console.log(`Mona: ${monaTotal} results, ${monaErrors} errors, avg ${(monaTotalTime/monaTotal).toFixed(1)}s`);
console.log(`\nWins: V1=${v1Wins}, V2=${v2Wins}, Mona=${monaWins}, Ties=${ties}`);

if (divergences.length > 0) {
  console.log('\n=== Significant V1 Divergences (>1% below best) ===');
  divergences.sort((a, b) => parseFloat(b.gap) - parseFloat(a.gap));
  for (const d of divergences) {
    console.log(`  ${d.team} / ${d.formula}: V1=${d.v1.toLocaleString()} vs best=${d.best.toLocaleString()} (${d.gap}% gap, winner: ${d.winner})`);
  }
}

// Mona vs best divergences
const monaDivs = [];
for (const id of [...allIds].sort()) {
  const r2 = v2Map[id];
  const rm = monaMap[id];
  const vals = [];
  const d2 = r2 && !r2.error ? Math.round(r2.optimizedDamage) : null;
  const dm = rm && !rm.error ? Math.round(rm.optimizedDamage) : null;
  if (d2 !== null) vals.push(d2);
  if (dm !== null) vals.push(dm);
  if (vals.length < 2) continue;
  const best = Math.max(...vals);
  if (dm !== null && best > 0 && (best - dm) / best > 0.005) {
    monaDivs.push({
      id,
      mona: dm,
      best,
      gap: ((best - dm) / best * 100).toFixed(1),
      winner: d2 === best ? 'V2' : 'V1',
    });
  }
}
if (monaDivs.length > 0) {
  console.log('\n=== Mona below best (>0.5%) ===');
  monaDivs.sort((a, b) => parseFloat(b.gap) - parseFloat(a.gap));
  for (const d of monaDivs) {
    console.log(`  ${d.id}: Mona=${d.mona.toLocaleString()} vs best=${d.best.toLocaleString()} (${d.gap}% gap, winner: ${d.winner})`);
  }
}

// Combined vs V2 analysis
const combinedMap = buildLookup(combined);
if (Object.keys(combinedMap).length > 0) {
  console.log('\n=== Combined (V1+Mona) vs V2 ===');
  let combWins = 0, v2WinsC = 0, tiesC = 0, combTotal = 0;
  let combTotalTime = 0;
  const combDivs = [];
  for (const id of [...allIds].sort()) {
    const rc = combinedMap[id];
    const r2 = v2Map[id];
    if (!rc || !r2) continue;
    const dc = rc && !rc.error ? Math.round(rc.optimizedDamage) : null;
    const d2 = r2 && !r2.error ? Math.round(r2.optimizedDamage) : null;
    if (dc === null || d2 === null) continue;
    combTotal++;
    combTotalTime += rc.optimizeTimeSec;
    if (dc > d2) combWins++;
    else if (d2 > dc) {
      v2WinsC++;
      if ((d2 - dc) / d2 > 0.005) {
        combDivs.push({ id, combined: dc, v2: d2, gap: ((d2 - dc) / d2 * 100).toFixed(1), time: rc.optimizeTimeSec.toFixed(1) });
      }
    }
    else tiesC++;
  }
  console.log(`Combined: ${combTotal} results, avg ${(combTotalTime/combTotal).toFixed(1)}s`);
  console.log(`Wins: Combined=${combWins}, V2=${v2WinsC}, Ties=${tiesC}`);
  if (combDivs.length > 0) {
    console.log('\nCombined below V2 (>0.5%):');
    combDivs.sort((a, b) => parseFloat(b.gap) - parseFloat(a.gap));
    for (const d of combDivs) {
      console.log(`  ${d.id}: Combined=${d.combined.toLocaleString()} vs V2=${d.v2.toLocaleString()} (${d.gap}% gap, ${d.time}s)`);
    }
  }
}
