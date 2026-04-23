import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ReactionType } from "@/data/enums";
import {
  ELEMENT_ELIGIBLE_REACTIONS,
  MULTI_ELEMENT_CHARS,
} from "@/lib/dmgcalc/constants";
import type { FormulaEntry, ReactionOverride } from "@/lib/dmgcalc/types";
import { cn } from "@/lib/utils";

/** Build a compact label from a formula part's scaling info: e.g. "230% ATK + 45% EM" */
export function partLabel(
  part: FormulaEntry["parts"][number],
  t: ReturnType<typeof useLanguage>["t"]
): string {
  const f = part.formula;
  const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
  let label = `${pct(f.talentMultiplier)} ${t.statShort(f.scalingKey)}`;
  if (f.extraTerm) {
    label += ` + ${pct(f.extraTerm.multiplier)} ${t.statShort(f.extraTerm.key)}`;
  }
  return label;
}

export interface ReactionPartControlsProps {
  /** The formula entry (to read parts). */
  formulaEntry: FormulaEntry;
  /** Character ID (used for multi-element detection). */
  charId: string;
  /** The gate reaction type (e.g. "melt", "vaporize"). */
  reactionType: ReactionType;
  /** Current reaction override state. */
  reactionOverride: ReactionOverride;
  /** Callback when per-part config changes. */
  onReactionChange: (override: ReactionOverride) => void;
  /** Disable all interaction (read-only preview). */
  disabled?: boolean;
}

/**
 * Per-part reaction controls: checkbox + ability label + hit count dropdown.
 * Shared between ReactionSelector, FormulaSelectorCard, and AnalyzerComboTab.
 */
export function ReactionPartControls({
  formulaEntry,
  charId,
  reactionType,
  reactionOverride,
  onReactionChange,
  disabled = false,
}: ReactionPartControlsProps) {
  const { t } = useLanguage();

  const isMultiElement = MULTI_ELEMENT_CHARS.has(charId);
  const singlePart = formulaEntry.parts.length <= 1;
  const mixedElements =
    formulaEntry.parts.length > 1 &&
    !formulaEntry.parts.every(
      (p) => p.formula.tag.element === formulaEntry.parts[0].formula.tag.element
    );

  function handlePartToggle(partIndex: number, checked: boolean) {
    const newPartReactions = { ...reactionOverride.rxnParts };
    const newPartHits = { ...reactionOverride.rxnPartHits };
    if (checked) {
      delete newPartReactions[partIndex];
    } else {
      newPartReactions[partIndex] = "none";
      delete newPartHits[partIndex];
    }
    onReactionChange({
      ...reactionOverride,
      rxnParts:
        Object.keys(newPartReactions).length > 0 ? newPartReactions : undefined,
      rxnPartHits:
        Object.keys(newPartHits).length > 0 ? newPartHits : undefined,
    });
  }

  function handlePartHitsChange(partIndex: number, hits: number) {
    const totalHits = formulaEntry.parts[partIndex].hits ?? 1;
    const newPartHits = { ...reactionOverride.rxnPartHits };
    if (hits >= totalHits) {
      delete newPartHits[partIndex];
    } else {
      newPartHits[partIndex] = hits;
    }
    onReactionChange({
      ...reactionOverride,
      rxnPartHits:
        Object.keys(newPartHits).length > 0 ? newPartHits : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-1 pt-0.5">
      {formulaEntry.parts.map((part, idx) => {
        const partCanReact = isMultiElement
          ? (
              ELEMENT_ELIGIBLE_REACTIONS[
                part.formula.tag
                  .element as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
              ] ?? []
            ).includes(reactionType)
          : true;
        const isChecked =
          partCanReact && reactionOverride.rxnParts?.[idx] !== "none";
        const totalHits = part.hits ?? 1;
        const reactingHits = isChecked
          ? (reactionOverride.rxnPartHits?.[idx] ?? totalHits)
          : 0;

        return (
          <div key={idx} className="flex flex-wrap items-center gap-1.5">
            {/* Checkbox — hidden for single-part formulas */}
            {!singlePart && (
              <button
                type="button"
                onClick={() => handlePartToggle(idx, !isChecked)}
                disabled={disabled || !partCanReact}
                className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                  !partCanReact
                    ? "border-border/60 bg-background opacity-30 cursor-not-allowed"
                    : isChecked
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border/60 bg-background hover:border-border"
                )}
              >
                {isChecked && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 5L4 7L8 3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            )}

            {/* Ability type + scaling label */}
            <span
              className={cn(
                "text-xs shrink-0",
                isChecked ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <span className="font-semibold">
                {mixedElements && `${t.element(part.formula.tag.element)} `}
                {t.ability(part.formula.tag.ability)}:
              </span>{" "}
              <span className="font-mono tabular-nums">
                {partLabel(part, t)}
              </span>
            </span>

            {/* Hit count dropdown — only for multi-hit parts */}
            {totalHits > 1 && (
              <>
                <span
                  className={cn(
                    "text-xs shrink-0",
                    isChecked ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  ×
                </span>
                <Select
                  value={String(reactingHits)}
                  onValueChange={(val) =>
                    handlePartHitsChange(idx, Number(val))
                  }
                  disabled={disabled || !isChecked}
                >
                  <SelectTrigger
                    className={cn(
                      "h-5 w-12 px-1.5 text-[11px] rounded border-border/30 bg-background/50 shrink-0",
                      !isChecked && "opacity-40"
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: totalHits }, (_, i) => i + 1).map(
                      (n) => (
                        <SelectItem
                          key={n}
                          value={String(n)}
                          className="text-xs"
                        >
                          {n}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
