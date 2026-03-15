/**
 * Worker process for parallel optimizer testbed.
 * Spawned via child_process.fork() — communicates via IPC (process.send/on).
 * Each worker independently loads game stats + account data,
 * then processes teams on demand via message passing.
 */

// Side-effect barrel: registers all character/weapon/artifact implementations.
import "@/lib/team-comp/index";

import { preloadGameStats } from "@/lib/gameStatsLoader";
import {
  loadAccountData,
  getAllArtifacts,
  runOptimizerOnTeam,
} from "./optimizer-testbed.js";
import type { AccountData, ArtifactData } from "@/data/types";
import type { Team } from "./optimizer-testbed.js";

interface RunMessage {
  type: "run";
  team: Team;
  algorithm: "v1" | "v2";
  timeoutMs: number;
  perCharMs?: number;
  teamIdx: number;
}

// Account file passed as first CLI argument by the parent
const accountFile = process.argv[2];
if (!accountFile) {
  console.error("Worker: no account file provided");
  process.exit(1);
}

let accountData: AccountData;
let inventory: ArtifactData[];

async function init(): Promise<void> {
  await preloadGameStats();
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
        msg.perCharMs
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
