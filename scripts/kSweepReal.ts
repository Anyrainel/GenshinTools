/**
 * Standalone K-sweep benchmark on real data. Run with:
 *   npx tsx scripts/kSweepReal.ts
 *
 * Each K value runs as a separate phase with memory logged between.
 */

import accountJson from "../tests/benchmark/data/account.json";
import buildPreset from "../src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json";
import tierListPreset from "../src/presets/tier-list/[GGArtifact] 培养优先级 Build Priority.json";
import type { Build, TierAssignment } from "../src/data/types";
import { convertGOODToAccountData } from "../src/lib/account-data/import/goodConversion";
import {
  type ArtifactScoreResult,
  buildToWeightMap,
  type BuildMatchResult,
  type NormalizedScoreInfo,
  type SubstatScoreResult,
} from "../src/lib/artifact/scoring/artifactScore";
import { runTierWaterfall } from "../src/lib/account-data/tierWaterfall";

const EMPTY_SLOT_SCORES = {
  flower: 0, plume: 0, sands: 0, goblet: 0, circlet: 0,
} as const;

function makeScoreResult(build: Build): ArtifactScoreResult {
  const substatScore: SubstatScoreResult = {
    subScore: 0,
    statCount: 0,
    slotSubScores: { ...EMPTY_SLOT_SCORES },
    slotMaxSubScores: { ...EMPTY_SLOT_SCORES },
    statScores: {} as SubstatScoreResult["statScores"],
    isComplete: true,
  };
  const buildMatch: BuildMatchResult = {
    build,
    buildIndex: 0,
    statWeights: buildToWeightMap(build),
    setMatched: true,
    setDifferent: false,
    mainStatMatches: 3,
    mainStatMismatches: [],
  };
  const normalized: NormalizedScoreInfo = {
    normalizedScore: 0,
    rawMainStatScore: 0,
    slotMainStatScores: { ...EMPTY_SLOT_SCORES },
    idealScore: 0,
    normalizer: build.normalizer ?? 1,
  };
  return { substatScore, buildMatch, normalized };
}

function memMB(): string {
  const m = process.memoryUsage();
  return `heap=${(m.heapUsed / 1024 / 1024).toFixed(0)}MB rss=${(m.rss / 1024 / 1024).toFixed(0)}MB`;
}

async function main() {
  const conversion = convertGOODToAccountData(
    accountJson as Parameters<typeof convertGOODToAccountData>[0]
  );
  const account = conversion.data;
  const builds = buildPreset.builds as Record<string, Build>;
  const characterBuilds = buildPreset.characterBuilds as Record<string, string[]>;
  const tierAssignments = tierListPreset.tierAssignments as TierAssignment;

  const scores: Record<string, ArtifactScoreResult | null> = {};
  let eligibleCount = 0;
  for (const char of account.characters) {
    const buildIds = characterBuilds[char.key];
    const tier = tierAssignments[char.key]?.tier;
    if (!buildIds || buildIds.length === 0 || !tier || tier === "Pool") {
      scores[char.key] = null;
      continue;
    }
    const build = builds[buildIds[0]];
    if (!build) {
      scores[char.key] = null;
      continue;
    }
    scores[char.key] = makeScoreResult({ ...build, characterId: char.key });
    eligibleCount++;
  }

  const artifactCount =
    account.extraArtifacts.length +
    account.characters.reduce(
      (n, c) => n + Object.values(c.artifacts).filter(Boolean).length,
      0
    );

  console.log(
    `Setup: ${account.characters.length} chars, ${artifactCount} artifacts, ` +
      `${eligibleCount} eligible. ${memMB()}`
  );

  const Ks = [1, 2, 3, 4, 5];
  const results: {
    k: number;
    total: number;
    emptyCount: number;
    ms: number;
    perTier: Record<string, number>;
  }[] = [];

  for (const k of Ks) {
    if (global.gc) global.gc();
    const t0 = performance.now();
    const allocation = runTierWaterfall(account, scores, tierAssignments, {}, { topK: k });
    const t1 = performance.now();

    let total = 0;
    let emptyCount = 0;
    const perTier: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const char of account.characters) {
      const alloc = allocation.perCharacter[char.key];
      if (!alloc || !scores[char.key]) continue;
      if (alloc.tier === "Pool") continue;
      if (!alloc.build) {
        emptyCount++;
        continue;
      }
      total += alloc.build.finalScore;
      if (alloc.tier in perTier) perTier[alloc.tier] += alloc.build.finalScore;
    }
    results.push({ k, total, emptyCount, ms: t1 - t0, perTier });
    console.log(
      `K=${String(k).padStart(3)}: ${(t1 - t0).toFixed(0).padStart(6)}ms  ` +
        `total=${total.toFixed(1).padStart(8)} empty=${emptyCount} ` +
        `per-tier ` +
        ["S", "A", "B", "C", "D"]
          .map((t) => `${t}=${perTier[t].toFixed(0)}`)
          .join(" ") +
        `  (${memMB()})`
    );
  }

  const best = Math.max(...results.map((r) => r.total));
  console.log("\n=== Summary ===");
  console.log(
    `K=${"K".padStart(3)} | ${"total".padStart(9)} | gap from best | time ms | empty`
  );
  for (const r of results) {
    const gap = best - r.total;
    const gapPct = best > 0 ? (gap / best) * 100 : 0;
    console.log(
      `K=${String(r.k).padStart(3)} | ` +
        `${r.total.toFixed(2).padStart(9)} | ` +
        `${gap.toFixed(2).padStart(7)} (${gapPct.toFixed(3)}%) | ` +
        `${r.ms.toFixed(0).padStart(7)} | ${r.emptyCount}`
    );
  }
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
