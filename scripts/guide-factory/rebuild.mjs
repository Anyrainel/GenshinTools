import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Explicit dependency order. Authentication pins are reviewed separately;
// rebuilding never blesses changed sources or updates the independent guards.
const producers = [
  "import-sources.ts",
  "consolidate.ts",
  "inventory-knowledge-corpus.ts",
  "analyze-team-template-coverage.ts",
  "draft-furina-neuvillette-formula-plan.ts",
  "draft-keqing-ineffa-formula-plan.ts",
  "analyze-artifact-choice-search-coverage.ts",
  "analyze-weapon-choice-search-coverage.ts",
  "preflight-keqing-ineffa-artifact-generation.ts",
  "probe-keqing-ineffa-artifact-generation.ts",
  "probe-keqing-ineffa-artifact-generation-sensitivity.ts",
  "experiment-keqing-ineffa-bounded-joint-artifacts.ts",
  "experiment-team-roster-candidate-domain.ts",
  "diagnose-keqing-ineffa-team-stat-marginals.ts",
  "assemble-keqing-artifact-rating-kqm-marginal-validation-slice.ts",
  "sample-furina-source-scoped-role.ts",
  "sample-keqing-source-scoped-role-pair.ts",
  "validate-keqing-lunar-equipment-evidence.ts",
  "construct-keqing-lunar-source-conditioned-candidate-lattice.ts",
  "construct-keqing-lunar-cross-record-composition-contract.ts",
  "run-keqing-lunar-cross-record-technical-matrix.ts",
  "construct-keqing-ineffa-furina-xilonen-equipment-candidate-lattice.ts",
  "preflight-keqing-ineffa-furina-xilonen-equipment-runtime.ts",
  "compute-keqing-ineffa-furina-xilonen-equipment-technical.ts",
  "compute-keqing-ineffa-furina-xilonen-generated-sheet-evidence.ts",
  "compute-keqing-ineffa-furina-xilonen-cached-policy-audit.ts",
  "compute-keqing-ineffa-furina-xilonen-cached-policy-robustness-census.ts",
  "assemble-itto-source-conditioned-guide-packets.ts",
  "assemble-itto-request-context-applicability.ts",
  "assemble-klee-source-local-condition-slice.ts",
  "assemble-diona-source-local-support-slice.ts",
  "assemble-kokomi-source-local-artifact-slice.ts",
  "assemble-noelle-source-local-high-investment-slice.ts",
  "assemble-noelle-source-local-lower-investment-slice.ts",
  "assemble-xiao-source-local-condition-slice.ts",
  "assemble-xiao-ffxx-applicable-claim-projection-contract.ts",
  "assemble-xiao-ffxx-partial-artifact-candidate-contract.ts",
  "assemble-xiao-non-er-equipment-branch-source-slice.ts",
  "assemble-xiao-ffxx-non-er-condition-free-branch-candidate-contract.ts",
  "assemble-xiao-formula-count-parity.ts",
  "assemble-xiao-ffxx-grouped-replay-representation-preflight.ts",
  "assemble-xiao-ffxx-unit-expanded-execution-gate.ts",
  "assemble-xiao-ffxx-five-star-source-group-validation-diagnostic.ts",
  "assemble-xiao-ffxx-circlet-substat-local-marginal-diagnostic.ts",
  "assemble-noelle-investment-artifact-profile-computation-admission.ts",
  "assemble-noelle-hexerei-weapon-team-source-binding.ts",
  "assemble-noelle-hexerei-partial-equipment-composition.ts",
  "assemble-noelle-normal-prefix-formula-projection.ts",
  "assemble-noelle-hexerei-equipment-response-surface.ts",
  "assemble-noelle-hexerei-local-stat-priority-diagnostic.ts",
  "assemble-noelle-hexerei-request-conditioned-candidate-admission.ts",
  "assemble-noelle-hexerei-guide-draft-projection.ts",
  "inventory-character-guide-input-coverage.ts",
  "inventory-derived-formula-fixture-coverage.ts",
  "inventory-manual-condition-array-coverage.ts",
  "assemble-klee-team-scoped-claim-join-witness.ts",
  "assemble-guide-draft-portability-inventory.ts",
  "validate.ts"
];
const root = fileURLToPath(new URL("../../", import.meta.url));
for (const producer of producers) {
  console.log(`Rebuilding ${producer}`);
  let result;
  for (let attempt = 0; attempt < 3; attempt++) {
    result = spawnSync(process.execPath, [
      "node_modules/tsx/dist/cli.mjs", "--tsconfig",
      "scripts/guide-factory/tsconfig.json",
      `scripts/guide-factory/src/${producer}`,
      ...(producer === "validate.ts" ? ["--defer-er"] : []),
    ], { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
    // Windows scanners can briefly hold the previous report during atomic rename.
    if (result.status === 0 || !/EPERM.*rename/.test(result.stderr)) break;
  }
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
