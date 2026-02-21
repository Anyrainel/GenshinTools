export function fmtStat(key: string, value: number, forceSign = false): string {
  if (value === 0) return "0";
  const isPercent =
    key.endsWith("%") ||
    ["cr", "cd", "er", "reactionCr", "reactionCd"].includes(key);

  const sign = forceSign && value > 0 ? "+" : "";

  if (isPercent) {
    return `${sign}${(value * 100).toFixed(1)}%`;
  }
  return `${sign}${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
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
