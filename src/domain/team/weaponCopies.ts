import type { AccountData, WeaponData } from "@/domain/models";
import { defaultWeaponRefinement } from "@/domain/reference/weaponInvestment";
import type { TeamComp, TeamSetupConfig } from "./types";

/** Physical inventory, equipped copies first on conflicting duplicate IDs. */
export function collectOwnedWeaponCopies(
  accountData: AccountData | null
): WeaponData[] {
  if (!accountData) return [];
  const byId = new Map<string, WeaponData>();
  for (const character of accountData.characters) {
    if (character.weapon && !byId.has(character.weapon.id))
      byId.set(character.weapon.id, character.weapon);
  }
  for (const weapon of accountData.extraWeapons)
    if (!byId.has(weapon.id)) byId.set(weapon.id, weapon);
  return [...byId.values()].sort(
    (a, b) =>
      a.key.localeCompare(b.key) ||
      b.refinement - a.refinement ||
      a.id.localeCompare(b.id)
  );
}

/** Defaults belong to roster slots, not to a global maximum for a weapon type. */
export function resolveRosterWeaponCopies(
  comp: TeamComp,
  setupConfig: TeamSetupConfig,
  accountData: AccountData | null
) {
  const copies = collectOwnedWeaponCopies(accountData);
  const used = new Set<string>();
  return comp.slots.map((slot) => {
    const copy =
      slot.charId && slot.weaponId
        ? (copies.find(
            (weapon) => weapon.key === slot.weaponId && !used.has(weapon.id)
          ) ?? null)
        : null;
    if (copy) used.add(copy.id);
    const configured = slot.charId
      ? setupConfig.charConfigs?.[slot.charId]?.refinement
      : undefined;
    const legacy = slot.charId
      ? setupConfig.combatOptions?.[`${slot.charId}.overrideRefinement`]
      : undefined;
    const override =
      configured ?? (legacy !== undefined ? Number(legacy) : undefined);
    const source: "account" | "override" | "unowned" | "no-account" =
      override !== undefined
        ? "override"
        : copy
          ? "account"
          : accountData
            ? "unowned"
            : "no-account";
    const refinement =
      override ?? copy?.refinement ?? defaultWeaponRefinement(slot.weaponId);
    return {
      copy,
      refinement,
      source,
      hypothetical:
        override !== undefined && (!copy || copy.refinement !== refinement),
    };
  });
}
