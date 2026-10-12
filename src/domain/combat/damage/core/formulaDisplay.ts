import type { CritMode, DisplayPart } from "../types";

export function computeScalingDmg(p: DisplayPart): number {
  let dmg = 0;
  for (let i = 0; i < p.scalingKeys.length; i++) {
    const k = p.scalingKeys[i];
    dmg += (p.statValues[k] || 0) * (p.scalingMulti[i] || 0);
  }
  return dmg;
} /**
 * Compute critMode adjustment ratio for a formula given its display parts.
 * Returns 1 for expected mode or when parts are empty/zero-damage.
 */

export function formulaCritRatio(
  parts: DisplayPart[],
  critMode: CritMode
): number {
  if (critMode === "expected" || parts.length === 0) return 1;
  const expectedSum = parts.reduce((s, p) => s + p.damage * (p.hits ?? 1), 0);
  if (expectedSum <= 0) return 1;
  const adjustedSum = parts.reduce(
    (s, p) => s + adjustPartDamage(p, critMode) * (p.hits ?? 1),
    0
  );
  return adjustedSum / expectedSum;
} /**
 * Adjust a DisplayPart's damage for the selected critMode.
 * DisplayPart always stores expected damage; this derives crit/noCrit variants.
 */

export function adjustPartDamage(p: DisplayPart, critMode: CritMode): number {
  if (critMode === "expected") return p.damage;

  const cr =
    p.template === "transform"
      ? p.statValues.reactionCr || 0
      : p.statValues.cr || 0;
  const cd =
    p.template === "transform"
      ? p.statValues.reactionCd || 0
      : p.statValues.cd || 0;

  const expectedMult = 1 + Math.max(0, Math.min(cr, 1)) * cd;
  if (expectedMult <= 0) return 0;

  const targetMult = critMode === "crit" ? 1 + cd : 1;
  return (p.damage / expectedMult) * targetMult;
}
