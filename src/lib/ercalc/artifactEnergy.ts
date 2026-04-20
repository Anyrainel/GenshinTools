export interface ArtifactEnergyEffect {
  id: string;
  /** Which action triggers the effect */
  trigger: "burst" | "particleGain";
  /** Flat energy per proc (not affected by ER%) */
  flatEnergy: number;
  /** Who receives the energy */
  target: "partyOthers" | "bowCatalystParty";
  /** Cooldown in seconds (0 = no cooldown beyond trigger) */
  cooldown: number;
  /** Number of procs per trigger (e.g. Exile ticks 3 times) */
  procs: number;
}

const artifactEffects: ArtifactEnergyEffect[] = [
  // The Exile 4pc: burst regenerates 2 energy to other party members
  // every 2s for 6s (3 ticks = 6 total)
  {
    id: "the_exile",
    trigger: "burst",
    flatEnergy: 6,
    target: "partyOthers",
    cooldown: 0,
    procs: 3,
  },
  // Scholar 4pc: gaining particles/orbs gives 3 flat energy to
  // Bow/Catalyst party members. 3s cooldown.
  {
    id: "scholar",
    trigger: "particleGain",
    flatEnergy: 3,
    target: "bowCatalystParty",
    cooldown: 3,
    procs: 1,
  },
];

export const artifactEnergyById: Record<string, ArtifactEnergyEffect> =
  Object.fromEntries(artifactEffects.map((a) => [a.id, a]));
