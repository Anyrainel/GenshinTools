/**
 * V3 T-Factor Extraction
 *
 * Builds TeamBuild instances from team comp data (research + flagship),
 * extracts multiplicative T-factor fixed values for each DPS character,
 * and outputs a JSON structure for runtime scoring.
 *
 * The T-factors mirror the Genshin damage formula:
 *   D = T_scale × T_crit × T_dmg × T_rxn × T_def × T_res
 * where T_def and T_res are constants (independent of artifacts).
 *
 * At runtime, scoring is:
 *   score = 300 × D_actual / D_ideal
 * with each T computed from stored fixed values + user's artifact stats.
 */

// Ensure all implementations are registered
import "@/lib/team-comp";

import { charactersById, weaponsById } from "@/data/constants";
import type { SubStat } from "@/data/types";
import { getCharacterStatsSync } from "@/lib/gameStatsLoader";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import type {
  CalcContext,
  CharCompConfig,
  DamageTag,
  ReactionOverride,
  StatKey,
} from "@/lib/team-comp/types";
import { TUNABLE_SUBSTATS, applyAllocation, autoTuneWeights } from "./autoTune";
import type { AutoTuneResult } from "./types";

// ─── Types ───

export type V3FixedValues = {
  /** Primary scaling stat for this character */
  scalingStat: "atk" | "hp" | "def" | "em";
  /** Character + weapon base value for the scaling stat */
  baseScaling: number;
  /** Total scaling stat with zero substats (includes all fixed bonuses) */
  fixedScalingTotal: number;
  /** Fixed CRIT Rate (with main stats, zero substats) */
  fixedCR: number;
  /** Fixed CRIT DMG (with main stats, zero substats) */
  fixedCD: number;
  /** Fixed EM (with main stats, zero substats) */
  fixedEM: number;
  /** Fixed DMG% bonus (with main stats, zero substats) */
  fixedDmgPct: number;
  /** Whether this build uses amplifying reaction */
  hasAmplifying: boolean;
  /** Amplifying reaction coefficient (1.5 or 2.0) */
  rxnCoeff: number;
  /** Fixed reaction bonus (from artifact sets, passives) */
  fixedRxnBonus: number;
  /** Whether this build uses catalyze reaction (spread/aggravate) */
  hasCatalyze: boolean;
  /** Catalyze flat bonus at reference EM */
  catalyzeFlatBonus: number;
};

export type V3IdealStats = {
  /** Ideal substats from greedy allocation */
  idealArtCR: number;
  idealArtCD: number;
  idealArtScalingPct: number;
  idealArtScalingFlat: number;
  idealArtEM: number;
  idealArtER: number;
  /** Ideal damage (for normalization) */
  idealDamage: number;
};

export type V3TeamData = {
  teamName: string;
  fixed: V3FixedValues;
  ideal: V3IdealStats;
  /** Greedy roll allocation for this team context */
  rollAllocation: Record<SubStat, number>;
};

export type V3BuildData = {
  characterId: string;
  element: string;
  /** Main stat recommendations (from V2 pipeline) */
  bestSands: string;
  bestGoblet: string;
  bestCirclet: string;
  /** Per-team T-factor data */
  teams: V3TeamData[];
  /** Display weights (derived from averaged ideal allocation) */
  displayWeights: Record<SubStat, number>;
};

// ─── Constants ───

const DEFAULT_CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 10,
  assumeCrit: false,
};

const MAIN_STAT_DECIMAL: Record<string, number> = {
  "hp%": 0.466,
  "atk%": 0.466,
  "def%": 0.583,
  em: 186.5,
  er: 0.518,
  cr: 0.311,
  cd: 0.622,
  "pyro%": 0.466,
  "hydro%": 0.466,
  "cryo%": 0.466,
  "electro%": 0.466,
  "anemo%": 0.466,
  "geo%": 0.466,
  "dendro%": 0.466,
  "phys%": 0.583,
};

const ELEMENT_TO_DMG_KEY: Record<string, string> = {
  Pyro: "pyro%",
  Hydro: "hydro%",
  Cryo: "cryo%",
  Electro: "electro%",
  Anemo: "anemo%",
  Geo: "geo%",
  Dendro: "dendro%",
};

const AMPLIFYING_COEFFS: Record<string, Record<string, number>> = {
  melt: { Pyro: 2.0, Cryo: 1.5 },
  vaporize: { Hydro: 2.0, Pyro: 1.5 },
};

// ─── Helpers ───

function buildBaselineSheet(
  sands: string,
  goblet: string,
  circlet: string
): StatSheet {
  const entries: { key: StatKey; value: number }[] = [
    { key: "hp" as StatKey, value: 4780 },
    { key: "atk" as StatKey, value: 311 },
  ];
  for (const main of [sands, goblet, circlet]) {
    const val = MAIN_STAT_DECIMAL[main];
    if (val !== undefined) {
      entries.push({ key: main as StatKey, value: val });
    }
  }
  return new StatSheet(entries);
}

/**
 * Build a baseline sheet with an additional stat entry.
 * This goes through StatSheet constructor so element DMG% keys get properly
 * normalized (e.g., "pyro%" → "dmg%" with Pyro filter).
 */
function buildBaselineSheetWithExtra(
  sands: string,
  goblet: string,
  circlet: string,
  extraKey: string,
  extraValue: number
): StatSheet {
  const entries: { key: StatKey; value: number }[] = [
    { key: "hp" as StatKey, value: 4780 },
    { key: "atk" as StatKey, value: 311 },
  ];
  for (const main of [sands, goblet, circlet]) {
    const val = MAIN_STAT_DECIMAL[main];
    if (val !== undefined) {
      entries.push({ key: main as StatKey, value: val });
    }
  }
  entries.push({ key: extraKey as StatKey, value: extraValue });
  return new StatSheet(entries);
}

function buildTeamArtifactStats(
  configs: CharCompConfig[],
  dpsCharId: string,
  dpsSheet: StatSheet
): Record<string, StatSheet> {
  const stats: Record<string, StatSheet> = {};
  for (const config of configs) {
    if (config.charId === dpsCharId) {
      stats[config.charId] = dpsSheet;
    } else {
      stats[config.charId] = new StatSheet([
        { key: "hp" as StatKey, value: 4780 },
        { key: "atk" as StatKey, value: 311 },
      ]);
    }
  }
  return stats;
}

function findAllFormulaIds(teamBuild: TeamBuild, charId: string): string[] {
  const formulas = teamBuild.getFormulaIds();
  return Object.keys(formulas[charId] ?? {});
}

function evalDamage(
  teamBuild: TeamBuild,
  charId: string,
  formulaIds: string[],
  artifactStats: Record<string, StatSheet>,
  ctx: CalcContext,
  reactionOverride?: ReactionOverride
): number {
  const teamStats = teamBuild.getTeamStats(artifactStats, charId, ctx);
  let total = 0;
  for (const fid of formulaIds) {
    const result = teamBuild.getDamageResult(
      charId,
      fid,
      teamStats,
      ctx,
      reactionOverride
    );
    total += result.totalDamage;
  }
  return total;
}

function resolveElement(charId: string): string {
  const charStats = getCharacterStatsSync();
  if (!charStats) return "";
  return charStats[charId]?.element ?? "";
}

function getCharRarity(charId: string): number {
  return charactersById[charId]?.rarity ?? 4;
}

function getWeaponRarity(weaponId: string): number {
  return weaponsById[weaponId]?.rarity ?? 4;
}

// ─── Research Team JSON type ───

type ResearchTeam = {
  name: string;
  characters: string[];
  dpsIndex: number;
  reaction: string;
  builds: { weapon: string; artifacts: string[] }[];
};

/**
 * Convert a research team entry to CharCompConfig[].
 */
export function researchTeamToConfigs(team: ResearchTeam): CharCompConfig[] {
  return team.characters.map((charId, idx) => {
    const build = team.builds[idx];
    const weaponId = build?.weapon ?? "";
    const artifacts = build?.artifacts ?? [];

    let artifactSetId: string | null = null;
    let artifactHalfSetIds: string[] = [];

    if (artifacts.length === 1) {
      artifactSetId = artifacts[0];
    } else if (artifacts.length === 2) {
      artifactHalfSetIds = [artifacts[0], artifacts[1]];
    }

    const charRarity = getCharRarity(charId);
    const weaponRarity = getWeaponRarity(weaponId);

    return {
      charId,
      charLevel: 90,
      constellation: charRarity >= 5 ? 0 : 6,
      weaponId,
      refinement: weaponRarity >= 5 ? 1 : 5,
      artifactSetId,
      artifactHalfSetIds,
    };
  });
}

/**
 * Infer the best main stats for a given DPS character in a team context.
 * Uses baseline damage comparison across main stat combos.
 */
function inferBestMainStats(
  teamBuild: TeamBuild,
  configs: CharCompConfig[],
  dpsCharId: string,
  formulaIds: string[],
  element: string,
  reactionOverride?: ReactionOverride
): { sands: string; goblet: string; circlet: string } {
  const elemDmgKey = ELEMENT_TO_DMG_KEY[element] ?? "pyro%";
  const sandsCandidates = ["hp%", "atk%", "def%", "em", "er"];
  const gobletCandidates = [elemDmgKey, "hp%", "atk%", "def%", "em", "phys%"];
  const circletCandidates = ["cr", "cd", "hp%", "atk%", "def%", "em"];

  let bestDmg = -1;
  let bestCombo = { sands: "atk%", goblet: elemDmgKey, circlet: "cr" };

  for (const s of sandsCandidates) {
    for (const g of gobletCandidates) {
      for (const c of circletCandidates) {
        const sheet = buildBaselineSheet(s, g, c);
        const artifactStats = buildTeamArtifactStats(configs, dpsCharId, sheet);
        const dmg = evalDamage(
          teamBuild,
          dpsCharId,
          formulaIds,
          artifactStats,
          DEFAULT_CTX,
          reactionOverride
        );
        if (dmg > bestDmg) {
          bestDmg = dmg;
          bestCombo = { sands: s, goblet: g, circlet: c };
        }
      }
    }
  }

  return bestCombo;
}

/**
 * Extract T-factor fixed values for a DPS character in a specific team context.
 *
 * Process:
 * 1. Construct TeamBuild
 * 2. Infer best main stats via baseline damage
 * 3. Resolve stats with zero substats → extract fixed T-factor components
 * 4. Run greedy allocation → get ideal substats
 * 5. Compute ideal damage
 */
export function extractV3ForTeam(team: ResearchTeam): {
  buildData: V3TeamData;
  bestMains: { sands: string; goblet: string; circlet: string };
  element: string;
  scalingStat: "atk" | "hp" | "def" | "em";
} | null {
  const dpsCharId = team.characters[team.dpsIndex];
  if (!dpsCharId) return null;

  const element = resolveElement(dpsCharId);
  if (!element) return null;

  let configs: CharCompConfig[];
  try {
    configs = researchTeamToConfigs(team);
  } catch {
    return null;
  }

  let teamBuild: TeamBuild;
  try {
    teamBuild = new TeamBuild(configs, {});
  } catch {
    return null;
  }

  const formulaIds = findAllFormulaIds(teamBuild, dpsCharId);
  if (formulaIds.length === 0) return null;

  // Determine reaction
  const reaction = team.reaction;
  const reactionOverride: ReactionOverride | undefined =
    reaction && reaction !== "none"
      ? { reaction: reaction as ReactionOverride["reaction"] }
      : undefined;

  // Infer best main stats
  const bestMains = inferBestMainStats(
    teamBuild,
    configs,
    dpsCharId,
    formulaIds,
    element,
    reactionOverride
  );

  // Build baseline sheet (main stats only, zero substats)
  const baseSheet = buildBaselineSheet(
    bestMains.sands,
    bestMains.goblet,
    bestMains.circlet
  );
  const baseArtifactStats = buildTeamArtifactStats(
    configs,
    dpsCharId,
    baseSheet
  );

  // Resolve stats at zero substats
  const teamStats = teamBuild.getTeamStats(
    baseArtifactStats,
    dpsCharId,
    DEFAULT_CTX
  );
  const dpsStats = teamStats[dpsCharId];

  // Extract base scaling stat via probing
  // Probe: add +0.01 to scaling%, measure change in total scaling stat
  const scalingCandidates: ("atk" | "hp" | "def" | "em")[] = [
    "atk",
    "hp",
    "def",
    "em",
  ];
  let bestScalingStat: "atk" | "hp" | "def" | "em" = "atk";
  let bestScalingContrib = 0;

  // Choose scaling stat based on which % contributes most marginal damage
  const baseDmg = evalDamage(
    teamBuild,
    dpsCharId,
    formulaIds,
    baseArtifactStats,
    DEFAULT_CTX,
    reactionOverride
  );

  for (const stat of scalingCandidates) {
    if (stat === "em") continue; // EM doesn't use base×% formula
    const pctKey = `${stat}%` as StatKey;
    const delta = 0.1; // +10%
    const probedSheet = baseSheet.withDelta(pctKey, delta);
    const probedArtifactStats = buildTeamArtifactStats(
      configs,
      dpsCharId,
      probedSheet
    );
    const probedDmg = evalDamage(
      teamBuild,
      dpsCharId,
      formulaIds,
      probedArtifactStats,
      DEFAULT_CTX,
      reactionOverride
    );
    const contrib = probedDmg - baseDmg;
    if (contrib > bestScalingContrib) {
      bestScalingContrib = contrib;
      bestScalingStat = stat;
    }
  }

  // Extract components
  const scalingKey = bestScalingStat as StatKey;
  const pctKey = `${bestScalingStat}%` as StatKey;

  // Base scaling = (total at +0.01%) - (total at 0%) / 0.01
  // Since get(scalingKey) = base × (1 + pct) + flat
  // Adding delta to pct: base × (1 + pct + delta) + flat
  // Difference = base × delta → base = diff / delta
  const totalScaling0 = dpsStats.get(scalingKey);
  // For scaling% stats (atk%, hp%, def%), withDelta works fine since these
  // aren't element DMG% keys and don't need normalization.
  const probedSheet2 = baseSheet.withDelta(pctKey, 0.01);
  const probedArtStats2 = buildTeamArtifactStats(
    configs,
    dpsCharId,
    probedSheet2
  );
  const probedTeamStats2 = teamBuild.getTeamStats(
    probedArtStats2,
    dpsCharId,
    DEFAULT_CTX
  );
  const totalScaling1 = probedTeamStats2[dpsCharId].get(scalingKey);
  // Note: some buff systems may scale with the character's own stats, so the
  // delta might be slightly larger than base×0.01. This gives us an effective
  // base that accounts for those interactions — which is what we want for scoring.
  const baseScaling = (totalScaling1 - totalScaling0) / 0.01;

  // Extract CR, CD (universal only — we use getRaw or get with no tag to be safe)
  // For now use universal values
  const fixedCR = dpsStats.getRaw("cr" as StatKey);
  const fixedCD = dpsStats.getRaw("cd" as StatKey);
  const fixedEM = dpsStats.get("em" as StatKey);

  // DMG% extraction via damage probe.
  // IMPORTANT: StatSheet.withDelta("pyro%", ...) doesn't work because element DMG%
  // keys are normalized to "dmg%" with element filter during construction.
  // We must create a new StatSheet with the extra entry instead.
  //
  // We probe both element% and phys% to handle physical DPS characters (Eula, Freminet).
  // The probe that produces a larger dmgRatio is the one that actually affects the damage.
  const elemDmgKey = ELEMENT_TO_DMG_KEY[element] ?? "pyro%";
  const probeKeys = [elemDmgKey, "phys%"];

  let bestDmgRatio = 0;
  let fixedDmgPct = 0;

  for (const probeKey of probeKeys) {
    const dmgProbeSheet = buildBaselineSheetWithExtra(
      bestMains.sands,
      bestMains.goblet,
      bestMains.circlet,
      probeKey,
      0.1
    );
    const dmgProbeArtStats = buildTeamArtifactStats(
      configs,
      dpsCharId,
      dmgProbeSheet
    );
    const dmgProbeDmg = evalDamage(
      teamBuild,
      dpsCharId,
      formulaIds,
      dmgProbeArtStats,
      DEFAULT_CTX,
      reactionOverride
    );
    // D'/D = (1 + dmg% + 0.1) / (1 + dmg%)
    // 1 + dmg% = 0.1 / (D'/D - 1)
    const dmgRatio = dmgProbeDmg / baseDmg;
    if (dmgRatio > bestDmgRatio) {
      // Higher dmgRatio = probe had more effect = this is the active DMG% channel.
      // A barely-responsive channel (e.g., cryo% on a physical DPS) has ratio ≈ 1.
      bestDmgRatio = dmgRatio;
      fixedDmgPct = dmgRatio > 1.001 ? 0.1 / (dmgRatio - 1) - 1 : 0;
    }
  }
  // Cap fixedDmgPct: values > 4 indicate the probe barely affected damage,
  // meaning the character's formulas don't scale with standard DMG% channels.
  // In such cases, DMG% goblets provide negligible value — use a conservative estimate.
  if (fixedDmgPct > 4) {
    fixedDmgPct = 1.5; // conservative fallback
  }

  // Amplifying reaction info
  const ampCoeffs = AMPLIFYING_COEFFS[reaction];
  const hasAmplifying = ampCoeffs !== undefined;
  const rxnCoeff = hasAmplifying ? (ampCoeffs[element] ?? 1.5) : 1;

  // Reaction bonus from EM: bonus = 2.78 × EM / (EM + 1400)
  const fixedRxnBonus = hasAmplifying ? (2.78 * fixedEM) / (fixedEM + 1400) : 0;

  // Catalyze info
  const hasCatalyze = reaction === "aggravate" || reaction === "spread";
  const catalyzeCoeffs: Record<string, number> = {
    aggravate: 1.15,
    spread: 1.25,
  };
  const levelMult = 1446.853458; // Level 90
  const emBonus = (5.0 * fixedEM) / (fixedEM + 1200);
  const catalyzeFlatBonus = hasCatalyze
    ? (catalyzeCoeffs[reaction] ?? 0) * levelMult * (1 + emBonus)
    : 0;

  // ─── Run greedy allocation for ideal substats ───
  const tuneResult = autoTuneWeights(
    teamBuild,
    dpsCharId,
    formulaIds,
    baseArtifactStats,
    DEFAULT_CTX,
    reactionOverride
  );

  // Compute ideal art stats from allocation
  const allocation = tuneResult.rollAllocation;
  const AVG_SUBSTAT_ROLL: Record<string, number> = {
    cr: 0.033,
    cd: 0.066,
    "atk%": 0.0496,
    "hp%": 0.0496,
    "def%": 0.062,
    em: 19.82,
    er: 0.055,
    atk: 16.54,
    hp: 253.94,
    def: 19.68,
  };

  const idealArtCR = (allocation.cr ?? 0) * AVG_SUBSTAT_ROLL.cr;
  const idealArtCD = (allocation.cd ?? 0) * AVG_SUBSTAT_ROLL.cd;
  const scalingPctKey = `${bestScalingStat}%`;
  const idealArtScalingPct =
    (allocation[scalingPctKey as SubStat] ?? 0) *
    (AVG_SUBSTAT_ROLL[scalingPctKey] ?? 0);
  const idealArtScalingFlat =
    (allocation[bestScalingStat as SubStat] ?? 0) *
    (AVG_SUBSTAT_ROLL[bestScalingStat] ?? 0);
  const idealArtEM = (allocation.em ?? 0) * AVG_SUBSTAT_ROLL.em;
  const idealArtER = (allocation.er ?? 0) * AVG_SUBSTAT_ROLL.er;

  const fixed: V3FixedValues = {
    scalingStat: bestScalingStat,
    baseScaling,
    fixedScalingTotal: totalScaling0,
    fixedCR,
    fixedCD,
    fixedEM,
    fixedDmgPct: Math.max(0, fixedDmgPct),
    hasAmplifying,
    rxnCoeff,
    fixedRxnBonus,
    hasCatalyze,
    catalyzeFlatBonus,
  };

  const ideal: V3IdealStats = {
    idealArtCR,
    idealArtCD,
    idealArtScalingPct,
    idealArtScalingFlat,
    idealArtEM,
    idealArtER,
    idealDamage: tuneResult.finalDamage,
  };

  return {
    buildData: {
      teamName: team.name,
      fixed,
      ideal,
      rollAllocation: allocation,
    },
    bestMains: bestMains,
    element,
    scalingStat: bestScalingStat,
  };
}

/**
 * Run V3 extraction for all research teams.
 * Groups results by DPS character and aggregates across team contexts.
 */
export function extractV3All(researchTeams: ResearchTeam[]): V3BuildData[] {
  const byChar = new Map<
    string,
    {
      teams: V3TeamData[];
      mains: { sands: string; goblet: string; circlet: string }[];
      element: string;
      scalingStat: "atk" | "hp" | "def" | "em";
    }
  >();

  for (const team of researchTeams) {
    const dpsCharId = team.characters[team.dpsIndex];
    if (!dpsCharId) continue;

    try {
      const result = extractV3ForTeam(team);
      if (!result) continue;

      if (!byChar.has(dpsCharId)) {
        byChar.set(dpsCharId, {
          teams: [],
          mains: [],
          element: result.element,
          scalingStat: result.scalingStat,
        });
      }

      const entry = byChar.get(dpsCharId)!;
      entry.teams.push(result.buildData);
      entry.mains.push(result.bestMains);
    } catch (err) {
      console.error(
        `V3 extraction failed for ${dpsCharId} in "${team.name}":`,
        err
      );
    }
  }

  // Build output
  const builds: V3BuildData[] = [];
  for (const [charId, data] of byChar) {
    // Pick most common main stats
    const sandsCounts: Record<string, number> = {};
    const gobletCounts: Record<string, number> = {};
    const circletCounts: Record<string, number> = {};
    for (const m of data.mains) {
      sandsCounts[m.sands] = (sandsCounts[m.sands] ?? 0) + 1;
      gobletCounts[m.goblet] = (gobletCounts[m.goblet] ?? 0) + 1;
      circletCounts[m.circlet] = (circletCounts[m.circlet] ?? 0) + 1;
    }
    const bestSands =
      Object.entries(sandsCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ??
      "atk%";
    const bestGoblet =
      Object.entries(gobletCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ??
      "atk%";
    const bestCirclet =
      Object.entries(circletCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ??
      "cr";

    // Compute display weights from averaged roll allocations
    const displayWeights = {} as Record<SubStat, number>;
    for (const stat of TUNABLE_SUBSTATS) {
      const sum = data.teams.reduce(
        (acc, t) => acc + (t.rollAllocation[stat] ?? 0),
        0
      );
      displayWeights[stat] = Math.round((sum / data.teams.length) * 10) / 10;
    }
    // Normalize: highest → 100
    const maxAlloc = Math.max(...Object.values(displayWeights));
    if (maxAlloc > 0) {
      for (const stat of TUNABLE_SUBSTATS) {
        displayWeights[stat] = Math.round(
          (displayWeights[stat] / maxAlloc) * 100
        );
      }
    }

    builds.push({
      characterId: charId,
      element: data.element,
      bestSands,
      bestGoblet,
      bestCirclet,
      teams: data.teams,
      displayWeights,
    });
  }

  return builds;
}
