import { charInfo } from "@/data/charInfo";
import { artifactIdToHalfSetId } from "@/data/gameResources";
import {
  resolveCharacterStats,
  resolveWeaponStats,
} from "@/data/gameStatsLoader";
import type { Build } from "@/data/types";

export interface CrBudgetInput {
  characterId: string;
  characterLevel: number;
  constellation: number;
  weaponId?: string;
  weaponRefinement?: number;
  artifact?: Pick<
    Build,
    "artifactSet" | "composition" | "halfSet1" | "halfSet2"
  >;
}

export interface CrBudgetResult {
  baseCr: number; // 0.05
  ascensionCr: number; // from character_stats.json
  characterBuffCr: number; // self CR from innate kit/constellation ceilings
  weaponSecondaryCr: number; // from weapon_stats.json
  weaponPassiveCr: number; // max CR from local weapon passive ceilings
  artifactSetCr: number; // max CR from local artifact set ceilings
  totalNonArtifactCr: number;
}

type ArtifactSetConfig = NonNullable<CrBudgetInput["artifact"]>;
type CharacterBuffEntry = {
  base?: number;
  constellations?: Array<{ min: number; cr: number }>;
};

const BASE_CR = 0.05;
const HALF_SET_CR_BUDGET: Record<string, number> = {
  "cr-12": 0.12,
};

const STATIC_ARTIFACT_SET_CR_BUDGET: Record<string, number> = {
  berserker: 0.24,
  blizzard_strayer: 0.4,
  marechaussee_hunter: 0.36,
  night_of_the_skys_unveiling: 0.3,
  resolution_of_sojourner: 0.3,
};

const STATIC_CHARACTER_CR_BUDGET: Record<string, CharacterBuffEntry> = {
  amber: { base: 0.1 },
  alhaitham: { constellations: [{ min: 6, cr: 0.1 }] },
  arlecchino: { constellations: [{ min: 6, cr: 0.1 }] },
  clorinde: { base: 0.2, constellations: [{ min: 6, cr: 0.1 }] },
  columbina: { base: 0.15 },
  dehya: { constellations: [{ min: 6, cr: 0.1 }] },
  freminet: { constellations: [{ min: 1, cr: 0.15 }] },
  gaming: { constellations: [{ min: 6, cr: 0.2 }] },
  ganyu: { base: 0.2 },
  hu_tao: { constellations: [{ min: 6, cr: 1 }] },
  kaeya: { constellations: [{ min: 1, cr: 0.15 }] },
  keqing: { base: 0.15 },
  nahida: { base: 0.24 },
  navia: { constellations: [{ min: 2, cr: 0.36 }] },
  nilou: { constellations: [{ min: 6, cr: 0.3 }] },
  razor: {
    constellations: [
      { min: 2, cr: 0.1 },
      { min: 6, cr: 0.1 },
    ],
  },
  rosaria: { base: 0.12 },
  sethos: { constellations: [{ min: 1, cr: 0.15 }] },
  shikanoin_heizou: { constellations: [{ min: 6, cr: 0.16 }] },
  sigewinne: { constellations: [{ min: 6, cr: 0.2 }] },
  tighnari: { constellations: [{ min: 1, cr: 0.15 }] },
  varesa: { constellations: [{ min: 6, cr: 0.1 }] },
  wriothesley: { constellations: [{ min: 6, cr: 0.1 }] },
  xianyun: { base: 0.1 },
  xinyan: { constellations: [{ min: 2, cr: 1 }] },
  yanfei: { constellations: [{ min: 2, cr: 0.2 }] },
};

const ROYAL_WEAPON_CR = [0.4, 0.5, 0.6, 0.7, 0.8];
const STATIC_WEAPON_CR_BUDGET: Record<string, number[]> = {
  calamity_of_eshu: [0.08, 0.1, 0.12, 0.14, 0.16],
  festering_desire: [0.06, 0.075, 0.09, 0.105, 0.12],
  fleuve_cendre_ferryman: [0.08, 0.1, 0.12, 0.14, 0.16],
  fruitful_hook: [0.16, 0.2, 0.24, 0.28, 0.32],
  harbinger_of_dawn: [0.14, 0.175, 0.21, 0.245, 0.28],
  light_of_foliar_incision: [0.04, 0.05, 0.06, 0.07, 0.08],
  reliquary_of_truth: [0.08, 0.1, 0.12, 0.14, 0.16],
  royal_bow: ROYAL_WEAPON_CR,
  royal_greatsword: ROYAL_WEAPON_CR,
  royal_grimoire: ROYAL_WEAPON_CR,
  royal_longsword: ROYAL_WEAPON_CR,
  royal_spear: ROYAL_WEAPON_CR,
  silvershower_heartstrings: [0.28, 0.35, 0.42, 0.49, 0.56],
  skyward_blade: [0.04, 0.05, 0.06, 0.07, 0.08],
  skyward_spine: [0.08, 0.1, 0.12, 0.14, 0.16],
  the_catch: [0.06, 0.075, 0.09, 0.105, 0.12],
  // Wolf-Fang has separate skill and burst CR stacks; use the larger single-hit
  // ceiling rather than adding mutually scoped formula buffs together.
  wolffang: [0.08, 0.1, 0.12, 0.14, 0.16],
};

function refinementValue(values: number[], refinement?: number): number {
  const index = Math.min(Math.max((refinement ?? 1) - 1, 0), values.length - 1);
  return values[index] ?? 0;
}

function getAscensionCr(input: CrBudgetInput): number {
  try {
    const charStats = resolveCharacterStats(
      input.characterId,
      input.characterLevel
    );
    for (const entry of charStats) {
      if (entry.key === "cr" && entry.value > BASE_CR) {
        return entry.value - BASE_CR;
      }
    }
  } catch {
    // Stats may not be loaded in tests or may be absent for unreleased data.
  }
  return 0;
}

function getWeaponSecondaryCr(input: CrBudgetInput): number {
  if (!input.weaponId) return 0;
  try {
    const weaponStats = resolveWeaponStats(input.weaponId);
    for (const entry of weaponStats) {
      if (entry.key === "cr") return entry.value;
    }
  } catch {
    // Weapon stats may not be loaded or the weapon may be unknown locally.
  }
  return 0;
}

function getHalfSetCr(halfSetIds: Array<string | undefined>): number {
  let cr = 0;
  const seen = new Set<string>();
  for (const halfSetId of halfSetIds) {
    if (!halfSetId || seen.has(halfSetId)) continue;
    seen.add(halfSetId);
    cr += HALF_SET_CR_BUDGET[halfSetId] ?? 0;
  }
  return cr;
}

function getStaticCharBuff(charId: string, constellation: number): number {
  const entry = STATIC_CHARACTER_CR_BUDGET[charId];
  if (!entry) return 0;
  return (
    (entry.base ?? 0) +
    (entry.constellations ?? []).reduce(
      (total, buff) => total + (constellation >= buff.min ? buff.cr : 0),
      0
    )
  );
}

function getStaticWeaponBuff(
  weaponId: string | undefined,
  refinement: number | undefined
): number {
  if (!weaponId) return 0;
  return refinementValue(STATIC_WEAPON_CR_BUDGET[weaponId] ?? [], refinement);
}

function getDynamicWeaponBuff(_input: CrBudgetInput): number {
  switch (_input.weaponId) {
    default:
      return 0;
  }
}

function getStaticArtifactBuff(
  artifactSetConfig: ArtifactSetConfig | undefined
): number {
  if (!artifactSetConfig) return 0;

  if (artifactSetConfig.composition === "2pc+2pc") {
    return getHalfSetCr([
      artifactSetConfig.halfSet1,
      artifactSetConfig.halfSet2,
    ]);
  }

  if (!artifactSetConfig.artifactSet) return 0;
  const halfSetCr = getHalfSetCr([
    artifactIdToHalfSetId[artifactSetConfig.artifactSet],
  ]);
  return (
    halfSetCr +
    (STATIC_ARTIFACT_SET_CR_BUDGET[artifactSetConfig.artifactSet] ?? 0)
  );
}

function getDynamicArtifactBuff(input: CrBudgetInput): number {
  const artifactSetId = input.artifact?.artifactSet;
  if (input.artifact?.composition !== "4pc" || !artifactSetId) return 0;

  switch (artifactSetId) {
    case "a_day_carved_from_rising_winds":
      return charInfo[input.characterId]?.faction === "Hexerei" ? 0.2 : 0;
    case "obsidian_codex":
      return charInfo[input.characterId]?.faction === "Nightsoul" ? 0.4 : 0;
    default:
      return 0;
  }
}

export function getCrBudget(input: CrBudgetInput): CrBudgetResult {
  const baseCr = BASE_CR;
  const ascensionCr = getAscensionCr(input);
  const characterBuffCr = getStaticCharBuff(
    input.characterId,
    input.constellation
  );
  const weaponSecondaryCr = getWeaponSecondaryCr(input);
  const weaponPassiveCr =
    getStaticWeaponBuff(input.weaponId, input.weaponRefinement) +
    getDynamicWeaponBuff(input);
  const artifactSetCr =
    getStaticArtifactBuff(input.artifact) + getDynamicArtifactBuff(input);

  return {
    baseCr,
    ascensionCr,
    characterBuffCr,
    weaponSecondaryCr,
    weaponPassiveCr,
    artifactSetCr,
    totalNonArtifactCr:
      baseCr +
      ascensionCr +
      characterBuffCr +
      weaponSecondaryCr +
      weaponPassiveCr +
      artifactSetCr,
  };
}
