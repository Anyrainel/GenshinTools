import type { WeaponType } from "@/data/enums";

export type WeaponEnergyEffect =
  | {
      /** Generates clear particles on proc. User attaches procs to individual
       *  E/Q nodes on the timeline via the `favoniusProc` flag. */
      effect: "particles";
      particleCount: number;
      /** Cooldown in seconds per refinement [R1..R5] (for documentation / UI hints). */
      cooldown: [number, number, number, number, number];
      /** Default proc count to auto-attach to E/Q nodes per refinement [R1..R5].
       *  Rough estimate assuming ~15s rotation with continuous damage uptime.
       *  Users adjust per-node via popover. */
      defaultProcsByRefinement: [number, number, number, number, number];
    }
  | {
      /** Grants flat energy (not affected by ER%) */
      effect: "flatEnergy";
      /** Amount per event (per trigger fire); for burst/skill/heal/reaction
       *  this is typically the rotation-total for a single trigger, for
       *  `partyPlunge` it's the per-plunge-hit amount. */
      totalEnergy: [number, number, number, number, number];
      /** Which action triggers the effect */
      trigger:
        | "burst" // Elemental Burst (wearer)
        | "skill" // Elemental Skill (wearer)
        | "heal" // Wearer is a healer (approximated: fires at wearer's Q)
        | "reaction" // Wearer participates in a reaction (fires at wearer's Q)
        | "partyPlunge"; // Per plunge (NA/CA/PA gated to plunge) by any team member
      /** Cooldown in seconds (optional) */
      cooldown?: number;
      /** For `trigger: "reaction"` weapons — which reaction the wearer must
       *  participate in. Rendered in the timeline node popover so users
       *  know when to enable the toggle. */
      reactionCondition?: {
        /** Canonical reaction name used in-game. Keep human-readable so the
         *  UI can just surface it directly. Examples: "Lunar-Charged",
         *  "Burning", "Burning / Burgeon / Vaporize / Melt". */
        en: string;
        zh: string;
      };
    };

export interface WeaponEnergyEntry {
  id: string;
  type: WeaponType;
  energy: WeaponEnergyEffect;
}

// Favonius: 3 clear particles on CRIT. CD by refinement 12/10.5/9/7.5/6s.
// Typical 15-20s rotation with continuous-damage wielder → 1-3 procs.
const favoniusEnergy: WeaponEnergyEffect = {
  effect: "particles",
  particleCount: 3,
  cooldown: [12, 10.5, 9, 7.5, 6],
  defaultProcsByRefinement: [1, 1, 2, 2, 3],
};

const favoniusWeapons: WeaponEnergyEntry[] = [
  { id: "favonius_sword", type: "Sword", energy: favoniusEnergy },
  { id: "favonius_lance", type: "Polearm", energy: favoniusEnergy },
  {
    id: "favonius_greatsword",
    type: "Claymore",
    energy: favoniusEnergy,
  },
  { id: "favonius_warbow", type: "Bow", energy: favoniusEnergy },
  { id: "favonius_codex", type: "Catalyst", energy: favoniusEnergy },
];

const otherWeapons: WeaponEnergyEntry[] = [
  // Prototype Amber: 4/4.5/5/5.5/6 energy every 2s for 6s on burst
  // = 3 ticks = 12/13.5/15/16.5/18 total
  {
    id: "prototype_amber",
    type: "Catalyst",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [12, 13.5, 15, 16.5, 18],
      trigger: "burst",
    },
  },
  // Amenoma Kageuchi: E creates Succession Seed (max 3).
  // Burst consumes all seeds, each restoring 6/7.5/9/10.5/12 energy.
  // Max 3 seeds = 18/22.5/27/31.5/36 total.
  // Listed as per-seed value x3 for max.
  {
    id: "amenoma_kageuchi",
    type: "Sword",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [18, 22.5, 27, 31.5, 36],
      trigger: "burst",
    },
  },
  // Kitain Cross Spear: E hit loses 3, restores 3/3.5/4/4.5/5 every
  // 2s for 6s (3 ticks). Net = +6/+7.5/+9/+10.5/+12
  {
    id: "kitain_cross_spear",
    type: "Polearm",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [6, 7.5, 9, 10.5, 12],
      trigger: "skill",
      cooldown: 10,
    },
  },
  // Katsuragikiri Nagamasa: same mechanic as Kitain
  {
    id: "katsuragikiri_nagamasa",
    type: "Claymore",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [6, 7.5, 9, 10.5, 12],
      trigger: "skill",
      cooldown: 10,
    },
  },
  // Bloodsoaked Ruins: 12/13/14/15/16 energy after triggering Lunar-Charged, 14s CD
  {
    id: "bloodsoaked_ruins",
    type: "Polearm",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [12, 13, 14, 15, 16],
      trigger: "reaction",
      reactionCondition: { en: "Lunar-Charged", zh: "月感电" },
      cooldown: 14,
    },
  },
  // Crane's Echoing Call: 2.5/2.75/3/3.25/3.5 energy per party plunge hit, 0.7s CD.
  // Per-hit value — fires at every party plunge action in the timeline.
  {
    id: "cranes_echoing_call",
    type: "Catalyst",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [2.5, 2.75, 3, 3.25, 3.5],
      trigger: "partyPlunge",
      cooldown: 0.7,
    },
  },
  // Nocturne's Curtain Call: 14/15/16/17/18 energy when wearer triggers or
  // deals DMG via any Lunar reaction. No explicit CD listed on tooltip (paired
  // with the 12s HP-max/Lunar-DMG buff window).
  {
    id: "nocturnes_curtain_call",
    type: "Catalyst",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [14, 15, 16, 17, 18],
      trigger: "reaction",
      reactionCondition: {
        en: "any Lunar reaction",
        zh: "任意月曜反应",
      },
    },
  },
  // Jadefall's Splendor: 4.5/5/5.5/6/6.5 energy every 2.5s for 3s after burst/shield
  // = 2 ticks = 9/10/11/12/13 total
  {
    id: "jadefalls_splendor",
    type: "Catalyst",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [9, 10, 11, 12, 13],
      trigger: "burst",
    },
  },
  // Dialogues of the Desert Sages: 8/9/10/11/12 energy when healed, 10s CD
  {
    id: "dialogues_of_the_desert_sages",
    type: "Polearm",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [8, 9, 10, 11, 12],
      trigger: "heal",
      cooldown: 10,
    },
  },
  // Rightful Reward: 8/9/10/11/12 energy when healed, 10s CD
  {
    id: "rightful_reward",
    type: "Polearm",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [8, 9, 10, 11, 12],
      trigger: "heal",
      cooldown: 10,
    },
  },
  // Fleuve Cendre Ferryman: 16/20/24/28/32% ER for 5s after E (stat buff, not flat energy)
  // Everlasting Moonglow: 0.6 per NA hit for 12s after burst. ~10 NAs = 6 energy
  {
    id: "everlasting_moonglow",
    type: "Catalyst",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [6, 6, 6, 6, 6], // fixed amount regardless of refinement
      trigger: "burst",
    },
  },
  // Oathsworn Eye: 24/30/36/42/48% ER for 10s after E (stat buff, not flat energy)
  // Lumidouce Elegy: 12/13/14/15/16 energy on reaching 2 stacks (Dendro DMG
  // on Burning enemies) or refreshing at 2. 12s CD.
  {
    id: "lumidouce_elegy",
    type: "Polearm",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [12, 13, 14, 15, 16],
      trigger: "reaction",
      reactionCondition: { en: "Burning", zh: "燃烧" },
      cooldown: 12,
    },
  },
  // Flame-Forged Insight: 12/15/18/21/24 energy on Electro-Charged / Lunar-
  // Charged / Bloom / Lunar-Bloom / Crystallize / Lunar-Crystallize. 15s CD.
  {
    id: "flameforged_insight",
    type: "Claymore",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [12, 15, 18, 21, 24],
      trigger: "reaction",
      reactionCondition: {
        en: "Electro-Charged / Lunar-Charged / Bloom / Lunar-Bloom / Crystallize / Lunar-Crystallize",
        zh: "感电 / 月感电 / 绽放 / 月绽放 / 结晶 / 月结晶",
      },
      cooldown: 15,
    },
  },
  // Portable Power Saw: 6/7.5/9/10.5/12 energy from Stoic Symbols on burst (max 3 symbols)
  {
    id: "portable_power_saw",
    type: "Claymore",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [6, 7.5, 9, 10.5, 12],
      trigger: "burst",
    },
  },
  // The Dockhand's Assistant: same as Portable Power Saw
  {
    id: "the_dockhands_assistant",
    type: "Sword",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [6, 7.5, 9, 10.5, 12],
      trigger: "burst",
    },
  },
  // Tome of the Eternal Flow: 8/9/10/11/12 energy when reaching or refreshing
  // 3 stacks of the HP-change Charged Attack buff. 12s CD. In practice fires
  // ~once per Neuvillette burst window, so we anchor to burst.
  {
    id: "tome_of_the_eternal_flow",
    type: "Catalyst",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [8, 9, 10, 11, 12],
      trigger: "burst",
    },
  },
  // Seven Edicts of Dust and Light: 14/15/16/17/18 energy when wearer creates
  // a shield. 14s CD. Most shielders generate shields from their skill (Zhongli
  // hold-E, Baizhu E, Layla E, etc.), so we anchor to skill.
  {
    id: "seven_edicts_of_dust_and_light",
    type: "Catalyst",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [14, 15, 16, 17, 18],
      trigger: "skill",
      cooldown: 14,
    },
  },
];

const allWeapons = [...favoniusWeapons, ...otherWeapons];

export const weaponEnergyById: Record<string, WeaponEnergyEntry> =
  Object.fromEntries(allWeapons.map((w) => [w.id, w]));
