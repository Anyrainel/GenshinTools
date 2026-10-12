import type { ParticleMode, Particles } from "./types";

// ─── Particle resolution ───

/** Resolve a Particles value to its (expected, max) pair.
 *
 * There is deliberately no "min": counting only rolls with chance >= 1 returns
 * 0 particles for e.g. Diona's hold-E, an outcome with probability ~0.03%. That
 * is not a planning number, so the product exposes Expected (a smooth run) and
 * Max (retry until the ideal roll) only. */
export function particleRange(p: Particles | undefined): {
  expected: number;
  max: number;
} {
  if (p == null) return { expected: 0, max: 0 };
  if (typeof p === "number") return { expected: p, max: p };
  let expected = 0;
  let max = 0;
  for (const [count, chance] of p) {
    expected += count * chance;
    max += count;
  }
  return { expected, max };
}

/** Pick a concrete particle count based on the RNG mode. */
export function resolveParticles(
  p: Particles | undefined,
  mode: ParticleMode
): number {
  const r = particleRange(p);
  return mode === "max" ? r.max : r.expected;
}
