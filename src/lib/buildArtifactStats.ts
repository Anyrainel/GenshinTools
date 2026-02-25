/**
 * Shared utility for generating representative 5★ artifact StatSheets
 * from the AllCharacterBuilds preset data.
 *
 * Used by: scripts/qa-dmg.ts, and any future tool that needs
 * data-driven artifact stats without hand-authoring main/sub-stat values.
 */

import { StatSheet } from "@/lib/team-comp/damageModels";
import { AVG_SUBSTAT_ROLL } from "@/lib/team-comp/inspection";
import type { StatKey } from "@/lib/team-comp/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PresetSubstat {
  stat: string;
  weight: number;
}

export interface PresetBuildEntry {
  characterId: string;
  composition?: string;
  artifactSet?: string;
  sands?: string[];
  goblet?: string[];
  circlet?: string[];
  substats?: PresetSubstat[];
  visible?: boolean;
}

export interface AllBuildsPreset {
  builds: Record<string, PresetBuildEntry>;
}

export interface ArtifactStatsOverride {
  sands?: string;
  goblet?: string;
  circlet?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Max +20 5★ main-stat values.
 * Percentage stats are stored as fractions (e.g. 46.6% → 0.466)
 * to match StatSheet's internal representation.
 */
export const MAIN_STAT_5STAR: Partial<Record<StatKey, number>> = {
  hp: 4780,
  atk: 311,
  "hp%": 0.466,
  "atk%": 0.466,
  "def%": 0.583,
  em: 186.5,
  er: 0.518,
  "pyro%": 0.466,
  "hydro%": 0.466,
  "electro%": 0.466,
  "cryo%": 0.466,
  "anemo%": 0.466,
  "geo%": 0.466,
  "dendro%": 0.466,
  "phys%": 0.583,
  cr: 0.311,
  cd: 0.622,
  "heal%": 0.359,
};

/**
 * Total "virtual rolls" to distribute as substat budget.
 * 30 rolls represents a well-invested but not god-roll build
 * (roughly 6 productive rolls per piece × 5 pieces).
 */
export const TOTAL_SUB_ROLLS = 30;

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Find the best matching preset build entry for a character.
 * Priority: exact (charId + artifactSet, visible) > any visible > any.
 */
export function findPresetBuild(
  charId: string,
  artifactSetId: string | null,
  builds: Record<string, PresetBuildEntry>
): PresetBuildEntry | undefined {
  let fallback: PresetBuildEntry | undefined;

  for (const b of Object.values(builds)) {
    if (b.characterId !== charId) continue;
    if (b.artifactSet === artifactSetId && b.visible !== false) return b;
    if (!fallback && b.visible !== false) fallback = b;
  }
  if (fallback) return fallback;

  // Last resort: any build for this character regardless of visibility
  for (const b of Object.values(builds)) {
    if (b.characterId === charId) return b;
  }
  return undefined;
}

/**
 * Generate a representative 5★ artifact StatSheet for a character.
 *
 * Main stats:
 *   Flower → hp=4780, Plume → atk=311
 *   Sands/Goblet/Circlet → from the character's preset build (or override)
 *
 * Substats:
 *   TOTAL_SUB_ROLLS rolls distributed proportionally by the preset's
 *   substat weight config. This represents a good-but-not-godroll build.
 */
export function buildArtifactStats(
  charId: string,
  artifactSetId: string | null,
  builds: Record<string, PresetBuildEntry>,
  override?: ArtifactStatsOverride
): StatSheet {
  const build = findPresetBuild(charId, artifactSetId, builds);

  const sands = (override?.sands ?? build?.sands?.[0] ?? "atk%") as StatKey;
  const goblet = (override?.goblet ?? build?.goblet?.[0] ?? "atk%") as StatKey;
  const circlet = (override?.circlet ?? build?.circlet?.[0] ?? "cr") as StatKey;

  const substatConfig: PresetSubstat[] = build?.substats ?? [
    { stat: "cr", weight: 100 },
    { stat: "cd", weight: 100 },
    { stat: "atk%", weight: 75 },
  ];

  const combined: Partial<Record<StatKey, number>> = {};

  // Fixed main stats: Flower (hp) + Plume (atk)
  combined.hp = 4780;
  combined.atk = 311;

  // Variable main stats: Sands / Goblet / Circlet
  for (const key of [sands, goblet, circlet]) {
    const val = MAIN_STAT_5STAR[key];
    if (val !== undefined) {
      combined[key] = (combined[key] ?? 0) + val;
    }
  }

  // Substats: proportional roll distribution
  const validSubs = substatConfig.filter(
    ({ stat }) => AVG_SUBSTAT_ROLL[stat as StatKey] !== undefined
  );
  const totalWeight = validSubs.reduce((s, x) => s + x.weight, 0);

  if (totalWeight > 0) {
    for (const { stat, weight } of validSubs) {
      const key = stat as StatKey;
      const rollVal = AVG_SUBSTAT_ROLL[key];
      if (!rollVal) continue;
      const rolls = (weight / totalWeight) * TOTAL_SUB_ROLLS;
      combined[key] = (combined[key] ?? 0) + rolls * rollVal;
    }
  }

  return StatSheet.fromRaw(combined);
}
