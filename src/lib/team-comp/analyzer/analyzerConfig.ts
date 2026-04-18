import { charactersById, weaponsById } from "@/data/constants";
import type { Rarity } from "@/data/types";
import type { TeamSlotConfig } from "../types";
import type { AnalyzerCharConfig, StoredAnalyzerCharConfig } from "./types";

/** Re-reconcile already-expanded full configs when baseConfigs change (char added/removed/swapped). */
export function rereconcileConfigs(
  prev: AnalyzerCharConfig[],
  baseConfigs: TeamSlotConfig[]
): AnalyzerCharConfig[] {
  const baseIds = new Set(baseConfigs.map((b) => b.charId));
  const kept = prev.filter((c) => baseIds.has(c.charId));
  const keptIds = new Set(kept.map((c) => c.charId));
  const added = buildDefaultCharConfigs(
    baseConfigs.filter((b) => !keptIds.has(b.charId))
  );
  const byId = new Map([...kept, ...added].map((c) => [c.charId, c]));
  return baseConfigs.map((b) => byId.get(b.charId)!);
}
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
  const rosterWeapon = weaponsById[bc.weaponId];
  const rosterIs5Star = rosterWeapon?.rarity === 5;

  return {
    charId: sc.charId,
    rarity,
    weapon4Star: rosterIs5Star
      ? sc.altWeapon
        ? { id: sc.altWeapon.id, refinement: sc.altWeapon.refinement ?? 5 }
        : undefined
      : { id: bc.weaponId, refinement: bc.refinement },
    weapon5Star: rosterIs5Star
      ? { id: bc.weaponId }
      : sc.altWeapon
        ? { id: sc.altWeapon.id }
        : undefined,
    startConstellation: sc.startConstellation,
    startRefinement: sc.startRefinement,
    maxConstellation: sc.maxConstellation,
    maxRefinement: sc.maxRefinement,
  };
}
/** Strip a full config down to the stored form (only alt weapon). */
export function fullToStored(
  cfg: AnalyzerCharConfig,
  bc: TeamSlotConfig
): StoredAnalyzerCharConfig {
  const rosterWeapon = weaponsById[bc.weaponId];
  const rosterIs5Star = rosterWeapon?.rarity === 5;

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
    startConstellation: cfg.startConstellation,
    startRefinement: cfg.startRefinement,
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
    const weaponRes = weaponsById[bc.weaponId];
    const is5StarWeapon = weaponRes?.rarity === 5;

    return {
      charId: bc.charId,
      rarity,
      weapon4Star: !is5StarWeapon
        ? { id: bc.weaponId, refinement: bc.refinement }
        : undefined,
      weapon5Star: is5StarWeapon ? { id: bc.weaponId } : undefined,
      startConstellation: rarity >= 5 ? 0 : bc.constellation,
      startRefinement: is5StarWeapon ? 1 : 0,
      maxConstellation: rarity >= 5 ? 6 : bc.constellation,
      maxRefinement: is5StarWeapon ? 5 : 0,
    };
  });
}
