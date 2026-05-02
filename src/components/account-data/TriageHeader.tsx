import {
  ArrowDown,
  ArrowUp,
  ChevronsDownUp,
  ChevronsUpDown,
  Monitor,
  Puzzle,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { AccountDataHelpButton } from "@/components/account-data/AccountDataHelpButton";
import { FlexPatternDialog } from "@/components/account-data/FlexPatternDialog";
import { TriageHelpDialog } from "@/components/account-data/TriageHelpDialog";
import { TriageSettingsPanel } from "@/components/account-data/TriageSettingsPanel";
import type { TriageTabContentHandle } from "@/components/account-data/TriageTabContent";
import { ArtifactManagerDialog } from "@/components/shared/ArtifactManagerDialog";
import { FilterChip } from "@/components/shared/FilterChip";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { useLanguage } from "@/contexts/LanguageContext";
import { allSlots, type Slot } from "@/data/enums";
import { allHalfSetIds } from "@/data/gameResources";
import type { ManagePayload } from "@/lib/account-data/manager/types";
import { QUALITY_TIERS } from "@/lib/account-data/triage/constants";
import type {
  FlexPattern,
  QualityTier,
  TriageDecision,
  TriageSettings,
} from "@/lib/account-data/triage/types";
import { cn } from "@/lib/utils";
import { TRIAGE_TIER_COLORS } from "../shared/colors";

type Translator = ReturnType<typeof useLanguage>["t"];

const TIER_KEY = {
  prime: "triage.tier.prime",
  solid: "triage.tier.solid",
  filler: "triage.tier.filler",
  fodder: "triage.tier.fodder",
} as const;

const TIER_COLOR = TRIAGE_TIER_COLORS.text;

export type SortDimension = "tier" | "name" | "level";

function backupAmountModeLabel(
  mode: TriageSettings["backupAmountMode"],
  t: Translator
) {
  if (mode === "normal") return t.ui("triage.backupAmountNormal");
  if (mode === "extra") return t.ui("triage.backupAmountExtra");
  return t.ui("triage.backupAmountCustom");
}

export function TriageHeader({
  t,
  settings,
  onSettingsChange,
  flexPatterns,
  decisions,
  tierFilter,
  onToggleTier,
  halfSetFilter,
  onHalfSetFilterChange,
  slotFilter,
  onSlotFilterChange,
  activeSortDim,
  activeSortDir,
  onToggleSort,
  buildManagerInstructions,
  tabContentRef,
  sourceAgeBadge,
}: {
  t: Translator;
  settings: TriageSettings;
  onSettingsChange: (s: TriageSettings) => void;
  flexPatterns: FlexPattern[];
  decisions: TriageDecision[];
  tierFilter: Set<QualityTier>;
  onToggleTier: (tier: QualityTier) => void;
  halfSetFilter: Set<string>;
  onHalfSetFilterChange: (nextValues: Set<string>) => void;
  slotFilter: Set<Slot>;
  onSlotFilterChange: (nextValues: Set<Slot>) => void;
  activeSortDim: SortDimension;
  activeSortDir: "asc" | "desc";
  onToggleSort: (dim: SortDimension) => void;
  buildManagerInstructions: () => ManagePayload;
  tabContentRef?: React.RefObject<TriageTabContentHandle | null>;
  sourceAgeBadge?: React.ReactNode;
}) {
  const [flexOpen, setFlexOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [, forceRender] = useState(0);

  const totalArtifacts = decisions.length;
  const tierCounts: Record<QualityTier, number> = {
    prime: 0,
    solid: 0,
    filler: 0,
    fodder: 0,
  };
  for (const d of decisions) {
    const tier = d.decidingResult?.tier ?? "fodder";
    tierCounts[tier]++;
  }

  return (
    <div className="px-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap pb-2">
        <h2 className="text-xl font-semibold">{t.ui("triage.title")}</h2>
        <AccountDataHelpButton
          label={t.ui("buttons.help")}
          onClick={() => setHelpOpen(true)}
        />
        {sourceAgeBadge}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings className="w-4 h-4" />
              {t.ui("triage.settings")} (
              {backupAmountModeLabel(settings.backupAmountMode, t)})
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto">
            <TriageSettingsPanel
              settings={settings}
              onChange={onSettingsChange}
              t={t}
              onOpenHelp={() => setHelpOpen(true)}
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
        </p>
        <div className="flex items-center gap-1.5 ml-2">
          {QUALITY_TIERS.map((tier) => (
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
        <FilterChipGroup
          label={t.ui("triage.filterByHalfSet")}
          options={allHalfSetIds}
          selectedValues={halfSetFilter}
          onSelectedValuesChange={onHalfSetFilterChange}
          getKey={(halfSetId) => halfSetId}
          getLabel={(halfSetId) => t.halfSetShort(halfSetId)}
          className="px-0"
          collapsible
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <FilterChipGroup
          label={t.ui("triage.filterBySlot")}
          options={allSlots}
          selectedValues={slotFilter}
          onSelectedValuesChange={onSlotFilterChange}
          getKey={(slot) => slot}
          getLabel={(slot) => t.slot(slot)}
          className="px-0"
          collapsible
        />
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
