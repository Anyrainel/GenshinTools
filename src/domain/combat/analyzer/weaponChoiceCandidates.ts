import type { AccountData } from "@/domain/models";
import type { WeaponStatsMap } from "@/domain/reference/stats";
import { collectOwnedWeaponCopies } from "../../team/weaponCopies";

/** Comparison evaluates each owned weapon at its imported refinement. */
export function collectOwnedWeaponChoices(account: AccountData) {
  const choices = new Map<string, { weaponId: string; refinement: number }>();
  for (const weapon of collectOwnedWeaponCopies(account)) {
    choices.set(`${weapon.key}:${weapon.refinement}`, {
      weaponId: weapon.key,
      refinement: weapon.refinement,
    });
  }
  return [...choices.values()];
}

export function getCompatibleOwnedWeaponChoices(
  choices: readonly { weaponId: string; refinement: number }[],
  weaponType: string,
  weaponStats: WeaponStatsMap
) {
  return choices.filter(
    (choice) => weaponStats[choice.weaponId]?.type === weaponType
  );
}
