import type {
  AccountData,
  ArtifactData,
  CharacterData,
  GlobalStatWeights,
  MainStat,
  Slot,
  TierAssignment,
  TierCustomization,
} from "@/data/types";
import { LUCK_MULTIPLIERS, allSlots } from "@/data/types";
import {
  DEFAULT_LUCK_MULTIPLIER,
  MAX_LEVEL_BY_RARITY,
  calculateFarmExpectedScore,
  calculateRerollExpectedScore,
  getAllSubstats,
  getProjectedScore,
} from "./artifactProjection";
import {
  type ArtifactScoreResult,
  type BuildMatchResult,
  calculateMaxSlotSubScore,
  getTargetMainStatsForSlot,
  scoreSlot,
} from "./artifactScore";

export type InsightType =
  | "EQUIP" // Empty slot: equip best available artifact
  | "SWAP" // Better artifact found (Inventory or Steal)
  | "UPGRADE" // Invest resources (Current or Inventory)
  | "REROLL" // Perfect base artifact (Reroll / Elixir candidate)
  | "FARM" // Weakest slot, suggest farming
  | "FIX_MAIN"; // Critical fix: wrong main stat

export interface Insight {
  type: InsightType;
  characterId: string;
  slot: Slot;

  // The artifact to use
  artifact?: ArtifactData;
  // The artifact being replaced
  compareArtifact?: ArtifactData;

  // Metrics
  scoreDiff?: number; // Gain
  maxPotentialScore?: number; // Max possible score for this slot (for efficiency calculation)
  efficiencyDiff?: number; // scoreDiff / maxPotentialScore (0-1)

  // For FIX_MAIN: suggested main stats ranked by weight
  // TODO: Improve stat selection logic (e.g., balance CR/CD, consider slot constraints)
  suggestedMainStats?: MainStat[];

  // Source identification
  isSteal?: boolean; // If true, source is from another character
  isEquipped?: boolean; // If true, artifact is currently equipped by target character
  donorCharacterId?: string; // Who we are stealing from
}

export interface CharacterInsights {
  characterId: string;
  insights: Insight[];
  totalPotentialGain: number;
}

const SWAP_THRESHOLD = 1.0;
const UPGRADE_THRESHOLD = 5.0;
const REROLL_THRESHOLD = 10.0;
const FARM_THRESHOLD = 10.0;

// ----------------------------------------------------------------------------
// Internal Types
// ----------------------------------------------------------------------------

type CandidateArtifact = ArtifactData & { location?: string };

/** Per-slot context shared across all strategy evaluators. */
interface SlotContext {
  characterId: string;
  char: CharacterData;
  slot: Slot;
  equipped: ArtifactData | undefined;
  currentScore: number;
  maxPotentialScore: number;
  buildMatch: BuildMatchResult;
  globalConfig: GlobalStatWeights;
  luckMultiplier: number;
}

// ----------------------------------------------------------------------------
// Helper: Set Analysis (Safe Swap Check)
// ----------------------------------------------------------------------------

function checkSafeSwap(
  char: CharacterData,
  slot: Slot,
  newArtifact: ArtifactData
): boolean {
  const current = char.artifacts[slot];
  if (!current) return true;
  if (current.setKey === newArtifact.setKey) return true;

  const counts: Record<string, number> = {};
  for (const a of Object.values(char.artifacts)) {
    if (a) counts[a.setKey] = (counts[a.setKey] || 0) + 1;
  }
  const currentSetCount = counts[current.setKey] || 0;

  // Dropping from 5→4 or 3→2 is safe; breaking 4pc or 2pc is not
  if (currentSetCount === 5 || currentSetCount === 3) return true;
  if (currentSetCount === 1) return true; // Was already off-piece
  return false;
}

// ----------------------------------------------------------------------------
// Helper: Candidate Filtering
// ----------------------------------------------------------------------------

function filterCandidates(
  slot: Slot,
  equipped: ArtifactData | undefined,
  allArtifacts: CandidateArtifact[],
  buildMatch: BuildMatchResult,
  tierAssignments: TierAssignment
): CandidateArtifact[] {
  const targetMainStats = getTargetMainStatsForSlot(
    slot,
    buildMatch.build,
    equipped ?? undefined
  );
  return allArtifacts.filter((a) => {
    if (a.slotKey !== slot) return false;
    if (!targetMainStats.has(a.mainStatKey)) return false;
    if (a.id === equipped?.id) return false;
    if (!a.location) return true; // Inventory
    return tierAssignments[a.location]?.tier === "Pool"; // Steal only from Pool
  });
}

// ----------------------------------------------------------------------------
// Strategy Evaluators
// ----------------------------------------------------------------------------

function evaluateEquip(
  ctx: SlotContext,
  candidates: CandidateArtifact[]
): Insight | null {
  const {
    characterId,
    slot,
    equipped,
    maxPotentialScore,
    buildMatch,
    globalConfig,
  } = ctx;
  if (equipped) return null; // Only for empty slots

  let best: Insight | null = null;

  for (const cand of candidates) {
    const candScore = scoreSlot(cand, buildMatch.statWeights, globalConfig);
    if (best && candScore <= (best.scoreDiff ?? 0)) continue;

    best = {
      type: "EQUIP",
      characterId,
      slot,
      artifact: cand,
      // No compareArtifact - slot is empty
      scoreDiff: candScore,
      maxPotentialScore,
      efficiencyDiff: maxPotentialScore > 0 ? candScore / maxPotentialScore : 0,
      isSteal: !!cand.location,
      donorCharacterId: cand.location,
    };
  }

  return best;
}

function evaluateFixMain(ctx: SlotContext): Insight | null {
  const { characterId, slot, equipped, buildMatch } = ctx;
  if (!equipped) return null;

  const mismatch = buildMatch.mainStatMismatches.find((m) => m.slot === slot);
  if (!mismatch) return null;

  const recommended = buildMatch.build[mismatch.slot];
  if (!recommended || recommended.length === 0) return null;

  return {
    type: "FIX_MAIN",
    characterId,
    slot,
    artifact: equipped,
    compareArtifact: equipped,
    suggestedMainStats: recommended,
    isEquipped: true,
  };
}

function evaluateSwap(
  ctx: SlotContext,
  candidates: CandidateArtifact[]
): Insight | null {
  const {
    characterId,
    char,
    slot,
    equipped,
    currentScore,
    maxPotentialScore,
    buildMatch,
    globalConfig,
  } = ctx;

  let best: Insight | null = null;

  for (const cand of candidates) {
    const maxLevel = MAX_LEVEL_BY_RARITY[cand.rarity] ?? 20;
    if (cand.level !== maxLevel) continue;

    const isSafe = checkSafeSwap(char, slot, cand);
    if (!isSafe && equipped && cand.setKey !== equipped.setKey) continue;

    const candScore = scoreSlot(cand, buildMatch.statWeights, globalConfig);
    const diff = candScore - currentScore;
    if (diff <= SWAP_THRESHOLD) continue;
    if (best && diff <= (best.scoreDiff ?? 0)) continue;

    best = {
      type: "SWAP",
      characterId,
      slot,
      artifact: cand,
      compareArtifact: equipped,
      scoreDiff: diff,
      maxPotentialScore,
      efficiencyDiff: maxPotentialScore > 0 ? diff / maxPotentialScore : 0,
      isSteal: !!cand.location,
      donorCharacterId: cand.location,
    };
  }

  return best;
}

function evaluateUpgrade(
  ctx: SlotContext,
  candidates: CandidateArtifact[]
): Insight | null {
  const {
    characterId,
    char,
    slot,
    equipped,
    currentScore,
    maxPotentialScore,
    buildMatch,
    globalConfig,
    luckMultiplier,
  } = ctx;

  const currentProjected = equipped
    ? getProjectedScore(equipped, buildMatch, globalConfig, luckMultiplier)
    : 0;

  let best: Insight | null = null;

  // Check inventory/steal candidates that aren't at max level
  for (const cand of candidates) {
    const maxLevel = MAX_LEVEL_BY_RARITY[cand.rarity] ?? 20;
    if (cand.level === maxLevel) continue;
    if (!checkSafeSwap(char, slot, cand)) continue;

    const candProjected = getProjectedScore(
      cand,
      buildMatch,
      globalConfig,
      luckMultiplier
    );
    if (candProjected <= currentProjected + UPGRADE_THRESHOLD) continue;

    const gain = candProjected - currentScore;
    if (best && gain <= (best.scoreDiff ?? 0)) continue;

    best = {
      type: "UPGRADE",
      characterId,
      slot,
      artifact: cand,
      compareArtifact: equipped,
      scoreDiff: gain,
      maxPotentialScore,
      efficiencyDiff: maxPotentialScore > 0 ? gain / maxPotentialScore : 0,
      isSteal: !!cand.location,
      isEquipped: false,
      donorCharacterId: cand.location,
    };
  }

  // Also check the equipped artifact itself
  if (equipped) {
    const maxLevel = MAX_LEVEL_BY_RARITY[equipped.rarity] ?? 20;
    if (equipped.level < maxLevel) {
      const gain = currentProjected - currentScore;
      if (gain > UPGRADE_THRESHOLD && (!best || gain > (best.scoreDiff ?? 0))) {
        best = {
          type: "UPGRADE",
          characterId,
          slot,
          artifact: equipped,
          compareArtifact: equipped,
          scoreDiff: gain,
          maxPotentialScore,
          efficiencyDiff: maxPotentialScore > 0 ? gain / maxPotentialScore : 0,
          isEquipped: true,
        };
      }
    }
  }

  return best;
}

function evaluateReroll(ctx: SlotContext): Insight | null {
  const {
    characterId,
    slot,
    equipped,
    currentScore,
    maxPotentialScore,
    buildMatch,
    globalConfig,
    luckMultiplier,
  } = ctx;
  if (!equipped || equipped.rarity !== 5) return null;

  const maxLevel = MAX_LEVEL_BY_RARITY[equipped.rarity] ?? 20;
  if (equipped.level !== maxLevel) return null;

  const allSubs = getAllSubstats(equipped);
  if (allSubs.length < 4) return null;

  const hasBadSubstat = allSubs.some(
    (s) => (buildMatch.statWeights[s] || 0) === 0
  );
  if (!hasBadSubstat) return null;

  const expectedScore = calculateRerollExpectedScore(
    equipped,
    buildMatch,
    globalConfig,
    luckMultiplier
  );
  const scoreDiff = expectedScore - currentScore;
  if (scoreDiff <= REROLL_THRESHOLD) return null;

  return {
    type: "REROLL",
    characterId,
    slot,
    artifact: equipped,
    isEquipped: true,
    scoreDiff,
    maxPotentialScore,
    efficiencyDiff: maxPotentialScore > 0 ? scoreDiff / maxPotentialScore : 0,
  };
}

function evaluateFarm(ctx: SlotContext): Insight | null {
  const {
    characterId,
    slot,
    equipped,
    currentScore,
    maxPotentialScore,
    buildMatch,
    globalConfig,
    luckMultiplier,
  } = ctx;
  if (!equipped) return null;

  const farmExpected = calculateFarmExpectedScore(
    equipped.mainStatKey,
    buildMatch,
    globalConfig,
    equipped.rarity,
    luckMultiplier
  );
  const scoreDiff = farmExpected - currentScore;
  if (scoreDiff <= FARM_THRESHOLD) return null;

  return {
    type: "FARM",
    characterId,
    slot,
    artifact: equipped,
    scoreDiff,
    maxPotentialScore,
    efficiencyDiff: maxPotentialScore > 0 ? scoreDiff / maxPotentialScore : 0,
  };
}

// Priority: FIX_MAIN always shown; SWAP always shown; UPGRADE/REROLL/FARM only if they beat the current best
function selectInsights(
  fixMain: Insight | null,
  swap: Insight | null,
  upgrade: Insight | null,
  reroll: Insight | null,
  farm: Insight | null
): Insight[] {
  const result: Insight[] = [];
  if (fixMain) result.push(fixMain);

  let bestScore = 0;
  if (swap) {
    result.push(swap);
    bestScore = swap.scoreDiff ?? 0;
  }
  for (const insight of [upgrade, reroll, farm]) {
    if (insight && (insight.scoreDiff ?? 0) > bestScore) {
      result.push(insight);
      bestScore = insight.scoreDiff ?? 0;
    }
  }
  return result;
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export function generateCharacterInsights(
  char: CharacterData,
  allArtifacts: CandidateArtifact[],
  scoreResult: ArtifactScoreResult | undefined,
  globalConfig: GlobalStatWeights,
  tierAssignments: TierAssignment,
  luckMultiplier: number = DEFAULT_LUCK_MULTIPLIER
): CharacterInsights {
  const buildMatch = scoreResult?.buildMatch;
  if (!buildMatch)
    return { characterId: char.key, insights: [], totalPotentialGain: 0 };

  const insights: Insight[] = [];

  for (const slot of allSlots) {
    const equipped = char.artifacts?.[slot];
    const currentScore = equipped
      ? scoreSlot(equipped, buildMatch.statWeights, globalConfig)
      : 0;

    const mainStatForCalc: MainStat =
      equipped?.mainStatKey ??
      (slot === "flower" ? "hp" : slot === "plume" ? "atk" : "atk%");
    const maxPotentialScore = calculateMaxSlotSubScore(
      mainStatForCalc,
      buildMatch.statWeights,
      equipped?.rarity ?? 5
    );

    const ctx: SlotContext = {
      characterId: char.key,
      char,
      slot,
      equipped,
      currentScore,
      maxPotentialScore,
      buildMatch,
      globalConfig,
      luckMultiplier,
    };

    const candidates = filterCandidates(
      slot,
      equipped,
      allArtifacts,
      buildMatch,
      tierAssignments
    );

    if (!equipped) {
      // Empty slot: only EQUIP strategy applies
      const equip = evaluateEquip(ctx, candidates);
      if (equip) insights.push(equip);
    } else {
      const fixMain = evaluateFixMain(ctx);
      const swap = evaluateSwap(ctx, candidates);
      const upgrade = evaluateUpgrade(ctx, candidates);
      const reroll = evaluateReroll(ctx);
      const farm = evaluateFarm(ctx);

      insights.push(...selectInsights(fixMain, swap, upgrade, reroll, farm));
    }
  }

  return {
    characterId: char.key,
    insights: insights.sort((a, b) => {
      // EQUIP always floats to top (empty slots are highest priority)
      const aEquip = a.type === "EQUIP" ? 1 : 0;
      const bEquip = b.type === "EQUIP" ? 1 : 0;
      if (aEquip !== bEquip) return bEquip - aEquip;
      return (b.scoreDiff ?? 0) - (a.scoreDiff ?? 0);
    }),
    totalPotentialGain: 0,
  };
}

export function generateAllInsights(
  accountData: AccountData,
  scores: Record<string, ArtifactScoreResult>,
  globalConfig: GlobalStatWeights,
  tierAssignments: TierAssignment,
  tierCustomization: TierCustomization = {}
): CharacterInsights[] {
  const allArtifacts: CandidateArtifact[] = [
    ...accountData.extraArtifacts.map((a) => ({ ...a, location: undefined })),
    ...accountData.characters.flatMap((c) =>
      Object.values(c.artifacts)
        .filter((a): a is ArtifactData => !!a)
        .map((a) => ({ ...a, location: c.key }))
    ),
  ];

  return accountData.characters.map((char) => {
    const tier = tierAssignments[char.key]?.tier || "Pool";
    if (tier === "Pool") {
      return { characterId: char.key, insights: [], totalPotentialGain: 0 };
    }

    const luckExpectation =
      tierCustomization[tier]?.luckExpectation || "balanced";
    const luckMultiplier = LUCK_MULTIPLIERS[luckExpectation];
    const scoreResult = scores[char.key];

    return generateCharacterInsights(
      char,
      allArtifacts,
      scoreResult,
      globalConfig,
      tierAssignments,
      luckMultiplier
    );
  });
}
