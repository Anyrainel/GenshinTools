import { retiredWeaponIds } from "@/config/game/retiredWeaponIds";

export function resolveReleasedWeaponId(id: string): string {
  return Object.hasOwn(retiredWeaponIds, id) ? retiredWeaponIds[id] : id;
}
