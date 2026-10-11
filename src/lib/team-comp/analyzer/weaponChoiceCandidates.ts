import type { WeaponStatsMap } from "@/data/gameStatsLoader";
import type { AccountData } from "@/data/types";

/** Comparison evaluates each owned weapon at its imported refinement. */
export function collectOwnedWeaponChoices(account: AccountData) {
  const choices = new Map<string, { weaponId: string; refinement: number }>();
  const copies = [
    ...account.characters.flatMap((char) => (char.weapon ? [char.weapon] : [])),
    ...account.extraWeapons,
  ];
  for (const weapon of copies) {
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
