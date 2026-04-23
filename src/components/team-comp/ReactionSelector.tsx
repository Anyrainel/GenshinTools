import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ElementalOrPhysical, ReactionType } from "@/data/enums";
import {
  ELEMENT_ELIGIBLE_REACTIONS,
  LUNAR_REACTIONS,
  MULTI_ELEMENT_CHARS,
} from "@/lib/dmgcalc/constants";
import type { TeamMeta } from "@/lib/dmgcalc/core/teamMeta";
import type { FormulaEntry, ReactionOverride } from "@/lib/dmgcalc/types";
import { cn } from "@/lib/utils";
import { ReactionPartControls } from "./ReactionPartControls";

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
const LUNAR_REACTIONS_SET = new Set<ReactionType>(LUNAR_REACTIONS);

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
  /** Hide the gate pills and only show per-part controls (for combo accordion) */
  hideGate?: boolean;
  /** When true, show controls but disable all interaction (read-only preview). */
  disabled?: boolean;
}

export function ReactionSelector({
  formulaEntry,
  element,
  reactionOverride,
  onReactionChange,
  teamMeta,
  charId,
  compact = false,
  hideGate = false,
  disabled = false,
}: ReactionSelectorProps) {
  const { t } = useLanguage();

  // --- Early-exit conditions ---

  // Hide for Transform/Lunar formulas (baked-in reaction, not overridable).
  const firstPart = formulaEntry.parts[0];
  if (firstPart) {
    const baked = firstPart.formula.tag.reaction;
    if (TRANSFORMATIVE_REACTIONS.has(baked) || LUNAR_REACTIONS_SET.has(baked)) {
      return null;
    }
  }

  // For multi-element characters (Chasca, Varka), derive eligible reactions
  // from the formula parts' actual elements instead of the character's element.
  const isMultiElement = MULTI_ELEMENT_CHARS.has(charId);
  const eligible = isMultiElement
    ? (() => {
        const rxSet = new Set<ReactionType>(["none"]);
        for (const part of formulaEntry.parts) {
          const partEl = part.formula.tag.element;
          const partEligible =
            ELEMENT_ELIGIBLE_REACTIONS[
              partEl as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
            ];
          if (partEligible) for (const rx of partEligible) rxSet.add(rx);
        }
        return Array.from(rxSet);
      })()
    : ELEMENT_ELIGIBLE_REACTIONS[
        element as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
      ];

  // Hide for elements with only "none" (Anemo, Geo, Physical).
  if (!eligible || eligible.length <= 1) {
    return null;
  }

  // Hide if only "none" remains after filtering by team availability.
  const availableReactions = eligible.filter(
    (r) =>
      r === "none" ||
      teamMeta.hasReaction(r, isMultiElement ? undefined : charId)
  );
  if (availableReactions.every((r) => r === "none")) {
    return null;
  }

  const currentGate = reactionOverride.reaction ?? "none";

  // Show per-part controls when gate is active.
  // In hideGate mode (combo accordion), always show even for single-part formulas.
  const showPerPart =
    !compact &&
    currentGate !== "none" &&
    (hideGate || formulaEntry.parts.length > 1);

  // --- Handlers ---

  function handleGateChange(reaction: ReactionType) {
    if (reaction === currentGate) return;
    // When gate changes, reset per-part overrides.
    onReactionChange({
      reaction,
      rxnParts: undefined,
      rxnPartHits: undefined,
    });
  }

  /** Is this reaction available given the current team composition? */
  function isReactionAvailable(reaction: ReactionType): boolean {
    if (reaction === "none") return true;
    return teamMeta.hasReaction(reaction, isMultiElement ? undefined : charId);
  }

  // --- Render ---

  return (
    <div className={cn("flex flex-col", compact ? "gap-0.5" : "gap-1.5")}>
      {/* Gate pills: segmented control for selecting the reaction */}
      {!hideGate && (
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
                  disabled={disabled}
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
      )}

      {/* Per-part controls */}
      {showPerPart && (
        <ReactionPartControls
          formulaEntry={formulaEntry}
          charId={charId}
          reactionType={currentGate}
          reactionOverride={reactionOverride}
          onReactionChange={onReactionChange}
          disabled={disabled}
        />
      )}
    </div>
  );
}
