import type { AccountData, ArtifactData, WeaponData } from "@/data/types";

export function getMaxIds(data: AccountData): { maxA: number; maxW: number } {
  let maxA = -1;
  let maxW = -1;
  const parse = (id: string, prefix: string) => {
    const num = Number.parseInt(id.replace(prefix, ""), 10);
    return Number.isNaN(num) ? -1 : num;
  };

  const checkA = (art: ArtifactData) => {
    const val = parse(art.id, "artifact-");
    if (val > maxA) maxA = val;
  };
  const checkW = (wp: WeaponData) => {
    const val = parse(wp.id, "weapon-");
    if (val > maxW) maxW = val;
  };

  for (const c of data.characters) {
    for (const a of Object.values(c.artifacts)) {
      if (a) checkA(a);
    }
    if (c.weapon) checkW(c.weapon);
  }
  for (const art of data.extraArtifacts) {
    checkA(art);
  }
  for (const wp of data.extraWeapons) {
    checkW(wp);
  }

  return { maxA, maxW };
}

export function nextArtifactId(data: AccountData): string {
  return `artifact-${getMaxIds(data).maxA + 1}`;
}

export function nextWeaponId(data: AccountData): string {
  return `weapon-${getMaxIds(data).maxW + 1}`;
}
