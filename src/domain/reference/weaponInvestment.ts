import { weaponsById } from "./catalog";

export function isPaidFiveStarWeapon(weaponId: string): boolean {
  return weaponsById[weaponId]?.rarity === 5 && weaponId !== "exaiphanes_blade";
}

/** Default for hypothetical equipment; imported copies retain their refinement. */
export function defaultWeaponRefinement(
  weaponId: string | null | undefined
): number {
  return weaponId === "exaiphanes_blade" ? 5 : 1;
}
