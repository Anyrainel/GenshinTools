import { isPctStat } from "@/data/constants";

/**
 * Format a stat value for display.
 * @param pct — true when value is already in human-readable percent (e.g. 5.2 for 5.2%).
 *              false (default) when value is in decimal form (e.g. 0.052 for 5.2%).
 */
export function fmtStat(
  key: string,
  value: number,
  forceSign = false,
  pct = false
): string {
  if (value === 0) return "0";
  const sign = forceSign && value > 0 ? "+" : "";

  if (isPctStat(key)) {
    const display = pct ? value.toFixed(1) : (value * 100).toFixed(1);
    return `${sign}${display}%`;
  }
  return `${sign}${Math.round(value).toLocaleString()}`;
}

export function fmtMult(value: number): string {
  return `×${value.toFixed(3)}`;
}

export function fmtPercent(value: number, forceSign = false): string {
  if (value === 0) return "0%";
  const sign = forceSign && value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export function fmtDamage(value: number | null | undefined): string {
  if (value == null) return "0";
  return Math.round(value).toLocaleString();
}
