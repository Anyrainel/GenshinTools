const d = require('./output/optimizer-mona-results-per-formula.json');
for (let i = 0; i < d.results.length; i++) {
  const r = d.results[i];
  const name = r.teamName || '';
  if (name.includes('nilou') || name.includes('xianyun')) {
    console.log(i + 1, name, Math.round(r.optimizedDamage || 0), (r.optimizeTimeSec || 0).toFixed(1) + 's');
  }
}
