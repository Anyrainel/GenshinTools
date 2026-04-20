// Energy per elemental particle (before ER multiplier)
export const SAME_ELEMENT_PARTICLE = 3.0;
export const DIFF_ELEMENT_PARTICLE = 1.0;
export const CLEAR_PARTICLE = 2.0;

// Orbs give 3x particle energy
export const ORB_MULTIPLIER = 3.0;

// Off-field characters receive reduced energy from particles.
// Formula: 1.0 - 0.1 × partySize (matches gcsim pkg/core/player/character/energy.go)
// Key = party size, value = multiplier.
export const OFF_FIELD_MULTIPLIER: Record<number, number> = {
  1: 1.0,
  2: 0.8,
  3: 0.7,
  4: 0.6,
};

// Favonius weapons generate this many clear particles per proc
export const FAVONIUS_PARTICLES = 3;

// Enemy energy drop presets (clear particles per rotation)
export const ENEMY_PRESETS = {
  none: 0,
  low: 6,
  medium: 12,
  high: 24,
} as const;

export type EnemyPreset = keyof typeof ENEMY_PRESETS;
