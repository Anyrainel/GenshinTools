import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type { ArtifactData } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { DisplayResult, I18nLabel, StatKey } from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [formulaExpanded, setFormulaExpanded] = useState(true);
  const isMobile = useMediaQuery("(max-width: 767px)");

  return (
    <div className={cn(isMobile ? "space-y-2" : "space-y-4")}>
      {!hasFormula && (
        <div className="text-muted-foreground p-4 text-center text-sm border border-dashed border-border/30 rounded-lg bg-black/10">
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
        <Collapsible open={formulaExpanded} onOpenChange={setFormulaExpanded}>
          <div
            className={cn(
              "border border-dashed border-border/20 rounded-lg bg-black/5 text-sm",
              isMobile ? "p-1.5" : "p-2"
            )}
          >
            <div className="flex flex-col items-center justify-center">
              {damageValue != null ? (
                <CollapsibleTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-xl transition-colors cursor-pointer select-none",
                      isMobile ? "gap-1.5 px-2 py-1.5" : "gap-2.5 px-4 py-2",
                      "bg-primary/10 border border-primary/30 ring-1 ring-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.12)]",
                      "hover:bg-primary/15"
                    )}
                  >
                    <div
                      className={cn(
                        "text-primary/80 font-semibold tracking-wide whitespace-nowrap",
                        isMobile ? "text-xs" : "text-sm md:text-base"
                      )}
                    >
                      {t.ui("teamComp.totalExpectedDamage")}
                    </div>
                    <div
                      className={cn(
                        "text-foreground font-[math] font-black drop-shadow-sm",
                        isMobile ? "text-2xl" : "text-3xl md:text-4xl"
                      )}
                    >
                      {Math.round(damageValue).toLocaleString()}
                    </div>
                    <span
                      className={cn(
                        "text-muted-foreground/70 whitespace-nowrap",
                        isMobile ? "text-[10px] ml-0.5" : "text-xs ml-1.5"
                      )}
                    >
                      {formulaExpanded
                        ? t.ui("teamComp.collapseFormula")
                        : t.ui("teamComp.expandFormula")}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-muted-foreground/70 transition-transform shrink-0",
                        formulaExpanded && "rotate-180"
                      )}
                    />
                  </div>
                </CollapsibleTrigger>
              ) : (
                <div className="text-sm uppercase tracking-widest bg-primary/20 text-primary px-3 py-1 rounded font-mono font-bold">
                  {t.ui("teamComp.pending")}
                </div>
              )}
            </div>
            <CollapsibleContent>
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
            </CollapsibleContent>
          </div>
        </Collapsible>
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startScrollLeft = useRef(0);
  const dragged = useRef(false);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(
      Math.ceil(el.scrollLeft + el.clientWidth) < el.scrollWidth
    );
  }, []);

  useEffect(() => {
    // Access formulas to satisfy linter that it's a valid dependency
    // (We want to recalculate scroll bounds when tabs change)
    const _count = formulas.length;
    handleScroll();
    window.addEventListener("resize", handleScroll);
    return () => window.removeEventListener("resize", handleScroll);
  }, [formulas, handleScroll]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault(); // Prevents vertical page scroll
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragged.current = false;
    startX.current = e.pageX - (scrollRef.current?.offsetLeft || 0);
    startScrollLeft.current = scrollRef.current?.scrollLeft || 0;
  };

  const onMouseUp = () => {
    isDragging.current = false;
  };

  const onMouseLeave = () => {
    isDragging.current = false;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    if (Math.abs(walk) > 5) dragged.current = true;
    scrollRef.current.scrollLeft = startScrollLeft.current - walk;
  };

  const handleTabClick = (charId: string, formulaId: string) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    onSelect(charId, formulaId);
  };

  return (
    <div className="relative w-full">
      {canScrollLeft && (
        <div className="absolute top-0 bottom-0 left-0 w-8 bg-gradient-to-r from-card to-transparent pointer-events-none z-10" />
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onMouseMove={onMouseMove}
        className="flex gap-1 px-1 overflow-x-auto scrollbar-none cursor-grab active:cursor-grabbing touch-pan-x select-none"
      >
        {formulas.map(({ charId, formulaId, label }) => {
          const val = `${charId}.${formulaId}`;
          const isActive = val === selectedTab;
          return (
            <button
              key={val}
              type="button"
              onClick={() => handleTabClick(charId, formulaId)}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2.5 rounded-t-lg text-sm font-semibold transition-colors border border-b-0 whitespace-nowrap shrink-0 pointer-events-auto",
                isActive
                  ? "bg-gradient-select text-primary-foreground border-border/40 shadow-sm"
                  : "bg-card/40 text-muted-foreground hover:text-foreground hover:bg-card/60 border-transparent"
              )}
            >
              <img
                src={getAssetUrl(charactersById[charId]?.imagePath)}
                alt={charId}
                className="w-6 h-6 object-contain rounded-full bg-secondary/40 shrink-0 pointer-events-none"
              />
              <span className="pointer-events-none">
                {t.resolveLabel(label)}
              </span>
            </button>
          );
        })}
      </div>

      {canScrollRight && (
        <div className="absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-l from-card to-transparent pointer-events-none z-10" />
      )}
    </div>
  );
}
