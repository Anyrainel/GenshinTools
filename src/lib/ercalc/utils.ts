import type { ParticleMode, Particles } from "./types";

// ─── Particle resolution ───

/** Resolve a Particles value to its (min, expected, max) triple. */
export function particleRange(p: Particles | undefined): {
  min: number;
  expected: number;
  max: number;
} {
  if (p == null) return { min: 0, expected: 0, max: 0 };
  if (typeof p === "number") return { min: p, expected: p, max: p };
  let min = 0;
  let expected = 0;
  let max = 0;
  for (const [count, chance] of p) {
    if (chance >= 0.9999) min += count;
    expected += count * chance;
    max += count;
  }
  return { min, expected, max };
}

/** Pick a concrete particle count based on the RNG mode. */
export function resolveParticles(
  p: Particles | undefined,
  mode: ParticleMode
): number {
  const r = particleRange(p);
  return mode === "min" ? r.min : mode === "max" ? r.max : r.expected;
}
