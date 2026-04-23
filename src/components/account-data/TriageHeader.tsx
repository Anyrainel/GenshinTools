import { FlexPatternDialog } from "@/components/account-data/FlexPatternDialog";
import { TriageHelpDialog } from "@/components/account-data/TriageHelpDialog";
import { TriageSettingsPanel } from "@/components/account-data/TriageSettingsPanel";
import type { TriageTabContentHandle } from "@/components/account-data/TriageTabContent";
import { ArtifactManagerDialog } from "@/components/shared/ArtifactManagerDialog";
import { FilterChip } from "@/components/shared/FilterChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { useLanguage } from "@/contexts/LanguageContext";
import { allHalfSetIds } from "@/data/gameResources";
import type { ManagePayload } from "@/lib/account-data/manager/types";
import type {
  FlexPattern,
  TriageDecision,
  TriageSettings,
} from "@/lib/account-data/triage/types";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleHelp,
  Monitor,
  Puzzle,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { TRIAGE_TIER_COLORS } from "../shared/colors";

type T = ReturnType<typeof useLanguage>["t"];

const TIER_KEY = {
  P: "triage.tier.P",
  Q: "triage.tier.Q",
  N: "triage.tier.N",
  T: "triage.tier.T",
} as const;

const TIER_COLOR = TRIAGE_TIER_COLORS.text;

export type SortDimension = "tier" | "name" | "level";

export function TriageHeader({
  t,
  settings,
  onSettingsChange,
  flexPatterns,
  decisions,
  tierFilter,
  onToggleTier,
  halfSetFilter,
  onToggleHalfSet,
  activeSortDim,
  activeSortDir,
  onToggleSort,
  buildManagerInstructions,
  tabContentRef,
}: {
  t: T;
  settings: TriageSettings;
  onSettingsChange: (s: TriageSettings) => void;
  flexPatterns: FlexPattern[];
  decisions: TriageDecision[];
  tierFilter: Set<string>;
  onToggleTier: (tier: string) => void;
  halfSetFilter: Set<string>;
  onToggleHalfSet: (hsId: string) => void;
  activeSortDim: SortDimension;
  activeSortDir: "asc" | "desc";
  onToggleSort: (dim: SortDimension) => void;
  buildManagerInstructions: () => ManagePayload;
  tabContentRef?: React.RefObject<TriageTabContentHandle | null>;
}) {
  const [flexOpen, setFlexOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [, forceRender] = useState(0);

  const totalArtifacts = decisions.length;
  const tierCounts = { P: 0, Q: 0, N: 0, T: 0 };
  for (const d of decisions) {
    const tier = d.decidingResult?.tier ?? "T";
    tierCounts[tier as keyof typeof tierCounts]++;
  }

  return (
    <div className="px-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold">{t.ui("triage.title")}</h2>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings className="w-4 h-4" />
              {t.ui("triage.settings")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto">
            <TriageSettingsPanel
              settings={settings}
              onChange={onSettingsChange}
              t={t}
            />
          </PopoverContent>
        </Popover>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setFlexOpen(true)}
        >
          <Puzzle className="w-4 h-4" />
          {t.ui("triage.flexPatterns")}
          {flexPatterns.length > 0 && (
            <Badge variant="secondary" className="text-xs ml-0.5">
              {flexPatterns.length}
            </Badge>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
          onClick={() => setManagerOpen(true)}
        >
          <Monitor className="h-4 w-4" />
          {t.ui("manager.applyToGame")}
        </Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm">
          {t.ui("triage.subtitle").replace("{0}", totalArtifacts.toString())}
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="ml-1.5 inline-flex align-text-bottom text-amber-400 hover:text-amber-300 transition-colors"
          >
            <CircleHelp className="size-4" />
          </button>
        </p>
        <div className="flex items-center gap-1.5 ml-2">
          {(["P", "Q", "N", "T"] as const).map((tier) => (
            <FilterChip
              key={tier}
              active={tierFilter.has(tier)}
              onClick={() => onToggleTier(tier)}
            >
              <span className={cn("text-sm font-semibold", TIER_COLOR[tier])}>
                {tierCounts[tier]}
              </span>
              <span className="text-sm">{t.ui(TIER_KEY[tier])}</span>
            </FilterChip>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <span className="text-sm font-medium text-foreground">
            {t.ui("filters.sort")}
          </span>
          {(
            [
              ["name", "triage.sortByName"],
              ["tier", "triage.sortByTier"],
              ["level", "common.level"],
            ] as const
          ).map(([dim, labelKey]) => {
            const isActive = activeSortDim === dim;
            return (
              <Button
                key={dim}
                variant="outline"
                size="sm"
                onClick={() => onToggleSort(dim)}
                className={cn(
                  "h-7 px-2 text-sm gap-1 min-w-[4.5rem]",
                  isActive
                    ? "bg-primary/40 text-primary-foreground border-primary/20"
                    : "border-border"
                )}
              >
                {t.ui(labelKey)}
                {isActive ? (
                  activeSortDir === "asc" ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5" />
                  )
                ) : (
                  <ArrowDown className="h-3.5 w-3.5 opacity-30" />
                )}
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-sm gap-1 border-border"
            onClick={() => {
              const handle = tabContentRef?.current;
              if (!handle) return;
              if (handle.hasExpanded) handle.collapseAll();
              else handle.expandAll();
              forceRender((n) => n + 1);
            }}
          >
            {tabContentRef?.current?.hasExpanded ? (
              <>
                {t.ui("triage.collapseAll")}
                <ChevronsDownUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                {t.ui("triage.expandAll")}
                <ChevronsUpDown className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-sm font-medium text-foreground shrink-0">
          {t.ui("triage.filterByHalfSet")}
        </span>
        {allHalfSetIds.map((hsId) => (
          <FilterChip
            key={hsId}
            active={halfSetFilter.size === 0 || halfSetFilter.has(hsId)}
            onClick={() => onToggleHalfSet(hsId)}
          >
            {t.halfSetShort(hsId)}
          </FilterChip>
        ))}
      </div>
      <TriageHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <FlexPatternDialog
        open={flexOpen}
        onOpenChange={setFlexOpen}
        flexPatterns={flexPatterns}
        settings={settings}
        onSettingsChange={onSettingsChange}
      />
      <ArtifactManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
        job={{ type: "manage", build: buildManagerInstructions }}
        actionLabel={t.ui("manager.applyToGame")}
      />
    </div>
  );
}
