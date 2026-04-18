import type { useLanguage } from "@/contexts/LanguageContext";
import { isPctStat } from "@/data/constants";
import type { DisplayPart, FormulaTemplate, StatKey } from "./types";

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

const TEMPLATE_KEYS: Record<FormulaTemplate, string> = {
  direct: "DirectDamage",
  amplify: "AmplifyingReaction",
  catalyze: "AdditiveReaction",
  transform: "TransformativeReaction",
  lunar: "LunarReaction",
  lunarDirect: "LunarDirect",
};

export function getTemplateName(
  p: DisplayPart,
  t: ReturnType<typeof useLanguage>["t"]
) {
  const abilityPrefix = p.tag?.ability ? `${t.ability(p.tag.ability)}: ` : "";
  const elName = p.tag?.element ? `${t.element(p.tag.element)} ` : "";
  if (p.template === "direct")
    return abilityPrefix + elName + t.formula("DirectDamage");
  if (p.tag?.reaction && p.tag.reaction !== "none") {
    const rxn = t.reaction(p.tag.reaction);
    if (p.template === "lunarDirect")
      return abilityPrefix + elName + rxn + t.formula("DirectSuffix");
    return abilityPrefix + elName + rxn + t.formula("ReactionSuffix");
  }
  return abilityPrefix + elName + t.formula(TEMPLATE_KEYS[p.template]);
}
function formatStatValue(key: StatKey, value: number): string {
  if (isPctStat(key)) {
    const display = value * 100;
    return `${display % 1 === 0 ? display.toFixed(0) : display.toFixed(1)}%`;
  }
  return String(Math.round(value));
}
export function formatBuffStats(
  stats: { key: StatKey; value: number }[],
  t: { statShort: (key: string) => string }
): string {
  return stats
    .map(
      (s) =>
        `${t.statShort(s.key)} ${s.value >= 0 ? "+" : ""}${formatStatValue(s.key as StatKey, s.value)}`
    )
    .join(", ");
}
