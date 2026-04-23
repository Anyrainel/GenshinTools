/**
 * Worker process for parallel optimizer benchmark.
 * Spawned via child_process.fork() — communicates via IPC (process.send/on).
 * Each worker independently loads game stats + account data,
 * then processes teams on demand via message passing.
 */

import type { AccountData, ArtifactData } from "@/data/types";
import type { ComboFormula } from "@/lib/dmgcalc/types";
import {
  characterStatsResource,
  getAllArtifacts,
  loadAccountData,
  runOptimizerOnTeam,
  weaponStatsResource,
} from "./runner";
import type { Team } from "./runner";

interface RunMessage {
  type: "run";
  team: Team;
  algorithm: "v1" | "v2" | "astar" | "mona" | "monaV2";
  timeoutMs: number;
  perCharMs?: number;
  maxArtsPerSlot?: number;
  formulaIdOverride?: string;
  combo?: ComboFormula;
  teamIdx: number;
  lagrangian?: boolean;
}

// Account file passed as first CLI argument by the parent
const accountFile = process.argv[2];
if (!accountFile) {
  console.error("Worker: no account file provided");
  process.exit(1);
}

// Enable diagnostic logging if requested (passed as second arg)
if (process.argv[3] === "--diag") {
  (globalThis as unknown as Record<string, boolean>).__TEAM_OPT_DIAG__ = true;
}

let accountData: AccountData;
let inventory: ArtifactData[];

async function init(): Promise<void> {
  await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
  accountData = loadAccountData(accountFile);
  inventory = getAllArtifacts(accountData);
  process.send!({ type: "ready" });
}

process.on("message", async (msg: RunMessage) => {
  if (msg.type === "run") {
    try {
      const result = await runOptimizerOnTeam(
        msg.team,
        accountData,
        inventory,
        msg.algorithm,
        msg.timeoutMs,
        msg.perCharMs,
        msg.formulaIdOverride,
        msg.maxArtsPerSlot,
        msg.combo,
        msg.lagrangian
      );
      process.send!({
        type: "result",
        teamIdx: msg.teamIdx,
        result,
      });
    } catch (err) {
      process.send!({
        type: "result",
        teamIdx: msg.teamIdx,
        result: {
          teamId: msg.team.id,
          teamName: msg.team.name || "",
          characters: [],
          carryCharId: "",
          optimizedFormulaId: "",
          optimizedDamage: 0,
          optimizeTimeSec: 0,
          formulaResults: [],
          error: err instanceof Error ? err.message : String(err),
          artifactAssignment: {},
          failReasons: {},
        },
      });
    }
  }
});

init().catch((err) => {
  console.error("Worker init failed:", err);
  process.exit(1);
});
