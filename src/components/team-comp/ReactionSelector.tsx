import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { ELEMENT_ELIGIBLE_REACTIONS } from "@/lib/team-comp/constants";
import type { TeamMeta } from "@/lib/team-comp/damageCalc";
import type { FormulaEntry } from "@/lib/team-comp/damageModels";
import type {
  ElementalOrPhysical,
  ReactionOverride,
  ReactionType,
} from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";

// ─── Constants ───

/** Transformative reactions — formulas using these have their own baked-in reaction
 *  and should not show the reaction selector. */
const TRANSFORMATIVE_REACTIONS = new Set<ReactionType>([
  "burning",
  "superconduct",
  "swirl",
  "electroCharged",
  "shatter",
  "overloaded",
  "bloom",
  "burgeon",
  "hyperbloom",
]);

/** Lunar reactions — same: baked-in, no selector. */
const LUNAR_REACTIONS = new Set<ReactionType>([
  "lunarCharged",
  "lunarBloom",
  "lunarCrystallize",
]);

// ─── Helpers ───

/** Circled number for part indices (①②③…). Falls back to (N) for > 20. */
function circledIndex(i: number): string {
  // Unicode circled digits ① = U+2460
  if (i >= 0 && i < 20) return String.fromCodePoint(0x2460 + i);
  return `(${i + 1})`;
}

/** Build a compact label from a formula part's scaling info: e.g. "230% ATK + 45% EM" */
function partLabel(
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

// ─── Props ───

interface ReactionSelectorProps {
  /** The formula entry (to read parts) */
  formulaEntry: FormulaEntry;
  /** Element of the formula's character */
  element: ElementalOrPhysical;
  /** Current reaction override state */
  reactionOverride: ReactionOverride;
  /** Callback when reaction override changes */
  onReactionChange: (override: ReactionOverride) => void;
  /** TeamMeta for checking if reactions are available */
  teamMeta: TeamMeta;
  /** Character ID for team validation */
  charId: string;
  /** Whether to show in compact/inline mode (for combo lines) */
  compact?: boolean;
}

// ─── Component ───

export function ReactionSelector({
  formulaEntry,
  element,
  reactionOverride,
  onReactionChange,
  teamMeta,
  charId,
  compact = false,
}: ReactionSelectorProps) {
  const { t } = useLanguage();

  // --- Early-exit conditions ---

  // Hide for Transform/Lunar formulas (baked-in reaction, not overridable).
  const firstPart = formulaEntry.parts[0];
  if (firstPart) {
    const baked = firstPart.formula.tag.reaction;
    if (TRANSFORMATIVE_REACTIONS.has(baked) || LUNAR_REACTIONS.has(baked)) {
      return null;
    }
  }

  // Get eligible reactions for this element.
  const eligible =
    ELEMENT_ELIGIBLE_REACTIONS[
      element as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
    ];

  // Hide for elements with only "none" (Anemo, Geo, Physical).
  if (!eligible || eligible.length <= 1) {
    return null;
  }

  // Hide if only "none" remains after filtering by team availability.
  const availableReactions = eligible.filter(
    (r) => r === "none" || teamMeta.hasReaction(r, charId)
  );
  if (availableReactions.every((r) => r === "none")) {
    return null;
  }

  const currentGate = reactionOverride.reaction ?? "none";

  // Show per-part controls when gate is active AND there are multiple parts
  const showPerPart =
    !compact && currentGate !== "none" && formulaEntry.parts.length > 1;

  // --- Handlers ---

  function handleGateChange(reaction: ReactionType) {
    if (reaction === currentGate) return;
    // When gate changes, reset per-part overrides.
    onReactionChange({
      reaction,
      partReactions: undefined,
      partHits: undefined,
    });
  }

  function handlePartToggle(partIndex: number, checked: boolean) {
    const newPartReactions = { ...reactionOverride.partReactions };
    const newPartHits = { ...reactionOverride.partHits };
    if (checked) {
      // Remove override → inherits gate (default = on)
      delete newPartReactions[partIndex];
    } else {
      // Explicitly disable this part
      newPartReactions[partIndex] = "none";
      delete newPartHits[partIndex];
    }
    onReactionChange({
      ...reactionOverride,
      partReactions:
        Object.keys(newPartReactions).length > 0 ? newPartReactions : undefined,
      partHits: Object.keys(newPartHits).length > 0 ? newPartHits : undefined,
    });
  }

  function handlePartHitsChange(partIndex: number, hits: number) {
    const totalHits = formulaEntry.parts[partIndex].hits ?? 1;
    const newPartHits = { ...reactionOverride.partHits };
    if (hits >= totalHits) {
      // All hits react → remove override (default)
      delete newPartHits[partIndex];
    } else {
      newPartHits[partIndex] = hits;
    }
    onReactionChange({
      ...reactionOverride,
      partHits: Object.keys(newPartHits).length > 0 ? newPartHits : undefined,
    });
  }

  /** Is this reaction available given the current team composition? */
  function isReactionAvailable(reaction: ReactionType): boolean {
    if (reaction === "none") return true;
    return teamMeta.hasReaction(reaction, charId);
  }

  // --- Render ---

  return (
    <div className={cn("flex flex-col", compact ? "gap-0.5" : "gap-1.5")}>
      {/* Gate pills: segmented control for selecting the reaction */}
      <div
        className={cn(
          "flex flex-wrap items-center",
          compact ? "gap-0.5" : "gap-1"
        )}
      >
        {eligible
          .filter((reaction) => isReactionAvailable(reaction))
          .map((reaction) => {
            const isActive = reaction === currentGate;

            return (
              <Button
                key={reaction}
                type="button"
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => handleGateChange(reaction)}
                className={cn(
                  "transition-colors",
                  compact
                    ? "h-6 px-2 text-[11px] rounded"
                    : "h-7 px-2.5 text-xs rounded-md",
                  isActive && "shadow-sm"
                )}
              >
                {t.reaction(reaction)}
              </Button>
            );
          })}
      </div>

      {/* Per-part controls: checkbox + label + hit count dropdown */}
      {showPerPart && (
        <div className="flex flex-col gap-1 pl-1 pt-0.5">
          {formulaEntry.parts.map((part, idx) => {
            const isChecked = reactionOverride.partReactions?.[idx] !== "none";
            const totalHits = part.hits ?? 1;
            const reactingHits = isChecked
              ? (reactionOverride.partHits?.[idx] ?? totalHits)
              : 0;

            return (
              <div key={idx} className="flex items-center gap-1.5">
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => handlePartToggle(idx, !isChecked)}
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                    isChecked
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

                {/* Circled index */}
                <span className="text-xs text-foreground/70 font-medium shrink-0">
                  {circledIndex(idx)}
                </span>

                {/* Ability type */}
                <span
                  className={cn(
                    "text-xs font-semibold shrink-0",
                    isChecked
                      ? "text-foreground/70"
                      : "text-muted-foreground/40"
                  )}
                >
                  {t.ability(part.formula.tag.ability)}:
                </span>

                {/* Scaling label */}
                <span
                  className={cn(
                    "text-xs font-mono tabular-nums truncate",
                    isChecked
                      ? "text-foreground/80"
                      : "text-muted-foreground/40"
                  )}
                >
                  {partLabel(part, t)}
                </span>

                {/* Hit count dropdown — only for multi-hit parts */}
                {totalHits > 1 && (
                  <>
                    <span className="text-muted-foreground/40 text-xs shrink-0">
                      ×
                    </span>
                    <Select
                      value={String(reactingHits)}
                      onValueChange={(val) =>
                        handlePartHitsChange(idx, Number(val))
                      }
                      disabled={!isChecked}
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
      )}
    </div>
  );
}
