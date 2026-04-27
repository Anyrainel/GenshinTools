import { ChevronDown, ChevronRight } from "lucide-react";
import { DebouncedNumberInput } from "@/components/shared/DebouncedInput";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Tier } from "@/data/enums";
import type {
  ResourceKind,
  ResourceSuggestion,
} from "@/lib/account-data/resourceTips";
import { cn } from "@/lib/utils";
import { ResourceSuggestionCard } from "./ResourceSuggestionCard";

export function ResourceTierSection({
  tier,
  tierLabel,
  suggestions,
  collapsed,
  onToggleCollapsed,
  editable,
  threshold,
  minScoreCraft,
  minScoreReroll,
  minScoreLevelup,
  showCraft,
  showReroll,
  showLevelup,
  onChangeThreshold,
  onChangeMinScore,
  globalConfigHash,
}: {
  tier: Tier;
  tierLabel: string;
  suggestions: ResourceSuggestion[];
  globalConfigHash: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  editable: boolean;
  threshold?: number;
  minScoreCraft?: number;
  minScoreReroll?: number;
  minScoreLevelup?: number;
  showCraft: boolean;
  showReroll: boolean;
  showLevelup: boolean;
  onChangeThreshold?: (v: number) => void;
  onChangeMinScore?: (kind: ResourceKind, v: number) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="border border-border/50 rounded-lg bg-gradient-card">
      {/* biome-ignore lint/a11y/useSemanticElements: div with role=button avoids nested interactive elements (inputs inside) */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleCollapsed}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleCollapsed();
          }
        }}
        className="flex items-center gap-2 flex-wrap px-3 py-2 cursor-pointer select-none hover:bg-white/5 rounded-t-lg"
      >
        <span className="flex items-center gap-1 text-base font-bold tracking-wide text-foreground">
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
          {tierLabel}
          <span className="text-sm text-foreground/80 ml-1">
            ({suggestions.length})
          </span>
        </span>
        {editable ? (
          <div
            className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-foreground/80"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-1 ml-2 md:ml-4">
              {t.ui("evaluation.tierThresholds")}
              <TierNumberCell
                value={Math.round((threshold ?? 0) * 100)}
                max={100}
                ariaLabel={`Tier ${tier} completeness threshold (%)`}
                onChange={(v) => onChangeThreshold?.(v / 100)}
              />
              %
            </span>
            <span className="flex items-center gap-1.5 ml-2 md:ml-4">
              {t.ui("evaluation.minScoreDiff")}
              <span
                className={cn(
                  "inline-flex items-center gap-0.5",
                  !showLevelup && "opacity-40 pointer-events-none"
                )}
              >
                <span className="text-xs text-sky-400">
                  {t.ui("evaluation.suggestLevelup")}
                </span>
                <TierNumberCell
                  value={minScoreLevelup ?? 0}
                  min={-100}
                  max={100}
                  ariaLabel={`Tier ${tier} levelup min score gain`}
                  onChange={(v) => onChangeMinScore?.("levelup", v)}
                />
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5",
                  !showCraft && "opacity-40 pointer-events-none"
                )}
              >
                <span className="text-xs text-violet-400">
                  {t.ui("evaluation.suggestCraft")}
                </span>
                <TierNumberCell
                  value={minScoreCraft ?? 0}
                  min={-100}
                  max={100}
                  ariaLabel={`Tier ${tier} craft min score gain`}
                  onChange={(v) => onChangeMinScore?.("craft", v)}
                />
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5",
                  !showReroll && "opacity-40 pointer-events-none"
                )}
              >
                <span className="text-xs text-amber-400">
                  {t.ui("evaluation.suggestReroll")}
                </span>
                <TierNumberCell
                  value={minScoreReroll ?? 0}
                  min={-100}
                  max={100}
                  ariaLabel={`Tier ${tier} reroll min score gain`}
                  onChange={(v) => onChangeMinScore?.("reroll", v)}
                />
              </span>
            </span>
          </div>
        ) : null}
      </div>
      {!collapsed && suggestions.length > 0 ? (
        <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 px-3 pb-3">
          {suggestions.map((s) => (
            <ResourceSuggestionCard
              key={`${s.kind}-${s.buildKey}-${s.slot}-${s.mainStat}-${s.lockedSubs.join("-")}-${s.sourceArtifact?.id ?? ""}`}
              suggestion={s}
              globalConfigHash={globalConfigHash}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TierNumberCell({
  value,
  min = 0,
  max,
  ariaLabel,
  onChange,
}: {
  value: number;
  min?: number;
  max: number;
  ariaLabel: string;
  onChange: (v: number) => void;
}) {
  return (
    <DebouncedNumberInput
      value={value}
      min={min}
      max={max}
      aria-label={ariaLabel}
      className="h-7 w-10 text-xs px-1 text-center border-border bg-muted/40"
      onValueChange={onChange}
    />
  );
}
