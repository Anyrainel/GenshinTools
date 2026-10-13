import type { TeamSlotConfig } from "@/domain/combat/damage/types";
import type { Rarity } from "@/domain/enums";
import { charactersById, weaponsById } from "@/domain/reference/catalog";
import {
  defaultWeaponRefinement,
  isPaidFiveStarWeapon,
} from "@/domain/reference/weaponInvestment";
import { hasPaidConstellations } from "./investmentCost";
import type { AnalyzerCharConfig, StoredAnalyzerCharConfig } from "./types";

/** Reconcile stored (persisted) configs into full AnalyzerCharConfigs using roster data. */
export function reconcileConfigs(
  stored: StoredAnalyzerCharConfig[],
  baseConfigs: TeamSlotConfig[]
): AnalyzerCharConfig[] {
  const baseIds = new Set(baseConfigs.map((b) => b.charId));
  const kept = stored.filter((c) => baseIds.has(c.charId));
  const keptIds = new Set(kept.map((c) => c.charId));
  const fullKept = kept.map((sc) => {
    const bc = baseConfigs.find((b) => b.charId === sc.charId)!;
    return storedToFull(sc, bc);
  });
  const added = buildDefaultCharConfigs(
    baseConfigs.filter((b) => !keptIds.has(b.charId))
  );
  const byId = new Map([...fullKept, ...added].map((c) => [c.charId, c]));
  return baseConfigs.map((b) => byId.get(b.charId)!);
}
/** Expand a stored config into a full AnalyzerCharConfig using the roster weapon. */
function storedToFull(
  sc: StoredAnalyzerCharConfig,
  bc: TeamSlotConfig
): AnalyzerCharConfig {
  const charRes = charactersById[sc.charId];
  const rarity = (charRes?.rarity ?? 5) as Rarity;
  const rosterIs5Star = isPaidFiveStarWeapon(bc.weaponId);
  const altRarity = sc.altWeapon
    ? weaponsById[sc.altWeapon.id]?.rarity
    : undefined;
  // Keep paid weapons and zero-pull weapons separate, regardless of rarity.
  const weapon4Star = rosterIs5Star
    ? sc.altWeapon &&
      altRarity !== undefined &&
      altRarity >= 3 &&
      !isPaidFiveStarWeapon(sc.altWeapon.id)
      ? {
          id: sc.altWeapon.id,
          refinement:
            defaultWeaponRefinement(sc.altWeapon.id) === 5
              ? 5
              : (sc.altWeapon.refinement ?? 5),
        }
      : undefined
    : {
        id: bc.weaponId,
        refinement:
          defaultWeaponRefinement(bc.weaponId) === 5 ? 5 : bc.refinement,
      };
  const weapon5Star = rosterIs5Star
    ? { id: bc.weaponId }
    : sc.altWeapon && isPaidFiveStarWeapon(sc.altWeapon.id)
      ? { id: sc.altWeapon.id }
      : undefined;

  return {
    charId: sc.charId,
    rarity,
    weapon4Star,
    weapon5Star,
    startConstellation: sc.charId.startsWith("traveler_")
      ? 6
      : bc.constellation,
    startRefinement: rosterIs5Star ? bc.refinement : 0,
    maxConstellation: hasPaidConstellations({ charId: sc.charId, rarity })
      ? Math.max(bc.constellation, sc.maxConstellation)
      : sc.charId.startsWith("traveler_")
        ? 6
        : bc.constellation,
    maxRefinement: weapon5Star
      ? Math.max(rosterIs5Star ? bc.refinement : 0, sc.maxRefinement)
      : 0,
  };
}
/** Strip a full config down to the stored form (only alt weapon). */
export function fullToStored(
  cfg: AnalyzerCharConfig,
  bc: TeamSlotConfig
): StoredAnalyzerCharConfig {
  const rosterIs5Star = isPaidFiveStarWeapon(bc.weaponId);

  const altWeapon = rosterIs5Star
    ? cfg.weapon4Star
      ? { id: cfg.weapon4Star.id, refinement: cfg.weapon4Star.refinement }
      : undefined
    : cfg.weapon5Star
      ? { id: cfg.weapon5Star.id }
      : undefined;

  return {
    charId: cfg.charId,
    altWeapon,
    maxConstellation: cfg.maxConstellation,
    maxRefinement: cfg.maxRefinement,
  };
}
function buildDefaultCharConfigs(
  baseConfigs: TeamSlotConfig[]
): AnalyzerCharConfig[] {
  return baseConfigs.map((bc) => {
    const charRes = charactersById[bc.charId];
    const rarity: Rarity = (charRes?.rarity ?? 5) as Rarity;
    const is5StarWeapon = isPaidFiveStarWeapon(bc.weaponId);

    return {
      charId: bc.charId,
      rarity,
      weapon4Star: !is5StarWeapon
        ? {
            id: bc.weaponId,
            refinement:
              defaultWeaponRefinement(bc.weaponId) === 5 ? 5 : bc.refinement,
          }
        : undefined,
      weapon5Star: is5StarWeapon ? { id: bc.weaponId } : undefined,
      startConstellation: bc.charId.startsWith("traveler_")
        ? 6
        : bc.constellation,
      startRefinement: is5StarWeapon ? bc.refinement : 0,
      maxConstellation: hasPaidConstellations({ charId: bc.charId, rarity })
        ? 6
        : bc.charId.startsWith("traveler_")
          ? 6
          : bc.constellation,
      maxRefinement: is5StarWeapon ? 5 : 0,
    };
  });
}
