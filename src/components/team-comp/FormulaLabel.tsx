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
  /** When true, skip the off-field suffix (e.g. for locked formulas). */
  hideOffField?: boolean;
  className?: string;
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
  hideOffField,
  className,
}: FormulaLabelProps) {
  const { t } = useLanguage();

  const offField =
    !hideOffField && teamBuild && charId && formulaId
      ? offFieldStatus(teamBuild, charId, formulaId)
      : "none";

  return (
    <span className={cn("flex flex-wrap items-baseline gap-x-1", className)}>
      {minC > 0 && (
        <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/15 px-1 rounded shrink-0">
          {t.format("common.constellationFormat", minC)}
        </span>
      )}
      <span className="truncate">{t.resolveLabel(label)}</span>
      {offField !== "none" && (
        <span className="text-[0.85em] text-muted-foreground font-normal whitespace-nowrap">
          {t.ui(
            offField === "full"
              ? "common.offFieldSuffix"
              : "common.partialOffFieldSuffix"
          )}
        </span>
      )}
    </span>
  );
}
