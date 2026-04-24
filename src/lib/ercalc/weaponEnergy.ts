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
    },
  },
  // Prototype Starglitter: burst regenerates 4/4.5/5/5.5/6 per tick × 2 ticks
  {
    id: "prototype_starglitter",
    type: "Polearm",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [8, 9, 10, 11, 12],
      trigger: "burst",
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
    },
  },
  // Nocturne's Curtain Call: energy on Lunar reaction
  {
    id: "nocturnes_curtain_call",
    type: "Catalyst",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [8, 9, 10, 11, 12],
      trigger: "reaction",
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
  // Lumidouce Elegy: 8/9/10/11/12 energy after Burning/Dendro DMG on burning, 12s CD
  {
    id: "lumidouce_elegy",
    type: "Polearm",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [8, 9, 10, 11, 12],
      trigger: "reaction",
    },
  },
  // Flame-Forged Insight: 4/4.5/5/5.5/6 energy on certain reactions
  {
    id: "flame-forged_insight",
    type: "Claymore",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [4, 4.5, 5, 5.5, 6],
      trigger: "reaction",
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
  // Sacrificer's Staff: 6/7.5/9/10.5/12 energy on burst (similar mechanic)
  {
    id: "sacrificers_staff",
    type: "Polearm",
    energy: {
      effect: "flatEnergy",
      totalEnergy: [6, 7.5, 9, 10.5, 12],
      trigger: "burst",
    },
  },
];

const allWeapons = [...favoniusWeapons, ...otherWeapons];

export const weaponEnergyById: Record<string, WeaponEnergyEntry> =
  Object.fromEntries(allWeapons.map((w) => [w.id, w]));
