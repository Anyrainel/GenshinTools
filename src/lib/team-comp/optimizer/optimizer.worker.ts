import type { ArtifactData, Element, GlobalStatWeights } from "@/data/types";
/**
 * Web Worker for Phase 1 per-character B&B.
 * Each worker handles one character's B&B search independently.
 */
import { preloadGameStats } from "@/lib/gameStatsLoader";
// Side-effect: register all character/weapon/artifact implementations
import "../index";
import { runCharacterBnB } from ".";
import { StatSheet } from "../calc/statSheet";
import { TeamBuild } from "../calc/teamBuild";
import type { OptionMap } from "../types";
import type { ExtraBuff } from "../types";
import type {
  BuffActivationMap,
  CalcContext,
  CharOptConfig,
  ComboFormula,
  OptFailReason,
  StatKey,
  TeamSlotConfig,
} from "../types";

export type BnBWorkerRequest = {
  id: number;
  charId: string;
  charConfig: CharOptConfig;
  // TeamBuild reconstruction
  configs: TeamSlotConfig[];
  combatOpts: OptionMap;
  enemyAura?: Element;
  // B&B parameters
  carryCharId: string;
  inventory: ArtifactData[];
  globalConfig: GlobalStatWeights;
  baseSheetsDump: Record<
    string,
    { key: StatKey; filterKey: string; value: number }[]
  >;
  calcContext: CalcContext;
  topK: number;
  /** Duration in ms (not absolute timestamp — worker converts to local deadline). */
  deadlineMs?: number;
  warmStartThreshold?: number;
  maxArtsPerSlot: number;
  /** Artifact IDs to exclude from search (Phase 3: teammates' locked artifacts). */
  excludedIds?: string[];
  /** Combo formula (always present — single formula is pre-normalized to 1-line combo). */
  combo: ComboFormula;
  /** Per-line BuffActivationMap for combo mode. */
  buffOverrides?: Record<number, BuffActivationMap>;
  /** Extra buffs (food/env/status/custom) to apply to TeamBuild stat sheets. */
  extraBuffs?: ExtraBuff[];
};

export type SerializedTopKEntry = {
  damage: number;
  result: {
    parts: { damage: number; hits: number }[];
    totalDamage: number;
  } | null;
  artifacts: (ArtifactData | null)[];
  artifactIds: string[];
};

export type BnBWorkerResponse =
  | {
      id: number;
      type: "progress";
      charId: string;
      bestDamage: number;
      evaluations: number;
    }
  | {
      id: number;
      type: "done";
      entries: SerializedTopKEntry[];
      evaluations: number;
      failReason?: OptFailReason;
      substatWeights?: Record<string, number>;
      usedFallbackWeights?: boolean;
    }
  | { id: number; type: "error"; error: string }
  | { id: number; type: "ready" };

self.onmessage = async (e: MessageEvent<BnBWorkerRequest>) => {
  const req = e.data;
  try {
    await preloadGameStats();

    // Reconstruct TeamBuild
    const teamBuild = new TeamBuild(
      req.configs,
      req.combatOpts,
      req.enemyAura,
      req.extraBuffs
    );

    // Reconstruct baseSheets
    const baseSheets: Record<string, StatSheet> = {};
    for (const [charId, dump] of Object.entries(req.baseSheetsDump)) {
      baseSheets[charId] = StatSheet.fromDump(dump);
    }

    // Convert duration to absolute deadline
    const deadline = req.deadlineMs
      ? performance.now() + req.deadlineMs
      : undefined;

    // Progress callback: send intermediate best damage to main thread
    const onProgress = (bestDamage: number, evaluations: number) => {
      self.postMessage({
        id: req.id,
        type: "progress",
        charId: req.charId,
        bestDamage,
        evaluations,
      } satisfies BnBWorkerResponse);
    };

    // Signal that setup is done and search is about to start
    self.postMessage({ id: req.id, type: "ready" } satisfies BnBWorkerResponse);

    // Run B&B
    const result = runCharacterBnB(
      req.charId,
      req.charConfig,
      teamBuild,
      req.carryCharId,
      req.inventory,
      req.globalConfig,
      baseSheets,
      req.calcContext,
      req.excludedIds ? new Set(req.excludedIds) : undefined,
      req.combo,
      req.topK,
      deadline,
      req.warmStartThreshold,
      req.maxArtsPerSlot,
      onProgress,
      req.buffOverrides
    );

    // Serialize TopKEntry[] (convert Set to string[])
    const entries: SerializedTopKEntry[] = result.collector.results.map(
      (entry) => ({
        damage: entry.damage,
        result: entry.result,
        artifacts: [...entry.artifacts],
        artifactIds: [...entry.artifactIds],
      })
    );

    self.postMessage({
      id: req.id,
      type: "done",
      entries,
      evaluations: result.evaluations,
      failReason: result.failReason,
      substatWeights: result.marginalWeights?.substatWeights,
      usedFallbackWeights: result.usedFallbackWeights,
    } satisfies BnBWorkerResponse);
  } catch (err) {
    self.postMessage({
      id: req.id,
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    } satisfies BnBWorkerResponse);
  }
};
