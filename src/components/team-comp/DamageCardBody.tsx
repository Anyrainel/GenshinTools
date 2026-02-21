import type { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type { ArtifactData } from "@/data/types";
import type { DisplayResult, I18nLabel, StatKey } from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { useCallback, useState } from "react";
import { ArtifactSlotGrid } from "./ArtifactSlotGrid";
import { BuffLedger } from "./BuffLedger";
import { FormulaBreakdown } from "./FormulaBreakdown";
import { StatSheetPanel } from "./StatSheetPanel";

/**
 * Shared card body for both Card 2 (current) and Card 3 (optimized).
 * Shows: artifact grid → formula model → damage readout.
 */
export function DamageCardBody({
  team,
  hasFormula,
  emptyMessage,
  artifactsByChar,
  targetCharId,
  damageValue,
  displayResult,
  t,
}: {
  team: Team;
  hasFormula: boolean;
  emptyMessage: string;
  artifactsByChar: Record<string, Record<string, ArtifactData>>;
  targetCharId?: string;
  damageValue: number | null;
  displayResult?: DisplayResult | null;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const [highlightedStat, setHighlightedStat] = useState<{
    key: StatKey;
    charId: string;
  } | null>(null);

  return (
    <div className="space-y-4">
      {!hasFormula && (
        <div className="text-muted-foreground p-6 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10">
          {emptyMessage}
        </div>
      )}

      {/* Artifact grid & Stat Sheet Panel per character */}
      {hasFormula && (
        <StatSheetPanel
          result={displayResult}
          team={team}
          artifactsByChar={artifactsByChar}
          targetCharId={targetCharId || ""}
          highlightedStat={highlightedStat}
          onStatHover={setHighlightedStat}
          t={t}
        />
      )}

      {/* Formula equation */}
      {hasFormula && (
        <div className="p-3 border border-dashed border-border/20 rounded-lg bg-black/5 text-sm">
          <div className="flex flex-col items-center justify-center">
            {damageValue != null ? (
              <div className={cn("text-lg text-primary/70 font-medium")}>
                Total Expected Damage:{" "}
                <span className="text-foreground font-[math]">
                  {Math.round(damageValue).toLocaleString()}
                </span>
              </div>
            ) : (
              <div className="text-sm uppercase tracking-widest bg-primary/20 text-primary px-3 py-1 rounded font-mono font-bold">
                Pending
              </div>
            )}
          </div>
          {displayResult && targetCharId && (
            <FormulaBreakdown
              parts={displayResult.parts}
              highlightedStat={
                highlightedStat?.charId === targetCharId
                  ? highlightedStat?.key
                  : null
              }
              t={t}
            />
          )}
        </div>
      )}

      {/* Buff Ledger */}
      {hasFormula && displayResult && (
        <BuffLedger buffs={displayResult.buffs} team={team} t={t} />
      )}
    </div>
  );
}

/** Scrollable bookmark tab bar for formula selection. */
export function FormulaTabBar({
  formulas,
  selectedTab,
  onSelect,
  t,
}: {
  formulas: { charId: string; formulaId: string; label: I18nLabel }[];
  selectedTab: string;
  onSelect: (charId: string, formulaId: string) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const handleWheelScroll = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    },
    []
  );

  return (
    <div
      className="flex gap-1 px-1 overflow-x-auto scrollbar-none"
      onWheel={handleWheelScroll}
    >
      {formulas.map(({ charId, formulaId, label }) => {
        const val = `${charId}.${formulaId}`;
        const isActive = val === selectedTab;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onSelect(charId, formulaId)}
            className={cn(
              "flex items-center gap-2.5 px-4 py-2.5 rounded-t-lg text-sm font-semibold transition-all border border-b-0 whitespace-nowrap shrink-0",
              isActive
                ? "bg-gradient-select text-primary-foreground border-border/40 shadow-sm"
                : "bg-card/40 text-muted-foreground hover:text-foreground hover:bg-card/60 border-transparent"
            )}
          >
            <img
              src={getAssetUrl(charactersById[charId]?.imagePath)}
              alt={charId}
              className="w-6 h-6 object-contain rounded-full bg-secondary/40 shrink-0"
            />
            {t.resolveLabel(label)}
          </button>
        );
      })}
    </div>
  );
}
