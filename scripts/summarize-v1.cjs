const d = require('./output/optimizer-v1-results-per-formula.json');
const byTeam = {};
for (const r of d.results) {
  const [tid, fid] = r.teamId.split('::');
  if (!byTeam[tid]) byTeam[tid] = { name: r.teamName.replace(/ \[.*/, ''), results: [] };
  byTeam[tid].results.push({
    formula: fid,
    label: r.teamName.match(/\[(.*)\]/)?.[1] || fid,
    damage: r.optimizedDamage,
    time: r.optimizeTimeSec,
    error: r.error || null
  });
}
for (const [tid, data] of Object.entries(byTeam)) {
  console.log(data.name + ':');
  for (const r of data.results) {
    if (r.error) console.log('  ' + r.label + ': ERROR ' + r.error);
    else console.log('  ' + r.label + ': ' + Math.round(r.damage).toLocaleString() + ' (' + r.time.toFixed(1) + 's)');
  }
}
console.log('\nTotal formulas:', d.results.length, '| Errors:', d.results.filter(r => r.error).length);
