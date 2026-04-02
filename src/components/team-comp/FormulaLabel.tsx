import { useLanguage } from "@/contexts/LanguageContext";
import type { TeamBuild } from "@/lib/team-comp/damageCalc";
import { offFieldStatus } from "@/lib/team-comp/damageCalc";
import type { I18nLabel } from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";

interface FormulaLabelProps {
  label: I18nLabel;
  minC: number;
  formulaId?: string;
  charId?: string;
  teamBuild?: TeamBuild | null;
  /** When true, mute the label text (constellation requirement not met). */
  isLocked?: boolean;
  className?: string;
  /** Current forceOnField state (read from ReactionOverride). */
  forceOnField?: boolean;
  /** Callback to toggle forceOnField. Only rendered when provided and formula has offField parts. */
  onForceOnFieldChange?: (forceOnField: boolean) => void;
}

/**
 * Shared formula label: minC badge → i18n label → off-field suffix.
 * Used in FormulaSelectorCard (single & combo modes) and AnalyzerComboTab.
 */
export function FormulaLabel({
  label,
  minC,
  formulaId,
  charId,
  teamBuild,
  isLocked,
  className,
  forceOnField: forceOnFieldProp,
  onForceOnFieldChange,
}: FormulaLabelProps) {
  const { t } = useLanguage();

  const offField =
    teamBuild && charId && formulaId
      ? offFieldStatus(teamBuild, charId, formulaId)
      : "none";

  return (
    <span className={cn("flex flex-wrap items-baseline gap-x-1", className)}>
      {minC > 0 && (
        <span
          className={cn(
            "text-[10px] font-semibold px-1 rounded shrink-0",
            isLocked
              ? "text-amber-400/50 bg-amber-400/10"
              : "text-amber-400 bg-amber-400/15"
          )}
        >
          {t.format("common.constellationFormat", minC)}
        </span>
      )}
      <span className={cn("truncate", isLocked && "text-muted-foreground")}>
        {t.resolveLabel(label)}
      </span>
      {offField !== "none" && (
        <span className="text-[0.85em] text-muted-foreground font-normal whitespace-nowrap">
          {t.ui(
            offField === "full"
              ? "common.offFieldSuffix"
              : "common.partialOffFieldSuffix"
          )}
        </span>
      )}
      {offField !== "none" && onForceOnFieldChange && (
        <label
          className="flex items-center gap-1 cursor-pointer ml-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={!!forceOnFieldProp}
            onChange={(e) => onForceOnFieldChange(e.target.checked)}
            className="accent-primary w-3 h-3"
          />
          <span className="text-[0.8em] text-muted-foreground font-normal whitespace-nowrap">
            {t.ui("common.forceOnField")}
          </span>
        </label>
      )}
    </span>
  );
}
