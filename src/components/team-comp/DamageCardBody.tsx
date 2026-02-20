import type { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type { ArtifactData } from "@/data/types";
import type { I18nLabel } from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { useCallback } from "react";
import { ArtifactSlotGrid } from "./ArtifactSlotGrid";

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
  damageLabel,
  damageValue,
  damageColorCls,
  t,
}: {
  team: Team;
  hasFormula: boolean;
  emptyMessage: string;
  artifactsByChar: Record<string, Record<string, ArtifactData>>;
  targetCharId?: string;
  damageLabel: string;
  damageValue: number | null;
  damageColorCls: string;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <div className="space-y-4">
      {!hasFormula && (
        <div className="text-muted-foreground p-6 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10">
          {emptyMessage}
        </div>
      )}

      {/* Artifact grid per character */}
      {hasFormula && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {team.characters.map((cid) => {
            if (!cid) return null;
            const artifactsObj = artifactsByChar[cid] || {};
            const charIdx = team.characters.indexOf(cid);
            return (
              <ArtifactSlotGrid
                key={cid}
                charId={cid}
                artifactsObj={artifactsObj}
                isTarget={cid === targetCharId}
                goalConfig={charIdx >= 0 ? team.artifacts[charIdx] : undefined}
                t={t}
              />
            );
          })}
        </div>
      )}

      {/* Formula equation placeholder */}
      {hasFormula && (
        <div className="p-3 border border-dashed border-border/20 rounded-lg bg-black/5 text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-muted-foreground uppercase tracking-widest text-[10px]">
              Damage Model
            </span>
            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-mono">
              Pending
            </span>
          </div>
          <div className="flex justify-center items-center py-2 opacity-40 space-x-1.5 font-mono text-[11px]">
            <span className="bg-card px-1.5 py-0.5 rounded border border-border/20">
              Mult
            </span>
            <span>×</span>
            <span className="bg-card px-1.5 py-0.5 rounded border border-border/20">
              Base
            </span>
            <span>×</span>
            <span className="bg-card px-1.5 py-0.5 rounded border border-border/20">
              1+DMG%
            </span>
            <span>×</span>
            <span className="bg-card px-1.5 py-0.5 rounded border border-border/20">
              Crit
            </span>
            <span>…</span>
          </div>
        </div>
      )}

      {/* Damage readout */}
      {hasFormula && damageValue != null && (
        <div className="bg-black/15 border border-border/20 rounded-lg p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
              {damageLabel}
            </div>
            <div
              className={cn(
                "text-2xl md:text-3xl font-black tracking-tight",
                damageColorCls
              )}
            >
              {Math.round(damageValue).toLocaleString()}
            </div>
          </div>
        </div>
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
