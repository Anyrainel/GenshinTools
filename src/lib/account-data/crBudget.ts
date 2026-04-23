import {
  resolveCharacterStats,
  resolveWeaponStats,
} from "@/data/gameStatsLoader";
/**
 * Computes non-artifact CR so the optimizer knows the ceiling for artifact CR.
 */
import type { CharacterData } from "@/data/types";
import type { BuildMatchResult } from "../artifact/scoring/artifactScore";
import {
  createArtifactSet,
  createWeapon,
  getOptionDef,
} from "../dmgcalc/core/registry";
import { TeamMeta } from "../dmgcalc/core/teamMeta";
import type { OptionMap } from "../dmgcalc/types";

export interface CrBudgetResult {
  baseCr: number; // 0.05
  ascensionCr: number; // from character_stats.json
  weaponSecondaryCr: number; // from weapon_stats.json
  weaponPassiveCr: number; // from weapon buff staticBuffs
  artifactSetCr: number; // from artifact set buff staticBuffs (best-case)
  totalNonArtifactCr: number;
}

/**
 * Compute the non-artifact CR budget for a character.
 * This tells the optimizer how much CR room is left for artifacts before hitting 100%.
 */
export function computeCrBudget(
  char: CharacterData,
  buildMatch: BuildMatchResult
): CrBudgetResult {
  const baseCr = 0.05;

  // Ascension CR: check character stats for a CR ascension stat
  let ascensionCr = 0;
  try {
    const charStats = resolveCharacterStats(char.key, char.level);
    // Base CR (0.05) is already included in charStats as a baseline entry.
    // Ascension CR is any CR value beyond the baseline 0.05.
    for (const entry of charStats) {
      if (entry.key === "cr" && entry.value > 0.05) {
        ascensionCr = entry.value - 0.05;
      }
    }
  } catch {
    // Stats not loaded or character not found
  }

  // Weapon secondary CR
  let weaponSecondaryCr = 0;
  if (char.weapon?.key) {
    try {
      const weaponStats = resolveWeaponStats(char.weapon.key);
      for (const entry of weaponStats) {
        if (entry.key === "cr") {
          weaponSecondaryCr = entry.value;
        }
      }
    } catch {
      // Weapon not found in stats
    }
  }

  // Weapon passive CR
  let weaponPassiveCr = 0;
  if (char.weapon?.key) {
    try {
      const teamMeta = new TeamMeta([char.key], {
        [char.key]: char.constellation,
      });
      const weapon = createWeapon(
        char.weapon.key,
        char.weapon.refinement,
        char.key,
        teamMeta
      );

      // Check if weapon has options — try all choices and take max CR
      const optionDef = getOptionDef(char.weapon.key);
      if (optionDef) {
        let maxCr = 0;
        for (const choice of optionDef.choices) {
          try {
            const opts: OptionMap = { [char.weapon.key]: choice.value };
            const w = createWeapon(
              char.weapon.key,
              char.weapon.refinement,
              char.key,
              teamMeta,
              opts
            );
            let cr = 0;
            for (const buff of w.buffs) {
              for (const sb of buff.staticBuffs) {
                if (sb.key === "cr") cr += sb.value;
              }
            }
            maxCr = Math.max(maxCr, cr);
          } catch {
            // Skip invalid option
          }
        }
        weaponPassiveCr = maxCr;
      } else {
        for (const buff of weapon.buffs) {
          for (const sb of buff.staticBuffs) {
            if (sb.key === "cr") weaponPassiveCr += sb.value;
          }
        }
      }
    } catch {
      // Weapon not registered in system
    }
  }

  // Artifact set CR (4pc builds only)
  let artifactSetCr = 0;
  const build = buildMatch.build;
  if (build.composition === "4pc" && build.artifactSet) {
    try {
      const teamMeta = new TeamMeta([char.key], {
        [char.key]: char.constellation,
      });

      const optionDef = getOptionDef(build.artifactSet);
      if (optionDef) {
        let maxCr = 0;
        for (const choice of optionDef.choices) {
          try {
            const opts: OptionMap = { [build.artifactSet!]: choice.value };
            const artSet = createArtifactSet(
              build.artifactSet!,
              char.key,
              teamMeta,
              opts
            );
            let cr = 0;
            for (const buff of artSet.buffs) {
              for (const sb of buff.staticBuffs) {
                if (sb.key === "cr") cr += sb.value;
              }
            }
            maxCr = Math.max(maxCr, cr);
          } catch {
            // Skip
          }
        }
        artifactSetCr = maxCr;
      } else {
        const artSet = createArtifactSet(build.artifactSet, char.key, teamMeta);
        for (const buff of artSet.buffs) {
          for (const sb of buff.staticBuffs) {
            if (sb.key === "cr") artifactSetCr += sb.value;
          }
        }
      }
    } catch {
      // Artifact set not registered
    }
  }

  return {
    baseCr,
    ascensionCr,
    weaponSecondaryCr,
    weaponPassiveCr,
    artifactSetCr,
    totalNonArtifactCr:
      baseCr +
      ascensionCr +
      weaponSecondaryCr +
      weaponPassiveCr +
      artifactSetCr,
  };
}
