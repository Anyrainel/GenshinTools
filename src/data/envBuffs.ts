import type { StatKey } from "@/lib/team-comp/types";

export type EnvBuffCategory = "food" | "enemy" | "status";

/**
 * A buff entry (food, enemy, or status) with stat bonuses.
 * Values use engine format: flat for hp/atk/def/em, fractional for %.
 * i18n names live in i18n-app.ts under the `envBuffs` key.
 */
export type EnvBuff = {
  id: string;
  category: EnvBuffCategory;
  stats: { key: StatKey; value: number }[];
  /** Optional image path for display (relative to public/). */
  imagePath?: string;
  /** Food slot: only one food per slot can be active. */
  foodSlot?: number;
};

/** Target mode per category: food/enemy are team-wide, status is per-character. */
export const ENV_BUFF_TARGET_MODE: Record<EnvBuffCategory, "team" | "perChar"> =
  {
    food: "team",
    enemy: "team",
    status: "perChar",
  };

/**
 * All supported environment buffs (food, enemy, status).
 * Food entries ordered by addition date (newest first).
 */
export const envBuffs: EnvBuff[] = [
  // ─── Food ───
  // Slot 1: ATK / CR / CD foods
  {
    id: "gateau_debord",
    category: "food",
    foodSlot: 1,
    imagePath: "/food/gateau_debord.png",
    stats: [
      { key: "atk", value: 384 },
      { key: "cr", value: 0.14 },
    ],
  },
  {
    id: "once_upon_mondstadt",
    category: "food",
    foodSlot: 1,
    imagePath: "/food/once_upon_mondstadt.webp",
    stats: [
      { key: "cr", value: 0.2 },
      { key: "cd", value: 0.2 },
    ],
  },
  {
    id: "gilded_hall",
    category: "food",
    foodSlot: 1,
    imagePath: "/food/gilded_hall.webp",
    stats: [
      { key: "atk", value: 372 },
      { key: "cd", value: 0.24 },
    ],
  },
  {
    id: "adeptus_temptation",
    category: "food",
    foodSlot: 1,
    imagePath: "/food/adeptus_temptation.webp",
    stats: [
      { key: "atk", value: 372 },
      { key: "cr", value: 0.12 },
    ],
  },
  // Slot 2: HP / DEF / ER foods
  {
    id: "flavor_of_spring",
    category: "food",
    foodSlot: 2,
    imagePath: "/food/flavor_of_spring.webp",
    stats: [{ key: "def", value: 282 }],
  },
  {
    id: "cheesy_crab_hotpot",
    category: "food",
    foodSlot: 2,
    imagePath: "/food/cheesy_crab_hotpot.webp",
    stats: [
      { key: "hp%", value: 0.3 },
      { key: "er", value: 0.2 },
    ],
  },
  // Slot 3: Elemental / Physical DMG foods
  {
    id: "strength_tonic",
    category: "food",
    foodSlot: 3,
    imagePath: "/food/strength_tonic.webp",
    stats: [
      { key: "phys%", value: 0.45 },
      { key: "cr", value: 0.1 },
    ],
  },
  {
    id: "forest_essential_oil",
    category: "food",
    foodSlot: 3,
    imagePath: "/food/forest_essential_oil.webp",
    stats: [{ key: "dendro%", value: 0.25 }],
  },
  {
    id: "unmoving_essential_oil",
    category: "food",
    foodSlot: 3,
    imagePath: "/food/unmoving_essential_oil.webp",
    stats: [{ key: "geo%", value: 0.25 }],
  },
  {
    id: "shocking_essential_oil",
    category: "food",
    foodSlot: 3,
    imagePath: "/food/shocking_essential_oil.webp",
    stats: [{ key: "electro%", value: 0.25 }],
  },
  {
    id: "gushing_essential_oil",
    category: "food",
    foodSlot: 3,
    imagePath: "/food/gushing_essential_oil.webp",
    stats: [{ key: "anemo%", value: 0.25 }],
  },
  {
    id: "frosting_essential_oil",
    category: "food",
    foodSlot: 3,
    imagePath: "/food/frosting_essential_oil.webp",
    stats: [{ key: "cryo%", value: 0.25 }],
  },
  {
    id: "streaming_essential_oil",
    category: "food",
    foodSlot: 3,
    imagePath: "/food/streaming_essential_oil.webp",
    stats: [{ key: "hydro%", value: 0.25 }],
  },
  {
    id: "flaming_essential_oil",
    category: "food",
    foodSlot: 3,
    imagePath: "/food/flaming_essential_oil.webp",
    stats: [{ key: "pyro%", value: 0.25 }],
  },

  // ─── Enemy ───
  {
    id: "env_ichcahuipilli",
    category: "enemy",
    imagePath: "/food/ichcahuipilli.png",
    stats: [{ key: "dmg%", value: 9.0 }],
  },
  {
    id: "env_radiant_moongecko_1",
    category: "enemy",
    imagePath: "/food/radiant_moongecko.png",
    stats: [
      { key: "dmg%", value: -0.5 },
      { key: "heal%", value: -0.4 },
      { key: "cr", value: -1.0 },
    ],
  },
  {
    id: "env_radiant_moongecko_2",
    category: "enemy",
    imagePath: "/food/radiant_moongecko.png",
    stats: [
      { key: "dmg%", value: 0.5 },
      { key: "cr", value: 0.15 },
    ],
  },

  // ─── Status ───
  {
    id: "status_theater",
    category: "status",
    imagePath: "/food/imaginarium_theater.webp",
    stats: [
      { key: "atk%", value: 0.2 },
      { key: "hp%", value: 0.2 },
      { key: "def%", value: 0.2 },
    ],
  },
  {
    id: "status_rift",
    category: "status",
    imagePath: "/food/stygian_onslaught.webp",
    stats: [
      { key: "atk%", value: 0.2 },
      { key: "hp%", value: 0.2 },
      { key: "def%", value: 0.2 },
    ],
  },
];

export const envBuffsById: Record<string, EnvBuff> = Object.fromEntries(
  envBuffs.map((b) => [b.id, b])
);
