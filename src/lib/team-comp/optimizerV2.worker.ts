import type { ArtifactData, Element, GlobalStatWeights } from "@/data/types";
/**
 * Web Worker for Phase 1 per-character B&B.
 * Each worker handles one character's B&B search independently.
 */
import { preloadGameStats } from "@/lib/gameStatsLoader";
// Side-effect: register all character/weapon/artifact implementations
import "./index";
import { TeamBuild, evaluateCombo } from "./damageCalc";
import type { CombatOpts } from "./damageModels";
import { StatSheet } from "./damageModels";
import { runCharacterBnB } from "./optimizerV2";
import type {
  CalcContext,
  CharCompConfig,
  ComboFormula,
  ReactionOverride,
  StatKey,
} from "./types";
import type { OptFailReason, PerCharConfig } from "./types";

export type BnBWorkerRequest = {
  id: number;
  charId: string;
  charConfig: PerCharConfig;
  // TeamBuild reconstruction
  configs: CharCompConfig[];
  combatOpts: CombatOpts;
  enemyElementAura?: Element;
  // B&B parameters
  carryCharId: string;
  formulaId: string;
  inventory: ArtifactData[];
  globalConfig: GlobalStatWeights;
  baseSheetsDump: Record<
    string,
    { key: StatKey; filterKey: string; value: number }[]
  >;
  calcContext: CalcContext;
  reactionOverride?: ReactionOverride;
  topK: number;
  /** Duration in ms (not absolute timestamp — worker converts to local deadline). */
  deadlineMs?: number;
  warmStartThreshold?: number;
  maxArtsPerSlot: number;
  /** Artifact IDs to exclude from search (Phase 3: teammates' locked artifacts). */
  excludedIds?: string[];
  // Combo mode (replaces scoreFn closure)
  isComboMode: boolean;
  combo?: ComboFormula;
  reactionOverrides?: Record<string, ReactionOverride>;
  /** Pre-computed partial buff specs for stack-limited / user-overridden buffs. */
  partialBuffs?: import("./stackAllocation").PartialBuffInfo[];
  /** Per-line PartialBuffInfo[] for combo mode. */
  comboLinePartialBuffs?: Record<
    number,
    import("./stackAllocation").PartialBuffInfo[]
  >;
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
    }
  | { id: number; type: "error"; error: string }
  | { id: number; type: "ready" };

const warnedCalcErrors = new Set<string>();

self.onmessage = async (e: MessageEvent<BnBWorkerRequest>) => {
  const req = e.data;
  try {
    await preloadGameStats();

    // Reconstruct TeamBuild
    const teamBuild = new TeamBuild(
      req.configs,
      req.combatOpts,
      req.enemyElementAura
    );

    // Reconstruct baseSheets
    const baseSheets: Record<string, StatSheet> = {};
    for (const [charId, dump] of Object.entries(req.baseSheetsDump)) {
      baseSheets[charId] = StatSheet.fromDump(dump);
    }

    // Build combo scoreFn if needed
    const scoreFn = req.isComboMode
      ? (sheets: Record<string, StatSheet>, _calcTargetId: string): number => {
          try {
            return evaluateCombo(
              teamBuild,
              req.combo!,
              sheets,
              req.calcContext,
              req.reactionOverrides,
              req.comboLinePartialBuffs
            ).totalDamage;
          } catch (err) {
            const key = `comboScoreFn:${_calcTargetId}`;
            if (!warnedCalcErrors.has(key)) {
              warnedCalcErrors.add(key);
              console.warn("[optimizerV2.worker] comboScoreFn failed:", err);
            }
            return 0;
          }
        }
      : undefined;

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
      req.formulaId,
      req.inventory,
      req.globalConfig,
      baseSheets,
      req.calcContext,
      req.excludedIds ? new Set(req.excludedIds) : undefined,
      req.reactionOverride,
      scoreFn,
      req.topK,
      deadline,
      req.warmStartThreshold,
      req.maxArtsPerSlot,
      false, // _noCompile
      onProgress,
      req.partialBuffs
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
    } satisfies BnBWorkerResponse);
  } catch (err) {
    self.postMessage({
      id: req.id,
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    } satisfies BnBWorkerResponse);
  }
};
